
import type { ClassChoice } from '../../models/Class';

interface Props {
  choice: ClassChoice;
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}

export default function ClassChoiceSelector({
  choice,
  selectedIds,
  onChange
}: Props) {
  
function toggleOption(optionId: string) {
  const validIds = selectedIds.filter(id =>
    choice.options.some(option => option.id === id)
  );

  if (validIds.includes(optionId)) {
    onChange(
      validIds.filter(id => id !== optionId)
    );
    return;
  }

  if (
    !choice.options.some(option => option.id === optionId) ||
    validIds.length >= choice.count
  ) {
    return;
  }

  onChange([...validIds, optionId]);
}


  const selectedCount = selectedIds.filter(id =>
    choice.options.some(option => option.id === id)
  ).length;

  return (
    <section className="class-choice-selector">
      <div className="class-choice-header">
        <div>
          <h4>{choice.name}</h4>
          <p className="muted">{choice.description}</p>
        </div>

        <span>
          {selectedCount} / {choice.count}
        </span>
      </div>

      <div className="class-choice-options">
        {choice.options.map(option => {
          const selected = selectedIds.includes(
            option.id
          );

          const disabled =
            !selected &&
            selectedCount >= choice.count;

          return (
            <button
              key={option.id}
              type="button"
              className={
                selected
                  ? 'class-choice-option selected'
                  : 'class-choice-option'
              }
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => toggleOption(option.id)}
            >
              <span className="class-choice-option-check">
                {selected ? '✓' : ''}
              </span>

              <span>
                <strong>{option.name}</strong>

                {option.description && (
                  <small>{option.description}</small>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selectedCount === choice.count && (
        <p className="class-choice-complete">
          ✓ Choix terminé
        </p>
      )}
    </section>
  );
}
