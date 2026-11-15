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
const { IDBFactory } = require('fake-indexeddb');
const { LibraryDatabase } = require('../src/services/libraryDatabase.ts');
const { LibraryRepository, readLibrarySnapshot } = require('../src/services/libraryRepository.ts');
const { LibraryBackupService } = require('../src/services/libraryBackupService.ts');
const { createLibraryBackup, parseLibraryBackup, canonicalLibrarySnapshot } = require('../src/engine/libraryBackup.ts');
const { fingerprintLibraryJson, serializeLibraryJson } = require('../src/engine/libraryIdentity.ts');
const empty=()=>({imports:[],contents:[],revisions:[],dependencies:[]});
const fixture=()=>fs.readFileSync(require('node:path').join(__dirname,'fixtures/fictive-classes.json'),'utf8');
const date='2026-01-02T03:04:05.000Z';
async function setup(t){
  const factory=new IDBFactory();const database=new LibraryDatabase({factory});const repo=new LibraryRepository(database);const backup=new LibraryBackupService(database);
  t.after(()=>backup.close());return {factory,database,repo,backup};
}
async function seed(repo,text=fixture(),filename='fictif.json') {
  const plan=await repo.prepareImport({text,filename});
  assert.equal((await repo.commitImport(plan,{acceptedUpdates:plan.decisions.filter(d=>d.kind==='update').map(d=>d.identity.id)})).success,true);
}
async function resign(backup){const {integrity,...body}=backup;return JSON.stringify({...body,integrity:{algorithm:'SHA-256',value:await fingerprintLibraryJson(body)}});}
const same=(a,b)=>assert.equal(serializeLibraryJson(canonicalLibrarySnapshot(a)),serializeLibraryJson(canonicalLibrarySnapshot(b)));

test('export vide versionné, horodaté et vérifié par SHA-256',async t=>{
  const {backup}=await setup(t);const text=await backup.exportBackup();const parsed=await parseLibraryBackup(text);
  assert.equal(parsed.format,'atelier-aventuriers:library-backup');assert.equal(parsed.formatVersion,1);
  assert.equal(parsed.compatibility.databaseVersion,1);assert.ok(Number.isFinite(Date.parse(parsed.exportedAt)));
  assert.equal(parsed.integrity.algorithm,'SHA-256');assert.deepEqual(parsed.data,empty());
});

test('export déterministe indépendamment de l’ordre des magasins, date explicite constante',async t=>{
  const {repo,database}=await setup(t);await seed(repo);const data=await readLibrarySnapshot(database);
  const shuffled=Object.fromEntries(Object.entries(data).reverse().map(([key,value])=>[key,[...value].reverse()]));
  assert.equal(await createLibraryBackup(data,date),await createLibraryBackup(shuffled,date));
  const parsed=await parseLibraryBackup(await createLibraryBackup(data,date));
  const {integrity,...body}=parsed;assert.equal(integrity.value,await fingerprintLibraryJson(body));
});

test('sauvegarde puis restauration atomique avec égalité de toutes les données',async t=>{
  const source=await setup(t);const destination=await setup(t);await seed(source.repo);
  const original=JSON.parse(fixture());original.classFeature[0].entries=['Description fictive révisée.'];
  await seed(source.repo,JSON.stringify({classFeature:[original.classFeature[0]]}),'modifie.json');
  const before=await readLibrarySnapshot(source.database);const text=await source.backup.exportBackup();
  const preview=await destination.backup.previewRestore(text);assert.equal(preview.destinationEmpty,true);assert.equal(preview.counts.contents,7);
  assert.deepEqual(await readLibrarySnapshot(destination.database),empty());
  const result=await destination.backup.restore(preview,{confirmed:true});assert.equal(result.success,true);
  same(await readLibrarySnapshot(destination.database),before);
  const restored=await readLibrarySnapshot(destination.database);assert.equal(restored.revisions.length,8);
  assert.equal(restored.imports.find(d=>d.filenames.includes('fictif.json')).originalText,fixture());
  destination.database.close();await destination.database.open();same(await readLibrarySnapshot(destination.database),before);
});

test('export ne modifie pas la base et conserve les conversions historiques',async t=>{
  const {repo,database,backup}=await setup(t);await seed(repo);const snapshot=await readLibrarySnapshot(database);
  const revision=snapshot.revisions.find(r=>r.conversions[0].result.status==='converted');
  const old=structuredClone(revision.conversions[0]);old.converter.version='ancienne';revision.conversions.push(old);
  await database.write([{store:'revisions',operation:'put',value:revision}]);
  const before=await readLibrarySnapshot(database);const parsed=await parseLibraryBackup(await backup.exportBackup());
  same(before,parsed.data);same(await readLibrarySnapshot(database),before);
});

test('altération du fichier : empreinte globale incorrecte, aucune écriture',async t=>{
  const {repo,backup,database}=await setup(t);await seed(repo);const exported=JSON.parse(await backup.exportBackup());
  exported.data.imports[0].originalText+=' ';const before=await readLibrarySnapshot(database);
  await assert.rejects(backup.previewRestore(JSON.stringify(exported)),error=>error.code==='integrity');same(await readLibrarySnapshot(database),before);
});

test('format, versions et JSON incompatibles refusés',async()=>{
  const valid=JSON.parse(await createLibraryBackup(empty(),date));
  for(const change of [b=>{b.format='autre';},b=>{b.formatVersion=2;},b=>{b.compatibility.databaseVersion=2;},b=>{b.compatibility.recordVersion=2;},b=>{b.compatibility.identityVersion=2;},b=>{b.compatibility.canonicalization='autre';}]) {
    const altered=structuredClone(valid);change(altered);await assert.rejects(parseLibraryBackup(await resign(altered)),error=>error.code==='incompatible');
  }
  await assert.rejects(parseLibraryBackup('{bad'),error=>error.code==='invalid-data');
});

test('validation profonde même après recalcul de l’empreinte globale',async t=>{
  const {repo,backup}=await setup(t);await seed(repo);const valid=JSON.parse(await backup.exportBackup());
  for(const change of [
    b=>{b.data.imports[0].originalText+=' ';},
    b=>{b.data.contents[0].activeRevision='sha256:v1:'+'0'.repeat(64);},
    b=>{b.data.revisions[0].origins[0].location.pointer='/class/999';},
    b=>{b.data.revisions[0].origins[0].originalSource='AUTRE';},
    b=>{b.data.contents[0].identity.bookId='autre';},
    b=>{b.data.contents.find(item=>item.identity.classOwner).identity.classOwner.name='VEILLEUR DE PAPIER';},
    b=>{b.data.revisions[0].createdAt='pas une date';},
    b=>{b.data.revisions[0].conversions[0].dependencies=[{ownerId:'invalide',targetId:'invalide',relation:'copy'}];},
    b=>{b.data.imports.push(structuredClone(b.data.imports[0]));},
    b=>{b.data.revisions.push(structuredClone(b.data.revisions[0]));},
    b=>{b.data.dependencies.push(structuredClone(b.data.dependencies[0]));}
  ]) {const altered=structuredClone(valid);change(altered);await assert.rejects(parseLibraryBackup(await resign(altered)),error=>error.code==='invalid-data');}
});

test('payload converti mal formé et lien de dépendance manquant refusés',async t=>{
  const {repo,backup}=await setup(t);await seed(repo);const valid=JSON.parse(await backup.exportBackup());
  const malformed=structuredClone(valid);malformed.data.revisions.find(r=>r.conversions[0].result.status==='converted').conversions[0].result.payload.data.hitDie='huit';
  await assert.rejects(parseLibraryBackup(await resign(malformed)),error=>error.code==='invalid-data');
  const missing=structuredClone(valid);missing.data.dependencies.pop();
  await assert.rejects(parseLibraryBackup(await resign(missing)),error=>error.code==='invalid-data');
});

test('confirmation obligatoire, fusion et remplacement désactivés',async t=>{
  const {backup,database}=await setup(t);const preview=await backup.previewRestore(await createLibraryBackup(empty(),date));
  assert.equal((await backup.restore(preview)).reason,'confirmation-required');
  for(const mode of ['merge','replace'])assert.equal((await backup.restore(preview,{confirmed:true,mode})).reason,'unsupported-mode');
  assert.equal((await backup.restore(structuredClone(preview),{confirmed:true})).reason,'invalid-data');
  assert.deepEqual(await readLibrarySnapshot(database),empty());
});

test('bibliothèque non vide : refus explicite et données existantes conservées',async t=>{
  const {repo,backup,database}=await setup(t);await seed(repo);const before=await readLibrarySnapshot(database);
  const preview=await backup.previewRestore(await createLibraryBackup(empty(),date));assert.equal(preview.destinationEmpty,false);
  assert.equal((await backup.restore(preview,{confirmed:true})).reason,'non-empty');same(await readLibrarySnapshot(database),before);
});

test('ajout concurrent après prévisualisation : restauration entière refusée',async t=>{
  const source=await setup(t),destination=await setup(t);await seed(source.repo);
  const preview=await destination.backup.previewRestore(await source.backup.exportBackup());
  await seed(destination.repo,JSON.stringify({feat:[{name:'Pli concurrent',source:'FICTIF'}]}));
  const before=await readLibrarySnapshot(destination.database);
  assert.equal((await destination.backup.restore(preview,{confirmed:true})).reason,'non-empty');same(await readLibrarySnapshot(destination.database),before);
});

test('erreur tardive : rollback complet de la restauration',async t=>{
  const source=await setup(t),destination=await setup(t);await seed(source.repo);
  const preview=await destination.backup.previewRestore(await source.backup.exportBackup());
  const original=destination.database.runTransaction.bind(destination.database);
  destination.database.runTransaction=(stores,mode,work)=>original(stores,mode,ctx=> {
    const store=ctx.store.bind(ctx);
    work({...ctx,store(name){const object=store(name);if(mode==='readwrite'&&name==='dependencies')object.add=()=>{throw new DOMException('Quota simulé','QuotaExceededError');};return object;}});
  });
  const result=await destination.backup.restore(preview,{confirmed:true});assert.equal(result.success,false);assert.equal(result.storageCode,'quota');
  destination.database.runTransaction=original;assert.deepEqual(await readLibrarySnapshot(destination.database),empty());
});

test('cibles non résolues légitimes préservées sans faux liens',async t=>{
  const {repo,backup}=await setup(t);const data=JSON.parse(fixture());await seed(repo,JSON.stringify({class:data.class}));
  const parsed=await parseLibraryBackup(await backup.exportBackup());assert.ok(parsed.data.dependencies.some(d=>!d.revisionHash));
});

test('bibliothèque contenant seulement un original sans identité : non vide et sauvegardable',async t=>{
  const {repo,backup,database}=await setup(t);await seed(repo,JSON.stringify({feat:[{name:'Sans source'}]}));
  const text=await backup.exportBackup();const parsed=await parseLibraryBackup(text);assert.equal(parsed.data.imports.length,1);assert.equal(parsed.data.contents.length,0);
  const preview=await backup.previewRestore(text);assert.equal(preview.destinationEmpty,false);
  assert.equal((await backup.restore(preview,{confirmed:true})).reason,'non-empty');assert.equal((await readLibrarySnapshot(database)).imports.length,1);
});


require.extensions['.tsx']=require.extensions['.ts'];
test('panneau de sauvegarde : export et sélection disponibles, aucune restauration automatique',()=>{
  const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
  const Panel=require('../src/components/library/LibraryBackupPanel.tsx').default;
  const html=renderToStaticMarkup(React.createElement(Panel,{}));
  assert.ok(html.includes('Exporter ma bibliothèque'));assert.ok(html.includes('Restaurer une sauvegarde'));
  assert.ok(!html.includes('Confirmer la restauration'));assert.ok(html.includes('type="file"'));
});

test('fermeture pendant validation : aucune ouverture tardive de la destination',async t=>{
  const {backup,database}=await setup(t);let reads=0;
  const original=database.runTransaction.bind(database);database.runTransaction=(...args)=>{reads++;return original(...args);};
  const text=await createLibraryBackup(empty(),date);const pending=backup.previewRestore(text);backup.close();
  await assert.rejects(pending,error=>error.code==='invalid-data');assert.equal(reads,0);
});


test('deux restaurations concurrentes : une seule réussit dans la destination vide',async t=>{
  const source=await setup(t),destination=await setup(t);await seed(source.repo);
  const otherDatabase=new LibraryDatabase({factory:destination.factory});const otherService=new LibraryBackupService(otherDatabase);t.after(()=>otherService.close());
  const text=await source.backup.exportBackup();
  const [first,second]=await Promise.all([destination.backup.previewRestore(text),otherService.previewRestore(text)]);
  const results=await Promise.all([destination.backup.restore(first,{confirmed:true}),otherService.restore(second,{confirmed:true})]);
  assert.equal(results.filter(result=>result.success).length,1);assert.equal(results.filter(result=>result.reason==='non-empty').length,1);
  same(await readLibrarySnapshot(destination.database),(await parseLibraryBackup(text)).data);
});
