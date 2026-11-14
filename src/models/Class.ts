
import type {
  AbilityId,
  Ruleset
} from './Species';

// Les dés de vie disponibles pour les classes
export type HitDie = 6 | 8 | 10 | 12;

// Catégories d'armures
export type ArmorType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'shield';

// Types de maîtrises
export type ClassProficiency =
  | 'armor'
  | 'weapon'
  | 'tool'
  | 'savingThrow'
  | 'skill';

// Une maîtrise accordée par la classe
export interface ClassProficiencyEntry {
  type: ClassProficiency;
  id: string;
}

// Choix proposé au joueur
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

// Une capacité de classe
export interface ClassFeature {
  id: string;
  name: string;
  description: string;
  levelRequired: number;
  choices?: ClassChoice[];
}

// Une sous-classe
export interface Subclass {
  id: string;
  name: string;
  description: string;
  bookId: string;
  ruleset: Ruleset;
  features: ClassFeature[];
}

// Configuration des sorts
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

// Définition complète d'une classe
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
}
