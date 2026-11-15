
import type {
  Ability,
  AbilityScores
} from '../models/Character';

import { backgrounds } from '../data/backgrounds';

export type BackgroundAbilityMode = '2-1' | '1-1-1';

export interface BackgroundAbilityChoice {
  mode: BackgroundAbilityMode;
  primary?: Ability;
  secondary?: Ability;
}

export function getBackgroundAbilityBonuses(
  backgroundId: string,
  choice: BackgroundAbilityChoice
): Partial<AbilityScores> {
  const background = backgrounds.find(
    item => item.id === backgroundId
  );

  if (!background) {
    return {};
  }

  const allowed = background.abilityOptions;

  if (choice.mode === '1-1-1') {
    if (allowed.length !== 3) {
      return {};
    }

    return Object.fromEntries(
      allowed.map(ability => [ability, 1])
    ) as Partial<AbilityScores>;
  }

  if (
    !choice.primary ||
    !choice.secondary ||
    choice.primary === choice.secondary ||
    !allowed.includes(choice.primary) ||
    !allowed.includes(choice.secondary)
  ) {
    return {};
  }

  return {
    [choice.primary]: 2,
    [choice.secondary]: 1
  };
}
