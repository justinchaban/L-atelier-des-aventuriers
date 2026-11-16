import type { CreatorAccess, CreatorCatalog, CreatorCategory, CreatorDiagnostic, CreatorLibraryCandidate } from '../models/CreatorCatalog';
import type { LibraryContentRecord, LibraryConversion, LibraryDependency } from '../models/Library';
import type { LibrarySnapshot } from '../engine/libraryImport';
import { isLibraryConversionCurrent } from '../engine/libraryImport';
import { serializeLibraryJson } from '../engine/libraryIdentity';
import { validateLibraryBackupData, validateLibraryConversion } from '../engine/libraryBackup';
import { diagnoseLibrarySnapshot } from '../engine/libraryDiagnostics';
import { LibraryDatabase, LIBRARY_STORES, validateLibraryRecord } from './libraryDatabase';
import { readLibrarySnapshot } from './libraryRepository';
import { nativeCreatorCatalog } from '../engine/nativeCreatorCatalog';
import { getBookById } from '../data/books';
import { isJsonRecord } from '../engine/contentImporter';
import { isBookAllowed } from '../engine/restrictions';

export interface LibraryCreatorProjection {
  readonly candidates: readonly CreatorLibraryCandidate[];
  /** Entrées sans identité exploitable isolées ici, jamais dotées d'une clé inventée. */
  readonly diagnostics: readonly CreatorDiagnostic[];
  readonly coherent: boolean;
}
export interface LibraryCreatorCatalog extends CreatorCatalog {
  readonly coherent: boolean;
  readonly diagnostics: readonly CreatorDiagnostic[];
}
export class LibraryCreatorProjectionError extends Error {
  readonly coherent = false;
  readonly diagnostics: readonly CreatorDiagnostic[];
  constructor(message: string) {
    super(message);
    this.name = 'LibraryCreatorProjectionError';
    this.diagnostics = [{ code: 'projection-blocked', severity: 'error', message }];
  }
}
const detail = (error: unknown) => error instanceof Error ? error.message : 'Données invalides.';
const diagnostic = (code: string, message: string, severity: CreatorDiagnostic['severity'] = 'error'): CreatorDiagnostic => ({ code, message, severity });
const key = (id: string) => `library:v1:${JSON.stringify(['content', id])}` as const;
const categories: readonly CreatorCategory[] = ['class', 'subclass', 'classFeature', 'subclassFeature', 'species', 'background', 'feat', 'equipment'];

/** Snapshot détaché avant tout await : aucune mutation ni gel des données de l'appelant. */
export async function projectLibraryCreatorCatalog(input: unknown): Promise<LibraryCreatorProjection> {
  if (!input || typeof input !== 'object' || LIBRARY_STORES.some(store => !Array.isArray((input as Record<string, unknown>)[store]))) {
    throw new LibraryCreatorProjectionError('Catalogue bibliothèque : les quatre magasins sont requis.');
  }
  const diagnostics: CreatorDiagnostic[] = [];
  const safe: LibrarySnapshot = { imports: [], contents: [], revisions: [], dependencies: [] };
  for (const store of LIBRARY_STORES) for (const [index, value] of ((input as Record<string, unknown>)[store] as unknown[]).entries()) {
    try {
      const detached = JSON.parse(serializeLibraryJson(value));
      validateLibraryRecord(store, detached);
      (safe[store] as unknown[]).push(detached);
    } catch (error) {
      diagnostics.push({ ...diagnostic('invalid-record', `${store}[${index}] : ${detail(error)}`), path: `${store}[${index}]` });
    }
  }
  // Les doublons de clés persistantes rendent le snapshot ambigu : aucune fusion arbitraire.
  for (const store of LIBRARY_STORES) {
    const seen = new Set<string>();
    for (const item of safe[store]) {
      const id = store === 'contents' ? (item as LibraryContentRecord).identity.id : store === 'revisions' ?
        JSON.stringify([(item as LibrarySnapshot['revisions'][number]).contentId, (item as LibrarySnapshot['revisions'][number]).revisionHash]) :
        store === 'dependencies' ? JSON.stringify([(item as LibraryDependency).ownerId, (item as LibraryDependency).targetId, (item as LibraryDependency).relation]) : (item as LibrarySnapshot['imports'][number]).id;
      if (seen.has(id)) throw new LibraryCreatorProjectionError(`Catalogue bibliothèque ambigu : clé dupliquée dans ${store}.`);
      seen.add(id);
    }
  }
  // Les diagnostics existants inspectent aussi les révisions historiques et les cycles.
  // Ne jamais leur transmettre un cache de structure non validée.
  const invalidConversions = new Set<string>();
  const invalidEdges = new Set<string>();
  const derivedDiagnostics: CreatorDiagnostic[] = [];
  const rejected = (revision: LibrarySnapshot['revisions'][number], code: string, path: string, error: unknown) => {
    derivedDiagnostics.push({ ...diagnostic(code, detail(error)), contentId: revision.contentId, revisionHash: revision.revisionHash, path });
  };
  for (const revision of safe.revisions) {
    const content = safe.contents.find(item => item.identity.id === revision.contentId);
    if (revision.dependencies !== undefined) {
      if (!Array.isArray(revision.dependencies)) { invalidEdges.add(revision.contentId); rejected(revision, 'invalid-dependency', 'dependencies', new Error('Tableau de dépendances attendu.')); revision.dependencies = []; }
      else revision.dependencies = revision.dependencies.filter((edge, index) => {
        try { validateLibraryRecord('dependencies', edge); return true; }
        catch (error) { invalidEdges.add(revision.contentId); rejected(revision, 'invalid-dependency', `dependencies[${index}]`, error); return false; }
      });
    }
    if (revision.conversions !== undefined) {
      const seen = new Set<string>();
      if (!Array.isArray(revision.conversions)) { invalidConversions.add(revision.contentId); rejected(revision, 'invalid-conversion', 'conversions', new Error('Tableau de conversions attendu.')); revision.conversions = []; }
      else revision.conversions = revision.conversions.filter((conversion, index) => {
        try {
          validateLibraryConversion(conversion, content?.identity.category ?? '', revision.contentId, revision.revisionHash);
          const converterKey = serializeLibraryJson(conversion.converter);
          if (seen.has(converterKey)) throw new Error('Convertisseur dupliqué.');
          seen.add(converterKey); return true;
        } catch (error) { invalidConversions.add(revision.contentId); rejected(revision, 'invalid-conversion', `conversions[${index}]`, error); return false; }
      });
    }
  }
  const report = await diagnoseLibrarySnapshot(safe);
  const projectedIds = new Set(safe.contents.filter(item => categories.includes(item.identity.category as CreatorCategory)).map(item => item.identity.id));
  const allDiagnostics = [...report.diagnostics, ...derivedDiagnostics];
  diagnostics.push(...allDiagnostics.filter(item => !item.contentId || !projectedIds.has(item.contentId)));
  const candidates: CreatorLibraryCandidate[] = [];
  for (const content of safe.contents) {
    const id = content.identity.id;
    if (!categories.includes(content.identity.category as CreatorCategory)) {
      diagnostics.push(diagnostic('unsupported-category', `${id} : catégorie sans contrat créateur (sort).`, 'info')); continue;
    }
    const issues: CreatorDiagnostic[] = allDiagnostics.filter(item => item.contentId === id);
    issues.push(diagnostic('import-preview-only', 'P2.3 : consultation uniquement ; aucune conversion importée n’est certifiée pour la sélection.', 'info'));
    let availability: CreatorLibraryCandidate['availability'] = 'preview-only';
    const states = new Set<CreatorLibraryCandidate['availability']>();
    if (content.status === 'archived') { states.add('archived'); issues.push(diagnostic('archived-content', 'Ce contenu est archivé et ne peut pas être sélectionné.', 'info')); }
    const revision = safe.revisions.find(item => item.contentId === id && item.revisionHash === content.activeRevision);
    if (!revision) states.add('missing');
    if (invalidConversions.has(id) || invalidEdges.has(id)) {
      states.add('invalid'); issues.push(diagnostic('invalid-derived-data', 'Conversion ou dépendances enregistrées invalides (y compris historique).'));
    }
    if (revision) try {
      // Validation cryptographique et canonique par contenu, sans exiger que ses voisins soient valides.
      await validateLibraryBackupData({ imports: safe.imports.filter(document => revision.origins.some(origin => origin.location.importId === document.id)),
        contents: [content], revisions: [{ ...revision, dependencies: [], conversions: [] }], dependencies: [] });
    } catch (error) {
      states.add('invalid'); issues.push(diagnostic('invalid-provenance', error instanceof Error ? error.message : 'Provenance invalide.'));
    }
    const dependencies = [...(revision?.dependencies ?? []), ...safe.dependencies.filter(edge => edge.ownerId === id)];
    const conversions = revision?.conversions ?? [];
    const converted = conversions.filter(conversion => conversion.result.status === 'converted');
    const conversion: LibraryConversion | undefined = converted[0] ?? conversions[0];
    for (const item of conversions) {
      const messages = item.result.status === 'converted' ? item.result.warnings : item.result.issues;
      issues.push(...messages.map(message => diagnostic('conversion-detail', message, 'warning')));
    }
    dependencies.push(...conversions.flatMap(item => item.dependencies));
    if (converted.length > 1) { states.add('conflict'); issues.push(diagnostic('ambiguous-conversion', 'Plusieurs caches convertis : aucune préférence implicite.')); }
    let conversionState: CreatorLibraryCandidate['conversionState'] = invalidConversions.has(id) ? 'invalid' : !conversion ? 'absent' :
      conversion.result.status !== 'converted' || conversion.result.warnings.length ? 'partial' :
      !isLibraryConversionCurrent(conversion, safe.contents) ? 'stale' : 'converted-unverified';
    if (conversion && conversion.result.status === 'converted' && !isLibraryConversionCurrent(conversion, safe.contents)) {
      conversionState = 'stale'; states.add('stale'); issues.push(diagnostic('stale-conversion', 'Cache périmé : convertisseur ou révisions des dépendances différents.', 'warning'));
    }
    if (conversionState === 'partial') issues.push(diagnostic('partial-conversion', 'Conversion partielle ou non résolue, sans définition mécanique.', 'warning'));
    for (const edge of dependencies) {
      const target = safe.contents.find(item => item.identity.id === edge.targetId);
      if (!target || (edge.revisionHash && !safe.revisions.some(item => item.contentId === edge.targetId && item.revisionHash === edge.revisionHash))) {
        states.add('missing'); issues.push(diagnostic('missing-reference', `Cible ou révision de dépendance absente : ${edge.targetId}.`));
      } else if (target.status === 'archived' || (edge.revisionHash && target.activeRevision !== edge.revisionHash)) {
        states.add('stale'); issues.push(diagnostic('stale-dependency', 'Une dépendance est archivée ou utilise une autre révision.', 'warning'));
      }
      if (!edge.revisionHash) { states.add('missing'); issues.push(diagnostic('unresolved-dependency', 'Dépendance sans révision résolue.')); }
    }
    let ownerKey: CreatorLibraryCandidate['ownerKey'];
    if (content.identity.classOwner) {
      const owner = content.identity.classOwner;
      const owners = safe.contents.filter(item => item.identity.category === 'class' && item.identity.provider === content.identity.provider &&
        item.identity.namespace === content.identity.namespace && item.identity.normalizedName === owner.name && item.identity.bookId === owner.source);
      if (owners.length !== 1 || owners[0].status !== 'active') { states.add('missing'); issues.push(diagnostic('missing-owner', 'Classe propriétaire active introuvable.')); }
      else ownerKey = key(owners[0].identity.id);
    }
    if (content.identity.subclassOwner) {
      const owner = content.identity.subclassOwner;
      const owners = safe.contents.filter(item => item.identity.category === 'subclass' && item.identity.provider === content.identity.provider &&
        item.identity.namespace === content.identity.namespace && (item.identity.normalizedName === owner.name || dependencies.some(edge => edge.relation === 'owner' && edge.targetId === item.identity.id)) && item.identity.bookId === owner.source &&
        serializeLibraryJson(item.identity.classOwner) === serializeLibraryJson(content.identity.classOwner));
      if (owners.length !== 1 || owners[0].status !== 'active') { states.add('missing'); issues.push(diagnostic('missing-subclass-owner', 'Sous-classe propriétaire active introuvable (nom court non résolu).')); }
      else ownerKey = key(owners[0].identity.id);
    }
    if (issues.some(item => item.severity === 'error' && !item.code.startsWith('missing-'))) states.add('invalid');
    if (report.diagnostics.some(item => item.code === 'copy-cycle' && item.contentIds?.includes(id))) {
      states.add('invalid'); issues.push(diagnostic('copy-cycle', 'Ce contenu appartient à un cycle de copie dans le graphe actif.'));
    }
    if (!getBookById(content.identity.bookId)) issues.push(diagnostic('unknown-source', 'Source non référencée ; édition et compatibilité non déduites.', 'warning'));
    const origin = revision?.origins[0];
    // L'identifiant est une métadonnée de cache, jamais une activation mécanique.
    const domainId = conversion?.result.status === 'converted' ? conversion.result.payload.data.id : undefined;
    for (const state of ['invalid', 'conflict', 'archived', 'missing', 'stale', 'preview-only'] as const) if (states.has(state)) { availability = state; break; }
    candidates.push({ catalogKey: key(id), category: content.identity.category as CreatorCategory, ...(domainId ? { domainId } : {}), ...(ownerKey ? { ownerKey } : {}),
      reference: { origin: 'library', contentId: id, revisionHash: content.activeRevision, dependencies },
      provenance: { originalName: origin?.originalName ?? content.identity.normalizedName, originalSource: origin?.originalSource ?? '',
        canonicalBookId: content.identity.bookId, bookInherited: false },
      libraryStatus: content.status, conversionState, historicalRevisions: safe.revisions.filter(item => item.contentId === id && item.revisionHash !== content.activeRevision).map(item => item.revisionHash),
      availability, diagnostics: issues });
  }
  return { candidates, diagnostics, coherent: ![...diagnostics, ...candidates.flatMap(candidate => candidate.diagnostics)].some(item => item.severity === 'error') };
}

/** N'altère aucune entrée native, même en cas de collision métier. */
export function mergeLibraryCreatorCatalog(native: CreatorCatalog, projection: LibraryCreatorProjection): LibraryCreatorCatalog {
  const diagnostics = [...projection.diagnostics];
  const candidates: CreatorLibraryCandidate[] = [];
  const unavailable = ['preview-only', 'stale', 'archived', 'missing', 'invalid', 'conflict'];
  for (const value of projection.candidates) {
    try {
      const candidate = JSON.parse(serializeLibraryJson(value));
      if (!isJsonRecord(candidate) || !isJsonRecord(candidate.reference) || candidate.reference.origin !== 'library' ||
          typeof candidate.reference.contentId !== 'string' || !candidate.reference.contentId.startsWith('library:v1:') ||
          candidate.catalogKey !== key(candidate.reference.contentId) || !categories.includes(candidate.category as CreatorCategory) ||
          typeof candidate.reference.revisionHash !== 'string' || !/^sha256:v1:[a-f0-9]{64}$/.test(candidate.reference.revisionHash) ||
          !isJsonRecord(candidate.provenance) || typeof candidate.provenance.canonicalBookId !== 'string' ||
          !Array.isArray(candidate.diagnostics) || !candidate.diagnostics.every((item: unknown) => isJsonRecord(item) && typeof item.code === 'string' && typeof item.message === 'string' && ['error', 'warning', 'info'].includes(String(item.severity)))) {
        throw new Error('Identité ou origine du candidat importé non fiable.');
      }
      const unsafe = !unavailable.includes(String(candidate.availability)) || ['definition', 'validation', 'rulesProfile'].some(field => Object.hasOwn(candidate, field));
      delete candidate.definition; delete candidate.validation; delete candidate.rulesProfile;
      if (unsafe) {
        candidate.availability = 'invalid';
        candidate.diagnostics.push(diagnostic('unsafe-library-candidate', 'Candidat importé forgé : état ou définition mécanique interdits.'));
      }
      candidates.push(candidate as unknown as CreatorLibraryCandidate);
    } catch (error) { diagnostics.push(diagnostic('invalid-library-candidate', detail(error))); }
  }
  const entries = candidates.map(candidate => {
    const collisions = [...native.entries, ...candidates].filter(other => other !== candidate &&
      other.category === candidate.category && other.domainId && other.domainId === candidate.domainId);
    return collisions.length ? { ...candidate, availability: candidate.availability === 'invalid' ? 'invalid' as const : 'conflict' as const,
      diagnostics: [...candidate.diagnostics, diagnostic('domain-collision', 'Identifiant métier ambigu ; les identités restent distinctes.')] } : candidate;
  });
  return { contractVersion: native.contractVersion, categories: [...new Set([...native.categories, ...entries.map(item => item.category)])],
    entries: [...native.entries, ...entries], diagnostics,
    coherent: projection.coherent && ![...diagnostics, ...entries.flatMap(item => item.diagnostics)].some(item => item.severity === 'error') };
}

/** Seules les entrées du manifeste natif contrôlé peuvent être sélectionnées en P2.3. */
export function evaluateCreatorCandidateAccess(entry: unknown, allowedBooks: readonly string[]): CreatorAccess {
  if (!isJsonRecord(entry) || !isJsonRecord(entry.reference) || !isJsonRecord(entry.provenance) ||
      typeof entry.provenance.canonicalBookId !== 'string') {
    return { allowedByCampaign: false, selectable: false, diagnostics: [diagnostic('invalid-candidate', 'Origine ou provenance du candidat illisible.')] };
  }
  const allowedByCampaign = isBookAllowed(entry.provenance.canonicalBookId, allowedBooks);
  const native = entry.reference.origin === 'native' && nativeCreatorCatalog.entries.some(candidate => candidate === entry);
  const library = entry.reference.origin === 'library';
  const diagnostics = Array.isArray(entry.diagnostics) ? entry.diagnostics.filter((item): item is CreatorDiagnostic =>
    isJsonRecord(item) && typeof item.code === 'string' && typeof item.message === 'string' && ['error', 'warning', 'info'].includes(String(item.severity))) : [];
  return { allowedByCampaign, selectable: !library && native && allowedByCampaign && entry.availability === 'ready', diagnostics: [
    ...diagnostics, ...(!native ? [diagnostic(library ? 'import-preview-only' : 'untrusted-origin', 'Sélection réservée au manifeste natif en P2.3.', library ? 'info' : 'error')] : []),
    ...(!allowedByCampaign ? [diagnostic('campaign-denied', 'Livre non autorisé par la campagne.', 'warning')] : [])] };
}

export class LibraryCreatorCatalogService {
  constructor(private readonly database = new LibraryDatabase({ existingOnly: true })) {}
  async inspect(): Promise<LibraryCreatorProjection> { this.database.assertExistingOnly(); return projectLibraryCreatorCatalog(await readLibrarySnapshot(this.database)); }
  async load(): Promise<LibraryCreatorCatalog> { return mergeLibraryCreatorCatalog(nativeCreatorCatalog, await this.inspect()); }
  close(): void { this.database.close(); }
}
