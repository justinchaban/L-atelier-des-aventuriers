
import type { WeaponMastery } from '../models/Weapon';

interface WeaponMasteryInfo {
  id: WeaponMastery;
  name: string;
  description: string;
}

export const weaponMasteries: Record<
  WeaponMastery,
  WeaponMasteryInfo
> = {
  cleave: {
    id: 'cleave',
    name: 'Enchaînement (Cleave)',
    description:
      'Lorsque vous touchez une créature avec une attaque de corps à corps, vous pouvez effectuer une attaque contre une autre créature à proximité, sous certaines conditions.'
  },

  graze: {
    id: 'graze',
    name: 'Éraflure (Graze)',
    description:
      'Lorsque votre attaque manque sa cible, vous pouvez lui infliger des dégâts égaux au modificateur de caractéristique utilisé pour cette attaque.'
  },

  nick: {
    id: 'nick',
    name: 'Entaille (Nick)',
    description:
      'L’attaque supplémentaire accordée par la propriété Légère peut être effectuée pendant l’action Attaquer plutôt qu’avec une action bonus.'
  },

  push: {
    id: 'push',
    name: 'Poussée (Push)',
    description:
      'Lorsque vous touchez une créature, vous pouvez la repousser jusqu’à 3 mètres, si elle ne dépasse pas la taille Grande.'
  },

  sap: {
    id: 'sap',
    name: 'Affaiblissement (Sap)',
    description:
      'Lorsque vous touchez une créature, son prochain jet d’attaque effectué avant le début de votre prochain tour subit un désavantage.'
  },

  slow: {
    id: 'slow',
    name: 'Ralentissement (Slow)',
    description:
      'Lorsque vous touchez une créature, vous pouvez réduire sa vitesse de 3 mètres jusqu’au début de votre prochain tour.'
  },

  topple: {
    id: 'topple',
    name: 'Renversement (Topple)',
    description:
      'Lorsque vous touchez une créature, vous pouvez lui imposer un jet de sauvegarde de Constitution pour éviter de tomber à terre.'
  },

  vex: {
    id: 'vex',
    name: 'Harcèlement (Vex)',
    description:
      'Lorsque vous touchez une créature, vous obtenez un avantage à votre prochain jet d’attaque contre elle avant la fin de votre prochain tour.'
  }
};
