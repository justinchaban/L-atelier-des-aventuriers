
import { backgrounds } from '../../data/backgrounds';

import type { Ability } from '../../models/Character';
import type {
  BackgroundAbilityChoice,
  BackgroundAbilityMode
} from '../../engine/backgroundAbilities';

interface Props {
  backgroundId: string;
  choice: BackgroundAbilityChoice;
  onChange: (choice: BackgroundAbilityChoice) => void;
}

const abilityNames: Record<Ability, string> = {
  str: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Sagesse',
  cha: 'Charisme'
};

export default function BackgroundAbilitySelector({
  backgroundId,
  choice,
  onChange
}: Props) {
  const background = backgrounds.find(
    item => item.id === backgroundId
  );

  if (!background) {
    return null;
  }

  const abilities = background.abilityOptions;

  function handleModeChange(mode: BackgroundAbilityMode) {
    if (mode === '1-1-1') {
      onChange({ mode });
      return;
    }

    onChange({
      mode,
      primary: abilities[0],
      secondary: abilities[1]
    });
  }

  function handlePrimaryChange(primary: Ability) {
    const secondary =
      choice.secondary === primary
        ? abilities.find(ability => ability !== primary)
        : choice.secondary;

    onChange({
      mode: '2-1',
      primary,
      secondary
    });
  }

  function handleSecondaryChange(secondary: Ability) {
    const primary =
      choice.primary === secondary
        ? abilities.find(ability => ability !== secondary)
        : choice.primary;

    onChange({
      mode: '2-1',
      primary,
      secondary
    });
  }

  return (
    <section className="background-abilities">
      <h3>Bonus de caractéristiques</h3>

      <p className="muted">
        Choisissez comment répartir les bonus accordés
        par votre historique.
      </p>

      <div className="class-choice-options">
        <button
          type="button"
          className={
            choice.mode === '2-1'
              ? 'class-choice-option selected'
              : 'class-choice-option'
          }
          onClick={() => handleModeChange('2-1')}
        >
          +2 dans une caractéristique et +1 dans une autre
        </button>

        <button
          type="button"
          className={
            choice.mode === '1-1-1'
              ? 'class-choice-option selected'
              : 'class-choice-option'
          }
          onClick={() => handleModeChange('1-1-1')}
        >
          +1 dans chacune des trois caractéristiques
        </button>
      </div>

      {choice.mode === '2-1' && (
        <div className="fields">
          <label>
            Bonus +2
            <select
              value={choice.primary ?? ''}
              onChange={event =>
                handlePrimaryChange(event.target.value as Ability)
              }
            >
              <option value="" disabled>
                Choisir une caractéristique
              </option>

              {abilities.map(ability => (
                <option key={ability} value={ability}>
                  {abilityNames[ability]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Bonus +1
            <select
              value={choice.secondary ?? ''}
              onChange={event =>
                handleSecondaryChange(event.target.value as Ability)
              }
            >
              <option value="" disabled>
                Choisir une caractéristique
              </option>

              {abilities.map(ability => (
                <option key={ability} value={ability}>
                  {abilityNames[ability]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <p className="muted">
        Caractéristiques autorisées :{' '}
        {abilities.map(ability => abilityNames[ability]).join(', ')}
      </p>
    </section>
  );
}
