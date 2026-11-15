
import type { Feat } from '../models/Feat';

export const feats: Feat[] = [
  {
    id: 'alert-2024',
    name: 'Alerte',
    description:
      "Améliore l'initiative et permet d'échanger son initiative avec celle d'un allié consentant.",
    category: 'origin',
    bookId: 'XSRD',
    ruleset: '2024'
  },
  {
    id: 'lucky-2024',
    name: 'Chanceux',
    description:
      'Accorde des points de chance permettant d’influencer certains jets.',
    category: 'origin',
    bookId: 'XSRD',
    ruleset: '2024'
  },
  {
    id: 'tough-2024',
    name: 'Robuste',
    description:
      'Augmente les points de vie maximum du personnage.',
    category: 'origin',
    bookId: 'XSRD',
    ruleset: '2024'
  },
  {
    id: 'athlete-2024',
    name: 'Athlète',
    description:
      'Améliore certaines capacités physiques et la mobilité.',
    category: 'general',
    bookId: 'XSRD',
    ruleset: '2024',
    prerequisites: {
      minimumLevel: 4
    },
    abilityIncrease: {
      abilities: ['str', 'dex'],
      amount: 1,
      maximum: 20
    }
  },
  {
    id: 'savage-attacker-2024',
    name: 'Attaquant sauvage',
    description:
      'Permet d’améliorer les dégâts infligés avec une arme.',
    category: 'origin',
    bookId: 'XSRD',
    ruleset: '2024'
  }
];
