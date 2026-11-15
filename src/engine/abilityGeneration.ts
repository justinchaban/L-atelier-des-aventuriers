
import type {
  Ability,
  AbilityScores
} from '../models/Character';

export type AbilityGenerationMethod =
  | 'manual'
  | 'standard'
  | 'point-buy'
  | 'roll';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_BUDGET = 27;

export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
};

export function getPointBuyCost(score: number): number {
  return POINT_BUY_COSTS[score] ?? -1;
}

export function getPointBuyTotal(
  scores: AbilityScores
): number {
  let total = 0;

  for (const score of Object.values(scores)) {
    const cost = getPointBuyCost(score);

    if (cost === -1) {
      return -1;
    }

    total += cost;
  }

  return total;
}

export function isValidPointBuy(
  scores: AbilityScores
): boolean {
  const total = getPointBuyTotal(scores);

  return total >= 0 && total <= POINT_BUY_BUDGET;
}

export function isValidStandardArray(
  scores: AbilityScores
): boolean {
  const values = Object.values(scores).sort(
    (a, b) => a - b
  );

  const expected = [...STANDARD_ARRAY].sort(
    (a, b) => a - b
  );

  return values.every(
    (value, index) => value === expected[index]
  );
}

export function rollAbilityScore(): number {
  const rolls = Array.from(
    { length: 4 },
    () => Math.floor(Math.random() * 6) + 1
  );

  rolls.sort((a, b) => b - a);

  return rolls[0] + rolls[1] + rolls[2];
}

export function rollAbilityScores(): number[] {
  return Array.from(
    { length: 6 },
    () => rollAbilityScore()
  );
}

export function assignScores(
  abilities: Ability[],
  values: number[]
): AbilityScores {
  if (
    abilities.length !== 6 ||
    values.length !== 6
  ) {
    throw new Error(
      'Six caractéristiques et six valeurs sont nécessaires.'
    );
  }

  return Object.fromEntries(
    abilities.map((ability, index) => [
      ability,
      values[index]
    ])
  ) as AbilityScores;
}
