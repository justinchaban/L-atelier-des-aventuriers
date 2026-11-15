
export interface BattleMasterProgression {
  maneuversKnown: number;
  superiorityDice: number;
  superiorityDie: 8 | 10 | 12;
}

export function getBattleMasterProgression(
  level: number
): BattleMasterProgression {
  if (level >= 18) {
    return {
      maneuversKnown: 7,
      superiorityDice: 6,
      superiorityDie: 12
    };
  }

  if (level >= 15) {
    return {
      maneuversKnown: 7,
      superiorityDice: 6,
      superiorityDie: 10
    };
  }

  if (level >= 10) {
    return {
      maneuversKnown: 5,
      superiorityDice: 5,
      superiorityDie: 10
    };
  }

  if (level >= 7) {
    return {
      maneuversKnown: 5,
      superiorityDice: 5,
      superiorityDie: 8
    };
  }

  return {
    maneuversKnown: level >= 3 ? 3 : 0,
    superiorityDice: level >= 3 ? 4 : 0,
    superiorityDie: 8
  };
}
