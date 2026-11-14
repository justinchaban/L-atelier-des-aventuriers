
import type { CharacterClass } from '../models/Class';

export const classes: CharacterClass[] = [
  {
    id: 'barbarian-2024',
    name: 'Barbare',
    description:
      'Un combattant féroce qui puise sa puissance dans sa rage.',
    bookId: 'srd-5.2.1',
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
    bookId: 'srd-5.2.1',
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
    bookId: 'srd-5.2.1',
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
    bookId: 'srd-5.2.1',
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
    bookId: 'srd-5.2.1',
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
    features: [],
    subclassLevel: 3,
    subclasses: []
  },
  {
    id: 'monk-2024',
    name: 'Moine',
    description:
      'Un combattant discipliné utilisant son énergie intérieure.',
    bookId: 'srd-5.2.1',
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
    bookId: 'srd-5.2.1',
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
    bookId: 'srd-5.2.1',
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
    bookId: 'srd-5.2.1',
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
    bookId: 'srd-5.2.1',
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
    bookId: 'srd-5.2.1',
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
    bookId: 'srd-5.2.1',
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
