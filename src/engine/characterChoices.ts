import type { CharacterClass, ClassChoice } from '../models/Class';
import type { Character } from '../models/Character';
import { getBattleMasterProgression } from './battleMaster';

type CharacterChoices = Character['choices'];

export function cleanSubclassChoices(
  choices: CharacterChoices,
  characterClass: CharacterClass,
  nextSubclassId: string
): CharacterChoices {
  const cleanedChoices: CharacterChoices = {};

  const validSubclass = characterClass.subclasses.find(
    subclass => subclass.id === nextSubclassId
  );

  const validKeys = new Set<string>();

  if (validSubclass) {
    for (const feature of validSubclass.features) {
      for (const choice of feature.choices ?? []) {
        validKeys.add(
          `feature:subclass:${feature.id}:${choice.id}`
        );
      }
    }
  }

  for (const [key, value] of Object.entries(choices)) {
    if (
      key.startsWith('feature:subclass:') &&
      !validKeys.has(key)
    ) {
      continue;
    }

    cleanedChoices[key] = value;
  }

  return {
    ...cleanedChoices,
    subclassId: validSubclass?.id ?? ''
  };
}


export function validateFeatureChoices(
  choices: Character['choices'],
  characterClass: CharacterClass,
  level: number,
  subclassId: string
): Character['choices'] {
  const cleaned: Character['choices'] = {
    ...choices
  };

  const subclass = characterClass.subclasses.find(
    item => item.id === subclassId
  );

  const validKeys = new Set<string>();

  function validateChoice(
    source: 'class' | 'subclass',
    featureId: string,
    choice: ClassChoice
  ) {
    const key =
      `feature:${source}:${featureId}:${choice.id}`;

    validKeys.add(key);

    const current = cleaned[key];

    const selectedIds = Array.isArray(current)
      ? current
      : typeof current === 'string' && current
        ? [current]
        : [];

    let maximum = choice.count;

    if (
      source === 'subclass' &&
      subclassId === 'battle-master-2024' &&
      featureId === 'battle-master-combat-superiority' &&
      choice.id === 'battle-master-maneuvers'
    ) {
      maximum =
        getBattleMasterProgression(level).maneuversKnown;
    }

    const allowedIds = new Set(
      choice.options.map(option => option.id)
    );

    cleaned[key] = [...new Set(selectedIds)]
      .filter(id => allowedIds.has(id))
      .slice(0, maximum);
  }

  for (const feature of characterClass.features) {
    if (feature.levelRequired > level) {
      continue;
    }

    for (const choice of feature.choices ?? []) {
      validateChoice('class', feature.id, choice);
    }
  }

  if (subclass && level >= characterClass.subclassLevel) {
    for (const feature of subclass.features) {
      if (feature.levelRequired > level) {
        continue;
      }

      for (const choice of feature.choices ?? []) {
        validateChoice('subclass', feature.id, choice);
      }
    }
  }

  for (const key of Object.keys(cleaned)) {
    if (
      key.startsWith('feature:') &&
      !validKeys.has(key)
    ) {
      delete cleaned[key];
    }
  }

  return cleaned;
}

