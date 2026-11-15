
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
    bookId: 'srd-5.2.1'
  },
  {
    id: 'dagger',
    name: 'Dague',
    category: 'weapon',
    costGP: 2,
    weight: 0.5,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'quarterstaff',
    name: 'Bâton',
    category: 'weapon',
    costGP: 0.2,
    weight: 2,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'shortsword',
    name: 'Épée courte',
    category: 'weapon',
    costGP: 10,
    weight: 1,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'longsword',
    name: 'Épée longue',
    category: 'weapon',
    costGP: 15,
    weight: 1.5,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'greatsword',
    name: 'Épée à deux mains',
    category: 'weapon',
    costGP: 50,
    weight: 3,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'greataxe',
    name: 'Hache à deux mains',
    category: 'weapon',
    costGP: 30,
    weight: 3.5,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'flail',
    name: 'Fléau',
    category: 'weapon',
    costGP: 10,
    weight: 1,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'javelin',
    name: 'Javeline',
    category: 'weapon',
    costGP: 0.5,
    weight: 1,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'light-crossbow',
    name: 'Arbalète légère',
    category: 'weapon',
    costGP: 25,
    weight: 2.5,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'longbow',
    name: 'Arc long',
    category: 'weapon',
    costGP: 50,
    weight: 1,
    bookId: 'srd-5.2.1'
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
    bookId: 'srd-5.2.1'
  },
  {
    id: 'chain-mail',
    name: 'Cotte de mailles',
    category: 'armor',
    costGP: 75,
    weight: 27.5,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'shield',
    name: 'Bouclier',
    category: 'shield',
    costGP: 10,
    weight: 3,
    bookId: 'srd-5.2.1'
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
    bookId: 'srd-5.2.1'
  },
  {
    id: 'rope',
    name: 'Corde (15 mètres)',
    category: 'adventuring-gear',
    costGP: 1,
    weight: 2.5,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'torch',
    name: 'Torche',
    category: 'adventuring-gear',
    costGP: 0.01,
    weight: 0.5,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'crossbow-bolt',
    name: "Carreau d'arbalète",
    category: 'adventuring-gear',
    costGP: 0.05,
    weight: 0.075,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'crossbow-bolt-case',
    name: 'Carquois à carreaux',
    category: 'adventuring-gear',
    costGP: 1,
    weight: 0.5,
    bookId: 'srd-5.2.1'
  },

  // ==========================================
  // PAQUETAGES
  // ==========================================

  {
    id: 'explorers-pack',
    name: "Paquetage d'explorateur",
    category: 'pack',
    costGP: 10,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'priests-pack',
    name: 'Paquetage de prêtre',
    category: 'pack',
    costGP: 33,
    bookId: 'srd-5.2.1'
  },
  {
    id: 'scholars-pack',
    name: "Paquetage d'érudit",
    category: 'pack',
    costGP: 40,
    bookId: 'srd-5.2.1'
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
