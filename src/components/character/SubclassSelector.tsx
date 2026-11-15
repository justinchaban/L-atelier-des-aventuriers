import { isBookAllowed } from '../../engine/restrictions';

import type { CharacterClass } from '../../models/Class';

interface Props {
  characterClass: CharacterClass;
  characterLevel: number;
  selectedId: string;
  allowedBooks: string[];
  onChange: (subclassId: string) => void;
}

export default function SubclassSelector({
  characterClass,
  characterLevel,
  selectedId,
  allowedBooks,
  onChange
}: Props) {
  const availableSubclasses = characterClass.subclasses.filter(
    subclass => isBookAllowed(subclass.bookId, allowedBooks)
  );

  if (characterLevel < characterClass.subclassLevel) {
    return (
      <section className="subclass-selector">
        <h4>Sous-classe</h4>
        <p className="muted">
          Tu pourras choisir une sous-classe au niveau{' '}
          {characterClass.subclassLevel}.
        </p>
      </section>
    );
  }

  return (
    <section className="subclass-selector">
      <h4>Choisir une sous-classe</h4>

      {availableSubclasses.length === 0 ? (
        <p className="muted">
          Aucune sous-classe disponible pour cette classe
          avec les livres actuellement autorisés.
        </p>
      ) : (
        <div className="subclass-options">
          {availableSubclasses.map(subclass => (
            <button
              key={subclass.id}
              type="button"
              className={
                selectedId === subclass.id
                  ? 'subclass-option selected'
                  : 'subclass-option'
              }
              aria-pressed={selectedId === subclass.id}
              onClick={() => onChange(subclass.id)}
            >
              <strong>{subclass.name}</strong>
              <span>{subclass.description}</span>

              {selectedId === subclass.id && (
                <small>✓ Sous-classe sélectionnée</small>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
