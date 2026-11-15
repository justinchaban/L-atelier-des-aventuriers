import WeaponMasterySelector from './WeaponMasterySelector';
import { fightingStyleChoice } from '../../data/fightingStyles';
import ClassChoiceSelector from './ClassChoiceSelector';
import SubclassSelector from './SubclassSelector';
import ClassProgression from './ClassProgression';
import { useState } from 'react';

import { classes } from '../../data/classes';
import type { CharacterClass } from '../../models/Class';

interface Props {
  selectedId: string;
  selectedSubclassId: string;
onSubclassChange: (subclassId: string) => void;
  selectedSkills: string[];
onSkillsChange: (skills: string[]) => void;
  selectedWeaponMasteries: string[];
onWeaponMasteriesChange: (weaponMasteries: string[]) => void;
  selectedFightingStyles: string[];
onFightingStylesChange: (fightingStyles: string[]) => void;
  allowedBooks: string[];
  characterLevel: number;
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

const proficiencyNames: Record<string, string> = {
  light: 'Armures légères',
  medium: 'Armures intermédiaires',
  heavy: 'Armures lourdes',
  shield: 'Boucliers',
  simple: 'Armes courantes',
  martial: 'Armes de guerre',
  'martial-light': 'Armes de guerre légères',
  'martial-finesse-light':
    'Armes de guerre légères ou avec Finesse'
};

export default function ClassSelector({
  selectedId,
  allowedBooks,
  characterLevel,
  selectedSubclassId,
  selectedSkills,
  selectedFightingStyles,
  selectedWeaponMasteries,
  onWeaponMasteriesChange,
  onChange,
  onSubclassChange,
  onSkillsChange,
  onFightingStylesChange
}: Props) {
  const availableClasses = classes.filter(
    characterClass =>
      allowedBooks.includes(characterClass.bookId)
  );

  const [previewId, setPreviewId] = useState<string | null>(null);

  const selectedClass = availableClasses.find(
    characterClass => characterClass.id === selectedId
  );

  const previewClass =
    availableClasses.find(
      characterClass => characterClass.id === previewId
    ) ??
    selectedClass ??
    availableClasses[0];

  function selectClass(characterClass: CharacterClass) {
    setPreviewId(characterClass.id);
    onChange(characterClass.id);
  }

  if (availableClasses.length === 0) {
    return (
      <p className="warning">
        Aucune classe disponible avec les livres autorisés.
      </p>
    );
  }

  return (
    <div className="class-selector">
      <h3>Choisir une classe</h3>

      <p className="muted">
        Sélectionne une classe pour découvrir ses aptitudes
        et sa progression.
      </p>

      <div className="class-builder-layout">
        <div className="class-builder-list">
          {availableClasses.map(characterClass => (
            <button
              key={characterClass.id}
              type="button"
              className={
                selectedId === characterClass.id
                  ? 'class-builder-option selected'
                  : 'class-builder-option'
              }
              aria-pressed={
                selectedId === characterClass.id
              }
              onClick={() => selectClass(characterClass)}
            >
              <span className="class-builder-option-name">
                {characterClass.name}
              </span>

              <small>d{characterClass.hitDie}</small>

              {selectedId === characterClass.id && (
                <span className="class-builder-check">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>

        {previewClass && (
          <div className="class-builder-details">
            <small>CLASSE DE PERSONNAGE</small>

            <h3>{previewClass.name}</h3>

            <p className="muted">
              {previewClass.description}
            </p>

            <div className="class-builder-stats">
              <div>
                <small>DÉ DE VIE</small>
                <strong>d{previewClass.hitDie}</strong>
              </div>

              <div>
                <small>CARACTÉRISTIQUES</small>
                <strong>
                  {previewClass.primaryAbilities
                    .map(ability => abilityNames[ability])
                    .join(' / ')}
                </strong>
              </div>

              <div>
                <small>JETS DE SAUVEGARDE</small>
                <strong>
                  {previewClass.savingThrows
                    .map(ability => abilityNames[ability])
                    .join(' / ')}
                </strong>
              </div>
            </div>

            <h4>Maîtrises</h4>

            <div className="class-builder-proficiencies">
              {previewClass.proficiencies.map(
                (proficiency, index) => (
                  <span
                    key={`${proficiency.type}-${proficiency.id}-${index}`}
                  >
                    {proficiencyNames[proficiency.id] ??
                      proficiency.id}
                  </span>
                )
              )}
            </div>




{selectedId === previewClass.id &&
  previewClass.skillChoices && (
    <ClassChoiceSelector
      choice={previewClass.skillChoices}
      selectedIds={selectedSkills}
      onChange={onSkillsChange}
    />
  )}



{selectedId === previewClass.id &&
  previewClass.id === 'fighter-2024' &&
  characterLevel >= 1 && (
    <ClassChoiceSelector
      choice={fightingStyleChoice}
      selectedIds={selectedFightingStyles}
      onChange={onFightingStylesChange}
    />
  )}



{selectedId === previewClass.id &&
  previewClass.id === 'fighter-2024' && (
    <WeaponMasterySelector
      classId={previewClass.id}
      characterLevel={characterLevel}
      allowedBooks={allowedBooks}
      selectedWeaponIds={selectedWeaponMasteries}
      onChange={onWeaponMasteriesChange}
    />
  )}



{selectedId === previewClass.id && (
  <SubclassSelector
    characterClass={previewClass}
    characterLevel={characterLevel}
    selectedId={selectedSubclassId}
    allowedBooks={allowedBooks}
    onChange={onSubclassChange}
  />
)}
         

<ClassProgression
  characterClass={previewClass}
  characterLevel={characterLevel}
  selectedSubclassId={
    selectedId === previewClass.id
      ? selectedSubclassId
      : ''
  }
/>



            {selectedId === previewClass.id && (
              <p className="class-builder-confirmation">
                ✓ {previewClass.name} sélectionné
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
