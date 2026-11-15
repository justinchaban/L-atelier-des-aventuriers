import BackgroundAbilitySelector from './BackgroundAbilitySelector.tsx';

import type {
  BackgroundAbilityChoice
} from '../../engine/backgroundAbilities';

import { getBackgroundOriginFeat } from '../../engine/feats';
import { useState } from 'react';
import BackgroundSelector from './BackgroundSelector';
import { classes } from '../../data/classes';
import {
  cleanSubclassChoices,
  validateFeatureChoices
} from '../../engine/characterChoices';
import { validateFightingStyles } from '../../engine/fightingStyles';
import { validateWeaponMasteries } from '../../engine/weaponMastery';

import type { Character, Ability } from '../../models/Character';
import type { Campaign } from '../../models/Campaign';

import ClassSelector from './ClassSelector';
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

  const allowedBooks =
    campaign?.allowedBooks ?? ['srd-5.2.1'];

  const selectedSubclassId =
    typeof character.choices.subclassId === 'string'
      ? character.choices.subclassId
      : '';

  
  const backgroundAbilityMode =
    character.choices.backgroundAbilityMode === '1-1-1'
      ? '1-1-1'
      : '2-1';

  const backgroundAbilityChoice: BackgroundAbilityChoice = {
    mode: backgroundAbilityMode,
    primary:
      typeof character.choices.backgroundAbilityPrimary === 'string'
        ? character.choices.backgroundAbilityPrimary as Ability
        : undefined,
    secondary:
      typeof character.choices.backgroundAbilitySecondary === 'string'
        ? character.choices.backgroundAbilitySecondary as Ability
        : undefined
  };


  function nextStep() {
    setStep(current =>
      Math.min(current + 1, steps.length - 1)
    );
  }

  function previousStep() {
    setStep(current =>
      Math.max(current - 1, 0)
    );
  }

  function handleLevelChange(level: number) {
    if (
      !Number.isInteger(level) ||
      level < 1 ||
      level > 20
    ) {
      return;
    }

    const currentMasteries =
      Array.isArray(character.choices.weaponMasteries)
        ? character.choices.weaponMasteries
        : [];

    const validMasteries = validateWeaponMasteries(
      character.classId,
      level,
      currentMasteries,
      allowedBooks
    );

    const currentFightingStyles =
      Array.isArray(character.choices.fightingStyles)
        ? character.choices.fightingStyles
        : [];

    const validFightingStyles = validateFightingStyles(
      character.classId,
      selectedSubclassId,
      level,
      currentFightingStyles
    );

    const updatedChoices: Character['choices'] = {
      ...character.choices,
      weaponMasteries: validMasteries,
      fightingStyles: validFightingStyles
    };

    const characterClass = classes.find(
      item => item.id === character.classId
    );

    const validatedChoices = characterClass
      ? validateFeatureChoices(
          updatedChoices,
          characterClass,
          level,
          selectedSubclassId
        )
      : updatedChoices;

    onChange({
      level,
      choices: validatedChoices
    });
  }

  function handleClassChange(classId: string) {
    if (classId === character.classId) {
      return;
    }

    const characterClass = classes.find(
      item => item.id === classId
    );

    const resetChoices: Character['choices'] = {
      ...character.choices,
      subclassId: '',
      classSkills: [],
      fightingStyles: [],
      weaponMasteries: []
    };

    const validatedChoices = characterClass
      ? validateFeatureChoices(
          resetChoices,
          characterClass,
          character.level,
          ''
        )
      : resetChoices;

    onChange({
      classId,
      choices: validatedChoices
    });
  }

  function handleSubclassChange(subclassId: string) {
    const characterClass = classes.find(
      item => item.id === character.classId
    );

    if (!characterClass) {
      return;
    }

    const cleanedChoices = cleanSubclassChoices(
      character.choices,
      characterClass,
      subclassId
    );

    const currentFightingStyles =
      Array.isArray(cleanedChoices.fightingStyles)
        ? cleanedChoices.fightingStyles
        : [];

    cleanedChoices.fightingStyles =
      validateFightingStyles(
        character.classId,
        subclassId,
        character.level,
        currentFightingStyles
      );

    const validatedChoices = validateFeatureChoices(
      cleanedChoices,
      characterClass,
      character.level,
      subclassId
    );

    onChange({
      choices: validatedChoices
    });
  }


function handleBackgroundChange(backgroundId: string) {
  const originFeat = getBackgroundOriginFeat(backgroundId);

  onChange({
    backgroundId,
    choices: {
      ...character.choices,
      backgroundOriginFeatId: originFeat?.id ?? '',
      backgroundAbilityMode: '2-1',
      backgroundAbilityPrimary: '',
      backgroundAbilitySecondary: ''
    }
  });
}

  function handleBackgroundAbilityChange(
    choice: BackgroundAbilityChoice
  ) {
    onChange({
      choices: {
        ...character.choices,
        backgroundAbilityMode: choice.mode,
        backgroundAbilityPrimary: choice.primary ?? '',
        backgroundAbilitySecondary: choice.secondary ?? ''
      }
    });
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
            aria-current={
              index === step ? 'step' : undefined
            }
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
                    onChange({
                      name: event.target.value
                    })
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
                  onChange={event =>
                    handleLevelChange(
                      Number(event.target.value)
                    )
                  }
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
              allowedBooks={allowedBooks}
              onChange={speciesId =>
                onChange({ speciesId })
              }
            />

            <SpeciesTraits
              speciesId={character.speciesId}
            />
          </>
        )}

        {step === 2 && (
          <ClassSelector
            selectedId={character.classId}
            allowedBooks={allowedBooks}
            characterLevel={character.level}
            selectedSubclassId={selectedSubclassId}

            selectedFeatureChoices={
              character.choices
            }

            onFeatureChoiceChange={(key, ids) =>
              onChange({
                choices: {
                  ...character.choices,
                  [key]: ids
                }
              })
            }

            selectedSkills={
              Array.isArray(character.choices.classSkills)
                ? character.choices.classSkills
                : []
            }

            selectedFightingStyles={
              Array.isArray(
                character.choices.fightingStyles
              )
                ? character.choices.fightingStyles
                : []
            }

            selectedWeaponMasteries={
              Array.isArray(
                character.choices.weaponMasteries
              )
                ? character.choices.weaponMasteries
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

            onChange={handleClassChange}

            onSubclassChange={
              handleSubclassChange
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



        {step === 3 && (
          <>
            <BackgroundSelector
              selectedId={character.backgroundId}
              allowedBooks={allowedBooks}
              onChange={handleBackgroundChange}
            />

            {typeof character.choices.backgroundOriginFeatId === 'string' &&
              character.choices.backgroundOriginFeatId !== '' &&
              character.choices.backgroundOriginFeatId ===
                getBackgroundOriginFeat(character.backgroundId)?.id && (
                <p className="class-builder-confirmation">
                  ✓ Don d'origine attribué :{' '}
                  {getBackgroundOriginFeat(character.backgroundId)?.name}
                </p>
              )}

            {character.backgroundId !== '' && (
              <BackgroundAbilitySelector
                backgroundId={character.backgroundId}
                choice={backgroundAbilityChoice}
                onChange={handleBackgroundAbilityChange}
              />
            )}
          </>
        )}



        {step >= 4 && step <= 5 && (
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

            <p>
              <strong>Nom :</strong> {character.name}
            </p>

            <p>
              <strong>Niveau :</strong> {character.level}
            </p>

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
