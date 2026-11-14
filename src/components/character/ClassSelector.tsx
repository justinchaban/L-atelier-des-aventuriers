
import { classes } from '../../data/classes';

interface Props {
  selectedId: string;
  allowedBooks: string[];
  onChange: (classId: string) => void;
}

const abilityNames: Record<string, string> = {
  str: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Sagesse',
  cha: 'Charisme'
};

export default function ClassSelector({
  selectedId,
  allowedBooks,
  onChange
}: Props) {
  const availableClasses = classes.filter(
    characterClass =>
      allowedBooks.includes(characterClass.bookId)
  );

  const selectedClass = availableClasses.find(
    characterClass => characterClass.id === selectedId
  );

  return (
    <div className="class-selector">
      <h3>Choisir une classe</h3>

      <p className="muted">
        Ta classe détermine tes aptitudes, tes maîtrises
        et ta progression au fil des niveaux.
      </p>

      {availableClasses.length === 0 ? (
        <p className="warning">
          Aucune classe disponible avec les livres autorisés.
        </p>
      ) : (
        <div className="cards">
          {availableClasses.map(characterClass => (
            <button
              type="button"
              key={characterClass.id}
              className={
                selectedId === characterClass.id
                  ? 'character-card selected'
                  : 'character-card'
              }
              aria-pressed={
                selectedId === characterClass.id
              }
              onClick={() => onChange(characterClass.id)}
            >
              <strong>{characterClass.name}</strong>

              <span>
                Dé de vie : d{characterClass.hitDie}
              </span>

              <small>
                {characterClass.description}
              </small>

              {selectedId === characterClass.id && (
                <span>✓ Classe sélectionnée</span>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedClass && (
        <section className="class-details">
          <h3>{selectedClass.name}</h3>

          <p>{selectedClass.description}</p>

          <div className="trait-list">
            <div className="trait-card">
              <h4>Dé de vie</h4>
              <p>d{selectedClass.hitDie}</p>
            </div>

            <div className="trait-card">
              <h4>Caractéristiques principales</h4>
              <p>
                {selectedClass.primaryAbilities
                  .map(ability => abilityNames[ability])
                  .join(', ')}
              </p>
            </div>

            <div className="trait-card">
              <h4>Jets de sauvegarde</h4>
              <p>
                {selectedClass.savingThrows
                  .map(ability => abilityNames[ability])
                  .join(', ')}
              </p>
            </div>

            <div className="trait-card">
              <h4>Sous-classe</h4>
              <p>
                Choix à partir du niveau{' '}
                {selectedClass.subclassLevel}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
