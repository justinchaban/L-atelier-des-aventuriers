
import type {
  Ability,
  AbilityScores,
  Character
} from '../../models/Character';

import {
  ABILITIES,
  ABILITY_NAMES,
  formatAbilityModifier,
  getCharacterAbilityScores
} from '../../engine/abilities';

import {
  getBackgroundAbilityBonuses,
  type BackgroundAbilityChoice
} from '../../engine/backgroundAbilities';

import {
  STANDARD_ARRAY,
  POINT_BUY_BUDGET,
  getPointBuyTotal,
  getPointBuyCost,
  rollAbilityDiceSet,
  type AbilityGenerationMethod
} from '../../engine/abilityGeneration';

import AbilityMethodSelector from './AbilityMethodSelector';

interface Props {
  character: Character;
  onChange: (abilities: AbilityScores) => void;
  onMethodChange: (method: AbilityGenerationMethod) => void;
  onRollChange: (
    scores: number[],
    assignments: string[],
    diceDetails: string[]
  ) => void;
  onRollAssignmentChange: (
    assignments: string[],
    abilities: AbilityScores
  ) => void;
}

const EMPTY_ABILITIES: AbilityScores = {
  str: 0,
  dex: 0,
  con: 0,
  int: 0,
  wis: 0,
  cha: 0
};

const EMPTY_ASSIGNMENTS = [
  '', '', '', '', '', ''
];

export default function AbilityScoreSelector({
  character,
  onChange,
  onMethodChange,
  onRollChange,
  onRollAssignmentChange
}: Props) {
  const savedMethod =
    character.choices.abilityGenerationMethod;

  const method: AbilityGenerationMethod =
    savedMethod === 'standard' ||
    savedMethod === 'point-buy' ||
    savedMethod === 'roll'
      ? savedMethod
      : 'manual';

  const finalScores = getCharacterAbilityScores(character);

  const backgroundChoice: BackgroundAbilityChoice = {
    mode:
      character.choices.backgroundAbilityMode === '1-1-1'
        ? '1-1-1'
        : '2-1',

    primary:
      typeof character.choices.backgroundAbilityPrimary === 'string'
        ? character.choices.backgroundAbilityPrimary as Ability
        : undefined,

    secondary:
      typeof character.choices.backgroundAbilitySecondary === 'string'
        ? character.choices.backgroundAbilitySecondary as Ability
        : undefined
  };

  const backgroundBonuses = getBackgroundAbilityBonuses(
    character.backgroundId,
    backgroundChoice
  );

  const pointBuyTotal =
    getPointBuyTotal(character.abilities);

  const pointBuyRemaining =
    POINT_BUY_BUDGET - pointBuyTotal;

  const savedRolls = character.choices.abilityRolls;

  const rollScores =
    Array.isArray(savedRolls) &&
    savedRolls.length === 6 &&
    savedRolls.every(value =>
      Number.isInteger(Number(value)) &&
      Number(value) >= 3 &&
      Number(value) <= 18
    )
      ? savedRolls.map(Number)
      : [];

  const savedAssignments =
    character.choices.abilityRollAssignments;

  const rollAssignments =
    Array.isArray(savedAssignments) &&
    savedAssignments.length === 6
      ? savedAssignments
      : EMPTY_ASSIGNMENTS;

  const savedDiceDetails =
    character.choices.abilityRollDice;

  const diceDetails =
    Array.isArray(savedDiceDetails) &&
    savedDiceDetails.length === 6
      ? savedDiceDetails.map(value => {
          const dice = value.split(',').map(Number);

          if (
            dice.length !== 4 ||
            dice.some(
              die =>
                !Number.isInteger(die) ||
                die < 1 ||
                die > 6
            )
          ) {
            return [];
          }

          return dice;
        })
      : [];

  const usedRollIndices = rollAssignments
    .filter(value => value !== '')
    .map(Number);

  const assignedRollCount =
    rollAssignments.filter(
      value => value !== ''
    ).length;

  function handleScoreChange(
    ability: Ability,
    value: number
  ) {
    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value > 20
    ) {
      return;
    }

    onChange({
      ...character.abilities,
      [ability]: value
    });
  }

  function handleMethodChange(
    nextMethod: AbilityGenerationMethod
  ) {
    if (nextMethod !== method) {
      onMethodChange(nextMethod);
    }
  }

  function handleStandardScoreChange(
    ability: Ability,
    value: number
  ) {
    if (
      value !== 0 &&
      !STANDARD_ARRAY.includes(value)
    ) {
      return;
    }

    const alreadyUsed = ABILITIES.some(
      item =>
        item !== ability &&
        character.abilities[item] === value
    );

    if (value !== 0 && alreadyUsed) {
      return;
    }

    onChange({
      ...character.abilities,
      [ability]: value
    });
  }

  function handlePointBuyChange(
    ability: Ability,
    value: number
  ) {
    if (
      !Number.isInteger(value) ||
      value < 8 ||
      value > 15
    ) {
      return;
    }

    const updatedAbilities: AbilityScores = {
      ...character.abilities,
      [ability]: value
    };

    const total = getPointBuyTotal(updatedAbilities);

    if (
      total < 0 ||
      total > POINT_BUY_BUDGET
    ) {
      return;
    }

    onChange(updatedAbilities);
  }

  function handleRollGeneration() {
    const rolls = rollAbilityDiceSet();

    const scores = rolls.map(
      roll => roll.total
    );

    const details = rolls.map(
      roll => roll.dice.join(',')
    );

    onRollChange(
      scores,
      [...EMPTY_ASSIGNMENTS],
      details
    );
  }

  function handleRollAssignment(
    ability: Ability,
    value: string
  ) {
    if (rollScores.length !== 6) {
      return;
    }

    const abilityIndex = ABILITIES.indexOf(ability);

    if (abilityIndex === -1) {
      return;
    }

    if (value !== '') {
      const rollIndex = Number(value);

      if (
        !Number.isInteger(rollIndex) ||
        rollIndex < 0 ||
        rollIndex >= rollScores.length
      ) {
        return;
      }

      const alreadyUsed = rollAssignments.some(
        (assignedIndex, index) =>
          index !== abilityIndex &&
          assignedIndex === value
      );

      if (alreadyUsed) {
        return;
      }
    }

    const updatedAssignments = [...rollAssignments];

    updatedAssignments[abilityIndex] = value;

    const updatedAbilities: AbilityScores = {
      ...EMPTY_ABILITIES
    };

    ABILITIES.forEach((item, index) => {
      const assignedIndex = updatedAssignments[index];

      if (assignedIndex === '') {
        return;
      }

      const rollIndex = Number(assignedIndex);

      updatedAbilities[item] =
        rollScores[rollIndex] ?? 0;
    });

    onRollAssignmentChange(
      updatedAssignments,
      updatedAbilities
    );
  }

  return (
    <section className="ability-score-selector">
      <h3>Caractéristiques</h3>

      <p className="muted">
        Définissez les scores de base de votre personnage.
        Les bonus accordés par votre historique sont
        ajoutés automatiquement.
      </p>

      <AbilityMethodSelector
        selectedMethod={method}
        onChange={handleMethodChange}
      />

      {method === 'point-buy' && (
        <div className="point-buy-summary">
          <h4>Achat de points</h4>

          <p>
            Points utilisés :
            <strong>
              {' '}{pointBuyTotal} / {POINT_BUY_BUDGET}
            </strong>
          </p>

          <p>
            Points restants :
            <strong>
              {' '}{pointBuyRemaining}
            </strong>
          </p>

          <progress
            max={POINT_BUY_BUDGET}
            value={
              pointBuyTotal >= 0
                ? pointBuyTotal
                : 0
            }
          />
        </div>
      )}

      {method === 'roll' && (
        <div className="point-buy-summary">
          <h4>Génération par jets de dés</h4>

          <p className="muted">
            Lancez quatre dés à six faces.
            Le plus faible est écarté et
            les trois autres sont additionnés.
          </p>

          <button
            type="button"
            onClick={handleRollGeneration}
          >
            🎲 {rollScores.length === 6
              ? 'Relancer les six scores'
              : 'Lancer les six scores'}
          </button>

          {rollScores.length === 6 && (
            <>
              <p>
                <strong>
                  {assignedRollCount} / 6
                </strong>
                {' '}résultats attribués.
              </p>

              <div className="ability-score-grid">
                {rollScores.map((score, index) => {
                  const dice = diceDetails[index] ?? [];

                  const lowest =
                    dice.length === 4
                      ? Math.min(...dice)
                      : null;

                  const droppedIndex =
                    lowest !== null
                      ? dice.indexOf(lowest)
                      : -1;

                  const isUsed =
                    usedRollIndices.includes(index);

                  return (
                    <div
                      key={index}
                      className="ability-score-card"
                    >
                      <div className="ability-score-header">
                        <h4>Jet {index + 1}</h4>

                        <span className="ability-score-final">
                          {score}
                        </span>
                      </div>

                      {dice.length === 4 && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                            margin: '12px 0'
                          }}
                        >
                          {dice.map((die, dieIndex) => {
                            const dropped =
                              dieIndex === droppedIndex;

                            return (
                              <span
                                key={dieIndex}
                                title={
                                  dropped
                                    ? 'Dé écarté'
                                    : 'Dé conservé'
                                }
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '8px',
                                  border: '1px solid currentColor',
                                  opacity: dropped ? 0.4 : 1,
                                  textDecoration: dropped
                                    ? 'line-through'
                                    : 'none',
                                  fontWeight: 700,
                                  fontSize: '18px'
                                }}
                              >
                                {die}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <p className="muted">
                        {isUsed
                          ? '✓ Attribué'
                          : 'Disponible'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <div className="ability-score-grid">
        {ABILITIES.map(ability => {
          const base = character.abilities[ability];
          const bonus = backgroundBonuses[ability] ?? 0;
          const final = finalScores[ability];

          const abilityIndex = ABILITIES.indexOf(ability);

          const selectedRoll =
            rollAssignments[abilityIndex] ?? '';

          const isAssigned =
            method === 'standard'
              ? base !== 0
              : method === 'roll'
                ? selectedRoll !== '' &&
                  rollScores.length === 6
                : true;

          return (
            <div
              key={ability}
              className="ability-score-card"
            >
              <div className="ability-score-header">
                <h4>{ABILITY_NAMES[ability]}</h4>

                <span className="ability-score-final">
                  {isAssigned ? final : '—'}
                </span>
              </div>

              <label>
                Valeur de base

                {method === 'standard' ? (
                  <select
                    value={base}
                    onChange={event =>
                      handleStandardScoreChange(
                        ability,
                        Number(event.target.value)
                      )
                    }
                  >
                    <option value={0}>
                      — Choisir —
                    </option>

                    {STANDARD_ARRAY.map(value => {
                      const alreadyUsed = ABILITIES.some(
                        item =>
                          item !== ability &&
                          character.abilities[item] === value
                      );

                      return (
                        <option
                          key={value}
                          value={value}
                          disabled={alreadyUsed}
                        >
                          {value}
                          {alreadyUsed
                            ? ' (attribué)'
                            : ''}
                        </option>
                      );
                    })}
                  </select>
                ) : method === 'point-buy' ? (
                  <select
                    value={base}
                    onChange={event =>
                      handlePointBuyChange(
                        ability,
                        Number(event.target.value)
                      )
                    }
                  >
                    {Array.from(
                      { length: 8 },
                      (_, index) => index + 8
                    ).map(value => {
                      const updatedAbilities = {
                        ...character.abilities,
                        [ability]: value
                      };

                      const cost =
                        getPointBuyTotal(updatedAbilities);

                      const disabled =
                        cost < 0 ||
                        cost > POINT_BUY_BUDGET;

                      return (
                        <option
                          key={value}
                          value={value}
                          disabled={disabled}
                        >
                          {value} (
                          {getPointBuyCost(value)} pts)
                        </option>
                      );
                    })}
                  </select>
                ) : method === 'roll' ? (
                  <select
                    value={selectedRoll}
                    disabled={rollScores.length !== 6}
                    onChange={event =>
                      handleRollAssignment(
                        ability,
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      — Choisir un jet —
                    </option>

                    {rollScores.map((score, index) => {
                      const indexString = String(index);

                      const alreadyUsed =
                        rollAssignments.some(
                          (assigned, assignedIndex) =>
                            assignedIndex !== abilityIndex &&
                            assigned === indexString
                        );

                      return (
                        <option
                          key={index}
                          value={indexString}
                          disabled={alreadyUsed}
                        >
                          Jet {index + 1} : {score}
                          {alreadyUsed
                            ? ' (attribué)'
                            : ''}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={base}
                    onChange={event =>
                      handleScoreChange(
                        ability,
                        Number(event.target.value)
                      )
                    }
                  />
                )}
              </label>

              <p className="ability-score-bonus">
                Bonus d'historique :
                <strong> +{bonus}</strong>
              </p>

              <div className="ability-score-modifier">
                <span>Modificateur</span>

                <strong>
                  {isAssigned
                    ? formatAbilityModifier(final)
                    : '—'}
                </strong>
              </div>
            </div>
          );
        })}
      </div>

      {method === 'standard' && (
        <p className="muted">
          Tableau standard : 15, 14, 13, 12, 10 et 8.
          Chaque valeur ne peut être attribuée
          qu'à une seule caractéristique.
          Les valeurs déjà utilisées sont grisées.
        </p>
      )}

      {method === 'point-buy' && (
        <p className="muted">
          Répartissez vos 27 points entre les six
          caractéristiques. Les scores de base
          doivent être compris entre 8 et 15.
          Les bonus d'historique ne consomment
          aucun point.
        </p>
      )}

      {method === 'roll' && (
        <p className="muted">
          Chaque jet peut être attribué une seule fois.
          Les résultats identiques restent indépendants.
          Relancer les dés efface les attributions
          précédentes.
        </p>
      )}
    </section>
  );
}
