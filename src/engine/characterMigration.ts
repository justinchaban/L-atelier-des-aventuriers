import type { Character } from '../models/Character';
import type { CharacterV2 } from '../models/CharacterV2';
import { validateCharacterStructure, validateCharacterCompleteness } from './characterValidation';
import { captureNativeMechanics, validateFrozenMechanics } from './frozenMechanics';
import { freezeMechanical } from './nativeMechanicalBaseline';
import { serializeLibraryJson } from './libraryIdentity';
import type { MechanicalCategory, MechanicalSelection, FrozenMechanicsSnapshot } from '../models/FrozenMechanics';

export interface MigrationDiagnostic { code: string; path: string; severity: 'error' | 'warning'; message: string }
export interface CharacterMigrationReport {
  status: 'ready' | 'partial' | 'rejected';
  action: 'migrate' | 'unchanged' | 'none';
  /** Copie JSON indépendante ; référence originale uniquement si aucune copie sans perte n'est possible. */
  original: unknown;
  originalByReference: boolean;
  diagnostics: MigrationDiagnostic[];
  character?: CharacterV2;
}
export interface CharacterListMigrationReport {
  entries: (CharacterMigrationReport & { index: number })[];
  diagnostics: MigrationDiagnostic[];
  counts: { total: number; accepted: number; complete: number; partial: number; rejected: number; unchanged: number; duplicateEntries: number; duplicateGroups: number };
  canPreparePersistence: boolean;
  rejectedRoot?: { original: unknown; originalByReference: boolean };
}
export interface CharacterMigrationOptions {
  /** Injection pour tester les échecs ; tout résultat est revalidé avant acceptation. */
  capture?: (character: Character) => Promise<unknown>;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const diag = (code: string, path: string, message: string, severity: MigrationDiagnostic['severity'] = 'error'): MigrationDiagnostic => ({ code, path, message, severity });
const message = (e: unknown) => e instanceof Error ? e.message : 'Erreur de préparation inconnue.';

/** Refuse les nombres dont un aller-retour JSON modifierait la valeur entière ou le signe. */
function checkNumbers(value: unknown, path = '$'): void {
  if (typeof value === 'number' && (Object.is(value, -0) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) throw new Error(`${path} : nombre non conservable exactement dans ce contrat JSON.`);
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) checkNumbers(child, `${path}.${key}`);
}
export function copyMigrationJson<T>(value: T): T {
  const serialized = serializeLibraryJson(value); // contrôle des accesseurs et des cycles avant traversée
  checkNumbers(value);
  return JSON.parse(serialized);
}
function retain(value: unknown) {
  try { return { original: freezeMechanical(copyMigrationJson(value)), originalByReference: false, diagnostics: [] as MigrationDiagnostic[] }; }
  catch (e) { return { original: value, originalByReference: true, diagnostics: [diag('non-preservable-json', '$', message(e))] }; }
}
function reject(retained: ReturnType<typeof retain>, diagnostics: MigrationDiagnostic[]): CharacterMigrationReport {
  return { ...retained, status: 'rejected', action: 'none', diagnostics: [...retained.diagnostics, ...diagnostics] };
}
function choiceShape(choices: Character['choices']): MigrationDiagnostic[] {
  const issues: MigrationDiagnostic[] = [];
  for (const key of ['subclassId','backgroundOriginFeatId','classEquipmentOptionId','backgroundEquipmentOptionId']) {
    if (choices[key] !== undefined && typeof choices[key] !== 'string') issues.push(diag('invalid-choice-shape', `choices.${key}`, 'Une chaîne est attendue ; aucun choix n’a été transformé.'));
  }
  for (const key of ['fightingStyles','weaponMasteries']) if (choices[key] !== undefined && !Array.isArray(choices[key])) issues.push(diag('invalid-choice-shape', `choices.${key}`, 'Un tableau est attendu ; aucun choix n’a été transformé.'));
  return issues;
}
function selectionConsistency(character: CharacterV2, mechanics: FrozenMechanicsSnapshot): MigrationDiagnostic[] {
  const issues: MigrationDiagnostic[] = [];
  const nodes = new Map(mechanics.nodes.map(node => [node.snapshotId, node]));
  const check = (slot: MechanicalSelection | FrozenMechanicsSnapshot['selections']['class'], category: MechanicalCategory, id: string, path: string) => {
    const matches = !id ? slot?.state === 'unselected' : slot?.state === 'resolved' ?
      slot.category === category && nodes.get(slot.target)?.domainId === id : slot?.state === 'unresolved' && slot.category === category && slot.domainId === id;
    if (!matches) issues.push(diag('mechanics-selection-mismatch', path, 'La sélection figée ne correspond pas au champ métier ; aucune recapture implicite.'));
  };
  for (const category of ['class','species','background'] as const) check(mechanics.selections[category], category, character[`${category}Id`], `${category}Id`);
  const scalar = (key: string) => typeof character.choices[key] === 'string' ? character.choices[key] as string : '';
  check(mechanics.selections.subclass, 'subclass', scalar('subclassId'), 'choices.subclassId');
  const lists = [
    ['feats','feat', scalar('backgroundOriginFeatId') ? [scalar('backgroundOriginFeatId')] : []],
    ['fightingStyles','fightingStyle', character.choices.fightingStyles ?? []],
    ['weaponMasteries','weapon', character.choices.weaponMasteries ?? []],
    ['equipmentOptions','equipmentOption', [scalar('classEquipmentOptionId'), scalar('backgroundEquipmentOptionId')]]
  ] as const;
  for (const [field, category, ids] of lists) {
    const slots = mechanics.selections[field];
    if (!Array.isArray(ids) || ids.length !== slots.length) { issues.push(diag('mechanics-selection-mismatch', `mechanics.selections.${field}`, 'Nombre ou forme des sélections différent des choix conservés.')); continue; }
    ids.forEach((id, index) => check(slots[index], category, id, `mechanics.selections.${field}[${index}]`));
  }
  mechanics.selections.equipmentOptions.forEach((slot, index) => {
    if (slot.state !== 'resolved') return;
    const owner = index === 0 ? mechanics.selections.class : mechanics.selections.background;
    if (owner.state !== 'resolved' || nodes.get(slot.target)?.owner !== owner.target) issues.push(diag('mechanics-owner-mismatch', `mechanics.selections.equipmentOptions[${index}]`, 'Option d’équipement rattachée à un autre propriétaire.'));
  });
  return issues;
}

export async function validateCharacterV2(value: unknown): Promise<{ valid: boolean; diagnostics: MigrationDiagnostic[]; character?: CharacterV2 }> {
  let data: unknown;
  try { data = copyMigrationJson(value); }
  catch (e) { return { valid: false, diagnostics: [diag('non-preservable-json', '$', message(e))] }; }
  if (!record(data) || data.schemaVersion !== 2) return { valid: false, diagnostics: [diag('unsupported-character-version', 'schemaVersion', 'Personnage v2 attendu.')] };
  const { mechanics, ...core } = data;
  const diagnostics = validateCharacterStructure({ ...core, schemaVersion: 1 }).map(issue => diag('invalid-character', '$', issue));
  if (diagnostics.length) return { valid: false, diagnostics };
  diagnostics.push(...choiceShape(core.choices as Character['choices']));
  const validation = await validateFrozenMechanics(mechanics);
  diagnostics.push(...validation.issues.map(issue => diag(issue.code, `mechanics.${issue.path}`, issue.message)));
  if (validation.valid && validation.snapshot && !diagnostics.length) diagnostics.push(...selectionConsistency(data as unknown as CharacterV2, validation.snapshot));
  if (diagnostics.length || !validation.snapshot) return { valid: false, diagnostics };
  return { valid: true, diagnostics, character: freezeMechanical({ ...core, schemaVersion: 2, mechanics: validation.snapshot } as CharacterV2) };
}
async function prepareRetained(retained: ReturnType<typeof retain>, options: CharacterMigrationOptions): Promise<CharacterMigrationReport> {
  if (retained.diagnostics.length) return reject(retained, []);
  const data = retained.original;
  if (!record(data) || (data.schemaVersion !== 1 && data.schemaVersion !== 2)) return reject(retained, [diag('unsupported-character-version', 'schemaVersion', 'Version absente ou inconnue : données conservées, aucune substitution.')]);
  if (data.schemaVersion === 1 && Object.hasOwn(data, 'mechanics')) return reject(retained, [diag('reserved-field-collision', 'mechanics', 'Le champ mechanics existe déjà en v1 ; il ne sera pas écrasé.')]);
  let candidate: unknown = data;
  if (data.schemaVersion === 1) {
    const issues = validateCharacterStructure(data).map(issue => diag('invalid-character', '$', issue));
    if (issues.length) return reject(retained, issues);
    issues.push(...choiceShape(data.choices as Character['choices']));
    if (issues.length) return reject(retained, issues);
    try {
      const mechanics = await (options.capture ?? captureNativeMechanics)(copyMigrationJson(data) as unknown as Character);
      candidate = { ...copyMigrationJson(data), schemaVersion: 2, mechanics };
    } catch (e) { return reject(retained, [diag('capture-failed', 'mechanics', message(e))]); }
  }
  const validation = await validateCharacterV2(candidate);
  if (!validation.valid || !validation.character) return reject(retained, validation.diagnostics);
  const character = validation.character;
  const diagnostics = validateCharacterCompleteness({ ...character, schemaVersion: 1 } as Character).map(issue => diag('incomplete-draft', '$', issue, 'warning'));
  for (const [field, value] of Object.entries(character.mechanics.selections)) {
    const slots = Array.isArray(value) ? value : [value];
    slots.forEach((slot, index) => { if (slot.state === 'unresolved') diagnostics.push(diag('unresolved-mechanical-selection', `mechanics.selections.${field}${Array.isArray(value) ? `[${index}]` : ''}`, `${slot.domainId} : ${slot.reason}`, 'warning')); });
  }
  for (const node of character.mechanics.nodes) node.dependencies.forEach((edge, index) => {
    if (edge.state === 'unresolved') diagnostics.push(diag('unresolved-mechanical-dependency', `mechanics.nodes.${node.snapshotId}.dependencies[${index}]`, `${edge.domainId} : ${edge.reason}`, 'warning'));
  });
  if (character.mechanics.state === 'partial') diagnostics.push(diag('partial-mechanics', 'mechanics', 'Capture partielle conservée ; aucune mécanique manquante inventée.', 'warning'));
  return { ...retained, character, status: character.mechanics.state === 'partial' ? 'partial' : 'ready',
    action: data.schemaVersion === 2 ? 'unchanged' : 'migrate', diagnostics };
}
/** Aucune réparation v1 implicite : les absences structurelles restent des rejets récupérables. */
export async function prepareCharacterMigration(value: unknown, options: CharacterMigrationOptions = {}): Promise<CharacterMigrationReport> {
  return prepareRetained(retain(value), options);
}
export async function prepareCharacterListMigration(value: unknown, options: CharacterMigrationOptions = {}): Promise<CharacterListMigrationReport> {
  const counts = { total: 0, accepted: 0, complete: 0, partial: 0, rejected: 0, unchanged: 0, duplicateEntries: 0, duplicateGroups: 0 };
  if (!Array.isArray(value)) {
    const root = retain(value);
    return { entries: [], counts, diagnostics: [...root.diagnostics, diag('invalid-list', '$', 'Une liste de personnages est attendue.')], canPreparePersistence: false, rejectedRoot: { original: root.original, originalByReference: root.originalByReference } };
  }
  // Refuse les métadonnées de tableau qui disparaîtraient lors d'un export JSON,
  // ainsi que les accesseurs, sans jamais les invoquer pour parcourir les entrées.
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length || Object.keys(descriptors).length !== value.length + 1 ||
      Array.from({ length: value.length }, (_, index) => descriptors[String(index)]).some(item => !item || !item.enumerable || !('value' in item))) {
    const root = retain(value);
    return { entries: [], counts, diagnostics: [...root.diagnostics, diag('invalid-list-shape', '$', 'Liste JSON dense et sans propriétés supplémentaires ni accesseurs attendue ; racine conservée sans parcourir ses valeurs.')],
      canPreparePersistence: false, rejectedRoot: { original: root.original, originalByReference: root.originalByReference } };
  }
  // Isoler chaque entrée AVANT les await : une entrée non JSON ne bloque pas ses voisines.
  const retained = Array.from(value, retain);
  const groups = new Map<string, number[]>();
  retained.forEach((item, index) => { if (!item.originalByReference && record(item.original) && typeof item.original.id === 'string' && item.original.id.trim()) groups.set(item.original.id, [...groups.get(item.original.id) ?? [], index]); });
  const duplicates = new Set([...groups.values()].filter(group => group.length > 1).flat());
  counts.duplicateEntries = duplicates.size; counts.duplicateGroups = [...groups.values()].filter(group => group.length > 1).length;
  const entries: CharacterListMigrationReport['entries'] = [];
  for (const [index, item] of retained.entries()) {
    let report: CharacterMigrationReport;
    if (duplicates.has(index)) report = reject(item, [diag('duplicate-character-id', 'id', 'Identifiant dupliqué : toutes les occurrences sont conservées et rejetées, sans choisir de gagnant.')]);
    else try { report = await prepareRetained(item, options); }
    catch (e) { report = reject(item, [diag('preparation-failed', '$', message(e))]); }
    entries.push({ ...report, index });
    counts.total++;
    if (report.status === 'rejected') counts.rejected++;
    else { counts.accepted++; counts[report.status === 'ready' ? 'complete' : 'partial']++; if (report.action === 'unchanged') counts.unchanged++; }
  }
  return { entries, counts, diagnostics: [], canPreparePersistence: counts.rejected === 0 };
}
