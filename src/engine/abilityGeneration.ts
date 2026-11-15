
import type {
  Ability,
  AbilityScores
} from '../models/Character';

export type AbilityGenerationMethod =
  | 'manual'
  | 'standard'
  | 'point-buy'
  | 'roll';

export const STANDARD_ARRAY = [
  15, 14, 13, 12, 10, 8
];

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

export interface AbilityDiceRoll {
  dice: number[];
  droppedIndex: number;
  total: number;
}

export function getPointBuyCost(
  score: number
): number {
  return POINT_BUY_COSTS[score] ?? -1;
}

function hasSixAbilities(scores: AbilityScores): boolean {
  return Object.keys(scores).length === 6 &&
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].every(key => Object.hasOwn(scores, key) && Number.isInteger(scores[key as Ability]));
}

export function getPointBuyTotal(
  scores: AbilityScores
): number {
  if (!hasSixAbilities(scores)) return -1;
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

  return (
    total >= 0 &&
    total <= POINT_BUY_BUDGET
  );
}

export function isValidStandardArray(
  scores: AbilityScores
): boolean {
  if (!hasSixAbilities(scores)) return false;
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

export function rollAbilityDice(): AbilityDiceRoll {
  const dice = Array.from(
    { length: 4 },
    () => Math.floor(Math.random() * 6) + 1
  );

  const lowest = Math.min(...dice);
  const droppedIndex = dice.indexOf(lowest);

  const total = dice.reduce(
    (sum, value, index) =>
      index === droppedIndex
        ? sum
        : sum + value,
    0
  );

  return {
    dice,
    droppedIndex,
    total
  };
}

export function rollAbilityDiceSet(): AbilityDiceRoll[] {
  return Array.from(
    { length: 6 },
    () => rollAbilityDice()
  );
}

export function rollAbilityScore(): number {
  return rollAbilityDice().total;
}

export function rollAbilityScores(): number[] {
  return rollAbilityDiceSet().map(
    roll => roll.total
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
