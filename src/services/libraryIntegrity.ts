import type { LibraryContentId } from '../models/Library';
import type { LibraryDeletionImpact, LibraryDiagnosticReport } from '../models/LibraryDiagnostics';
import { diagnoseLibrarySnapshot, analyzeLibraryDeletion } from '../engine/libraryDiagnostics';
import { librarySnapshotToken } from '../engine/libraryImport';
import { validateLibraryBackupData } from '../engine/libraryBackup';
import { LibraryDatabase, LibraryDatabaseError, LIBRARY_STORES } from './libraryDatabase';
import { readLibrarySnapshot, readLibrarySnapshotInTransaction } from './libraryRepository';

export interface LibraryDeletionPlan {
  impact:LibraryDeletionImpact;
  report:LibraryDiagnosticReport;
  expectedSnapshot:string;
}
export type LibraryDeletionResult =
  | {success:true;contentId:LibraryContentId;deletedRevisions:number}
  | {success:false;reason:'confirmation-required'|'blocked'|'concurrent-change'|'invalid-data'|'storage-error';message:string;storageCode?:string};
const immutable=<T,>(value:T):T=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))immutable(child);Object.freeze(value);}return value;};

/** Diagnostics en lecture seule et suppression sans cascade, originaux toujours préservés. */
export class LibraryIntegrityService {
  private readonly plans=new WeakSet<LibraryDeletionPlan>();
  private epoch=0;
  constructor(private readonly database=new LibraryDatabase()){}
  async diagnose():Promise<LibraryDiagnosticReport>{return diagnoseLibrarySnapshot(await readLibrarySnapshot(this.database));}
  async prepareDeletion(id:LibraryContentId):Promise<LibraryDeletionPlan>{
    const epoch=this.epoch;
    const snapshot=await readLibrarySnapshot(this.database);
    const report=await diagnoseLibrarySnapshot(snapshot);
    let impact:LibraryDeletionImpact;
    try{impact=analyzeLibraryDeletion(snapshot,id,report);}catch{
      impact={contentId:id,name:id,allowed:false,reasons:['Les données ne permettent pas une analyse fiable de la suppression.'],references:[],dependents:[],revisionsToDelete:[],conversionsToDelete:0,dependenciesToDelete:0,originalsPreserved:snapshot.imports.length};
    }
    if(impact.allowed)try{
      // Prouver avant écriture que la projection restante reste exportable/restaurable.
      await validateLibraryBackupData({imports:snapshot.imports,contents:snapshot.contents.filter(item=>item.identity.id!==id),revisions:snapshot.revisions.filter(item=>item.contentId!==id),dependencies:snapshot.dependencies.filter(item=>item.ownerId!==id)});
    }catch{impact={...impact,allowed:false,reasons:[...impact.reasons,'La bibliothèque restante ne peut pas être validée. Suppression refusée.']};}
    if(epoch!==this.epoch)throw new LibraryDatabaseError('transaction','Analyse fermée.');
    const plan=immutable({impact,report,expectedSnapshot:librarySnapshotToken(snapshot)});this.plans.add(plan);return plan;
  }
  async deletePermanently(plan:LibraryDeletionPlan,options:{confirmed?:boolean;typedName?:string}={}):Promise<LibraryDeletionResult>{
    if(!this.plans.has(plan))return {success:false,reason:'invalid-data',message:'Analyse inconnue. Préparez la suppression à nouveau.'};
    if(!plan.impact.allowed)return {success:false,reason:'blocked',message:'La sûreté de la suppression n’est pas établie. Consultez le rapport d’impact.'};
    if(options.confirmed!==true||options.typedName!==plan.impact.name)return {success:false,reason:'confirmation-required',message:'Confirmez le caractère irréversible et saisissez le nom exact, sans modifier la casse ni les espaces.'};
    let stale=false,blocked=false;
    try{
      await this.database.runTransaction(LIBRARY_STORES,'readwrite',context=>{
        readLibrarySnapshotInTransaction(context,current=>{
          if(librarySnapshotToken(current)!==plan.expectedSnapshot){stale=true;context.abort();return;}
          // Réanalyse synchrone des références sous verrou ; les validations cryptographiques sont
          // celles du snapshot identique préparé, aucune attente externe dans la transaction.
          const impact=analyzeLibraryDeletion(current,plan.impact.contentId,plan.report);
          if(!impact.allowed||impact.name!==options.typedName){blocked=true;context.abort();return;}
          const id=impact.contentId;
          for(const revision of current.revisions.filter(item=>item.contentId===id))context.request(context.store('revisions').delete([id,revision.revisionHash]));
          for(const edge of current.dependencies.filter(item=>item.ownerId===id))context.request(context.store('dependencies').delete([edge.ownerId,edge.targetId,edge.relation]));
          context.request(context.store('contents').delete(id));
          // imports, révisions étrangères et contenus dépendants ne sont jamais modifiés.
        });
      });
      return {success:true,contentId:plan.impact.contentId,deletedRevisions:plan.impact.revisionsToDelete.length};
    }catch(error){
      if(stale)return {success:false,reason:'concurrent-change',message:'La bibliothèque a changé. Relancez l’analyse de suppression et renouvelez la confirmation.'};
      if(blocked)return {success:false,reason:'blocked',message:'Une référence empêche désormais cette suppression.'};
      return {success:false,reason:'storage-error',message:'La suppression a échoué. L’état précédent est conservé.',...(error instanceof LibraryDatabaseError?{storageCode:error.code}:{})};
    }
  }
  close():void{this.epoch++;this.database.close();}
}
