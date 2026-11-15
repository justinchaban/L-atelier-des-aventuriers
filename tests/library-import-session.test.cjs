// Charge les modules TypeScript en mémoire, sans compilation sur disque.
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, filename);
};
require.extensions['.tsx'] = require.extensions['.ts'];
const { IDBFactory } = require('fake-indexeddb');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { LibraryDatabase, LibraryDatabaseError } = require('../src/services/libraryDatabase.ts');
const { LibraryRepository, readLibrarySnapshot } = require('../src/services/libraryRepository.ts');
const { LibraryImportSession, canSaveLibraryImport, summarizeImportPlan } = require('../src/services/libraryImportSession.ts');
const { LibraryQueryService } = require('../src/services/libraryQuery.ts');
const { importClasses } = require('../src/engine/classImporter.ts');
const ContentImportPanel = require('../src/components/content/ContentImportPanel.tsx').default;
const fixture=()=>fs.readFileSync(require('node:path').join(__dirname,'fixtures/fictive-classes.json'),'utf8');
const simple=(message='Un pli fictif.')=>JSON.stringify({feat:[{name:'Pli fictif',source:'FICTIF',entries:[message]}]});
const file=(text,name='fictif.json')=>({name,text:async()=>text});
const render=session=>renderToStaticMarkup(React.createElement(ContentImportPanel,{session}));
async function setup(t) {
  const factory=new IDBFactory();const database=new LibraryDatabase({factory});const repository=new LibraryRepository(database);
  const session=new LibraryImportSession(repository);t.after(()=>session.close());return {database,repository,session,factory};
}
function acceptAll(session) {
  for(const decision of session.getSnapshot().plan.decisions) if(decision.kind==='update') session.acceptUpdate(decision.identity.id,true);
}

test('sélection : analyse et plan seuls, aucune écriture avant confirmation',async t=>{
  const {session,database}=await setup(t);const phases=[];session.subscribe(()=>phases.push(session.getSnapshot().phase));
  await session.selectFile(file(fixture()),'test-source');
  const state=session.getSnapshot();assert.equal(state.phase,'confirmation');assert.equal(state.analysis.report.sourceId,'test-source');
  assert.deepEqual(summarizeImportPlan(state.plan),{created:7,unchanged:0,updated:0,conflicts:0,unidentified:0});
  assert.deepEqual(phases,['reading','preparing','confirmation']);assert.equal(canSaveLibraryImport(state),true);
  assert.equal((await readLibrarySnapshot(database)).imports.length,0);
  const html=render(session);assert.ok(html.includes('Enregistrer dans la bibliothèque'));assert.ok(html.includes('7 nouveau(x)'));
});

test('premier import confirmé : bilan après transaction et contenus persistants',async t=>{
  const {session,database}=await setup(t);await session.selectFile(file(fixture()));
  const result=await session.save();assert.equal(result.success,true);assert.equal(session.getSnapshot().phase,'success');
  assert.ok(session.getSnapshot().message.includes('7 nouveau(x)'));assert.equal(canSaveLibraryImport(session.getSnapshot()),false);
  database.close();const query=new LibraryQueryService(database);assert.equal((await query.consult()).length,7);
});

test('réimport identique : message fichier déjà importé et absence de doublons',async t=>{
  const {session,database}=await setup(t);await session.selectFile(file(fixture()));await session.save();
  await session.selectFile(file(fixture()));const plan=session.getSnapshot().plan;
  assert.equal(plan.alreadyImported,true);assert.equal(summarizeImportPlan(plan).unchanged,7);
  assert.ok(render(session).includes('Ce fichier a déjà été importé'));
  assert.equal((await session.save()).success,true);
  const snapshot=await readLibrarySnapshot(database);assert.equal(snapshot.imports.length,1);assert.equal(snapshot.revisions.length,7);
});

test('mise à jour refusée tant que la case n’est pas cochée, accord révocable',async t=>{
  const {session,database}=await setup(t);await session.selectFile(file(simple()));await session.save();
  await session.selectFile(file(simple('Une modification fictive.')));const plan=session.getSnapshot().plan;
  assert.equal(summarizeImportPlan(plan).updated,1);assert.equal(canSaveLibraryImport(session.getSnapshot()),false);
  assert.equal(await session.save(),null);assert.equal((await readLibrarySnapshot(database)).revisions.length,1);
  acceptAll(session);assert.equal(canSaveLibraryImport(session.getSnapshot()),true);
  session.acceptUpdate(plan.items[0].identity.id,false);assert.equal(canSaveLibraryImport(session.getSnapshot()),false);
  const html=render(session);assert.ok(html.includes('type="checkbox"'));assert.ok(html.includes('J’autorise la mise à jour'));
  acceptAll(session);assert.equal((await session.save()).updated,1);assert.equal((await readLibrarySnapshot(database)).revisions.length,2);
});

test('conflit bloquant : bouton désactivé, aucun appel au commit',async t=>{
  const {session,database,repository}=await setup(t);let calls=0;repository.commitImport=async()=>{calls++;throw Error('Ne doit pas être appelé');};
  await session.selectFile(file(JSON.stringify({feat:[{name:'Pli',source:'FICTIF',entries:['A']},{name:'Pli',source:'FICTIF',entries:['B']}]})));
  assert.equal(summarizeImportPlan(session.getSnapshot().plan).conflicts,1);assert.equal(canSaveLibraryImport(session.getSnapshot()),false);
  assert.equal(await session.save(),null);assert.equal(calls,0);assert.equal((await readLibrarySnapshot(database)).imports.length,0);
  assert.ok(render(session).includes('définitions contradictoires'));
});

test('échec de transaction : données analysées et prévisualisation conservées, réessai possible',async t=>{
  const {session,repository,database}=await setup(t);await session.selectFile(file(fixture()));
  const analysis=session.getSnapshot().analysis;const original=repository.commitImport.bind(repository);
  repository.commitImport=async()=>({success:false,reason:'storage-error',storageCode:'quota',issues:['Quota simulé.']});
  assert.equal((await session.save()).success,false);assert.equal(session.getSnapshot().phase,'error');
  assert.equal(session.getSnapshot().analysis,analysis);assert.ok(session.getSnapshot().message.includes('stockage insuffisant'));
  assert.equal(canSaveLibraryImport(session.getSnapshot()),true);assert.equal((await readLibrarySnapshot(database)).imports.length,0);
  assert.ok(render(session).includes('Prévisualiser les classes'));
  repository.commitImport=original;assert.equal((await session.save()).success,true);
});

test('plan obsolète : accords effacés, nouvelle analyse obligatoire avant confirmation',async t=>{
  const {session,repository,database}=await setup(t);await session.selectFile(file(simple()));await session.save();
  await session.selectFile(file(simple('Modification proposée.')));acceptAll(session);
  const external=await repository.prepareImport({text:JSON.stringify({feat:[{name:'Autre pli',source:'FICTIF'}]}),filename:'autre.json'});
  await repository.commitImport(external);
  const result=await session.save();assert.equal(result.reason,'concurrent-change');assert.equal(session.getSnapshot().phase,'stale');
  assert.deepEqual(session.getSnapshot().acceptedUpdates,[]);assert.equal(canSaveLibraryImport(session.getSnapshot()),false);
  assert.ok(render(session).includes('Réanalyser le fichier'));
  await session.reanalyze();assert.equal(session.getSnapshot().phase,'confirmation');assert.equal(canSaveLibraryImport(session.getSnapshot()),false);
  acceptAll(session);assert.equal((await session.save()).success,true);assert.equal((await readLibrarySnapshot(database)).revisions.length,3);
});

test('doubles clics : un seul commit et aucun succès avant résolution de la transaction',async t=>{
  const {session,repository}=await setup(t);await session.selectFile(file(simple()));let resolve;let calls=0;
  repository.commitImport=()=>{calls++;return new Promise(done=>{resolve=done;});};
  const first=session.save();const second=session.save();assert.equal(session.getSnapshot().phase,'saving');assert.equal(calls,1);
  assert.equal(await second,null);assert.equal(session.getSnapshot().outcome,null);
  const html=render(session);assert.ok(html.includes('Enregistrement en cours'));assert.ok(!html.includes('Enregistrement terminé'));
  resolve({success:true,created:1,updated:0,unchanged:0});assert.equal((await first).success,true);assert.equal(session.getSnapshot().phase,'success');
});

test('prévisualisation existante : références et conversion de classes conservées après analyse et erreur',async t=>{
  const {session}=await setup(t);await session.selectFile(file(fixture()));
  const analysis=session.getSnapshot().analysis;assert.equal(analysis.success,true);assert.ok(analysis.featureLinks.length>0);
  assert.equal(analysis.unresolvedFeatures,0);
  for(const source of ['PHB','XPHB']) assert.equal(importClasses(analysis,source).classes.length,1);
  const html=render(session);assert.ok(html.includes('Rapport d&#x27;analyse'));assert.ok(html.includes('Relations entre les capacités'));
  assert.ok(html.includes('Prévisualisation des classes'));assert.ok(html.includes('Prévisualiser les classes'));
});

test('erreur de préparation : analyse conservée et réanalyse avec le texte exact sans relire le fichier',async t=>{
  const {session,repository,database}=await setup(t);let reads=0;const original=repository.prepareImport.bind(repository);
  repository.prepareImport=async()=>{throw new LibraryDatabaseError('blocked','Bloquée');};
  await session.selectFile({name:'fictif.json',text:async()=>{reads++;return fixture();}});
  assert.equal(session.getSnapshot().phase,'error');assert.equal(session.getSnapshot().analysis.success,true);assert.equal(session.getSnapshot().plan,null);
  assert.ok(session.getSnapshot().message.includes('autre connexion'));assert.equal(canSaveLibraryImport(session.getSnapshot()),false);
  repository.prepareImport=original;await session.reanalyze();assert.equal(reads,1);assert.equal(session.getSnapshot().phase,'confirmation');
  assert.equal((await readLibrarySnapshot(database)).imports.length,0);
});

test('sélection suivante efface accords, erreurs, bilan et plan précédents',async t=>{
  const {session}=await setup(t);await session.selectFile(file(simple()));await session.save();
  await session.selectFile(file(simple('Nouvelle révision.')));acceptAll(session);
  await session.selectFile(file(fixture()));assert.deepEqual(session.getSnapshot().acceptedUpdates,[]);
  assert.equal(session.getSnapshot().outcome,null);assert.equal(session.getSnapshot().message,'');
  assert.equal(summarizeImportPlan(session.getSnapshot().plan).created,7);
});

test('JSON invalide ou extension incorrecte : aucun plan enregistrable',async t=>{
  const {session,database}=await setup(t);await session.selectFile(file('{bad'));
  assert.equal(session.getSnapshot().analysis.success,false);assert.equal(canSaveLibraryImport(session.getSnapshot()),false);
  await session.selectFile(file('{}','fichier.txt'));assert.equal(session.getSnapshot().analysis,null);assert.ok(session.getSnapshot().message.includes('fichier JSON'));
  assert.equal((await readLibrarySnapshot(database)).imports.length,0);
});

test('fermeture pendant préparation : résultat tardif ignoré et aucune écriture',async t=>{
  const {session,repository,database}=await setup(t);let resolve;const original=repository.prepareImport.bind(repository);
  repository.prepareImport=async input=>{const plan=await original(input);await new Promise(done=>{resolve=done;});return plan;};
  const pending=session.selectFile(file(simple()));while(!resolve) await new Promise(done=>setImmediate(done));
  session.close();resolve();assert.equal(await pending,null);assert.equal(session.getSnapshot().plan,null);
  assert.equal((await readLibrarySnapshot(database)).imports.length,0);
});
