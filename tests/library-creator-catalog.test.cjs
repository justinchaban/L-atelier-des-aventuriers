const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { IDBFactory } = require('fake-indexeddb');
const { LibraryDatabase } = require('../src/services/libraryDatabase.ts');
const { LibraryRepository, readLibrarySnapshot } = require('../src/services/libraryRepository.ts');
const { projectLibraryCreatorCatalog: project, mergeLibraryCreatorCatalog: merge, evaluateCreatorCandidateAccess: access, LibraryCreatorCatalogService } = require('../src/services/libraryCreatorCatalog.ts');
const { nativeCreatorCatalog: native } = require('../src/engine/nativeCreatorCatalog.ts');
const { getCreatorClasses } = require('../src/engine/creatorCatalog.ts');
const fixture = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fictive-classes.json'), 'utf8'));
const empty = () => ({ imports: [], contents: [], revisions: [], dependencies: [] });
async function setup(t, data = fixture()) {
  const factory = new IDBFactory(), db = new LibraryDatabase({ factory });
  const repo = new LibraryRepository(db);
  t.after(() => db.close());
  const seed = async value => {
    const plan = await repo.prepareImport({ text: JSON.stringify(value), filename: 'projection-fictive.json' });
    assert.equal((await repo.commitImport(plan, { acceptedUpdates: plan.decisions.filter(d => d.kind === 'update').map(d => d.identity.id) })).success, true);
  };
  await seed(data);
  return { factory, db, seed, snapshot: await readLibrarySnapshot(db) };
}
const classRevision = s => s.revisions.find(r => s.contents.find(c => c.identity.id === r.contentId)?.identity.category === 'class');

test('P2.3 bibliothèque vide et fusion native exacte', async () => {
  const p = await project(empty());
  assert.deepEqual(p.candidates, []);
  assert.equal(p.coherent, true);
  assert.deepEqual(getCreatorClasses(merge(native, p)), getCreatorClasses(native));
});

test('P2.3 conversions existantes : aucune définition ni sélection, pas de mutation', async t => {
  const { snapshot } = await setup(t);
  const before = JSON.stringify(snapshot);
  const p = await project(snapshot);
  assert.equal(p.candidates.length, snapshot.contents.length);
  assert.ok(p.candidates.some(c => c.conversionState === 'converted-unverified'));
  for (const c of p.candidates) {
    assert.notEqual(c.availability, 'ready');
    assert.equal('definition' in c, false);
    assert.equal(c.provenance.ruleset, undefined);
    assert.equal(access(c, [c.provenance.canonicalBookId]).selectable, false);
    assert.ok(c.diagnostics.some(d => d.code === 'import-preview-only'));
  }
  const merged = merge(native, p);
  assert.deepEqual(getCreatorClasses(merged), getCreatorClasses(native));
  native.entries.forEach((e, i) => assert.equal(merged.entries[i], e));
  assert.equal(JSON.stringify(snapshot), before);
});

test('P2.3 sans conversion et sources canoniques : alias distincts et inconnues sans édition', async t => {
  const { snapshot } = await setup(t, { feat: ['srd-5.2.1', 'FRHoF', 'PHB', 'XPHB', 'INCONNU-FICTIF'].map(source => ({ name: 'Éclat fictif', source, entries: ['Texte inventé.'] })) });
  snapshot.revisions.forEach(r => { delete r.conversions; });
  const p = await project(snapshot);
  assert.deepEqual(p.candidates.map(c => c.provenance.canonicalBookId).sort(), ['XSRD','FRHOF','PHB','XPHB','INCONNU-FICTIF'].sort());
  assert.ok(p.candidates.every(c => c.availability === 'preview-only' && c.conversionState === 'absent' && c.domainId === undefined));
  const unknown = p.candidates.find(c => c.provenance.canonicalBookId === 'INCONNU-FICTIF');
  assert.ok(unknown.diagnostics.some(d => d.code === 'unknown-source'));
  assert.equal(access(unknown, ['XSRD']).allowedByCampaign, false);
  assert.equal(access(unknown, ['inconnu-fictif']).allowedByCampaign, true);
  assert.equal(access(p.candidates.find(c => c.provenance.canonicalBookId === 'XSRD'), ['srd-5.2.1']).allowedByCampaign, true);
});

test('P2.3 conversion partielle, invalide et périmée', async t => {
  const { snapshot } = await setup(t);
  const revision = classRevision(snapshot), id = revision.contentId;
  revision.conversions[0].result.warnings.push('Mécanique fictive non couverte.');
  let candidate = (await project(snapshot)).candidates.find(c => c.reference.contentId === id);
  assert.equal(candidate.conversionState, 'partial');
  revision.conversions[0].converter.version = 'obsolete';
  candidate = (await project(snapshot)).candidates.find(c => c.reference.contentId === id);
  assert.equal(candidate.availability, 'stale');
  revision.conversions[0].result.payload.data.hitDie = 'invalide';
  candidate = (await project(snapshot)).candidates.find(c => c.reference.contentId === id);
  assert.equal(candidate.availability, 'invalid');
  assert.equal(candidate.conversionState, 'invalid');
});

test('P2.3 révision active ancienne conservée et historique exposé', async t => {
  const first = { feat: [{ name: 'Sceau fictif', source: 'FICTIF', entries: ['Version ancienne.'] }] };
  const { db, seed, snapshot } = await setup(t, first);
  const old = snapshot.contents[0].activeRevision;
  await seed({ feat: [{ ...first.feat[0], entries: ['Version nouvelle.'] }] });
  const current = await readLibrarySnapshot(db);
  const latest = current.contents[0].activeRevision;
  current.contents[0].activeRevision = old;
  const candidate = (await project(current)).candidates[0];
  assert.equal(candidate.reference.revisionHash, old);
  assert.deepEqual(candidate.historicalRevisions, [latest]);
  assert.equal(candidate.availability, 'preview-only');
});

test('P2.3 archive prioritaire sur cache périmé et révision active absente', async t => {
  const { snapshot } = await setup(t);
  const record = snapshot.contents.find(c => c.identity.category === 'class');
  record.status = 'archived';
  let c = (await project(snapshot)).candidates.find(c => c.reference.contentId === record.identity.id);
  assert.equal(c.availability, 'archived');
  record.status = 'active';
  snapshot.revisions = snapshot.revisions.filter(r => r.contentId !== record.identity.id);
  c = (await project(snapshot)).candidates.find(c => c.reference.contentId === record.identity.id);
  assert.equal(c.availability, 'missing');
});

test('P2.3 dépendance et propriétaire manquants isolés', async t => {
  const { snapshot } = await setup(t);
  const cls = snapshot.contents.find(c => c.identity.category === 'class');
  snapshot.contents = snapshot.contents.filter(c => c !== cls);
  const p = await project(snapshot);
  assert.ok(p.candidates.filter(c => c.category === 'subclass').some(c => c.diagnostics.some(d => d.code === 'missing-owner')));
  assert.ok(p.candidates.some(c => ['missing', 'invalid'].includes(c.availability)));
});

test('P2.3 copies et cycles diagnostiqués sans résolution ni reconversion', async t => {
  const { snapshot } = await setup(t, { feat: [
    { name: 'Alpha fictif', source: 'FICTIF', _copy: { name: 'Beta fictif', source: 'FICTIF' } },
    { name: 'Beta fictif', source: 'FICTIF', _copy: { name: 'Alpha fictif', source: 'FICTIF' } }
  ] });
  const before = JSON.stringify(snapshot), p = await project(snapshot);
  assert.ok(p.diagnostics.some(d => d.code === 'copy-cycle'));
  assert.ok(p.candidates.every(c => c.availability === 'invalid'));
  assert.equal(JSON.stringify(snapshot), before);
});

test('P2.3 collisions métier natives/imports et imports/imports sans fusion', async t => {
  const { snapshot } = await setup(t);
  const classRevisions = snapshot.revisions.filter(r => snapshot.contents.find(c => c.identity.id === r.contentId)?.identity.category === 'class');
  const nativeId = native.entries.find(e => e.category === 'class').domainId;
  classRevisions.forEach(r => { r.conversions[0].result.payload.data.id = nativeId; });
  const p = await project(snapshot), merged = merge(native, p);
  const collisions = merged.entries.filter(e => e.reference.origin === 'library' && e.domainId === nativeId);
  assert.ok(collisions.length >= 2);
  assert.ok(collisions.every(c => c.availability === 'conflict' && c.diagnostics.some(d => d.code === 'domain-collision')));
  assert.deepEqual(getCreatorClasses(merged), getCreatorClasses(native));
  classRevisions.forEach(r => { r.conversions[0].result.payload.data.id = 'shared-fictive-id'; });
  assert.ok(merge(native, await project(snapshot)).entries.filter(e => e.domainId === 'shared-fictive-id').every(e => e.availability === 'conflict'));
});

test('P2.3 formats invalides isolés, origine corrompue et erreurs globales explicites', async t => {
  const { snapshot } = await setup(t);
  snapshot.contents.push(null, { identity: { id: 'inventé', category: 'class' } });
  const p = await project(snapshot);
  assert.equal(p.candidates.length, snapshot.contents.length - 2);
  assert.equal(p.diagnostics.filter(d => d.code === 'invalid-record').length, 2);
  assert.equal(p.coherent, false);
  snapshot.imports[0].originalText = '{corrompu';
  assert.ok((await project(snapshot)).candidates.every(c => c.availability === 'invalid'));
  await assert.rejects(project({ contents: [] }), /quatre magasins/);
  const duplicated = await setup(t);
  duplicated.snapshot.contents.push(duplicated.snapshot.contents[0]);
  await assert.rejects(project(duplicated.snapshot), /dupliquée/);
});

test('P2.3 API asynchrone : transactions readonly uniquement et aucun localStorage', async t => {
  const { factory } = await setup(t);
  const db = new LibraryDatabase({ factory, existingOnly: true });
  t.after(() => db.close());
  const before = await readLibrarySnapshot(db);
  const run = db.runTransaction.bind(db), modes = [];
  db.runTransaction = (stores, mode, callback) => { modes.push(mode); assert.equal(mode, 'readonly'); return run(stores, mode, callback); };
  Object.defineProperty(global, 'localStorage', { configurable: true, get() { throw Error('localStorage interdit'); } });
  try {
    const service = new LibraryCreatorCatalogService(db);
    const catalog = await service.load();
    assert.deepEqual(getCreatorClasses(catalog), getCreatorClasses(native));
    assert.deepEqual(await readLibrarySnapshot(db), before);
    assert.ok(modes.length > 0);
  } finally { delete global.localStorage; }
});

test('P2.3 consultation d’une base absente : aucune création persistée', async t => {
  const factory = new IDBFactory(), db = new LibraryDatabase({ factory, existingOnly: true });
  t.after(() => db.close());
  await assert.rejects(new LibraryCreatorCatalogService(db).load(), /absente/);
  assert.deepEqual(await factory.databases(), []);
});

test('P2.3 toutes les catégories du contrat, sorts exclus avec diagnostic', async t => {
  const { snapshot } = await setup(t, {
    race: [{ name: 'Peuple fictif', source: 'FICTIF', entries: ['Texte.'] }],
    background: [{ name: 'Passé fictif', source: 'FICTIF', entries: ['Texte.'] }],
    feat: [{ name: 'Talent fictif', source: 'FICTIF', entries: ['Texte.'] }],
    item: [{ name: 'Objet fictif', source: 'FICTIF', entries: ['Texte.'] }],
    spell: [{ name: 'Sort fictif', source: 'FICTIF', entries: ['Texte.'] }]
  });
  const p = await project(snapshot);
  assert.deepEqual(p.candidates.map(c => c.category).sort(), ['species','background','feat','equipment'].sort());
  assert.ok(p.diagnostics.some(d => d.code === 'unsupported-category'));
  assert.ok(p.candidates.every(c => c.availability === 'preview-only'));
});

test('P2.3 références épinglées absentes et cache de dépendance périmé', async t => {
  const { snapshot } = await setup(t);
  const revision = classRevision(snapshot), edge = revision.conversions[0].dependencies[0];
  edge.revisionHash = 'sha256:v1:' + '0'.repeat(64);
  const p = await project(snapshot), candidate = p.candidates.find(c => c.reference.contentId === revision.contentId);
  assert.equal(candidate.availability, 'missing');
  assert.ok(candidate.diagnostics.some(d => d.code === 'missing-reference'));
});

test('P2.3 conversion cassée isolée des autres entrées valides', async t => {
  const { snapshot } = await setup(t);
  const revision = classRevision(snapshot);
  revision.conversions = [{ converter: null, result: null }];
  const p = await project(snapshot);
  assert.equal(p.candidates.find(c => c.reference.contentId === revision.contentId).availability, 'invalid');
  assert.ok(p.candidates.some(c => c.reference.contentId !== revision.contentId && c.availability === 'preview-only'));
});

test('durcissement : inspect et load conservent cohérence et diagnostics locaux/globaux', async t => {
  const { db, factory, snapshot } = await setup(t);
  const r = classRevision(snapshot);
  r.conversions[0].converter = null;
  await db.write([{ store: 'revisions', operation: 'put', value: r },
    { store: 'contents', operation: 'delete', key: snapshot.contents.find(c => c.identity.id !== r.contentId).identity.id }]);
  const strict = new LibraryDatabase({ factory, existingOnly: true }); t.after(() => strict.close());
  const service = new LibraryCreatorCatalogService(strict);
  const inspection = await service.inspect(), loaded = await service.load();
  assert.equal(inspection.coherent, false); assert.equal(loaded.coherent, false);
  assert.deepEqual(loaded.diagnostics, inspection.diagnostics);
  assert.ok(loaded.diagnostics.some(d => d.code === 'orphan-revision'));
  assert.deepEqual(loaded.entries.find(c => c.reference.origin === 'library' && c.reference.contentId === r.contentId).diagnostics,
    inspection.candidates.find(c => c.reference.contentId === r.contentId).diagnostics);
  await assert.rejects(project({ contents: [] }), e => e.coherent === false && e.diagnostics[0].code === 'projection-blocked');
});

test('durcissement : causes de conversion et dépendance invalides avec contexte', async t => {
  const { snapshot } = await setup(t);
  const r = classRevision(snapshot);
  r.conversions[0].converter = null;
  r.dependencies.push({ ownerId: r.contentId, targetId: 'incorrect', relation: 'inventée' });
  const p = await project(snapshot), c = p.candidates.find(c => c.reference.contentId === r.contentId);
  const conv = c.diagnostics.find(d => d.code === 'invalid-conversion'), dep = c.diagnostics.find(d => d.code === 'invalid-dependency');
  assert.match(conv.message, /Convertisseur invalide/); assert.match(conv.path, /conversions\[/);
  assert.match(dep.message, /targetId/); assert.match(dep.path, /dependencies\[/);
  for (const d of [conv, dep]) { assert.equal(d.severity, 'error'); assert.equal(d.revisionHash, r.revisionHash); assert.equal(d.contentId, r.contentId); }
});

test('durcissement : révision orpheline et diagnostics de contenu absent restent accessibles', async t => {
  const { snapshot } = await setup(t);
  const id = snapshot.contents[0].identity.id;
  snapshot.contents = snapshot.contents.filter(c => c.identity.id !== id);
  const p = await project(snapshot);
  assert.ok(p.diagnostics.some(d => d.code === 'orphan-revision' && d.contentId === id));
  assert.equal(p.coherent, false);
  const loaded = merge(native, p);
  assert.ok(loaded.diagnostics.some(d => d.code === 'orphan-revision' && d.contentId === id));
});

test('durcissement : archive et plusieurs causes simultanées conservées malgré priorité invalid', async t => {
  const { snapshot } = await setup(t);
  const r = classRevision(snapshot), record = snapshot.contents.find(c => c.identity.id === r.contentId);
  record.status = 'archived'; r.conversions[0].converter = null; r.dependencies.push(null);
  const c = (await project(snapshot)).candidates.find(c => c.reference.contentId === r.contentId);
  assert.equal(c.availability, 'invalid');
  for (const code of ['archived-content','invalid-conversion','invalid-dependency','invalid-derived-data','import-preview-only']) assert.ok(c.diagnostics.some(d => d.code === code), code);
});

test('durcissement : autorisation publique refuse ready importé et origines malformées', async t => {
  const { snapshot } = await setup(t), candidate = (await project(snapshot)).candidates[0];
  const forged = { ...candidate, availability: 'ready', definition: { id: 'forged-fictive-id' } };
  assert.equal(access(forged, [candidate.provenance.canonicalBookId]).selectable, false);
  for (const value of [null, {}, { ...forged, reference: undefined }, { ...forged, reference: { origin: 'native' } }, { ...forged, reference: {} }]) {
    assert.equal(access(value, [candidate.provenance.canonicalBookId]).selectable, false);
  }
  const genuine = native.entries[0];
  assert.equal(access(genuine, [genuine.provenance.canonicalBookId]).selectable, true);
});

test('durcissement : fusion neutralise définitions forgées et refuse origine native injectée', async t => {
  const { snapshot } = await setup(t), p = await project(snapshot), candidate = p.candidates[0];
  const entries = [null, {}, { ...candidate, reference: { origin: 'native' }, availability: 'ready', definition: { id: 'fake' } },
    { ...candidate, availability: 'ready', definition: { id: 'forged-fictive-id' }, validation: 'converted-validated', rulesProfile: 'fake' }];
  const merged = merge(native, { ...p, candidates: entries });
  assert.equal(merged.coherent, false);
  assert.equal(merged.entries.length, native.entries.length + 1);
  const last = merged.entries.at(-1);
  assert.equal(last.availability, 'invalid');
  for (const field of ['definition','validation','rulesProfile']) assert.equal(field in last, false);
  assert.deepEqual(getCreatorClasses(merged), getCreatorClasses(native));
  native.entries.forEach((entry, i) => assert.equal(merged.entries[i], entry));
  assert.ok(merged.diagnostics.some(d => d.code === 'invalid-library-candidate'));
});

test('durcissement : injection standard refusée avant toute ouverture et P1 toujours créateur', async t => {
  const factory = new IDBFactory(), db = new LibraryDatabase({ factory }); t.after(() => db.close());
  await assert.rejects(new LibraryCreatorCatalogService(db).load(), /existingOnly/);
  assert.deepEqual(await factory.databases(), []);
  // La même instance conserve son droit légitime de création dans les services P1.
  const repo = new LibraryRepository(db);
  const plan = await repo.prepareImport({ text: JSON.stringify({ feat: [{ name: 'Pli fictif', source: 'FICTIF' }] }), filename: 'fictif.json' });
  assert.equal((await repo.commitImport(plan)).success, true);
  assert.equal((await readLibrarySnapshot(db)).contents.length, 1);
});

test('durcissement : cycle copy isolé des copies indépendantes', async t => {
  const entry = (name, parent) => ({ name, source: 'FICTIF', entries: ['Texte inventé.'], ...(parent ? { _copy: { name: parent, source: 'FICTIF' } } : {}) });
  const { snapshot } = await setup(t, { feat: [entry('Alpha fictif','Beta fictif'),entry('Beta fictif','Alpha fictif'),entry('Gamma fictif','Delta fictif'),entry('Delta fictif')] });
  const p = await project(snapshot);
  for (const c of p.candidates) {
    const cyclic = ['Alpha fictif','Beta fictif'].includes(c.provenance.originalName);
    assert.equal(c.diagnostics.some(d => d.code === 'copy-cycle'), cyclic);
    if (!cyclic) assert.notEqual(c.availability, 'invalid');
  }
});

test('durcissement : instantané cohérent pendant écriture concurrente déterministe', async t => {
  const { db: writer, factory, snapshot: before } = await setup(t);
  const reader = new LibraryDatabase({ factory, existingOnly: true }); t.after(() => reader.close());
  const original = reader.runTransaction.bind(reader);
  let pendingWrite, launched = false;
  reader.runTransaction = (stores, mode, work) => original(stores, mode, context => work({ ...context,
    request(request, onSuccess) { context.request(request, value => {
      onSuccess?.(value);
      if (!launched) {
        launched = true;
        const c = before.contents[0];
        pendingWrite = writer.write([
          { store: 'contents', operation: 'put', value: { ...c, status: 'archived', generation: c.generation + 1 } },
          { store: 'revisions', operation: 'delete', key: [c.identity.id, c.activeRevision] }
        ]);
      }
    }); }
  }));
  const captured = await readLibrarySnapshot(reader);
  await pendingWrite;
  assert.equal(launched, true); assert.deepEqual(captured, before);
  const after = await readLibrarySnapshot(writer);
  assert.equal(after.contents[0].status, 'archived');
  assert.equal(after.revisions.some(r => r.contentId === before.contents[0].identity.id && r.revisionHash === before.contents[0].activeRevision), false);
});
