import type { ContentCategory, ContentProvider, RulesEdition } from './ContentSource';
import type { CharacterClass, ClassFeature, Subclass } from './Class';
import type { Species } from './Species';
import type { Background } from './Background';
import type { Feat } from './Feat';
import type { EquipmentItem } from './Equipment';
import type { Weapon } from './Weapon';

export const LIBRARY_RECORD_VERSION = 1 as const;
export const LIBRARY_IDENTITY_VERSION = 1 as const;
export type LibraryContentId = `library:v1:${string}`;
export type LibraryFingerprint = `sha256:v1:${string}`;

export interface LibraryOwnerIdentity {
  name: string;
  source: string;
}

/** Entrée indépendante des identifiants métier. Source et nom ne sont pas modifiés. */
export interface LibraryIdentityInput {
  provider: ContentProvider;
  /** Obligatoire pour custom/homebrew : espace stable choisi par l'utilisateur. */
  namespace?: string;
  category: ContentCategory;
  name: string;
  source: string;
  classOwner?: LibraryOwnerIdentity;
  subclassOwner?: LibraryOwnerIdentity;
  level?: number;
  /** Obligatoire pour equipment afin de distinguer item/baseitem/itemGroup. */
  originalKey?: string;
}

export interface LibraryIdentity {
  identityVersion: typeof LIBRARY_IDENTITY_VERSION;
  id: LibraryContentId;
  provider: ContentProvider;
  namespace: string;
  category: ContentCategory;
  normalizedName: string;
  bookId: string;
  classOwner?: LibraryOwnerIdentity;
  subclassOwner?: LibraryOwnerIdentity;
  level?: number;
  originalKey?: string;
}

export type LibraryIdentityResult =
  | { success: true; identity: LibraryIdentity }
  | { success: false; issues: string[] };

/** Une seule copie du texte par empreinte ; jamais de chemin absolu local. */
export interface LibraryImportDocument {
  recordVersion: typeof LIBRARY_RECORD_VERSION;
  id: LibraryFingerprint;
  originalText: string;
  filenames: string[];
  importedAt: string;
}

/** Pointe vers l'original, sans recopier un fichier ni une entrée complète. */
export interface LibraryOriginalLocation {
  importId: LibraryFingerprint;
  /** JSON Pointer RFC 6901, par exemple /class/0. */
  pointer: string;
}

export interface LibraryProvenance {
  provider: ContentProvider;
  namespace: string;
  originalName: string;
  originalSource: string;
  bookId: string;
  originalKey: string;
  originalReference?: string;
  location: LibraryOriginalLocation;
}

export interface LibraryContentRecord {
  recordVersion: typeof LIBRARY_RECORD_VERSION;
  identity: LibraryIdentity;
  activeRevision: LibraryFingerprint;
  /** Jeton monotone pour les écritures concurrentes, y compris après restauration. */
  generation: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface LibraryRevision {
  recordVersion: typeof LIBRARY_RECORD_VERSION;
  contentId: LibraryContentId;
  /** Empreinte de l'entrée originale, indépendante des convertisseurs. */
  revisionHash: LibraryFingerprint;
  /** Plusieurs fichiers peuvent contenir la même entrée. */
  origins: LibraryProvenance[];
  /** Ajouts P1.3 optionnels : lecture des anciennes révisions inchangée. */
  dependencies?: LibraryDependency[];
  conversions?: LibraryConversion[];
  createdAt: string;
}

/** Les catégories sans convertisseur restent importées, sans faux payload converti. */
export type LibraryConvertedPayload =
  | { category: 'class'; data: CharacterClass }
  | { category: 'subclass'; data: Subclass }
  | { category: 'classFeature' | 'subclassFeature'; data: ClassFeature }
  | { category: 'species'; data: Species }
  | { category: 'background'; data: Background }
  | { category: 'feat'; data: Feat }
  | { category: 'equipment'; data: EquipmentItem | Weapon };

export interface LibraryConverter {
  id: string;
  version: string;
}

export interface LibraryDependency {
  ownerId: LibraryContentId;
  targetId: LibraryContentId;
  relation: 'owner' | 'feature' | 'copy';
  /** Révision effectivement utilisée par la conversion, si résolue. */
  revisionHash?: LibraryFingerprint;
}

/** Cache dérivé : sa version et les révisions des dépendances permettent la reconversion. */
export interface LibraryConversion {
  recordVersion: typeof LIBRARY_RECORD_VERSION;
  contentId: LibraryContentId;
  revisionHash: LibraryFingerprint;
  converter: LibraryConverter;
  dependencies: LibraryDependency[];
  result:
    | { status: 'converted'; payload: LibraryConvertedPayload; warnings: string[] }
    | { status: 'unresolved' | 'unsupported' | 'failed'; issues: string[] };
}

/** Disponibilité locale et autorisation de campagne sont évaluées séparément. */
export interface LibraryAccessEvaluation {
  contentId: LibraryContentId;
  availability: 'available' | 'unconverted' | 'unresolved' | 'archived' | 'missing';
  allowedByCampaign: boolean;
  rulesEdition?: RulesEdition;
}

export interface LibraryExistingState {
  revisionHash: LibraryFingerprint;
  generation: number;
}

export interface LibraryWriteExpectation {
  contentId: LibraryContentId;
  /** null signifie : l'entrée doit toujours être absente au moment de l'écriture. */
  expected: LibraryExistingState | null;
}

export type LibraryImportDecision =
  | { kind: 'create'; identity: LibraryIdentity; revisionHash: LibraryFingerprint; expectation: LibraryWriteExpectation & { expected: null } }
  | { kind: 'unchanged' | 'update'; identity: LibraryIdentity; revisionHash: LibraryFingerprint; expectation: LibraryWriteExpectation & { expected: LibraryExistingState } }
  | { kind: 'conflict'; identity: LibraryIdentity; revisions: LibraryFingerprint[]; issues: string[] }
  | { kind: 'unidentified'; location: LibraryOriginalLocation; issues: string[] };

export interface LibraryImportPlan {
  recordVersion: typeof LIBRARY_RECORD_VERSION;
  importId: LibraryFingerprint;
  decisions: LibraryImportDecision[];
}

export type LibraryCommitResult =
  | { success: true; created: number; updated: number; unchanged: number }
  | { success: false; reason: 'concurrent-change' | 'invalid-data' | 'storage-error'; issues: string[] };
