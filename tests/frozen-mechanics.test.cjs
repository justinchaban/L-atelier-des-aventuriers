'use strict';
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { captureNativeMechanics: capture, validateFrozenMechanics: validate, measureFrozenMechanics: measure } = require('../src/engine/frozenMechanics.ts');
const { nativeMechanicalBaseline: baseline, NATIVE_MECHANICAL_BASELINE_HASH: baselineHash, verifyNativeMechanicalBaseline, freezeMechanical } = require('../src/engine/nativeMechanicalBaseline.ts');
const { fingerprintLibraryJson: hash, serializeLibraryJson: canonical } = require('../src/engine/libraryIdentity.ts');
const { classes } = require('../src/data/classes.ts');
const { species } = require('../src/data/species.ts');
const { backgrounds } = require('../src/data/backgrounds.ts');
const { feats } = require('../src/data/feats.ts');
const { equipment } = require('../src/data/equipment.ts');
const { weapons } = require('../src/data/weapons.ts');
const { startingEquipment } = require('../src/data/startingEquipment.ts');
const { getUnlockedClassFeatures } = require('../src/engine/classProgression.ts');
const { getFightingStyleCount } = require('../src/engine/fightingStyles.ts');
const { getWeaponMasteryCount } = require('../src/engine/weaponMastery.ts');
const { getBattleMasterProgression } = require('../src/engine/battleMaster.ts');
const draft = (patch = {}) => ({ schemaVersion: 1, id: 'personnage-fictif', name: 'Gardienne fictive', level: 1,
  classId: classes[0].id, speciesId: species[0].id, backgroundId: backgrounds[0].id,
  abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, choices: { 'custom:fictif': ['conserver','strictement'] },
  gameState: { currentHP: 1, temporaryHP: 0, usedHitDice: 0, usedSpellSlots: {}, conditions: [] }, ...patch });
const rich = () => draft({ classId: 'fighter-2024', level: 20, choices: { subclassId: 'battle-master-2024',
  classEquipmentOptionId: 'fighter-equipment', fightingStyles: ['archery','defense'], weaponMasteries: ['dagger','club','longsword'],
  backgroundOriginFeatId: backgrounds[0].originFeatId, 'custom:fictif': 'inconnu-préservé',
  'feature:subclass:battle-master-combat-superiority:battle-master-maneuvers': ['precision-attack'] } });
const clone = value => JSON.parse(JSON.stringify(value));
async function rehash(value) {
  for (const node of value.nodes) { const { definitionHash, ...body } = node; node.definitionHash = await hash(body); }
  const { bundleHash, ...body } = value; value.bundleHash = await hash(body); return value;
}
const codes = report => report.issues.map(issue => issue.code);

test('capture mécanique : déterminisme, référentiel versionné et reproductibilité', async () => {
  const first = await capture(rich()), second = await capture(rich());
  assert.equal(canonical(first), canonical(second));
  assert.equal(await hash(baseline), baselineHash); await verifyNativeMechanicalBaseline();
  assert.deepEqual(first.baseline, { id: 'atelier-native-migration-v1', hash: baselineHash });
  const report = await validate(clone(first)); assert.equal(report.valid, true); assert.equal(report.compatible, true);
  assert.equal(canonical(report.snapshot), canonical(first));
});

test('capture mécanique : identifiants locaux contextuels et catégories equipment/weapon distinctes', async () => {
  const snapshot = await capture(rich());
  assert.equal(new Set(snapshot.nodes.map(n => n.snapshotId)).size, snapshot.nodes.length);
  const sameBusiness = snapshot.nodes.filter(n => n.domainId === 'greatsword');
  assert.ok(sameBusiness.some(n => n.category === 'weapon')); assert.ok(sameBusiness.some(n => n.category === 'equipment'));
  assert.equal(new Set(sameBusiness.map(n => n.snapshotId)).size, sameBusiness.length);
  assert.ok(snapshot.nodes.every(n => n.snapshotId !== n.catalogKey && n.domainId !== n.snapshotId));
});

test('capture mécanique : fermeture des dépendances, équipements, dons, propriétaires et sous-classes', async () => {
  const snapshot = await capture(rich()), ids = new Set(snapshot.nodes.map(n => n.snapshotId));
  for (const node of snapshot.nodes) {
    if (node.owner) assert.ok(ids.has(node.owner));
    for (const edge of node.dependencies) { assert.equal(edge.state, 'resolved'); assert.ok(ids.has(edge.target)); }
  }
  const fighter = classes.find(c => c.id === 'fighter-2024');
  const cls = snapshot.nodes.find(n => n.category === 'class');
  assert.equal(cls.definition.subclasses.length, fighter.subclasses.length);
  assert.ok(snapshot.nodes.some(n => n.category === 'feat' && n.domainId === backgrounds[0].originFeatId));
  assert.ok(snapshot.nodes.some(n => n.category === 'equipmentOption' && n.domainId === 'fighter-gold'));
});

test('capture mécanique : tables natives aux niveaux 1 à 20 et options intégralement conservées', async () => {
  for (const cls of classes) {
    const snapshot = await capture(draft({ classId: cls.id }));
    for (const row of snapshot.tables.progressions) {
      const sub = cls.subclasses.find(s => snapshot.nodes.find(n => n.snapshotId === row.subclass)?.domainId === s.id);
      assert.deepEqual(row.levels.map(v => v.level), Array.from({ length: 20 }, (_, i) => i + 1));
      for (const level of row.levels) {
        assert.equal(level.fightingStyles, getFightingStyleCount(cls.id, sub?.id ?? '', level.level));
        assert.equal(level.weaponMasteries, getWeaponMasteryCount(cls.id, level.level));
        assert.deepEqual(level.battleMaster, sub?.id === 'battle-master-2024' ? getBattleMasterProgression(level.level) : null);
      }
    }
    const features = snapshot.nodes.filter(n => n.category === 'classFeature');
    assert.deepEqual(features.map(n => n.domainId).sort(), cls.features.map(f => f.id).sort());
    for (const original of cls.features) assert.deepEqual(features.find(n => n.domainId === original.id).definition.choices, original.choices);
    for (let level = 1; level <= 20; level++) {
      const expected = getUnlockedClassFeatures(cls, level, '').map(f => f.feature.id).sort();
      assert.deepEqual(features.filter(n => n.definition.levelRequired <= level).map(n => n.domainId).sort(), expected);
    }
  }
});

test('capture mécanique : absences, identifiants inconnus et brouillons incomplets sans nettoyage', async () => {
  const input = draft({ classId: '', speciesId: '', backgroundId: '', choices: { subclassId: 'voie-fictive-inconnue', fightingStyles: ['style-inconnu'], 'custom:key': 'préservé' } });
  const before = canonical(input), snapshot = await capture(input);
  assert.equal(snapshot.state, 'partial'); assert.deepEqual(snapshot.selections.class, { state: 'unselected' });
  assert.equal(snapshot.selections.subclass.state, 'unresolved'); assert.equal(snapshot.selections.subclass.domainId, 'voie-fictive-inconnue');
  assert.equal(snapshot.selections.fightingStyles[0].state, 'unresolved'); assert.equal(canonical(input), before);
  const report = await validate(snapshot); assert.equal(report.valid, true); assert.equal(report.compatible, false);
  const unknown = await capture(draft({ classId: 'classe-fictive-inconnue' }));
  assert.equal(unknown.selections.class.state, 'unresolved'); assert.equal(unknown.state, 'partial');
});

test('capture mécanique : entrée détachée avant tout await et aucune mutation native', async () => {
  const native = { classes, species, backgrounds, feats, equipment, weapons, startingEquipment };
  const before = canonical(native), input = rich();
  const promise = capture(input); input.choices.subclassId = 'inconnu';
  const snapshot = await promise;
  assert.equal(snapshot.selections.subclass.state, 'resolved');
  assert.equal(canonical(native), before); assert.equal(Object.isFrozen(classes[0]), false);
});

test('capture mécanique : protection profonde du snapshot et de sa copie validée', async () => {
  const snapshot = await capture(rich());
  const check = value => { if (value && typeof value === 'object') { assert.equal(Object.isFrozen(value), true); Object.values(value).forEach(check); } };
  check(snapshot); check((await validate(clone(snapshot))).snapshot);
  assert.throws(() => { snapshot.nodes[0].definition.name = 'altéré'; }, TypeError);
  assert.throws(() => { snapshot.nodes.push({}); }, TypeError);
  assert.throws(() => { snapshot.tables.progressions[0].levels[0].choiceLimits.extra = 7; }, TypeError);
  const shallow = Object.freeze({ child: { value: 1 } }); freezeMechanical(shallow); assert.equal(Object.isFrozen(shallow.child), true);
});

test('capture mécanique : empreintes de nœuds et globale vérifiées', async () => {
  const original = await capture(rich());
  const altered = clone(original); altered.nodes[0].definition.name = 'altération fictive';
  assert.ok(codes(await validate(altered)).includes('node-hash')); assert.ok(codes(await validate(altered)).includes('bundle-hash'));
  const bundle = clone(original); bundle.bundleHash = 'sha256:v1:' + '0'.repeat(64);
  assert.ok(codes(await validate(bundle)).includes('bundle-hash'));
});

test('capture mécanique : hash recalculé insuffisant pour certifier une mécanique modifiée', async () => {
  const value = clone(await capture(rich()));
  value.nodes.find(n => n.category === 'class').definition.hitDie = 100;
  await rehash(value);
  const report = await validate(value); assert.equal(report.compatible, false);
  assert.ok(codes(report).includes('native-definition-mismatch')); assert.ok(!codes(report).includes('node-hash'));
});

test('capture mécanique : dépendance manquante, ambiguïté locale, références croisées et propriétaire invalide', async () => {
  const original = await capture(rich());
  const missing = clone(original); const feature = missing.nodes.find(n => n.category === 'classFeature');
  missing.nodes = missing.nodes.filter(n => n !== feature); await rehash(missing);
  assert.ok(codes(await validate(missing)).includes('missing-dependency'));
  const duplicate = clone(original); duplicate.nodes.push(clone(duplicate.nodes[0])); await rehash(duplicate);
  assert.ok(codes(await validate(duplicate)).includes('duplicate-node'));
  const crossed = clone(original); crossed.selections.subclass.target = crossed.selections.species.target; await rehash(crossed);
  assert.ok(codes(await validate(crossed)).includes('invalid-selection'));
  const owner = clone(original); owner.nodes.find(n => n.category === 'subclass').owner = 'mechanics:v1:absent'; await rehash(owner);
  assert.ok(codes(await validate(owner)).includes('missing-owner'));
});

test('capture mécanique : versions de format, référentiel, adaptateur et évaluateur incompatibles', async () => {
  const original = await capture(rich());
  for (const mutate of [v => v.formatVersion = 9, v => v.baseline.id = 'future', v => v.nodes[0].source.adapter.version = 'future', v => v.tables.evaluator.version = 'future']) {
    const value = clone(original); mutate(value); await rehash(value);
    const report = await validate(value); assert.equal(report.valid, false); assert.equal(report.compatible, false);
  }
});

test('capture mécanique : niveaux incomplets, limites altérées, options et catégorie malformées', async () => {
  const original = await capture(rich());
  for (const mutate of [v => v.tables.progressions[0].levels.pop(), v => v.tables.progressions[0].levels[0].fightingStyles = -1,
    v => v.nodes.find(n => n.definition.choices?.length).definition.choices[0].options = [], v => v.nodes[0].category = 'script']) {
    const value = clone(original); mutate(value); await rehash(value);
    assert.equal((await validate(value)).valid, false);
  }
});

test('capture mécanique : données brutes, fonctions, champs supplémentaires et imports non certifiés refusés', async () => {
  const original = await capture(rich());
  for (const mutate of [v => v.nodes[0].definition.structuredEntries = [{ type: 'raw', html: '<script>fictif</script>' }],
    v => v.nodes[0].definition.execute = () => 42, v => v.unknown = 'inattendu',
    v => v.nodes[0].source = { origin: 'library', contentId: 'library:v1:fictif', revisionHash: baselineHash, converter: { id: 'fictif', version: '1' }, adapter: { id: 'fictif', version: '1' }, artifactHash: baselineHash }]) {
    const value = clone(original); mutate(value);
    assert.equal((await validate(value)).compatible, false);
  }
  assert.equal((await validate(null)).valid, false);
  const cycle = {}; cycle.self = cycle; assert.ok(codes(await validate(cycle)).includes('non-json'));
});

test('capture mécanique : aucun accès IndexedDB ni localStorage, y compris validation', async () => {
  for (const name of ['indexedDB','localStorage']) Object.defineProperty(global, name, { configurable: true, get() { throw Error(`${name} interdit`); } });
  try { const value = await capture(rich()); assert.equal((await validate(value)).valid, true); }
  finally { delete global.indexedDB; delete global.localStorage; }
});

test('capture mécanique : mesures de taille reproductibles pour quatre personnages fictifs', async t => {
  const scenarios = { simple: draft(), sousClasse: draft({ classId: 'fighter-2024', choices: { subclassId: 'champion-2024' } }),
    hautNiveau: draft({ classId: 'fighter-2024', level: 20, choices: { subclassId: 'battle-master-2024' } }), nombreuxChoix: rich() };
  for (const [name, input] of Object.entries(scenarios)) {
    const snapshot = await capture(input), size = measure(snapshot);
    assert.equal(size.utf8Bytes, Buffer.byteLength(canonical(snapshot), 'utf8'));
    assert.equal(size.utf16BytesEstimate, canonical(snapshot).length * 2);
    assert.deepEqual(size, measure(await capture(input)));
    t.diagnostic(JSON.stringify({ scenario: name, nodes: snapshot.nodes.length, ...size, tenCharactersUtf16Estimate: size.utf16BytesEstimate * 10 }));
  }
});

test('capture mécanique : référence de dépendance croisée et mauvais propriétaire de sous-classe', async () => {
  const original = await capture(rich());
  const crossed = clone(original), cls = crossed.nodes.find(n => n.category === 'class');
  const featureEdge = cls.dependencies.find(d => d.category === 'classFeature');
  featureEdge.target = crossed.nodes.find(n => n.category === 'subclassFeature').snapshotId;
  await rehash(crossed); assert.ok(codes(await validate(crossed)).includes('missing-dependency'));
  const wrong = clone(original); wrong.selections.class.target = wrong.nodes.find(n => n.category === 'species').snapshotId;
  await rehash(wrong); assert.ok(codes(await validate(wrong)).includes('wrong-owner'));
});

test('capture mécanique : cohérence de l’état partiel et validation sans réparation implicite', async () => {
  const original = await capture(draft({ classId: '', speciesId: '', backgroundId: '' }));
  const before = canonical(original), copyValue = clone(original);
  copyValue.state = 'complete'; await rehash(copyValue);
  const report = await validate(copyValue);
  assert.equal(report.valid, false); assert.ok(codes(report).includes('state-mismatch')); assert.equal(report.snapshot, undefined);
  assert.equal(canonical(original), before);
  const invalidCharacter = draft({ level: 0 });
  await assert.rejects(capture(invalidCharacter), /Capture refusée/);
});

test('capture mécanique : caractéristiques, bonus et génération sans dés rejoués', async () => {
  const { STANDARD_ARRAY, POINT_BUY_COSTS, POINT_BUY_BUDGET } = require('../src/engine/abilityGeneration.ts');
  const { abilityModifier } = require('../src/engine/calculations.ts');
  const random = Math.random; Math.random = () => { throw Error('Aucun dé ne doit être relancé.'); };
  try {
    const snapshot = await capture(rich());
    assert.deepEqual(snapshot.tables.abilityGeneration.standardArray, STANDARD_ARRAY);
    assert.deepEqual(snapshot.tables.abilityGeneration.pointBuyCosts, POINT_BUY_COSTS);
    assert.equal(snapshot.tables.abilityGeneration.pointBuyBudget, POINT_BUY_BUDGET);
    for (const row of snapshot.tables.abilityModifiers) assert.equal(row.modifier, abilityModifier(row.score));
    assert.deepEqual(snapshot.tables.backgroundBonuses.split, [2,1]);
    const malformed = draft({ choices: { subclassId: ['ambigu-fictif'] } });
    const before = canonical(malformed);
    await assert.rejects(capture(malformed), /choices.subclassId/);
    assert.equal(canonical(malformed), before);
  } finally { Math.random = random; }
});

test('capture mécanique : contrat TypeScript corrélé, sans brut et profondément readonly', () => {
  const path = require('node:path');
  const config = ts.readConfigFile(path.join(__dirname, '../tsconfig.app.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.join(__dirname, '..'));
  const program = ts.createProgram([path.join(__dirname, 'types/frozen-mechanics.ts')], { ...parsed.options, incremental: false });
  assert.deepEqual(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});
