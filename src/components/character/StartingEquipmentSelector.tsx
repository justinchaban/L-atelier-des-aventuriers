
import type {
  Character
} from '../../models/Character';

import type {
  StartingEquipmentOption
} from '../../models/Equipment';

import {
  classes
} from '../../data/classes';

import {
  getEquipmentById
} from '../../data/equipment';

import {
  getStartingEquipment
} from '../../data/startingEquipment';

interface Props {
  character: Character;

  onChange: (optionId: string) => void;
}

export default function StartingEquipmentSelector({
  character,
  onChange
}: Props) {
  const characterClass = classes.find(
    item => item.id === character.classId
  );

  const definition = getStartingEquipment(
    character.classId,
    'class'
  );

  const options = definition?.options ?? [];

  const savedOption =
    character.choices.classEquipmentOptionId;

  const selectedOptionId =
    typeof savedOption === 'string'
      ? savedOption
      : '';

  const selectedOption = options.find(
    option => option.id === selectedOptionId
  );

  function handleOptionChange(
    option: StartingEquipmentOption
  ) {
    onChange(option.id);
  }

  if (!character.classId) {
    return (
      <section className="starting-equipment-selector">
        <h3>Équipement de départ</h3>

        <p className="muted">
          Sélectionnez d'abord une classe pour
          afficher ses équipements de départ.
        </p>
      </section>
    );
  }

  return (
    <section className="starting-equipment-selector">
      <h3>Équipement de départ</h3>

      <p className="muted">
        Choisissez comment votre personnage
        commence son aventure.
      </p>

      <h4>
        Équipement de classe :
        {' '}{characterClass?.name ?? 'Classe inconnue'}
      </h4>

      {options.length === 0 ? (
        <p className="muted">
          Les équipements de départ de cette
          classe ne sont pas encore disponibles.
        </p>
      ) : (
        <div className="ability-score-grid">
          {options.map(option => {
            const isSelected =
              selectedOptionId === option.id;

            return (
              <div
                key={option.id}
                className="ability-score-card"
                style={{
                  border: isSelected
                    ? '2px solid var(--accent, #b99155)'
                    : undefined
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="class-equipment-option"
                    value={option.id}
                    checked={isSelected}
                    onChange={() =>
                      handleOptionChange(option)
                    }
                  />

                  <strong>{option.name}</strong>
                </label>

                {option.description && (
                  <p className="muted">
                    {option.description}
                  </p>
                )}

                {option.items.length > 0 && (
                  <ul>
                    {option.items.map(item => {
                      const equipment =
                        getEquipmentById(item.itemId);

                      return (
                        <li key={item.itemId}>
                          {equipment?.name ??
                            item.itemId}
                          {' × '}
                          {item.quantity}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {option.gold !== undefined &&
                  option.gold > 0 && (
                    <p>
                      <strong>
                        {option.gold} PO
                      </strong>
                    </p>
                  )}
              </div>
            );
          })}
        </div>
      )}

      {selectedOption && (
        <p className="class-builder-confirmation">
          ✓ Option sélectionnée :
          {' '}{selectedOption.name}
        </p>
      )}
    </section>
  );
}
