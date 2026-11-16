import type { CreatorDiagnostic, CreatorLibraryCandidate } from '../models/CreatorCatalog';
import { nativeCreatorCatalog } from '../engine/nativeCreatorCatalog';
import { isJsonRecord } from '../engine/contentImporter';
import { LibraryCreatorCatalogService, mergeLibraryCreatorCatalog } from './libraryCreatorCatalog';
import type { LibraryCreatorCatalog } from './libraryCreatorCatalog';

export interface CreatorCatalogLoadState {
  readonly status: 'loading' | 'ready' | 'empty' | 'error';
  readonly catalog: LibraryCreatorCatalog;
  readonly coherent: boolean | null;
  readonly diagnostics: readonly CreatorDiagnostic[];
  readonly error?: string;
}
export interface CreatorCatalogReader {
  load(): Promise<unknown>;
  close(): void;
}
export type CreatorCatalogReaderFactory = () => CreatorCatalogReader;
const errorDiagnostic = (message: string): CreatorDiagnostic => ({ code: 'catalog-load-error', severity: 'error', message });
const validDiagnostic = (value: unknown): value is CreatorDiagnostic => isJsonRecord(value) && typeof value.code === 'string' &&
  typeof value.message === 'string' && ['error', 'warning', 'info'].includes(String(value.severity));
const nativeOnly = (): LibraryCreatorCatalog => ({ ...nativeCreatorCatalog, coherent: true, diagnostics: [] });

/** Frontière supplémentaire : aucune entrée reçue ne remplace le manifeste natif. */
export function validateLoadedCreatorCatalog(value: unknown): LibraryCreatorCatalog {
  if (!isJsonRecord(value) || value.contractVersion !== nativeCreatorCatalog.contractVersion || !Array.isArray(value.entries) ||
      typeof value.coherent !== 'boolean' || !Array.isArray(value.diagnostics) || !value.diagnostics.every(validDiagnostic)) {
    throw new Error('Le résultat du catalogue est illisible ou incompatible.');
  }
  return mergeLibraryCreatorCatalog(nativeCreatorCatalog, {
    candidates: value.entries.filter(entry => !nativeCreatorCatalog.entries.some(native => native === entry)) as CreatorLibraryCandidate[],
    coherent: value.coherent, diagnostics: value.diagnostics
  });
}

/** État externe testable sans React ; chaque lecture possède son service et son numéro. */
export function createCreatorCatalogLoader(factory: CreatorCatalogReaderFactory = () => new LibraryCreatorCatalogService()) {
  let state: CreatorCatalogLoadState = { status: 'loading', catalog: nativeOnly(), coherent: null, diagnostics: [] };
  let active = false;
  let sequence = 0;
  let reader: CreatorCatalogReader | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: CreatorCatalogLoadState) => { state = next; for (const listener of listeners) listener(); };
  const close = () => { const previous = reader; reader = undefined; previous?.close(); };
  const refresh = async () => {
    if (!active) return;
    const request = ++sequence;
    close();
    publish({ status: 'loading', catalog: nativeOnly(), coherent: null, diagnostics: [] });
    let current: CreatorCatalogReader | undefined;
    try {
      current = factory(); reader = current;
      const value = await current.load();
      if (!active || request !== sequence) return;
      const catalog = validateLoadedCreatorCatalog(value);
      const imported = catalog.entries.some(entry => entry.reference.origin === 'library');
      publish({ status: catalog.coherent ? imported ? 'ready' : 'empty' : 'error', catalog,
        coherent: catalog.coherent, diagnostics: catalog.diagnostics,
        ...(!catalog.coherent ? { error: 'La bibliothèque présente des incohérences. Les contenus disponibles restent consultables.' } : {}) });
    } catch (error) {
      if (!active || request !== sequence) return;
      const message = error instanceof Error ? error.message : 'Lecture de la bibliothèque impossible.';
      const details = isJsonRecord(error) && Array.isArray(error.diagnostics) ? error.diagnostics.filter(validDiagnostic) : [];
      const diagnostics = [...details, errorDiagnostic(message)];
      publish({ status: 'error', catalog: { ...nativeOnly(), coherent: false, diagnostics }, coherent: false, diagnostics, error: message });
    } finally {
      if (reader === current) close();
    }
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { active = true; void refresh(); },
    stop() { active = false; ++sequence; close(); },
    refresh
  };
}
