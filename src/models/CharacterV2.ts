import type { Character } from './Character';
import type { FrozenMechanicsSnapshot } from './FrozenMechanics';

/** Contrat préparatoire uniquement : Character v1 reste le modèle actif. */
export type CharacterV2 = Omit<Character, 'schemaVersion'> & {
  schemaVersion: 2;
  mechanics: FrozenMechanicsSnapshot;
};
