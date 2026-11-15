import type { Ability, AbilityScores, Character } from '../models/Character';
import { getPointBuyTotal, isValidStandardArray, POINT_BUY_BUDGET } from './abilityGeneration';

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number =>
  Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;

export interface CharacterValidationResult {
  character: Character | null;
  issues: string[];
}

/** Entrée de migration explicite. Ne modifie jamais l'objet fourni ni le stockage. */
export function migrateCharacter(value: unknown): CharacterValidationResult {
  const issues: string[] = [];
  if (!record(value)) return { character: null, issues: ['Personnage : objet attendu.'] };
  if (value.schemaVersion !== 1) {
    return { character: null, issues: ['Version de personnage absente ou non prise en charge.'] };
  }
  const candidate = { ...value };
  const defaults: Record<string, unknown> = {
    speciesId: '', classId: '', backgroundId: '', choices: {},
    gameState: { currentHP: 1, temporaryHP: 0, usedHitDice: 0, usedSpellSlots: {}, conditions: [] }
  };
  for (const [key, fallback] of Object.entries(defaults)) {
    if (!Object.hasOwn(candidate, key)) {
      candidate[key] = fallback;
      issues.push(`${key} absent : valeur par défaut en mémoire.`);
    }
  }
  if (record(candidate.gameState)) {
    const state = { ...candidate.gameState };
    for (const [key, fallback] of Object.entries(defaults.gameState as Record<string, unknown>)) {
      if (!Object.hasOwn(state, key)) {
        state[key] = fallback;
        issues.push(`gameState.${key} absent : valeur par défaut en mémoire.`);
      }
    }
    candidate.gameState = state;
  }
  const errors = validateCharacterStructure(candidate);
  return { character: errors.length ? null : candidate as unknown as Character, issues: [...issues, ...errors] };
}

/** Accepte les brouillons ; ne dépend pas de la disponibilité du catalogue. */
export function validateCharacterStructure(value: unknown): string[] {
  if (!record(value)) return ['Personnage : objet attendu.'];
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push('schemaVersion doit être 1.');
  if (typeof value.id !== 'string' || !value.id.trim()) errors.push('Identifiant absent ou invalide.');
  if (typeof value.name !== 'string') errors.push('Nom invalide.');
  if (!integer(value.level, 1, 20)) errors.push('Niveau invalide.');
  for (const key of ['speciesId', 'classId', 'backgroundId']) {
    if (typeof value[key] !== 'string') errors.push(`${key} invalide.`);
  }
  if (value.campaignId !== undefined && typeof value.campaignId !== 'string') errors.push('campaignId invalide.');
  if (!record(value.abilities) || Object.keys(value.abilities).length !== 6 ||
      !ABILITIES.every(key => Object.hasOwn(value.abilities as object, key) && integer((value.abilities as Record<string, unknown>)[key], 0, 30))) {
    errors.push('Six caractéristiques entières de 0 à 30 attendues.');
  }
  if (!record(value.choices) || !Object.values(value.choices).every(choice =>
    typeof choice === 'string' || (Array.isArray(choice) && choice.every(item => typeof item === 'string')))) {
    errors.push('Choix : chaînes ou tableaux de chaînes attendus.');
  }
  const state = value.gameState;
  if (!record(state)) errors.push('gameState invalide.');
  else {
    for (const key of ['currentHP', 'temporaryHP', 'usedHitDice']) {
      if (!integer(state[key], 0)) errors.push(`gameState.${key} invalide.`);
    }
    if (!record(state.usedSpellSlots) || !Object.entries(state.usedSpellSlots).every(([key, count]) =>
      /^[1-9]$/.test(key) && integer(count, 0))) errors.push('Emplacements utilisés invalides.');
    if (!Array.isArray(state.conditions) || !state.conditions.every(item => typeof item === 'string')) errors.push('Conditions invalides.');
  }
  return errors;
}

/** Diagnostics de création seulement : aucun obstacle à la sauvegarde d'un brouillon. */
export function validateCharacterCompleteness(character: Character): string[] {
  const issues: string[] = [];
  for (const key of ['speciesId', 'classId', 'backgroundId'] as const) {
    if (!character[key]) issues.push(`${key} non sélectionné.`);
  }
  if (!ABILITIES.every(key => character.abilities[key] >= 1)) issues.push('Caractéristiques non attribuées.');
  if (!areAbilityChoicesComplete(character.abilities, character.choices)) issues.push('Attribution des caractéristiques incomplète ou incohérente.');
  return issues;
}

/** Reprend les critères existants du créateur, sans relancer ni recalculer les dés. */
export function areAbilityChoicesComplete(abilities: AbilityScores, choices: Character['choices']): boolean {
  switch (choices.abilityGenerationMethod) {
    case 'standard': return isValidStandardArray(abilities);
    case 'point-buy': return getPointBuyTotal(abilities) === POINT_BUY_BUDGET;
    case 'roll': {
      const rolls = choices.abilityRolls;
      const assignments = choices.abilityRollAssignments;
      return Array.isArray(rolls) && rolls.length === 6 && rolls.every(value => integer(Number(value), 3, 18)) &&
        Array.isArray(assignments) && assignments.length === 6 && assignments.every(value => /^[0-5]$/.test(value)) &&
        new Set(assignments).size === 6 && ABILITIES.every((key, index) => abilities[key] === Number(rolls[Number(assignments[index])]));
    }
    default: return true;
  }
}
