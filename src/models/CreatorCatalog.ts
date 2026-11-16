import type { CharacterClass, ClassFeature, Subclass } from './Class';
import type { Species, Ruleset } from './Species';
import type { Background } from './Background';
import type { Feat } from './Feat';
import type { EquipmentItem } from './Equipment';
import type { Weapon } from './Weapon';
import type {
  LibraryContentId, LibraryFingerprint, LibraryConverter, LibraryDependency
} from './Library';

/** Contrat du catalogue, indépendant du schéma des personnages et d'IndexedDB. */
export const CREATOR_CATALOG_VERSION = 1 as const;
export type CreatorCatalogKey = `native:v1:${string}` | `library:v1:${string}`;

export interface CreatorDefinitionMap {
  class: CharacterClass;
  subclass: Subclass;
  classFeature: ClassFeature;
  subclassFeature: ClassFeature;
  species: Species;
  background: Background;
  feat: Feat;
  equipment: EquipmentItem | Weapon;
}

export type CreatorCategory = keyof CreatorDefinitionMap;

export type CreatorReference =
  | { origin: 'native'; manifestVersion: string }
  | {
      origin: 'library';
      contentId: LibraryContentId;
      revisionHash: LibraryFingerprint;
      converter: LibraryConverter;
      adapterVersion: string;
      artifactHash: LibraryFingerprint;
      dependencies: readonly LibraryDependency[];
    };

export interface CreatorDiagnostic {
  code: string;
  contentId?: LibraryContentId;
  revisionHash?: LibraryFingerprint;
  path?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface CreatorProvenance {
  originalName: string;
  originalSource: string;
  canonicalBookId: string;
  ruleset: Ruleset;
  /** Une capacité sans livre explicite hérite de celui de son propriétaire. */
  bookInherited: boolean;
}

export type CreatorUnavailableState =
  | 'preview-only' | 'stale' | 'archived' | 'missing' | 'invalid' | 'conflict';

/**
 * Seule la branche ready expose une définition mécanique.
 * native-reviewed signifie parité avec les règles natives actuelles, pas couverture
 * complète de toutes les règles D&D. Une conversion future devra être validée.
 */
export type CreatorMechanicalCatalogEntry<K extends CreatorCategory = CreatorCategory> = {
  [C in K]: {
    readonly catalogKey: CreatorCatalogKey;
    readonly category: C;
    readonly domainId: string;
    readonly ownerKey?: CreatorCatalogKey;
    readonly reference: CreatorReference;
    readonly provenance: Readonly<CreatorProvenance>;
    readonly diagnostics: readonly CreatorDiagnostic[];
  } & (
    | {
        readonly availability: 'ready';
        readonly validation: 'native-reviewed' | 'converted-validated';
        readonly rulesProfile: string;
        readonly definition: CreatorDefinitionMap[C];
      }
    | {
        readonly availability: CreatorUnavailableState;
        readonly definition?: never;
        readonly validation?: never;
        readonly rulesProfile?: never;
      }
  )
}[K];

/** Candidat de consultation : aucune preuve mécanique ni édition supposée. */
export interface CreatorLibraryCandidate {
  readonly catalogKey: CreatorCatalogKey;
  readonly category: CreatorCategory;
  readonly domainId?: string;
  readonly ownerKey?: CreatorCatalogKey;
  readonly reference: {
    readonly origin: 'library';
    readonly contentId: LibraryContentId;
    readonly revisionHash: LibraryFingerprint;
    readonly dependencies: readonly LibraryDependency[];
  };
  readonly provenance: Readonly<Omit<CreatorProvenance, 'ruleset'> & { ruleset?: Ruleset }>;
  readonly libraryStatus: 'active' | 'archived';
  readonly conversionState: 'absent' | 'converted-unverified' | 'partial' | 'stale' | 'invalid';
  readonly historicalRevisions: readonly LibraryFingerprint[];
  readonly availability: CreatorUnavailableState;
  readonly diagnostics: readonly CreatorDiagnostic[];
  readonly definition?: never;
  readonly validation?: never;
  readonly rulesProfile?: never;
}

export type CreatorCatalogEntry<K extends CreatorCategory = CreatorCategory> =
  CreatorMechanicalCatalogEntry<K> | (CreatorLibraryCandidate & { readonly category: K });

export interface CreatorCatalog {
  readonly contractVersion: typeof CREATOR_CATALOG_VERSION;
  /** Catégories effectivement fournies ; les autres types préparent la suite. */
  readonly categories: readonly CreatorCategory[];
  readonly entries: readonly CreatorCatalogEntry[];
}

/** Disponibilité et autorisation restent deux décisions indépendantes. */
export interface CreatorAccess {
  allowedByCampaign: boolean;
  selectable: boolean;
  diagnostics: readonly CreatorDiagnostic[];
}

/** API asynchrone ; le créateur conserve son catalogue natif synchrone en P2.3. */
export interface CreatorCatalogService {
  load(): Promise<CreatorCatalog>;
}
