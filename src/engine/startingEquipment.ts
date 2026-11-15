
import type {
  Character
} from '../models/Character';

import type {
  CharacterInventory,
  EquipmentStack,
  StartingEquipmentOption
} from '../models/Equipment';

import {
  getStartingEquipmentOption
} from '../data/startingEquipment';

// ==========================================
// FUSION DES OBJETS
// ==========================================

export function mergeEquipmentStacks(
  stacks: EquipmentStack[]
): EquipmentStack[] {
  const quantities = new Map<string, number>();

  for (const stack of stacks) {
    if (
      !stack.itemId ||
      !Number.isInteger(stack.quantity) ||
      stack.quantity <= 0
    ) {
      continue;
    }

    const previous =
      quantities.get(stack.itemId) ?? 0;

    quantities.set(
      stack.itemId,
      previous + stack.quantity
    );
  }

  return Array.from(
    quantities.entries()
  ).map(([itemId, quantity]) => ({
    itemId,
    quantity
  }));
}

// ==========================================
// CRÉATION D'UN INVENTAIRE
// ==========================================

export function createInventoryFromOptions(
  options: StartingEquipmentOption[]
): CharacterInventory {
  const allItems: EquipmentStack[] = [];

  let gold = 0;

  for (const option of options) {
    allItems.push(...option.items);

    if (
      typeof option.gold === 'number' &&
      Number.isFinite(option.gold) &&
      option.gold >= 0
    ) {
      gold += option.gold;
    }
  }

  return {
    items: mergeEquipmentStacks(allItems),
    gold
  };
}

// ==========================================
// INVENTAIRE INITIAL DU PERSONNAGE
// ==========================================

export function getCharacterStartingInventory(
  character: Character
): CharacterInventory {
  const selectedOptions: StartingEquipmentOption[] = [];

  const classOptionId =
    character.choices.classEquipmentOptionId;

  if (typeof classOptionId === 'string') {
    const classOption = getStartingEquipmentOption(
      character.classId,
      'class',
      classOptionId
    );

    if (classOption) {
      selectedOptions.push(classOption);
    }
  }

  const backgroundOptionId =
    character.choices.backgroundEquipmentOptionId;

  if (typeof backgroundOptionId === 'string') {
    const backgroundOption = getStartingEquipmentOption(
      character.backgroundId,
      'background',
      backgroundOptionId
    );

    if (backgroundOption) {
      selectedOptions.push(backgroundOption);
    }
  }

  return createInventoryFromOptions(selectedOptions);
}

// ==========================================
// INFORMATIONS COMPLÉMENTAIRES
// ==========================================

export function getInventoryItemQuantity(
  inventory: CharacterInventory,
  itemId: string
): number {
  return inventory.items.find(
    item => item.itemId === itemId
  )?.quantity ?? 0;
}

export function getInventoryTotalQuantity(
  inventory: CharacterInventory
): number {
  return inventory.items.reduce(
    (total, item) => total + item.quantity,
    0
  );
}
