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
const { LibraryDatabase, LibraryDatabaseError } = require('../src/services/libraryDatabase.ts');
const { LibraryRepository, readLibrarySnapshot } = require('../src/services/libraryRepository.ts');
const { LibraryQueryService, describeLibrarySnapshot, filterLibraryEntries } = require('../src/services/libraryQuery.ts');
const fixture=()=>JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'fixtures/fictive-classes.json'),'utf8'));
async function setup(t) {
  const factory=new IDBFactory(); const database=new LibraryDatabase({factory});
  const repository=new LibraryRepository(database); const query=new LibraryQueryService(database);
  t.after(()=>query.close()); return {factory,database,repository,query};
}
async function seed(repository,data=fixture()) {
  const plan=await repository.prepareImport({text:JSON.stringify(data),filename:'fictif.json'});
  const result=await repository.commitImport(plan,{acceptedUpdates:plan.decisions.filter(d=>d.kind==='update').map(d=>d.identity.id)});
  assert.equal(result.success,true); return plan;
}

test('consultation vide : base ouverte, aucun contenu inventé ou écrit',async t=>{
  const {query,database}=await setup(t); assert.deepEqual(await query.consult(),[]);
  assert.deepEqual(await readLibrarySnapshot(database),{imports:[],contents:[],revisions:[],dependencies:[]});
});

test('consultation des contenus réels et détails de leur révision active, sans mutation',async t=>{
  const {query,database,repository}=await setup(t);await seed(repository);
  const before=await readLibrarySnapshot(database);const views=await query.consult();
  assert.equal(views.length,7);assert.deepEqual(await readLibrarySnapshot(database),before);
  const foreign=views.find(view=>view.bookId==='FRHOF');
  assert.equal(foreign.name,'Plieur des brumes');assert.equal(foreign.origins[0].provenance.originalSource,'FRHoF');
  assert.deepEqual(foreign.origins[0].filenames,['fictif.json']);
  assert.equal(foreign.originalEntry.source,'FRHoF');assert.equal(foreign.revision.revisionHash,foreign.record.activeRevision);
  const classes=views.filter(view=>view.category==='class');
  assert.ok(classes.every(view=>view.conversionState==='converted'));
  assert.ok(views.every(view=>view.creatorConnected===false));
  assert.equal(views.find(view=>view.category==='subclass').conversionState,'unusable');
});

test('recherche par nom : sous-chaîne, casse, espaces périphériques et Unicode NFC',async t=>{
  const {query,repository}=await setup(t);await seed(repository,{feat:[{name:'Éclat de papier',source:'FICTIF'}]});
  const views=await query.consult();
  assert.equal(filterLibraryEntries(views,{name:'  ÉCLAT '}).length,1);
  assert.equal(filterLibraryEntries(views,{name:'e\u0301clat'}).length,1);
  assert.equal(filterLibraryEntries(views,{name:'papier'}).length,1);
  assert.equal(filterLibraryEntries(views,{name:'absent'}).length,0);
});

test('filtres catégorie, livre, statut et conversion combinables sans réordonner les données',async t=>{
  const {query,repository}=await setup(t);await seed(repository);
  const views=await query.consult();const before=views.map(view=>view.id);
  assert.equal(filterLibraryEntries(views,{category:'class',bookId:'phb-2024',status:'active',conversionState:'converted'}).length,1);
  assert.equal(filterLibraryEntries(views,{status:'archived'}).length,0);
  assert.equal(filterLibraryEntries(views,{category:'feat'}).length,0);
  assert.equal(filterLibraryEntries(views,{bookId:'frhof'}).length,1);
  assert.equal(filterLibraryEntries(views,{category:'all',bookId:'all',status:'all',conversionState:'all'}).length,7);
  assert.deepEqual(views.map(view=>view.id),before);
});

test('sources inconnues consultables sans autorisation de campagne implicite',async t=>{
  const {query,repository}=await setup(t);await seed(repository,{feat:[{name:'Pli fictif',source:'LIVRE-INCONNU'}]});
  const views=await query.consult();assert.equal(views[0].bookId,'LIVRE-INCONNU');assert.equal(views[0].bookName,'Source non référencée');
  assert.equal(Object.hasOwn(views[0],'allowedByCampaign'),false);
});

test('nouvelle consultation et réouverture retrouvent les contenus ajoutés',async t=>{
  const {query,repository}=await setup(t);assert.equal((await query.consult()).length,0);
  await seed(repository);assert.equal((await query.consult()).length,7);
  query.close();assert.equal((await query.consult()).length,7);
});

test('deux connexions : un ajout devient visible à la prochaine consultation',async t=>{
  const {query,factory}=await setup(t);const otherDatabase=new LibraryDatabase({factory});t.after(()=>otherDatabase.close());
  const otherRepository=new LibraryRepository(otherDatabase);
  assert.equal((await query.consult()).length,0);await seed(otherRepository);
  assert.equal((await query.consult()).length,7);
});

test('convertisseur obsolète et dépendance modifiée : état à reconvertir',async t=>{
  const {query,repository,database}=await setup(t);const data=fixture();await seed(repository,data);
  const snapshot=await readLibrarySnapshot(database);const revision=snapshot.revisions.find(r=>r.conversions[0].result.status==='converted');
  const changed=structuredClone(revision);changed.conversions[0].converter.version='ancienne';
  await database.write([{store:'revisions',operation:'put',value:changed}]);
  assert.equal((await query.consult()).find(view=>view.id===revision.contentId).conversionState,'needs-reconversion');
  const feature=structuredClone(data.classFeature[0]);feature.entries=['Description modifiée fictive.'];
  await seed(repository,{classFeature:[feature]});
  assert.equal((await query.consult()).find(view=>view.category==='class'&&view.bookId==='PHB').conversionState,'needs-reconversion');
});

test('résultat actuel non résolu prioritaire sur une ancienne conversion réussie',async t=>{
  const {query,repository,database}=await setup(t);await seed(repository);
  const snapshot=await readLibrarySnapshot(database);const revision=snapshot.revisions.find(r=>r.conversions[0].result.status==='converted');
  const current=structuredClone(revision.conversions[0]);current.result={status:'unresolved',issues:['Dépendance fictive manquante.']};
  const old=structuredClone(revision.conversions[0]);old.converter.version='ancienne';
  await database.write([{store:'revisions',operation:'put',value:{...revision,conversions:[old,current]}}]);
  const view=(await query.consult()).find(view=>view.id===revision.contentId);
  assert.equal(view.conversionState,'unusable');assert.ok(view.issues.includes('Dépendance fictive manquante.'));
});

test('révisions sans conversion et contenus archivés distingués',async t=>{
  const {query,repository,database}=await setup(t);await seed(repository);
  const snapshot=await readLibrarySnapshot(database);const revision=structuredClone(snapshot.revisions[0]);delete revision.conversions;
  await database.write([{store:'revisions',operation:'put',value:revision}]);
  assert.equal((await query.consult()).find(view=>view.id===revision.contentId).conversionState,'stored');
  const record=snapshot.contents.find(record=>record.identity.id===revision.contentId);
  await database.write([{store:'contents',operation:'put',value:{...record,status:'archived'}}]);
  const views=await query.consult();assert.equal(filterLibraryEntries(views,{status:'archived'}).length,1);
  assert.equal(views.find(view=>view.id===revision.contentId).conversionState,'unusable');
});

test('révision ou document manquant : contenu conservé dans la consultation avec diagnostic',async t=>{
  const {query,repository,database}=await setup(t);await seed(repository);
  const before=await readLibrarySnapshot(database);const revision=before.revisions[0];
  await database.write([{store:'revisions',operation:'delete',key:[revision.contentId,revision.revisionHash]}]);
  let views=await query.consult();assert.equal(views.length,7);
  assert.equal(views.find(view=>view.id===revision.contentId).conversionState,'unusable');
  await database.write([{store:'imports',operation:'delete',key:before.imports[0].id}]);
  views=await query.consult();assert.equal(views.length,7);assert.ok(views.every(view=>view.conversionState==='unusable'));
});

test('JSON original et provenance mal formés signalés sans exécution ni réparation',async t=>{
  const {repository,database}=await setup(t);await seed(repository);
  const snapshot=await readLibrarySnapshot(database);snapshot.imports[0].originalText='{bad';
  assert.ok(describeLibrarySnapshot(snapshot).every(view=>view.issues.length>0&&view.conversionState==='unusable'));
  snapshot.revisions[0].origins=[null];
  assert.doesNotThrow(()=>describeLibrarySnapshot(snapshot));
  snapshot.contents[0].identity.category='invalid';
  assert.throws(()=>describeLibrarySnapshot(snapshot),error=>error.code==='invalid-data');
});

test('erreurs de lecture propagées explicitement sans résultat vide trompeur',async()=>{
  let writes=0;
  const query=new LibraryQueryService({runTransaction:async()=>{throw new LibraryDatabaseError('open','Indisponible');},close(){}});
  await assert.rejects(query.consult(),error=>error.code==='open');assert.equal(writes,0);
});
