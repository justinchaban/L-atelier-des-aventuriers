
import { getAvailableFeats } from '../../engine/feats';

import type { Character } from '../../models/Character';
import type { FeatCategory } from '../../models/Feat';

interface Props {
  character: Character;
  category: FeatCategory;
  allowedBooks: string[];
  selectedFeatId: string;
  onChange: (featId: string) => void;
}

export default function FeatSelector({
  character,
  category,
  allowedBooks,
  selectedFeatId,
  onChange
}: Props) {
  const availableFeats = getAvailableFeats(
    character,
    category,
    allowedBooks
  );

  const categoryNames: Record<FeatCategory, string> = {
    origin: "Dons d'origine",
    general: 'Dons généraux',
    'fighting-style': 'Dons de style de combat',
    'epic-boon': 'Dons épiques'
  };

  return (
    <section className="feat-selector">
      <h4>{categoryNames[category]}</h4>

      {availableFeats.length === 0 ? (
        <p className="muted">
          Aucun don disponible pour ce personnage.
        </p>
      ) : (
        <div className="class-choice-options">
          {availableFeats.map(feat => {
            const selected = selectedFeatId === feat.id;

            return (
              <button
                key={feat.id}
                type="button"
                className={
                  selected
                    ? 'class-choice-option selected'
                    : 'class-choice-option'
                }
                aria-pressed={selected}
                onClick={() =>
                  onChange(selected ? '' : feat.id)
                }
              >
                <span className="class-choice-option-check">
                  {selected ? '✓' : ''}
                </span>

                <span>
                  <strong>{feat.name}</strong>
                  <small>{feat.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
