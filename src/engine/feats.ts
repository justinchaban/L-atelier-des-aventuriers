
import { feats } from '../data/feats';
import { backgrounds } from '../data/backgrounds';
import type { Character } from '../models/Character';
import type { Feat, FeatCategory } from '../models/Feat.ts';

export function getAvailableFeats(
  character: Character,
  category: FeatCategory,
  allowedBooks: string[]
): Feat[] {
  return feats.filter(feat => {
    if (feat.category !== category) {
      return false;
    }

    if (!allowedBooks.includes(feat.bookId)) {
      return false;
    }

    const prerequisites = feat.prerequisites;

    if (!prerequisites) {
      return true;
    }

    if (
      prerequisites.minimumLevel !== undefined &&
      character.level < prerequisites.minimumLevel
    ) {
      return false;
    }

    if (
      prerequisites.ability &&
      prerequisites.minimumAbilityScore !== undefined
    ) {
      const score =
        character.abilities[prerequisites.ability];

      if (score < prerequisites.minimumAbilityScore) {
        return false;
      }
    }

    if (prerequisites.requiredFeatIds?.length) {
      const selectedFeats = Object.values(
        character.choices
      ).flatMap(value =>
        Array.isArray(value) ? value : [value]
      );

      if (
        !prerequisites.requiredFeatIds.every(
          id => selectedFeats.includes(id)
        )
      ) {
        return false;
      }
    }

    return true;
  });
}

export function getBackgroundOriginFeat(
  backgroundId: string
): Feat | null {
  const background = backgrounds.find(
    item => item.id === backgroundId
  );

  if (!background) {
    return null;
  }

  return feats.find(
    feat =>
      feat.id === background.originFeatId &&
      feat.category === 'origin'
  ) ?? null;
}

