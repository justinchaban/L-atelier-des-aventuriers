
import type {
  AbilityId,
  Ruleset
} from './Species';

// ==========================================
// DÉS DE VIE
// ==========================================

export type HitDie = 6 | 8 | 10 | 12;

// ==========================================
// CATÉGORIES D'ARMURES
// ==========================================

export type ArmorType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'shield';

// ==========================================
// TYPES DE MAÎTRISES
// ==========================================

export type ClassProficiency =
  | 'armor'
  | 'weapon'
  | 'tool'
  | 'savingThrow'
  | 'skill';

export interface ClassProficiencyEntry {
  type: ClassProficiency;
  id: string;
}

// ==========================================
// MÉTADONNÉES D'IMPORTATION
// ==========================================

export interface ImportedContentMetadata {
  // Fournisseur des données
  provider:
    | 'srd'
    | '5etools'
    | 'homebrew'
    | 'custom';

  // Nom d'origine
  originalName: string;

  // Code source d'origine : XPHB, PHB...
  originalSource: string;

  // Référence complète si disponible
  originalReference?: string;

  // Présence d'un héritage non résolu
  hasUnresolvedCopy?: boolean;
}

// ==========================================
// CONTENU STRUCTURÉ
// ==========================================

// Les descriptions 5e.tools peuvent
// contenir des paragraphes, tableaux,
// listes et autres structures JSON.
//
// Nous conservons ces données sans
// imposer immédiatement un format
// d'affichage particulier.

export type StructuredContent = unknown[];

// ==========================================
// CHOIX DU JOUEUR
// ==========================================

export interface ClassChoice {
  id: string;
  name: string;
  description: string;
  count: number;

  options: {
    id: string;
    name: string;
    description?: string;
  }[];
}

// ==========================================
// CAPACITÉS
// ==========================================

export interface ClassFeature {
  id: string;
  name: string;
  description: string;

  levelRequired: number;

  choices?: ClassChoice[];

  // Livre dont provient la capacité
  bookId?: string;

  // Référence et provenance originales
  importMetadata?: ImportedContentMetadata;

  // Description JSON originale
  structuredEntries?: StructuredContent;
}

// ==========================================
// SOUS-CLASSES
// ==========================================

export interface Subclass {
  id: string;
  name: string;
  description: string;

  bookId: string;
  ruleset: Ruleset;

  features: ClassFeature[];

  // Nom court utilisé dans les références
  shortName?: string;

  // Provenance de la sous-classe
  importMetadata?: ImportedContentMetadata;

  // Contenu structuré facultatif
  structuredEntries?: StructuredContent;
}

// ==========================================
// MAGIE
// ==========================================

export interface Spellcasting {
  ability: AbilityId;

  type:
    | 'full'
    | 'half'
    | 'third'
    | 'pact';

  preparation:
    | 'prepared'
    | 'known';
}

// ==========================================
// CLASSE
// ==========================================

export interface CharacterClass {
  id: string;
  name: string;
  description: string;

  bookId: string;
  ruleset: Ruleset;

  hitDie: HitDie;

  primaryAbilities: AbilityId[];

  savingThrows: AbilityId[];

  proficiencies: ClassProficiencyEntry[];

  skillChoices?: ClassChoice;

  features: ClassFeature[];

  subclassLevel: number;
  subclasses: Subclass[];

  spellcasting?: Spellcasting;

  // Provenance de la classe
  importMetadata?: ImportedContentMetadata;

  // Contenu structuré facultatif
  structuredEntries?: StructuredContent;
}
