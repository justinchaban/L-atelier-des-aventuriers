// Charge les modules TypeScript en mémoire, sans compilation sur disque.
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, filename);
};
const { IDBFactory }=require('fake-indexeddb');
const { LibraryDatabase }=require('../src/services/libraryDatabase.ts');
const { LibraryRepository,readLibrarySnapshot }=require('../src/services/libraryRepository.ts');
const { LibraryManagementService,libraryAffectedDependents }=require('../src/services/libraryManagement.ts');
const { LibraryQueryService,filterLibraryEntries }=require('../src/services/libraryQuery.ts');
const { LibraryBackupService }=require('../src/services/libraryBackupService.ts');
const { canonicalLibrarySnapshot }=require('../src/engine/libraryBackup.ts');
const fixture=()=>JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'fixtures/fictive-classes.json'),'utf8'));
async function setup(t){const factory=new IDBFactory();const database=new LibraryDatabase({factory});const repo=new LibraryRepository(database);const management=new LibraryManagementService(database);const query=new LibraryQueryService(database);t.after(()=>management.close());return {factory,database,repo,management,query};}
async function seed(repo,data=fixture()){const plan=await repo.prepareImport({text:JSON.stringify(data),filename:'fictif.json'});assert.equal((await repo.commitImport(plan,{acceptedUpdates:plan.decisions.filter(d=>d.kind==='update').map(d=>d.identity.id)})).success,true);}
const confirmed={confirmed:true};
const findClass=snapshot=>snapshot.contents.find(item=>item.identity.category==='class'&&item.identity.bookId==='PHB');
const same=(a,b)=>assert.deepEqual(canonicalLibrarySnapshot(a),canonicalLibrarySnapshot(b));

test('archivage et restauration : statuts, générations, données historiques strictement conservées',async t=>{
 const {repo,database,management}=await setup(t);await seed(repo);const before=await readLibrarySnapshot(database);const target=findClass(before);
 const plan=await management.prepare(target.identity.id,'archive');assert.ok(plan.affected.length>0);assert.equal(plan.expected.generation,target.generation);
 assert.equal((await management.confirm(plan)).reason,'confirmation-required');same(await readLibrarySnapshot(database),before);
 assert.equal((await management.confirm(plan,confirmed)).success,true);
 const archived=await readLibrarySnapshot(database);assert.equal(findClass(archived).status,'archived');assert.equal(findClass(archived).generation,target.generation+1);
 assert.deepEqual(archived.imports,before.imports);assert.deepEqual(archived.revisions,before.revisions);assert.deepEqual(archived.dependencies,before.dependencies);
 assert.deepEqual(archived.contents.filter(item=>item.identity.id!==target.identity.id),before.contents.filter(item=>item.identity.id!==target.identity.id));
 const restore=await management.prepare(target.identity.id,'restore');assert.equal((await management.confirm(restore,confirmed)).success,true);
 const after=await readLibrarySnapshot(database);assert.equal(findClass(after).status,'active');assert.equal(findClass(after).generation,target.generation+2);
 assert.deepEqual(after.imports,before.imports);assert.deepEqual(after.revisions,before.revisions);assert.deepEqual(after.dependencies,before.dependencies);
});

test('archives masquées par défaut, accessibles avec filtres explicites',async t=>{
 const {repo,database,management,query}=await setup(t);await seed(repo);const target=findClass(await readLibrarySnapshot(database));
 await management.confirm(await management.prepare(target.identity.id,'archive'),confirmed);
 const views=await query.consult();assert.equal(views.length,7);assert.equal(filterLibraryEntries(views).length,6);
 assert.equal(filterLibraryEntries(views,{status:'archived'}).length,1);assert.equal(filterLibraryEntries(views,{status:'all'}).length,7);
});

test('activation ancienne révision : projection active remplacée, originaux et révisions inchangés',async t=>{
 const {repo,database,management}=await setup(t);const data=fixture();await seed(repo,data);
 const first=await readLibrarySnapshot(database);const target=findClass(first);
 const changed=structuredClone(data.class[0]);changed.classFeatures=[];await seed(repo,{class:[changed]});
 const before=await readLibrarySnapshot(database);const current=findClass(before);assert.notEqual(current.activeRevision,target.activeRevision);
 const plan=await management.prepare(target.identity.id,'activate-revision',target.activeRevision);
 assert.equal((await management.confirm(plan,confirmed)).success,true);
 const after=await readLibrarySnapshot(database);assert.equal(findClass(after).activeRevision,target.activeRevision);assert.equal(findClass(after).generation,current.generation+1);
 assert.deepEqual(after.imports,before.imports);assert.deepEqual(after.revisions,before.revisions);
 assert.deepEqual(after.contents.filter(item=>item.identity.id!==target.identity.id),before.contents.filter(item=>item.identity.id!==target.identity.id));
 const historical=first.revisions.find(revision=>revision.contentId===target.identity.id&&revision.revisionHash===target.activeRevision);
 assert.deepEqual(after.dependencies.filter(edge=>edge.ownerId===target.identity.id),historical.dependencies);
});

test('historique consultable : marqueur actif, descriptions de chaque révision et aucune écriture',async t=>{
 const {repo,database,query}=await setup(t);const data={feat:[{name:'Pli historique',source:'FICTIF',entries:['Première version.']}]};await seed(repo,data);
 data.feat[0].entries=['Seconde version.'];await seed(repo,data);const before=await readLibrarySnapshot(database);
 const history=await query.history(before.contents[0].identity.id);assert.equal(history.length,2);assert.equal(history.filter(view=>view.isActive).length,1);
 assert.deepEqual(new Set(history.map(view=>view.details.originalEntry.entries[0])),new Set(['Première version.','Seconde version.']));
 same(await readLibrarySnapshot(database),before);
});

test('persistance après fermeture et réouverture',async t=>{
 const {repo,database,management,query}=await setup(t);await seed(repo);const target=findClass(await readLibrarySnapshot(database));
 await management.confirm(await management.prepare(target.identity.id,'archive'),confirmed);const before=await readLibrarySnapshot(database);
 database.close();await database.open();same(await readLibrarySnapshot(database),before);assert.equal((await query.history(target.identity.id))[0].isActive,true);
});

test('action obsolète après une autre écriture : refus sans modification',async t=>{
 const {repo,database,management}=await setup(t);await seed(repo);const target=findClass(await readLibrarySnapshot(database));const plan=await management.prepare(target.identity.id,'archive');
 await seed(repo,{feat:[{name:'Autre pli',source:'FICTIF'}]});const before=await readLibrarySnapshot(database);
 assert.equal((await management.confirm(plan,confirmed)).reason,'concurrent-change');same(await readLibrarySnapshot(database),before);
});

test('deux opérations concurrentes : une seule gagne, génération incrémentée une seule fois',async t=>{
 const {repo,database,management,factory}=await setup(t);await seed(repo);const target=findClass(await readLibrarySnapshot(database));
 const otherDb=new LibraryDatabase({factory});const other=new LibraryManagementService(otherDb);t.after(()=>other.close());
 const [a,b]=await Promise.all([management.prepare(target.identity.id,'archive'),other.prepare(target.identity.id,'archive')]);
 const results=await Promise.all([management.confirm(a,confirmed),other.confirm(b,confirmed)]);
 assert.equal(results.filter(result=>result.success).length,1);assert.equal(results.filter(result=>result.reason==='concurrent-change').length,1);
 assert.equal(findClass(await readLibrarySnapshot(database)).generation,target.generation+1);
});

test('dépendances présentes, absentes, archivées et différentes identifiées sans réparation',async t=>{
 const {repo,database,management}=await setup(t);const data=fixture();await seed(repo,{class:data.class});
 let target=findClass(await readLibrarySnapshot(database));let plan=await management.prepare(target.identity.id,'archive');assert.ok(plan.dependencies.some(edge=>edge.availability==='missing'));
 await seed(repo,{classFeature:data.classFeature,subclass:data.subclass,subclassFeature:data.subclassFeature});await seed(repo,{class:data.class});
 let snapshot=await readLibrarySnapshot(database);target=findClass(snapshot);plan=await management.prepare(target.identity.id,'archive');assert.ok(plan.dependencies.every(edge=>edge.availability==='available'));
 const feature=snapshot.contents.find(item=>item.identity.category==='classFeature'&&item.identity.bookId==='PHB');
 await management.confirm(await management.prepare(feature.identity.id,'archive'),confirmed);
 plan=await management.prepare(target.identity.id,'archive');assert.ok(plan.dependencies.some(edge=>edge.availability==='archived'));
 await management.confirm(await management.prepare(feature.identity.id,'restore'),confirmed);
 const changed=structuredClone(data.classFeature[0]);changed.entries=['Capacité fictive révisée.'];await seed(repo,{classFeature:[changed]});
 plan=await management.prepare(target.identity.id,'archive');assert.ok(plan.dependencies.some(edge=>edge.availability==='different-revision'));
 const before=await readLibrarySnapshot(database);assert.ok(libraryAffectedDependents(before,feature.identity.id).some(item=>item.id===target.identity.id));same(await readLibrarySnapshot(database),before);
});

test('erreur après écriture et modification de projection : transaction entièrement annulée',async t=>{
 const {repo,database,management}=await setup(t);const data=fixture();await seed(repo,data);const old=findClass(await readLibrarySnapshot(database));
 const changed=structuredClone(data.class[0]);changed.classFeatures=[];await seed(repo,{class:[changed]});
 const plan=await management.prepare(old.identity.id,'activate-revision',old.activeRevision);const before=await readLibrarySnapshot(database);
 const original=database.runTransaction.bind(database);database.runTransaction=(stores,mode,work)=>original(stores,mode,ctx=>{
 const store=ctx.store.bind(ctx);work({...ctx,store(name){const object=store(name);if(mode==='readwrite'&&name==='dependencies')object.add=()=>{throw new DOMException('quota simulé','QuotaExceededError');};return object;}});
 });
 const result=await management.confirm(plan,confirmed);assert.equal(result.success,false);assert.equal(result.storageCode,'quota');database.runTransaction=original;same(await readLibrarySnapshot(database),before);
});

test('compatibilité export/restauration après archive et changement de révision',async t=>{
 const source=await setup(t),destination=await setup(t);const data=fixture();await seed(source.repo,data);const target=findClass(await readLibrarySnapshot(source.database));
 const changed=structuredClone(data.class[0]);changed.classFeatures=[];await seed(source.repo,{class:[changed]});
 await source.management.confirm(await source.management.prepare(target.identity.id,'activate-revision',target.activeRevision),confirmed);
 await source.management.confirm(await source.management.prepare(target.identity.id,'archive'),confirmed);
 const backup=new LibraryBackupService(source.database),restore=new LibraryBackupService(destination.database);const text=await backup.exportBackup();
 assert.equal((await restore.restore(await restore.previewRestore(text),confirmed)).success,true);
 same(await readLibrarySnapshot(destination.database),await readLibrarySnapshot(source.database));
});

test('activation sur un contenu archivé ne le restaure pas implicitement',async t=>{
 const {repo,database,management}=await setup(t);await seed(repo,{feat:[{name:'Pli',source:'FICTIF',entries:['A']}]});
 const original=(await readLibrarySnapshot(database)).contents[0];await seed(repo,{feat:[{name:'Pli',source:'FICTIF',entries:['B']}]});
 await management.confirm(await management.prepare(original.identity.id,'archive'),confirmed);
 const plan=await management.prepare(original.identity.id,'activate-revision',original.activeRevision);assert.ok(plan.warnings.some(warning=>warning.includes('restera archivé')));
 await management.confirm(plan,confirmed);assert.equal((await readLibrarySnapshot(database)).contents[0].status,'archived');
});

test('plans étrangers, transitions invalides et révisions inconnues refusés',async t=>{
 const {repo,database,management}=await setup(t);await seed(repo);const target=findClass(await readLibrarySnapshot(database));
 await assert.rejects(management.prepare(target.identity.id,'restore'));await assert.rejects(management.prepare(target.identity.id,'activate-revision',target.activeRevision));
 await assert.rejects(management.prepare(target.identity.id,'activate-revision','sha256:v1:'+'0'.repeat(64)));
 const plan=await management.prepare(target.identity.id,'archive');assert.equal(Object.isFrozen(plan),true);
 assert.equal((await management.confirm(structuredClone(plan),confirmed)).reason,'invalid-data');
});

test('ancien format sans snapshot des dépendances : consultation et archivage possibles, activation prudente refusée',async t=>{
 const {repo,database,management,query}=await setup(t);await seed(repo,{feat:[{name:'Pli ancien',source:'FICTIF',entries:['A']}]});
 let snapshot=await readLibrarySnapshot(database);const content=snapshot.contents[0];const legacy=structuredClone(snapshot.revisions[0]);delete legacy.dependencies;
 await database.write([{store:'revisions',operation:'put',value:legacy}]);await seed(repo,{feat:[{name:'Pli ancien',source:'FICTIF',entries:['B']}]});
 assert.equal((await query.history(content.identity.id)).length,2);
 await assert.rejects(management.prepare(content.identity.id,'activate-revision',content.activeRevision),/dépendances/);
 const plan=await management.prepare(content.identity.id,'archive');assert.equal((await management.confirm(plan,confirmed)).success,true);
});


require.extensions['.tsx']=require.extensions['.ts'];
test('rendu des actions : archiver ou restaurer selon le statut, aucune écriture au rendu',async t=>{
 const {repo,database,management,query}=await setup(t);await seed(repo);const entry=(await query.consult()).find(entry=>entry.category==='class');
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
 const Component=require('../src/components/library/LibraryContentManagement.tsx').default;
 const before=await readLibrarySnapshot(database);let html=renderToStaticMarkup(React.createElement(Component,{entry,onChanged:()=>{}}));
 assert.ok(html.includes('Archiver'));assert.ok(html.includes('Historique des révisions'));assert.ok(!html.includes('Confirmer l’opération'));same(await readLibrarySnapshot(database),before);
 await management.confirm(await management.prepare(entry.id,'archive'),confirmed);const archived=(await query.consult()).find(item=>item.id===entry.id);
 html=renderToStaticMarkup(React.createElement(Component,{entry:archived,onChanged:()=>{}}));assert.ok(html.includes('Restaurer'));
});
