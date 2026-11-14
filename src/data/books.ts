export interface Book { id: string; name: string; ruleset: '2014'|'2024'; integrated: boolean; }
// A referenced book is not necessarily integrated into the rules database.
export const books: Book[] = [
  {id:'srd-5.2.1',name:'SRD 5.2.1',ruleset:'2024',integrated:false},
  {id:'phb-2024',name:'Manuel des Joueurs (2024)',ruleset:'2024',integrated:false},
  {id:'xge-2017',name:'Guide complet de Xanathar',ruleset:'2014',integrated:false},
  {id:'tce-2020',name:'Chaudron des merveilles de Tasha',ruleset:'2014',integrated:false}
];
