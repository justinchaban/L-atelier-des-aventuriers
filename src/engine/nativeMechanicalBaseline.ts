import { classes } from '../data/classes';
import { species } from '../data/species';
import { backgrounds } from '../data/backgrounds';
import { feats } from '../data/feats';
import { equipment } from '../data/equipment';
import { weapons } from '../data/weapons';
import { startingEquipment } from '../data/startingEquipment';
import { fightingStyleChoice } from '../data/fightingStyles';
import { weaponMasteries } from '../data/weaponMasteries';
import { proficiencyBonus, abilityModifier } from './calculations';
import { STANDARD_ARRAY, POINT_BUY_BUDGET, POINT_BUY_COSTS } from './abilityGeneration';
import { getFightingStyleCount } from './fightingStyles';
import { getWeaponMasteryCount } from './weaponMastery';
import { getBattleMasterProgression } from './battleMaster';
import { serializeLibraryJson, fingerprintLibraryJson } from './libraryIdentity';
import type { CreatorCatalogKey } from '../models/CreatorCatalog';
import type { LibraryFingerprint } from '../models/Library';
import type { MechanicalCategory, MechanicalDefinitionMap, MechanicalDependency, MechanicalSnapshotId, MechanicalTables } from '../models/FrozenMechanics';

export const NATIVE_MECHANICAL_BASELINE_ID = 'atelier-native-migration-v1';
// Empreinte de revue : toute modification des données OU des tables exige une nouvelle version.
export const NATIVE_MECHANICAL_BASELINE_HASH: LibraryFingerprint = 'sha256:v1:87de71fd93ca7b07efe820a36a0b4147c70dc3cd98aac64d0b8bfaea726b0f00';
export const NATIVE_MECHANICAL_ADAPTER = { id: 'native-mechanical-capture', version: '1' } as const;
export const MECHANICAL_EVALUATOR = { id: 'atelier-native-tables', version: '1' } as const;
export const mechanicalKey = (category: MechanicalCategory, ...context: string[]) => `native:v1:${JSON.stringify([category, ...context])}` as CreatorCatalogKey;
export const mechanicalId = (catalogKey: string) => `mechanics:v1:${JSON.stringify(catalogKey)}` as MechanicalSnapshotId;
export function freezeMechanical<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeMechanical(child);
    Object.freeze(value);
  }
  return value;
}
export interface NativeMechanicalSeed {
  snapshotId: MechanicalSnapshotId;
  catalogKey: CreatorCatalogKey;
  category: MechanicalCategory;
  domainId: string;
  owner?: MechanicalSnapshotId;
  definition: MechanicalDefinitionMap[MechanicalCategory];
  dependencies: MechanicalDependency[];
}
function buildBaseline() {
  const nodes: NativeMechanicalSeed[] = [];
  function add<K extends MechanicalCategory>(category: K, definition: MechanicalDefinitionMap[K], context: string[], owner?: MechanicalSnapshotId) {
    const catalogKey = mechanicalKey(category, ...context);
    if (nodes.some(node => node.catalogKey === catalogKey)) throw new Error(`Identité native ambiguë : ${catalogKey}`);
    const node: NativeMechanicalSeed = { snapshotId: mechanicalId(catalogKey), catalogKey, category, domainId: definition.id, definition, dependencies: [], ...(owner ? { owner } : {}) };
    nodes.push(node); return node;
  }
  // Refuse les champs bruts plutôt que les éliminer silencieusement du référentiel.
  for (const cls of classes) {
    const { features, subclasses, ...data } = cls;
    const clsId = mechanicalId(mechanicalKey('class', cls.id));
    const featureIds = features.map(feature => add('classFeature', feature, [cls.id, feature.id], clsId).snapshotId);
    const subclassIds = subclasses.map(sub => {
      const subId = mechanicalId(mechanicalKey('subclass', cls.id, sub.id));
      const { features: subFeatures, ...subData } = sub;
      const ids = subFeatures.map(feature => add('subclassFeature', feature, [cls.id, sub.id, feature.id], subId).snapshotId);
      return add('subclass', { ...subData, features: ids }, [cls.id, sub.id], clsId).snapshotId;
    });
    add('class', { ...data, features: featureIds, subclasses: subclassIds }, [cls.id]);
  }
  for (const value of species) add('species', value, [value.id]);
  for (const value of backgrounds) add('background', value, [value.id]);
  for (const value of feats) add('feat', value, [value.id]);
  for (const value of equipment) add('equipment', value, [value.id]);
  for (const value of weapons) add('weapon', value, [value.id]);
  for (const value of fightingStyleChoice.options) add('fightingStyle', value, [value.id]);
  for (const definition of startingEquipment) {
    const category = definition.sourceType === 'class' ? 'class' : 'background';
    for (const option of definition.options) add('equipmentOption', option, [definition.sourceType, definition.sourceId, option.id], mechanicalId(mechanicalKey(category, definition.sourceId)));
  }
  function link(node: NativeMechanicalSeed, category: MechanicalCategory, domainId: string, path: string, target?: MechanicalSnapshotId) {
    const matches = nodes.filter(item => item.category === category && (target ? item.snapshotId === target : item.domainId === domainId));
    node.dependencies.push(matches.length === 1 ? { state: 'resolved', category, path, target: matches[0].snapshotId } :
      { state: 'unresolved', category, path, domainId, reason: matches.length ? 'Référence native ambiguë.' : 'Référence native absente.' });
  }
  for (const node of nodes) {
    if (node.category === 'class') {
      const data = node.definition as MechanicalDefinitionMap['class'];
      data.features.forEach((id, i) => link(node, 'classFeature', '', `features[${i}]`, id));
      data.subclasses.forEach((id, i) => link(node, 'subclass', '', `subclasses[${i}]`, id));
      if (node.domainId === 'fighter-2024') for (const dependency of nodes.filter(item => ['weapon', 'fightingStyle'].includes(item.category))) link(node, dependency.category, dependency.domainId, `${dependency.category}:${dependency.domainId}`);
    }
    if (node.category === 'subclass') (node.definition as MechanicalDefinitionMap['subclass']).features.forEach((id, i) => link(node, 'subclassFeature', '', `features[${i}]`, id));
    if (node.category === 'class' || node.category === 'background') {
      for (const option of nodes.filter(item => item.category === 'equipmentOption' && item.owner === node.snapshotId)) link(node, 'equipmentOption', option.domainId, `equipmentOptions:${option.domainId}`, option.snapshotId);
    }
    if (node.category === 'background') link(node, 'feat', (node.definition as MechanicalDefinitionMap['background']).originFeatId, 'originFeatId');
    if (node.category === 'feat') for (const [i, id] of ((node.definition as MechanicalDefinitionMap['feat']).prerequisites?.requiredFeatIds ?? []).entries()) link(node, 'feat', id, `prerequisites.requiredFeatIds[${i}]`);
    if (node.category === 'equipmentOption') for (const [i, stack] of (node.definition as MechanicalDefinitionMap['equipmentOption']).items.entries()) {
      link(node, 'equipment', stack.itemId, `items[${i}].itemId`);
      if (weapons.some(item => item.id === stack.itemId)) link(node, 'weapon', stack.itemId, `items[${i}].weapon`);
    }
  }
  const tables: MechanicalTables = {
    abilityGeneration: { standardArray: STANDARD_ARRAY, pointBuyBudget: POINT_BUY_BUDGET, pointBuyCosts: POINT_BUY_COSTS, dice: { count: 4, sides: 6, keep: 3, sets: 6 } },
    backgroundBonuses: { split: [2, 1], distinct: true, allThree: [1, 1, 1], requiredOptions: 3 },
    abilityModifiers: Array.from({ length: 33 }, (_, score) => ({ score, modifier: abilityModifier(score) })),
    evaluator: MECHANICAL_EVALUATOR, progressions: [], weaponMasteries };
  for (const cls of classes) for (const sub of [null, ...cls.subclasses]) {
    tables.progressions.push({ class: mechanicalId(mechanicalKey('class', cls.id)), subclass: sub ? mechanicalId(mechanicalKey('subclass', cls.id, sub.id)) : null,
      levels: Array.from({ length: 20 }, (_, index) => {
        const level = index + 1;
        const choiceLimits: Record<string, number> = {};
        for (const [source, features] of [['class', cls.features], ['subclass', sub?.features ?? []]] as const) {
          for (const feature of features) for (const choice of feature.choices ?? []) {
            if (feature.levelRequired > level || (source === 'subclass' && cls.subclassLevel > level)) continue;
            choiceLimits[`feature:${source}:${feature.id}:${choice.id}`] = sub?.id === 'battle-master-2024' && feature.id === 'battle-master-combat-superiority' && choice.id === 'battle-master-maneuvers'
              ? getBattleMasterProgression(level).maneuversKnown : choice.count;
          }
        }
        return { level, proficiencyBonus: proficiencyBonus(level), fightingStyles: getFightingStyleCount(cls.id, sub?.id ?? '', level),
          weaponMasteries: getWeaponMasteryCount(cls.id, level), battleMaster: sub?.id === 'battle-master-2024' ? getBattleMasterProgression(level) : null, choiceLimits };
      }) });
  }
  const value = JSON.parse(serializeLibraryJson({ id: NATIVE_MECHANICAL_BASELINE_ID, nodes, tables }));
  // Aucun contenu descriptif structuré, métadonnée brute ou exécutable autorisé.
  const rejectRaw = (item: unknown): void => {
    if (Array.isArray(item)) { item.forEach(rejectRaw); return; }
    if (item && typeof item === 'object') for (const [field, child] of Object.entries(item)) {
      if (['structuredEntries', 'importMetadata', '_copy', '_mod'].includes(field)) throw new Error(`Champ natif non mécanique : ${field}`);
      rejectRaw(child);
    }
  };
  rejectRaw(value);
  return freezeMechanical(value) as { id: string; nodes: NativeMechanicalSeed[]; tables: MechanicalTables };
}
// Copie profonde : ne gèle jamais les tables natives utilisées par P2.2/P2.4.
export const nativeMechanicalBaseline = buildBaseline();
export async function verifyNativeMechanicalBaseline(): Promise<void> {
  if (await fingerprintLibraryJson(nativeMechanicalBaseline) !== NATIVE_MECHANICAL_BASELINE_HASH) throw new Error('Référentiel natif modifié sans nouvelle version de capture.');
}
