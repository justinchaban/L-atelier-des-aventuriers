// Charge les modules TypeScript en mémoire, sans compilation sur disque.
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
};
const { loadCharacters, saveCharacters, parseCharacterStorage, CHARACTER_STORAGE_KEY: KEY, CHARACTER_RECOVERY_PREFIX } = require('../src/services/storage.ts');
const { migrateCharacter, validateCharacterCompleteness, validateCharacterStructure } = require('../src/engine/characterValidation.ts');
const { isValidStandardArray, getPointBuyTotal } = require('../src/engine/abilityGeneration.ts');
const character = () => ({ schemaVersion: 1, id: 'existing-id', name: 'Éowyn', level: 1, speciesId: '', classId: '', backgroundId: '', abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, choices: {}, gameState: { currentHP: 1, temporaryHP: 0, usedHitDice: 0, usedSpellSlots: {}, conditions: [] } });
function storage(raw = null, fail = () => false) {
  const values = new Map(raw === null ? [] : [[KEY, raw]]);
  const writes = [];
  global.localStorage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { if (fail('get', key)) throw Error('read'); return values.get(key) ?? null; },
    setItem(key, value) { if (fail('set', key)) throw Error('quota'); writes.push(key); values.set(key, value); }
  };
  return { values, writes };
}

test('brouillons : scores zéro, partiels et choix inconnus survivent exactement', () => {
  for (const method of ['standard', 'roll', 'point-buy', 'manual']) {
    const c = character();
    c.choices = { abilityGenerationMethod: method, abilityRolls: ['15', '15', '13', '12', '10', '8'], abilityRollAssignments: ['0', '', '', '', '', ''], abilityRollDice: ['6,5,4,1'], 'custom:choice': ['unknown-id'] };
    c.abilities.str = 15;
    const { writes } = storage();
    assert.equal(saveCharacters([c]).success, true);
    assert.deepEqual(loadCharacters().characters, [c]);
    assert.equal(loadCharacters().status, 'loaded');
    assert.equal(writes.length, 1);
    assert.ok(validateCharacterCompleteness(c).length);
  }
});

test('sauvegarde v1 existante, scores 1 à 30 et propriétés additionnelles préservés', () => {
  const c = character(); c.abilities = { str: 30, dex: 21, con: 18, int: 1, wis: 10, cha: 8 };
  c.campaignId = 'old-campaign'; c.custom = { retained: true };
  const raw = JSON.stringify([c]); const { writes } = storage(raw);
  assert.deepEqual(loadCharacters().characters, [c]);
  assert.equal(writes.length, 0);
  assert.equal(saveCharacters(loadCharacters().characters).success, true);
  assert.deepEqual(loadCharacters().characters, [c]);
});

test('réparation seulement en mémoire, migration idempotente, copie exacte avant écriture', () => {
  const c = character(); delete c.choices; delete c.gameState.conditions;
  const raw = JSON.stringify([c], null, 2); const { values, writes } = storage(raw);
  const report = loadCharacters();
  assert.equal(report.status, 'anomaly'); assert.ok(report.issues.length >= 2);
  assert.equal(report.originalData, raw); assert.equal(writes.length, 0);
  assert.deepEqual(migrateCharacter(report.characters[0]), { character: report.characters[0], issues: [] });
  assert.equal(values.get(KEY), raw);
  const result = saveCharacters(report.characters);
  assert.equal(result.success, true); assert.equal(values.get(result.recoveryKey), raw);
  assert.ok(writes[0].startsWith(CHARACTER_RECOVERY_PREFIX)); assert.equal(writes[1], KEY);
});

test('JSON corrompu, racine invalide, versions futures, doublons et types invalides signalés', () => {
  const c = character();
  for (const raw of ['{bad', '{}', JSON.stringify([{ ...c, schemaVersion: 2 }]), JSON.stringify([{ ...c, choices: { bad: [1] } }]), JSON.stringify([{ ...c, gameState: [] }]), JSON.stringify([{ ...c, abilities: { ...c.abilities, str: '15' } }]), JSON.stringify([c, c])]) {
    const { writes, values } = storage(raw);
    const report = loadCharacters(); assert.equal(report.status, 'anomaly'); assert.ok(report.issues.length);
    assert.equal(report.originalData, raw); assert.equal(writes.length, 0);
    const result = saveCharacters(report.characters);
    assert.equal(result.success, true); assert.equal(values.get(result.recoveryKey), raw);
  }
  assert.equal(parseCharacterStorage(JSON.stringify([{ ...c, schemaVersion: 2 }])).characters.length, 0);
  const noVersion = { ...c }; delete noVersion.schemaVersion;
  assert.equal(migrateCharacter(noVersion).character, null);
});

test('liste mixte : entrée valide conservée et entrée invalide diagnostiquée', () => {
  const c = character(); storage(JSON.stringify([null, c, { ...c, schemaVersion: 99 }]));
  const result = loadCharacters(); assert.deepEqual(result.characters, [c]); assert.equal(result.issues.length, 2);
});

test('échec de copie de récupération : écriture principale bloquée', () => {
  const raw = '{bad'; const { values, writes } = storage(raw, (op, key) => op === 'set' && key !== KEY);
  const result = saveCharacters([character()]); assert.equal(result.success, false);
  assert.equal(result.originalData, raw); assert.equal(values.get(KEY), raw); assert.deepEqual(writes, []);
});

test('copie non vérifiable : écriture principale bloquée', () => {
  const raw = '{bad'; const { values } = storage(raw);
  const get = localStorage.getItem;
  localStorage.getItem = key => key.startsWith(CHARACTER_RECOVERY_PREFIX) ? null : get(key);
  assert.equal(saveCharacters([character()]).success, false); assert.equal(values.get(KEY), raw);
});

test('stockage inaccessible et quota : échecs explicites, aucune perte', () => {
  storage(null, op => op === 'get');
  assert.equal(loadCharacters().status, 'unavailable'); assert.equal(saveCharacters([character()]).success, false);
  const raw = JSON.stringify([character()]); const { values } = storage(raw, op => op === 'set');
  assert.equal(saveCharacters([character()]).success, false); assert.equal(values.get(KEY), raw);
});

test('sortie invalide ou dupliquée : refus sans écriture', () => {
  const { writes } = storage(); const c = character();
  assert.equal(saveCharacters([{ ...c, choices: null }]).success, false);
  assert.equal(saveCharacters([c, c]).success, false); assert.deepEqual(writes, []);
});

test('six clés obligatoires et séparation structure / complétude', () => {
  assert.equal(isValidStandardArray({}), false); assert.equal(getPointBuyTotal({}), -1);
  assert.equal(isValidStandardArray({ str: 8, dex: 10, con: 12, int: 13, wis: 14, cha: 15 }), true);
  const c = character(); assert.deepEqual(validateCharacterStructure(c), []);
  assert.ok(validateCharacterCompleteness(c).length);
  for (const score of [-1, 31, 1.5, NaN, Infinity]) assert.ok(validateCharacterStructure({ ...c, abilities: { ...c.abilities, str: score } }).length);
});


test('copies originales toujours exportables après un nouveau chargement', () => {
  const raw = '{original illisible'; const { values } = storage(raw);
  assert.equal(saveCharacters([character()]).success, true);
  const report = loadCharacters();
  assert.equal(report.status, 'loaded');
  assert.deepEqual(report.recoveryCopies, [raw]);
  assert.deepEqual(report.characters, [character()]);
  assert.equal(values.get(KEY), JSON.stringify([character()]));
});

test('échec de l’écriture principale après copie : original et copie conservés', () => {
  const raw = '{bad'; const { values } = storage(raw, (op, key) => op === 'set' && key === KEY);
  const result = saveCharacters([character()]);
  assert.equal(result.success, false);
  assert.equal(values.get(KEY), raw); assert.equal(values.get(result.recoveryKey), raw);
});

test('modification du stockage pendant la préparation : écriture bloquée', () => {
  const { values } = storage('{bad'); const set = localStorage.setItem;
  localStorage.setItem = (key, value) => { set(key, value); if (key.startsWith(CHARACTER_RECOVERY_PREFIX)) values.set(KEY, 'external-change'); };
  assert.equal(saveCharacters([character()]).success, false);
  assert.equal(values.get(KEY), 'external-change');
});

test('personnage complet et brouillon sont persistables indépendamment des règles de création', () => {
  const c = character(); c.speciesId = 'human-2024'; c.classId = 'fighter-2024'; c.backgroundId = 'soldier-2024';
  c.abilities = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  c.choices.abilityGenerationMethod = 'standard';
  assert.deepEqual(validateCharacterCompleteness(c), []);
  c.choices.abilityGenerationMethod = 'roll';
  c.choices.abilityRolls = ['15','14','13','12','10','8'];
  c.choices.abilityRollAssignments = ['0','1','2','3','4','5'];
  assert.deepEqual(validateCharacterCompleteness(c), []);
  c.choices.abilityRollAssignments[0] = '1';
  assert.ok(validateCharacterCompleteness(c).length);
  storage(); assert.equal(saveCharacters([c]).success, true);
});
