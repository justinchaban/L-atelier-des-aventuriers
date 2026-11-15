
import type {
  Character
} from '../../models/Character';

import {
  getEquipmentById
} from '../../data/equipment';

import {
  getCharacterStartingInventory,
  getInventoryTotalQuantity
} from '../../engine/startingEquipment';

interface Props {
  character: Character;
}

const categoryLabels: Record<string, string> = {
  weapon: 'Armes',
  armor: 'Armures',
  shield: 'Boucliers',
  tool: 'Outils',
  'adventuring-gear': "Matériel d'aventurier",
  focus: 'Focaliseurs',
  pack: 'Paquetages',
  other: 'Autres'
};

const categoryOrder = [
  'weapon',
  'armor',
  'shield',
  'tool',
  'focus',
  'adventuring-gear',
  'pack',
  'other'
];

export default function CharacterInventoryPreview({
  character
}: Props) {
  const inventory =
    getCharacterStartingInventory(character);

  const totalQuantity =
    getInventoryTotalQuantity(inventory);

  const hasItems = inventory.items.length > 0;

  const hasGold = inventory.gold > 0;

  const groupedItems = categoryOrder.map(category => ({
    category,
    items: inventory.items.filter(stack => {
      const equipment = getEquipmentById(
        stack.itemId
      );

      return (
        (equipment?.category ?? 'other') === category
      );
    })
  })).filter(group => group.items.length > 0);

  return (
    <section className="character-inventory-preview">
      <h3>Inventaire de départ</h3>

      <p className="muted">
        Cet inventaire est calculé automatiquement
        à partir des équipements sélectionnés
        pour votre personnage.
      </p>

      {!hasItems && !hasGold && (
        <p className="muted">
          Aucun équipement de départ sélectionné.
        </p>
      )}

      {hasItems && (
        <>
          <p>
            <strong>
              {totalQuantity}
            </strong>
            {' '}
            objet{totalQuantity > 1 ? 's' : ''}
            {' '}dans votre inventaire.
          </p>

          {groupedItems.map(group => (
            <div
              key={group.category}
              className="inventory-category"
            >
              <h4>
                {categoryLabels[group.category]}
              </h4>

              <ul>
                {group.items.map(stack => {
                  const equipment = getEquipmentById(
                    stack.itemId
                  );

                  return (
                    <li key={stack.itemId}>
                      <span>
                        {equipment?.name ?? stack.itemId}
                      </span>

                      <strong>
                        {' × '}{stack.quantity}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </>
      )}

      {(hasItems || hasGold) && (
        <div className="inventory-gold">
          <h4>Monnaie</h4>

          <p>
            <strong>
              {inventory.gold} PO
            </strong>
          </p>
        </div>
      )}
    </section>
  );
}
