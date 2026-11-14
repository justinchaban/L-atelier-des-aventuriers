
import { species } from '../../data/species';

interface Props {
  speciesId: string;
}

export default function SpeciesTraits({
  speciesId
}: Props) {
  const selectedSpecies = species.find(
    item => item.id === speciesId
  );

  if (!selectedSpecies) {
    return null;
  }

  return (
    <section className="species-traits">
      <h3>Traits d'espèce : {selectedSpecies.name}</h3>

      <p>
        <strong>Vitesse :</strong>{' '}
        {selectedSpecies.speed} pieds
      </p>

      <div className="trait-list">
        {selectedSpecies.traits.map(trait => (
          <article className="trait-card" key={trait.id}>
            <h4>{trait.name}</h4>

            <p>{trait.description}</p>

            {trait.levelRequired && (
              <small>
                Disponible au niveau {trait.levelRequired}
              </small>
            )}
          </article>
        ))}
      </div>

      {selectedSpecies.traits.length === 0 && (
        <p className="muted">
          Les traits de cette espèce seront ajoutés
          prochainement.
        </p>
      )}
    </section>
  );
}
