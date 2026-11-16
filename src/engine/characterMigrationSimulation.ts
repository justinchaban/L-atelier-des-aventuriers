import type { CharacterV2 } from '../models/CharacterV2';
import type { LibraryFingerprint } from '../models/Library';
import type { CharacterListMigrationReport, MigrationDiagnostic } from './characterMigration';
import { copyMigrationJson, prepareCharacterListMigration, validateCharacterV2 } from './characterMigration';
import { fingerprintLibraryJson, serializeLibraryJson } from './libraryIdentity';
import { freezeMechanical } from './nativeMechanicalBaseline';

// Clés PROPOSÉES uniquement. Ce module n'est utilisé ni par App ni par storage.ts.
export const PROPOSED_CHARACTER_V1_KEY = 'atelier-aventuriers:characters:v1';
export const PROPOSED_CHARACTER_V2_KEY = 'atelier-aventuriers:characters:v2';
const RECOVERY_PREFIX = `${PROPOSED_CHARACTER_V2_KEY}:recovery:v1:`;
export interface PreparedCharacterStoreV2 {
  storageVersion: 2;
  generation: 1;
  sourceV1Hash: LibraryFingerprint;
  characters: readonly CharacterV2[];
  envelopeHash: LibraryFingerprint;
}
export interface CharacterMigrationPlan {
  status: 'prepared' | 'blocked';
  originalData: string | null;
  report: CharacterListMigrationReport;
  diagnostics: MigrationDiagnostic[];
  sourceHash: LibraryFingerprint;
  recoveryKey: string;
  recoveryData: string;
  targetData?: string;
  sizes: { sourceCodeUnits: number; recoveryCodeUnits: number; targetCodeUnits: number; estimatedUtf16Bytes: number };
}
const issue = (code: string, message: string): MigrationDiagnostic => ({ code, path: '$', severity: 'error', message });

/** Lecture de la chaîne FOURNIE, jamais de localStorage. Conserve exactement la chaîne source fournie. */
export async function prepareStoredCharacterMigration(originalData: string | null): Promise<CharacterMigrationPlan> {
  if (originalData !== null && typeof originalData !== 'string') throw new TypeError('Chaîne source ou absence explicite attendue.');
  let parsed: unknown = [], parseIssue: MigrationDiagnostic | undefined;
  if (originalData !== null) try { parsed = JSON.parse(originalData); }
  catch { parsed = null; parseIssue = issue('invalid-json', 'JSON illisible ; chaîne originale conservée intégralement.'); }
  const report = await prepareCharacterListMigration(parsed);
  const diagnostics = parseIssue ? [parseIssue, ...report.diagnostics] : [...report.diagnostics];
  const sourceHash = await fingerprintLibraryJson({ originalData });
  const recoveryKey = RECOVERY_PREFIX + sourceHash;
  const recoveryData = serializeLibraryJson({ formatVersion: 1, sourceKey: PROPOSED_CHARACTER_V1_KEY, originalData, sourceHash });
  let targetData: string | undefined;
  if (report.canPreparePersistence && !diagnostics.some(d => d.severity === 'error')) {
    const body = { storageVersion: 2 as const, generation: 1 as const, sourceV1Hash: sourceHash, characters: report.entries.map(entry => entry.character!) };
    targetData = serializeLibraryJson({ ...body, envelopeHash: await fingerprintLibraryJson(body) });
  }
  return freezeMechanical({ status: targetData === undefined ? 'blocked' : 'prepared', originalData, report, diagnostics, sourceHash, recoveryKey, recoveryData,
    ...(targetData === undefined ? {} : { targetData }), sizes: { sourceCodeUnits: originalData?.length ?? 0,
      recoveryCodeUnits: recoveryData.length, targetCodeUnits: targetData?.length ?? 0,
      estimatedUtf16Bytes: 2 * ((originalData?.length ?? 0) + recoveryData.length + (targetData?.length ?? 0) +
        PROPOSED_CHARACTER_V1_KEY.length + PROPOSED_CHARACTER_V2_KEY.length + recoveryKey.length) } });
}

export async function validatePreparedCharacterStoreV2(raw: string): Promise<boolean> {
  try {
    const value = copyMigrationJson(JSON.parse(raw));
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== 'characters,envelopeHash,generation,sourceV1Hash,storageVersion' ||
        value.storageVersion !== 2 || value.generation !== 1 || typeof value.sourceV1Hash !== 'string' || !/^sha256:v1:[a-f0-9]{64}$/.test(value.sourceV1Hash) || !Array.isArray(value.characters)) return false;
    const { envelopeHash, ...body } = value;
    if (await fingerprintLibraryJson(body) !== envelopeHash) return false;
    const ids = new Set<string>();
    for (const character of value.characters) {
      const validation = await validateCharacterV2(character);
      if (!validation.valid || !validation.character || ids.has(validation.character.id)) return false;
      ids.add(validation.character.id);
    }
    return true;
  } catch { return false; }
}
export interface MigrationSimulationOptions {
  /** Simulation de quota en unités UTF-16 (clés + valeurs), pas une limite navigateur universelle. */
  quotaCodeUnits?: number;
  /** 0 avant opération ; 1..6 après chaque opération de la trace. */
  interruptAfter?: number;
  failVerification?: 'recovery' | 'target';
  concurrentBeforeTarget?: { key: string; value: string | null };
}
export interface MigrationSimulationResult {
  status: 'committed' | 'already-committed' | 'blocked' | 'conflict' | 'corrupt-v2' | 'quota' | 'interrupted' | 'verification-failed';
  state: Record<string, string>;
  trace: string[];
  message: string;
}
/** Machine de simulation pure : aucune API réelle de lecture/écriture, y compris dans les erreurs. */
export async function simulateCharacterMigration(plan: CharacterMigrationPlan, initialState: Readonly<Record<string, string>>, options: MigrationSimulationOptions = {}): Promise<MigrationSimulationResult> {
  const state: Record<string, string> = copyMigrationJson(initialState);
  const trace: string[] = [];
  const finish = (status: MigrationSimulationResult['status'], message: string): MigrationSimulationResult => ({ status, state, trace, message });
  const read = (key: string) => Object.hasOwn(state, key) ? state[key] : null;
  if (!state || typeof state !== 'object' || Array.isArray(state) || Object.values(state).some(v => typeof v !== 'string')) throw new TypeError('État simulé : dictionnaire de chaînes attendu.');
  if (options.quotaCodeUnits !== undefined && (!Number.isSafeInteger(options.quotaCodeUnits) || options.quotaCodeUnits < 0)) throw new TypeError('Quota simulé invalide.');
  if (options.interruptAfter !== undefined && (!Number.isInteger(options.interruptAfter) || options.interruptAfter < 0 || options.interruptAfter > 6)) throw new TypeError('Point d’interruption invalide.');
  if (plan.status !== 'prepared' || !plan.targetData || !await validatePreparedCharacterStoreV2(plan.targetData)) return finish('blocked', 'Plan incomplet ou invalide ; aucune écriture simulée.');
  // Un objet de plan modifié ne peut détourner les clés ou désolidariser sauvegarde et source.
  const hash = await fingerprintLibraryJson({ originalData: plan.originalData });
  const recovery = serializeLibraryJson({ formatVersion: 1, sourceKey: PROPOSED_CHARACTER_V1_KEY, originalData: plan.originalData, sourceHash: hash });
  const target = JSON.parse(plan.targetData) as PreparedCharacterStoreV2;
  const expected = await prepareStoredCharacterMigration(plan.originalData);
  if (expected.status !== 'prepared' || expected.targetData !== plan.targetData) return finish('blocked', 'Le contenu cible ne correspond pas à la préparation sans perte de la source.');
  if (plan.sourceHash !== hash || plan.recoveryKey !== RECOVERY_PREFIX + hash || plan.recoveryData !== recovery || target.sourceV1Hash !== hash) return finish('blocked', 'Provenance du plan incohérente.');
  if (options.interruptAfter === 0) return finish('interrupted', 'Interruption avant toute opération.');
  if (read(PROPOSED_CHARACTER_V1_KEY) !== plan.originalData) return finish('conflict', 'La source v1 a changé ; aucune substitution.');
  const existing = read(PROPOSED_CHARACTER_V2_KEY);
  if (existing !== null) {
    if (!await validatePreparedCharacterStoreV2(existing)) return finish('corrupt-v2', 'v2 existant corrompu : conserver et récupérer, sans retour automatique vers v1.');
    if (existing === plan.targetData && read(plan.recoveryKey) === plan.recoveryData) return finish('already-committed', 'Reprise vérifiée du même plan ; aucun nouvel enregistrement.');
    return finish('conflict', 'Une sauvegarde v2 existe déjà ; aucun écrasement.');
  }
  const interrupted = (step: string) => { trace.push(step); return options.interruptAfter === trace.length; };
  const write = (key: string, value: string) => {
    const next = { ...state, [key]: value };
    const size = Object.entries(next).reduce((total, [k,v]) => total + k.length + v.length, 0);
    if (options.quotaCodeUnits !== undefined && size > options.quotaCodeUnits) return false;
    Object.defineProperty(state, key, { value, enumerable: true, configurable: true, writable: true }); return true;
  };
  if (interrupted('verify-source')) return finish('interrupted', 'Source vérifiée ; aucune écriture.');
  if (read(plan.recoveryKey) !== null && read(plan.recoveryKey) !== plan.recoveryData) return finish('conflict', 'Copie de récupération différente : préservée, jamais écrasée.');
  if (!write(plan.recoveryKey, plan.recoveryData)) return finish('quota', 'Quota à la sauvegarde de récupération ; source intacte.');
  if (interrupted('write-recovery')) return finish('interrupted', 'Copie présente, v2 non écrit.');
  if (options.failVerification === 'recovery' || read(plan.recoveryKey) !== plan.recoveryData) return finish('verification-failed', 'Sauvegarde non vérifiée : v2 interdit.');
  if (interrupted('verify-recovery')) return finish('interrupted', 'Copie vérifiée, v2 non écrit.');
  if (options.concurrentBeforeTarget) {
    const change = options.concurrentBeforeTarget;
    if (change.value === null) delete state[change.key];
    else Object.defineProperty(state, change.key, { value: change.value, enumerable: true, configurable: true, writable: true });
  }
  if (read(PROPOSED_CHARACTER_V1_KEY) !== plan.originalData || read(PROPOSED_CHARACTER_V2_KEY) !== null || read(plan.recoveryKey) !== plan.recoveryData) return finish('conflict', 'Modification concurrente détectée ; aucun écrasement par le plan.');
  if (interrupted('verify-conflicts')) return finish('interrupted', 'Conflits contrôlés ; v2 non écrit.');
  if (!write(PROPOSED_CHARACTER_V2_KEY, plan.targetData)) return finish('quota', 'Quota à l’écriture v2 ; source et récupération conservées.');
  if (interrupted('write-target')) return finish('interrupted', 'v2 présent mais opération non confirmée ; reprise nécessaire.');
  if (options.failVerification === 'target' || read(PROPOSED_CHARACTER_V2_KEY) !== plan.targetData) return finish('verification-failed', 'v2 non confirmé ; conserver les versions et demander récupération.');
  if (interrupted('verify-target')) return finish('interrupted', 'Écriture vérifiée mais notification interrompue ; reprise idempotente.');
  return finish('committed', 'Écriture simulée et relue ; aucune clé applicative activée.');
}
