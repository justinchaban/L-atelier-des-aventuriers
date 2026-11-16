import type { CreatorCatalogEntry } from '../../src/models/CreatorCatalog';
import type { CharacterClass } from '../../src/models/Class';

function useEntry(entry: CreatorCatalogEntry) {
  // @ts-expect-error Une disponibilité non contrôlée ne garantit aucune définition.
  const before: CharacterClass = entry.definition;
  if (entry.category === 'class' && entry.availability === 'ready') {
    const definition: CharacterClass = entry.definition;
    return definition.id;
  }
  return before;
}

declare const ready: Extract<CreatorCatalogEntry<'class'>, { availability: 'ready' }>;
// @ts-expect-error Un contenu archivé ne peut pas exposer de définition mécanique.
const archived: CreatorCatalogEntry<'class'> = { ...ready, availability: 'archived' };
// @ts-expect-error Une classe ne peut pas être utilisée comme capacité.
const feature: CreatorCatalogEntry<'classFeature'> = { ...ready, category: 'classFeature' };

void useEntry;
void archived;
void feature;
