
import type { Background } from '../models/Background';

export const backgrounds: Background[] = [
  {
    id: 'soldier-2024',
    name: 'Soldat',
    description:
      'Vous avez été formé au combat et à la discipline militaire.',
    bookId: 'XSRD',
    ruleset: '2024',
    abilityOptions: ['str', 'dex', 'con'],
    skillProficiencies: [
      'athletics',
      'intimidation'
    ],
    toolProficiency: 'gaming-set',
    originFeatId: 'savage-attacker-2024'
  },
  {
    id: 'criminal-2024',
    name: 'Criminel',
    description:
      'Vous avez vécu en marge de la loi et développé des talents de discrétion.',
    bookId: 'XSRD',
    ruleset: '2024',
    abilityOptions: ['dex', 'con', 'int'],
    skillProficiencies: [
      'sleight-of-hand',
      'stealth'
    ],
    toolProficiency: 'thieves-tools',
    originFeatId: 'alert-2024'
  }
];
