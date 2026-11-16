import { classes } from '../data/classes';
import { normalizeBookId } from '../data/books';
import type { CharacterClass, ClassFeature, Subclass } from '../models/Class';
import {
  CREATOR_CATALOG_VERSION,
  type CreatorCatalog, type CreatorCatalogEntry, type CreatorCatalogKey,
  type CreatorCategory, type CreatorProvenance
} from '../models/CreatorCatalog';

export const NATIVE_CREATOR_MANIFEST_VERSION = '1';

/** Identité contextuelle versionnée ; ni le nom ni l'ordre ne participent à la clé. */
function nativeKey(category: CreatorCategory, ids: readonly string[]): CreatorCatalogKey {
  return `native:v1:${JSON.stringify([category, ...ids])}`;
}

function provenance(
  definition: CharacterClass | Subclass | ClassFeature,
  owner?: CreatorProvenance
): CreatorProvenance {
  const source = definition.bookId ?? owner!.originalSource;
  return {
    originalName: definition.importMetadata?.originalName ?? definition.name,
    originalSource: definition.importMetadata?.originalSource ?? source,
    canonicalBookId: normalizeBookId(definition.bookId ?? owner!.canonicalBookId),
    ruleset: 'ruleset' in definition ? definition.ruleset : owner!.ruleset,
    bookInherited: definition.bookId === undefined
  };
}

/**
 * Adaptateur des définitions natives contrôlées dans src/data/classes.ts.
 * Ce n'est pas un validateur de JSON importé. Les définitions et leur ordre sont
 * conservés, sans copie ni mutation ; les consommateurs doivent les traiter en lecture seule.
 */
export function buildNativeCreatorCatalog(definitions: readonly CharacterClass[]): CreatorCatalog {
  const entries: CreatorCatalogEntry[] = [];
  const keys = new Set<CreatorCatalogKey>();

  function add(entry: CreatorCatalogEntry) {
    if (keys.has(entry.catalogKey)) {
      throw new Error(`Identité native dupliquée : ${entry.catalogKey}`);
    }
    keys.add(entry.catalogKey);
    entries.push(Object.freeze(entry));
  }

  const ready = {
    availability: 'ready' as const,
    validation: 'native-reviewed' as const,
    rulesProfile: 'native-current-v1',
    reference: Object.freeze({ origin: 'native' as const, manifestVersion: NATIVE_CREATOR_MANIFEST_VERSION }),
    diagnostics: Object.freeze([])
  };

  for (const definition of definitions) {
    const classKey = nativeKey('class', [definition.id]);
    const classProvenance = Object.freeze(provenance(definition));
    add({ ...ready, category: 'class', catalogKey: classKey, domainId: definition.id,
      provenance: classProvenance, definition });

    for (const feature of definition.features) {
      add({ ...ready, category: 'classFeature',
        catalogKey: nativeKey('classFeature', [definition.id, feature.id]),
        domainId: feature.id, ownerKey: classKey,
        provenance: Object.freeze(provenance(feature, classProvenance)), definition: feature });
    }

    for (const subclass of definition.subclasses) {
      const subclassKey = nativeKey('subclass', [definition.id, subclass.id]);
      const subclassProvenance = Object.freeze(provenance(subclass));
      add({ ...ready, category: 'subclass', catalogKey: subclassKey,
        domainId: subclass.id, ownerKey: classKey, provenance: subclassProvenance, definition: subclass });
      for (const feature of subclass.features) {
        add({ ...ready, category: 'subclassFeature',
          catalogKey: nativeKey('subclassFeature', [definition.id, subclass.id, feature.id]),
          domainId: feature.id, ownerKey: subclassKey,
          provenance: Object.freeze(provenance(feature, subclassProvenance)), definition: feature });
      }
    }
  }

  return Object.freeze({
    contractVersion: CREATOR_CATALOG_VERSION,
    categories: Object.freeze(['class', 'subclass', 'classFeature', 'subclassFeature'] as const),
    entries: Object.freeze(entries)
  });
}

/** Catalogue synchrone unique : aucune lecture, fusion ou activation d'import. */
export const nativeCreatorCatalog = buildNativeCreatorCatalog(classes);
