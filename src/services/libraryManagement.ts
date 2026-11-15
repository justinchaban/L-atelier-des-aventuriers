import type { LibraryContentId, LibraryContentRecord, LibraryDependency, LibraryFingerprint } from '../models/Library';
import { librarySnapshotToken } from '../engine/libraryImport';
import type { LibrarySnapshot } from '../engine/libraryImport';
import { validateLibraryBackupData } from '../engine/libraryBackup';
import { LibraryDatabase, LibraryDatabaseError, LIBRARY_STORES } from './libraryDatabase';
import { readLibrarySnapshot, readLibrarySnapshotInTransaction } from './libraryRepository';

export type LibraryManagementAction = 'archive' | 'restore' | 'activate-revision';
export interface LibraryDependencyImpact {
  id: LibraryContentId;
  name: string;
  status: LibraryContentRecord['status'];
  bookId: string;
  direct: boolean;
}
export interface LibraryDependencyAvailability {
  dependency: LibraryDependency;
  name: string;
  bookId: string;
  availability: 'available' | 'missing' | 'archived' | 'different-revision' | 'unresolved';
}
export interface LibraryManagementPlan {
  action: LibraryManagementAction;
  contentId: LibraryContentId;
  name: string;
  expected: LibraryContentRecord;
  expectedSnapshot: string;
  targetRevision: LibraryFingerprint;
  targetDependencies: LibraryDependency[];
  affected: LibraryDependencyImpact[];
  dependencies: LibraryDependencyAvailability[];
  warnings: string[];
}
export type LibraryManagementResult =
  | { success:true; contentId:LibraryContentId; action:LibraryManagementAction }
  | { success:false; reason:'confirmation-required'|'invalid-data'|'concurrent-change'|'storage-error'; message:string; storageCode?:string };
const immutable=<T,>(value:T):T=> {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))immutable(child);Object.freeze(value);}return value;
};

function nameOf(snapshot:LibrarySnapshot,id:LibraryContentId):string {
  const record=snapshot.contents.find(record=>record.identity.id===id);
  const known=snapshot.revisions.find(revision=>revision.contentId===id&&revision.revisionHash===record?.activeRevision)?.origins[0]?.originalName??record?.identity.normalizedName;
  if(known)return known;
  try{return String(JSON.parse(id.slice(11))[3]);}catch{return id;}
}

/** Dépendants directs et transitifs, y compris les dépendances des caches actifs. */
export function libraryAffectedDependents(snapshot:LibrarySnapshot,id:LibraryContentId):LibraryDependencyImpact[] {
  const edges=snapshot.dependencies.map(edge=>({ownerId:edge.ownerId,targetId:edge.targetId}));
  for(const content of snapshot.contents){
    const active=snapshot.revisions.find(revision=>revision.contentId===content.identity.id&&revision.revisionHash===content.activeRevision);
    for(const conversion of active?.conversions??[]) for(const edge of conversion.dependencies)edges.push({ownerId:content.identity.id,targetId:edge.targetId});
  }
  const affected=new Map<LibraryContentId,LibraryDependencyImpact>();
  const pending=[id];const visited=new Set<LibraryContentId>([id]);
  for(let index=0;index<pending.length;index++)for(const edge of edges.filter(edge=>edge.targetId===pending[index])){
    if(edge.ownerId===id)continue;
    const content=snapshot.contents.find(content=>content.identity.id===edge.ownerId);
    if(!content)continue;
    const direct=edge.targetId===id;
    const previous=affected.get(edge.ownerId);
    affected.set(edge.ownerId,{id:edge.ownerId,name:nameOf(snapshot,edge.ownerId),status:content.status,bookId:content.identity.bookId,direct:direct||previous?.direct===true});
    if(!visited.has(edge.ownerId)){visited.add(edge.ownerId);pending.push(edge.ownerId);}
  }
  return [...affected.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr')||a.id.localeCompare(b.id));
}

export class LibraryManagementService {
  private readonly plans=new WeakSet<LibraryManagementPlan>();
  private epoch=0;
  constructor(private readonly database=new LibraryDatabase()){}
  async prepare(contentId:LibraryContentId,action:LibraryManagementAction,targetRevision?:LibraryFingerprint):Promise<LibraryManagementPlan>{
    if(!['archive','restore','activate-revision'].includes(action))throw new LibraryDatabaseError('invalid-data','Action inconnue.');
    const epoch=this.epoch;
    const snapshot=await readLibrarySnapshot(this.database);
    await validateLibraryBackupData(snapshot); // Réutilise les contrôles d'intégrité avant de préparer une écriture.
    if(epoch!==this.epoch)throw new LibraryDatabaseError('transaction','Consultation fermée.');
    const content=snapshot.contents.find(content=>content.identity.id===contentId);
    if(!content)throw new LibraryDatabaseError('invalid-data','Contenu introuvable. Actualisez la bibliothèque.');
    if((action==='archive'&&content.status!=='active')||(action==='restore'&&content.status!=='archived'))throw new LibraryDatabaseError('invalid-data','Le statut ne permet plus cette action. Actualisez la bibliothèque.');
    if(content.generation>=Number.MAX_SAFE_INTEGER)throw new LibraryDatabaseError('invalid-data','Limite de génération atteinte. Aucune modification effectuée.');
    const hash=action==='activate-revision'?targetRevision:content.activeRevision;
    const revision=snapshot.revisions.find(revision=>revision.contentId===contentId&&revision.revisionHash===hash);
    if(!revision)throw new LibraryDatabaseError('invalid-data','Révision demandée introuvable pour ce contenu.');
    if(action==='activate-revision'&&hash===content.activeRevision)throw new LibraryDatabaseError('invalid-data','Cette révision est déjà active.');
    if(action==='activate-revision'&&revision.dependencies===undefined)throw new LibraryDatabaseError('invalid-data','Cette ancienne révision ne conserve pas ses dépendances. Son activation est désactivée pour préserver la cohérence.');
    const targetDependencies=action==='activate-revision'?revision.dependencies!:
      snapshot.dependencies.filter(edge=>edge.ownerId===contentId);
    const dependencies=targetDependencies.map<LibraryDependencyAvailability>(dependency=>{
      const target=snapshot.contents.find(record=>record.identity.id===dependency.targetId);
      return {dependency,name:nameOf(snapshot,dependency.targetId),bookId:target?.identity.bookId??String(JSON.parse(dependency.targetId.slice(11))[4]),availability:!target?'missing':target.status==='archived'?'archived':
        !dependency.revisionHash?'unresolved':target.activeRevision!==dependency.revisionHash?'different-revision':'available'};
    });
    const warnings=['Les fichiers originaux, révisions et conversions seront conservés sans modification. Les contenus dépendants ne seront ni modifiés ni reconvertis automatiquement.'];
    if(action==='archive')warnings.push('Le contenu sera masqué des listes actives. Les conversions qui en dépendent peuvent devenir indisponibles.');
    if(action==='restore')warnings.push('Le contenu réapparaîtra dans les listes actives. Les conversions doivent toujours être vérifiées selon leurs dépendances.');
    if(action==='activate-revision')warnings.push('La révision choisie deviendra active. Les dépendances actives de ce contenu seront celles conservées dans cette révision.');
    if(action==='activate-revision'&&content.status==='archived')warnings.push('Le contenu restera archivé après ce changement de révision.');
    if(dependencies.some(dependency=>dependency.availability!=='available'))warnings.push('Certaines dépendances sont absentes, archivées, non résolues ou sur une autre révision. L’action ne les réparera pas.');
    const plan=immutable({action,contentId,name:nameOf(snapshot,contentId),expected:content,expectedSnapshot:librarySnapshotToken(snapshot),targetRevision:revision.revisionHash,targetDependencies,affected:libraryAffectedDependents(snapshot,contentId),dependencies,warnings});
    this.plans.add(plan);return plan;
  }
  async confirm(plan:LibraryManagementPlan,options:{confirmed?:boolean}={}):Promise<LibraryManagementResult>{
    if(!this.plans.has(plan))return {success:false,reason:'invalid-data',message:'Action inconnue ou modifiée. Préparez-la à nouveau.'};
    if(!options.confirmed)return {success:false,reason:'confirmation-required',message:'Confirmez explicitement cette opération.'};
    let stale=false;
    try{
      await this.database.runTransaction(LIBRARY_STORES,'readwrite',context=>{
        readLibrarySnapshotInTransaction(context,current=>{
          const actual=current.contents.find(record=>record.identity.id===plan.contentId);
          if(librarySnapshotToken(current)!==plan.expectedSnapshot||!actual||actual.generation!==plan.expected.generation||actual.activeRevision!==plan.expected.activeRevision||actual.status!==plan.expected.status){stale=true;context.abort();return;}
          const next:LibraryContentRecord={...actual,generation:actual.generation+1,updatedAt:new Date().toISOString(),
            status:plan.action==='archive'?'archived':plan.action==='restore'?'active':actual.status,
            activeRevision:plan.action==='activate-revision'?plan.targetRevision:actual.activeRevision};
          context.request(context.store('contents').put(next));
          if(plan.action==='activate-revision'){
            // Seule la projection active est remplacée ; les snapshots des révisions restent intacts.
            for(const edge of current.dependencies.filter(edge=>edge.ownerId===plan.contentId))context.request(context.store('dependencies').delete([edge.ownerId,edge.targetId,edge.relation]));
            for(const edge of plan.targetDependencies)context.request(context.store('dependencies').add(edge));
          }
        });
      });
      return {success:true,contentId:plan.contentId,action:plan.action};
    }catch(error){
      if(stale)return {success:false,reason:'concurrent-change',message:'La bibliothèque a changé depuis la préparation. Actualisez puis préparez et confirmez à nouveau cette action.'};
      return {success:false,reason:'storage-error',message:'L’opération a échoué. L’état précédent est conservé.',...(error instanceof LibraryDatabaseError?{storageCode:error.code}:{})};
    }
  }
  close():void{this.epoch++;this.database.close();}
}
