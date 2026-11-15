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
const {IDBFactory}=require('fake-indexeddb');
const {LibraryDatabase}=require('../src/services/libraryDatabase.ts');
const {LibraryRepository,readLibrarySnapshot}=require('../src/services/libraryRepository.ts');
const {LibraryIntegrityService}=require('../src/services/libraryIntegrity.ts');
const {LibraryManagementService}=require('../src/services/libraryManagement.ts');
const {LibraryBackupService}=require('../src/services/libraryBackupService.ts');
const {canonicalLibrarySnapshot}=require('../src/engine/libraryBackup.ts');
const {LibraryQueryService}=require('../src/services/libraryQuery.ts');
const fixture=()=>JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'fixtures/fictive-classes.json'),'utf8'));
const alpha=()=>({name:'Objet Alpha',source:'FICTIF',entries:['Description originale alpha.']});
const beta=()=>({name:'Objet Beta',source:'FICTIF',entries:['Description originale beta.']});
async function setup(t){const factory=new IDBFactory();const database=new LibraryDatabase({factory});const repo=new LibraryRepository(database);const integrity=new LibraryIntegrityService(database);t.after(()=>integrity.close());return {factory,database,repo,integrity};}
async function seed(repo,data){const plan=await repo.prepareImport({text:JSON.stringify(data),filename:'fictif.json'});assert.equal((await repo.commitImport(plan,{acceptedUpdates:plan.decisions.filter(d=>d.kind==='update').map(d=>d.identity.id)})).success,true);}
const same=(a,b)=>assert.deepEqual(canonicalLibrarySnapshot(a),canonicalLibrarySnapshot(b));
const find=(snapshot,name)=>snapshot.contents.find(item=>item.identity.normalizedName===name.toLowerCase());
const confirm=plan=>({confirmed:true,typedName:plan.impact.name});

test('diagnostic valide en lecture seule : cycles structurels autorisés distingués',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,fixture());const before=await readLibrarySnapshot(database);
 const report=await integrity.diagnose();assert.equal(report.counts.error,0);assert.equal(report.structurallyValid,true);assert.ok(report.diagnostics.some(item=>item.code==='structural-cycle'&&item.severity==='info'));same(await readLibrarySnapshot(database),before);
});

test('contenu sans révision active, original manquant et conversion incohérente signalés',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha(),beta()]});const original=await readLibrarySnapshot(database);const item=find(original,'Objet Alpha');
 await database.write([{store:'revisions',operation:'delete',key:[item.identity.id,item.activeRevision]},{store:'imports',operation:'delete',key:original.imports[0].id}]);
 const before=await readLibrarySnapshot(database),report=await integrity.diagnose();assert.ok(report.diagnostics.some(item=>item.code==='missing-active-revision'));assert.ok(report.diagnostics.some(item=>item.code==='missing-original'));assert.ok(report.counts.error>0);same(await readLibrarySnapshot(database),before);
 const plan=await integrity.prepareDeletion(item.identity.id);assert.equal(plan.impact.allowed,false);
});

test('révisions référencées absentes et graphe incohérent détectés',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha(),beta()]});const snapshot=await readLibrarySnapshot(database);const a=find(snapshot,'Objet Alpha'),b=find(snapshot,'Objet Beta');
 await database.write([{store:'dependencies',operation:'add',value:{ownerId:b.identity.id,targetId:a.identity.id,relation:'copy',revisionHash:'sha256:v1:'+'0'.repeat(64)}}]);
 const report=await integrity.diagnose();assert.ok(report.diagnostics.some(item=>item.code==='missing-pinned-revision'));assert.ok(report.diagnostics.some(item=>item.code==='active-graph-mismatch'));
});

test('cycle _copy réel bloquant, cycle historique seulement possible averti',async t=>{
 const {repo,integrity}=await setup(t);await seed(repo,{feat:[{...alpha(),_copy:{name:'Objet Beta',source:'FICTIF'}},{...beta(),_copy:{name:'Objet Alpha',source:'FICTIF'}}]});
 const report=await integrity.diagnose();assert.ok(report.diagnostics.some(item=>item.code==='copy-cycle'&&item.severity==='error'));assert.ok(report.diagnostics.some(item=>item.code==='historical-copy-cycle'&&item.severity==='warning'));
});

test('dépendances non résolues absentes : avertissement, pas corruption automatique',async t=>{
 const {repo,integrity}=await setup(t);const data=fixture();await seed(repo,{class:data.class});const report=await integrity.diagnose();assert.equal(report.counts.error,0);assert.ok(report.diagnostics.some(item=>item.code==='missing-dependency-target'&&item.severity==='warning'));
});

test('suppression sans dépendants : nom exact et confirmation obligatoires',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha()]});const item=(await readLibrarySnapshot(database)).contents[0];const plan=await integrity.prepareDeletion(item.identity.id);assert.equal(plan.impact.allowed,true);
 for(const options of [{},{confirmed:true,typedName:'objet alpha'},{confirmed:true,typedName:'Objet Alpha '},{typedName:'Objet Alpha'}])assert.equal((await integrity.deletePermanently(plan,options)).reason,'confirmation-required');
 assert.equal((await integrity.deletePermanently(plan,confirm(plan))).success,true);
 const after=await readLibrarySnapshot(database);assert.equal(after.contents.length,0);assert.equal(after.revisions.length,0);assert.equal(after.imports.length,1);
 const report=await integrity.diagnose();assert.equal(report.counts.error,0);assert.ok(report.diagnostics.some(item=>item.code==='preserved-original'));
});

test('originaux partagés et autres contenus/révisions conservés exactement',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha(),beta()]});await seed(repo,{feat:[{...alpha(),entries:['Nouvelle version alpha.']}]});
 const before=await readLibrarySnapshot(database),target=find(before,'Objet Alpha');const plan=await integrity.prepareDeletion(target.identity.id);assert.equal(plan.impact.allowed,true);assert.equal(plan.impact.revisionsToDelete.length,2);
 assert.equal((await integrity.deletePermanently(plan,confirm(plan))).success,true);const after=await readLibrarySnapshot(database);
 assert.deepEqual(after.imports,before.imports);assert.deepEqual(after.contents,before.contents.filter(item=>item.identity.id!==target.identity.id));assert.deepEqual(after.revisions,before.revisions.filter(item=>item.contentId!==target.identity.id));
 database.close();await database.open();same(await readLibrarySnapshot(database),after);
});

test('dépendants directs et indirects, même archivés : refus sans cascade',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha(),{...beta(),_copy:{name:'Objet Alpha',source:'FICTIF'}},{name:'Objet Gamma',source:'FICTIF',_copy:{name:'Objet Beta',source:'FICTIF'},entries:['Gamma.']}]});
 const before=await readLibrarySnapshot(database),target=find(before,'Objet Alpha');const plan=await integrity.prepareDeletion(target.identity.id);
 assert.equal(plan.impact.allowed,false);assert.ok(plan.impact.dependents.some(item=>item.name==='Objet Beta'&&item.direct));assert.ok(plan.impact.dependents.some(item=>item.name==='Objet Gamma'&&!item.direct));assert.equal((await integrity.deletePermanently(plan,confirm(plan))).reason,'blocked');same(await readLibrarySnapshot(database),before);
 const management=new LibraryManagementService(database);const b=find(before,'Objet Beta');await management.confirm(await management.prepare(b.identity.id,'archive'),{confirmed:true});assert.equal((await integrity.prepareDeletion(target.identity.id)).impact.allowed,false);
});

test('référence dans une ancienne conversion bloque même sans dépendance active',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha(),beta()]});const first=await readLibrarySnapshot(database),a=find(first,'Objet Alpha'),b=find(first,'Objet Beta');
 await seed(repo,{feat:[{...beta(),entries:['Version B2.']}]});const old=structuredClone(first.revisions.find(item=>item.contentId===b.identity.id));
 old.conversions[0].dependencies.push({ownerId:b.identity.id,targetId:a.identity.id,relation:'copy',revisionHash:a.activeRevision});await database.write([{store:'revisions',operation:'put',value:old}]);
 const plan=await integrity.prepareDeletion(a.identity.id);assert.equal(plan.impact.allowed,false);assert.ok(plan.impact.references.some(item=>item.source==='conversion'&&item.revisionHash===old.revisionHash));
});

test('référence dans un original historique et dans un original sans identité conservée',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha(),{...beta(),entries:['Référence à Objet Alpha.']}]});await seed(repo,{feat:[beta()]});
 await seed(repo,{feat:[{name:'Entrée sans source',entries:['Objet Alpha']}]});const target=find(await readLibrarySnapshot(database),'Objet Alpha');const plan=await integrity.prepareDeletion(target.identity.id);
 assert.equal(plan.impact.allowed,false);assert.ok(plan.impact.references.some(item=>item.source==='original'&&item.ownerId));assert.ok(plan.impact.references.some(item=>item.source==='original'&&!item.ownerId));
});

test('alias id original collecté avant les autres entrées, indépendamment de l’ordre',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[{...beta(),entries:['id-alpha-unique']},{...alpha(),id:'id-alpha-unique'}]});const target=find(await readLibrarySnapshot(database),'Objet Alpha');const plan=await integrity.prepareDeletion(target.identity.id);assert.equal(plan.impact.allowed,false);assert.ok(plan.impact.references.some(item=>item.source==='original'));
});

test('formats ou tags non analysables : suppression incertaine refusée',async t=>{
 for(const foreign of [{...beta(),customMechanics:{externalId:'inconnu'}},{...beta(),entries:['{@feat identifiant-opaque}']},{...beta(),entries:[{type:'unresolvedReference',entries:['identifiant-opaque']}]}]){
  const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha(),foreign]});const target=find(await readLibrarySnapshot(database),'Objet Alpha');const plan=await integrity.prepareDeletion(target.identity.id);assert.equal(plan.impact.allowed,false);assert.ok(plan.impact.reasons.some(reason=>reason.includes('non analysable')));
 }
});

test('plan obsolète après ajout : refus avant toute suppression',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha()]});const target=(await readLibrarySnapshot(database)).contents[0];const plan=await integrity.prepareDeletion(target.identity.id);
 await seed(repo,{feat:[beta()]});const before=await readLibrarySnapshot(database);assert.equal((await integrity.deletePermanently(plan,confirm(plan))).reason,'concurrent-change');same(await readLibrarySnapshot(database),before);
});

test('deux suppressions concurrentes : une seule transaction réussit',async t=>{
 const {repo,database,integrity,factory}=await setup(t);await seed(repo,{feat:[alpha()]});const target=(await readLibrarySnapshot(database)).contents[0];const otherDb=new LibraryDatabase({factory});const other=new LibraryIntegrityService(otherDb);t.after(()=>other.close());
 const [a,b]=await Promise.all([integrity.prepareDeletion(target.identity.id),other.prepareDeletion(target.identity.id)]);
 const results=await Promise.all([integrity.deletePermanently(a,confirm(a)),other.deletePermanently(b,confirm(b))]);assert.equal(results.filter(item=>item.success).length,1);assert.equal(results.filter(item=>item.reason==='concurrent-change').length,1);
});

test('erreur tardive après suppression de révisions : rollback complet',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha(),beta()]});const before=await readLibrarySnapshot(database),target=find(before,'Objet Alpha');const plan=await integrity.prepareDeletion(target.identity.id);
 const run=database.runTransaction.bind(database);database.runTransaction=(stores,mode,work)=>run(stores,mode,ctx=>{const store=ctx.store.bind(ctx);work({...ctx,store(name){const object=store(name);if(mode==='readwrite'&&name==='contents')object.delete=()=>{throw new DOMException('quota simulé','QuotaExceededError');};return object;}});});
 const result=await integrity.deletePermanently(plan,confirm(plan));assert.equal(result.success,false);database.runTransaction=run;same(await readLibrarySnapshot(database),before);
});

test('export/restauration et archivage/révisions restent compatibles après suppression',async t=>{
 const source=await setup(t),destination=await setup(t);await seed(source.repo,{feat:[alpha(),beta()]});await seed(source.repo,{feat:[{...beta(),entries:['B2.']}]});const initial=await readLibrarySnapshot(source.database),target=find(initial,'Objet Alpha'),b=find(initial,'Objet Beta');
 const plan=await source.integrity.prepareDeletion(target.identity.id);assert.equal((await source.integrity.deletePermanently(plan,confirm(plan))).success,true);
 const management=new LibraryManagementService(source.database);await management.confirm(await management.prepare(b.identity.id,'archive'),{confirmed:true});
 const query=new LibraryQueryService(source.database);assert.equal((await query.history(b.identity.id)).length,2);
 const backup=new LibraryBackupService(source.database),restore=new LibraryBackupService(destination.database);const text=await backup.exportBackup();assert.equal((await restore.restore(await restore.previewRestore(text),{confirmed:true})).success,true);same(await readLibrarySnapshot(destination.database),await readLibrarySnapshot(source.database));
});

require.extensions['.tsx']=require.extensions['.ts'];
test('interface : diagnostic à la demande et suppression distincte sans écriture au rendu',async t=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const Diagnostics=require('../src/components/library/LibraryDiagnosticsPanel.tsx').default,Deletion=require('../src/components/library/LibraryPermanentDeletion.tsx').default;
 const {repo,database}=await setup(t);await seed(repo,{feat:[alpha()]});const entry=(await new LibraryQueryService(database).consult())[0],before=await readLibrarySnapshot(database);
 const html=renderToStaticMarkup(React.createElement(Deletion,{entry,onDeleted:()=>{}}));assert.ok(html.includes('Supprimer définitivement'));assert.ok(!html.includes('Confirmer la suppression définitive'));assert.ok(html.includes('irréversiblement'));
 assert.ok(renderToStaticMarkup(React.createElement(Diagnostics,{})).includes('Lancer les diagnostics'));same(await readLibrarySnapshot(database),before);
});


test('métadonnées de provenance inconnues : pas de suppression fondée sur une analyse partielle',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[alpha(),beta()]});const snapshot=await readLibrarySnapshot(database),a=find(snapshot,'Objet Alpha'),b=find(snapshot,'Objet Beta');
 const revision=structuredClone(snapshot.revisions.find(item=>item.contentId===b.identity.id));revision.origins[0].externalReference={opaque:'inconnu'};await database.write([{store:'revisions',operation:'put',value:revision}]);
 const plan=await integrity.prepareDeletion(a.identity.id);assert.equal(plan.impact.allowed,false);assert.ok(plan.impact.reasons.some(reason=>reason.includes('provenance non analysables')));
});


test('cache connu de classe analysable, extension inconnue du cache bloquante',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,fixture());await seed(repo,{feat:[alpha()]});const before=await readLibrarySnapshot(database),target=find(before,'Objet Alpha');
 assert.equal((await integrity.prepareDeletion(target.identity.id)).impact.allowed,true);
 const revision=structuredClone(before.revisions.find(item=>item.conversions?.some(conversion=>conversion.result.status==='converted')));revision.conversions[0].result.payload.data.futureLinks={opaque:'inconnu'};
 await database.write([{store:'revisions',operation:'put',value:revision}]);assert.equal((await integrity.prepareDeletion(target.identity.id)).impact.allowed,false);
});


test('suppression d’une feuille avec dépendance sortante : seul son lien est retiré',async t=>{
 const {repo,database,integrity}=await setup(t);await seed(repo,{feat:[{...alpha(),_copy:{name:'Objet Beta',source:'FICTIF'}},beta()]});
 const before=await readLibrarySnapshot(database),target=find(before,'Objet Alpha');assert.equal(before.dependencies.filter(edge=>edge.ownerId===target.identity.id).length,1);
 const plan=await integrity.prepareDeletion(target.identity.id);assert.equal(plan.impact.allowed,true);assert.equal(plan.impact.dependenciesToDelete,1);
 assert.equal((await integrity.deletePermanently(plan,confirm(plan))).success,true);const after=await readLibrarySnapshot(database);assert.equal(after.dependencies.length,0);
 assert.deepEqual(after.contents,before.contents.filter(item=>item.identity.id!==target.identity.id));assert.deepEqual(after.imports,before.imports);assert.equal((await integrity.diagnose()).counts.error,0);
 await new LibraryBackupService(database).exportBackup();
});
