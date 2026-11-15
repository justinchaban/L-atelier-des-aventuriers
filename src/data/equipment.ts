
import type {
  EquipmentItem
} from '../models/Equipment';

export const equipment: EquipmentItem[] = [
  // ==========================================
  // ARMES
  // ==========================================

  {
    id: 'club',
    name: 'Gourdin',
    category: 'weapon',
    costGP: 0.1,
    weight: 1,
    bookId: 'XSRD'
  },
  {
    id: 'dagger',
    name: 'Dague',
    category: 'weapon',
    costGP: 2,
    weight: 0.5,
    bookId: 'XSRD'
  },
  {
    id: 'quarterstaff',
    name: 'Bâton',
    category: 'weapon',
    costGP: 0.2,
    weight: 2,
    bookId: 'XSRD'
  },
  {
    id: 'shortsword',
    name: 'Épée courte',
    category: 'weapon',
    costGP: 10,
    weight: 1,
    bookId: 'XSRD'
  },
  {
    id: 'longsword',
    name: 'Épée longue',
    category: 'weapon',
    costGP: 15,
    weight: 1.5,
    bookId: 'XSRD'
  },
  {
    id: 'greatsword',
    name: 'Épée à deux mains',
    category: 'weapon',
    costGP: 50,
    weight: 3,
    bookId: 'XSRD'
  },
  {
    id: 'greataxe',
    name: 'Hache à deux mains',
    category: 'weapon',
    costGP: 30,
    weight: 3.5,
    bookId: 'XSRD'
  },
  {
    id: 'flail',
    name: 'Fléau',
    category: 'weapon',
    costGP: 10,
    weight: 1,
    bookId: 'XSRD'
  },
  {
    id: 'javelin',
    name: 'Javeline',
    category: 'weapon',
    costGP: 0.5,
    weight: 1,
    bookId: 'XSRD'
  },
  {
    id: 'light-crossbow',
    name: 'Arbalète légère',
    category: 'weapon',
    costGP: 25,
    weight: 2.5,
    bookId: 'XSRD'
  },
  {
    id: 'longbow',
    name: 'Arc long',
    category: 'weapon',
    costGP: 50,
    weight: 1,
    bookId: 'XSRD'
  },

  // ==========================================
  // ARMURES ET BOUCLIERS
  // ==========================================

  {
    id: 'leather-armor',
    name: 'Armure de cuir',
    category: 'armor',
    costGP: 10,
    weight: 5,
    bookId: 'XSRD'
  },
  {
    id: 'chain-mail',
    name: 'Cotte de mailles',
    category: 'armor',
    costGP: 75,
    weight: 27.5,
    bookId: 'XSRD'
  },
  {
    id: 'shield',
    name: 'Bouclier',
    category: 'shield',
    costGP: 10,
    weight: 3,
    bookId: 'XSRD'
  },

  // ==========================================
  // MATÉRIEL D'AVENTURIER
  // ==========================================

  {
    id: 'backpack',
    name: 'Sac à dos',
    category: 'adventuring-gear',
    costGP: 2,
    weight: 2.5,
    bookId: 'XSRD'
  },
  {
    id: 'rope',
    name: 'Corde (15 mètres)',
    category: 'adventuring-gear',
    costGP: 1,
    weight: 2.5,
    bookId: 'XSRD'
  },
  {
    id: 'torch',
    name: 'Torche',
    category: 'adventuring-gear',
    costGP: 0.01,
    weight: 0.5,
    bookId: 'XSRD'
  },
  {
    id: 'crossbow-bolt',
    name: "Carreau d'arbalète",
    category: 'adventuring-gear',
    costGP: 0.05,
    weight: 0.075,
    bookId: 'XSRD'
  },
  {
    id: 'crossbow-bolt-case',
    name: 'Carquois à carreaux',
    category: 'adventuring-gear',
    costGP: 1,
    weight: 0.5,
    bookId: 'XSRD'
  },

  // ==========================================
  // PAQUETAGES
  // ==========================================

  {
    id: 'explorers-pack',
    name: "Paquetage d'explorateur",
    category: 'pack',
    costGP: 10,
    bookId: 'XSRD'
  },
  {
    id: 'priests-pack',
    name: 'Paquetage de prêtre',
    category: 'pack',
    costGP: 33,
    bookId: 'XSRD'
  },
  {
    id: 'scholars-pack',
    name: "Paquetage d'érudit",
    category: 'pack',
    costGP: 40,
    bookId: 'XSRD'
  }
];

// ==========================================
// FONCTIONS DE RECHERCHE
// ==========================================

export function getEquipmentById(
  id: string
): EquipmentItem | undefined {
  return equipment.find(
    item => item.id === id
  );
}

export function getEquipmentByCategory(
  category: EquipmentItem['category']
): EquipmentItem[] {
  return equipment.filter(
    item => item.category === category
  );
}
