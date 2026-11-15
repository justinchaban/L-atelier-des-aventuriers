import { createLibraryIdentity } from '../engine/libraryIdentity';
import type { LibraryIdentity, LibraryIdentityInput } from '../models/Library';
import type { LibraryContentRecord, LibraryDependency, LibraryImportDocument, LibraryRevision } from '../models/Library';

export const LIBRARY_DATABASE_NAME = 'atelier-aventuriers:library';
export const LIBRARY_DATABASE_VERSION = 1;
export const LIBRARY_STORES = ['imports', 'contents', 'revisions', 'dependencies'] as const;
export type LibraryStore = typeof LIBRARY_STORES[number];
export interface LibraryStoreRecords {
  imports: LibraryImportDocument;
  contents: LibraryContentRecord;
  revisions: LibraryRevision;
  dependencies: LibraryDependency;
}
export type LibraryDatabaseErrorCode = 'quota' | 'open' | 'version' | 'blocked' | 'transaction' | 'invalid-data' | 'constraint';

export class LibraryDatabaseError extends Error {
  constructor(public readonly code: LibraryDatabaseErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'LibraryDatabaseError';
  }
}

export function asLibraryDatabaseError(error: unknown, fallback: LibraryDatabaseErrorCode): LibraryDatabaseError {
  if (error instanceof LibraryDatabaseError) return error;
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  const code = name === 'QuotaExceededError' ? 'quota' : name === 'VersionError' ? 'version' :
    name === 'ConstraintError' ? 'constraint' :
    ['DataError', 'DataCloneError', 'TypeError', 'NotFoundError', 'SyntaxError', 'ReadOnlyError'].includes(String(name)) ? 'invalid-data' : fallback;
  return new LibraryDatabaseError(code, `Bibliothèque : ${code}.`, error);
}

export interface LibraryDatabaseOptions {
  /** Injection pour tests ; l'application utilise globalThis.indexedDB. */
  factory?: IDBFactory;
  onBlocked?: () => void;
  onVersionChange?: (newVersion: number | null) => void;
}

/**
 * Le callback et les callbacks de requêtes doivent être synchrones.
 * Préparer calculs, empreintes et appels réseau AVANT la transaction.
 * Pour lire puis écrire atomiquement, utiliser request(get(...), value => ...).
 */
export interface LibraryTransaction {
  store<S extends LibraryStore>(name: S): IDBObjectStore;
  request<T>(request: IDBRequest<T>, onSuccess?: (value: T) => void): void;
  abort(): void;
}

export type LibraryWrite = {
  [S in LibraryStore]:
    | { store: S; operation: 'add' | 'put'; value: LibraryStoreRecords[S] }
    | { store: S; operation: 'delete'; key: IDBValidKey }
}[LibraryStore];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const fingerprint = (value: unknown): boolean => typeof value === 'string' && /^sha256:v1:[a-f0-9]{64}$/.test(value);
const contentId = (value: unknown): boolean => typeof value === 'string' && value.startsWith('library:v1:') && value.length > 11;

function validIdentity(value: unknown): value is LibraryIdentity {
  if (!isRecord(value) || value.identityVersion !== 1 || typeof value.namespace !== 'string') return false;
  const result = createLibraryIdentity({
    provider: value.provider, category: value.category, name: value.normalizedName,
    source: value.bookId, namespace: value.namespace || undefined,
    classOwner: value.classOwner, subclassOwner: value.subclassOwner,
    level: value.level, originalKey: value.originalKey
  } as LibraryIdentityInput);
  return result.success && result.identity.id === value.id && result.identity.bookId === value.bookId &&
    result.identity.normalizedName === value.normalizedName;
}

/** Contrôles de format seulement : les relations et conflits métier relèvent de P1.3. */
function validateRecord(store: LibraryStore, value: unknown): void {
  let valid = isRecord(value);
  if (isRecord(value)) {
    if (store === 'imports') valid = value.recordVersion === 1 && fingerprint(value.id) && typeof value.originalText === 'string' &&
      Array.isArray(value.filenames) && value.filenames.every(string) && string(value.importedAt);
    if (store === 'contents') valid = value.recordVersion === 1 && validIdentity(value.identity) &&
      fingerprint(value.activeRevision) && Number.isSafeInteger(value.generation) && Number(value.generation) >= 0 &&
      ['active', 'archived'].includes(String(value.status)) && string(value.createdAt) && string(value.updatedAt);
    if (store === 'revisions') valid = value.recordVersion === 1 && contentId(value.contentId) && fingerprint(value.revisionHash) &&
      string(value.createdAt) && Array.isArray(value.origins) && value.origins.length > 0 && value.origins.every(origin =>
        isRecord(origin) && string(origin.provider) && typeof origin.namespace === 'string' && string(origin.originalName) &&
        string(origin.originalSource) && string(origin.bookId) && string(origin.originalKey) && isRecord(origin.location) &&
        fingerprint(origin.location.importId) && typeof origin.location.pointer === 'string' &&
        (origin.location.pointer === '' || /^(\/(?:[^~]|~[01])*)+$/.test(origin.location.pointer)));
    if (store === 'dependencies') valid = contentId(value.ownerId) && contentId(value.targetId) &&
      ['owner', 'feature', 'copy'].includes(String(value.relation)) && (value.revisionHash === undefined || fingerprint(value.revisionHash));
  }
  if (!valid) throw new LibraryDatabaseError('invalid-data', `Enregistrement invalide pour ${store}.`);
}

function synchronous(callback: () => unknown): void {
  const result = callback();
  if (result && (typeof result === 'object' || typeof result === 'function') && 'then' in result) {
    // Consommer le rejet éventuel sans attendre : la transaction doit être annulée immédiatement.
    void Promise.resolve(result).catch(() => {});
    throw new LibraryDatabaseError('invalid-data', 'Callback asynchrone interdit dans une transaction IndexedDB.');
  }
}

const SCHEMA: Record<LibraryStore, { keyPath: string | string[]; indexes: Record<string, string | string[]> }> = {
  imports: { keyPath: 'id', indexes: { importedAt: 'importedAt' } },
  contents: { keyPath: 'identity.id', indexes: {
    bookId: 'identity.bookId', category: 'identity.category',
    bookCategory: ['identity.bookId', 'identity.category'], normalizedName: 'identity.normalizedName', status: 'status'
  } },
  revisions: { keyPath: ['contentId', 'revisionHash'], indexes: { contentId: 'contentId' } },
  dependencies: { keyPath: ['ownerId', 'targetId', 'relation'], indexes: {
    ownerId: 'ownerId', targetId: 'targetId', relation: 'relation'
  } }
};

/** Migrations additives ; aucune suppression automatique de base ou de magasin. */
function migrate(database: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    for (const name of LIBRARY_STORES) {
      const definition = SCHEMA[name];
      const store = database.createObjectStore(name, { keyPath: definition.keyPath });
      for (const [index, keyPath] of Object.entries(definition.indexes)) store.createIndex(index, keyPath);
    }
  }
}

/** Une base existante incohérente est signalée, jamais recréée automatiquement. */
function verifySchema(database: IDBDatabase): void {
  if (database.version !== LIBRARY_DATABASE_VERSION || database.objectStoreNames.length !== LIBRARY_STORES.length ||
      LIBRARY_STORES.some(name => !database.objectStoreNames.contains(name))) {
    throw new LibraryDatabaseError('version', 'Schéma de bibliothèque incompatible.');
  }
  const transaction = database.transaction([...LIBRARY_STORES], 'readonly');
  for (const name of LIBRARY_STORES) {
    const store = transaction.objectStore(name);
    const definition = SCHEMA[name];
    if (JSON.stringify(store.keyPath) !== JSON.stringify(definition.keyPath) || store.autoIncrement ||
        store.indexNames.length !== Object.keys(definition.indexes).length) {
      throw new LibraryDatabaseError('version', `Structure incompatible : ${name}.`);
    }
    for (const [index, keyPath] of Object.entries(definition.indexes)) {
      if (!store.indexNames.contains(index) || JSON.stringify(store.index(index).keyPath) !== JSON.stringify(keyPath) ||
          store.index(index).unique || store.index(index).multiEntry) {
        throw new LibraryDatabaseError('version', `Index incompatible : ${name}.${index}.`);
      }
    }
  }
}

export class LibraryDatabase {
  private connection: IDBDatabase | null = null;
  private opening: Promise<void> | null = null;
  private epoch = 0;
  constructor(private readonly options: LibraryDatabaseOptions = {}) {}

  /** Les ouvertures simultanées de cette instance partagent la même tentative. */
  open(): Promise<void> {
    if (this.connection) return Promise.resolve();
    if (this.opening) return this.opening;
    const epoch = this.epoch;
    const pending = new Promise<void>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      let abandoned = false;
      let migrationError: unknown;
      try {
        const factory = this.options.factory ?? globalThis.indexedDB;
        if (!factory) throw new LibraryDatabaseError('open', 'IndexedDB indisponible.');
        request = factory.open(LIBRARY_DATABASE_NAME, LIBRARY_DATABASE_VERSION);
      } catch (error) { reject(asLibraryDatabaseError(error, 'open')); return; }
      request.onblocked = () => {
        abandoned = true;
        reject(new LibraryDatabaseError('blocked', 'Ouverture bloquée par une autre connexion. Fermez les autres onglets puis réessayez.'));
        try { this.options.onBlocked?.(); } catch { /* Un observateur ne contrôle pas le cycle de vie. */ }
      };
      request.onupgradeneeded = event => {
        // Une demande IndexedDB ne peut pas être annulée avant cet événement.
        if (abandoned || epoch !== this.epoch) { request.transaction?.abort(); return; }
        try { migrate(request.result, event.oldVersion); }
        catch (error) { migrationError = error; request.transaction?.abort(); }
      };
      request.onerror = () => reject(asLibraryDatabaseError(migrationError ?? request.error, 'open'));
      request.onsuccess = () => {
        const database = request.result;
        if (abandoned || epoch !== this.epoch) {
          database.close();
          reject(new LibraryDatabaseError('open', 'Ouverture annulée.'));
          return;
        }
        try { verifySchema(database); }
        catch (error) { database.close(); reject(asLibraryDatabaseError(error, 'version')); return; }
        database.onversionchange = event => {
          database.close();
          if (this.connection === database) this.connection = null;
          try { this.options.onVersionChange?.(event.newVersion); } catch { /* Connexion déjà fermée. */ }
        };
        database.onclose = () => { if (this.connection === database) this.connection = null; };
        this.connection = database;
        resolve();
      };
    });
    this.opening = pending;
    const clear = () => { if (this.opening === pending) this.opening = null; };
    void pending.then(clear, clear);
    return pending;
  }

  /** Ferme la connexion ; les transactions déjà lancées peuvent se terminer. */
  close(): void {
    this.epoch++;
    this.connection?.close();
    this.connection = null;
    this.opening = null;
  }

  /** Résout UNIQUEMENT après complete, rejette après abort : pas de succès partiel. */
  async runTransaction(stores: readonly LibraryStore[], mode: IDBTransactionMode, work: (context: LibraryTransaction) => void): Promise<void> {
    if (!stores.length || stores.some(store => !LIBRARY_STORES.includes(store)) || !['readonly', 'readwrite'].includes(mode)) {
      throw new LibraryDatabaseError('invalid-data', 'Magasins ou mode de transaction invalides.');
    }
    await this.open();
    let transaction: IDBTransaction;
    try {
      if (!this.connection) throw new Error('Connexion fermée.');
      transaction = this.connection.transaction([...stores], mode);
    } catch (error) { throw asLibraryDatabaseError(error, 'transaction'); }
    return new Promise<void>((resolve, reject) => {
      let failure: unknown;
      const abort = (error?: unknown) => {
        failure ??= error ?? new LibraryDatabaseError('transaction', 'Transaction annulée explicitement.');
        try { transaction.abort(); } catch { /* Déjà annulée. */ }
      };
      transaction.addEventListener('error', event => {
        failure ??= (event.target as IDBRequest).error;
        // Ne pas dépendre de preventDefault : toute erreur doit annuler le lot.
        abort(failure);
      });
      transaction.addEventListener('abort', () => reject(asLibraryDatabaseError(failure ?? transaction.error, 'transaction')));
      transaction.addEventListener('complete', () => resolve());
      const context: LibraryTransaction = {
        store: name => transaction.objectStore(name),
        abort: () => abort(),
        request: (request, onSuccess) => {
          request.addEventListener('success', () => {
            try { if (onSuccess) synchronous(() => onSuccess(request.result)); }
            catch (error) { abort(error); }
          });
        }
      };
      try { synchronous(() => work(context)); }
      catch (error) { abort(asLibraryDatabaseError(error, 'transaction')); }
    });
  }

  async get<S extends LibraryStore>(store: S, key: IDBValidKey): Promise<LibraryStoreRecords[S] | undefined> {
    let result: LibraryStoreRecords[S] | undefined;
    await this.runTransaction([store], 'readonly', context => {
      context.request(context.store(store).get(key), value => { result = value; });
    });
    return result;
  }

  async getAll<S extends LibraryStore>(store: S, index?: string, query?: IDBValidKey | IDBKeyRange): Promise<LibraryStoreRecords[S][]> {
    let result: LibraryStoreRecords[S][] = [];
    await this.runTransaction([store], 'readonly', context => {
      const objectStore = context.store(store);
      context.request((index ? objectStore.index(index) : objectStore).getAll(query), value => { result = value; });
    });
    return result;
  }

  /** add refuse les doublons, put remplace explicitement ; toutes les opérations sont atomiques. */
  async write(operations: readonly LibraryWrite[]): Promise<void> {
    if (!operations.length) return;
    try {
      for (const operation of operations) {
        if (!LIBRARY_STORES.includes(operation.store) || !['add', 'put', 'delete'].includes(operation.operation)) throw new TypeError('Opération invalide.');
        if (operation.operation !== 'delete') validateRecord(operation.store, operation.value);
      }
    } catch (error) { throw asLibraryDatabaseError(error, 'invalid-data'); }
    await this.runTransaction([...new Set(operations.map(operation => operation.store))], 'readwrite', context => {
      for (const operation of operations) {
        const store = context.store(operation.store);
        if (operation.operation === 'delete') context.request(store.delete(operation.key));
        else context.request(store[operation.operation](operation.value));
      }
    });
  }
}
