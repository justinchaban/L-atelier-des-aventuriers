import type { Character } from '../models/Character';
import { migrateCharacter, validateCharacterStructure } from '../engine/characterValidation';

export const CHARACTER_STORAGE_KEY = 'atelier-aventuriers:characters:v1';
export const CHARACTER_RECOVERY_PREFIX = `${CHARACTER_STORAGE_KEY}:recovery:`;
export interface CharacterLoadReport {
  characters: Character[];
  status: 'empty' | 'loaded' | 'anomaly' | 'unavailable';
  issues: string[];
  /** Copie exacte, jamais réécrite au chargement. */
  originalData: string | null;
  recoveryCopies: string[];
}
export interface CharacterSaveResult {
  success: boolean;
  error?: string;
  recoveryKey?: string;
  originalData?: string;
}

export function parseCharacterStorage(raw: string | null): CharacterLoadReport {
  if (raw === null) return { characters: [], status: 'empty', issues: [], originalData: null, recoveryCopies: [] };
  const issues: string[] = [];
  const characters: Character[] = [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) issues.push('La sauvegarde doit contenir une liste de personnages.');
    else {
      const seen = new Set<string>();
      data.forEach((entry, index) => {
        const result = migrateCharacter(entry);
        issues.push(...result.issues.map(issue => `Personnage ${index + 1} : ${issue}`));
        if (result.character) {
          if (seen.has(result.character.id)) issues.push(`Personnage ${index + 1} : identifiant dupliqué, entrée conservée dans les données originales.`);
          else { seen.add(result.character.id); characters.push(result.character); }
        }
      });
    }
  } catch { issues.push('JSON illisible : données originales disponibles pour récupération.'); }
  return { characters, status: issues.length ? 'anomaly' : 'loaded', issues, originalData: raw, recoveryCopies: [] };
}

export function loadCharacters(): CharacterLoadReport {
  try {
    const report = parseCharacterStorage(localStorage.getItem(CHARACTER_STORAGE_KEY));
    // Les copies restent exportables après rechargement, sans écriture ni nettoyage.
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key?.startsWith(CHARACTER_RECOVERY_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw !== null && !report.recoveryCopies.includes(raw)) report.recoveryCopies.push(raw);
        }
      }
    } catch {
      report.issues.push('Impossible de lire certaines copies de récupération.');
    }
    return report;
  } catch {
    return { characters: [], status: 'unavailable', issues: ['Impossible de lire les personnages. Toute écriture restera soumise à une nouvelle lecture du stockage.'], originalData: null, recoveryCopies: [] };
  }
}

export function saveCharacters(characters: Character[]): CharacterSaveResult {
  let originalData: string | null = null;
  let recoveryKey: string | undefined;
  try {
    // Contrôle strict des données sortantes : aucune réparation silencieuse.
    const ids = new Set<string>();
    for (const character of characters) {
      if (validateCharacterStructure(character).length || ids.has(character.id)) {
        return { success: false, error: 'Sauvegarde refusée : structure invalide ou identifiant dupliqué.' };
      }
      ids.add(character.id);
    }
    const serialized = JSON.stringify(characters);
    // Relire avant CHAQUE écriture, y compris après un échec de chargement.
    originalData = localStorage.getItem(CHARACTER_STORAGE_KEY);
    const current = parseCharacterStorage(originalData);
    if (current.status === 'anomaly' && originalData !== null) {
      recoveryKey = CHARACTER_RECOVERY_PREFIX + crypto.randomUUID();
      localStorage.setItem(recoveryKey, originalData);
      if (localStorage.getItem(recoveryKey) !== originalData) throw new Error('Copie de récupération non vérifiée.');
    }
    // Éviter d'écraser une modification survenue pendant la préparation de la copie.
    if (localStorage.getItem(CHARACTER_STORAGE_KEY) !== originalData) throw new Error('Stockage modifié pendant la sauvegarde.');
    localStorage.setItem(CHARACTER_STORAGE_KEY, serialized);
    return { success: true, recoveryKey, ...(recoveryKey && originalData !== null ? { originalData } : {}) };
  } catch {
    return {
      success: false,
      error: 'Sauvegarde impossible ou bloquée pour protéger les données originales. Exportez vos données avant de quitter.',
      recoveryKey,
      ...(originalData !== null ? { originalData } : {})
    };
  }
}
