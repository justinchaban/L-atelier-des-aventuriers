
import type {
  CharacterClass,
  ClassFeature
} from '../models/Class';

export interface UnlockedFeature {
  feature: ClassFeature;
  source: 'class' | 'subclass';
  requiresChoice: boolean;
}

export function getUnlockedClassFeatures(
  characterClass: CharacterClass,
  characterLevel: number,
  selectedSubclassId: string
): UnlockedFeature[] {
  const classFeatures: UnlockedFeature[] =
    characterClass.features
      .filter(
        feature =>
          feature.levelRequired <= characterLevel
      )
      .map(feature => ({
        feature,
        source: 'class' as const,
        requiresChoice: Boolean(
          feature.choices?.length
        )
      }));

  const selectedSubclass =
    characterClass.subclasses.find(
      subclass =>
        subclass.id === selectedSubclassId
    );

  const subclassFeatures: UnlockedFeature[] =
    selectedSubclass?.features
      .filter(
        feature =>
          feature.levelRequired <= characterLevel &&
          characterLevel >= characterClass.subclassLevel
      )
      .map(feature => ({
        feature,
        source: 'subclass' as const,
        requiresChoice: Boolean(
          feature.choices?.length
        )
      })) ?? [];

  return [
    ...classFeatures,
    ...subclassFeatures
  ].sort(
    (a, b) =>
      a.feature.levelRequired -
      b.feature.levelRequired
  );
}

export function getFeaturesRequiringChoices(
  features: UnlockedFeature[]
): UnlockedFeature[] {
  return features.filter(
    item => item.requiresChoice
  );
}
