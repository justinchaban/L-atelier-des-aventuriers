'use strict';
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { prepareCharacterMigration: prepare, prepareCharacterListMigration: prepareList, validateCharacterV2 } = require('../src/engine/characterMigration.ts');
const { prepareStoredCharacterMigration: planFor, simulateCharacterMigration: simulate, validatePreparedCharacterStoreV2: validateStore,
  PROPOSED_CHARACTER_V1_KEY: V1, PROPOSED_CHARACTER_V2_KEY: V2 } = require('../src/engine/characterMigrationSimulation.ts');
const { captureNativeMechanics } = require('../src/engine/frozenMechanics.ts');
const { serializeLibraryJson: canonical, fingerprintLibraryJson: hash } = require('../src/engine/libraryIdentity.ts');
const { classes } = require('../src/data/classes.ts');
const { species } = require('../src/data/species.ts');
const { backgrounds } = require('../src/data/backgrounds.ts');
const fixture = (patch = {}) => ({ schemaVersion: 1, id: 'personnage-fictif', name: 'Gardienne fictive', level: 20,
  classId: 'fighter-2024', speciesId: species[0].id, backgroundId: backgrounds[0].id,
  abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  choices: { subclassId: 'battle-master-2024', classEquipmentOptionId: 'fighter-equipment', weaponMasteries: ['dagger','club'],
    fightingStyles: ['archery'], backgroundOriginFeatId: backgrounds[0].originFeatId,
    'feature:subclass:battle-master-combat-superiority:battle-master-maneuvers': ['precision-attack','inconnu-conservé'],
    'custom:fictif': ['alpha','alpha','beta'], abilityGenerationMethod: 'manual' },
  gameState: { currentHP: 2, temporaryHP: 7, usedHitDice: 3, usedSpellSlots: { 1: 2 }, conditions: ['fictive'] },
  campaignId: 'campagne-fictive', inventory: { items: [{ itemId: 'objet-personnel-fictif', quantity: 3 }], gold: 7 },
  extension: { unknown: [1, null, false, 'conserver'], nested: { value: 'préservé' } }, ...patch });
const draft = (patch = {}) => fixture({ level: 1, classId: '', speciesId: '', backgroundId: '',
  abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, choices: { 'custom:unknown': 'conserver' }, ...patch });
const clone = value => JSON.parse(JSON.stringify(value));
const codes = result => result.diagnostics.map(d => d.code);
async function rehashMechanics(value) {
  for (const node of value.nodes) { const { definitionHash, ...body } = node; node.definitionHash = await hash(body); }
  const { bundleHash, ...body } = value; value.bundleHash = await hash(body);
}

test('migration préparée : natif complet, tous champs métier et propriétés additionnelles préservés', async () => {
  const input = fixture(), before = canonical(input), result = await prepare(input);
  assert.equal(result.status, 'ready'); assert.equal(result.action, 'migrate');
  const { mechanics, schemaVersion, ...core } = result.character;
  const { schemaVersion: old, ...originalCore } = input;
  assert.equal(schemaVersion, 2); assert.deepEqual(core, originalCore); assert.equal(mechanics.state, 'complete');
  assert.deepEqual(result.original, input); assert.equal(result.originalByReference, false); assert.equal(canonical(input), before);
  assert.equal((await validateCharacterV2(result.character)).valid, true);
});

test('migration préparée : brouillon, scores zéro, sélections absentes et choix personnalisés', async () => {
  const input = draft(), result = await prepare(input);
  assert.equal(result.status, 'partial'); assert.equal(result.character.mechanics.selections.class.state, 'unselected');
  assert.deepEqual(result.character.abilities, input.abilities); assert.deepEqual(result.character.choices, input.choices);
  assert.ok(codes(result).includes('incomplete-draft')); assert.ok(codes(result).includes('partial-mechanics'));
  assert.equal((await validateCharacterV2(result.character)).valid, true);
});

test('migration préparée : identifiants inconnus représentés sans substitution', async () => {
  const result = await prepare(draft({ classId: 'classe-fictive-inconnue', choices: { subclassId: 'voie-inconnue', classEquipmentOptionId: 'option-inconnue' } }));
  assert.equal(result.status, 'partial'); assert.equal(result.character.classId, 'classe-fictive-inconnue');
  assert.equal(result.character.mechanics.selections.class.domainId, 'classe-fictive-inconnue');
  assert.equal(result.character.mechanics.selections.subclass.state, 'unresolved');
  assert.equal(result.character.mechanics.selections.equipmentOptions[0].state, 'unresolved');
  assert.ok(result.diagnostics.some(d => d.code === 'unresolved-mechanical-selection' && d.path === 'mechanics.selections.class' && d.message.includes('classe-fictive-inconnue')));
});

test('migration préparée : déterminisme et idempotence v2 sans recapture', async () => {
  const a = await prepare(fixture()), b = await prepare(fixture());
  assert.equal(canonical(a), canonical(b));
  const again = await prepare(a.character, { capture() { throw Error('Recapture interdite'); } });
  assert.equal(again.action, 'unchanged'); assert.equal(canonical(again.character), canonical(a.character));
  const partial = await prepare(draft());
  const againPartial = await prepare(partial.character);
  assert.equal(againPartial.status, 'partial'); assert.equal(againPartial.action, 'unchanged');
  assert.equal(canonical(againPartial.character), canonical(partial.character));
});

test('migration préparée : versions futures, champs manquants et collision mechanics bloqués sans réparation', async () => {
  const missing = fixture(); delete missing.choices;
  for (const value of [fixture({ schemaVersion: 99 }), fixture({ mechanics: { personal: 'conserver' } }), missing, null]) {
    const result = await prepare(value); assert.equal(result.status, 'rejected'); assert.equal(result.character, undefined); assert.deepEqual(result.original, value);
  }
  assert.ok(codes(await prepare(fixture({ mechanics: null }))).includes('reserved-field-collision'));
});

test('migration préparée : choix malformés, captures invalides et erreurs conservées comme rejets', async () => {
  const input = fixture({ choices: { subclassId: ['ambigu-fictif'] } });
  assert.ok(codes(await prepare(input)).includes('invalid-choice-shape'));
  const failed = await prepare(fixture(), { capture: async () => { throw Error('Capture fictivement indisponible'); } });
  assert.equal(failed.status, 'rejected'); assert.match(failed.diagnostics[0].message, /fictivement indisponible/);
  const snapshot = clone(await captureNativeMechanics(fixture()));
  snapshot.nodes.find(n => n.category === 'class').definition.hitDie = 100; await rehashMechanics(snapshot);
  const invalid = await prepare(fixture(), { capture: async () => snapshot });
  assert.equal(invalid.status, 'rejected'); assert.ok(codes(invalid).includes('native-definition-mismatch'));
});

test('migration préparée : v2 avec sélection incohérente ou mécanique corrompue refusé', async () => {
  const original = (await prepare(fixture())).character;
  const mismatch = clone(original); mismatch.classId = classes[0].id;
  assert.ok(codes(await prepare(mismatch)).includes('mechanics-selection-mismatch'));
  const broken = clone(original); broken.mechanics.bundleHash = 'sha256:v1:' + '0'.repeat(64);
  assert.ok(codes(await prepare(broken)).includes('bundle-hash'));
  const custom = clone(original); custom.choices['custom:fictif'].push('nouveau');
  assert.equal((await prepare(custom)).action, 'unchanged');
});

test('migration de liste : entrées mixtes, compteurs, rejets conservés et doublons sans gagnant', async () => {
  const values = [fixture({ id: 'ok' }), draft({ id: 'draft' }), fixture({ id: 'duplicate' }), fixture({ id: 'duplicate', name: 'Autre fictif' }),
    fixture({ id: 'future', schemaVersion: 42 }), { id: 'broken' }];
  const result = await prepareList(values);
  assert.deepEqual(result.counts, { total: 6, accepted: 2, complete: 1, partial: 1, rejected: 4, unchanged: 0, duplicateEntries: 2, duplicateGroups: 1 });
  assert.equal(result.canPreparePersistence, false);
  result.entries.forEach((entry, index) => { assert.equal(entry.index, index); assert.deepEqual(entry.original, values[index]); });
  assert.ok(codes(result.entries[2]).includes('duplicate-character-id')); assert.ok(codes(result.entries[3]).includes('duplicate-character-id'));
});

test('migration de liste : entrées détachées avant les await et originaux non mutés', async () => {
  const a = fixture({ id: 'a' }), b = draft({ id: 'b' }), beforeA = canonical(a), beforeB = canonical(b);
  const promise = prepareList([a,b]); b.name = 'changé après appel';
  const result = await promise;
  assert.equal(canonical(a), beforeA); assert.equal(canonical(result.entries[1].original), beforeB);
  assert.notEqual(result.entries[0].original, a);
  assert.throws(() => { result.entries[0].character.choices['custom:fictif'].push('mutation'); }, TypeError);
});

test('migration préparée : données non JSON non copiables conservées explicitement par référence', async () => {
  const input = fixture({ extra: () => 'fictif' });
  const result = await prepare(input);
  assert.equal(result.status, 'rejected'); assert.equal(result.original, input); assert.equal(result.originalByReference, true);
  const list = await prepareList([input, fixture({ id: 'valid' })]);
  assert.equal(list.counts.accepted, 1); assert.equal(list.counts.rejected, 1); assert.equal(list.canPreparePersistence, false);
  for (const extra of [-0, Number.MAX_SAFE_INTEGER + 1]) assert.equal((await prepare(fixture({ extra }))).status, 'rejected');
  const root = await prepareList({ bad: 'racine-fictive' });
  assert.equal(root.canPreparePersistence, false); assert.deepEqual(root.rejectedRoot.original, { bad: 'racine-fictive' });
});

test('plan préparatoire : chaîne v1 exacte, JSON invalide conservé et aucune disparition sur rejet', async () => {
  const raw = '\n  ' + JSON.stringify([fixture()], null, 2) + '\n';
  const plan = await planFor(raw);
  assert.equal(plan.status, 'prepared'); assert.equal(plan.originalData, raw);
  assert.equal(JSON.parse(plan.recoveryData).originalData, raw); assert.equal(await validateStore(plan.targetData), true);
  assert.equal(canonical(await planFor(raw)), canonical(plan));
  for (const source of ['{invalide', JSON.stringify([fixture(), { schemaVersion: 99, id: 'rejeté' }])]) {
    const rejected = await planFor(source); assert.equal(rejected.status, 'blocked'); assert.equal(rejected.targetData, undefined);
    assert.equal(rejected.originalData, source); assert.equal(JSON.parse(rejected.recoveryData).originalData, source);
  }
  assert.equal((await planFor(null)).report.counts.total, 0); assert.equal((await planFor('[]')).status, 'prepared');
});

test('simulation pure : sauvegarde vérifiée, source intacte, reprise idempotente', async () => {
  const raw = JSON.stringify([fixture()]), plan = await planFor(raw), initial = { [V1]: raw, autre: 'conserver' };
  const before = canonical(initial), result = await simulate(plan, initial);
  assert.equal(result.status, 'committed'); assert.equal(result.state[V1], raw); assert.equal(result.state.autre, 'conserver');
  assert.equal(result.state[plan.recoveryKey], plan.recoveryData); assert.equal(result.state[V2], plan.targetData);
  assert.deepEqual(result.trace, ['verify-source','write-recovery','verify-recovery','verify-conflicts','write-target','verify-target']);
  assert.equal(canonical(initial), before);
  assert.equal((await simulate(plan, result.state)).status, 'already-committed');
});

test('simulation pure : quotas aux deux écritures, sans effacement automatique des brouillons', async () => {
  const raw = JSON.stringify([fixture()]), plan = await planFor(raw), initial = { [V1]: raw };
  const failBackup = await simulate(plan, initial, { quotaCodeUnits: 0 });
  assert.equal(failBackup.status, 'quota'); assert.deepEqual(failBackup.state, initial);
  const withBackup = { ...initial, [plan.recoveryKey]: plan.recoveryData };
  const quota = Object.entries(withBackup).reduce((n,[k,v]) => n+k.length+v.length,0);
  const failTarget = await simulate(plan, initial, { quotaCodeUnits: quota });
  assert.equal(failTarget.status, 'quota'); assert.equal(failTarget.state[V2], undefined);
  assert.equal(failTarget.state[V1], raw); assert.equal(failTarget.state[plan.recoveryKey], plan.recoveryData);
});

test('simulation pure : interruption à chaque frontière et reprise vérifiée', async () => {
  const raw = JSON.stringify([draft()]), plan = await planFor(raw);
  for (let boundary = 0; boundary <= 6; boundary++) {
    const result = await simulate(plan, { [V1]: raw }, { interruptAfter: boundary });
    assert.equal(result.status, 'interrupted'); assert.equal(result.state[V1], raw);
    if (boundary < 5) assert.equal(result.state[V2], undefined);
    const resumed = await simulate(plan, result.state);
    assert.ok(['committed','already-committed'].includes(resumed.status));
    assert.equal(await validateStore(resumed.state[V2]), true);
  }
});

test('simulation pure : conflits de source, cible et récupération empêchent les écrasements', async () => {
  const raw = JSON.stringify([draft()]), plan = await planFor(raw);
  assert.equal((await simulate(plan, { [V1]: 'source concurrente' })).status, 'conflict');
  assert.equal((await simulate(plan, { [V1]: raw, [plan.recoveryKey]: 'copie différente' })).status, 'conflict');
  for (const key of [V1, V2, plan.recoveryKey]) {
    const result = await simulate(plan, { [V1]: raw }, { concurrentBeforeTarget: { key, value: 'autre contenu concurrent' } });
    assert.equal(result.status, 'conflict'); assert.equal(result.state[key], 'autre contenu concurrent');
    if (key !== V2) assert.equal(result.state[V2], undefined);
  }
});

test('simulation pure : v2 corrompu et échec de relecture ne déclenchent aucun retour arrière silencieux', async () => {
  const raw = JSON.stringify([draft()]), plan = await planFor(raw);
  const corrupt = await simulate(plan, { [V1]: raw, [V2]: '{cassé' });
  assert.equal(corrupt.status, 'corrupt-v2'); assert.equal(corrupt.state[V2], '{cassé');
  const backup = await simulate(plan, { [V1]: raw }, { failVerification: 'recovery' });
  assert.equal(backup.status, 'verification-failed'); assert.equal(backup.state[V2], undefined);
  const target = await simulate(plan, { [V1]: raw }, { failVerification: 'target' });
  assert.equal(target.status, 'verification-failed'); assert.equal(target.state[V2], plan.targetData); assert.equal(target.state[V1], raw);
});

test('simulation pure : plan falsifié ne peut supprimer des personnages ni détourner la récupération', async () => {
  const raw = JSON.stringify([fixture()]), plan = await planFor(raw);
  const forged = clone(plan), target = JSON.parse(forged.targetData); target.characters = [];
  const { envelopeHash, ...body } = target; target.envelopeHash = await hash(body); forged.targetData = canonical(target);
  assert.equal((await simulate(forged, { [V1]: raw })).status, 'blocked');
  forged.targetData = plan.targetData; forged.recoveryKey = 'clé-fictive-détournée';
  assert.equal((await simulate(forged, { [V1]: raw })).status, 'blocked');
});

test('préparation et simulation : aucun accès localStorage/IndexedDB, y compris erreurs', async () => {
  for (const key of ['indexedDB','localStorage']) Object.defineProperty(global, key, { configurable: true, get() { throw Error(`${key} interdit`); } });
  try {
    const raw = JSON.stringify([draft()]), plan = await planFor(raw);
    assert.equal((await simulate(plan, { [V1]: raw })).status, 'committed');
    assert.equal((await planFor('{invalide')).status, 'blocked');
    assert.equal((await prepare(fixture())).status, 'ready');
  } finally { delete global.indexedDB; delete global.localStorage; }
});

test('préparation : tailles exactes de v1, v2, récupération et estimation cumulée', async t => {
  for (const [name, value] of [['brouillon',draft()],['simple',fixture({ classId: classes[0].id, level: 1, choices: {} })],['riche',fixture()]]) {
    const raw = JSON.stringify([value]), plan = await planFor(raw);
    assert.equal(plan.sizes.sourceCodeUnits, raw.length); assert.equal(plan.sizes.targetCodeUnits, plan.targetData.length);
    assert.equal(plan.sizes.recoveryCodeUnits, plan.recoveryData.length);
    const expected = 2 * (raw.length + plan.targetData.length + plan.recoveryData.length + V1.length + V2.length + plan.recoveryKey.length);
    assert.equal(plan.sizes.estimatedUtf16Bytes, expected);
    t.diagnostic(JSON.stringify({ scenario: name, ...plan.sizes, targetUtf8Bytes: Buffer.byteLength(plan.targetData, 'utf8') }));
  }
});

test('préparation : listes v2 déjà migrées, racines illisibles et absence de modification du modèle actif', async () => {
  const prepared = await prepare(fixture());
  const report = await prepareList([prepared.character]);
  assert.equal(report.counts.unchanged, 1); assert.equal(report.counts.complete, 1); assert.equal(report.canPreparePersistence, true);
  const root = await planFor('{"racine":"fictive"}');
  assert.equal(root.status, 'blocked'); assert.deepEqual(root.report.rejectedRoot.original, { racine: 'fictive' });
  const { validateCharacterStructure } = require('../src/engine/characterValidation.ts');
  assert.ok(validateCharacterStructure(prepared.character).some(message => message.includes('schemaVersion')));
});

test('préparation : contrat TypeScript v2 séparé du modèle actif', () => {
  const path = require('node:path');
  const config = ts.readConfigFile(path.join(__dirname, '../tsconfig.app.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.join(__dirname, '..'));
  const program = ts.createProgram([path.join(__dirname, 'types/character-v2.ts')], { ...parsed.options, incremental: false });
  assert.deepEqual(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});

test('préparation : volume d’une liste de dix brouillons riches sans troncature', async t => {
  const input = Array.from({ length: 10 }, (_, index) => fixture({ id: `personnage-fictif-${index}` }));
  const plan = await planFor(JSON.stringify(input));
  assert.equal(plan.status, 'prepared'); assert.equal(plan.report.counts.accepted, 10);
  assert.equal(JSON.parse(plan.targetData).characters.length, 10);
  t.diagnostic(JSON.stringify({ scenario: 'dix-riches', ...plan.sizes, targetUtf8Bytes: Buffer.byteLength(plan.targetData, 'utf8') }));
});

test('préparation : propriétés de liste et accesseurs jamais perdus ni exécutés', async () => {
  const extended = [fixture()]; extended.personal = { fictif: 'conserver' };
  const result = await prepareList(extended);
  assert.equal(result.canPreparePersistence, false); assert.equal(result.rejectedRoot.original, extended);
  assert.ok(result.diagnostics.some(d => d.code === 'invalid-list-shape'));
  let called = false;
  const accessor = [];
  Object.defineProperty(accessor, '0', { enumerable: true, configurable: true, get() { called = true; return fixture(); } });
  const rejected = await prepareList(accessor);
  assert.equal(rejected.canPreparePersistence, false); assert.equal(called, false); assert.equal(rejected.rejectedRoot.original, accessor);
});
