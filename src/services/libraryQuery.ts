import type { ContentCategory } from '../models/ContentSource';
import type { LibraryContentId, LibraryContentRecord, LibraryConversion, LibraryProvenance, LibraryRevision } from '../models/Library';
import { getBookById, normalizeBookId } from '../data/books';
import { normalizeLibraryName } from '../engine/libraryIdentity';
import { isLibraryConversionCurrent, LIBRARY_CLASS_CONVERTER } from '../engine/libraryImport';
import type { LibrarySnapshot } from '../engine/libraryImport';
import { isJsonRecord } from '../engine/contentImporter';
import type { JsonRecord } from '../engine/contentImporter';
import { LibraryDatabase, LibraryDatabaseError } from './libraryDatabase';
import { readLibrarySnapshot } from './libraryRepository';

export const LIBRARY_CATEGORY_LABELS: Record<ContentCategory, string> = {
  class: 'Classes', subclass: 'Sous-classes', classFeature: 'Capacités de classe',
  subclassFeature: 'Capacités de sous-classe', species: 'Espèces', background: 'Historiques',
  feat: 'Dons', spell: 'Sorts', equipment: 'Équipements'
};
export type LibraryConversionState = 'stored' | 'converted' | 'needs-reconversion' | 'unusable';
export const LIBRARY_CONVERSION_LABELS: Record<LibraryConversionState, string> = {
  stored: 'Enregistré, sans conversion', converted: 'Converti',
  'needs-reconversion': 'À reconvertir', unusable: 'Non exploitable par le créateur'
};
export interface LibraryQueryFilters {
  name?: string;
  category?: ContentCategory | 'all';
  bookId?: string;
  status?: LibraryContentRecord['status'] | 'all';
  conversionState?: LibraryConversionState | 'all';
}
export interface LibraryOriginView {
  provenance: LibraryProvenance;
  filenames: string[];
}
export interface LibraryEntryView {
  id: LibraryContentId;
  name: string;
  category: ContentCategory;
  bookId: string;
  bookName: string;
  status: LibraryContentRecord['status'];
  conversionState: LibraryConversionState;
  /** Conversion technique != branchement au créateur, qui n'utilise pas encore la bibliothèque. */
  creatorConnected: false;
  record: LibraryContentRecord;
  revision?: LibraryRevision;
  conversion?: LibraryConversion;
  originalEntry?: JsonRecord;
  origins: LibraryOriginView[];
  issues: string[];
}

/** Reconstitue uniquement l'entrée référencée ; n'exécute aucun contenu importé. */
function originalAt(document: unknown, pointer: string): JsonRecord {
  if (typeof pointer !== 'string' || (pointer !== '' && !pointer.startsWith('/'))) throw new Error('Pointeur original invalide.');
  let value = document;
  if (pointer !== '') for (const token of pointer.slice(1).split('/')) {
    if (/~(?![01])/.test(token)) throw new Error('Pointeur original invalide.');
    const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) throw new Error('Entrée originale introuvable.');
    value = (value as JsonRecord)[key];
  }
  if (!isJsonRecord(value)) throw new Error('Entrée originale non exploitable.');
  return value;
}

/** Projection en lecture seule, sans migration, conversion ni réparation automatique. */
export function describeLibrarySnapshot(snapshot: LibrarySnapshot, selectedIds?: readonly LibraryContentId[]): LibraryEntryView[] {
  const documents = new Map(snapshot.imports.map(document => [document.id, document]));
  const revisions = new Map(snapshot.revisions.map(revision => [JSON.stringify([revision.contentId, revision.revisionHash]), revision]));
  const parsed = new Map<string, unknown>();
  return snapshot.contents.filter(record => !selectedIds || selectedIds.includes(record.identity.id)).map<LibraryEntryView>(record => {
    if (!record?.identity || typeof record.identity.id !== 'string' || typeof record.identity.normalizedName !== 'string' ||
        typeof record.identity.bookId !== 'string' || !Object.hasOwn(LIBRARY_CATEGORY_LABELS, record.identity.category)) {
      throw new LibraryDatabaseError('invalid-data', 'Un contenu enregistré a une identité illisible. Aucune donnée n’a été modifiée.');
    }
    const revision = revisions.get(JSON.stringify([record.identity.id, record.activeRevision]));
    const issues: string[] = [];
    const origins: LibraryOriginView[] = [];
    let originalEntry: JsonRecord | undefined;
    if (!revision) issues.push('Révision active introuvable.');
    else if (!Array.isArray(revision.origins) || !revision.origins.length) issues.push('Provenance de la révision active manquante.');
    else for (const provenance of revision.origins) {
      if (!isJsonRecord(provenance) || typeof provenance.originalName !== 'string' || typeof provenance.originalSource !== 'string' ||
          !isJsonRecord(provenance.location) || typeof provenance.location.importId !== 'string' || typeof provenance.location.pointer !== 'string') {
        issues.push('Provenance originale illisible.'); continue;
      }
      const document = provenance?.location && documents.get(provenance.location.importId);
      origins.push({ provenance, filenames: document?.filenames ?? [] });
      try {
        if (!document) throw new Error('Fichier original introuvable.');
        if (!parsed.has(document.id)) parsed.set(document.id, JSON.parse(document.originalText));
        const original = originalAt(parsed.get(document.id), provenance.location.pointer);
        originalEntry ??= original;
      } catch (error) { issues.push(error instanceof Error ? error.message : 'Lecture de l’original impossible.'); }
    }
    const conversions = revision?.conversions ?? [];
    if (!Array.isArray(conversions) || conversions.some(conversion => !isJsonRecord(conversion) || !isJsonRecord(conversion.converter) ||
        !isJsonRecord(conversion.result) || !Array.isArray(conversion.dependencies))) {
      throw new LibraryDatabaseError('invalid-data', 'Liste des conversions illisible.');
    }
    const current = conversions.find(conversion => conversion.converter.id === LIBRARY_CLASS_CONVERTER.id &&
      conversion.converter.version === LIBRARY_CLASS_CONVERTER.version && conversion.contentId === record.identity.id &&
      conversion.revisionHash === record.activeRevision);
    const conversion = current ?? conversions.find(item => item.result.status === 'converted') ?? conversions[0];
    let conversionState: LibraryConversionState = 'stored';
    if (issues.length || record.status === 'archived') conversionState = 'unusable';
    else if (conversion) {
      if (conversion.result.status !== 'converted') conversionState = 'unusable';
      else conversionState = isLibraryConversionCurrent(conversion, snapshot.contents) ? 'converted' : 'needs-reconversion';
    }
    if (record.status === 'archived') issues.push('Ce contenu est archivé.');
    if (conversionState === 'needs-reconversion') issues.push('Le convertisseur ou les dépendances ont changé : ce résultat doit être reconverti.');
    if (conversion && conversion.result.status !== 'converted') issues.push(...conversion.result.issues);
    return {
      id: record.identity.id, name: origins[0]?.provenance.originalName ?? record.identity.normalizedName,
      category: record.identity.category, bookId: record.identity.bookId,
      bookName: getBookById(record.identity.bookId)?.name ?? 'Source non référencée', status: record.status,
      conversionState, creatorConnected: false, record, revision, conversion, originalEntry, origins, issues: [...new Set(issues)]
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id));
}

/** Les filtres portent sur le catalogue enregistré, sans appliquer d'autorisation de campagne. */
export function filterLibraryEntries(entries: readonly LibraryEntryView[], filters: LibraryQueryFilters = {}): LibraryEntryView[] {
  const query = normalizeLibraryName(filters.name ?? '');
  const status = filters.status ?? 'active';
  return entries.filter(entry =>
    (!query || normalizeLibraryName(entry.name).includes(query)) &&
    (!filters.category || filters.category === 'all' || entry.category === filters.category) &&
    (!filters.bookId || filters.bookId === 'all' || entry.bookId === normalizeBookId(filters.bookId)) &&
    (status === 'all' || entry.status === status) &&
    (!filters.conversionState || filters.conversionState === 'all' || entry.conversionState === filters.conversionState));
}

export interface LibraryRevisionView {
  revision: LibraryRevision;
  isActive: boolean;
  details: LibraryEntryView;
}
export function describeLibraryHistory(snapshot: LibrarySnapshot, id: LibraryContentId): LibraryRevisionView[] {
  const content = snapshot.contents.find(content => content.identity.id === id);
  if (!content) throw new LibraryDatabaseError('invalid-data', 'Contenu introuvable.');
  return snapshot.revisions.filter(revision => revision.contentId === id)
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.revisionHash.localeCompare(b.revisionHash))
    .map(revision => ({ revision, isActive: revision.revisionHash === content.activeRevision,
      details: describeLibrarySnapshot({ ...snapshot, contents: snapshot.contents.map(record => record.identity.id === id ? { ...record, activeRevision: revision.revisionHash } : record) }, [id])[0]
    }));
}

export class LibraryQueryService {
  constructor(private readonly database = new LibraryDatabase()) {}
  async consult(): Promise<LibraryEntryView[]> {
    return describeLibrarySnapshot(await readLibrarySnapshot(this.database));
  }
  async history(id: LibraryContentId): Promise<LibraryRevisionView[]> {
    return describeLibraryHistory(await readLibrarySnapshot(this.database), id);
  }
  close(): void { this.database.close(); }
}
