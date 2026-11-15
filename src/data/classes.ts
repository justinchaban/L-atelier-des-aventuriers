
import type { CharacterClass } from '../models/Class';

export const classes: CharacterClass[] = [
  {
    id: 'barbarian-2024',
    name: 'Barbare',
    description:
      'Un combattant féroce qui puise sa puissance dans sa rage.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 12,
    primaryAbilities: ['str'],
    savingThrows: ['str', 'con'],
    proficiencies: [
      { type: 'armor', id: 'light' },
      { type: 'armor', id: 'medium' },
      { type: 'armor', id: 'shield' },
      { type: 'weapon', id: 'simple' },
      { type: 'weapon', id: 'martial' }
    ],
    skillChoices: {
      id: 'barbarian-skills',
      name: 'Compétences du Barbare',
      description: 'Choisissez deux compétences.',
      count: 2,
      options: [
        { id: 'animal-handling', name: 'Dressage' },
        { id: 'athletics', name: 'Athlétisme' },
        { id: 'intimidation', name: 'Intimidation' },
        { id: 'nature', name: 'Nature' },
        { id: 'perception', name: 'Perception' },
        { id: 'survival', name: 'Survie' }
      ]
    },
    features: [],
    subclassLevel: 3,
    subclasses: []
  },
  {
    id: 'bard-2024',
    name: 'Barde',
    description:
      'Un artiste et lanceur de sorts dont la magie inspire ses alliés.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 8,
    primaryAbilities: ['cha'],
    savingThrows: ['dex', 'cha'],
    proficiencies: [
      { type: 'armor', id: 'light' },
      { type: 'weapon', id: 'simple' }
    ],
    skillChoices: {
      id: 'bard-skills',
      name: 'Compétences du Barde',
      description: 'Choisissez trois compétences.',
      count: 3,
      options: [
        { id: 'acrobatics', name: 'Acrobaties' },
        { id: 'animal-handling', name: 'Dressage' },
        { id: 'arcana', name: 'Arcanes' },
        { id: 'athletics', name: 'Athlétisme' },
        { id: 'deception', name: 'Tromperie' },
        { id: 'history', name: 'Histoire' },
        { id: 'insight', name: 'Perspicacité' },
        { id: 'intimidation', name: 'Intimidation' },
        { id: 'investigation', name: 'Investigation' },
        { id: 'medicine', name: 'Médecine' },
        { id: 'nature', name: 'Nature' },
        { id: 'perception', name: 'Perception' },
        { id: 'performance', name: 'Représentation' },
        { id: 'persuasion', name: 'Persuasion' },
        { id: 'religion', name: 'Religion' },
        { id: 'sleight-of-hand', name: 'Escamotage' },
        { id: 'stealth', name: 'Discrétion' },
        { id: 'survival', name: 'Survie' }
      ]
    },
    features: [],
    subclassLevel: 3,
    subclasses: [],
    spellcasting: {
      ability: 'cha',
      type: 'full',
      preparation: 'prepared'
    }
  },
  {
    id: 'cleric-2024',
    name: 'Clerc',
    description:
      'Un serviteur des puissances divines qui manie la magie sacrée.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 8,
    primaryAbilities: ['wis'],
    savingThrows: ['wis', 'cha'],
    proficiencies: [
      { type: 'armor', id: 'light' },
      { type: 'armor', id: 'medium' },
      { type: 'armor', id: 'shield' },
      { type: 'weapon', id: 'simple' }
    ],
    features: [],
    subclassLevel: 3,
    subclasses: [],
    spellcasting: {
      ability: 'wis',
      type: 'full',
      preparation: 'prepared'
    }
  },
  {
    id: 'druid-2024',
    name: 'Druide',
    description:
      'Un protecteur de la nature maîtrisant les forces primordiales.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 8,
    primaryAbilities: ['wis'],
    savingThrows: ['int', 'wis'],
    proficiencies: [
      { type: 'armor', id: 'light' },
      { type: 'armor', id: 'medium' },
      { type: 'armor', id: 'shield' },
      { type: 'weapon', id: 'simple' }
    ],
    features: [],
    subclassLevel: 3,
    subclasses: [],
    spellcasting: {
      ability: 'wis',
      type: 'full',
      preparation: 'prepared'
    }
  },
  {
    id: 'fighter-2024',
    name: 'Guerrier',
    description:
      'Un maître des armes et des techniques de combat.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 10,
    primaryAbilities: ['str', 'dex'],
    savingThrows: ['str', 'con'],
    proficiencies: [
      { type: 'armor', id: 'light' },
      { type: 'armor', id: 'medium' },
      { type: 'armor', id: 'heavy' },
      { type: 'armor', id: 'shield' },
      { type: 'weapon', id: 'simple' },
      { type: 'weapon', id: 'martial' }
    ],

skillChoices: {
  id: 'fighter-skills',
  name: 'Compétences du Guerrier',
  description:
    'Choisissez deux compétences parmi celles proposées.',
  count: 2,
  options: [
    { id: 'acrobatics', name: 'Acrobaties' },
    { id: 'animal-handling', name: 'Dressage' },
    { id: 'athletics', name: 'Athlétisme' },
    { id: 'history', name: 'Histoire' },
    { id: 'insight', name: 'Perspicacité' },
    { id: 'intimidation', name: 'Intimidation' },
    { id: 'perception', name: 'Perception' },
    { id: 'survival', name: 'Survie' }
  ]
},

features: [
  {
    id: 'fighter-fighting-style',
    name: 'Style de combat',
    levelRequired: 1,
    description:
      'Vous obtenez un don de Style de combat parmi ceux auxquels vous êtes éligible.'
  },
  {
    id: 'fighter-second-wind',
    name: 'Second souffle',
    levelRequired: 1,
    description:
      'Vous disposez de réserves d’endurance permettant de récupérer des points de vie grâce à une action bonus.'
  },
  {
    id: 'fighter-weapon-mastery',
    name: 'Maîtrise des armes',
    levelRequired: 1,
    description:
      'Vous pouvez utiliser les propriétés de maîtrise des armes que vous avez choisies.'
  },
  {
    id: 'fighter-action-surge',
    name: 'Fougue',
    levelRequired: 2,
    description:
      'Vous pouvez effectuer une action supplémentaire pendant votre tour, à l’exception de l’action Magie.'
  },
  {
    id: 'fighter-tactical-mind',
    name: 'Sens tactique',
    levelRequired: 2,
    description:
      'Lorsque vous échouez à un test de caractéristique, vous pouvez dépenser une utilisation de Second souffle pour tenter de réussir grâce à un bonus de 1d10.'
  },
  {
    id: 'fighter-asi-4',
    name: 'Amélioration de caractéristique',
    levelRequired: 4,
    description:
      'Vous obtenez le don Amélioration de caractéristique ou un autre don auquel vous êtes éligible.'
  },
  {
    id: 'fighter-tactical-shift',
    name: 'Décalage tactique',
    levelRequired: 5,
    description:
      'Lorsque vous utilisez Second souffle, vous pouvez vous déplacer sans provoquer d’attaques d’opportunité.'
  },
  {
    id: 'fighter-extra-attack',
    name: 'Attaque supplémentaire',
    levelRequired: 5,
    description:
      'Vous pouvez attaquer deux fois au lieu d’une lorsque vous entreprenez l’action Attaquer.'
  },
  {
    id: 'fighter-asi-6',
    name: 'Amélioration de caractéristique',
    levelRequired: 6,
    description:
      'Vous obtenez un nouveau don auquel vous êtes éligible.'
  },
  {
    id: 'fighter-asi-8',
    name: 'Amélioration de caractéristique',
    levelRequired: 8,
    description:
      'Vous obtenez un nouveau don auquel vous êtes éligible.'
  },
  {
    id: 'fighter-indomitable',
    name: 'Inflexible',
    levelRequired: 9,
    description:
      'Si vous échouez à un jet de sauvegarde, vous pouvez le relancer avec un bonus égal à votre niveau de guerrier. Vous devez utiliser le nouveau jet et vous ne pouvez plus utiliser cette capacité avant d’avoir terminé un Repos long.'
  },
  {
    id: 'fighter-tactical-master',
    name: 'Botte tactique',
    levelRequired: 9,
    description:
      'Vous pouvez remplacer la propriété de maîtrise d’une attaque par Poussée, Sape ou Ralentissement lorsque les conditions sont remplies.'
  },
  {
    id: 'fighter-two-extra-attacks',
    name: 'Double attaque supplémentaire',
    levelRequired: 11,
    description:
      'Vous pouvez attaquer trois fois lorsque vous entreprenez l’action Attaquer.'
  },
  {
    id: 'fighter-asi-12',
    name: 'Amélioration de caractéristique',
    levelRequired: 12,
    description:
      'Vous obtenez un nouveau don auquel vous êtes éligible.'
  },
  {
    id: 'fighter-indomitable-13',
    name: 'Inflexible(2)',
    levelRequired: 13,
    description:
      'Vous disposez de deux utilisations d’Inflexible entre deux repos longs.'
  },
  {
    id: 'fighter-studied-attacks',
    name: 'Attaques avisées',
    levelRequired: 13,
    description:
      'Si vous ratez une attaque contre une créature, vous avez l’avantage à votre prochaine attaque contre elle avant la fin de votre prochain tour.'
  },
  {
    id: 'fighter-asi-14',
    name: 'Amélioration de caractéristique',
    levelRequired: 14,
    description:
      'Vous obtenez un nouveau don auquel vous êtes éligible.'
  },
  {
    id: 'fighter-asi-16',
    name: 'Amélioration de caractéristique',
    levelRequired: 16,
    description:
      'Vous obtenez un nouveau don auquel vous êtes éligible.'
  },
  {
    id: 'fighter-action-surge-17',
    name: 'Fougue(2)',
    levelRequired: 17,
    description:
      'Vous disposez de deux utilisations de Fougue entre deux repos.'
  },
  {
    id: 'fighter-indomitable-17',
    name: 'Inflexible(3)',
    levelRequired: 17,
    description:
      'Vous disposez de trois utilisations d’Inflexible entre deux repos longs.'
  },
  {
    id: 'fighter-epic-boon',
    name: 'Don épique',
    levelRequired: 19,
    description:
      'Vous obtenez un don épique ou un autre don auquel vous êtes éligible.'
  },
  {
    id: 'fighter-three-extra-attacks',
    name: 'Triple attaque supplémentaire',
    levelRequired: 20,
    description:
      'Vous pouvez attaquer quatre fois lorsque vous entreprenez l’action Attaquer.'
  }
],
    
    subclassLevel: 3,

    subclasses: [
      {
        id: 'champion-2024',
        name: 'Champion',
        description:
          'Un guerrier qui perfectionne ses aptitudes physiques et sa maîtrise du combat pour devenir un combattant d’exception.',

        bookId: 'XSRD',
        ruleset: '2024',

        features: [
          {
            id: 'champion-improved-critical',
            name: 'Critique amélioré',
            levelRequired: 3,
            description:
              'Vos attaques avec des armes et vos attaques à mains nues réalisent un coup critique sur un résultat de 19 ou 20 au d20.'
          },
          {
            id: 'champion-remarkable-athlete',
            name: 'Athlète remarquable',
            levelRequired: 3,
            description:
              'Vous bénéficiez de l’avantage aux tests d’initiative et d’Athlétisme. Après un coup critique, vous pouvez également vous déplacer sans provoquer d’attaques d’opportunité.'
          },
          {
            id: 'champion-additional-fighting-style',
            name: 'Style de combat supplémentaire',
            levelRequired: 7,
            description:
              'Vous obtenez un don de Style de combat supplémentaire auquel vous êtes éligible.'
          },
          {
            id: 'champion-heroic-warrior',
            name: 'Guerrier héroïque',
            levelRequired: 10,
            description:
              'Au début de votre tour en combat, si vous ne possédez pas d’Inspiration héroïque, vous en obtenez une.'
          },
          {
            id: 'champion-superior-critical',
            name: 'Critique supérieur',
            levelRequired: 15,
            description:
              'Vos attaques avec des armes et vos attaques à mains nues réalisent désormais un coup critique sur un résultat de 18, 19 ou 20 au d20.'
          },
          {
            id: 'champion-survivor',
            name: 'Survivant',
            levelRequired: 18,
            description:
              'Vous améliorez votre résistance aux blessures mortelles et récupérez des points de vie au début de vos tours lorsque vous êtes suffisamment blessé.'
          }
      
        ]
      },
      {
        id: 'battle-master-2024',
        name: 'Maître de bataille',
        description:
          'Un guerrier qui maîtrise des manœuvres tactiques pour prendre l’avantage au combat.',
        bookId: 'XSRD',
        ruleset: '2024',

        features: [
          {
            id: 'battle-master-combat-superiority',
            name: 'Supériorité au combat',
            levelRequired: 3,
            description:
              'Vous apprenez trois manœuvres et disposez de quatre dés de supériorité (d8), récupérés après un repos court ou long.',
            choices: [
              {
                id: 'battle-master-maneuvers',
                name: 'Manœuvres',
                description:
                  'Choisissez trois manœuvres de départ.',
                count: 3,
                options: [
                  {
                    id: 'precision-attack',
                    name: 'Attaque de précision',
                    description:
                      'Ajoutez un dé de supériorité à un jet d’attaque.'
                  },
                  {
                    id: 'trip-attack',
                    name: 'Attaque renversante',
                    description:
                      'Tentez de faire tomber votre cible à terre.'
                  },
                  {
                    id: 'pushing-attack',
                    name: 'Attaque repoussante',
                    description:
                      'Tentez de repousser votre cible.'
                  },
                  {
                    id: 'menacing-attack',
                    name: 'Attaque menaçante',
                    description:
                      'Tentez d’effrayer votre cible.'
                  },
                  {
                    id: 'disarming-attack',
                    name: 'Attaque désarmante',
                    description:
                      'Tentez de désarmer votre cible.'
                  },

                  {
                    id: 'commanders-strike',
                    name: 'Frappe du commandant',
                    description:
                      'Permet à un allié d’effectuer une attaque grâce à vos instructions.'
                  },
                  {
                    id: 'maneuvering-attack',
                    name: 'Attaque de manœuvre',
                    description:
                      'Permet à un allié de se repositionner sans provoquer certaines attaques d’opportunité.'
                  },
                  {
                    id: 'rally',
                    name: 'Ralliement',
                    description:
                      'Encourage un allié en lui accordant des points de vie temporaires.'
                  },
                  {
                    id: 'riposte',
                    name: 'Riposte',
                    description:
                      'Permet de contre-attaquer lorsqu’un adversaire vous manque.'
                  },
                  {
                    id: 'feinting-attack',
                    name: 'Attaque feintée',
                    description:
                      'Utilise une feinte pour améliorer votre prochaine attaque.'
                  },
                  {
                    id: 'goading-attack',
                    name: 'Attaque provocante',
                    description:
                      'Incite un adversaire à concentrer ses attaques sur vous.'
                  },
                  {
                    id: 'lunging-attack',
                    name: 'Attaque allongée',
                    description:
                      'Permet d’effectuer une attaque avec un déplacement offensif.'
                  },
                  {
                    id: 'parry',
                    name: 'Parade',
                    description:
                      'Réduit les dégâts subis lors d’une attaque au corps à corps.'
                  },
                  {
                    id: 'sweeping-attack',
                    name: 'Attaque balayante',
                    description:
                      'Permet de toucher une seconde créature proche de la cible.'
                  },
                  {
                    id: 'bait-and-switch',
                    name: 'Leurre et permutation',
                    description:
                      'Échangez votre position avec un allié et améliorez votre défense.'
                  },
                  {
                    id: 'ambush',
                    name: 'Embuscade',
                    description:
                      'Améliore certains tests de Discrétion ou d’initiative.'
                  },
                  {
                    id: 'tactical-assessment',
                    name: 'Évaluation tactique',
                    description:
                      'Améliore certains tests destinés à analyser une situation.'
                  },
                  {
                    id: 'grappling-strike',
                    name: 'Frappe agrippante',
                    description:
                      'Permet de tenter d’agripper une créature après l’avoir touchée.'
                  },
                  {
                    id: 'brace',
                    name: 'Réception',
                    description:
                      'Permet de réagir lorsqu’un adversaire entre à votre portée.'
                  }

                ]
              }
            ]
          },
          {
            id: 'battle-master-student-of-war',
            name: 'Élève de la guerre',
            levelRequired: 3,
            description:
              'Vous obtenez une maîtrise d’outil d’artisan.'
          },
          {
            id: 'battle-master-know-your-enemy',
            name: 'Connais ton ennemi',
            levelRequired: 7,
            description:
              'Vous pouvez étudier un adversaire pour obtenir des informations sur ses capacités.'
          },
          {
            id: 'battle-master-improved-superiority',
            name: 'Supériorité améliorée',
            levelRequired: 10,
            description:
              'Vos dés de supériorité deviennent des d10.'
          },
          {
            id: 'battle-master-relentless',
            name: 'Implacable',
            levelRequired: 15,
            description:
              'Vous pouvez utiliser certaines manœuvres même lorsque vos dés de supériorité sont épuisés.'
          },
          {
            id: 'battle-master-ultimate-superiority',
            name: 'Supériorité ultime',
            levelRequired: 18,
            description:
              'Vos dés de supériorité deviennent des d12.'
          }
        ]
      }

    ]

  },
  {
    id: 'monk-2024',
    name: 'Moine',
    description:
      'Un combattant discipliné utilisant son énergie intérieure.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 8,
    primaryAbilities: ['dex', 'wis'],
    savingThrows: ['str', 'dex'],
    proficiencies: [
      { type: 'weapon', id: 'simple' },
      { type: 'weapon', id: 'martial-light' }
    ],
    features: [],
    subclassLevel: 3,
    subclasses: []
  },
  {
    id: 'paladin-2024',
    name: 'Paladin',
    description:
      'Un champion animé par un serment et une puissance divine.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 10,
    primaryAbilities: ['str', 'cha'],
    savingThrows: ['wis', 'cha'],
    proficiencies: [
      { type: 'armor', id: 'light' },
      { type: 'armor', id: 'medium' },
      { type: 'armor', id: 'heavy' },
      { type: 'armor', id: 'shield' },
      { type: 'weapon', id: 'simple' },
      { type: 'weapon', id: 'martial' }
    ],
    features: [],
    subclassLevel: 3,
    subclasses: [],
    spellcasting: {
      ability: 'cha',
      type: 'half',
      preparation: 'prepared'
    }
  },
  {
    id: 'ranger-2024',
    name: 'Rôdeur',
    description:
      'Un explorateur et chasseur habitué aux terres sauvages.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 10,
    primaryAbilities: ['dex', 'wis'],
    savingThrows: ['str', 'dex'],
    proficiencies: [
      { type: 'armor', id: 'light' },
      { type: 'armor', id: 'medium' },
      { type: 'armor', id: 'shield' },
      { type: 'weapon', id: 'simple' },
      { type: 'weapon', id: 'martial' }
    ],
    features: [],
    subclassLevel: 3,
    subclasses: [],
    spellcasting: {
      ability: 'wis',
      type: 'half',
      preparation: 'prepared'
    }
  },
  {
    id: 'rogue-2024',
    name: 'Roublard',
    description:
      'Un expert de la discrétion, de la précision et des compétences.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 8,
    primaryAbilities: ['dex'],
    savingThrows: ['dex', 'int'],
    proficiencies: [
      { type: 'armor', id: 'light' },
      { type: 'weapon', id: 'simple' },
      { type: 'weapon', id: 'martial-finesse-light' }
    ],
    features: [],
    subclassLevel: 3,
    subclasses: []
  },
  {
    id: 'sorcerer-2024',
    name: 'Ensorceleur',
    description:
      'Un lanceur de sorts dont la magie provient de son essence.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 6,
    primaryAbilities: ['cha'],
    savingThrows: ['con', 'cha'],
    proficiencies: [
      { type: 'weapon', id: 'simple' }
    ],
    features: [],
    subclassLevel: 3,
    subclasses: [],
    spellcasting: {
      ability: 'cha',
      type: 'full',
      preparation: 'prepared'
    }
  },
  {
    id: 'warlock-2024',
    name: 'Occultiste',
    description:
      'Un pratiquant de la magie ayant conclu un pacte surnaturel.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 8,
    primaryAbilities: ['cha'],
    savingThrows: ['wis', 'cha'],
    proficiencies: [
      { type: 'armor', id: 'light' },
      { type: 'weapon', id: 'simple' }
    ],
    features: [],
    subclassLevel: 3,
    subclasses: [],
    spellcasting: {
      ability: 'cha',
      type: 'pact',
      preparation: 'prepared'
    }
  },
  {
    id: 'wizard-2024',
    name: 'Magicien',
    description:
      'Un érudit étudiant les secrets de la magie arcanique.',
    bookId: 'XSRD',
    ruleset: '2024',
    hitDie: 6,
    primaryAbilities: ['int'],
    savingThrows: ['int', 'wis'],
    proficiencies: [
      { type: 'weapon', id: 'simple' }
    ],
    features: [],
    subclassLevel: 3,
    subclasses: [],
    spellcasting: {
      ability: 'int',
      type: 'full',
      preparation: 'prepared'
    }
  }
];
