import { isBookAllowed } from '../../engine/restrictions';

import { species } from '../../data/species';
import { getBookById } from '../../data/books';

interface Props {
  selectedId: string;
  allowedBooks: string[];
  onChange: (speciesId: string) => void;
}

export default function SpeciesSelector({
  selectedId,
  allowedBooks,
  onChange
}: Props) {
  const availableSpecies = species.filter(
    item => isBookAllowed(item.bookId, allowedBooks)
  );

  return (
    <section>
      <h3>Espèce</h3>

      <p className="muted">
        Choisis l'espèce de ton personnage.
      </p>

      <div className="cards">
        {availableSpecies.map(item => {
          const source = getBookById(item.bookId);

          const isSelected = selectedId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`character-card ${
                isSelected ? 'selected' : ''
              }`}
              aria-pressed={isSelected}
              onClick={() => onChange(item.id)}
            >
              <strong>
                {item.name}
                {isSelected ? ' ✓' : ''}
              </strong>

              <span>{item.description}</span>

              <small>
                {source?.name ?? item.bookId}
                {' · '}
                {item.ruleset}
              </small>
            </button>
          );
        })}
      </div>

      {selectedId && (
        <p>
          Espèce sélectionnée :{' '}
          <strong>
            {species.find(item => item.id === selectedId)?.name
              ?? 'Espèce inconnue'}
          </strong>
        </p>
      )}

      {availableSpecies.length === 0 && (
        <p className="warning">
          Aucune espèce disponible avec les livres autorisés.
        </p>
      )}
    </section>
  );
}
