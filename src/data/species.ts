
import type { Species } from '../models/Species';

export const species: Species[] = [
  {
    id: 'human-2024',
    name: 'Humain',
    bookId: 'srd-5.2.1',
    ruleset: '2024',
    description: 'Une espèce polyvalente et adaptable.',
    speed: 30,
    sizes: ['Small', 'Medium'],
    traits: []
  },
  {
    id: 'elf-2024',
    name: 'Elfe',
    bookId: 'srd-5.2.1',
    ruleset: '2024',
    description: 'Un peuple lié à la magie et aux traditions anciennes.',
    speed: 30,
    sizes: ['Medium'],
    traits: [
      {
        id: 'elf-darkvision',
        name: 'Vision dans le noir',
        description: 'Tu peux voir dans les ténèbres jusqu’à 60 pieds.',
        effects: [
          {
            type: 'darkvision',
            range: 60
          }
        ]
      },
      {
        id: 'elf-fey-ancestry',
        name: 'Ascendance féerique',
        description: 'Tu as l’avantage aux jets de sauvegarde pour éviter ou mettre fin à l’état Charmé.'
      },
      {
        id: 'elf-keen-senses',
        name: 'Sens aiguisés',
        description: 'Tu maîtrises la compétence Intuition, Perception ou Survie, au choix.'
      },
      {
        id: 'elf-trance',
        name: 'Transe',
        description: 'Tu accomplis ton repos long en quatre heures de méditation.'
      }
    ]
  },
  {
    id: 'dwarf-2024',
    name: 'Nain',
    bookId: 'srd-5.2.1',
    ruleset: '2024',
    description: 'Un peuple résistant, réputé pour son endurance.',
    speed: 30,
    sizes: ['Medium'],
    traits: [
      {
        id: 'dwarf-darkvision',
        name: 'Vision dans le noir',
        description: 'Tu peux voir dans les ténèbres jusqu’à 120 pieds.',
        effects: [
          {
            type: 'darkvision',
            range: 120
          }
        ]
      },
      {
        id: 'dwarf-resilience',
        name: 'Résilience naine',
        description: 'Tu as la résistance aux dégâts de poison et l’avantage aux jets de sauvegarde pour éviter ou mettre fin à l’état Empoisonné.',
        effects: [
          {
            type: 'resistance',
            damageType: 'poison'
          }
        ]
      },
      {
        id: 'dwarf-toughness',
        name: 'Robustesse naine',
        description: 'Ton maximum de points de vie augmente de 1, puis de 1 supplémentaire à chaque niveau gagné.'
      },
      {
        id: 'dwarf-stonecunning',
        name: 'Connaissance de la pierre',
        description: 'Tu peux temporairement obtenir la perception des vibrations, selon les conditions et limites du trait.'
      }
    ]
  }
];
