
import type { Ability } from './Character';

export type FeatCategory =
  | 'origin'
  | 'general'
  | 'fighting-style'
  | 'epic-boon';

export interface FeatPrerequisite {
  minimumLevel?: number;
  ability?: Ability;
  minimumAbilityScore?: number;
  requiredFeatIds?: string[];
}

export interface FeatAbilityIncrease {
  abilities: Ability[];
  amount: number;
  maximum: number;
}

export interface Feat {
  id: string;
  name: string;
  description: string;

  category: FeatCategory;

  bookId: string;
  ruleset: '2024';

  prerequisites?: FeatPrerequisite;

  abilityIncrease?: FeatAbilityIncrease;

  repeatable?: boolean;
}
