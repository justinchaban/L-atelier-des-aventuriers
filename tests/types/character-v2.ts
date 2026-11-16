import type { Character } from '../../src/models/Character';
import type { CharacterV2 } from '../../src/models/CharacterV2';
declare const legacy: Character;
declare const next: CharacterV2;
// @ts-expect-error Le modèle actif reste v1 ; aucun remplacement implicite.
const active: Character = next;
// @ts-expect-error Une v2 requiert sa capture mécanique.
const missing: CharacterV2 = { ...legacy, schemaVersion: 2 };
// @ts-expect-error Immutabilité profonde des mécaniques préparées.
next.mechanics.nodes[0].definition.name = 'mutation';
void active;
void missing;
