import type { CharacterClass, ClassFeature, ClassChoice, Subclass } from './Class';
import type { Species } from './Species';
import type { Background } from './Background';
import type { Feat } from './Feat';
import type { EquipmentItem, StartingEquipmentOption } from './Equipment';
import type { Weapon, WeaponMastery } from './Weapon';
import type { CreatorCatalogKey } from './CreatorCatalog';
import type { LibraryContentId, LibraryFingerprint, LibraryConverter } from './Library';

export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type MechanicalSnapshotId = `mechanics:v1:${string}`;
export type MechanicalSource =
  | { origin: 'native'; baselineId: string; baselineHash: LibraryFingerprint; revisionHash: LibraryFingerprint; adapter: LibraryConverter }
  | { origin: 'library'; contentId: LibraryContentId; revisionHash: LibraryFingerprint; converter: LibraryConverter; adapter: LibraryConverter; artifactHash: LibraryFingerprint };

export interface MechanicalDefinitionMap {
  class: Omit<CharacterClass, 'features' | 'subclasses' | 'structuredEntries' | 'importMetadata'> & {
    features: MechanicalSnapshotId[]; subclasses: MechanicalSnapshotId[];
  };
  subclass: Omit<Subclass, 'features' | 'structuredEntries' | 'importMetadata'> & { features: MechanicalSnapshotId[] };
  classFeature: Omit<ClassFeature, 'structuredEntries' | 'importMetadata'>;
  subclassFeature: Omit<ClassFeature, 'structuredEntries' | 'importMetadata'>;
  species: Species;
  background: Background;
  feat: Feat;
  equipment: EquipmentItem;
  weapon: Weapon;
  fightingStyle: ClassChoice['options'][number];
  equipmentOption: StartingEquipmentOption;
}
export type MechanicalCategory = keyof MechanicalDefinitionMap;
export type MechanicalDependency =
  | { state: 'resolved'; path: string; category: MechanicalCategory; target: MechanicalSnapshotId }
  | { state: 'unresolved'; path: string; category: MechanicalCategory; domainId: string; reason: string };
export type MechanicalSelection =
  | { state: 'unselected' }
  | { state: 'resolved'; category: MechanicalCategory; target: MechanicalSnapshotId }
  | { state: 'unresolved'; category: MechanicalCategory; domainId: string; reason: string };
export type MechanicalNode = { [K in MechanicalCategory]: {
  snapshotId: MechanicalSnapshotId;
  category: K;
  domainId: string;
  catalogKey: CreatorCatalogKey;
  owner?: MechanicalSnapshotId;
  source: MechanicalSource;
  dependencies: MechanicalDependency[];
  definition: MechanicalDefinitionMap[K];
  definitionHash: LibraryFingerprint;
} }[MechanicalCategory];
export interface MechanicalLevel {
  level: number;
  proficiencyBonus: number;
  fightingStyles: number;
  weaponMasteries: number;
  battleMaster: { maneuversKnown: number; superiorityDice: number; superiorityDie: 8 | 10 | 12 } | null;
  choiceLimits: Record<string, number>;
}
export interface MechanicalTables {
  abilityGeneration: { standardArray: number[]; pointBuyBudget: number; pointBuyCosts: Record<number, number>; dice: { count: 4; sides: 6; keep: 3; sets: 6 } };
  backgroundBonuses: { split: [2, 1]; distinct: true; allThree: [1, 1, 1]; requiredOptions: 3 };
  abilityModifiers: { score: number; modifier: number }[];
  evaluator: { id: 'atelier-native-tables'; version: '1' };
  progressions: { class: MechanicalSnapshotId; subclass: MechanicalSnapshotId | null; levels: MechanicalLevel[] }[];
  weaponMasteries: Record<WeaponMastery, { id: WeaponMastery; name: string; description: string }>;
}
export interface FrozenMechanicsDocument {
  formatVersion: 1;
  baseline: { id: string; hash: LibraryFingerprint };
  state: 'complete' | 'partial';
  selections: {
    class: MechanicalSelection; subclass: MechanicalSelection; species: MechanicalSelection; background: MechanicalSelection;
    feats: MechanicalSelection[]; fightingStyles: MechanicalSelection[]; weaponMasteries: MechanicalSelection[];
    equipmentOptions: MechanicalSelection[];
  };
  nodes: MechanicalNode[];
  tables: MechanicalTables;
  bundleHash: LibraryFingerprint;
}
export type FrozenMechanicsSnapshot = DeepReadonly<FrozenMechanicsDocument>;
export interface MechanicalValidationReport {
  valid: boolean;
  compatible: boolean;
  issues: { code: string; path: string; message: string }[];
  snapshot?: FrozenMechanicsSnapshot;
}
