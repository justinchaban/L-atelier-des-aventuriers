import type { LibraryCommitResult, LibraryContentId, LibraryContentRecord, LibraryConversion, LibraryProvenance, LibraryRevision } from '../models/Library';
import { prepareLibraryImport, librarySnapshotToken } from '../engine/libraryImport';
import type { LibraryImportInput, LibraryPreparedImport, LibrarySnapshot } from '../engine/libraryImport';
import { serializeLibraryJson } from '../engine/libraryIdentity';
import { LibraryDatabase, LibraryDatabaseError, LIBRARY_STORES } from './libraryDatabase';
import type { LibraryDatabaseErrorCode, LibraryTransaction } from './libraryDatabase';

export type LibraryRepositoryCommitResult = LibraryCommitResult & { storageCode?: LibraryDatabaseErrorCode };
export interface LibraryImportApproval {
  /** Liste exacte des identités dont la mise à jour a été explicitement acceptée. */
  acceptedUpdates?: readonly LibraryContentId[];
}

function readSnapshot(context: LibraryTransaction, complete: (snapshot: LibrarySnapshot) => void): void {
  const snapshot: LibrarySnapshot = { imports: [], contents: [], revisions: [], dependencies: [] };
  let remaining = LIBRARY_STORES.length;
  for (const store of LIBRARY_STORES) context.request(context.store(store).getAll(), records => {
    // Chaque résultat provient du magasin désigné ; un seul snapshot transactionnel.
    (snapshot[store] as unknown[]) = records;
    if (--remaining === 0) complete(snapshot);
  });
}

export async function readLibrarySnapshot(database: LibraryDatabase): Promise<LibrarySnapshot> {
  let snapshot!: LibrarySnapshot;
  await database.runTransaction(LIBRARY_STORES, 'readonly', context => {
    readSnapshot(context, result => { snapshot = result; });
  });
  return snapshot;
}
function unique<T>(values: T[]): T[] {
  return [...new Map(values.map(value => [serializeLibraryJson(value), value])).values()];
}
function mergeConversions(previous: LibraryConversion[], incoming: LibraryConversion[]): LibraryConversion[] {
  const versions = new Map(previous.map(item => [serializeLibraryJson(item.converter), item]));
  for (const conversion of incoming) versions.set(serializeLibraryJson(conversion.converter), conversion);
  return [...versions.values()];
}
function putIfChanged(context: LibraryTransaction, store: 'imports' | 'contents' | 'revisions', current: unknown, next: unknown): void {
  if (current === undefined) context.request(context.store(store).add(next));
  else if (serializeLibraryJson(current) !== serializeLibraryJson(next)) context.request(context.store(store).put(next));
}

/** Repository sans React : prepareImport est en lecture seule ; commitImport confirme le lot entier. */
export class LibraryRepository {
  private readonly plans = new WeakSet<LibraryPreparedImport>();
  constructor(public readonly database: LibraryDatabase = new LibraryDatabase()) {}

  async prepareImport(input: LibraryImportInput): Promise<LibraryPreparedImport> {
    const captured = { ...input };
    const plan = await prepareLibraryImport(captured, await readLibrarySnapshot(this.database));
    this.plans.add(plan);
    return plan;
  }

  /**
   * Accepte seulement les plans immuables préparés par cette instance.
   * Après rechargement ou erreur concurrente, recalculer le plan et redemander les accords.
   */
  async commitImport(plan: LibraryPreparedImport, approval: LibraryImportApproval = {}): Promise<LibraryRepositoryCommitResult> {
    const invalid = (message: string): LibraryRepositoryCommitResult => ({ success: false, reason: 'invalid-data', issues: [message] });
    if (!this.plans.has(plan)) return invalid('Plan inconnu ou modifié : recalculer le plan avec ce repository.');
    if (plan.decisions.some(decision => decision.kind === 'conflict')) return invalid('Définitions contradictoires : aucun contenu ni fichier enregistré.');
    const updates = plan.decisions.flatMap(decision => decision.kind === 'update' ? [decision] : []);
    const accepted = new Set(approval.acceptedUpdates ?? []);
    if (updates.some(decision => !accepted.has(decision.identity.id)) || [...accepted].some(id => !updates.some(decision => decision.identity.id === id))) {
      return invalid('Chaque mise à jour doit être explicitement acceptée pour ce plan. Aucun enregistrement effectué.');
    }
    let result: LibraryRepositoryCommitResult = { success: false, reason: 'storage-error', issues: ['Transaction non terminée.'] };
    try {
      await this.database.runTransaction(LIBRARY_STORES, 'readwrite', context => {
        readSnapshot(context, current => {
          // La transaction readwrite verrouille les quatre magasins avant ces vérifications.
          if (librarySnapshotToken(current) !== plan.expectedSnapshot) {
            result = { success: false, reason: 'concurrent-change', issues: ['La bibliothèque a changé depuis la préparation. Recalculer le plan et renouveler les accords.'] };
            context.abort(); return;
          }
          const contents = new Map(current.contents.map(item => [item.identity.id, item]));
          for (const decision of plan.decisions) {
            if (!('expectation' in decision)) continue;
            const actual = contents.get(decision.identity.id);
            const expected = decision.expectation.expected;
            if (expected === null ? actual !== undefined : !actual || actual.activeRevision !== expected.revisionHash || actual.generation !== expected.generation) {
              result = { success: false, reason: 'concurrent-change', issues: ['État attendu non satisfait : recalculer le plan.'] };
              context.abort(); return;
            }
          }
          const stored = current.imports.find(item => item.id === plan.importId);
          if (stored && stored.originalText !== plan.document.originalText) {
            result = invalid('Collision de fichier original : enregistrement refusé.'); context.abort(); return;
          }
          const document = stored ? { ...stored, filenames: [...new Set([...stored.filenames, ...plan.document.filenames])] } : plan.document;
          putIfChanged(context, 'imports', stored, document);
          const revisions = new Map(current.revisions.map(item => [serializeLibraryJson([item.contentId, item.revisionHash]), item]));
          const changes = new Map(plan.decisions.filter(decision => 'identity' in decision).map(decision => ['identity' in decision ? decision.identity.id : '', decision]));
          for (const item of plan.items) {
            const id = item.identity.id;
            const decision = changes.get(id)!;
            const previous = contents.get(id);
            const revisionKey = serializeLibraryJson([id, item.revision.revisionHash]);
            const previousRevision = revisions.get(revisionKey);
            const origins: LibraryProvenance[] = unique([...(previousRevision?.origins ?? []), ...item.revision.origins]);
            const conversions = mergeConversions(previousRevision?.conversions ?? [], item.revision.conversions ?? []);
            const revision: LibraryRevision = {
              ...item.revision, createdAt: previousRevision?.createdAt ?? item.revision.createdAt, origins, conversions
            };
            putIfChanged(context, 'revisions', previousRevision, revision);
            if (decision.kind !== 'unchanged') {
              const next: LibraryContentRecord = {
                recordVersion: 1, identity: item.identity, activeRevision: item.revision.revisionHash,
                generation: (previous?.generation ?? -1) + 1, status: previous?.status ?? 'active',
                createdAt: previous?.createdAt ?? plan.document.importedAt, updatedAt: plan.document.importedAt
              };
              putIfChanged(context, 'contents', previous, next);
            }
            // Le magasin contient les dépendances actives ; chaque révision conserve son historique.
            const oldEdges = current.dependencies.filter(edge => edge.ownerId === id);
            const newEdges = item.revision.dependencies ?? [];
            if (serializeLibraryJson(oldEdges) !== serializeLibraryJson(newEdges)) {
              for (const edge of oldEdges) context.request(context.store('dependencies').delete([edge.ownerId, edge.targetId, edge.relation]));
              for (const edge of newEdges) context.request(context.store('dependencies').add(edge));
            }
          }
          // Ce résultat ne sortira qu'après complete ; une erreur ultérieure annulera tout.
          result = { success: true, created: plan.decisions.filter(item => item.kind === 'create').length, updated: updates.length,
            unchanged: plan.decisions.filter(item => item.kind === 'unchanged').length };
        });
      });
      return result;
    } catch (error) {
      if (!result.success && result.reason !== 'storage-error') return result;
      return { success: false, reason: 'storage-error', issues: [error instanceof Error ? error.message : 'Échec du stockage.'],
        ...(error instanceof LibraryDatabaseError ? { storageCode: error.code } : {}) };
    }
  }
}
