
import type { Weapon } from '../models/Weapon';

export const weapons: Weapon[] = [
  {
    id: 'dagger',
    name: 'Dague',
    category: 'simple',
    attackType: 'melee',
    damage: '1d4',
    damageType: 'piercing',
    properties: ['finesse', 'light', 'thrown'],
    mastery: 'nick',
    bookId: 'XSRD'
  },
  {
    id: 'club',
    name: 'Gourdin',
    category: 'simple',
    attackType: 'melee',
    damage: '1d4',
    damageType: 'bludgeoning',
    properties: ['light'],
    mastery: 'slow',
    bookId: 'XSRD'
  },
  {
    id: 'handaxe',
    name: 'Hachette',
    category: 'simple',
    attackType: 'melee',
    damage: '1d6',
    damageType: 'slashing',
    properties: ['light', 'thrown'],
    mastery: 'vex',
    bookId: 'XSRD'
  },
  {
    id: 'shortsword',
    name: 'Épée courte',
    category: 'martial',
    attackType: 'melee',
    damage: '1d6',
    damageType: 'piercing',
    properties: ['finesse', 'light'],
    mastery: 'vex',
    bookId: 'XSRD'
  },
  {
    id: 'scimitar',
    name: 'Cimeterre',
    category: 'martial',
    attackType: 'melee',
    damage: '1d6',
    damageType: 'slashing',
    properties: ['finesse', 'light'],
    mastery: 'nick',
    bookId: 'XSRD'
  },
  {
    id: 'longsword',
    name: 'Épée longue',
    category: 'martial',
    attackType: 'melee',
    damage: '1d8',
    damageType: 'slashing',
    properties: ['versatile'],
    mastery: 'sap',
    bookId: 'XSRD'
  },
  {
    id: 'greatsword',
    name: 'Épée à deux mains',
    category: 'martial',
    attackType: 'melee',
    damage: '2d6',
    damageType: 'slashing',
    properties: ['heavy', 'two-handed'],
    mastery: 'graze',
    bookId: 'XSRD'
  },
  {
    id: 'greataxe',
    name: 'Hache à deux mains',
    category: 'martial',
    attackType: 'melee',
    damage: '1d12',
    damageType: 'slashing',
    properties: ['heavy', 'two-handed'],
    mastery: 'cleave',
    bookId: 'XSRD'
  },
  {
    id: 'longbow',
    name: 'Arc long',
    category: 'martial',
    attackType: 'ranged',
    damage: '1d8',
    damageType: 'piercing',
    properties: ['ammunition', 'heavy', 'two-handed'],
    mastery: 'slow',
    bookId: 'XSRD'
  },
  {
    id: 'warhammer',
    name: 'Marteau de guerre',
    category: 'martial',
    attackType: 'melee',
    damage: '1d8',
    damageType: 'bludgeoning',
    properties: ['versatile'],
    mastery: 'push',
    bookId: 'XSRD'
  }
];
