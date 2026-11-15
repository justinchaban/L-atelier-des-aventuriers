
import { useState } from 'react';

import {
  getPointBuyTotal,
  isValidStandardArray,
  POINT_BUY_BUDGET,
  type AbilityGenerationMethod
} from '../../engine/abilityGeneration';

import type {
  BackgroundAbilityChoice
} from '../../engine/backgroundAbilities';

import { getBackgroundOriginFeat } from '../../engine/feats';
import { classes } from '../../data/classes';

import {
  cleanSubclassChoices,
  validateFeatureChoices
} from '../../engine/characterChoices';

import {
  validateFightingStyles
} from '../../engine/fightingStyles';

import {
  validateWeaponMasteries
} from '../../engine/weaponMastery';

import type {
  Character,
  Ability,
  AbilityScores
} from '../../models/Character';

import type { Campaign } from '../../models/Campaign';

import BackgroundAbilitySelector from './BackgroundAbilitySelector';
import AbilityScoreSelector from './AbilityScoreSelector';
import BackgroundSelector from './BackgroundSelector';
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

const EMPTY_ABILITIES: AbilityScores = {
  str: 0,
  dex: 0,
  con: 0,
  int: 0,
  wis: 0,
  cha: 0
};

const POINT_BUY_START: AbilityScores = {
  str: 8,
  dex: 8,
  con: 8,
  int: 8,
  wis: 8,
  cha: 8
};

const EMPTY_ROLL_ASSIGNMENTS = [
  '', '', '', '', '', ''
];

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

  const abilityMethod =
    character.choices.abilityGenerationMethod;

  const isStandardMethod =
    abilityMethod === 'standard';

  const isPointBuyMethod =
    abilityMethod === 'point-buy';

  const isRollMethod =
    abilityMethod === 'roll';

  const isStandardComplete =
    !isStandardMethod ||
    isValidStandardArray(character.abilities);

  const pointBuyTotal =
    getPointBuyTotal(character.abilities);

  const isPointBuyComplete =
    !isPointBuyMethod ||
    pointBuyTotal === POINT_BUY_BUDGET;

  const savedRolls =
    character.choices.abilityRolls;

  const savedRollAssignments =
    character.choices.abilityRollAssignments;

  const hasSixRolls =
    Array.isArray(savedRolls) &&
    savedRolls.length === 6 &&
    savedRolls.every(value =>
      Number.isInteger(Number(value)) &&
      Number(value) >= 3 &&
      Number(value) <= 18
    );

  const hasSixAssignments =
    Array.isArray(savedRollAssignments) &&
    savedRollAssignments.length === 6 &&
    savedRollAssignments.every(value =>
      typeof value === 'string' &&
      /^[0-5]$/.test(value)
    ) &&
    new Set(savedRollAssignments).size === 6;

  const rollAbilitiesMatch =
    hasSixRolls &&
    hasSixAssignments &&
    Array.isArray(savedRolls) &&
    Array.isArray(savedRollAssignments) &&
    ([
      'str', 'dex', 'con', 'int', 'wis', 'cha'
    ] as Ability[]).every((ability, index) =>
      character.abilities[ability] ===
      Number(savedRolls[Number(savedRollAssignments[index])])
    );

  const isRollComplete =
    !isRollMethod ||
    rollAbilitiesMatch;

  const abilitiesComplete =
    isStandardComplete &&
    isPointBuyComplete &&
    isRollComplete;

  const canContinue =
    step !== 4 || abilitiesComplete;

  function handleAbilityMethodChange(
    method: AbilityGenerationMethod
  ) {
    if (method === abilityMethod) {
      return;
    }

    const updatedChoices: Character['choices'] = {
      ...character.choices,
      abilityGenerationMethod: method
    };

    if (method === 'roll') {
      updatedChoices.abilityRolls = [];
      updatedChoices.abilityRollAssignments =
        [...EMPTY_ROLL_ASSIGNMENTS];
      updatedChoices.abilityRollDice = [];
    }

    onChange({
      choices: updatedChoices,

      ...(method === 'standard' || method === 'roll'
        ? {
            abilities: { ...EMPTY_ABILITIES }
          }
        : method === 'point-buy'
          ? {
              abilities: { ...POINT_BUY_START }
            }
          : {})
    });
  }

  function handleRollChange(
    scores: number[],
    assignments: string[],
    diceDetails: string[]
  ) {
    if (
      scores.length !== 6 ||
      diceDetails.length !== 6 ||
      !scores.every(score =>
        Number.isInteger(score) &&
        score >= 3 &&
        score <= 18
      )
    ) {
      return;
    }

    onChange({
      abilities: { ...EMPTY_ABILITIES },
      choices: {
        ...character.choices,
        abilityRolls: scores.map(String),
        abilityRollAssignments: assignments,
        abilityRollDice: diceDetails
      }
    });
  }

  function handleRollAssignmentChange(
    assignments: string[],
    abilities: AbilityScores
  ) {
    onChange({
      abilities,
      choices: {
        ...character.choices,
        abilityRollAssignments: assignments
      }
    });
  }

  function nextStep() {
    if (!canContinue) {
      return;
    }

    setStep(current =>
      Math.min(current + 1, steps.length - 1)
    );
  }

  function previousStep() {
    setStep(current =>
      Math.max(current - 1, 0)
    );
  }

  function handleStepClick(targetStep: number) {
    if (
      targetStep > 4 &&
      !abilitiesComplete
    ) {
      return;
    }

    setStep(targetStep);
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
            onClick={() => handleStepClick(index)}
            disabled={
              index > 4 &&
              !abilitiesComplete
            }
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
            selectedFeatureChoices={character.choices}

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
              Array.isArray(character.choices.fightingStyles)
                ? character.choices.fightingStyles
                : []
            }

            selectedWeaponMasteries={
              Array.isArray(character.choices.weaponMasteries)
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
            onSubclassChange={handleSubclassChange}

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

        {step === 4 && (
          <>
            <AbilityScoreSelector
              character={character}
              onChange={abilities =>
                onChange({ abilities })
              }
              onMethodChange={handleAbilityMethodChange}
              onRollChange={handleRollChange}
              onRollAssignmentChange={
                handleRollAssignmentChange
              }
            />

            {isStandardMethod && !isStandardComplete && (
              <p
                className="muted"
                role="alert"
              >
                ⚠️ Vous devez attribuer les six valeurs
                du tableau standard avant de continuer.
              </p>
            )}

            {isPointBuyMethod && !isPointBuyComplete && (
              <p
                className="muted"
                role="alert"
              >
                ⚠️ Vous devez utiliser les 27 points
                avant de continuer.
              </p>
            )}

            {isRollMethod && !isRollComplete && (
              <p
                className="muted"
                role="alert"
              >
                ⚠️ Lancez les six scores et attribuez
                chaque résultat à une caractéristique
                avant de continuer.
              </p>
            )}

            {(isStandardMethod ||
              isPointBuyMethod ||
              isRollMethod) &&
              abilitiesComplete && (
                <p className="class-builder-confirmation">
                  ✓ Les six caractéristiques ont été
                  correctement attribuées.
                </p>
              )}
          </>
        )}

        {step === 5 && (
          <>
            <h3>Équipement</h3>
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
          disabled={
            step === steps.length - 1 ||
            !canContinue
          }
        >
          Suivant →
        </button>
      </div>
    </section>
  );
}
