import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { LibraryBackupService } from '../../services/libraryBackupService';
import type { LibraryRestorePreview } from '../../models/LibraryBackup';
import { LibraryBackupError } from '../../engine/libraryBackup';
import { LibraryDatabaseError } from '../../services/libraryDatabase';

function errorMessage(error:unknown):string {
  if(error instanceof LibraryBackupError)return error.message;
  if(error instanceof LibraryDatabaseError){
    if(error.code==='quota')return 'Espace de stockage insuffisant. Aucune restauration effectuée.';
    if(error.code==='version')return 'La version de la bibliothèque est incompatible avec cette application. Vos données sont conservées.';
    if(error.code==='blocked')return 'La bibliothèque est bloquée par une autre connexion. Fermez les autres onglets puis réessayez.';
  }
  return 'L’opération a échoué. Vos données existantes sont conservées. Vous pouvez réessayer.';
}

export default function LibraryBackupPanel({onRestored}:{onRestored?:()=>void}) {
  const [service]=useState(()=>new LibraryBackupService());
  const picker=useRef<HTMLInputElement>(null);
  const busy=useRef(false);
  const epoch=useRef(0);
  const [phase,setPhase]=useState<'idle'|'exporting'|'validating'|'restoring'>('idle');
  const [preview,setPreview]=useState<LibraryRestorePreview|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [restored,setRestored]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>()=>{epoch.current++;service.close();},[service]);
  const loading=phase!=='idle';

  async function exportBackup() {
    if(busy.current)return;busy.current=true;const request=epoch.current;
    setPhase('exporting');setError('');setMessage('');
    try {
      const text=await service.exportBackup();if(request!==epoch.current)return;
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
      try {const link=document.createElement('a');link.href=url;link.download='atelier-bibliotheque-sauvegarde.json';link.click();}
      finally {URL.revokeObjectURL(url);}
      setMessage('Sauvegarde préparée avec vérification SHA-256. Le téléchargement a été demandé au navigateur.');
    }catch(failure){if(request===epoch.current)setError(errorMessage(failure));}
    finally{busy.current=false;if(request===epoch.current)setPhase('idle');}
  }
  async function selectBackup(event:ChangeEvent<HTMLInputElement>) {
    const control=event.currentTarget;const file=control.files?.[0];if(!file||busy.current)return;
    busy.current=true;const request=++epoch.current;
    setPhase('validating');setPreview(null);setConfirmed(false);setRestored(false);setMessage('');setError('');
    try {
      if(!file.name.toLowerCase().endsWith('.json'))throw new LibraryBackupError('invalid-data','Sélectionnez une sauvegarde JSON.');
      const text=await file.text();if(request!==epoch.current)return;
      const result=await service.previewRestore(text);if(request!==epoch.current)return;setPreview(result);
    }catch(failure){if(request===epoch.current)setError(errorMessage(failure));}
    finally{control.value='';busy.current=false;if(request===epoch.current)setPhase('idle');}
  }
  async function restoreBackup() {
    if(busy.current||!preview||!confirmed||!preview.destinationEmpty||restored)return;
    busy.current=true;const request=epoch.current;setPhase('restoring');setMessage('');setError('');
    try {
      const result=await service.restore(preview,{confirmed:true,mode:'empty'});if(request!==epoch.current)return;
      if(result.success){
        setRestored(true);setConfirmed(false);
        setMessage(`Restauration terminée : ${result.counts.imports} fichier(s), ${result.counts.contents} contenu(s), ${result.counts.revisions} révision(s) et ${result.counts.dependencies} dépendance(s).`);
        onRestored?.();
      }else{setError(result.message);setConfirmed(false);if(result.reason==='non-empty')setPreview({...preview,destinationEmpty:false});}
    }catch(failure){if(request===epoch.current)setError(errorMessage(failure));}
    finally{busy.current=false;if(request===epoch.current)setPhase('idle');}
  }
  const books=preview?[...new Set(preview.backup.data.contents.map(item=>item.identity.bookId))].sort():[];
  return (
    <section className="panel library-backup-panel" aria-labelledby="library-backup-title" aria-busy={loading}>
      <div className="section-title"><div><small>SAUVEGARDE LOCALE</small><h2 id="library-backup-title">Sauvegarder et restaurer la bibliothèque</h2></div></div>
      <p>La sauvegarde contient les fichiers originaux et tous les contenus, révisions et dépendances enregistrés. Elle n’inclut ni vos personnages ni vos campagnes. Aucune donnée n’est envoyée à un serveur.</p>
      <div className="fields">
        <button type="button" onClick={()=>{void exportBackup();}} disabled={loading}>Exporter ma bibliothèque</button>
        <button type="button" onClick={()=>picker.current?.click()} disabled={loading}>Restaurer une sauvegarde</button>
        <input ref={picker} type="file" accept=".json,application/json" aria-label="Sélectionner une sauvegarde de bibliothèque" style={{display:'none'}} disabled={loading} onChange={event=>{void selectBackup(event);}} />
      </div>
      {loading&&<p role="status">{phase==='exporting'?'Préparation et vérification de la sauvegarde…':phase==='validating'?'Validation du format, des empreintes et des liens de la sauvegarde…':'Restauration en cours. Attendez la confirmation de fin de transaction.'}</p>}
      {error&&<p role="alert" className="warning">{error}</p>}
      {message&&<p role="status">{message}</p>}
      {preview&&<div className="library-import-confirmation">
        <h3>Prévisualisation de la sauvegarde</h3>
        <p>Export du {new Date(preview.backup.exportedAt).toLocaleString('fr-FR')} · format {preview.backup.formatVersion} · schéma {preview.backup.compatibility.databaseVersion} · empreinte SHA-256 vérifiée.</p>
        <p>{preview.counts.imports} fichier(s) original(aux) · {preview.counts.contents} contenu(s) · {preview.counts.revisions} révision(s) · {preview.counts.dependencies} dépendance(s)</p>
        <p>Livres : {books.join(', ')||'aucun contenu identifié'}</p>
        <details><summary>Contenus de la sauvegarde</summary><ul>{preview.backup.data.contents.map(item=><li key={item.identity.id}>{preview.backup.data.revisions.find(revision=>revision.contentId===item.identity.id&&revision.revisionHash===item.activeRevision)?.origins[0]?.originalName??item.identity.normalizedName} · {item.identity.category} · {item.identity.bookId} · {item.status==='active'?'Actif':'Archivé'}</li>)}</ul></details>
        <fieldset disabled={loading||restored}>
          <legend>Mode de restauration</legend>
          <label className="library-import-approval"><input type="radio" name="library-restore-mode" checked readOnly />Restaurer dans une bibliothèque vide</label>
          <label className="library-import-approval"><input type="radio" name="library-restore-mode" disabled />Fusion contrôlée — non disponible dans cette version</label>
          <label className="library-import-approval"><input type="radio" name="library-restore-mode" disabled />Remplacement complet — non disponible dans cette version</label>
        </fieldset>
        {!preview.destinationEmpty&&!restored&&<p className="warning">La bibliothèque contient déjà des données. Pour cette version, la restauration est autorisée uniquement dans une bibliothèque vide. Aucune donnée existante ne sera effacée.</p>}
        <label className="library-import-approval"><input type="checkbox" checked={confirmed} disabled={loading||restored||!preview.destinationEmpty} onChange={event=>setConfirmed(event.target.checked)} />Je confirme la restauration de cette sauvegarde dans la bibliothèque vide de ce navigateur.</label>
        <button type="button" className="primary" disabled={loading||restored||!preview.destinationEmpty||!confirmed} onClick={()=>{void restoreBackup();}}>Confirmer la restauration</button>
      </div>}
    </section>
  );
}
