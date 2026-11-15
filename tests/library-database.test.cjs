// Charge les modules TypeScript en mémoire, sans compilation sur disque.
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
};
const { IDBFactory } = require('fake-indexeddb');
const { LibraryDatabase, LibraryDatabaseError, asLibraryDatabaseError, LIBRARY_DATABASE_NAME: NAME, LIBRARY_DATABASE_VERSION, LIBRARY_STORES } = require('../src/services/libraryDatabase.ts');
const { createLibraryIdentity } = require('../src/engine/libraryIdentity.ts');
const hash = letter => 'sha256:v1:' + letter.repeat(64);
const identity = createLibraryIdentity({ provider: '5etools', category: 'class', name: 'Veilleur fictif', source: 'FRHoF' }).identity;
const doc = (letter = 'a') => ({ recordVersion: 1, id: hash(letter), originalText: '{"fictive":true}', filenames: ['fictif.json'], importedAt: '2026-01-01T00:00:00Z' });
const content = () => ({ recordVersion: 1, identity, activeRevision: hash('b'), generation: 0, status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-01' });
const revision = () => ({ recordVersion: 1, contentId: identity.id, revisionHash: hash('b'), createdAt: '2026-01-01', origins: [{ provider: '5etools', namespace: '', originalName: 'Veilleur fictif', originalSource: 'FRHoF', bookId: 'FRHOF', originalKey: 'class', location: { importId: hash('a'), pointer: '/class/0' } }] });
const dependency = () => ({ ownerId: identity.id, targetId: identity.id, relation: 'copy' });
function setup(t) {
  const factory = new IDBFactory(); const db = new LibraryDatabase({ factory });
  t.after(() => db.close()); return { db, factory };
}
function openRaw(factory, version) {
  return new Promise((resolve, reject) => { const request = factory.open(NAME, version); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
const code = expected => error => error instanceof LibraryDatabaseError && error.code === expected;

test('création v1 : magasins, clés et tous les index attendus', async t => {
  const { db, factory } = setup(t); await db.open();
  const raw = await openRaw(factory, 1); t.after(() => raw.close());
  assert.equal(raw.name, 'atelier-aventuriers:library'); assert.equal(raw.version, LIBRARY_DATABASE_VERSION);
  assert.deepEqual([...raw.objectStoreNames].sort(), [...LIBRARY_STORES].sort());
  const tx = raw.transaction([...LIBRARY_STORES]);
  const expectations = {
    imports: { key: 'id', indexes: { importedAt: 'importedAt' } },
    contents: { key: 'identity.id', indexes: { bookId: 'identity.bookId', category: 'identity.category', bookCategory: ['identity.bookId','identity.category'], normalizedName: 'identity.normalizedName', status: 'status' } },
    revisions: { key: ['contentId','revisionHash'], indexes: { contentId: 'contentId' } },
    dependencies: { key: ['ownerId','targetId','relation'], indexes: { ownerId: 'ownerId', targetId: 'targetId', relation: 'relation' } }
  };
  for (const [name, expected] of Object.entries(expectations)) {
    const store = tx.objectStore(name); assert.deepEqual(store.keyPath, expected.key);
    assert.deepEqual([...store.indexNames].sort(), Object.keys(expected.indexes).sort());
    for (const [index, keyPath] of Object.entries(expected.indexes)) { assert.deepEqual(store.index(index).keyPath, keyPath); assert.equal(store.index(index).unique, false); }
  }
});

test('écritures fictives, index, fermeture/réouverture et requête absente', async t => {
  const { db } = setup(t);
  await db.write([{ store: 'imports', operation: 'add', value: doc() }, { store: 'contents', operation: 'add', value: content() }, { store: 'revisions', operation: 'add', value: revision() }, { store: 'dependencies', operation: 'add', value: dependency() }]);
  db.close(); await db.open();
  assert.deepEqual(await db.get('imports', hash('a')), doc());
  assert.deepEqual(await db.getAll('contents','bookCategory',['FRHOF','class']), [content()]);
  assert.deepEqual(await db.getAll('contents','status','active'), [content()]);
  assert.deepEqual(await db.get('revisions', [identity.id, hash('b')]), revision());
  assert.deepEqual(await db.getAll('dependencies','targetId',identity.id), [dependency()]);
  assert.equal(await db.get('imports', hash('c')), undefined);
});

test('doublon de clé : annulation intégrale dans plusieurs magasins', async t => {
  const { db } = setup(t); await db.write([{ store:'imports',operation:'add',value:doc() }]);
  await assert.rejects(db.write([{ store:'contents',operation:'add',value:content() }, { store:'imports',operation:'add',value:doc('c') }, { store:'imports',operation:'add',value:doc() }]), code('constraint'));
  assert.equal(await db.get('contents',identity.id), undefined);
  assert.equal(await db.get('imports',hash('c')), undefined);
  assert.deepEqual(await db.get('imports',hash('a')),doc());
});

test('unicité des révisions et des dépendances, relations distinctes permises', async t => {
  const { db } = setup(t);
  for (const [store,value] of [['revisions',revision()],['dependencies',dependency()]]) {
    await db.write([{ store,operation:'add',value }]);
    await assert.rejects(db.write([{ store,operation:'add',value }]),code('constraint'));
  }
  await db.write([{ store:'dependencies',operation:'add',value:{ ...dependency(),relation:'feature' } }]);
  assert.equal((await db.getAll('dependencies')).length,2);
});

test('put explicite et delete transactionnels', async t => {
  const { db } = setup(t); await db.write([{ store:'imports',operation:'add',value:doc() }]);
  const changed = { ...doc(),filenames:['renomme.json'] };
  await db.write([{ store:'imports',operation:'put',value:changed }]);
  assert.deepEqual(await db.get('imports',hash('a')),changed);
  await db.write([{ store:'imports',operation:'delete',key:hash('a') }]); assert.equal(await db.get('imports',hash('a')),undefined);
});

test('abort explicite, exception synchrone et exception après une lecture : rollback', async t => {
  const { db } = setup(t);
  await assert.rejects(db.runTransaction(['imports'],'readwrite',ctx => { ctx.store('imports').add(doc()); ctx.abort(); }),code('transaction'));
  await assert.rejects(db.runTransaction(['imports'],'readwrite',ctx => { ctx.store('imports').add(doc()); throw Error('fictif'); }),code('transaction'));
  await assert.rejects(db.runTransaction(['imports'],'readwrite',ctx => { ctx.store('imports').add(doc()); ctx.request(ctx.store('imports').get(hash('a')), () => { throw Error('fictif'); }); }),code('transaction'));
  assert.deepEqual(await db.getAll('imports'),[]);
});

test('lecture puis écriture atomiques, succès uniquement après complete', async t => {
  const { db } = setup(t); await db.write([{ store:'imports',operation:'add',value:doc() }]);
  await db.runTransaction(['imports'],'readwrite',ctx => {
    ctx.request(ctx.store('imports').get(hash('a')),value => { ctx.store('imports').put({ ...value,filenames:['modifie.json'] }); });
  });
  assert.deepEqual((await db.get('imports',hash('a'))).filenames,['modifie.json']);
});

test('callbacks async refusés avant commit, y compris dans une requête', async t => {
  const { db } = setup(t);
  await assert.rejects(db.runTransaction(['imports'],'readwrite',async ctx => { ctx.store('imports').add(doc()); }),code('invalid-data'));
  await assert.rejects(db.runTransaction(['imports'],'readwrite',ctx => { ctx.store('imports').add(doc()); ctx.request(ctx.store('imports').get(hash('a')),async () => {}); }),code('invalid-data'));
  assert.deepEqual(await db.getAll('imports'),[]);
});

test('données invalides et non clonables : refus sans écritures partielles', async t => {
  const { db } = setup(t);
  await assert.rejects(db.write([{ store:'imports',operation:'add',value:doc() },{ store:'contents',operation:'add',value:{} }]),code('invalid-data'));
  await assert.rejects(db.write([{ store:'imports',operation:'add',value:{ ...doc(),extra:()=>1 } }]),code('invalid-data'));
  await assert.rejects(db.get('imports',null),code('invalid-data'));
  await assert.rejects(db.getAll('imports','missing-index'),code('invalid-data'));
  await assert.rejects(db.runTransaction([],'readwrite',()=>{}),code('invalid-data'));
  assert.deepEqual(await db.getAll('imports'),[]);
});

test('version future : refus sans suppression ni modification des données', async t => {
  const { db, factory } = setup(t); await db.write([{ store:'imports',operation:'add',value:doc() }]); db.close();
  const newer = await openRaw(factory,2); newer.close();
  await assert.rejects(db.open(),code('version'));
  const check = await openRaw(factory,2); t.after(()=>check.close());
  const req = check.transaction('imports').objectStore('imports').get(hash('a'));
  const value = await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  assert.deepEqual(value,doc());
});

test('versionchange ferme les connexions, même si l’observateur lève une exception', async t => {
  const factory = new IDBFactory(); let notified;
  const db = new LibraryDatabase({ factory,onVersionChange:version=>{notified=version;throw Error('observateur');} }); t.after(()=>db.close());
  await db.open(); const newer = await openRaw(factory,2); newer.close();
  assert.equal(notified,2); await assert.rejects(db.open(),code('version'));
});

test('ouverture bloquée : signalement immédiat, migration abandonnée puis réessai', async t => {
  const factory = new IDBFactory();
  const initial = new LibraryDatabase({factory}); await initial.open(); initial.close();
  const blocker = await openRaw(factory,1); t.after(()=>blocker.close());
  let notified = 0; let simulateUpgrade = true;
  // Simule une future montée de version pour exercer blocked avec un bloqueur v1.
  const db = new LibraryDatabase({factory:{open:()=>factory.open(NAME,simulateUpgrade ? 2 : 1)},onBlocked:()=>{notified++;}}); t.after(()=>db.close());
  await assert.rejects(db.open(),code('blocked')); assert.equal(notified,1);
  blocker.close();
  // La tentative abandonnée doit annuler l'upgrade, sans supprimer la base.
  const check = await openRaw(factory,1); assert.equal(check.version,1); check.close();
  simulateUpgrade = false; await db.open(); assert.deepEqual(await db.getAll('imports'),[]);
});

test('ouvertures simultanées et connexions concurrentes', async t => {
  const { db, factory } = setup(t); await Promise.all([db.open(),db.open(),db.open()]);
  const second = new LibraryDatabase({factory}); t.after(()=>second.close());
  await Promise.all([db.write([{store:'imports',operation:'add',value:doc()}]),second.write([{store:'imports',operation:'add',value:doc('c')}])]);
  assert.equal((await second.getAll('imports')).length,2);
});

test('fermeture pendant ouverture : pas de connexion fantôme, réouverture possible', async t => {
  const { db } = setup(t); const pending = db.open(); db.close();
  await assert.rejects(pending,code('open')); await db.open(); assert.deepEqual(await db.getAll('imports'),[]);
});

test('erreur ouverture et quota : catégories explicites, aucun deleteDatabase', async () => {
  let deletes=0;
  for (const [name,expected] of [['SecurityError','open'],['QuotaExceededError','quota']]) {
    const db = new LibraryDatabase({factory:{open(){throw new DOMException('fictif',name);},deleteDatabase(){deletes++;}}});
    await assert.rejects(db.open(),code(expected));
  }
  assert.equal(asLibraryDatabaseError(new DOMException('quota','QuotaExceededError'),'transaction').code,'quota');
  assert.equal(asLibraryDatabaseError(new DOMException('abort','AbortError'),'transaction').code,'transaction');
  assert.equal(deletes,0);
});


test('schéma v1 incohérent : refus sans recréer ni supprimer la base', async t => {
  const factory = new IDBFactory(); const raw = await openRaw(factory,1); raw.close();
  const db = new LibraryDatabase({factory}); t.after(()=>db.close());
  await assert.rejects(db.open(),code('version'));
  const check = await openRaw(factory,1); assert.equal(check.objectStoreNames.length,0); check.close();
});

test('quota simulé pendant la transaction : annulation et conservation des données existantes', async t => {
  const { db } = setup(t); await db.write([{store:'imports',operation:'add',value:doc()}]);
  await assert.rejects(db.runTransaction(['imports'],'readwrite',ctx=> {
    ctx.request(ctx.store('imports').add(doc('c')),()=>{throw new DOMException('quota simulé','QuotaExceededError');});
  }),code('quota'));
  assert.deepEqual(await db.getAll('imports'),[doc()]);
});

test('échec asynchrone d’ouverture : erreur explicite sans suppression', async () => {
  let deletes=0;
  const db = new LibraryDatabase({factory:{open(){
    const req={error:new DOMException('indisponible','UnknownError')};
    queueMicrotask(()=>req.onerror());return req;
  },deleteDatabase(){deletes++;}}});
  await assert.rejects(db.open(),code('open')); assert.equal(deletes,0);
});
