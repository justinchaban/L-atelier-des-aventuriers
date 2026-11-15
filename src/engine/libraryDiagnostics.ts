import type { LibrarySnapshot } from './libraryImport';
import { libraryIdentityInput } from './libraryImport';
import { createLibraryIdentity, fingerprintLibraryText, serializeLibraryJson, normalizeLibraryName } from './libraryIdentity';
import { validateLibraryBackupData } from './libraryBackup';
import { detectContent, isJsonRecord } from './contentImporter';
import type { LibraryContentId, LibraryDependency } from '../models/Library';
import type { LibraryDiagnostic, LibraryDiagnosticReport, LibraryDeletionImpact, LibraryDeletionReference } from '../models/LibraryDiagnostics';
import { LIBRARY_STORES, validateLibraryRecord } from '../services/libraryDatabase';

const key=(id:string,hash:string)=>JSON.stringify([id,hash]);
function nameOf(data:LibrarySnapshot,id:LibraryContentId):string {
  const content=data.contents.find(item=>item.identity.id===id);
  return data.revisions.find(item=>item.contentId===id&&item.revisionHash===content?.activeRevision)?.origins?.[0]?.originalName??content?.identity.normalizedName??id;
}
/** Composantes fortement connexes : les cycles owner/feature sont structurels, pas des héritages. */
function cycles(edges:readonly {ownerId:string;targetId:string}[]):string[][] {
  const adjacency=new Map<string,string[]>();
  for(const edge of edges){adjacency.set(edge.ownerId,[...adjacency.get(edge.ownerId)??[],edge.targetId]);if(!adjacency.has(edge.targetId))adjacency.set(edge.targetId,[]);}
  let next=0;const indices=new Map<string,number>(),low=new Map<string,number>();const stack:string[]=[];const onStack=new Set<string>();const result:string[][]=[];
  const visit=(id:string)=>{
    indices.set(id,next);low.set(id,next++);stack.push(id);onStack.add(id);
    for(const target of adjacency.get(id)??[]) {
      if(!indices.has(target)){visit(target);low.set(id,Math.min(low.get(id)!,low.get(target)!));}
      else if(onStack.has(target))low.set(id,Math.min(low.get(id)!,indices.get(target)!));
    }
    if(low.get(id)===indices.get(id)){
      const group:string[]=[];let item:string;do{item=stack.pop()!;onStack.delete(item);group.push(item);}while(item!==id);
      if(group.length>1||(adjacency.get(id)??[]).includes(id))result.push(group.sort());
    }
  };
  for(const id of adjacency.keys())if(!indices.has(id))visit(id);
  return result;
}

/** Diagnostic sans écritures, y compris quand les enregistrements sont incomplets. */
export async function diagnoseLibrarySnapshot(data:LibrarySnapshot):Promise<LibraryDiagnosticReport>{
  const diagnostics:LibraryDiagnostic[]=[];
  const add=(severity:LibraryDiagnostic['severity'],code:string,message:string,extra:Partial<LibraryDiagnostic>={})=>diagnostics.push({severity,code,message,...extra});
  try{serializeLibraryJson(data);}catch{add('error','non-json-data','Des données ne sont pas sérialisables en JSON ; une analyse fiable et un export sont impossibles.');}
  const safe:LibrarySnapshot={imports:[],contents:[],revisions:[],dependencies:[]};
  for(const store of LIBRARY_STORES){
    if(!Array.isArray(data?.[store])){add('error','invalid-store',`Magasin ${store} illisible.`);continue;}
    for(const [index,item] of data[store].entries())try{validateLibraryRecord(store,item);(safe[store] as unknown[]).push(item);}catch{add('error','invalid-record',`Enregistrement ${index+1} invalide dans ${store}.`);}
  }
  const contents=new Map(safe.contents.map(item=>[item.identity.id,item]));
  const revisions=new Map(safe.revisions.map(item=>[key(item.contentId,item.revisionHash),item]));
  const documents=new Map(safe.imports.map(item=>[item.id,item]));
  for(const document of safe.imports){
    try{if(await fingerprintLibraryText(document.originalText)!==document.id)add('error','original-hash','Empreinte du fichier original incorrecte.',{importId:document.id});JSON.parse(document.originalText);}
    catch{add('error','invalid-original','Fichier original illisible.',{importId:document.id});}
    if(!safe.revisions.some(revision=>revision.origins?.some(origin=>origin?.location?.importId===document.id)))add('info','preserved-original','Original conservé sans révision indexée ; ce n’est pas une perte de données.',{importId:document.id});
  }
  for(const content of safe.contents)if(!revisions.has(key(content.identity.id,content.activeRevision)))add('error','missing-active-revision','Le contenu ne possède pas de révision active valide.',{contentId:content.identity.id,revisionHash:content.activeRevision});
  const inspectEdge=(edge:LibraryDependency,source:string,owner?:LibraryContentId)=>{
    if(!contents.has(edge.ownerId))add('error','missing-dependency-owner',`Propriétaire de dépendance absent (${source}).`,{contentId:edge.ownerId});
    if(owner&&owner!==edge.ownerId)add('error','wrong-dependency-owner','Propriétaire de dépendance incohérent.',{contentId:owner});
    if(!contents.has(edge.targetId))add(edge.revisionHash?'error':'warning','missing-dependency-target',`Cible de dépendance absente (${source}).`,{contentId:edge.ownerId});
    if(edge.revisionHash&&!revisions.has(key(edge.targetId,edge.revisionHash)))add('error','missing-pinned-revision',`Révision référencée absente (${source}).`,{contentId:edge.ownerId,revisionHash:edge.revisionHash});
    const target=contents.get(edge.targetId);
    if(source==='graphe actif'&&target?.status==='archived')add('warning','archived-dependency','Une dépendance active pointe vers un contenu archivé.',{contentId:edge.ownerId});
    if(source==='graphe actif'&&edge.revisionHash&&target&&target.activeRevision!==edge.revisionHash)add('warning','changed-dependency','La dépendance utilise une autre révision que la révision active de sa cible.',{contentId:edge.ownerId});
    if(edge.relation==='copy'&&contents.has(edge.ownerId)&&target&&contents.get(edge.ownerId)!.identity.category!==target.identity.category)add('error','invalid-copy-category','Un héritage copie une catégorie différente.',{contentId:edge.ownerId});
    if((edge.relation==='owner'||edge.relation==='feature')&&target&&contents.has(edge.ownerId)){
      const from=contents.get(edge.ownerId)!.identity.category,to=target.identity.category;
      const valid=edge.relation==='owner' ?
        (['subclass','classFeature','subclassFeature'].includes(from)&&to==='class')||(from==='subclassFeature'&&to==='subclass') :
        (from==='class'&&['classFeature','subclass'].includes(to))||(from==='subclass'&&to==='subclassFeature');
      if(!valid)add('error','invalid-structural-edge','Relation propriétaire/capacité incohérente.',{contentId:edge.ownerId});
    }
  };
  for(const revision of safe.revisions){
    if(!contents.has(revision.contentId))add('error','orphan-revision','Révision sans contenu propriétaire.',{contentId:revision.contentId,revisionHash:revision.revisionHash});
    for(const origin of revision.origins??[])if(!origin?.location||!documents.has(origin.location.importId))add('error','missing-original','Import original de la révision absent.',{contentId:revision.contentId,revisionHash:revision.revisionHash});
    if(revision.dependencies===undefined)add('warning','legacy-dependencies','Cette révision ne conserve pas de snapshot de ses dépendances.',{contentId:revision.contentId,revisionHash:revision.revisionHash});
    else if(Array.isArray(revision.dependencies))for(const edge of revision.dependencies)try{validateLibraryRecord('dependencies',edge);inspectEdge(edge,'révision',revision.contentId);}catch{add('error','invalid-revision-edge','Dépendance historique invalide.',{contentId:revision.contentId});}
    if(Array.isArray(revision.conversions))for(const conversion of revision.conversions){
      if(!isJsonRecord(conversion)||conversion.contentId!==revision.contentId||conversion.revisionHash!==revision.revisionHash||!Array.isArray(conversion.dependencies)){add('error','invalid-conversion','Conversion incohérente.',{contentId:revision.contentId});continue;}
      for(const edge of conversion.dependencies)try{validateLibraryRecord('dependencies',edge);inspectEdge(edge,'conversion');}catch{add('error','invalid-conversion-edge','Dépendance de conversion invalide.',{contentId:revision.contentId});}
      if(conversion.result?.status==='unsupported')add('info','unconverted','Contenu conservé sans convertisseur autonome.',{contentId:revision.contentId});
    }
    const content=contents.get(revision.contentId);
    if(content?.activeRevision===revision.revisionHash&&Array.isArray(revision.dependencies)){
      const sorted=(edges:LibraryDependency[])=>edges.map(serializeLibraryJson).sort();
      if(JSON.stringify(sorted(revision.dependencies))!==JSON.stringify(sorted(safe.dependencies.filter(edge=>edge.ownerId===revision.contentId))))add('error','active-graph-mismatch','Les dépendances actives ne correspondent pas à la révision active.',{contentId:revision.contentId});
    }
  }
  for(const edge of safe.dependencies)inspectEdge(edge,'graphe actif');
  try{
    for(const group of cycles(safe.dependencies.filter(edge=>edge.relation==='copy')))add('error','copy-cycle',`Cycle d’héritage _copy : ${group.map(id=>nameOf(safe,id as LibraryContentId)).join(' → ')}.`);
    for(const group of cycles(safe.dependencies.filter(edge=>edge.relation!=='copy')))if(!diagnostics.some(item=>item.code==='invalid-structural-edge'&&item.contentId&&group.includes(item.contentId)))add('info','structural-cycle',`Cycle structurel propriétaire/capacité autorisé : ${group.map(id=>nameOf(safe,id as LibraryContentId)).join(' ↔ ')}.`);
    const historical=safe.revisions.flatMap(revision=>Array.isArray(revision.dependencies)?revision.dependencies.filter(edge=>edge.relation==='copy'):[]);
    for(const group of cycles(historical))add('warning','historical-copy-cycle',`Cycle possible dans l’union des révisions historiques : ${group.map(id=>nameOf(safe,id as LibraryContentId)).join(' → ')}. Les versions concernées ne sont pas nécessairement actives ensemble.`);
  }catch{add('error','cycle-analysis-failed','L’analyse des cycles n’a pas pu être menée complètement.');}
  try{await validateLibraryBackupData(data);}catch(error){add('error','integrity-validation',error instanceof Error?error.message:'Validation complète impossible.');}
  const unique=[...new Map(diagnostics.map(item=>[serializeLibraryJson(item),item])).values()];
  return {checkedAt:new Date().toISOString(),diagnostics:unique,counts:{error:unique.filter(item=>item.severity==='error').length,warning:unique.filter(item=>item.severity==='warning').length,info:unique.filter(item=>item.severity==='info').length},structurallyValid:!unique.some(item=>item.severity==='error')};
}

const COMMON=['name','source','entries','entry','edition','page'];
const FIELDS:Record<string,string[]>={
  class:[...COMMON,'hd','primaryAbility','proficiency','classFeatures'],
  subclass:[...COMMON,'shortName','className','classSource','subclassFeatures','_copy'],
  classFeature:[...COMMON,'className','classSource','level','_copy'],
  subclassFeature:[...COMMON,'className','classSource','subclassShortName','subclassSource','level','_copy'],
  feat:COMMON,species:COMMON,race:COMMON,background:COMMON,spell:COMMON,item:COMMON,baseitem:COMMON,itemGroup:COMMON
};
const NESTED=new Set(['type','name','entries','entry','items','style','caption','colLabels','rows','roll','exact','min','max']);
/** Sous-ensemble volontairement strict. Un champ ou tag non reconnu interdit toute preuve de sûreté. */
function understoodOriginal(value:unknown,context:string):boolean{
  if(value===null||typeof value==='number'||typeof value==='boolean')return true;
  if(typeof value==='string')return !/\{@(?!b\s|i\s|u\s|s\s|bold\s|italic\s|underline\s|strike\s|dc\s|dice\s|damage\s|d20\s|hit\s|chance\s|recharge\s|atk\s|h\})/.test(value);
  if(Array.isArray(value))return value.every(item=>understoodOriginal(item,context));
  if(!isJsonRecord(value))return false;
  if(context==='entry'&&Object.hasOwn(value,'type')&&!['entries','section','inset','insetReadaloud','list','table','item','quote','options'].includes(String(value.type)))return false;
  const allowed=context==='entry'?NESTED:context==='hd'?new Set(['faces','number']):context==='ability'?new Set(['str','dex','con','int','wis','cha']):context==='classFeatures'?new Set(['classFeature','gainSubclassFeature']):context==='copy'?new Set(['name','source','shortName','className','classSource','_preserve']):context==='preserve'?null:new Set(FIELDS[context]??[]);
  return Object.entries(value).every(([field,child])=>(allowed===null?typeof child==='boolean':allowed.has(field))&&understoodOriginal(child,field==='_copy'?'copy':field==='_preserve'?'preserve':field==='hd'?'hd':field==='primaryAbility'?'ability':field==='classFeatures'?'classFeatures':'entry'));
}
function understoodClassCache(value:unknown,context='class'):boolean {
  if(Array.isArray(value))return value.every(item=>understoodClassCache(item,context));
  if(value===null||typeof value!=='object')return understoodOriginal(value,'entry');
  if(!isJsonRecord(value))return false;
  const fields:Record<string,string[]>={
    class:['id','name','description','bookId','ruleset','hitDie','primaryAbilities','savingThrows','proficiencies','skillChoices','features','subclassLevel','subclasses','spellcasting','importMetadata','structuredEntries'],
    subclass:['id','name','description','bookId','ruleset','features','shortName','importMetadata','structuredEntries'],
    feature:['id','name','description','levelRequired','choices','bookId','importMetadata','structuredEntries'],
    proficiency:['type','id'],choice:['id','name','description','count','options'],option:['id','name','description'],
    metadata:['provider','originalName','originalSource','originalReference','hasUnresolvedCopy'],spellcasting:['ability','type','preparation']
  };
  const children:Record<string,string>={subclasses:'subclass',features:'feature',proficiencies:'proficiency',skillChoices:'choice',choices:'choice',options:'option',importMetadata:'metadata',spellcasting:'spellcasting'};
  return Object.entries(value).every(([field,child])=>(fields[context]??[]).includes(field)&&(field==='structuredEntries'?understoodOriginal(child,'entry'):understoodClassCache(child,children[field]??'leaf')));
}
function stringsIn(value:unknown):string[]{
  if(typeof value==='string')return [value];if(Array.isArray(value))return value.flatMap(stringsIn);
  if(isJsonRecord(value))return Object.values(value).flatMap(stringsIn);return [];
}

/** Rapport conservateur : originaux, révisions historiques et conversions peuvent tous bloquer. */
export function analyzeLibraryDeletion(data:LibrarySnapshot,id:LibraryContentId,report:LibraryDiagnosticReport):LibraryDeletionImpact{
  const content=data.contents.find(item=>item.identity.id===id);
  const revisions=data.revisions.filter(item=>item.contentId===id);
  const name=content?nameOf(data,id):id;
  const reasons:string[]=[];const references:LibraryDeletionReference[]=[];
  if(!content)reasons.push('Contenu introuvable.');
  if(!report.structurallyValid)reasons.push('Des erreurs d’intégrité bloquantes empêchent de prouver la sûreté de cette suppression.');
  const aliases=new Set<string>([normalizeLibraryName(name),normalizeLibraryName(id)]);
  const ownLocations=new Set(revisions.flatMap(revision=>revision.origins.map(origin=>key(origin.location.importId,origin.location.pointer))));
  const locationOwners=new Map<string,Set<LibraryContentId>>();
  for(const revision of data.revisions)for(const origin of revision.origins??[]){const location=key(origin.location.importId,origin.location.pointer);const owners=locationOwners.get(location)??new Set();owners.add(revision.contentId);locationOwners.set(location,owners);}
  for(const revision of revisions)for(const conversion of revision.conversions??[])if(conversion.result.status==='converted')aliases.add(normalizeLibraryName(conversion.result.payload.data.id));
  // Collecter tous les alias avant de scanner les autres entrées, indépendamment de leur ordre.
  for(const revision of revisions)for(const origin of revision.origins)try{
    const document=data.imports.find(item=>item.id===origin.location.importId);
    if(!document)continue;
    let entry:unknown=JSON.parse(document.originalText);
    for(const token of origin.location.pointer.slice(1).split('/'))entry=entry&&typeof entry==='object'?(entry as Record<string,unknown>)[token.replace(/~1/g,'/').replace(/~0/g,'~')]:undefined;
    if(isJsonRecord(entry))for(const field of ['id','uid'])if(typeof entry[field]==='string')aliases.add(normalizeLibraryName(entry[field]));
  }catch{reasons.push('Les alias du contenu ne peuvent pas être établis.');}
  for(const record of data.contents.filter(record=>record.identity.id!==id))if(Object.keys(record).some(field=>!['recordVersion','identity','activeRevision','generation','status','createdAt','updatedAt'].includes(field))||Object.keys(record.identity).some(field=>!['identityVersion','id','provider','namespace','category','normalizedName','bookId','classOwner','subclassOwner','level','originalKey'].includes(field)))reasons.push('Des métadonnées de contenu non analysables peuvent conserver des références.');
  const mentions=(value:unknown)=>stringsIn(value).some(value=>{const normalized=normalizeLibraryName(value);return [...aliases].some(alias=>alias&&normalized.includes(alias));});
  const add=(source:LibraryDeletionReference['source'],ownerId:LibraryContentId|undefined,message:string,extra:Partial<LibraryDeletionReference>={})=>references.push({source,...(ownerId?{ownerId}:{}),ownerName:ownerId?nameOf(data,ownerId):'Original conservé sans contenu indexé',message,...extra});
  const edges:{ownerId:LibraryContentId;targetId:LibraryContentId;direct:boolean}[]=[];
  for(const edge of data.dependencies){edges.push({...edge,direct:true});if(edge.targetId===id&&edge.ownerId!==id)add('active-dependency',edge.ownerId,'Dépendance active vers ce contenu.');}
  for(const revision of data.revisions){
    if(revision.contentId===id)continue;
    if(Object.keys(revision).some(field=>!['recordVersion','contentId','revisionHash','origins','dependencies','conversions','createdAt'].includes(field)))reasons.push('Des métadonnées de révision non analysables peuvent conserver des références.');
    if(revision.dependencies===undefined)reasons.push(`Les dépendances historiques de ${nameOf(data,revision.contentId)} ne sont pas complètement enregistrées.`);
    for(const edge of revision.dependencies??[]){edges.push({ownerId:revision.contentId,targetId:edge.targetId,direct:true});if(edge.targetId===id||edge.ownerId===id)add('revision',revision.contentId,'Référence historique à ce contenu.',{revisionHash:revision.revisionHash});}
    for(const origin of revision.origins)if(Object.keys(origin).some(field=>!['provider','namespace','originalName','originalSource','bookId','originalKey','originalReference','location'].includes(field))||Object.keys(origin.location).some(field=>!['importId','pointer'].includes(field)))reasons.push('Des métadonnées de provenance non analysables peuvent conserver des références.');
    for(const conversion of revision.conversions??[]){
      if(Object.keys(conversion).some(field=>!['recordVersion','contentId','revisionHash','converter','dependencies','result'].includes(field))||Object.keys(conversion.converter).some(field=>!['id','version'].includes(field)))reasons.push('Des métadonnées de conversion non analysables peuvent conserver des références.');
      for(const edge of conversion.dependencies){edges.push({ownerId:revision.contentId,targetId:edge.targetId,direct:edge.ownerId===revision.contentId});if(edge.targetId===id||edge.ownerId===id)add('conversion',revision.contentId,'Conversion conservant une référence à ce contenu.',{revisionHash:revision.revisionHash});}
      if(mentions(conversion.result))add('conversion',revision.contentId,'Le résultat de conversion contient un nom ou identifiant de ce contenu.',{revisionHash:revision.revisionHash});
      if(Object.keys(conversion.result).some(field=>!['status','payload','warnings','issues'].includes(field)))reasons.push('Des champs de résultat de conversion non analysables peuvent conserver des références.');
      if(conversion.result.status==='converted'&&(conversion.converter.id!=='classImporter'||conversion.converter.version!=='1'||conversion.result.payload.category!=='class'||Object.keys(conversion.result.payload).some(field=>!['category','data'].includes(field))||!understoodClassCache(conversion.result.payload.data)))reasons.push('Un convertisseur non analysable conserve des données susceptibles de référencer ce contenu.');
    }
    if(mentions(revision.origins.map(origin=>origin.originalReference??'')))add('revision',revision.contentId,'Référence originale conservée dans la provenance.',{revisionHash:revision.revisionHash});
  }
  for(const document of data.imports){
    try{
      const root:unknown=JSON.parse(document.originalText);
      if(!isJsonRecord(root)){reasons.push('Un fichier original ne peut pas être analysé complètement.');continue;}
      for(const [field,value] of Object.entries(root)){
        if(field==='_meta'){
          if(!isJsonRecord(value)||Object.keys(value).some(key=>key!=='description')||!understoodOriginal(value.description,'entry'))reasons.push('Des métadonnées originales non analysables empêchent une suppression sûre.');
          if(mentions(value))add('original',undefined,'Mention dans les métadonnées originales.',{importId:document.id,pointer:'/_meta'});
          continue;
        }
        if(!Object.hasOwn(FIELDS,field)||!Array.isArray(value)){reasons.push(`Champ original non analysable : ${field}.`);continue;}
        value.forEach((entry,index)=>{
          const pointer=`/${field}/${index}`,location=key(document.id,pointer);const owners=locationOwners.get(location);
          const exclusivelyOwn=ownLocations.has(location)&&owners?.size===1&&owners.has(id);
          if(exclusivelyOwn){if(isJsonRecord(entry)){if(typeof entry.id==='string')aliases.add(normalizeLibraryName(entry.id));if(typeof entry.uid==='string')aliases.add(normalizeLibraryName(entry.uid));}return;}
          if(ownLocations.has(location))reasons.push('Une entrée originale est partagée par plusieurs identités.');
          if(!understoodOriginal(entry,field))reasons.push(`Structure originale non analysable : ${document.filenames.join(', ')} ${pointer}.`);
          if(mentions(entry))for(const owner of owners?.size?[...owners]:[undefined])add('original',owner,'Référence ou mention possible dans une entrée originale conservée.',{importId:document.id,pointer});
        });
      }
    }catch{reasons.push('Un fichier original est illisible ou trop complexe à analyser.');}
  }
  const dependentMap=new Map<LibraryContentId,{id:LibraryContentId;name:string;direct:boolean}>();
  const queue=[id],visited=new Set<LibraryContentId>([id]);
  for(let index=0;index<queue.length;index++)for(const edge of edges.filter(edge=>edge.targetId===queue[index]))if(edge.ownerId!==id){
    const direct=edge.targetId===id&&edge.direct,previous=dependentMap.get(edge.ownerId);
    dependentMap.set(edge.ownerId,{id:edge.ownerId,name:nameOf(data,edge.ownerId),direct:direct||previous?.direct===true});
    if(!visited.has(edge.ownerId)){visited.add(edge.ownerId);queue.push(edge.ownerId);}
  }
  if(references.length||dependentMap.size)reasons.push('Des références ou dépendants pourraient être invalidés. Aucune suppression en cascade n’est autorisée.');
  const uniqueReasons=[...new Set(reasons)];
  return {contentId:id,name,allowed:uniqueReasons.length===0,reasons:uniqueReasons,references:[...new Map(references.map(item=>[serializeLibraryJson(item),item])).values()],dependents:[...dependentMap.values()],revisionsToDelete:revisions.map(item=>item.revisionHash),conversionsToDelete:revisions.reduce((total,revision)=>total+(revision.conversions?.length??0),0),dependenciesToDelete:data.dependencies.filter(edge=>edge.ownerId===id).length,originalsPreserved:data.imports.length};
}
