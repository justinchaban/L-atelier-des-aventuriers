import type { CreatorCatalogLoadState } from '../../services/creatorCatalogLoader';
import { evaluateCreatorCandidateAccess } from '../../services/libraryCreatorCatalog';
import { LIBRARY_CATEGORY_LABELS } from '../../services/libraryQuery';

const text = (value: unknown, fallback = 'Non renseigné') => typeof value === 'string' && value.trim() ? value : fallback;
const availability = {
  'preview-only': 'Consultation uniquement', stale: 'Périmé', archived: 'Archivé', missing: 'Référence manquante', invalid: 'Invalide', conflict: 'Conflit'
};

export default function ImportedCreatorCatalog({ state, allowedBooks, onRefresh }: {
  state: CreatorCatalogLoadState;
  allowedBooks: readonly string[];
  onRefresh: () => void;
}) {
  const entries = state.catalog.entries.filter(entry => entry.reference.origin === 'library');
  return <section className="panel imported-creator-catalog" aria-labelledby="imported-catalog-title" aria-busy={state.status === 'loading'}>
    <div className="section-title">
      <h2 id="imported-catalog-title">Contenus importés — consultation</h2>
      <button type="button" onClick={onRefresh}>Rafraîchir les imports</button>
    </div>
    <p>Aucun contenu importé ne peut être sélectionné. Les choix du personnage restent accessibles dans le créateur.</p>
    <div role="status" aria-live="polite">
      {state.status === 'loading' && <p>Chargement des contenus importés… Les classes natives restent disponibles.</p>}
      {state.status === 'ready' && <p>{entries.length} contenu(s) importé(s) consultable(s).</p>}
      {state.status === 'empty' && <p>Aucun contenu importé projetable dans la bibliothèque.</p>}
    </div>
    {state.status === 'error' && <p role="alert">{state.error ?? 'Le catalogue ne peut pas être chargé de façon fiable.'} Les classes natives restent disponibles.</p>}
    {state.coherent === false && <p>La cohérence du catalogue importé n’est pas garantie.</p>}
    {state.diagnostics.length > 0 && <div><h3>Diagnostics généraux</h3><ul>
      {state.diagnostics.map((diagnostic, index) => <li key={index}>
        {diagnostic.severity} · {diagnostic.code} : {diagnostic.message}
        {diagnostic.contentId && <span> · Contenu : {text(diagnostic.contentId)}</span>}
        {diagnostic.revisionHash && <span> · Révision : {text(diagnostic.revisionHash)}</span>}
        {diagnostic.path && <span> · Emplacement : {text(diagnostic.path)}</span>}
      </li>)}
    </ul></div>}
    {entries.map((entry, index) => {
      const access = evaluateCreatorCandidateAccess(entry, allowedBooks);
      return <details key={`${entry.catalogKey}:${index}`}>
        <summary>{text(entry.provenance.originalName)} · {LIBRARY_CATEGORY_LABELS[entry.category]}</summary>
        <dl>
          <dt>Livre canonique</dt><dd>{text(entry.provenance.canonicalBookId)}</dd>
          <dt>Source originale</dt><dd>{text(entry.provenance.originalSource)}</dd>
          <dt>Révision active</dt><dd>{entry.reference.origin === 'library' ? text(entry.reference.revisionHash) : 'Non renseignée'}</dd>
          <dt>Disponibilité</dt><dd>{entry.availability === 'ready' ? 'Invalide' : availability[entry.availability]}</dd>
          <dt>Campagne active</dt><dd>{access.allowedByCampaign ? 'Livre autorisé par la campagne' : 'Livre refusé par la campagne'}</dd>
        </dl>
        <p>Non sélectionnable : consultation des imports uniquement.</p>
        <ul>{access.diagnostics.map((diagnostic, diagnosticIndex) => <li key={diagnosticIndex}>
          {diagnostic.severity} · {diagnostic.code} : {diagnostic.message}
          {diagnostic.revisionHash && <span> · Révision : {text(diagnostic.revisionHash)}</span>}
          {diagnostic.path && <span> · Emplacement : {text(diagnostic.path)}</span>}
        </li>)}</ul>
        <p className="muted">Description indisponible : son interprétation n’a pas été validée pour cette consultation.</p>
      </details>;
    })}
  </section>;
}
