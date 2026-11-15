import { analyzeContentJson } from '../engine/contentImporter';
import type { ContentParseResult } from '../engine/contentImporter';
import type { LibraryImportInput, LibraryPreparedImport } from '../engine/libraryImport';
import type { LibraryContentId } from '../models/Library';
import { LibraryDatabaseError } from './libraryDatabase';
import { LibraryRepository } from './libraryRepository';
import type { LibraryRepositoryCommitResult } from './libraryRepository';

export type LibraryImportPhase = 'idle' | 'reading' | 'preparing' | 'confirmation' | 'saving' | 'success' | 'error' | 'stale';
export interface LibraryImportSessionState {
  phase: LibraryImportPhase;
  analysis: ContentParseResult | null;
  plan: LibraryPreparedImport | null;
  acceptedUpdates: readonly LibraryContentId[];
  message: string;
  outcome: LibraryRepositoryCommitResult | null;
}
export function summarizeImportPlan(plan: LibraryPreparedImport) {
  return {
    created: plan.decisions.filter(item => item.kind === 'create').length,
    unchanged: plan.decisions.filter(item => item.kind === 'unchanged').length,
    updated: plan.decisions.filter(item => item.kind === 'update').length,
    conflicts: plan.decisions.filter(item => item.kind === 'conflict').length,
    unidentified: plan.decisions.filter(item => item.kind === 'unidentified').length
  };
}
export function canSaveLibraryImport(state: LibraryImportSessionState): boolean {
  if (!state.plan || !['confirmation', 'error'].includes(state.phase) || !state.analysis?.success) return false;
  return state.plan.decisions.every(item => item.kind !== 'conflict' &&
    (item.kind !== 'update' || state.acceptedUpdates.includes(item.identity.id)));
}
function storageMessage(code?: string): string {
  switch (code) {
    case 'quota': return 'Espace de stockage insuffisant. Libérez de l’espace puis réessayez.';
    case 'blocked': return 'La bibliothèque est bloquée par une autre connexion. Fermez les autres onglets puis réessayez.';
    case 'version': return 'La bibliothèque utilise une version incompatible. Actualisez l’application avant de réessayer.';
    case 'invalid-data': return 'Les données ne peuvent pas être enregistrées dans leur état actuel. Réanalysez le fichier.';
    default: return 'L’opération de stockage a échoué. Vous pouvez réessayer.';
  }
}

/** Contrôleur testable sans DOM. Aucun commit lors de la sélection ou de la réanalyse. */
export class LibraryImportSession {
  private state: LibraryImportSessionState = { phase: 'idle', analysis: null, plan: null, acceptedUpdates: [], message: '', outcome: null };
  private readonly listeners = new Set<() => void>();
  private input: LibraryImportInput | null = null;
  private sourceId = 'local-import';
  private epoch = 0;
  constructor(private readonly repository = new LibraryRepository()) {}
  getSnapshot = (): LibraryImportSessionState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<LibraryImportSessionState>): void {
    const next = { ...this.state, ...patch };
    this.state = Object.freeze({ ...next, acceptedUpdates: Object.freeze([...next.acceptedUpdates]) });
    for (const listener of this.listeners) listener();
  }
  private busy(): boolean { return ['reading', 'preparing', 'saving'].includes(this.state.phase); }

  async selectFile(file: Pick<File, 'name' | 'text'>, sourceId = 'local-import'): Promise<ContentParseResult | null> {
    if (this.busy()) return null;
    const epoch = ++this.epoch;
    this.input = null; this.sourceId = sourceId;
    this.publish({ phase: 'reading', analysis: null, plan: null, acceptedUpdates: [], message: '', outcome: null });
    try {
      if (!file.name.toLowerCase().endsWith('.json')) throw new TypeError('Veuillez sélectionner un fichier JSON.');
      const filename = file.name;
      const text = await file.text();
      if (epoch !== this.epoch) return null;
      this.input = { text, filename };
      return await this.prepare(epoch);
    } catch (error) {
      if (epoch === this.epoch) this.publish({ phase: 'error', message: error instanceof Error ? error.message : 'Impossible de lire le fichier sélectionné.' });
      return null;
    }
  }

  /** Repart du texte original en mémoire ; tous les accords précédents sont effacés. */
  async reanalyze(): Promise<ContentParseResult | null> {
    if (this.busy() || !this.input) return null;
    return this.prepare(++this.epoch);
  }
  private async prepare(epoch: number): Promise<ContentParseResult | null> {
    const input = this.input!;
    const analysis = analyzeContentJson(input.text, input.filename, this.sourceId);
    this.publish({ phase: 'preparing', analysis, plan: null, acceptedUpdates: [], message: '', outcome: null });
    if (!analysis.success) {
      this.publish({ phase: 'error', message: 'L’analyse du fichier a échoué. Aucun enregistrement effectué.' });
      return analysis;
    }
    try {
      const plan = await this.repository.prepareImport(input);
      if (epoch !== this.epoch) return null;
      this.publish({ phase: 'confirmation', plan });
    } catch (error) {
      if (epoch !== this.epoch) return null;
      this.publish({ phase: 'error', message: `${storageMessage(error instanceof LibraryDatabaseError ? error.code : undefined)} L’analyse et le fichier restent conservés en mémoire.` });
    }
    return analysis;
  }

  acceptUpdate(id: LibraryContentId, accepted: boolean): void {
    if (this.busy() || !this.state.plan || !['confirmation', 'error'].includes(this.state.phase) ||
        !this.state.plan.decisions.some(item => item.kind === 'update' && item.identity.id === id)) return;
    const ids = new Set(this.state.acceptedUpdates);
    if (accepted) ids.add(id); else ids.delete(id);
    this.publish({ acceptedUpdates: Object.freeze([...ids]) });
  }

  /** Le verrou de phase est pris synchroniquement avant tout await : protège aussi les doubles clics. */
  async save(): Promise<LibraryRepositoryCommitResult | null> {
    if (!canSaveLibraryImport(this.state)) return null;
    const epoch = this.epoch;
    const plan = this.state.plan!;
    const acceptedUpdates = [...this.state.acceptedUpdates];
    this.publish({ phase: 'saving', message: '', outcome: null });
    let outcome: LibraryRepositoryCommitResult;
    try { outcome = await this.repository.commitImport(plan, { acceptedUpdates }); }
    catch (error) {
      outcome = { success: false, reason: 'storage-error', issues: [error instanceof Error ? error.message : 'Échec de transaction.'],
        ...(error instanceof LibraryDatabaseError ? { storageCode: error.code } : {}) };
    }
    if (epoch !== this.epoch) return null;
    if (outcome.success) {
      this.publish({ phase: 'success', outcome, message: `Enregistrement terminé : ${outcome.created} nouveau(x), ${outcome.updated} mis à jour, ${outcome.unchanged} identique(s).` });
    } else if (outcome.reason === 'concurrent-change') {
      this.publish({ phase: 'stale', outcome, acceptedUpdates: [], message: 'La bibliothèque a changé. Réanalysez le fichier et confirmez à nouveau les mises à jour. Aucun contenu de cet import n’a été enregistré.' });
    } else {
      this.publish({ phase: 'error', outcome, message: `${storageMessage(outcome.storageCode)} Aucun contenu de cet import n’a été enregistré. Les données analysées sont conservées.` });
    }
    return outcome;
  }

  /** Aucun effacement des données. Les transactions déjà lancées peuvent terminer après fermeture. */
  close(): void { this.epoch++; this.repository.database.close(); }
}
