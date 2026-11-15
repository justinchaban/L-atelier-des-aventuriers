import { useCallback, useEffect, useRef, useState } from 'react';
import { LibraryIntegrityService } from '../../services/libraryIntegrity';
import type { LibraryDiagnosticReport } from '../../models/LibraryDiagnostics';

export default function LibraryDiagnosticsPanel({refreshToken=0}:{refreshToken?:number}){
  const [service]=useState(()=>new LibraryIntegrityService());
  const [report,setReport]=useState<LibraryDiagnosticReport|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [severity,setSeverity]=useState<'all'|'error'|'warning'|'info'>('all');
  const sequence=useRef(0),hasRun=useRef(false);
  useEffect(()=>()=>{sequence.current++;service.close();},[service]);
  const run=useCallback(async()=>{
    const request=++sequence.current;hasRun.current=true;setBusy(true);setError('');
    try{const result=await service.diagnose();if(request===sequence.current)setReport(result);}
    catch{if(request===sequence.current){setReport(null);setError('Impossible de lire ou d’analyser la bibliothèque. Aucune donnée n’a été modifiée.');}}
    finally{if(request===sequence.current)setBusy(false);}
  },[service]);
  useEffect(()=>{if(hasRun.current)void run();},[refreshToken,run]);
  return <section className="library-import-confirmation" aria-labelledby="library-diagnostics-title" aria-busy={busy}>
    <h3 id="library-diagnostics-title">Diagnostics d’intégrité</h3>
    <p>Analyse en lecture seule : aucune réparation ni suppression automatique.</p>
    <button type="button" disabled={busy} onClick={()=>{void run();}}>Lancer les diagnostics</button>
    {busy&&<p role="status">Vérification des originaux, révisions et dépendances…</p>}
    {error&&<p role="alert" className="warning">{error}</p>}
    {report&&<>
      <p role="status">{report.counts.error} erreur(s) bloquante(s) · {report.counts.warning} avertissement(s) · {report.counts.info} information(s)</p>
      <p>Analyse du {new Date(report.checkedAt).toLocaleString('fr-FR')}.</p>
      <label>Niveau<select value={severity} onChange={event=>setSeverity(event.target.value as typeof severity)}><option value="all">Tous les niveaux</option><option value="error">Erreurs bloquantes</option><option value="warning">Avertissements</option><option value="info">Informations</option></select></label>
      {report.diagnostics.length===0&&<p>Aucune anomalie détectée.</p>}
      <ul>{report.diagnostics.filter(item=>severity==='all'||item.severity===severity).map((item,index)=><li key={index}>
        <strong>{item.severity==='error'?'Erreur':item.severity==='warning'?'Avertissement':'Information'}</strong> : {item.message}
        {(item.contentId||item.revisionHash||item.importId)&&<details><summary>Références du diagnostic</summary><pre>{JSON.stringify({code:item.code,contenu:item.contentId,revision:item.revisionHash,original:item.importId},null,2)}</pre></details>}
      </li>)}</ul>
    </>}
  </section>;
}
