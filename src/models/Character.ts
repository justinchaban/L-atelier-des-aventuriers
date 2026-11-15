export type Ability = 'str'|'dex'|'con'|'int'|'wis'|'cha';
export type AbilityScores = Record<Ability, number>;
export interface Character {
  schemaVersion: 1;
  id: string;
  name: string;
  level: number;
  speciesId: string;
  classId: string;
  backgroundId: string;
  /** Scores de base : 0 signifie non attribué dans un brouillon (stockage : 0 à 30). */
  abilities: AbilityScores;
  choices: Record<string, string | string[]>;
  gameState: { currentHP: number; temporaryHP: number; usedHitDice: number; usedSpellSlots: Record<number, number>; conditions: string[] };
  campaignId?: string;
}
