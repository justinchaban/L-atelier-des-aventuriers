import { useEffect, useRef, useState } from 'react';
import { LibraryIntegrityService } from '../../services/libraryIntegrity';
import type { LibraryDeletionPlan } from '../../services/libraryIntegrity';
import { LibraryBackupService } from '../../services/libraryBackupService';
import type { LibraryEntryView } from '../../services/libraryQuery';

export default function LibraryPermanentDeletion({entry,onDeleted,disabled=false}:{entry:LibraryEntryView;onDeleted:(message:string)=>void;disabled?:boolean}){
  const [service]=useState(()=>new LibraryIntegrityService());const [backup]=useState(()=>new LibraryBackupService());
  const [plan,setPlan]=useState<LibraryDeletionPlan|null>(null);
  const [typedName,setTypedName]=useState('');const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');const [stale,setStale]=useState(false);
  const lock=useRef(false),epoch=useRef(0);
  useEffect(()=>()=>{epoch.current++;service.close();backup.close();},[service,backup]);
  async function prepare(){
    if(lock.current||disabled)return;lock.current=true;const request=epoch.current;
    setBusy(true);setPlan(null);setTypedName('');setConfirmed(false);setStale(false);setError('');setMessage('');
    try{const result=await service.prepareDeletion(entry.id);if(request===epoch.current)setPlan(result);}
    catch{if(request===epoch.current)setError('Impossible d’établir un rapport de suppression fiable. Aucune donnée n’a été supprimée.');}
    finally{lock.current=false;if(request===epoch.current)setBusy(false);}
  }
  async function exportFirst(){
    if(lock.current)return;lock.current=true;const request=epoch.current;setBusy(true);setError('');
    try{
      const text=await backup.exportBackup();if(request!==epoch.current)return;
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
      try{const link=document.createElement('a');link.href=url;link.download='atelier-bibliotheque-avant-suppression.json';link.click();}finally{URL.revokeObjectURL(url);}
      setMessage('Téléchargement de la sauvegarde demandé. Vérifiez sa présence sur votre ordinateur avant de poursuivre.');
    }catch{if(request===epoch.current)setError('La sauvegarde n’a pas pu être exportée. Aucune suppression n’a été effectuée.');}
    finally{lock.current=false;if(request===epoch.current)setBusy(false);}
  }
  async function confirm(){
    if(lock.current||disabled||!plan?.impact.allowed||stale||!confirmed||typedName!==plan.impact.name)return;
    lock.current=true;const request=epoch.current;setBusy(true);setError('');
    try{
      const result=await service.deletePermanently(plan,{confirmed:true,typedName});if(request!==epoch.current)return;
      if(result.success)onDeleted('Contenu supprimé définitivement de la bibliothèque indexée. Les fichiers originaux ont été conservés.');
      else{setError(result.message);setConfirmed(false);setStale(result.reason==='concurrent-change');}
    }catch{if(request===epoch.current){setError('La suppression a échoué. L’état précédent est conservé.');setConfirmed(false);}}
    finally{lock.current=false;if(request===epoch.current)setBusy(false);}
  }
  return <section className="library-import-confirmation" aria-label="Suppression définitive sécurisée" aria-busy={busy}>
    <h4>Suppression définitive</h4>
    <p>Cette action est distincte de l’archivage. Elle retire irréversiblement le contenu indexé et ses révisions. Les fichiers originaux sont conservés : un réimport explicite pourra recréer le contenu.</p>
    <button type="button" disabled={busy||disabled} onClick={()=>{void prepare();}}>Supprimer définitivement</button>
    {busy&&<p role="status">Analyse ou transaction en cours…</p>}
    {error&&<p role="alert" className="warning">{error}</p>}{message&&<p role="status">{message}</p>}
    {plan&&<>
      <h4>Rapport d’impact : {plan.impact.name}</h4>
      <p>{plan.report.counts.error} erreur(s) d’intégrité bloquante(s). {plan.impact.revisionsToDelete.length} révision(s), {plan.impact.conversionsToDelete} conversion(s) et {plan.impact.dependenciesToDelete} dépendance(s) propres seraient retirées. Tous les fichiers originaux ({plan.impact.originalsPreserved}) seraient conservés.</p>
      {!plan.impact.allowed&&<div role="alert" className="warning"><strong>Suppression refusée.</strong><ul>{plan.impact.reasons.map((reason,index)=><li key={index}>{reason}</li>)}</ul></div>}
      <h4>Dépendants directs et indirects</h4>
      {plan.impact.dependents.length?<ul>{plan.impact.dependents.map(item=><li key={item.id}>{item.name} · {item.direct?'direct':'indirect'}</li>)}</ul>:<p>Aucun dépendant déclaré.</p>}
      <details><summary>Révisions, conversions et originaux concernés ({plan.impact.references.length})</summary><ul>{plan.impact.references.map((reference,index)=><li key={index}>{reference.ownerName} : {reference.message}<pre>{JSON.stringify(reference,null,2)}</pre></li>)}</ul></details>
      <button type="button" disabled={busy} onClick={()=>{void exportFirst();}}>Exporter une sauvegarde avant suppression</button>
      {plan.impact.allowed&&<>
        <p className="warning">Opération irréversible. Aucune suppression en cascade et aucune modification des contenus dépendants ne seront effectuées.</p>
        <label>Saisir le nom exact : <strong>{plan.impact.name}</strong><input type="text" value={typedName} disabled={busy||disabled||stale} onChange={event=>setTypedName(event.target.value)} autoComplete="off" /></label>
        <label className="library-import-approval"><input type="checkbox" checked={confirmed} disabled={busy||disabled||stale} onChange={event=>setConfirmed(event.target.checked)} />Je comprends que le contenu indexé et ses révisions seront supprimés définitivement.</label>
        <button type="button" disabled={busy||disabled||stale||!confirmed||typedName!==plan.impact.name} onClick={()=>{void confirm();}}>Confirmer la suppression définitive</button>
      </>}
      {stale&&<button type="button" disabled={busy||disabled} onClick={()=>{void prepare();}}>Relancer l’analyse de suppression</button>}
      <button type="button" disabled={busy} onClick={()=>{setPlan(null);setTypedName('');setConfirmed(false);setError('');setMessage('');}}>Annuler</button>
    </>}
  </section>;
}
