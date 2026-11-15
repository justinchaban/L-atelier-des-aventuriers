import { useEffect, useRef, useState } from 'react';
import type { LibraryFingerprint } from '../../models/Library';
import { LibraryManagementService } from '../../services/libraryManagement';
import type { LibraryManagementAction, LibraryManagementPlan } from '../../services/libraryManagement';
import { LibraryQueryService } from '../../services/libraryQuery';
import type { LibraryEntryView, LibraryRevisionView } from '../../services/libraryQuery';
import EntryRenderer from '../content/EntryRenderer';
import LibraryPermanentDeletion from './LibraryPermanentDeletion';

const actionLabels:Record<LibraryManagementAction,string>={archive:'Archiver',restore:'Restaurer','activate-revision':'Activer cette révision'};
const availabilityLabels={available:'disponible',missing:'absente',archived:'archivée','different-revision':'sur une autre révision',unresolved:'non résolue'};

export default function LibraryContentManagement({entry,onChanged,disabled=false}:{entry:LibraryEntryView;onChanged:(message:string)=>void;disabled?:boolean}){
  const [manager]=useState(()=>new LibraryManagementService());
  const [query]=useState(()=>new LibraryQueryService());
  const [history,setHistory]=useState<LibraryRevisionView[]>([]);
  const [historyLoading,setHistoryLoading]=useState(true);
  const [historyError,setHistoryError]=useState('');
  const [selectedRevision,setSelectedRevision]=useState<LibraryFingerprint|null>(null);
  const [plan,setPlan]=useState<LibraryManagementPlan|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [stale,setStale]=useState(false);
  const lock=useRef(false);const epoch=useRef(0);const historyRequest=useRef(0);
  useEffect(()=>()=>{epoch.current++;historyRequest.current++;manager.close();query.close();},[manager,query]);
  useEffect(()=>{
    const request=++historyRequest.current;setHistoryLoading(true);setHistoryError('');
    void query.history(entry.id).then(result=>{if(request===historyRequest.current)setHistory(result);},()=>{
      if(request===historyRequest.current)setHistoryError('Impossible de lire l’historique. Actualisez la bibliothèque pour réessayer.');
    }).finally(()=>{if(request===historyRequest.current)setHistoryLoading(false);});
    return ()=>{historyRequest.current++;};
  },[entry.id,entry.revision,entry.record.generation,query]);

  async function prepare(action:LibraryManagementAction,revision?:LibraryFingerprint){
    if(lock.current||disabled)return;lock.current=true;const request=epoch.current;
    setBusy(true);setError('');setPlan(null);setConfirmed(false);setStale(false);
    try{const prepared=await manager.prepare(entry.id,action,revision);if(request===epoch.current)setPlan(prepared);}
    catch(failure){if(request===epoch.current)setError(failure instanceof Error?failure.message:'Impossible de préparer l’opération.');}
    finally{lock.current=false;if(request===epoch.current)setBusy(false);}
  }
  async function confirm(){
    if(lock.current||disabled||!plan||!confirmed||stale)return;
    lock.current=true;const request=epoch.current;setBusy(true);setError('');
    try{
      const result=await manager.confirm(plan,{confirmed:true});if(request!==epoch.current)return;
      if(result.success){setPlan(null);setConfirmed(false);onChanged(plan.action==='archive'?'Contenu archivé. Les données historiques sont conservées.':plan.action==='restore'?'Contenu restauré dans les listes actives.':'Révision active modifiée. Toutes les révisions sont conservées.');}
      else{setError(result.message);setConfirmed(false);setStale(result.reason==='concurrent-change');}
    }catch{if(request===epoch.current){setError('L’opération a échoué. L’état précédent est conservé.');setConfirmed(false);}}
    finally{lock.current=false;if(request===epoch.current)setBusy(false);}
  }
  const selected=history.find(item=>item.revision.revisionHash===selectedRevision);
  return <section aria-label="Gestion du contenu" className="library-content-management" aria-busy={busy}>
    <h4>Gestion du contenu</h4>
    <button type="button" disabled={busy||disabled} onClick={()=>{void prepare(entry.status==='active'?'archive':'restore');}}>{entry.status==='active'?'Archiver':'Restaurer'}</button>
    {busy&&<p role="status">Préparation ou enregistrement de l’opération en cours…</p>}
    {error&&<p role="alert" className="warning">{error}</p>}
    {plan&&<div className="library-import-confirmation">
      <h4>Confirmer : {actionLabels[plan.action]} — {plan.name}</h4>
      {plan.action==='activate-revision'&&<p>Révision choisie : <code>{plan.targetRevision}</code></p>}
      <ul>{plan.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>
      <h4>Contenus dépendants potentiellement affectés ({plan.affected.length})</h4>
      {plan.affected.length?<ul>{plan.affected.map(item=><li key={item.id}>{item.name} · {item.bookId} · {item.status==='active'?'Actif':'Archivé'} · lien {item.direct?'direct':'indirect'}</li>)}</ul>:<p>Aucun contenu dépendant connu.</p>}
      <h4>Dépendances du contenu après l’opération</h4>
      {plan.dependencies.length?<ul>{plan.dependencies.map((item,index)=><li key={index}>{item.name} · {item.bookId} · {availabilityLabels[item.availability]}</li>)}</ul>:<p>Aucune dépendance déclarée.</p>}
      <label className="library-import-approval"><input type="checkbox" checked={confirmed} disabled={busy||disabled||stale} onChange={event=>setConfirmed(event.target.checked)} />Je confirme cette opération et ses effets potentiels sur les dépendances.</label>
      <button type="button" className="primary" disabled={busy||disabled||!confirmed||stale} onClick={()=>{void confirm();}}>Confirmer l’opération</button>
      <button type="button" disabled={busy} onClick={()=>{setPlan(null);setConfirmed(false);setStale(false);setError('');}}>Annuler</button>
      {stale&&<button type="button" disabled={busy||disabled} onClick={()=>{void prepare(plan.action,plan.targetRevision);}}>Préparer à nouveau l’opération</button>}
    </div>}
    <LibraryPermanentDeletion key={entry.id} entry={entry} disabled={busy||disabled} onDeleted={onChanged} />
    <h4>Historique des révisions</h4>
    {historyLoading&&<p role="status">Chargement de l’historique…</p>}
    {historyError&&<p role="alert" className="warning">{historyError}</p>}
    {!historyLoading&&!historyError&&<>
      {history.length===0&&<p>Aucune révision retrouvée.</p>}
      <ul>{history.map(item=><li key={item.revision.revisionHash}>
        <button type="button" aria-pressed={selectedRevision===item.revision.revisionHash} onClick={()=>setSelectedRevision(item.revision.revisionHash)}>
          {item.isActive?'Révision active':'Révision historique'} · {item.revision.createdAt}<br/><code>{item.revision.revisionHash}</code>
        </button>
      </li>)}</ul>
      {selected&&<article aria-label="Détails de la révision historique">
        <h4>{selected.isActive?'Détails de la révision active':'Détails de la révision historique'}</h4>
        <p>{selected.details.name} · <code>{selected.revision.revisionHash}</code></p>
        <ul>{selected.details.origins.map((origin,index)=><li key={index}>Source originale : {origin.provenance.originalSource} · livre canonique : {origin.provenance.bookId} · {origin.filenames.join(', ')}</li>)}</ul>
        {selected.details.originalEntry?.entries!==undefined&&<EntryRenderer entries={selected.details.originalEntry.entries}/>}
        {selected.details.issues.length>0&&<ul className="warning">{selected.details.issues.map((issue,index)=><li key={index}>{issue}</li>)}</ul>}
        <details><summary>Données et conversions de cette révision</summary><pre>{JSON.stringify(selected.details.originalEntry??null,null,2)}</pre><pre>{JSON.stringify(selected.revision,null,2)}</pre></details>
        {!selected.isActive&&<button type="button" disabled={busy||disabled} onClick={()=>{void prepare('activate-revision',selected.revision.revisionHash);}}>Activer cette révision</button>}
      </article>}
    </>}
  </section>;
}
