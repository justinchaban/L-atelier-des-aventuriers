
export type WeaponCategory = 'simple' | 'martial';

export type WeaponAttackType = 'melee' | 'ranged';

export type WeaponMastery =
  | 'cleave'
  | 'graze'
  | 'nick'
  | 'push'
  | 'sap'
  | 'slow'
  | 'topple'
  | 'vex';

export interface Weapon {
  id: string;
  name: string;
  category: WeaponCategory;
  attackType: WeaponAttackType;
  damage: string;
  damageType: string;
  properties: string[];
  mastery: WeaponMastery;
  bookId: string;
}
