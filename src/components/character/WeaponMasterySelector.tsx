
import { weaponMasteries } from '../../data/weaponMasteries';
import { weapons } from '../../data/weapons';

import {
  getWeaponMasteryCount,
  validateWeaponMasteries
} from '../../engine/weaponMastery';

interface Props {
  classId: string;
  characterLevel: number;
  allowedBooks: string[];
  selectedWeaponIds: string[];
  onChange: (weaponIds: string[]) => void;
}

export default function WeaponMasterySelector({
  classId,
  characterLevel,
  allowedBooks,
  selectedWeaponIds,
  onChange
}: Props) {
  const maximum = getWeaponMasteryCount(
    classId,
    characterLevel
  );

  const availableWeapons = weapons.filter(weapon =>
    allowedBooks.includes(weapon.bookId)
  );

  const validIds = validateWeaponMasteries(
    classId,
    characterLevel,
    selectedWeaponIds,
    allowedBooks
  );

  const selectedCount = validIds.length;

  function toggleWeapon(weaponId: string) {
    if (validIds.includes(weaponId)) {
      onChange(
        validIds.filter(id => id !== weaponId)
      );
      return;
    }

    if (selectedCount >= maximum) {
      return;
    }

    const updatedIds = validateWeaponMasteries(
      classId,
      characterLevel,
      [...validIds, weaponId],
      allowedBooks
    );

    onChange(updatedIds);
  }

  if (maximum === 0) {
    return null;
  }

  return (
    <section className="weapon-mastery-selector">
      <div className="weapon-mastery-header">
        <div>
          <h4>Maîtrise des armes</h4>

          <p className="muted">
            Choisissez les armes dont vous maîtrisez
            les propriétés spéciales.
          </p>
        </div>

        <strong>
          {selectedCount} / {maximum}
        </strong>
      </div>

      <div className="weapon-mastery-grid">
        {availableWeapons.map(weapon => {
          const selected = validIds.includes(weapon.id);

          const disabled =
            !selected && selectedCount >= maximum;

          return (
            <button
              key={weapon.id}
              type="button"
              className={
                selected
                  ? 'weapon-mastery-option selected'
                  : 'weapon-mastery-option'
              }
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => toggleWeapon(weapon.id)}
            >
              <div className="weapon-mastery-option-title">
                <strong>{weapon.name}</strong>
                <span>{selected ? '✓' : ''}</span>
              </div>

              <small>
                {weapon.category === 'simple'
                  ? 'Arme courante'
                  : 'Arme de guerre'}
                {' · '}
                {weapon.damage} dégâts
              </small>

              <div className="weapon-mastery-information">
                <span className="weapon-mastery-property">
                  {weaponMasteries[weapon.mastery].name}
                </span>

                <small className="weapon-mastery-description">
                  {weaponMasteries[weapon.mastery].description}
                </small>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCount === maximum && (
        <p className="class-choice-complete">
          ✓ Toutes les maîtrises disponibles
          ont été sélectionnées.
        </p>
      )}
    </section>
  );
}
