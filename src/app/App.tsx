import { useState } from 'react';
import { books } from '../data/books';
import { abilityModifier, proficiencyBonus } from '../engine/calculations';
import type { Ability, Character } from '../models/Character';
import { loadCharacters, saveCharacters } from '../services/storage';

const abilities: { key: Ability; label: string }[] = [
  {key:'str',label:'Force'},{key:'dex',label:'Dextérité'},{key:'con',label:'Constitution'},
  {key:'int',label:'Intelligence'},{key:'wis',label:'Sagesse'},{key:'cha',label:'Charisme'}
];
function newCharacter(): Character {
  return {schemaVersion:1,id:crypto.randomUUID(),name:'Nouvel aventurier',level:1,speciesId:'',classId:'',backgroundId:'',
    abilities:{str:8,dex:8,con:8,int:8,wis:8,cha:8},choices:{},
    gameState:{currentHP:1,temporaryHP:0,usedHitDice:0,usedSpellSlots:{},conditions:[]}};
}
export default function App() {
  const [characters,setCharacters] = useState<Character[]>(loadCharacters);
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [message,setMessage] = useState('');
  const current = characters.find(c=>c.id===selectedId);
  function update(next: Character[]) { setCharacters(next); if(!saveCharacters(next)) setMessage('Sauvegarde impossible : exportez vos données avant de quitter.'); }
  function patch(partial: Partial<Character>) { if(current) update(characters.map(c=>c.id===current.id?{...c,...partial}:c)); }
  function create() { const c=newCharacter(); update([...characters,c]); setSelectedId(c.id); }
  function exportData() {
    const blob=new Blob([JSON.stringify(characters,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download='mes-personnages.json';a.click();URL.revokeObjectURL(url);
  }
  return <div className="shell"><header className="top"><span className="crest">✦</span><div><small>DONJONS & DRAGONS · 2024 + COMPATIBILITÉ 2014</small><h1>L'Atelier des Aventuriers</h1></div></header>
    <nav><button onClick={()=>setSelectedId(null)}>Mes personnages</button><button onClick={()=>document.getElementById('library')?.scrollIntoView({behavior:'smooth'})}>Bibliothèque</button></nav>
    <main>{message && <p role="alert" className="warning">{message}</p>}
      {!current ? <section className="panel"><div className="section-title"><div><small>VOTRE CHRONIQUE</small><h2>Mes personnages</h2></div><button className="primary" onClick={create}>+ Nouveau personnage</button></div>
        <p className="muted">Première version : identité, caractéristiques, sauvegarde et export. Les classes, règles détaillées et fiches jouables seront ajoutées par modules.</p>
        <div className="cards">{characters.map(c=><button className="character-card" key={c.id} onClick={()=>setSelectedId(c.id)}><strong>{c.name}</strong><span>Niveau {c.level} · Fiche en préparation</span></button>)}</div>
        <button onClick={exportData} disabled={!characters.length}>Exporter mes personnages (JSON)</button>
      </section> : <section className="panel"><div className="section-title"><div><small>FICHE DE PERSONNAGE · PROTOTYPE</small><h2>{current.name}</h2></div><button onClick={()=>setSelectedId(null)}>← Retour</button></div>
        <div className="fields"><label>Nom<input value={current.name} maxLength={80} onChange={e=>patch({name:e.target.value})}/></label><label>Niveau<input type="number" min="1" max="20" value={current.level} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=20)patch({level:n});}}/></label></div>
        <p className="muted">Bonus de maîtrise : +{proficiencyBonus(current.level)}. Les valeurs ci-dessous sont provisoires : le choix de méthode et les bonus d'historique arrivent ensuite.</p>
        <div className="abilities">{abilities.map(({key,label})=><div className="ability" key={key}><span>{label}</span><strong>{abilityModifier(current.abilities[key])>=0?'+':''}{abilityModifier(current.abilities[key])}</strong><input aria-label={label} type="number" min="8" max="15" value={current.abilities[key]} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=8&&n<=15)patch({abilities:{...current.abilities,[key]:n}});}}/><small>Base (8–15)</small></div>)}</div>
        <p className="warning">Prototype : aucun contrôle de budget de 27 points pour l'instant. Ne pas utiliser comme validation finale d'une fiche.</p>
      </section>}
      <section className="panel" id="library"><small>CATALOGUE</small><h2>Bibliothèque générale</h2><p className="muted">Ouvrages référencés. Aucun contenu propriétaire n'est intégré à ce stade.</p><div className="book-list">{books.map(b=><div key={b.id}><span>{b.name}</span><small>{b.ruleset} · {b.integrated?'Intégré':'À intégrer'}</small></div>)}</div></section>
    </main><footer>Prototype 0.1 · Sauvegarde locale sur cet appareil · Projet non affilié à Wizards of the Coast</footer></div>;
}
