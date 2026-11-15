
import type {
  Ability,
  AbilityScores,
  Character
} from '../models/Character';

import {
  getBackgroundAbilityBonuses,
  type BackgroundAbilityChoice
} from './backgroundAbilities';

export const ABILITIES: Ability[] = [
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha'
];

export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Sagesse',
  cha: 'Charisme'
};

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatAbilityModifier(score: number): string {
  const modifier = getAbilityModifier(score);

  return modifier >= 0
    ? `+${modifier}`
    : String(modifier);
}

export function getCharacterAbilityScores(
  character: Character
): AbilityScores {
  const mode =
    character.choices.backgroundAbilityMode === '1-1-1'
      ? '1-1-1'
      : '2-1';

  const choice: BackgroundAbilityChoice = {
    mode,
    primary:
      typeof character.choices.backgroundAbilityPrimary === 'string'
        ? character.choices.backgroundAbilityPrimary as Ability
        : undefined,
    secondary:
      typeof character.choices.backgroundAbilitySecondary === 'string'
        ? character.choices.backgroundAbilitySecondary as Ability
        : undefined
  };

  const bonuses = getBackgroundAbilityBonuses(
    character.backgroundId,
    choice
  );

  const result = {} as AbilityScores;

  for (const ability of ABILITIES) {
    const baseScore = character.abilities[ability];
    const bonus = bonuses[ability] ?? 0;

    result[ability] = baseScore + bonus;
  }

  return result;
}
