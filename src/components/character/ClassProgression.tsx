import { fightingStyleChoice } from '../../data/fightingStyles';
import { getBattleMasterProgression } from '../../engine/battleMaster';
import { useState } from 'react';

import type { CharacterClass } from '../../models/Class';
import ClassChoiceSelector from './ClassChoiceSelector';

interface Props {
  characterClass: CharacterClass;
  characterLevel: number;
  selectedSubclassId: string;
  selectedChoices: Record<string, string | string[]>;
  onChoiceChange: (choiceId: string, ids: string[]) => void;
  readOnly?: boolean;
}

export default function ClassProgression({
  characterClass,
  characterLevel,
  selectedSubclassId,
  selectedChoices,
  onChoiceChange,
  readOnly = false
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const battleMasterProgression =
  selectedSubclassId === 'battle-master-2024'
    ? getBattleMasterProgression(characterLevel)
    : null;

  const levels = Array.from(
    { length: 20 },
    (_, index) => index + 1
  );

  const selectedSubclass = characterClass.subclasses.find(
    subclass => subclass.id === selectedSubclassId
  );

  function getSelectedIds(key: string): string[] {
    const value = selectedChoices[key];

    if (Array.isArray(value)) {
      return value;
    }

    return typeof value === 'string' && value
      ? [value]
      : [];
  }

  return (
    <section className="class-progression">
      <div className="section-title">
        <div>
          <h4>Progression de classe</h4>
          <p className="muted">
            Capacités du {characterClass.name}
            {selectedSubclass
              ? ` — ${selectedSubclass.name}`
              : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? 'Afficher les niveaux acquis'
            : 'Afficher les 20 niveaux'}
        </button>
      </div>

      <div className="class-progression-list">
        {levels
          .filter(level => showAll || level <= characterLevel)
          .map(level => {
            const classFeatures =
              characterClass.features
                .filter(feature => feature.levelRequired === level)
                .map(feature => ({
                  feature,
                  source: 'class' as const
                }));

            const subclassFeatures =
              selectedSubclass?.features
                .filter(feature => feature.levelRequired === level)
                .map(feature => ({
                  feature,
                  source: 'subclass' as const
                })) ?? [];

            const features = [
              ...classFeatures,
              ...subclassFeatures
            ];

            const unlocked = level <= characterLevel;

            return (
              <div
                key={level}
                className={
                  unlocked
                    ? 'progression-level unlocked'
                    : 'progression-level locked'
                }
              >
                <div className="progression-level-header">
                  <strong>Niveau {level}</strong>
                  <span>
                    {unlocked ? '✓ Acquis' : 'À débloquer'}
                  </span>
                </div>

                {features.length === 0 ? (
                  <p className="muted">
                    Aucune nouvelle capacité renseignée
                    pour ce niveau.
                  </p>
                ) : (
                  <div className="progression-features">
                    {features.map(({ feature, source }) => {
                      const choices = (feature.choices ?? []).filter(
                        choice => !(
                          characterClass.id === 'fighter-2024' &&
                          choice.id === fightingStyleChoice.id
                        )
                      );

                      const allChoicesComplete =
                        choices.every(choice => {
                          const key =
                            `feature:${source}:${feature.id}:${choice.id}`;

                          const selected = getSelectedIds(key)
                            .filter(id =>
                              choice.options.some(
                                option => option.id === id
                              )
                            );

                          const requiredCount =
  selectedSubclassId === 'battle-master-2024' &&
  feature.id === 'battle-master-combat-superiority' &&
  choice.id === 'battle-master-maneuvers' &&
  battleMasterProgression
    ? battleMasterProgression.maneuversKnown
    : choice.count;

return new Set(selected).size === requiredCount;
                        });

                      return (
                        <div
                          key={`${source}-${feature.id}`}
                          className={
                            source === 'subclass'
                              ? 'progression-feature subclass-feature'
                              : 'progression-feature'
                          }
                        >
                          <small>
                            {source === 'class'
                              ? 'CLASSE'
                              : `SOUS-CLASSE — ${selectedSubclass?.name}`}
                          </small>

                          <strong>{feature.name}</strong>
                          <p>{feature.description}</p>

                          <p className="muted">
                            {!unlocked
                              ? '🔒 À débloquer'
                              : choices.length === 0
                                ? '✓ Capacité acquise'
                                : allChoicesComplete
                                  ? '✓ Choix validés'
                                  : '⚠️ Choix à effectuer'}
                          </p>

                          
{unlocked &&
  !readOnly &&
  choices.map(choice => {
    const key =
      `feature:${source}:${feature.id}:${choice.id}`;

    const isBattleMasterManeuvers =
      selectedSubclassId === 'battle-master-2024' &&
      feature.id === 'battle-master-combat-superiority' &&
      choice.id === 'battle-master-maneuvers';

    const adjustedChoice =
      isBattleMasterManeuvers && battleMasterProgression
        ? {
            ...choice,
            count: battleMasterProgression.maneuversKnown
          }
        : choice;

    return (
      <ClassChoiceSelector
        key={key}
        choice={adjustedChoice}
        selectedIds={getSelectedIds(key)}
        onChange={ids =>
          onChoiceChange(key, ids)
        }
      />
    );
  })}

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}
