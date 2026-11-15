import { normalizeBookId } from '../data/books';
import { LIBRARY_IDENTITY_VERSION } from '../models/Library';
import type { LibraryFingerprint, LibraryIdentity, LibraryIdentityInput, LibraryIdentityResult, LibraryOwnerIdentity } from '../models/Library';

const CATEGORIES = ['class', 'subclass', 'classFeature', 'subclassFeature', 'species', 'background', 'feat', 'spell', 'equipment'];
const PROVIDERS = ['srd', '5etools', 'homebrew', 'custom'];

/** NFC, casse et espaces périphériques uniquement : accents et ponctuation conservés. */
export function normalizeLibraryName(value: string): string {
  return value.normalize('NFC').trim().toLowerCase().normalize('NFC');
}

/** Sérialisation JSON stricte et déterministe. Aucun champ ignoré ou coercition implicite. */
export function serializeLibraryJson(value: unknown): string {
  const ancestors = new Set<object>();
  function visit(item: unknown): string {
    if (item === null) return 'null';
    if (typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || item === null) throw new TypeError('Valeur non JSON ou nombre non fini.');
    if (ancestors.has(item)) throw new TypeError('Référence circulaire.');
    ancestors.add(item);
    try {
      if (Object.getOwnPropertySymbols(item).length) throw new TypeError('Clé symbole non JSON.');
      if (Array.isArray(item)) {
        if (Object.getOwnPropertyNames(item).length !== item.length + 1) throw new TypeError('Tableau creux ou propriétés supplémentaires.');
        const elements: string[] = [];
        for (let index = 0; index < item.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
          if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new TypeError('Élément absent ou accesseur.');
          elements.push(visit(descriptor.value));
        }
        return `[${elements.join(',')}]`;
      }
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Objet JSON simple attendu.');
      const keys = Object.getOwnPropertyNames(item).sort();
      return `{${keys.map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (!descriptor.enumerable || !('value' in descriptor)) throw new TypeError('Propriété non JSON.');
        return `${JSON.stringify(key)}:${visit(descriptor.value)}`;
      }).join(',')}}`;
    } finally { ancestors.delete(item); }
  }
  return visit(value);
}

/** Empreinte du texte exact ; aucun tri ni normalisation des originaux. */
export async function fingerprintLibraryText(text: string): Promise<LibraryFingerprint> {
  if (typeof text !== 'string') throw new TypeError('Texte original attendu.');
  // Web Crypto natif : navigateur et Node moderne, aucune dépendance supplémentaire.
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:v1:${hex}`;
}

export async function fingerprintLibraryJson(value: unknown): Promise<LibraryFingerprint> {
  return fingerprintLibraryText(serializeLibraryJson(value));
}

/** Une identité insuffisante produit un diagnostic, jamais une clé de remplacement. */
export function createLibraryIdentity(input: LibraryIdentityInput): LibraryIdentityResult {
  const issues: string[] = [];
  const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  if (!input || typeof input !== 'object') return { success: false, issues: ['Identité : objet attendu.'] };
  if (!PROVIDERS.includes(input.provider)) issues.push('Fournisseur invalide.');
  if (!CATEGORIES.includes(input.category)) issues.push('Catégorie invalide.');
  if (!text(input.name)) issues.push('Nom original manquant.');
  if (!text(input.source)) issues.push('Source originale manquante.');
  if (input.namespace !== undefined && !text(input.namespace)) issues.push('Espace de noms invalide.');
  if (['custom', 'homebrew'].includes(input.provider) && !text(input.namespace)) issues.push('Espace de noms stable obligatoire pour custom/homebrew.');
  const owner = (value: LibraryOwnerIdentity | undefined, label: string): LibraryOwnerIdentity | undefined => {
    if (!value || !text(value.name) || !text(value.source)) {
      issues.push(`${label} : nom et source obligatoires.`);
      return undefined;
    }
    return { name: normalizeLibraryName(value.name), source: normalizeBookId(value.source) };
  };
  const needsClass = ['subclass', 'classFeature', 'subclassFeature'].includes(input.category);
  const needsSubclass = input.category === 'subclassFeature';
  const needsLevel = ['classFeature', 'subclassFeature'].includes(input.category);
  const classOwner = needsClass ? owner(input.classOwner, 'Classe propriétaire') : undefined;
  const subclassOwner = needsSubclass ? owner(input.subclassOwner, 'Sous-classe propriétaire') : undefined;
  if (!needsClass && input.classOwner !== undefined) issues.push('Classe propriétaire inattendue.');
  if (!needsSubclass && input.subclassOwner !== undefined) issues.push('Sous-classe propriétaire inattendue.');
  if (needsLevel && (!Number.isInteger(input.level) || input.level! < 1 || input.level! > 20)) issues.push('Niveau de capacité de 1 à 20 obligatoire.');
  if (!needsLevel && input.level !== undefined) issues.push('Niveau inattendu.');
  if (input.category === 'equipment' && !text(input.originalKey)) issues.push("Famille JSON d'équipement obligatoire.");
  if (issues.length) return { success: false, issues };

  const identity: LibraryIdentity = {
    identityVersion: LIBRARY_IDENTITY_VERSION,
    id: 'library:v1:',
    provider: input.provider,
    namespace: input.namespace?.normalize('NFC').trim() ?? '',
    category: input.category,
    normalizedName: normalizeLibraryName(input.name),
    bookId: normalizeBookId(input.source),
    ...(classOwner ? { classOwner } : {}),
    ...(subclassOwner ? { subclassOwner } : {}),
    ...(needsLevel ? { level: input.level } : {}),
    ...(input.category === 'equipment' ? { originalKey: input.originalKey!.trim() } : {})
  };
  // Tuple sérialisé : aucune collision par concaténation ou suppression de ponctuation.
  identity.id = `library:v1:${serializeLibraryJson([
    identity.provider, identity.namespace, identity.category, identity.normalizedName, identity.bookId,
    classOwner ? [classOwner.name, classOwner.source] : null,
    subclassOwner ? [subclassOwner.name, subclassOwner.source] : null,
    identity.level ?? null, identity.originalKey ?? null
  ])}`;
  return { success: true, identity };
}
