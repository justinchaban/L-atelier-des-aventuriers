
import type { ClassChoice } from '../models/Class';

export const fightingStyleChoice: ClassChoice = {
  id: 'fighter-fighting-style',
  name: 'Style de combat',
  description:
    'Choisissez un don de Style de combat pour votre Guerrier.',
  count: 1,
  options: [
    {
      id: 'archery',
      name: 'Archerie',
      description:
        'Vous gagnez +2 aux jets d’attaque effectués avec des armes à distance.'
    },
    {
      id: 'blind-fighting',
      name: 'Combat en aveugle',
      description:
        'Vous disposez d’une vision aveugle sur 3 mètres.'
    },
    {
      id: 'defense',
      name: 'Défense',
      description:
        'Vous gagnez +1 à la CA lorsque vous portez une armure.'
    },
    {
      id: 'dueling',
      name: 'Duel',
      description:
        'Vous gagnez +2 aux dégâts lorsque vous tenez une arme de corps à corps dans une main et aucune autre arme.'
    },
    {
      id: 'great-weapon-fighting',
      name: 'Combat à deux mains',
      description:
        'Les dés de dégâts de l’arme affichant 1 ou 2 comptent comme 3 pour une attaque avec une arme à deux mains.'
    },
    {
      id: 'interception',
      name: 'Interception',
      description:
        'Vous pouvez utiliser votre réaction pour réduire les dégâts subis par une créature proche, sous certaines conditions.'
    },
    {
      id: 'protection',
      name: 'Protection',
      description:
        'Avec un bouclier, vous pouvez utiliser votre réaction pour gêner une attaque visant un allié proche.'
    },
    {
      id: 'thrown-weapon-fighting',
      name: 'Combat avec armes de jet',
      description:
        'Vous pouvez dégainer une arme de jet pendant l’attaque et gagnez +2 aux dégâts de ses attaques à distance.'
    },
    {
      id: 'two-weapon-fighting',
      name: 'Combat à deux armes',
      description:
        'Vous pouvez ajouter votre modificateur de caractéristique aux dégâts de l’attaque supplémentaire liée aux armes légères.'
    },
    {
      id: 'unarmed-fighting',
      name: 'Combat à mains nues',
      description:
        'Vos frappes à mains nues infligent des dégâts améliorés et vous pouvez blesser une créature agrippée.'
    }
  ]
};
