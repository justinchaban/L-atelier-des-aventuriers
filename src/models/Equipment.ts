
export type EquipmentCategory =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'tool'
  | 'adventuring-gear'
  | 'focus'
  | 'pack'
  | 'other';

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  description?: string;
  weight?: number;
  costGP?: number;
  bookId: string;
}

export interface EquipmentStack {
  itemId: string;
  quantity: number;
}

export interface StartingEquipmentOption {
  id: string;
  name: string;
  description?: string;

  items: EquipmentStack[];

  gold?: number;
}

export interface StartingEquipmentDefinition {
  sourceId: string;

  sourceType: 'class' | 'background';

  options: StartingEquipmentOption[];
}

export interface CharacterEquipmentChoices {
  classOptionId: string;
  backgroundOptionId: string;
}

export interface CharacterInventory {
  items: EquipmentStack[];

  gold: number;
}
