import type { CreatorCatalog } from '../models/CreatorCatalog';
import { isBookAllowed } from './restrictions';

/** Recherche non filtrée : résoudre une sélection ne vaut pas l'autoriser. */
export function getCreatorClasses(catalog: CreatorCatalog) {
  return catalog.entries.flatMap(entry =>
    entry.category === 'class' && entry.availability === 'ready'
      ? [entry.definition] : []
  );
}

export function getCreatorClass(catalog: CreatorCatalog, domainId: string) {
  return getCreatorClasses(catalog).find(definition => definition.id === domainId);
}

export function getAvailableCreatorClasses(catalog: CreatorCatalog, allowedBooks: string[]) {
  return getCreatorClasses(catalog).filter(definition =>
    isBookAllowed(definition.bookId, allowedBooks)
  );
}
