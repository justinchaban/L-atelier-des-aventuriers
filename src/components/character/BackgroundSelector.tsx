
import { backgrounds } from '../../data/backgrounds';
import { feats } from '../../data/feats';

interface Props {
  selectedId: string;
  allowedBooks: string[];
  onChange: (backgroundId: string) => void;
}

export default function BackgroundSelector({
  selectedId,
  allowedBooks,
  onChange
}: Props) {
  const availableBackgrounds = backgrounds.filter(
    background => allowedBooks.includes(background.bookId)
  );

  return (
    <section className="background-selector">
      <h3>Choisir un historique</h3>

      <p className="muted">
        Votre historique représente votre vie avant
        de devenir aventurier.
      </p>

      <div className="class-choice-options">
        {availableBackgrounds.map(background => {
          const selected = selectedId === background.id;

          const originFeat = feats.find(
            feat => feat.id === background.originFeatId
          );

          return (
            <button
              key={background.id}
              type="button"
              className={
                selected
                  ? 'class-choice-option selected'
                  : 'class-choice-option'
              }
              aria-pressed={selected}
              onClick={() => onChange(background.id)}
            >
              <span className="class-choice-option-check">
                {selected ? '✓' : ''}
              </span>

              <span>
                <strong>{background.name}</strong>
                <small>{background.description}</small>

                <small>
                  <strong>Don d'origine :</strong>{' '}
                  {originFeat?.name ?? 'Non renseigné'}
                </small>
              </span>
            </button>
          );
        })}
      </div>

      {availableBackgrounds.length === 0 && (
        <p className="muted">
          Aucun historique disponible avec les livres autorisés.
        </p>
      )}
    </section>
  );
}
