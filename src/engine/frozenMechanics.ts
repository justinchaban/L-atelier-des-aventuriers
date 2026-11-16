import type { Character } from '../models/Character';
import type { FrozenMechanicsDocument, FrozenMechanicsSnapshot, MechanicalCategory, MechanicalNode, MechanicalSelection, MechanicalValidationReport } from '../models/FrozenMechanics';
import { validateCharacterStructure } from './characterValidation';
import { fingerprintLibraryJson, serializeLibraryJson } from './libraryIdentity';
import { nativeMechanicalBaseline as baseline, NATIVE_MECHANICAL_BASELINE_ID, NATIVE_MECHANICAL_BASELINE_HASH, NATIVE_MECHANICAL_ADAPTER,
  mechanicalId, mechanicalKey, freezeMechanical, verifyNativeMechanicalBaseline } from './nativeMechanicalBaseline';
import type { NativeMechanicalSeed } from './nativeMechanicalBaseline';

const copy = <T,>(value: T): T => JSON.parse(serializeLibraryJson(value));
const seeds = new Map(baseline.nodes.map(node => [node.snapshotId, node]));
async function materialize(seed: NativeMechanicalSeed): Promise<MechanicalNode> {
  const node = { ...copy(seed), source: { origin: 'native' as const, baselineId: NATIVE_MECHANICAL_BASELINE_ID,
    baselineHash: NATIVE_MECHANICAL_BASELINE_HASH, revisionHash: await fingerprintLibraryJson(seed), adapter: { ...NATIVE_MECHANICAL_ADAPTER } } };
  return { ...node, definitionHash: await fingerprintLibraryJson(node) } as MechanicalNode;
}
function expectedTables(nodes: readonly { snapshotId: string }[]) {
  const ids = new Set(nodes.map(node => node.snapshotId));
  return copy({ ...baseline.tables, progressions: baseline.tables.progressions.filter(row => ids.has(row.class)) });
}
const partial = (selections: FrozenMechanicsDocument['selections'], nodes: readonly MechanicalNode[]) => {
  const slots = Object.values(selections).flatMap(value => Array.isArray(value) ? value : [value]);
  return [selections.class, selections.species, selections.background].some(slot => slot.state === 'unselected') ||
    slots.some(slot => slot.state === 'unresolved') || nodes.some(node => node.dependencies.some(edge => edge.state === 'unresolved'));
};

/** Capture en mémoire uniquement. Ni migration, ni sélection importée, ni calcul du personnage. */
export async function captureNativeMechanics(character: Character): Promise<FrozenMechanicsSnapshot> {
  const errors = validateCharacterStructure(character);
  if (errors.length) throw new Error(`Capture refusée : ${errors.join(' ')}`);
  for (const key of ['subclassId', 'backgroundOriginFeatId', 'classEquipmentOptionId', 'backgroundEquipmentOptionId']) {
    if (character.choices[key] !== undefined && typeof character.choices[key] !== 'string') throw new Error(`Capture refusée : choices.${key} doit être une chaîne, donnée originale inchangée.`);
  }
  for (const key of ['fightingStyles', 'weaponMasteries']) {
    if (character.choices[key] !== undefined && !Array.isArray(character.choices[key])) throw new Error(`Capture refusée : choices.${key} doit être un tableau, donnée originale inchangée.`);
  }
  const input = copy(character); // avant tout await : choix et identité d'entrée stables
  await verifyNativeMechanicalBaseline();
  const slot = (category: MechanicalCategory, domainId: string, context?: string[]): MechanicalSelection => {
    if (!domainId) return { state: 'unselected' };
    const matches = baseline.nodes.filter(node => node.category === category && node.domainId === domainId && (!context || node.catalogKey === mechanicalKey(category, ...context)));
    return matches.length === 1 ? { state: 'resolved', category, target: matches[0].snapshotId } :
      { state: 'unresolved', category, domainId, reason: matches.length ? 'Identifiant natif ambigu.' : 'Identifiant natif inconnu dans ce contexte.' };
  };
  const choice = (key: string) => typeof input.choices[key] === 'string' ? input.choices[key] as string : '';
  const choices = (key: string) => Array.isArray(input.choices[key]) ? input.choices[key] as string[] : choice(key) ? [choice(key)] : [];
  const selections: FrozenMechanicsDocument['selections'] = {
    class: slot('class', input.classId), subclass: slot('subclass', choice('subclassId'), [input.classId, choice('subclassId')]),
    species: slot('species', input.speciesId), background: slot('background', input.backgroundId),
    feats: choices('backgroundOriginFeatId').map(id => slot('feat', id)),
    fightingStyles: choices('fightingStyles').map(id => slot('fightingStyle', id)),
    weaponMasteries: choices('weaponMasteries').map(id => slot('weapon', id)),
    equipmentOptions: [slot('equipmentOption', choice('classEquipmentOptionId'), ['class', input.classId, choice('classEquipmentOptionId')]),
      slot('equipmentOption', choice('backgroundEquipmentOptionId'), ['background', input.backgroundId, choice('backgroundEquipmentOptionId')])]
  };
  const included = new Map<string, NativeMechanicalSeed>();
  const visit = (id: string) => {
    if (included.has(id)) return;
    const seed = seeds.get(id as MechanicalNode['snapshotId']);
    if (!seed) throw new Error(`Dépendance native introuvable : ${id}`);
    included.set(id, seed);
    if (seed.owner) visit(seed.owner);
    for (const edge of seed.dependencies) if (edge.state === 'resolved') visit(edge.target);
  };
  for (const value of Object.values(selections).flatMap(value => Array.isArray(value) ? value : [value])) if (value.state === 'resolved') visit(value.target);
  const nodes = await Promise.all([...included.values()].sort((a,b) => a.snapshotId < b.snapshotId ? -1 : a.snapshotId > b.snapshotId ? 1 : 0).map(materialize));
  const document = { formatVersion: 1 as const, baseline: { id: NATIVE_MECHANICAL_BASELINE_ID, hash: NATIVE_MECHANICAL_BASELINE_HASH },
    state: partial(selections, nodes) ? 'partial' as const : 'complete' as const, selections, nodes, tables: expectedTables(nodes) };
  return freezeMechanical({ ...document, bundleHash: await fingerprintLibraryJson(document) });
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function fields(value: unknown, keys: string[], path: string) {
  if (!record(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) throw new Error(`${path} : champs invalides.`);
}
/** Validation autonome de forme/empreinte ET correspondance avec le référentiel approuvé. */
export async function validateFrozenMechanics(value: unknown): Promise<MechanicalValidationReport> {
  const issues: MechanicalValidationReport['issues'] = [];
  let data: FrozenMechanicsDocument;
  try { data = copy(value) as FrozenMechanicsDocument; }
  catch (error) { return { valid: false, compatible: false, issues: [{ code: 'non-json', path: '$', message: error instanceof Error ? error.message : 'JSON strict attendu.' }] }; }
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  try {
    fields(data, ['formatVersion','baseline','state','selections','nodes','tables','bundleHash'], '$');
    if (data.formatVersion !== 1) add('format-version', 'formatVersion', 'Format mécanique non pris en charge.');
    await verifyNativeMechanicalBaseline();
    if (serializeLibraryJson(data.baseline) !== serializeLibraryJson({ id: NATIVE_MECHANICAL_BASELINE_ID, hash: NATIVE_MECHANICAL_BASELINE_HASH })) add('baseline-version', 'baseline', 'Référentiel non pris en charge.');
    if (!['complete','partial'].includes(data.state)) add('state', 'state', 'État inconnu.');
    if (!Array.isArray(data.nodes)) throw new Error('nodes : tableau attendu.');
    fields(data.selections, ['class','subclass','species','background','feats','fightingStyles','weaponMasteries','equipmentOptions'], 'selections');
    const ids = new Map<string, MechanicalNode>();
    for (const [index, node] of data.nodes.entries()) {
      const path = `nodes[${index}]`;
      fields(node, ['snapshotId','category','domainId','catalogKey','source','dependencies','definition','definitionHash', ...(Object.hasOwn(node ?? {}, 'owner') ? ['owner'] : [])], path);
      if (ids.has(node.snapshotId)) add('duplicate-node', path, 'Identifiant local dupliqué ou ambigu.');
      ids.set(node.snapshotId, node);
      if (!Array.isArray(node.dependencies)) throw new Error(`${path}.dependencies : tableau attendu.`);
      const { definitionHash, ...body } = node;
      if (await fingerprintLibraryJson(body) !== definitionHash) add('node-hash', path, 'Empreinte du nœud incorrecte.');
      const seed = seeds.get(node.snapshotId);
      if (!record(node.source) || node.source.origin !== 'native') add('unsupported-origin', path, 'Seul le référentiel natif approuvé est compatible avec cet évaluateur ; aucun import certifié.');
      if (!seed) add('unknown-node', path, 'Identité locale ou catégorie absente du référentiel approuvé.');
      else {
        const expected = await materialize(seed);
        // Vérifie aussi propriétaire, champs mécaniques, niveaux, choix, provenance, versions et liens.
        if (serializeLibraryJson(node) !== serializeLibraryJson(expected)) add('native-definition-mismatch', path, 'La définition, les références ou les versions diffèrent du référentiel approuvé, même si les empreintes ont été recalculées.');
      }
    }
    for (const [index, node] of data.nodes.entries()) {
      if (node.owner && !ids.has(node.owner)) add('missing-owner', `nodes[${index}].owner`, 'Propriétaire local absent.');
      for (const [i, edge] of node.dependencies.entries()) {
        if (edge.state === 'resolved') {
          const target = ids.get(edge.target);
          if (!target || target.category !== edge.category) add('missing-dependency', `nodes[${index}].dependencies[${i}]`, 'Dépendance locale absente ou de catégorie incorrecte.');
        } else if (edge.state !== 'unresolved') add('invalid-dependency', `nodes[${index}].dependencies[${i}]`, 'État de référence invalide.');
      }
    }
    const checkSlot = (slot: MechanicalSelection, category: MechanicalCategory, path: string) => {
      if (!record(slot)) throw new Error(`${path} : sélection attendue.`);
      if (slot.state === 'unselected') { fields(slot, ['state'], path); return; }
      if (slot.state === 'unresolved') {
        fields(slot, ['state','category','domainId','reason'], path);
        if (slot.category !== category || typeof slot.domainId !== 'string' || !slot.domainId.trim() || typeof slot.reason !== 'string' || !slot.reason.trim()) add('invalid-selection', path, 'Sélection non résolue illisible.');
        return;
      }
      fields(slot, ['state','category','target'], path);
      const target = ids.get(slot.target);
      if (slot.state !== 'resolved' || slot.category !== category || target?.category !== category) add('invalid-selection', path, 'Sélection locale absente ou de catégorie incorrecte.');
    };
    for (const category of ['class','subclass','species','background'] as const) checkSlot(data.selections[category], category, `selections.${category}`);
    for (const [field, category] of [['feats','feat'],['fightingStyles','fightingStyle'],['weaponMasteries','weapon'],['equipmentOptions','equipmentOption']] as const) {
      if (!Array.isArray(data.selections[field])) throw new Error(`selections.${field} : tableau attendu.`);
      data.selections[field].forEach((slot, index) => checkSlot(slot, category, `selections.${field}[${index}]`));
    }
    const cls = data.selections.class, sub = data.selections.subclass;
    if (sub.state === 'resolved' && (cls.state !== 'resolved' || ids.get(sub.target)?.owner !== cls.target)) add('wrong-owner', 'selections.subclass', 'La sous-classe ne dépend pas de la classe sélectionnée.');
    if (serializeLibraryJson(data.tables) !== serializeLibraryJson(expectedTables(data.nodes))) add('rule-tables', 'tables', 'Évaluateur, niveaux 1 à 20, limites ou tables non conformes au référentiel approuvé.');
    if (data.state !== (partial(data.selections, data.nodes) ? 'partial' : 'complete')) add('state-mismatch', 'state', 'État complet/partiel incohérent.');
    const { bundleHash, ...body } = data;
    if (await fingerprintLibraryJson(body) !== bundleHash) add('bundle-hash', 'bundleHash', 'Empreinte globale incorrecte.');
  } catch (error) { add('invalid-structure', '$', error instanceof Error ? error.message : 'Document illisible.'); }
  const valid = issues.length === 0;
  return { valid, compatible: valid && data!.state === 'complete', issues, ...(valid ? { snapshot: freezeMechanical(data!) } : {}) };
}

export function measureFrozenMechanics(snapshot: FrozenMechanicsSnapshot) {
  const serialized = serializeLibraryJson(snapshot);
  return { codeUnits: serialized.length, utf8Bytes: new TextEncoder().encode(serialized).length, utf16BytesEstimate: serialized.length * 2 };
}
