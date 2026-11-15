
import { useState } from 'react';

import type { CharacterClass } from '../../models/Class';

interface Props {
  characterClass: CharacterClass;
  characterLevel: number;
  selectedSubclassId: string;
}

export default function ClassProgression({
  characterClass,
  characterLevel,
  selectedSubclassId
}: Props) {
  const [showAll, setShowAll] = useState(false);

  const levels = Array.from(
    { length: 20 },
    (_, index) => index + 1
  );

  // Recherche de la sous-classe sélectionnée
  const selectedSubclass = characterClass.subclasses.find(
    subclass => subclass.id === selectedSubclassId
  );

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
            // Capacités de la classe principale
            const classFeatures =
              characterClass.features.filter(
                feature => feature.levelRequired === level
              );

            // Capacités de la sous-classe sélectionnée
            const subclassFeatures =
              selectedSubclass?.features.filter(
                feature => feature.levelRequired === level
              ) ?? [];

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

                {classFeatures.length === 0 &&
                subclassFeatures.length === 0 ? (
                  <p className="muted">
                    Aucune nouvelle capacité renseignée
                    pour ce niveau.
                  </p>
                ) : (
                  <div className="progression-features">
                    {classFeatures.map(feature => (
                      <div
                        key={feature.id}
                        className="progression-feature"
                      >
                        <small>CLASSE</small>

                        <strong>{feature.name}</strong>

                        <p>{feature.description}</p>
                      </div>
                    ))}

                    {subclassFeatures.map(feature => (
                      <div
                        key={feature.id}
                        className="progression-feature subclass-feature"
                      >
                        <small>
                          SOUS-CLASSE — {selectedSubclass?.name}
                        </small>

                        <strong>{feature.name}</strong>

                        <p>{feature.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}
