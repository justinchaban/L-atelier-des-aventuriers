
import type {
  StartingEquipmentDefinition,
  StartingEquipmentOption
} from '../models/Equipment';

import { classes } from './classes';

// ==========================================
// ÉQUIPEMENTS DE DÉPART DES CLASSES
// ==========================================

const classStartingEquipment:
  StartingEquipmentDefinition[] = [
    {
      sourceId: 'fighter-2024',
      sourceType: 'class',

      options: [
        {
          id: 'fighter-equipment',
          name: 'Équipement de départ',

          description:
            "Recevez l'équipement de départ du Guerrier.",

          items: [
            {
              itemId: 'chain-mail',
              quantity: 1
            },
            {
              itemId: 'greatsword',
              quantity: 1
            },
            {
              itemId: 'flail',
              quantity: 1
            },
            {
              itemId: 'javelin',
              quantity: 8
            },
            {
              itemId: 'light-crossbow',
              quantity: 1
            },
            {
              itemId: 'crossbow-bolt',
              quantity: 20
            },
            {
              itemId: 'crossbow-bolt-case',
              quantity: 1
            },
            {
              itemId: 'explorers-pack',
              quantity: 1
            }
          ],

          gold: 4
        },

        {
          id: 'fighter-gold',
          name: 'Monnaie de départ',

          description:
            "Recevez 155 pièces d'or pour acheter votre équipement.",

          items: [],

          gold: 155
        }
      ]
    }
  ];

// ==========================================
// REGISTRE DES ÉQUIPEMENTS
// ==========================================

// Les classes non encore renseignées restent
// présentes dans le registre avec des options
// vides. Cela évite de proposer des équipements
// incorrects ou incomplets.

export const startingEquipment:
  StartingEquipmentDefinition[] = classes.map(
    characterClass => {
      const definition = classStartingEquipment.find(
        item =>
          item.sourceId === characterClass.id &&
          item.sourceType === 'class'
      );

      return definition ?? {
        sourceId: characterClass.id,
        sourceType: 'class',
        options: []
      };
    }
  );

// ==========================================
// FONCTIONS DE RECHERCHE
// ==========================================

export function getStartingEquipment(
  sourceId: string,
  sourceType: 'class' | 'background'
): StartingEquipmentDefinition | undefined {
  return startingEquipment.find(
    definition =>
      definition.sourceId === sourceId &&
      definition.sourceType === sourceType
  );
}

export function getStartingEquipmentOption(
  sourceId: string,
  sourceType: 'class' | 'background',
  optionId: string
): StartingEquipmentOption | undefined {
  const definition = getStartingEquipment(
    sourceId,
    sourceType
  );

  return definition?.options.find(
    option => option.id === optionId
  );
}
