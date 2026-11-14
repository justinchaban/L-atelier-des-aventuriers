
export interface Book {
  id: string;
  name: string;
  ruleset: '2014' | '2024';
  category: 'core' | 'supplement' | 'srd';
  integrated: boolean;
}

export const books: Book[] = [
  {
    id: 'srd-5.2.1',
    name: 'SRD 5.2.1',
    ruleset: '2024',
    category: 'srd',
    integrated: false
  },
  {
    id: 'phb-2024',
    name: 'Manuel des Joueurs (2024)',
    ruleset: '2024',
    category: 'core',
    integrated: false
  },
  {
    id: 'xge-2017',
    name: 'Guide complet de Xanathar',
    ruleset: '2014',
    category: 'supplement',
    integrated: false
  },
  {
    id: 'tce-2020',
    name: 'Chaudron des merveilles de Tasha',
    ruleset: '2014',
    category: 'supplement',
    integrated: false
  }
];
