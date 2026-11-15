import type { LibraryRestorePreview } from '../models/LibraryBackup';
import { LibraryBackupError, createLibraryBackup, libraryBackupCounts, parseLibraryBackup } from '../engine/libraryBackup';
import { LibraryDatabase, LibraryDatabaseError, LIBRARY_STORES } from './libraryDatabase';
import { readLibrarySnapshot } from './libraryRepository';

export type LibraryRestoreResult =
  | { success:true; counts: LibraryRestorePreview['counts'] }
  | { success:false; reason:'confirmation-required'|'unsupported-mode'|'non-empty'|'invalid-data'|'storage-error'; message:string; storageCode?:string };
function immutable<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))immutable(child);Object.freeze(value);}return value;
}

/** Export cohérent et restauration uniquement dans une bibliothèque entièrement vide. */
export class LibraryBackupService {
  private epoch=0;
  private readonly previews=new WeakSet<LibraryRestorePreview>();
  constructor(private readonly database=new LibraryDatabase()) {}
  async exportBackup():Promise<string> {
    const epoch=this.epoch;const data=await readLibrarySnapshot(this.database);
    if(epoch!==this.epoch)throw new LibraryBackupError('invalid-data','Opération fermée.');
    return createLibraryBackup(data);
  }
  async previewRestore(text:string):Promise<LibraryRestorePreview> {
    const epoch=this.epoch;
    const backup=await parseLibraryBackup(text); // Validation et SHA-256 avant toute écriture.
    if(epoch!==this.epoch)throw new LibraryBackupError('invalid-data','Opération fermée.');
    const existing=await readLibrarySnapshot(this.database);
    if(epoch!==this.epoch)throw new LibraryBackupError('invalid-data','Opération fermée.');
    const preview=immutable({backup,counts:libraryBackupCounts(backup.data),destinationEmpty:LIBRARY_STORES.every(store=>existing[store].length===0)});
    this.previews.add(preview);return preview;
  }
  async restore(preview:LibraryRestorePreview, options:{confirmed?:boolean;mode?:'empty'|'merge'|'replace'}={}):Promise<LibraryRestoreResult> {
    if(!this.previews.has(preview))return {success:false,reason:'invalid-data',message:'Sauvegarde non validée : sélectionnez et vérifiez le fichier à nouveau.'};
    if(!options.confirmed)return {success:false,reason:'confirmation-required',message:'Une confirmation explicite est nécessaire.'};
    if(options.mode!==undefined&&options.mode!=='empty')return {success:false,reason:'unsupported-mode',message:'La fusion et le remplacement sont désactivés dans cette version.'};
    let nonEmpty=false;
    try {
      await this.database.runTransaction(LIBRARY_STORES,'readwrite',context=> {
        let remaining=LIBRARY_STORES.length;
        let occupied=false;
        for(const store of LIBRARY_STORES) context.request(context.store(store).count(),count=> {
          occupied ||= count>0;
          if(--remaining!==0)return;
          if(occupied){nonEmpty=true;context.abort();return;}
          for(const name of LIBRARY_STORES) for(const entry of preview.backup.data[name]) context.request(context.store(name).add(entry));
        });
      });
      return {success:true,counts:preview.counts};
    }catch(error){
      if(nonEmpty)return {success:false,reason:'non-empty',message:'La bibliothèque contient déjà des données. Restauration annulée sans modification. La fusion et le remplacement ne sont pas disponibles.'};
      const storageCode=error instanceof LibraryDatabaseError?error.code:undefined;
      return {success:false,reason:'storage-error',message:storageCode==='quota'?'Espace de stockage insuffisant. La restauration entière a été annulée.':'La restauration a échoué. Aucune donnée de la sauvegarde n’a été ajoutée.',...(storageCode?{storageCode}:{})};
    }
  }
  close():void {this.epoch++;this.database.close();}
}
