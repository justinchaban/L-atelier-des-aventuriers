
import type {
  AbilityGenerationMethod
} from '../../engine/abilityGeneration';

interface Props {
  selectedMethod: AbilityGenerationMethod;
  onChange: (method: AbilityGenerationMethod) => void;
}

const methods: {
  id: AbilityGenerationMethod;
  name: string;
  description: string;
}[] = [
  {
    id: 'manual',
    name: 'Saisie manuelle',
    description:
      'Définissez librement les scores de base de votre personnage.'
  },
  {
    id: 'standard',
    name: 'Tableau standard',
    description:
      'Répartissez les valeurs 15, 14, 13, 12, 10 et 8 entre les six caractéristiques.'
  },
  {
    id: 'point-buy',
    name: 'Achat de points',
    description:
      'Répartissez un budget de 27 points entre vos six caractéristiques.'
  },
  {
    id: 'roll',
    name: 'Jets de dés',
    description:
      'Lancez 4d6, retirez le dé le plus faible et répartissez les six résultats.'
  }
];

export default function AbilityMethodSelector({
  selectedMethod,
  onChange
}: Props) {
  return (
    <section className="ability-method-selector">
      <h3>Méthode d'attribution</h3>

      <div className="class-choice-options">
        {methods.map(method => {
          const selected = selectedMethod === method.id;

          return (
            <button
              key={method.id}
              type="button"
              className={
                selected
                  ? 'class-choice-option selected'
                  : 'class-choice-option'
              }
              aria-pressed={selected}
              onClick={() => onChange(method.id)}
            >
              <span className="class-choice-option-check">
                {selected ? '✓' : ''}
              </span>

              <span>
                <strong>{method.name}</strong>

                <small>{method.description}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
