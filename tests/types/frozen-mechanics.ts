import type { FrozenMechanicsSnapshot, MechanicalNode, MechanicalDefinitionMap } from '../../src/models/FrozenMechanics';

declare const snapshot: FrozenMechanicsSnapshot;
declare const feature: Extract<MechanicalNode, { category: 'classFeature' }>;
// @ts-expect-error Immutabilité profonde des définitions.
snapshot.nodes[0].definition.name = 'mutation';
// @ts-expect-error Immutabilité profonde des tables de progression.
snapshot.tables.progressions[0].levels.push({});
// @ts-expect-error Une capacité ne constitue pas une définition de classe.
const wrong: Extract<MechanicalNode, { category: 'class' }> = { ...feature, category: 'class' };
// @ts-expect-error Aucun contenu descriptif brut dans les mécaniques.
const raw: MechanicalDefinitionMap['classFeature'] = { ...feature.definition, structuredEntries: [] };
// @ts-expect-error Le document mécanique ne stocke pas de métadonnées dans choices.
snapshot.choices = {};
void wrong;
void raw;
