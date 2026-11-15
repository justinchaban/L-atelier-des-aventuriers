
import type { Ability } from './Character';

export interface Background {
  id: string;
  name: string;
  description: string;

  bookId: string;
  ruleset: '2024';

  abilityOptions: Ability[];

  skillProficiencies: string[];

  toolProficiency?: string;

  originFeatId: string;

  equipment?: string[];
}
