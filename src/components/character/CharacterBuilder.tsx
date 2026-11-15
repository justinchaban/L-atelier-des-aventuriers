import ClassSelector from './ClassSelector';
import { useState } from 'react';
import { validateWeaponMasteries } from '../../engine/weaponMastery';
import type { Character } from '../../models/Character';
import type { Campaign } from '../../models/Campaign';

import SpeciesSelector from './SpeciesSelector';
import SpeciesTraits from './SpeciesTraits';

interface Props {
  character: Character;
  campaign: Campaign | null;
  onChange: (changes: Partial<Character>) => void;
  onClose: () => void;
}

const steps = [
  'Identité',
  'Espèce',
  'Classe',
  'Historique',
  'Caractéristiques',
  'Équipement',
  'Récapitulatif'
] as const;

export default function CharacterBuilder({
  character,
  campaign,
  onChange,
  onClose
}: Props) {
  const [step, setStep] = useState(0);

  function nextStep() {
    setStep(current => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setStep(current => Math.max(current - 1, 0));
  }

  return (
    <section className="panel character-builder">
      <div className="section-title">
        <div>
          <small>CRÉATION DE PERSONNAGE</small>
          <h2>{character.name}</h2>
        </div>

        <button type="button" onClick={onClose}>
          ← Mes personnages
        </button>
      </div>

      <div className="builder-steps">
        {steps.map((name, index) => (
          <button
            key={name}
            type="button"
            className={
              index === step
                ? 'builder-step active'
                : 'builder-step'
            }
            aria-current={index === step ? 'step' : undefined}
            onClick={() => setStep(index)}
          >
            <span>{index + 1}</span>
            {name}
          </button>
        ))}
      </div>

      <div className="builder-content">
        {step === 0 && (
          <>
            <h3>Identité du personnage</h3>

            <div className="fields">
              <label>
                Nom
                <input
                  value={character.name}
                  maxLength={80}
                  onChange={event =>
                    onChange({ name: event.target.value })
                  }
                />
              </label>


<label>
  Niveau
  <input
    type="number"
    min="1"
    max="20"
    value={character.level}
    onChange={event => {
      const level = Number(event.target.value);

      if (
        !Number.isInteger(level) ||
        level < 1 ||
        level > 20
      ) {
        return;
      }

      const currentMasteries =
        Array.isArray(character.choices.weaponMasteries)
          ? character.choices.weaponMasteries.filter(
              (id): id is string =>
                typeof id === 'string'
            )
          : [];

      const validMasteries = validateWeaponMasteries(
        character.classId,
        level,
        currentMasteries,
        campaign?.allowedBooks ?? ['srd-5.2.1']
      );

      onChange({
        level,
        choices: {
          ...character.choices,
          weaponMasteries: validMasteries
        }
      });
    }}
  />
</label>

            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h3>Choisir une espèce</h3>

            <SpeciesSelector
              selectedId={character.speciesId}
              allowedBooks={
                campaign?.allowedBooks ?? ['srd-5.2.1']
              }
              onChange={speciesId => onChange({ speciesId })}
            />

            <SpeciesTraits speciesId={character.speciesId} />
          </>
        )}

        
{step === 2 && (
<ClassSelector
  selectedId={character.classId}
  allowedBooks={
    campaign?.allowedBooks ?? ['srd-5.2.1']
  }
  characterLevel={character.level}

  selectedSubclassId={
    typeof character.choices.subclassId === 'string'
      ? character.choices.subclassId
      : ''
  }

  selectedSkills={
    Array.isArray(character.choices.classSkills)
      ? character.choices.classSkills.filter(
          (skill): skill is string =>
            typeof skill === 'string'
        )
      : []
  }

  selectedFightingStyles={
    Array.isArray(character.choices.fightingStyles)
      ? character.choices.fightingStyles.filter(
          (style): style is string =>
            typeof style === 'string'
        )
      : []
  }

  
selectedWeaponMasteries={
  Array.isArray(character.choices.weaponMasteries)
    ? character.choices.weaponMasteries.filter(
        (id): id is string =>
          typeof id === 'string'
      )
    : []
}
onWeaponMasteriesChange={weaponIds =>
  onChange({
    choices: {
      ...character.choices,
      weaponMasteries: weaponIds
    }
  })
}


  onChange={classId =>
    onChange({
      classId,
      choices:
        classId === character.classId
          ? character.choices
          : {
              ...character.choices,
              subclassId: '',
              classSkills: [],
              fightingStyles: [],
              weaponMasteries: []
            }
    })
  }

  onSubclassChange={subclassId =>
    onChange({
      choices: {
        ...character.choices,
        subclassId
      }
    })
  }

  onSkillsChange={skills =>
    onChange({
      choices: {
        ...character.choices,
        classSkills: skills
      }
    })
  }

  onFightingStylesChange={styles =>
    onChange({
      choices: {
        ...character.choices,
        fightingStyles: styles
      }
    })
  }
/>

)}

{step >= 3 && step <= 5 && (
  <>
    <h3>{steps[step]}</h3>
    <p className="muted">
      Cette étape sera développée prochainement.
    </p>
  </>
)}


        {step === 6 && (
          <>
            <h3>Récapitulatif</h3>

            <p><strong>Nom :</strong> {character.name}</p>
            <p><strong>Niveau :</strong> {character.level}</p>
            <p>
              <strong>Espèce :</strong>{' '}
              {character.speciesId || 'Non sélectionnée'}
            </p>
          </>
        )}
      </div>

      <div className="builder-navigation">
        <button
          type="button"
          onClick={previousStep}
          disabled={step === 0}
        >
          ← Précédent
        </button>

        <span>
          Étape {step + 1} sur {steps.length}
        </span>

        <button
          type="button"
          className="primary"
          onClick={nextStep}
          disabled={step === steps.length - 1}
        >
          Suivant →
        </button>
      </div>
    </section>
  );
}
