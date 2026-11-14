
export type Ruleset = '2014' | '2024';

export type CreatureSize = 'Small' | 'Medium';

export type AbilityId =
  | 'str'
  | 'dex'
  | 'con'
  | 'int'
  | 'wis'
  | 'cha';

export type DamageType =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder';

export interface SpeciesTrait {
  id: string;
  name: string;
  description: string;

  /**
   * Niveau à partir duquel le trait est disponible.
   * Par défaut : niveau 1.
   */
  levelRequired?: number;

  /**
   * Informations structurées permettant
   * de calculer certains effets automatiquement.
   */
  effects?: SpeciesEffect[];
}

export type SpeciesEffect =
  | {
      type: 'darkvision';
      range: number;
    }
  | {
      type: 'resistance';
      damageType: DamageType;
    }
  | {
      type: 'speed';
      movement: 'walk' | 'fly' | 'swim' | 'climb';
      value: number;
    }
  | {
      type: 'proficiency';
      proficiencyId: string;
    }
  | {
      type: 'bonus';
      ability: AbilityId;
      value: number;
    };

export interface SpeciesChoiceOption {
  id: string;
  name: string;
  description: string;

  /**
   * Traits supplémentaires accordés
   * par cette option.
   */
  traits?: SpeciesTrait[];
}

export interface SpeciesChoice {
  id: string;
  name: string;
  description: string;

  /**
   * Nombre d'options à sélectionner.
   */
  count: number;

  options: SpeciesChoiceOption[];
}

export interface Species {
  id: string;
  name: string;

  /**
   * Livre d'origine.
   */
  bookId: string;

  ruleset: Ruleset;

  description: string;

  /**
   * Vitesse de déplacement de base, en pieds.
   */
  speed: number;

  /**
   * Tailles possibles.
   */
  sizes: CreatureSize[];

  /**
   * Traits accordés automatiquement.
   */
  traits: SpeciesTrait[];

  /**
   * Choix proposés au joueur.
   */
  choices?: SpeciesChoice[];
}
