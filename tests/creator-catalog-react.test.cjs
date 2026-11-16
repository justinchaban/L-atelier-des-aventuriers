const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText, filename);
require.extensions['.tsx'] = require.extensions['.ts'];
const React = require('react');
const { act } = React;
const { create } = require('react-test-renderer');
const { renderToStaticMarkup } = require('react-dom/server');
global.IS_REACT_ACT_ENVIRONMENT = true;
const { createCreatorCatalogLoader } = require('../src/services/creatorCatalogLoader.ts');
const { nativeCreatorCatalog: native } = require('../src/engine/nativeCreatorCatalog.ts');
const { getCreatorClasses } = require('../src/engine/creatorCatalog.ts');
const { createLibraryIdentity } = require('../src/engine/libraryIdentity.ts');
const { mergeLibraryCreatorCatalog: merge, LibraryCreatorCatalogService } = require('../src/services/libraryCreatorCatalog.ts');
const Panel = require('../src/components/character/ImportedCreatorCatalog.tsx').default;
const Workspace = require('../src/components/character/CharacterBuilderWorkspace.tsx').default;
const { useCreatorCatalog } = require('../src/hooks/useCreatorCatalog.ts');
const { IDBFactory } = require('fake-indexeddb');
const { LibraryDatabase } = require('../src/services/libraryDatabase.ts');
const { LibraryRepository, readLibrarySnapshot } = require('../src/services/libraryRepository.ts');
const candidate = (name = 'Gardien fictif', source = 'XSRD') => {
  const identity = createLibraryIdentity({ provider: 'custom', namespace: 'react-fictif', category: 'class', name, source }).identity;
  return { catalogKey: `library:v1:${JSON.stringify(['content', identity.id])}`, category: 'class',
    reference: { origin: 'library', contentId: identity.id, revisionHash: 'sha256:v1:' + '0'.repeat(64), dependencies: [] },
    provenance: { originalName: name, originalSource: source, canonicalBookId: identity.bookId, bookInherited: false },
    libraryStatus: 'active', conversionState: 'absent', historicalRevisions: [], availability: 'preview-only',
    diagnostics: [{ code: 'import-preview-only', severity: 'info', message: 'Contenu fictif non sélectionnable.' }] };
};
const catalog = (entries = [candidate()], diagnostics = [], coherent = true) => merge(native, { candidates: entries, diagnostics, coherent });
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
function readers() {
  const requests = [];
  const factory = () => { const pending = deferred(); const reader = { ...pending, closes: 0, load: () => pending.promise, close() { this.closes++; } }; requests.push(reader); return reader; };
  return { factory, requests };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const html = state => renderToStaticMarkup(React.createElement(Panel, { state, allowedBooks: ['XSRD'], onRefresh() {} }));

test('React catalogue : natif immédiat, lecture lente, vide puis chargée', async () => {
  const { factory, requests } = readers(), loader = createCreatorCatalogLoader(factory);
  assert.deepEqual(getCreatorClasses(loader.getSnapshot().catalog), getCreatorClasses(native));
  loader.start();
  assert.equal(loader.getSnapshot().status, 'loading'); assert.match(html(loader.getSnapshot()), /Chargement/);
  requests[0].resolve(catalog([])); await tick();
  assert.equal(loader.getSnapshot().status, 'empty'); assert.equal(loader.getSnapshot().coherent, true);
  assert.match(html(loader.getSnapshot()), /Aucun contenu importé projetable/);
  const refresh = loader.refresh(); requests[1].resolve(catalog()); await refresh;
  assert.equal(loader.getSnapshot().status, 'ready'); assert.match(html(loader.getSnapshot()), /Gardien fictif/);
  assert.deepEqual(getCreatorClasses(loader.getSnapshot().catalog), getCreatorClasses(native));
  loader.stop();
});

test('React catalogue : ancien succès et ancien rejet ignorés après rafraîchissement', async () => {
  const { factory, requests } = readers(), loader = createCreatorCatalogLoader(factory);
  loader.start(); const second = loader.refresh(); const third = loader.refresh();
  requests[2].resolve(catalog([candidate('Plus récent fictif')])); await third;
  const latest = loader.getSnapshot();
  requests[0].resolve(catalog([candidate('Ancien fictif')])); requests[1].reject(Error('Erreur obsolète')); await second; await tick();
  assert.equal(loader.getSnapshot(), latest); assert.match(html(latest), /Plus récent fictif/); assert.doesNotMatch(html(latest), /Ancien fictif/);
  assert.ok(requests.every(r => r.closes === 1)); loader.stop();
});

test('React catalogue : incohérence et diagnostics globaux/locaux visibles sans perdre le natif', async () => {
  const { factory, requests } = readers(), loader = createCreatorCatalogLoader(factory);
  const entry = candidate(); entry.diagnostics.push({ code: 'invalid-conversion', severity: 'error', message: 'Cache fictif invalide.' });
  loader.start(); requests[0].resolve(catalog([entry], [{ code: 'orphan-revision', severity: 'error', message: 'Révision fictive orpheline.' }], false)); await tick();
  const state = loader.getSnapshot(), markup = html(state);
  assert.equal(state.status, 'error'); assert.equal(state.coherent, false);
  for (const text of ['Révision fictive orpheline','Cache fictif invalide','cohérence','Gardien fictif']) assert.ok(markup.includes(text), text);
  assert.deepEqual(getCreatorClasses(state.catalog), getCreatorClasses(native)); loader.stop();
});

test('React catalogue : erreur IndexedDB puis reprise volontaire', async () => {
  const { factory, requests } = readers(), loader = createCreatorCatalogLoader(factory);
  loader.start(); requests[0].reject(Error('IndexedDB fictivement indisponible')); await tick();
  assert.equal(loader.getSnapshot().status, 'error'); assert.match(html(loader.getSnapshot()), /IndexedDB fictivement indisponible/);
  assert.deepEqual(getCreatorClasses(loader.getSnapshot().catalog), getCreatorClasses(native));
  const refresh = loader.refresh(); requests[1].resolve(catalog([])); await refresh;
  assert.equal(loader.getSnapshot().status, 'empty'); loader.stop();
});

test('React catalogue : résultat forgé neutralisé et résultat illisible diagnostiqué', async () => {
  const { factory, requests } = readers(), loader = createCreatorCatalogLoader(factory);
  const forged = { ...candidate(), availability: 'ready', definition: { id: 'forged' } };
  loader.start(); requests[0].resolve({ ...catalog([]), entries: [...native.entries, forged, { ...forged, reference: { origin: 'native' } }, null] }); await tick();
  const state = loader.getSnapshot();
  assert.equal(state.status, 'error'); assert.deepEqual(getCreatorClasses(state.catalog), getCreatorClasses(native));
  const imported = state.catalog.entries.filter(e => e.reference.origin === 'library');
  assert.equal(imported.length, 1); assert.equal(imported[0].availability, 'invalid'); assert.equal('definition' in imported[0], false);
  const next = loader.refresh(); requests[1].resolve({ entries: null }); await next;
  assert.match(html(loader.getSnapshot()), /illisible ou incompatible/); loader.stop();
});

test('React catalogue : textes échappés, descriptions non validées diagnostiquées, aucun choix importé', () => {
  const entry = candidate('<img src=x onerror=alert(1)>', 'INCONNU-FICTIF');
  entry.structuredEntries = ['<script>alert(1)</script>'];
  entry.diagnostics.push({ code: 'fictive', severity: 'warning', message: '<script>alerte fictive</script>', path: { bad: true } });
  const state = { status: 'ready', catalog: catalog([entry]), coherent: true, diagnostics: [] };
  const markup = html(state);
  assert.ok(markup.includes('&lt;img')); assert.ok(markup.includes('&lt;script')); assert.doesNotMatch(markup, /<script|<img/);
  assert.match(markup, /Description indisponible/); assert.match(markup, /Livre refusé/);
  assert.equal((markup.match(/<button/g) ?? []).length, 1); assert.doesNotMatch(markup, /<select|type="radio"|type="checkbox"/);
});

test('hook React monté : campagne courante pendant chargement et rafraîchissements sans mutation du brouillon', async () => {
  const { factory, requests } = readers(); let mounted;
  const character = { schemaVersion: 1, id: 'draft-fictif', name: 'Brouillon fictif', level: 3, classId: 'fighter-2024', speciesId: '', backgroundId: '',
    abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, choices: { subclassId: 'battle-master-2024', custom: ['préservé'] },
    gameState: { currentHP: 1, temporaryHP: 0, usedHitDice: 0, usedSpellSlots: {}, conditions: [] } };
  const before = JSON.stringify(character); let changes = 0;
  const props = { character, campaign: { allowedBooks: ['XSRD'] }, onChange() { changes++; }, onClose() {}, catalogReaderFactory: factory };
  await act(async () => { mounted = create(React.createElement(Workspace, props)); });
  assert.equal(mounted.root.findByType(Panel).props.state.status, 'loading');
  await act(async () => { mounted.update(React.createElement(Workspace, { ...props, campaign: { allowedBooks: [] } })); });
  await act(async () => { requests[0].resolve(catalog()); });
  const panel = mounted.root.findByType(Panel);
  assert.deepEqual(panel.props.allowedBooks, []);
  assert.match(renderToStaticMarkup(React.createElement(Panel, panel.props)), /Livre refusé/);
  await act(async () => { void panel.props.onRefresh(); });
  await act(async () => { requests[1].resolve(catalog([])); });
  assert.equal(mounted.root.findByType(Panel).props.state.status, 'empty');
  assert.equal(changes, 0); assert.equal(JSON.stringify(character), before);
  await act(async () => { mounted.unmount(); });
});

test('hook React : démontage invalide réponse tardive et ferme le lecteur', async () => {
  const { factory, requests } = readers(); let state, mounted, renders = 0;
  function Harness() { state = useCreatorCatalog(factory); renders++; return null; }
  await act(async () => { mounted = create(React.createElement(Harness)); });
  await act(async () => { mounted.unmount(); });
  const count = renders;
  await act(async () => { requests[0].resolve(catalog()); });
  assert.equal(requests[0].closes, 1); assert.equal(renders, count); assert.equal(state.status, 'loading');
});

test('hook React : StrictMode supporte nettoyage puis redémarrage sans réponse obsolète', async () => {
  const { factory, requests } = readers(); let state, mounted;
  function Harness() { state = useCreatorCatalog(factory); return null; }
  await act(async () => { mounted = create(React.createElement(React.StrictMode, null, React.createElement(Harness))); });
  assert.equal(requests.length, 2); assert.equal(requests[0].closes, 1);
  await act(async () => { requests[1].resolve(catalog([candidate('Courant fictif')])); });
  await act(async () => { requests[0].resolve(catalog([candidate('Obsolète fictif')])); });
  assert.match(html(state), /Courant fictif/); assert.doesNotMatch(html(state), /Obsolète fictif/);
  await act(async () => { mounted.unmount(); });
});

test('React catalogue réel : aucune écriture ni localStorage, y compris rafraîchissement', async t => {
  const factory = new IDBFactory(), writer = new LibraryDatabase({ factory }); t.after(() => writer.close());
  const repo = new LibraryRepository(writer);
  const plan = await repo.prepareImport({ text: JSON.stringify({ feat: [{ name: 'Sceau fictif', source: 'XSRD', entries: ['Texte inventé.'] }] }), filename: 'react-fictif.json' });
  assert.equal((await repo.commitImport(plan)).success, true);
  const before = await readLibrarySnapshot(writer), modes = [];
  const loader = createCreatorCatalogLoader(() => {
    const db = new LibraryDatabase({ factory, existingOnly: true }), run = db.runTransaction.bind(db);
    db.runTransaction = (stores, mode, callback) => { modes.push(mode); assert.equal(mode, 'readonly'); return run(stores, mode, callback); };
    return new LibraryCreatorCatalogService(db);
  });
  Object.defineProperty(global, 'localStorage', { configurable: true, get() { throw Error('localStorage interdit'); } });
  try {
    const settled = () => new Promise(resolve => { const off = loader.subscribe(() => { if (loader.getSnapshot().status !== 'loading') { off(); resolve(); } }); });
    let ready = settled(); loader.start(); await ready;
    assert.equal(loader.getSnapshot().status, 'ready');
    ready = settled(); void loader.refresh(); await ready;
    assert.equal(loader.getSnapshot().status, 'ready');
    assert.deepEqual(await readLibrarySnapshot(writer), before); assert.ok(modes.length >= 2);
  } finally { loader.stop(); delete global.localStorage; }
});

test('React catalogue : base absente ne crée aucun schéma', async () => {
  const factory = new IDBFactory();
  const loader = createCreatorCatalogLoader(() => new LibraryCreatorCatalogService(new LibraryDatabase({ factory, existingOnly: true })));
  const ready = new Promise(resolve => { const off = loader.subscribe(() => { if (loader.getSnapshot().status === 'error') { off(); resolve(); } }); });
  loader.start(); await ready;
  assert.equal(loader.getSnapshot().coherent, false); assert.deepEqual(await factory.databases(), []);
  assert.deepEqual(getCreatorClasses(loader.getSnapshot().catalog), getCreatorClasses(native)); loader.stop();
});

test('créateur monté : sélecteur natif disponible pendant loading, error, ready et empty', async () => {
  const { factory, requests } = readers(); let mounted, changes = 0;
  const character = { schemaVersion: 1, id: 'native-fictif', name: 'Gardienne fictive', level: 3, classId: 'fighter-2024', speciesId: '', backgroundId: '',
    abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, choices: { subclassId: 'battle-master-2024', custom: 'conservé' },
    gameState: { currentHP: 1, temporaryHP: 0, usedHitDice: 0, usedSpellSlots: {}, conditions: [] } };
  const before = JSON.stringify(character);
  await act(async () => { mounted = create(React.createElement(Workspace, { character, campaign: null, onChange() { changes++; }, onClose() {}, catalogReaderFactory: factory })); });
  await act(async () => { mounted.root.findAllByType('button').find(button => button.children.includes('Classe')).props.onClick(); });
  const assertNative = status => {
    assert.equal(mounted.root.findByType(Panel).props.state.status, status);
    const buttons = mounted.root.findAllByType('button').filter(button => /^class-builder-option(?: selected)?$/.test(button.props.className));
    assert.equal(buttons.length, getCreatorClasses(native).length);
  };
  assertNative('loading');
  await act(async () => { requests[0].reject(Error('Erreur de lecture fictive')); }); assertNative('error');
  await act(async () => { void mounted.root.findByType(Panel).props.onRefresh(); }); assertNative('loading');
  await act(async () => { requests[1].resolve(catalog()); }); assertNative('ready');
  await act(async () => { void mounted.root.findByType(Panel).props.onRefresh(); });
  await act(async () => { requests[2].resolve(catalog([])); }); assertNative('empty');
  assert.equal(changes, 0); assert.equal(JSON.stringify(character), before);
  await act(async () => { mounted.unmount(); });
});
