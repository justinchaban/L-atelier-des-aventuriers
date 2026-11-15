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
const { LibraryDatabase } = require('../src/services/libraryDatabase.ts');
const { LibraryRepository, readLibrarySnapshot } = require('../src/services/libraryRepository.ts');
const { isLibraryConversionCurrent, LIBRARY_CLASS_CONVERTER } = require('../src/engine/libraryImport.ts');
const { fingerprintLibraryText, fingerprintLibraryJson, serializeLibraryJson } = require('../src/engine/libraryIdentity.ts');
const fixture = () => JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'fixtures/fictive-classes.json'),'utf8'));
const simple = (description = 'Premier pli.') => ({ feat: [{ name: 'Pli fictif', source: 'SOURCE-FICTIVE', entries: [description] }] });
const input = value => ({ text: JSON.stringify(value), filename: 'fictif.json' });
async function setup(t) {
  const factory = new IDBFactory(); const db = new LibraryDatabase({factory}); const repo = new LibraryRepository(db);
  t.after(()=>db.close()); return { repo,db,factory };
}
const approved = plan => ({ acceptedUpdates: plan.decisions.filter(d=>d.kind==='update').map(d=>d.identity.id) });
async function stored(repo, value) { const plan = await repo.prepareImport(input(value)); assert.equal((await repo.commitImport(plan,approved(plan))).success,true); return plan; }

test('premier import : fichier exact, identités, provenance et conversions versionnées', async t => {
  const { repo,db } = await setup(t); const text = '\n' + JSON.stringify(fixture(),null,2) + '\n';
  const plan = await repo.prepareImport({text,filename:'fictif.json'});
  assert.equal(plan.decisions.filter(d=>d.kind==='create').length,7);
  assert.equal((await readLibrarySnapshot(db)).imports.length,0);
  assert.deepEqual(await repo.commitImport(plan),{success:true,created:7,updated:0,unchanged:0});
  const snapshot = await readLibrarySnapshot(db);
  assert.equal(snapshot.imports.length,1); assert.equal(snapshot.imports[0].originalText,text);
  assert.equal(snapshot.imports[0].id,await fingerprintLibraryText(text));
  assert.equal(snapshot.contents.length,7); assert.equal(snapshot.revisions.length,7);
  const foreign = snapshot.revisions.find(r=>r.origins[0].originalSource==='FRHoF');
  assert.equal(foreign.origins[0].bookId,'FRHOF');
  for (const revision of snapshot.revisions) {
    assert.equal(Object.hasOwn(revision,'raw'),false);
    const origin = revision.origins[0];
    let entry = JSON.parse(text);
    for (const key of origin.location.pointer.slice(1).split('/')) entry=entry[key];
    assert.equal(await fingerprintLibraryJson(entry),revision.revisionHash);
  }
  const classes = snapshot.contents.filter(c=>c.identity.category==='class');
  for (const cls of classes) {
    const conversion = snapshot.revisions.find(r=>r.contentId===cls.identity.id).conversions[0];
    assert.deepEqual(conversion.converter,LIBRARY_CLASS_CONVERTER);
    assert.equal(conversion.result.status,'converted');
    assert.equal(isLibraryConversionCurrent(conversion,snapshot.contents),true);
    assert.ok(conversion.result.payload.data.id.startsWith('veilleur-de-papier-'));
  }
});

test('réimport identique : aucune duplication et état entièrement inchangé', async t => {
  const { repo,db } = await setup(t); const data=fixture(); await stored(repo,data);
  const before=await readLibrarySnapshot(db); const plan=await repo.prepareImport(input(data));
  assert.ok(plan.decisions.every(d=>d.kind==='unchanged'));
  assert.equal((await repo.commitImport(plan)).success,true);
  assert.equal(serializeLibraryJson(await readLibrarySnapshot(db)),serializeLibraryJson(before));
});

test('fichier réorganisé : nouveau document, mêmes contenus et révisions', async t => {
  const { repo,db } = await setup(t); const data=fixture(); await stored(repo,data);
  const rearranged = Object.fromEntries(Object.entries(data).reverse().map(([key,value])=>[key,Array.isArray(value)?[...value].reverse():value]));
  const plan=await repo.prepareImport({text:JSON.stringify(rearranged,null,2),filename:'reorganise.json'});
  assert.ok(plan.decisions.every(d=>d.kind==='unchanged'));
  assert.equal((await repo.commitImport(plan)).success,true);
  const snapshot=await readLibrarySnapshot(db);
  assert.equal(snapshot.imports.length,2); assert.equal(snapshot.contents.length,7); assert.equal(snapshot.revisions.length,7);
  assert.ok(snapshot.revisions.every(r=>r.origins.length===2));
});

test('mise à jour proposée, refus sans accord puis acceptation et historique conservé', async t => {
  const { repo,db } = await setup(t); const original=await stored(repo,simple());
  const before=await readLibrarySnapshot(db); const plan=await repo.prepareImport(input(simple('Nouveau pli.')));
  assert.equal(plan.decisions[0].kind,'update');
  assert.equal((await repo.commitImport(plan)).success,false);
  assert.equal(serializeLibraryJson(await readLibrarySnapshot(db)),serializeLibraryJson(before));
  assert.deepEqual(await repo.commitImport(plan,approved(plan)),{success:true,created:0,updated:1,unchanged:0});
  const after=await readLibrarySnapshot(db); assert.equal(after.revisions.length,2); assert.equal(after.imports.length,2);
  assert.equal(after.contents[0].generation,1);
  assert.ok(after.revisions.some(r=>r.revisionHash===original.items[0].revision.revisionHash));
});

test('sources inconnues conservées, pas de campagne modifiée et identités insuffisantes diagnostiquées', async t => {
  const { repo,db } = await setup(t);
  const data={feat:[null,{name:'Sans source'},{name:'Pli fictif',source:'SOURCE-FICTIVE'}]};
  const plan=await repo.prepareImport(input(data));
  assert.equal(plan.decisions.filter(d=>d.kind==='unidentified').length,2);
  assert.equal(plan.items[0].revision.origins[0].location.pointer,'/feat/2');
  assert.equal((await repo.commitImport(plan)).success,true);
  const after=await readLibrarySnapshot(db); assert.equal(after.contents.length,1);
  assert.equal(after.contents[0].identity.bookId,'SOURCE-FICTIVE');
  assert.equal(after.imports[0].originalText,JSON.stringify(data));
  assert.equal(Object.hasOwn(after.contents[0],'allowedByCampaign'),false);
});

test('fichier sans identité exploitable : original conservé sans identités inventées', async t => {
  const { repo,db } = await setup(t); const plan=await repo.prepareImport(input({feat:[{name:'Sans source'}]}));
  assert.equal((await repo.commitImport(plan)).success,true);
  const snapshot=await readLibrarySnapshot(db); assert.equal(snapshot.imports.length,1); assert.equal(snapshot.contents.length,0);
});

test('définitions contradictoires : conflit et refus atomique du lot complet', async t => {
  const { repo,db } = await setup(t); const a=simple().feat[0];
  const plan=await repo.prepareImport(input({feat:[a,{...a,entries:['Contradiction.']},{name:'Autre',source:'SOURCE-FICTIVE'}]}));
  assert.equal(plan.decisions.filter(d=>d.kind==='conflict').length,1);
  assert.equal((await repo.commitImport(plan)).success,false);
  assert.deepEqual(await readLibrarySnapshot(db),{imports:[],contents:[],revisions:[],dependencies:[]});
});

test('doublons identiques dans un fichier : une révision avec plusieurs pointeurs', async t => {
  const { repo,db } = await setup(t); const data=fixture(); data.classFeature.push(structuredClone(data.classFeature[0]));
  const plan=await stored(repo,data); assert.equal(plan.decisions.filter(d=>d.kind==='conflict').length,0);
  const snapshot=await readLibrarySnapshot(db); assert.equal(snapshot.contents.length,7);
  assert.ok(snapshot.revisions.some(r=>r.origins.length===2));
  assert.ok(snapshot.revisions.filter(r=>r.conversions[0].result.status==='converted').length===2);
});

test('dépendances propriétaires, capacités et _copy épinglées', async t => {
  const { repo,db } = await setup(t); await stored(repo,fixture());
  const snapshot=await readLibrarySnapshot(db);
  assert.ok(snapshot.dependencies.some(d=>d.relation==='owner'));
  assert.ok(snapshot.dependencies.some(d=>d.relation==='feature'));
  assert.ok(snapshot.dependencies.some(d=>d.relation==='copy'));
  assert.ok(snapshot.dependencies.every(d=>d.revisionHash));
  for (const revision of snapshot.revisions) assert.deepEqual(revision.dependencies,snapshot.dependencies.filter(d=>d.ownerId===revision.contentId));
});

test('deux imports concurrents : un seul succès et aucun écrasement', async t => {
  const { repo,db,factory } = await setup(t); const otherDb=new LibraryDatabase({factory}); const other=new LibraryRepository(otherDb); t.after(()=>otherDb.close());
  const [a,b]=await Promise.all([repo.prepareImport(input(simple('A'))),other.prepareImport(input(simple('B')))]);
  const results=await Promise.all([repo.commitImport(a),other.commitImport(b)]);
  assert.equal(results.filter(r=>r.success).length,1);
  assert.equal(results.filter(r=>!r.success && r.reason==='concurrent-change').length,1);
  const snapshot=await readLibrarySnapshot(db); assert.equal(snapshot.imports.length,1); assert.equal(snapshot.revisions.length,1);
});

test('plan obsolète après changement même non lié : recalcul obligatoire', async t => {
  const { repo,db } = await setup(t); const pending=await repo.prepareImport(input(simple()));
  await stored(repo,{feat:[{name:'Autre contenu',source:'SOURCE-FICTIVE'}]});
  const before=await readLibrarySnapshot(db); const result=await repo.commitImport(pending);
  assert.equal(result.reason,'concurrent-change'); assert.ok(result.issues[0].includes('Recalculer'));
  assert.equal(serializeLibraryJson(await readLibrarySnapshot(db)),serializeLibraryJson(before));
});

test('révision ancienne réactivée avec accord : génération monotone sans perte d’historique', async t => {
  const { repo,db } = await setup(t); await stored(repo,simple('A')); await stored(repo,simple('B'));
  const plan=await repo.prepareImport(input(simple('A'))); assert.equal(plan.decisions[0].kind,'update');
  assert.equal((await repo.commitImport(plan,approved(plan))).success,true);
  const snapshot=await readLibrarySnapshot(db); assert.equal(snapshot.contents[0].generation,2); assert.equal(snapshot.revisions.length,2);
});

test('erreur tardive pendant le lot : rollback du fichier, contenus, révisions et dépendances', async t => {
  const { repo,db } = await setup(t); const plan=await repo.prepareImport(input(fixture()));
  const run=db.runTransaction.bind(db);
  db.runTransaction=async (stores,mode,work)=>run(stores,mode,ctx=> {
    if(mode!=='readwrite'){work(ctx);return;}
    const store=ctx.store.bind(ctx);
    work({...ctx,store(name){ const object=store(name); if(name==='dependencies') object.add=()=>{throw new DOMException('quota simulé','QuotaExceededError');}; return object; }});
  });
  const result=await repo.commitImport(plan); assert.equal(result.success,false); assert.equal(result.storageCode,'quota');
  db.runTransaction=run;
  assert.deepEqual(await readLibrarySnapshot(db),{imports:[],contents:[],revisions:[],dependencies:[]});
});

test('fermeture/réouverture : originaux et révisions restent retrouvables', async t => {
  const { repo,db } = await setup(t); await stored(repo,fixture()); const before=await readLibrarySnapshot(db);
  db.close(); await db.open(); assert.deepEqual(await readLibrarySnapshot(db),before);
});

test('références entre fichiers et reconversion d’une classe initialement incomplète', async t => {
  const { repo,db } = await setup(t); const data=fixture();
  const classOnly={class:data.class}; await stored(repo,classOnly);
  let snapshot=await readLibrarySnapshot(db); assert.ok(snapshot.revisions.every(r=>r.conversions[0].result.status==='unresolved'));
  await stored(repo,{classFeature:data.classFeature,subclass:data.subclass,subclassFeature:data.subclassFeature});
  const plan=await repo.prepareImport(input(classOnly)); assert.ok(plan.decisions.every(d=>d.kind==='unchanged'));
  assert.equal((await repo.commitImport(plan)).success,true);
  snapshot=await readLibrarySnapshot(db);
  for (const cls of snapshot.contents.filter(c=>c.identity.category==='class')) {
    const converted=snapshot.revisions.find(r=>r.contentId===cls.identity.id).conversions[0];
    assert.equal(converted.result.status,'converted'); assert.equal(isLibraryConversionCurrent(converted,snapshot.contents),true);
  }
});

test('changement de dépendance invalide le cache sans changer la révision de la classe', async t => {
  const { repo,db } = await setup(t); const data=fixture(); await stored(repo,data);
  const snapshot=await readLibrarySnapshot(db); const cls=snapshot.contents.find(c=>c.identity.category==='class' && c.identity.bookId==='PHB');
  const conversion=snapshot.revisions.find(r=>r.contentId===cls.identity.id).conversions[0];
  const feature=structuredClone(data.classFeature[0]); feature.entries=['Autre description fictive.'];
  await stored(repo,{classFeature:[feature]});
  const after=await readLibrarySnapshot(db); assert.equal(isLibraryConversionCurrent(conversion,after.contents),false);
  assert.equal(after.contents.find(c=>c.identity.id===cls.identity.id).activeRevision,cls.activeRevision);
});

test('évolution du convertisseur : nouvelle conversion sans nouvelle révision brute', async t => {
  const { repo,db } = await setup(t); const data=fixture(); await stored(repo,data);
  const snapshot=await readLibrarySnapshot(db); const revision=snapshot.revisions.find(r=>r.conversions[0].result.status==='converted');
  revision.conversions[0].converter.version='ancienne';
  assert.equal(isLibraryConversionCurrent(revision.conversions[0],snapshot.contents),false);
  await db.write([{store:'revisions',operation:'put',value:revision}]);
  const plan=await repo.prepareImport(input(data)); assert.equal((await repo.commitImport(plan)).success,true);
  const after=await readLibrarySnapshot(db); assert.equal(after.revisions.length,7);
  const saved=after.revisions.find(r=>r.contentId===revision.contentId);
  assert.ok(saved.conversions.some(c=>c.converter.version==='ancienne'));
  assert.ok(saved.conversions.some(c=>c.converter.version===LIBRARY_CLASS_CONVERTER.version));
});

test('plan immuable, plan étranger refusé, fichiers invalides refusés avant écriture', async t => {
  const { repo,db } = await setup(t); const plan=await repo.prepareImport(input(simple()));
  assert.equal(Object.isFrozen(plan),true); assert.equal(Object.isFrozen(plan.items[0].revision),true);
  assert.equal((await repo.commitImport(structuredClone(plan))).reason,'invalid-data');
  await assert.rejects(repo.prepareImport({text:'{bad',filename:'fictif.json'}));
  await assert.rejects(repo.prepareImport({text:'{}',filename:'C:\\externe\\fictif.json'}));
  assert.equal((await readLibrarySnapshot(db)).imports.length,0);
});


test('accords non pertinents refusés et état inchangé', async t => {
  const { repo,db }=await setup(t); const plan=await repo.prepareImport(input(simple()));
  const result=await repo.commitImport(plan,{acceptedUpdates:[plan.items[0].identity.id]});
  assert.equal(result.reason,'invalid-data'); assert.equal((await readLibrarySnapshot(db)).imports.length,0);
});

test('originaux capturés avant les attentes asynchrones, nom alternatif sans copie du fichier', async t => {
  const { repo,db }=await setup(t); const request=input(simple()); const original=request.text;
  const pending=repo.prepareImport(request); request.text=JSON.stringify(simple('Mutation externe.'));
  const plan=await pending; assert.equal(plan.document.originalText,original);
  assert.equal((await repo.commitImport(plan)).success,true);
  const renamed=await repo.prepareImport({text:original,filename:'autre-nom.json'});
  assert.equal((await repo.commitImport(renamed)).success,true);
  const snapshot=await readLibrarySnapshot(db);
  assert.equal(snapshot.imports.length,1); assert.deepEqual(snapshot.imports[0].filenames,['fictif.json','autre-nom.json']);
});

test('historique des dépendances conservé après remplacement d’une référence', async t => {
  const { repo,db }=await setup(t); const data=fixture(); await stored(repo,data);
  const initial=await readLibrarySnapshot(db); const original=initial.revisions.find(r=>r.contentId.includes('"class"') && r.origins[0].originalSource==='PHB');
  const changed=structuredClone(data.class[0]); changed.classFeatures=[];
  // L'original reste importable même si cette forme n'est plus convertible seule.
  await stored(repo,{class:[changed]});
  const snapshot=await readLibrarySnapshot(db);
  assert.deepEqual(snapshot.revisions.find(r=>r.revisionHash===original.revisionHash && r.contentId===original.contentId),original);
  assert.ok(snapshot.dependencies.filter(d=>d.ownerId===original.contentId).length < original.dependencies.length);
});

test('copie de sous-classe non supportée : classe marquée non résolue, originaux conservés', async t => {
  const { repo,db }=await setup(t); const data=fixture();
  data.subclass[1]._copy._mod={entries:{mode:'appendArr',items:['Fictif']}};
  await stored(repo,data); const snapshot=await readLibrarySnapshot(db);
  const cls=snapshot.contents.find(c=>c.identity.category==='class' && c.identity.bookId==='XPHB');
  const conversion=snapshot.revisions.find(r=>r.contentId===cls.identity.id).conversions[0];
  assert.equal(conversion.result.status,'unresolved'); assert.equal(snapshot.contents.length,7);
});

test('contenu archivé non réactivé implicitement et dépendance archivée indisponible', async t => {
  const { repo,db }=await setup(t); const data=fixture(); await stored(repo,data);
  const before=await readLibrarySnapshot(db); const target=before.contents.find(c=>c.identity.category==='classFeature');
  await db.write([{store:'contents',operation:'put',value:{...target,status:'archived',generation:target.generation+1}}]);
  const plan=await repo.prepareImport(input(data)); assert.equal((await repo.commitImport(plan)).success,true);
  const snapshot=await readLibrarySnapshot(db); assert.equal(snapshot.contents.find(c=>c.identity.id===target.identity.id).status,'archived');
  const cls=snapshot.contents.find(c=>c.identity.category==='class' && c.identity.bookId===target.identity.bookId);
  const conversion=snapshot.revisions.find(r=>r.contentId===cls.identity.id).conversions[0];
  assert.equal(conversion.result.status,'unresolved');
});


test('ajout d’une sous-classe : ancien cache de classe invalidé même sans changement de révision', async t => {
  const { repo,db }=await setup(t); const data=fixture(); await stored(repo,data);
  const snapshot=await readLibrarySnapshot(db); const cls=snapshot.contents.find(c=>c.identity.category==='class' && c.identity.bookId==='PHB');
  const conversion=snapshot.revisions.find(r=>r.contentId===cls.identity.id).conversions[0];
  assert.equal(isLibraryConversionCurrent(conversion,snapshot.contents),true);
  await stored(repo,{subclass:[{...data.subclass[0],name:'Tisseur de papier',shortName:'Tisseur'}]});
  const after=await readLibrarySnapshot(db);
  assert.equal(after.contents.find(c=>c.identity.id===cls.identity.id).activeRevision,cls.activeRevision);
  assert.equal(isLibraryConversionCurrent(conversion,after.contents),false);
});
