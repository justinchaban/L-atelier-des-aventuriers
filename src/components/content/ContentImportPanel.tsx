import { normalizeBookId } from '../../data/books';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LibraryImportSession, canSaveLibraryImport, summarizeImportPlan } from '../../services/libraryImportSession';
import type { ChangeEvent } from 'react';

import type {
  ContentParseResult,
  FeatureLink
} from '../../engine/contentImporter';

import {
  importClasses
} from '../../engine/classImporter';

import type {
  ClassImportResult
} from '../../engine/classImporter';

import type {
  ClassFeature
} from '../../models/Class';

import type {
  ContentCategory
} from '../../models/ContentSource';

import EntryRenderer from './EntryRenderer';

// ==========================================
// TYPES
// ==========================================

interface Props {
  sourceId?: string;
  onImported?: () => void;
  /** Injection optionnelle pour les tests du parcours sans dépendance au navigateur. */
  session?: LibraryImportSession;
}

type FeatureTypeFilter =
  | 'all'
  | 'class'
  | 'subclass';

type FeatureStatusFilter =
  | 'all'
  | 'resolved'
  | 'unresolved';

// ==========================================
// CONSTANTES
// ==========================================

const categoryLabels: Record<
  ContentCategory,
  string
> = {
  class: 'Classes',
  subclass: 'Sous-classes',
  classFeature: 'Capacités de classe',
  subclassFeature: 'Capacités de sous-classe',
  species: 'Espèces',
  background: 'Historiques',
  feat: 'Dons',
  spell: 'Sorts',
  equipment: 'Équipements'
};

const categoryOrder: ContentCategory[] = [
  'class',
  'subclass',
  'classFeature',
  'subclassFeature',
  'species',
  'background',
  'feat',
  'spell',
  'equipment'
];

const MAX_FEATURE_PREVIEW = 50;

// ==========================================
// UTILITAIRES
// ==========================================

function getFeatureOwnerLabel(
  link: FeatureLink
): string {
  if (link.ownerType === 'class') {
    return link.ownerName;
  }

  return `${link.className} — ${link.ownerName}`;
}

function getFeatureTypeLabel(
  link: FeatureLink
): string {
  return link.ownerType === 'class'
    ? 'Classe'
    : 'Sous-classe';
}

function getClassSources(
  analysis: ContentParseResult
): string[] {
  return Array.from(
    new Set(
      analysis.content
        .filter(
          group => group.category === 'class'
        )
        .flatMap(group => group.entries)
        .map(entry =>
          typeof entry.source === 'string'
            ? normalizeBookId(entry.source)
            : ''
        )
        .filter(Boolean)
    )
  ).sort();
}

// ==========================================
// DESCRIPTION D'UNE CAPACITÉ
// ==========================================

interface FeatureDetailsProps {
  feature: ClassFeature;
  fallbackBookId: string;
}

function FeatureDetails({
  feature,
  fallbackBookId
}: FeatureDetailsProps) {
  const structuredEntries =
    feature.structuredEntries ?? [];

  const hasStructuredDescription =
    Array.isArray(structuredEntries) &&
    structuredEntries.length > 0;

  const hasFallbackDescription =
    feature.description.trim().length > 0;

  return (
    <details
      className="content-feature-details"
      style={{
        marginBottom: '8px'
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          padding: '6px 0'
        }}
      >
        <strong>
          Niveau {feature.levelRequired}
          {' — '}
          {feature.name}
        </strong>

        {' '}

        <span className="muted">
          ({feature.bookId ?? fallbackBookId})
        </span>
      </summary>

      <div
        className="content-feature-description"
        style={{
          padding: '12px 16px',
          margin: '8px 0 12px 16px',
          borderLeft: '2px solid currentColor',
          overflowWrap: 'anywhere',
          lineHeight: 1.6
        }}
      >
        {hasStructuredDescription ? (
          <EntryRenderer
            entries={structuredEntries}
          />
        ) : hasFallbackDescription ? (
          <EntryRenderer
            entries={feature.description}
          />
        ) : (
          <p className="muted">
            Aucune description disponible
            pour cette capacité.
          </p>
        )}

        <p
          className="muted"
          style={{
            marginTop: '12px',
            fontSize: '0.85em'
          }}
        >
          Source :{' '}
          {feature.importMetadata?.originalSource ??
            feature.bookId ??
            fallbackBookId}
        </p>
      </div>
    </details>
  );
}

// ==========================================
// LISTE DES CAPACITÉS
// ==========================================

interface FeatureListProps {
  features: ClassFeature[];
  fallbackBookId: string;
}

function FeatureList({
  features,
  fallbackBookId
}: FeatureListProps) {
  if (features.length === 0) {
    return (
      <p className="muted">
        Aucune capacité convertie.
      </p>
    );
  }

  return (
    <div className="content-feature-list">
      {features.map(feature => (
        <FeatureDetails
          key={feature.id}
          feature={feature}
          fallbackBookId={fallbackBookId}
        />
      ))}
    </div>
  );
}

// ==========================================
// COMPOSANT PRINCIPAL
// ==========================================

export default function ContentImportPanel({
  sourceId = 'local-import',
  onImported,
  session: providedSession
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [session] = useState(() => providedSession ?? new LibraryImportSession());
  const importState = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => () => session.close(), [session]);
  const result = importState.analysis;
  const loading = importState.phase === 'reading' || importState.phase === 'preparing';
  const saving = importState.phase === 'saving';
  const plan = importState.plan;
  const counts = plan ? summarizeImportPlan(plan) : null;

  // ========================================
  // PRÉVISUALISATION DES CLASSES
  // ========================================

  const [
    selectedClassSource,
    setSelectedClassSource
  ] = useState('XPHB');

  const [classPreview, setClassPreview] =
    useState<ClassImportResult | null>(null);

  // ========================================
  // FILTRES DES CAPACITÉS
  // ========================================

  const [bookFilter, setBookFilter] =
    useState('all');

  const [typeFilter, setTypeFilter] =
    useState<FeatureTypeFilter>('all');

  const [statusFilter, setStatusFilter] =
    useState<FeatureStatusFilter>('all');

  // ========================================
  // SÉLECTION DU FICHIER
  // ========================================

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const control = event.currentTarget;
    const file = control.files?.[0];
    if (!file || loading || saving) return;
    setClassPreview(null);
    setBookFilter('all'); setTypeFilter('all'); setStatusFilter('all');
    const analysis = await session.selectFile(file, sourceId);
    if (analysis) {
      const sources = getClassSources(analysis);
      setSelectedClassSource(sources.includes('XPHB') ? 'XPHB' : sources[0] ?? 'XPHB');
    }
    control.value = '';
  }

  async function handleSave() {
    const outcome = await session.save();
    if (outcome?.success) onImported?.();
  }


  // ========================================
  // SÉLECTEUR DE FICHIER
  // ========================================

  function openFileSelector() {
    fileInputRef.current?.click();
  }

  // ========================================
  // SOURCES DISPONIBLES
  // ========================================

  const availableSources = result
    ? Array.from(
        new Set(
          result.featureLinks.map(
            link => link.featureSource
          )
        )
      ).sort()
    : [];

  const classSources = result
    ? getClassSources(result)
    : [];

  // ========================================
  // FILTRAGE DES CAPACITÉS
  // ========================================

  const filteredFeatures = result
    ? result.featureLinks.filter(link => {
        if (
          bookFilter !== 'all' &&
          link.featureSource !== bookFilter
        ) {
          return false;
        }

        if (
          typeFilter !== 'all' &&
          link.ownerType !== typeFilter
        ) {
          return false;
        }

        if (
          statusFilter === 'resolved' &&
          !link.resolved
        ) {
          return false;
        }

        if (
          statusFilter === 'unresolved' &&
          link.resolved
        ) {
          return false;
        }

        return true;
      })
    : [];

  const previewFeatures =
    filteredFeatures.slice(
      0,
      MAX_FEATURE_PREVIEW
    );

  // ========================================
  // CONVERSION DES CLASSES
  // ========================================

  function handleClassPreview() {
    if (!result || !result.success) {
      return;
    }

    const converted = importClasses(
      result,
      selectedClassSource
    );

    setClassPreview(converted);
  }

  // ========================================
  // AFFICHAGE
  // ========================================

  return (
    <section className="panel content-import-panel">

      <div className="section-title">
        <div>
          <small>
            BIBLIOTHÈQUE DE CONTENU
          </small>

          <h2>
            Analyser des données JSON
          </h2>
        </div>
      </div>

      <p className="muted">
        Sélectionnez un fichier JSON pour
        identifier les catégories de contenu,
        leurs livres d'origine et les relations
        entre les capacités.
      </p>

      {/* ====================================
          IMPORT DU FICHIER
      ==================================== */}

      <div className="fields">

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          disabled={loading || saving}
          style={{ display: 'none' }}
          aria-label="Sélectionner un fichier JSON"
        />

        <button
          type="button"
          className="primary"
          onClick={openFileSelector}
          disabled={loading || saving}
        >
          {loading
            ? 'Analyse en cours...'
            : 'Choisir un fichier JSON'}
        </button>

      </div>

      {loading && <p role="status">{importState.phase === 'reading' ? 'Lecture et analyse du fichier…' : 'Préparation du plan d’import…'}</p>}
      {importState.message && <p role={importState.phase === 'success' ? 'status' : 'alert'} className={importState.phase === 'success' ? '' : 'warning'}>{importState.message}</p>}
      {result?.success && <button type="button" disabled={loading || saving} onClick={() => { void session.reanalyze(); }}>Réanalyser le fichier</button>}

      {plan && counts && (
        <section className="library-import-confirmation" aria-labelledby="library-import-confirm-title" aria-busy={saving}>
          <h3 id="library-import-confirm-title">Confirmer l’enregistrement</h3>
          <p>{counts.created} nouveau(x) · {counts.unchanged} identique(s) · {counts.updated} modifié(s) · {counts.conflicts} conflit(s)</p>
          {plan.alreadyImported && <p>Ce fichier a déjà été importé. Ses contenus ne seront pas dupliqués.</p>}
          {!plan.alreadyImported && counts.unchanged > 0 && <p>Les contenus identiques sont déjà enregistrés et ne seront pas dupliqués.</p>}
          <p className="muted">Aucun enregistrement n’est effectué avant votre confirmation. Le fichier original et sa provenance seront conservés sur ce navigateur.</p>
          {counts.unidentified > 0 && <p className="warning">{counts.unidentified} entrée(s) sans identité suffisante : elles seront conservées dans le fichier original, sans devenir des contenus sélectionnables.</p>}
          {counts.conflicts > 0 && <div role="alert" className="warning">
            <p>Des définitions contradictoires bloquent l’enregistrement du fichier entier. Corrigez le fichier puis sélectionnez-le à nouveau.</p>
            <ul>{plan.decisions.flatMap((decision, index) => decision.kind === 'conflict' ? <li key={index}>{decision.identity.normalizedName} · {decision.identity.bookId} : {decision.issues.join(' ')}</li> : [])}</ul>
          </div>}
          {counts.updated > 0 && <fieldset disabled={saving || importState.phase === 'stale' || importState.phase === 'success'}>
            <legend>Autoriser explicitement les mises à jour</legend>
            <p>Chaque case autorise le remplacement de la révision active du contenu indiqué. Les anciennes révisions seront conservées. Sans accord pour toutes les modifications, le lot entier reste non enregistré.</p>
            {plan.decisions.flatMap(decision => decision.kind === 'update' ? (
              <label className="library-import-approval" key={decision.identity.id}>
                <input type="checkbox" checked={importState.acceptedUpdates.includes(decision.identity.id)} onChange={event => session.acceptUpdate(decision.identity.id, event.target.checked)} />
                J’autorise la mise à jour de {plan.items.find(item => item.identity.id === decision.identity.id)?.revision.origins[0]?.originalName ?? decision.identity.normalizedName} ({decision.identity.bookId}).
              </label>
            ) : [])}
          </fieldset>}
          {plan.issues.length > 0 && <details><summary>Diagnostics du plan d’import ({plan.issues.length})</summary><ul>{plan.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}
          {importState.outcome && !importState.outcome.success && <details><summary>Détails de l’échec</summary><ul>{importState.outcome.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}
          <button type="button" className="primary" disabled={!canSaveLibraryImport(importState)} onClick={() => { void handleSave(); }}>
            {saving ? 'Enregistrement en cours…' : 'Enregistrer dans la bibliothèque'}
          </button>
          {saving && <p role="status">Enregistrement en cours. Le succès sera confirmé à la fin de la transaction.</p>}
        </section>
      )}

      {/* ====================================
          RÉSULTATS DE L'ANALYSE
      ==================================== */}

      {result && (
        <div className="content-import-results">

          <h3>Rapport d'analyse</h3>

          <p>
            <strong>Fichier :</strong>{' '}
            {result.filename}
          </p>

          <p>
            <strong>Statut :</strong>{' '}
            {result.success
              ? 'Analyse terminée'
              : 'Analyse échouée'}
          </p>

          {/* ================================
              STATISTIQUES
          ================================ */}

          <div className="ability-score-grid">

            <div className="ability-score-card">
              <strong>
                {result.analyzed}
              </strong>

              <p className="muted">
                Entrées analysées
              </p>
            </div>

            <div className="ability-score-card">
              <strong>
                {result.report.skipped}
              </strong>

              <p className="muted">
                Entrées ignorées
              </p>
            </div>

            <div className="ability-score-card">
              <strong>
                {result.books.length}
              </strong>

              <p className="muted">
                Sources détectées
              </p>
            </div>

            <div className="ability-score-card">
              <strong>
                {result.report.imported}
              </strong>

              <p className="muted">
                Entrées intégrées
              </p>
            </div>

            <div className="ability-score-card">
              <strong>
                {result.resolvedFeatures}
              </strong>

              <p className="muted">
                Capacités résolues
              </p>
            </div>

            <div className="ability-score-card">
              <strong>
                {result.unresolvedFeatures}
              </strong>

              <p className="muted">
                Capacités non résolues
              </p>
            </div>

          </div>

          {/* ================================
              CATÉGORIES
          ================================ */}

          {result.content.length > 0 && (
            <>
              <h4>
                Catégories détectées
              </h4>

              <ul>
                {result.content.map(group => (
                  <li key={group.originalKey}>
                    <strong>
                      {categoryLabels[group.category]}
                    </strong>

                    {' — '}

                    {group.entries.length}
                    {' entrée(s)'}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* ================================
              LIVRES
          ================================ */}

          {result.books.length > 0 && (
            <>
              <h4>
                Livres et sources détectés
              </h4>

              <div className="book-list">

                {result.books.map(book => (
                  <div key={book.sourceCode}>

                    <div>
                      <strong>
                        {book.bookName ??
                          'Source inconnue'}
                      </strong>

                      <p className="muted">
                        Code : {book.sourceCode}
                      </p>

                      <p className="muted">
                        {categoryOrder
                          .filter(
                            category =>
                              (book.categories[
                                category
                              ] ?? 0) > 0
                          )
                          .map(
                            category =>
                              `${categoryLabels[category]} : ` +
                              `${book.categories[category]}`
                          )
                          .join(' · ')}
                      </p>
                    </div>

                    <strong>
                      {book.total}
                      {' entrée(s)'}
                    </strong>

                  </div>
                ))}

              </div>
            </>
          )}

          {/* ================================
              RELATIONS ENTRE CAPACITÉS
          ================================ */}

          {result.featureLinks.length > 0 && (
            <>
              <h4>
                Relations entre les capacités
              </h4>

              <p className="muted">
                {result.featureLinks.length}
                {' référence(s) détectée(s). '}
                Une capacité est résolue lorsque
                sa définition correspondante
                est retrouvée sans ambiguïté.
              </p>

              {/* FILTRES */}

              <div className="fields">

                <label>
                  Livre de la capacité

                  <select
                    value={bookFilter}
                    onChange={event =>
                      setBookFilter(
                        event.target.value
                      )
                    }
                  >
                    <option value="all">
                      Toutes les sources
                    </option>

                    {availableSources.map(source => (
                      <option
                        key={source}
                        value={source}
                      >
                        {source}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Type

                  <select
                    value={typeFilter}
                    onChange={event =>
                      setTypeFilter(
                        event.target.value as
                          FeatureTypeFilter
                      )
                    }
                  >
                    <option value="all">
                      Tous les types
                    </option>

                    <option value="class">
                      Capacités de classe
                    </option>

                    <option value="subclass">
                      Capacités de sous-classe
                    </option>
                  </select>
                </label>

                <label>
                  Statut

                  <select
                    value={statusFilter}
                    onChange={event =>
                      setStatusFilter(
                        event.target.value as
                          FeatureStatusFilter
                      )
                    }
                  >
                    <option value="all">
                      Tous les statuts
                    </option>

                    <option value="resolved">
                      Résolues
                    </option>

                    <option value="unresolved">
                      Non résolues
                    </option>
                  </select>
                </label>

              </div>

              <p className="muted">
                {filteredFeatures.length}
                {' résultat(s) correspondant aux filtres.'}
              </p>

              {/* TABLEAU */}

              {previewFeatures.length > 0 ? (
                <div
                  style={{
                    overflowX: 'auto'
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse'
                    }}
                  >
                    <thead>
                      <tr>
                        <th scope="col">
                          Capacité
                        </th>

                        <th scope="col">
                          Classe / Sous-classe
                        </th>

                        <th scope="col">
                          Type
                        </th>

                        <th scope="col">
                          Niveau
                        </th>

                        <th scope="col">
                          Source
                        </th>

                        <th scope="col">
                          Statut
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {previewFeatures.map(
                        (link, index) => (
                          <tr
                            key={
                              `${link.ownerSource}-` +
                              `${link.reference}-${index}`
                            }
                          >
                            <td>
                              {link.featureName}
                            </td>

                            <td>
                              {getFeatureOwnerLabel(link)}
                            </td>

                            <td>
                              {getFeatureTypeLabel(link)}
                            </td>

                            <td>
                              {link.level}
                            </td>

                            <td>
                              {link.featureSource}
                            </td>

                            <td>
                              {link.resolved
                                ? 'Résolue'
                                : 'Non résolue'}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">
                  Aucune capacité ne correspond
                  aux filtres sélectionnés.
                </p>
              )}

              {filteredFeatures.length >
                MAX_FEATURE_PREVIEW && (
                <p className="muted">
                  Affichage limité aux{' '}
                  {MAX_FEATURE_PREVIEW}
                  {' premières références sur '}
                  {filteredFeatures.length}.
                </p>
              )}
            </>
          )}

          {/* ================================
              PRÉVISUALISATION DES CLASSES
          ================================ */}

          {result.success &&
            classSources.length > 0 && (

            <div className="content-class-preview">

              <h4>
                Prévisualisation des classes
              </h4>

              <p className="muted">
                Convertir les classes détectées
                sans les enregistrer automatiquement dans la bibliothèque.
                Les sous-classes utilisant _copy
                sont reconstruites lorsque leurs
                références sont disponibles et
                compatibles avec le convertisseur.
              </p>

              <div className="fields">

                <label>
                  Livre de la classe

                  <select
                    value={selectedClassSource}
                    onChange={event => {
                      setSelectedClassSource(
                        event.target.value
                      );

                      setClassPreview(null);
                    }}
                  >
                    {classSources.map(source => (
                      <option
                        key={source}
                        value={source}
                      >
                        {source}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="primary"
                  onClick={handleClassPreview}
                >
                  Prévisualiser les classes
                </button>

              </div>

              {/* RÉSULTATS DE CONVERSION */}

              {classPreview && (
                <div className="content-class-preview-results">

                  <div className="ability-score-grid">

                    <div className="ability-score-card">
                      <strong>
                        {classPreview.importedClasses}
                      </strong>

                      <p className="muted">
                        Classes converties
                      </p>
                    </div>

                    <div className="ability-score-card">
                      <strong>
                        {classPreview.importedSubclasses}
                      </strong>

                      <p className="muted">
                        Sous-classes converties
                      </p>
                    </div>

                    <div className="ability-score-card">
                      <strong>
                        {classPreview.skippedSubclasses}
                      </strong>

                      <p className="muted">
                        Sous-classes ignorées
                      </p>
                    </div>

                  </div>

                  {/* CLASSES */}

                  {classPreview.classes.map(
                    characterClass => (

                    <div key={characterClass.id}>

                      <h4>
                        {characterClass.name}
                        {' — '}
                        {characterClass.bookId}
                      </h4>

                      <p>
                        <strong>
                          Édition :
                        </strong>{' '}
                        {characterClass.ruleset}
                        {' · '}
                        <strong>
                          Dé de vie :
                        </strong>{' '}
                        d{characterClass.hitDie}
                        {' · '}
                        <strong>
                          Niveau de sous-classe :
                        </strong>{' '}
                        {characterClass.subclassLevel}
                      </p>

                      <p>
                        <strong>
                          Caractéristiques principales :
                        </strong>{' '}
                        {characterClass.primaryAbilities.join(', ')
                          || 'Non renseignées'}
                      </p>

                      <p>
                        <strong>
                          Jets de sauvegarde :
                        </strong>{' '}
                        {characterClass.savingThrows.join(', ')
                          || 'Non renseignés'}
                      </p>

                      <p>
                        <strong>
                          Maîtrises :
                        </strong>{' '}
                        {characterClass.proficiencies
                          .map(
                            proficiency =>
                              `${proficiency.type}: ` +
                              proficiency.id
                          )
                          .join(' · ')
                          || 'Non renseignées'}
                      </p>

                      {characterClass.skillChoices && (
                        <p>
                          <strong>
                            Compétences :
                          </strong>{' '}
                          Choisir{' '}
                          {characterClass.skillChoices.count}
                          {' parmi '}
                          {characterClass.skillChoices.options
                            .map(option => option.name)
                            .join(', ')}
                        </p>
                      )}

                      {/* CAPACITÉS DE CLASSE */}

                      <h4>
                        Capacités de classe
                        {' ('}
                        {characterClass.features.length}
                        {')'}
                      </h4>

                      <p className="muted">
                        Cliquez sur une capacité pour
                        consulter sa description.
                      </p>

                      <FeatureList
                        features={characterClass.features}
                        fallbackBookId={characterClass.bookId}
                      />

                      {/* SOUS-CLASSES */}

                      <h4>
                        Sous-classes
                        {' ('}
                        {characterClass.subclasses.length}
                        {')'}
                      </h4>

                      {characterClass.subclasses.length > 0 ? (
                        <div className="content-subclass-list">

                          {characterClass.subclasses.map(
                            subclass => (

                            <details
                              key={subclass.id}
                              className="content-subclass-details"
                              style={{
                                marginBottom: '12px'
                              }}
                            >
                              <summary
                                style={{
                                  cursor: 'pointer',
                                  padding: '8px 0'
                                }}
                              >
                                <strong>
                                  {subclass.name}
                                  {' ('}
                                  {subclass.bookId}
                                  {')'}
                                </strong>

                                {' — '}

                                {subclass.features.length}
                                {' capacité(s)'}
                              </summary>

                              <div
                                style={{
                                  paddingLeft: '20px'
                                }}
                              >
                                <p className="muted">
                                  Édition d'origine :{' '}
                                  {subclass.ruleset}
                                </p>

                                <FeatureList
                                  features={subclass.features}
                                  fallbackBookId={subclass.bookId}
                                />
                              </div>

                            </details>
                          ))}

                        </div>
                      ) : (
                        <p className="muted">
                          Aucune sous-classe convertie.
                        </p>
                      )}

                    </div>
                  ))}

                  {/* AVERTISSEMENTS DE CONVERSION */}

                  {classPreview.warnings.length > 0 && (
                    <div className="content-import-warnings">

                      <h4>
                        Avertissements de conversion
                      </h4>

                      <ul>
                        {classPreview.warnings.map(
                          (warning, index) => (
                            <li key={index}>
                              {warning}
                            </li>
                          )
                        )}
                      </ul>

                    </div>
                  )}

                  {/* ERREURS DE CONVERSION */}

                  {classPreview.errors.length > 0 && (
                    <div
                      className="content-import-errors"
                      role="alert"
                    >

                      <h4>
                        Erreurs de conversion
                      </h4>

                      <ul>
                        {classPreview.errors.map(
                          (error, index) => (
                            <li key={index}>
                              {error}
                            </li>
                          )
                        )}
                      </ul>

                    </div>
                  )}

                  <p className="muted">Cette prévisualisation ne déclenche aucun enregistrement. La confirmation est disponible dans le plan d’import.</p>

                </div>
              )}

            </div>
          )}

          {/* ================================
              AVERTISSEMENTS D'ANALYSE
          ================================ */}

          {result.report.warnings.length > 0 && (
            <div className="content-import-warnings">

              <h4>
                Avertissements
              </h4>

              <ul>
                {result.report.warnings.map(
                  (warning, index) => (
                    <li key={index}>
                      {warning}
                    </li>
                  )
                )}
              </ul>

            </div>
          )}

          {/* ================================
              ERREURS D'ANALYSE
          ================================ */}

          {result.report.errors.length > 0 && (
            <div
              className="content-import-errors"
              role="alert"
            >

              <h4>
                Erreurs
              </h4>

              <ul>
                {result.report.errors.map(
                  (error, index) => (
                    <li key={index}>
                      {error}
                    </li>
                  )
                )}
              </ul>

            </div>
          )}

          {/* ================================
              INFORMATION
          ================================ */}

          {result.success && (
            <p className="muted">
              {importState.phase === 'success'
                ? 'Le fichier a été enregistré dans la bibliothèque. Le créateur n’utilise pas encore les contenus importés.'
                : 'Les données sont analysées. Aucun contenu de ce fichier ne sera enregistré sans confirmation explicite.'}
            </p>
          )}

        </div>
      )}

    </section>
  );
}
