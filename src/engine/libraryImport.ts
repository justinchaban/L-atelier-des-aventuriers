import { normalizeBookId } from '../data/books';
import { analyzeContentJson, isJsonRecord } from './contentImporter';
import type { JsonRecord } from './contentImporter';
import { importClasses } from './classImporter';
import { createLibraryIdentity, fingerprintLibraryJson, fingerprintLibraryText, normalizeLibraryName, serializeLibraryJson } from './libraryIdentity';
import type { ContentCategory, ContentProvider } from '../models/ContentSource';
import type {
  LibraryContentId, LibraryContentRecord, LibraryConversion, LibraryConverter, LibraryDependency, LibraryIdentity,
  LibraryIdentityInput, LibraryImportDocument, LibraryImportPlan, LibraryProvenance, LibraryRevision
} from '../models/Library';

export const LIBRARY_CLASS_CONVERTER = { id: 'classImporter', version: '1' } as const;
export interface LibrarySnapshot {
  imports: LibraryImportDocument[];
  contents: LibraryContentRecord[];
  revisions: LibraryRevision[];
  dependencies: LibraryDependency[];
}
export interface LibraryImportInput {
  text: string;
  filename: string;
  provider?: ContentProvider;
  namespace?: string;
}
export interface LibraryPreparedItem {
  identity: LibraryIdentity;
  revision: LibraryRevision;
}
export interface LibraryPreparedImport extends LibraryImportPlan {
  document: LibraryImportDocument;
  /** Information de préparation, non persistée. */
  alreadyImported: boolean;
  items: LibraryPreparedItem[];
  /** Comparaison synchrone dans la transaction ; aucun hash asynchrone dans IndexedDB. */
  expectedSnapshot: string;
  issues: string[];
}

/** Le résultat ne dépend pas de l'ordre des requêtes, mais de tout l'état persistant. */
export function librarySnapshotToken(snapshot: LibrarySnapshot): string {
  return serializeLibraryJson(Object.fromEntries(Object.entries(snapshot).map(([store, records]) => [
    store, [...records].sort((a, b) => {
      const first = serializeLibraryJson(a);
      const second = serializeLibraryJson(b);
      return first < second ? -1 : first > second ? 1 : 0;
    })
  ])));
}
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const owner = (name: unknown, source: unknown) => ({ name: text(name), source: text(source) });

function identityInput(entry: JsonRecord, category: ContentCategory, originalKey: string, provider: ContentProvider, namespace?: string): LibraryIdentityInput {
  return {
    provider, category, name: text(entry.name), source: text(entry.source),
    ...(namespace !== undefined ? { namespace } : {}),
    ...(['subclass', 'classFeature', 'subclassFeature'].includes(category) ? { classOwner: owner(entry.className, entry.classSource) } : {}),
    ...(category === 'subclassFeature' ? { subclassOwner: owner(entry.subclassShortName, entry.subclassSource) } : {}),
    ...(['classFeature', 'subclassFeature'].includes(category) ? { level: entry.level as number } : {}),
    ...(category === 'equipment' ? { originalKey } : {})
  };
}
function immutable<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) immutable(item);
    Object.freeze(value);
  }
  return value;
}

/** Cache périmé si une révision utilisée manque, est archivée ou a été remplacée. */
export function isLibraryConversionCurrent(conversion: LibraryConversion, contents: readonly LibraryContentRecord[], converter: LibraryConverter = LIBRARY_CLASS_CONVERTER): boolean {
  const active = contents.filter(item => item.status === 'active');
  const revisions = new Map(active.map(item => [item.identity.id, item.activeRevision]));
  const root = active.find(item => item.identity.id === conversion.contentId);
  // Une classe inclut la collection de sous-classes connues : un nouvel ajout invalide aussi son cache.
  const includesKnownSubclasses = !root || root.identity.category !== 'class' || active
    .filter(item => item.identity.category === 'subclass' && item.identity.provider === root.identity.provider &&
      item.identity.namespace === root.identity.namespace && item.identity.classOwner?.name === root.identity.normalizedName &&
      item.identity.classOwner.source === root.identity.bookId)
    .every(item => conversion.dependencies.some(edge => edge.targetId === item.identity.id));
  return includesKnownSubclasses && conversion.converter.id === converter.id && conversion.converter.version === converter.version &&
    revisions.get(conversion.contentId) === conversion.revisionHash && conversion.result.status === 'converted' &&
    conversion.dependencies.every(dependency => dependency.revisionHash !== undefined && revisions.get(dependency.targetId) === dependency.revisionHash);
}

/** Préparation sans écritures. Le fichier complet est conservé une fois, les entrées sont référencées par JSON Pointer. */
export async function prepareLibraryImport(input: LibraryImportInput, snapshot: LibrarySnapshot): Promise<LibraryPreparedImport> {
  input = { ...input }; // Figer les chaînes d'entrée avant tout await.
  if (typeof input.text !== 'string' || !text(input.filename).trim() || /[\\/]/.test(input.filename)) throw new TypeError('Texte et nom de fichier local (sans chemin) obligatoires.');
  if (input.namespace !== undefined && !text(input.namespace).trim()) throw new TypeError('Espace de noms vide.');
  const provider = input.provider ?? '5etools';
  if (!['5etools', 'srd', 'homebrew', 'custom'].includes(provider) ||
      (['homebrew', 'custom'].includes(provider) && !text(input.namespace).trim())) throw new TypeError('Fournisseur ou espace de noms invalide.');
  const analysis = analyzeContentJson(input.text, input.filename, 'library-import');
  if (!analysis.success) throw new TypeError(analysis.report.errors.join(' '));
  const raw: JsonRecord = JSON.parse(input.text);
  const importId = await fingerprintLibraryText(input.text);
  const now = new Date().toISOString();
  const issues = [...analysis.report.warnings];
  const decisions: LibraryImportPlan['decisions'] = [];
  const grouped = new Map<LibraryContentId, { identity: LibraryIdentity; versions: Map<string, { raw: JsonRecord; revision: LibraryRevision }> }>();
  // Ne pas utiliser les positions filtrées de detectContent : les pointeurs suivent le fichier EXACT.
  for (const group of analysis.content) {
    const entries = raw[group.originalKey] as unknown[];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      const pointer = `/${group.originalKey.replace(/~/g, '~0').replace(/\//g, '~1')}/${index}`;
      const location = { importId, pointer };
      const result = isJsonRecord(entry) ? createLibraryIdentity(identityInput(entry, group.category, group.originalKey, provider, input.namespace)) : null;
      if (!result?.success) {
        const problems = result && !result.success ? result.issues : ['Entrée JSON non objet.'];
        decisions.push({ kind: 'unidentified', location, issues: problems });
        issues.push(`${pointer} : ${problems.join(' ')}`);
        continue;
      }
      const original = entry as JsonRecord;
      const revisionHash = await fingerprintLibraryJson(original);
      const provenance: LibraryProvenance = {
        provider, namespace: result.identity.namespace, originalName: text(original.name), originalSource: text(original.source),
        bookId: result.identity.bookId, originalKey: group.originalKey, location
      };
      let groupEntry = grouped.get(result.identity.id);
      if (!groupEntry) { groupEntry = { identity: result.identity, versions: new Map() }; grouped.set(result.identity.id, groupEntry); }
      const existing = groupEntry.versions.get(revisionHash);
      if (existing) existing.revision.origins.push(provenance);
      else groupEntry.versions.set(revisionHash, { raw: original, revision: { recordVersion: 1, contentId: result.identity.id, revisionHash, origins: [provenance], createdAt: now } });
    }
  }
  const contents = new Map(snapshot.contents.map(item => [item.identity.id, item]));
  const items: LibraryPreparedItem[] = [];
  const raws = new Map<LibraryContentId, JsonRecord>();
  for (const [id, group] of grouped) {
    if (group.versions.size > 1) {
      decisions.push({ kind: 'conflict', identity: group.identity, revisions: [...group.versions.values()].map(item => item.revision.revisionHash), issues: ['Définitions contradictoires dans le même fichier.'] });
      continue;
    }
    const { raw: entry, revision } = [...group.versions.values()][0];
    items.push({ identity: group.identity, revision }); raws.set(id, entry);
    const current = contents.get(id);
    if (!current) decisions.push({ kind: 'create', identity: group.identity, revisionHash: revision.revisionHash, expectation: { contentId: id, expected: null } });
    else decisions.push({ kind: current.activeRevision === revision.revisionHash ? 'unchanged' : 'update', identity: group.identity, revisionHash: revision.revisionHash,
      expectation: { contentId: id, expected: { revisionHash: current.activeRevision, generation: current.generation } } });
  }

  // Reconstituer les entrées actives déjà présentes pour résoudre les références entre fichiers.
  const registry = new Map(snapshot.contents.filter(record => record.status === 'active').map(record => [record.identity.id, record.identity]));
  const documents = new Map(snapshot.imports.map(document => [document.id, document]));
  const parsedDocuments = new Map<string, unknown>();
  for (const record of snapshot.contents.filter(record => record.status === 'active' && !raws.has(record.identity.id))) {
    const revision = snapshot.revisions.find(revision => revision.contentId === record.identity.id && revision.revisionHash === record.activeRevision);
    const origin = revision?.origins[0];
    const document = origin && documents.get(origin.location.importId);
    if (!origin || !document) throw new TypeError('Bibliothèque incohérente : original de révision manquant.');
    if (!parsedDocuments.has(document.id)) parsedDocuments.set(document.id, JSON.parse(document.originalText));
    let value: unknown = parsedDocuments.get(document.id);
    if (origin.location.pointer !== '') for (const part of origin.location.pointer.slice(1).split('/')) {
      const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
      value = value && typeof value === 'object' ? (value as JsonRecord)[key] : undefined;
    }
    if (!isJsonRecord(value) || await fingerprintLibraryJson(value) !== record.activeRevision) throw new TypeError('Bibliothèque incohérente : pointeur ou révision originale invalide.');
    raws.set(record.identity.id, value);
  }
  for (const item of items) registry.set(item.identity.id, item.identity);
  // Registre projeté : utilisé uniquement pour épingler les révisions des dépendances proposées.
  const projected = new Map(snapshot.contents.filter(item => item.status === 'active').map(item => [item.identity.id, item.activeRevision]));
  for (const item of items) if (contents.get(item.identity.id)?.status !== 'archived') projected.set(item.identity.id, item.revision.revisionHash);
  const dependencyMap = new Map<LibraryContentId, LibraryDependency[]>();
  const unresolved = new Map<LibraryContentId, string[]>();
  const problem = (id: LibraryContentId, message: string) => { unresolved.set(id, [...unresolved.get(id) ?? [], message]); issues.push(message); };
  const connect = (id: LibraryContentId, targetInput: LibraryIdentityInput, relation: LibraryDependency['relation']) => {
    const target = createLibraryIdentity(targetInput);
    if (!target.success) { problem(id, `Dépendance sans identité pour ${id}.`); return; }
    const targetId = target.identity.id;
    const revisionHash = projected.get(targetId);
    const list = dependencyMap.get(id) ?? [];
    if (!list.some(item => item.targetId === targetId && item.relation === relation)) list.push({ ownerId: id, targetId, relation, ...(revisionHash ? { revisionHash } : {}) });
    dependencyMap.set(id, list);
    if (!revisionHash) problem(id, `Dépendance absente : ${targetId}.`);
  };
  const basic = (category: ContentCategory, name: unknown, source: unknown): LibraryIdentityInput => ({ provider, ...(input.namespace !== undefined ? { namespace: input.namespace } : {}), category, name: text(name), source: text(source) });
  const findSubclass = (className: string, classSource: string, name: string, source: string, requester: LibraryContentId): LibraryIdentityInput | null => {
    const matches = [...registry.values()].filter(identity => identity.category === 'subclass' && identity.bookId === normalizeBookId(source) &&
      identity.provider === provider && identity.namespace === (input.namespace?.normalize('NFC').trim() ?? '') &&
      identity.classOwner?.name === normalizeLibraryName(className) && identity.classOwner.source === normalizeBookId(classSource) &&
      [identity.normalizedName, normalizeLibraryName(text(raws.get(identity.id)?.shortName))].includes(normalizeLibraryName(name)));
    if (matches.length > 1) { problem(requester, `Propriétaire de sous-classe ambigu : ${name}.`); return null; }
    if (matches.length === 1) return identityInput(raws.get(matches[0].id)!, 'subclass', 'subclass', provider, input.namespace);
    // Sans nom long connu, l'identité de référence reste explicitement non résolue.
    return { ...basic('subclass', name, source), classOwner: owner(className, classSource) };
  };
  for (const item of items) {
    const entry = raws.get(item.identity.id)!;
    const id = item.identity.id;
    if (item.identity.classOwner) connect(id, basic('class', entry.className, entry.classSource), 'owner');
    if (item.identity.subclassOwner) {
      const target = findSubclass(text(entry.className), text(entry.classSource), text(entry.subclassShortName), text(entry.subclassSource), id);
      if (target) connect(id, target, 'owner');
    }
    if (isJsonRecord(entry._copy)) connect(id, identityInput({ ...entry, ...entry._copy }, item.identity.category, item.revision.origins[0].originalKey, provider, input.namespace), 'copy');
    if (item.identity.category === 'class') {
      for (const child of [...registry.values()].filter(child => child.category === 'subclass' && child.provider === provider && child.namespace === item.identity.namespace && child.classOwner?.name === item.identity.normalizedName && child.classOwner.source === item.identity.bookId)) {
        connect(id, identityInput(raws.get(child.id)!, 'subclass', 'subclass', provider, input.namespace), 'feature');
      }
    }
    for (const [property, category] of [['classFeatures', 'classFeature'], ['subclassFeatures', 'subclassFeature']] as const) {
      if (!Array.isArray(entry[property])) continue;
      for (const ref of entry[property] as unknown[]) {
        const reference = typeof ref === 'string' ? ref : isJsonRecord(ref) ? text(ref[category]) : '';
        const parts = reference.split('|');
        const subclass = category === 'subclassFeature';
        if (parts.length < (subclass ? 6 : 4)) { problem(id, `Référence mal formée : ${reference}.`); continue; }
        const classSource = parts[2] || 'PHB';
        connect(id, {
          ...basic(category, parts[0], parts[subclass ? 6 : 4] || (subclass ? parts[4] || 'PHB' : classSource)),
          classOwner: owner(parts[1], classSource),
          ...(subclass ? { subclassOwner: owner(parts[3], parts[4] || 'PHB') } : {}),
          level: Number(parts[subclass ? 5 : 3])
        }, 'feature');
      }
    }
  }
  // Une classe convertie incorpore ses sous-classes : épingler la fermeture des dépendances.
  const dependencyClosure = (id: LibraryContentId): LibraryDependency[] => {
    const result: LibraryDependency[] = [];
    const seen = new Set<LibraryContentId>([id]);
    const walk = (ownerId: LibraryContentId) => {
      const edges = dependencyMap.get(ownerId) ?? snapshot.dependencies.filter(edge => edge.ownerId === ownerId);
      for (const edge of edges) {
        if (!seen.has(edge.targetId)) {
          seen.add(edge.targetId);
          const hash = projected.get(edge.targetId);
          const { revisionHash: ignored, ...reference } = edge;
          void ignored;
          result.push({ ...reference, ...(hash ? { revisionHash: hash } : {}) });
          walk(edge.targetId);
        }
      }
    };
    walk(id); return result;
  };
  const conversionRaw: Record<string, JsonRecord[]> = {};
  for (const [id, identity] of [...registry].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (identity.provider !== provider || identity.namespace !== (input.namespace?.normalize('NFC').trim() ?? '')) continue;
    const key = identity.category === 'species' ? 'species' : identity.category === 'equipment' ? identity.originalKey! : identity.category;
    (conversionRaw[key] ??= []).push(raws.get(id)!);
  }
  const conversionAnalysis = analyzeContentJson(JSON.stringify(conversionRaw), input.filename, 'library-conversion');
  const convertedClasses = new Map<LibraryContentId, LibraryConversion['result']>();
  if (provider === '5etools') {
    const sources = [...new Set(items.filter(item => item.identity.category === 'class').map(item => item.identity.bookId))];
    for (const source of sources) {
      const converted = importClasses(conversionAnalysis, source);
      for (const item of items.filter(item => item.identity.category === 'class' && item.identity.bookId === source)) {
        const matches = converted.classes.filter(cls => normalizeLibraryName(cls.importMetadata?.originalName ?? cls.name) === item.identity.normalizedName);
        if (matches.length === 1 && converted.skippedSubclasses === 0) {
          // Les modèles convertis ont des propriétés optionnelles undefined, absentes du JSON dérivé.
          convertedClasses.set(item.identity.id, { status: 'converted', payload: { category: 'class', data: JSON.parse(JSON.stringify(matches[0])) }, warnings: converted.warnings });
        } else convertedClasses.set(item.identity.id, { status: 'unresolved', issues: [...converted.errors, ...converted.warnings, 'Classe non convertie sans ambiguïté.'] });
      }
    }
  }
  const compareEdges = (a: LibraryDependency, b: LibraryDependency) => {
    const first = serializeLibraryJson([a.ownerId, a.targetId, a.relation]);
    const second = serializeLibraryJson([b.ownerId, b.targetId, b.relation]);
    return first < second ? -1 : first > second ? 1 : 0;
  };
  for (const item of items) {
    const dependencies = [...dependencyMap.get(item.identity.id) ?? []].sort(compareEdges);
    item.revision.dependencies = dependencies;
    const closure = dependencyClosure(item.identity.id).sort(compareEdges);
    const relatedIssues = [item.identity.id, ...closure.map(edge => edge.targetId)].flatMap(id => unresolved.get(id) ?? []);
    const missing = closure.filter(edge => !edge.revisionHash).map(edge => `Dépendance manquante : ${edge.targetId}.`);
    const result = convertedClasses.get(item.identity.id);
    item.revision.conversions = [{
      recordVersion: 1, contentId: item.identity.id, revisionHash: item.revision.revisionHash,
      converter: result ? { ...LIBRARY_CLASS_CONVERTER } : { id: 'library-raw', version: '1' }, dependencies: closure,
      result: result ? relatedIssues.length || missing.length ? { status: 'unresolved', issues: [...relatedIssues, ...missing] } : result : { status: 'unsupported', issues: ['Entrée originale conservée ; convertisseur non disponible pour cette catégorie ou ce fournisseur.'] }
    }];
  }
  return immutable({ recordVersion: 1, importId, decisions, alreadyImported: snapshot.imports.some(document => document.id === importId), document: { recordVersion: 1, id: importId, originalText: input.text, filenames: [input.filename], importedAt: now }, items, expectedSnapshot: librarySnapshotToken(snapshot), issues });
}
