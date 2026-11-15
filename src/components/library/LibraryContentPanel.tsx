import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContentCategory } from '../../models/ContentSource';
import type { LibraryContentId } from '../../models/Library';
import { LibraryDatabaseError } from '../../services/libraryDatabase';
import {
  LibraryQueryService, filterLibraryEntries, LIBRARY_CATEGORY_LABELS, LIBRARY_CONVERSION_LABELS
} from '../../services/libraryQuery';
import type { LibraryConversionState, LibraryEntryView } from '../../services/libraryQuery';
import EntryRenderer from '../content/EntryRenderer';
import LibraryContentManagement from './LibraryContentManagement';
import LibraryDiagnosticsPanel from './LibraryDiagnosticsPanel';

function readingError(error: unknown): string {
  if (!(error instanceof LibraryDatabaseError)) return 'Impossible de consulter la bibliothèque. Réessayez sans effacer vos données.';
  switch (error.code) {
    case 'blocked': return 'La bibliothèque est bloquée par une autre connexion. Fermez les autres onglets puis réessayez.';
    case 'version': return 'Cette version de l’application ne peut pas lire le schéma de la bibliothèque. Actualisez les onglets. Vos données sont conservées.';
    case 'invalid-data': return 'Certaines données de la bibliothèque sont illisibles. Aucune réparation ni suppression n’a été effectuée.';
    default: return 'La lecture de la bibliothèque a échoué. Vérifiez que le navigateur autorise le stockage local, puis réessayez.';
  }
}

function LibraryEntryDetails({ entry, onChanged, disabled }: { entry: LibraryEntryView; onChanged: (message: string) => void; disabled: boolean }) {
  const revision = entry.revision;
  return (
    <article className="library-content-details" aria-label={`Détails de ${entry.name}`}>
      <h3>{entry.name}</h3>
      <p>{LIBRARY_CATEGORY_LABELS[entry.category]} · {entry.bookName} · Livre canonique : <strong>{entry.bookId}</strong></p>
      <p><strong>{LIBRARY_CONVERSION_LABELS[entry.conversionState]}</strong> · {entry.status === 'active' ? 'Actif' : 'Archivé'}</p>
      {entry.issues.length > 0 && <ul className="warning">{entry.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
      <LibraryContentManagement key={entry.id} entry={entry} onChanged={onChanged} disabled={disabled} />
      <h4>Provenance originale</h4>
      {entry.origins.length ? <ul>{entry.origins.map(({ provenance, filenames }, index) => (
        <li key={index}>
          <strong>{provenance.originalName}</strong> · Source originale : {provenance.originalSource} · {provenance.provider}
          {provenance.namespace && <> · {provenance.namespace}</>}
          <br />Fichier(s) : {filenames.join(', ') || 'indisponible'}
        </li>
      ))}</ul> : <p>Provenance indisponible.</p>}
      <h4>Description originale</h4>
      {entry.originalEntry?.entries !== undefined ? <EntryRenderer entries={entry.originalEntry.entries} /> :
        entry.originalEntry?.entry !== undefined ? <EntryRenderer entries={entry.originalEntry.entry} /> : <p>Aucune description directement disponible dans cette entrée.</p>}
      {entry.conversion && <p>Convertisseur : {entry.conversion.converter.id} · version {entry.conversion.converter.version}</p>}
      {entry.conversion?.result.status === 'converted' && entry.conversion.result.warnings.length > 0 && (
        <details><summary>Avertissements de conversion</summary><ul>{entry.conversion.result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>
      )}
      <details>
        <summary>Révision active et données enregistrées</summary>
        <dl>
          <dt>Identité de bibliothèque</dt><dd><code>{entry.id}</code></dd>
          <dt>Révision active</dt><dd><code>{entry.record.activeRevision}</code></dd>
          <dt>Génération</dt><dd>{entry.record.generation}</dd>
          <dt>Révision enregistrée le</dt><dd>{revision?.createdAt ?? 'Indisponible'}</dd>
        </dl>
        <h4>Dépendances de la révision</h4>
        <pre>{JSON.stringify(revision?.dependencies ?? [], null, 2)}</pre>
        <h4>Entrée JSON originale</h4>
        <pre>{entry.originalEntry ? JSON.stringify(entry.originalEntry, null, 2) : 'Indisponible'}</pre>
        <h4>Résultat de conversion</h4>
        <pre>{entry.conversion ? JSON.stringify(entry.conversion.result, null, 2) : 'Aucune conversion enregistrée'}</pre>
      </details>
    </article>
  );
}

export default function LibraryContentPanel({ refreshToken = 0 }: { refreshToken?: number }) {
  const service = useRef<LibraryQueryService | null>(null);
  const requestNumber = useRef(0);
  const [entries, setEntries] = useState<LibraryEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<LibraryContentId | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ContentCategory | 'all'>('all');
  const [bookId, setBookId] = useState('all');
  const [status, setStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [managementMessage, setManagementMessage] = useState('');
  const [diagnosticRefreshToken, setDiagnosticRefreshToken] = useState(0);
  const [conversionState, setConversionState] = useState<LibraryConversionState | 'all'>('all');

  const refresh = useCallback(async () => {
    const currentService = service.current;
    if (!currentService) return;
    const request = ++requestNumber.current;
    setLoading(true); setError('');
    try {
      const result = await currentService.consult();
      if (request === requestNumber.current) setEntries(result);
    } catch (failure) {
      if (request === requestNumber.current) { setError(readingError(failure)); setEntries([]); }
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    service.current = new LibraryQueryService();
    void refresh();
    const onFocus = () => { void refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      requestNumber.current++;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      service.current?.close(); service.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (refreshToken > 0) void refresh();
  }, [refreshToken, refresh]);

  const filtered = filterLibraryEntries(entries, { name, category, bookId, status, conversionState });
  const selected = entries.find(entry => entry.id === selectedId);
  const books = [...new Map(entries.map(entry => [entry.bookId, entry.bookName])).entries()].sort(([a], [b]) => a.localeCompare(b));
  const bookAvailable = bookId === 'all' || books.some(([id]) => id === bookId);
  return (
    <section className="panel library-content-panel" aria-labelledby="stored-library-title" aria-busy={loading}>
      <div className="section-title">
        <div><small>CONTENUS LOCAUX</small><h2 id="stored-library-title">Bibliothèque enregistrée</h2></div>
        <button type="button" onClick={() => { void refresh(); }} disabled={loading}>Actualiser la bibliothèque</button>
      </div>
      <p className="muted">Ces contenus sont enregistrés sur ce navigateur. Le créateur ne les utilise pas encore, même lorsqu’ils sont convertis. Leur présence n’autorise aucun livre dans une campagne.</p>
      <LibraryDiagnosticsPanel refreshToken={refreshToken + diagnosticRefreshToken} />
      <div className="fields">
        <label>Rechercher par nom<input type="search" value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Catégorie<select value={category} onChange={event => setCategory(event.target.value as ContentCategory | 'all')}>
          <option value="all">Toutes les catégories</option>
          {Object.entries(LIBRARY_CATEGORY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label>Livre<select value={bookId} onChange={event => setBookId(event.target.value)}>
          <option value="all">Tous les livres</option>
          {!bookAvailable && <option value={bookId}>{bookId} — absent de cette consultation</option>}
          {books.map(([id, label]) => <option key={id} value={id}>{id} · {label}</option>)}
        </select></label>
        <label>Statut<select value={status} onChange={event => setStatus(event.target.value as typeof status)}>
          <option value="all">Tous les statuts</option><option value="active">Actifs</option><option value="archived">Archivés</option>
        </select></label>
        <label>Conversion<select value={conversionState} onChange={event => setConversionState(event.target.value as typeof conversionState)}>
          <option value="all">Tous les états de conversion</option>
          {Object.entries(LIBRARY_CONVERSION_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
      </div>
      {managementMessage && <p role="status">{managementMessage}</p>}
      {loading && <p role="status">Chargement de la bibliothèque…</p>}
      {error && <p role="alert" className="warning">{error}</p>}
      {!error && <>
        {entries.length === 0 ? !loading && <p>Aucun contenu enregistré. Sélectionnez un fichier dans le panneau d’import, puis confirmez son enregistrement pour l’ajouter à la bibliothèque.</p> : <>
          <p role="status">{filtered.length} contenu(s) affiché(s) sur {entries.length} enregistré(s).</p>
          {filtered.length === 0 && <p>Aucun contenu ne correspond aux filtres.</p>}
          <ul className="library-content-list">{filtered.map(entry => <li key={entry.id}>
            <button type="button" aria-pressed={selectedId === entry.id} onClick={() => { setSelectedId(entry.id); void refresh(); }}>
              <strong>{entry.name}</strong><br />
              {LIBRARY_CATEGORY_LABELS[entry.category]} · {entry.bookId} · {entry.status === 'active' ? 'Actif' : 'Archivé'}<br />
              Enregistré · {LIBRARY_CONVERSION_LABELS[entry.conversionState]}<br />
              <span className="muted">Source(s) originale(s) : {[...new Set(entry.origins.map(origin => origin.provenance.originalSource))].join(', ') || 'indisponible'}</span>
            </button>
          </li>)}</ul>
        </>}
        {selected && <LibraryEntryDetails entry={selected} disabled={loading} onChanged={message => { setManagementMessage(message); setDiagnosticRefreshToken(value => value + 1); void refresh(); }} />}
        {selectedId && !selected && <p role="status">Le contenu sélectionné n’est plus disponible dans cette consultation.</p>}
      </>}
    </section>
  );
}
