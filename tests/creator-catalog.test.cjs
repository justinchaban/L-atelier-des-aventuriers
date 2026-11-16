const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, filename);
};
require.extensions['.tsx'] = require.extensions['.ts'];

const { classes } = require('../src/data/classes.ts');
const { buildNativeCreatorCatalog, nativeCreatorCatalog } = require('../src/engine/nativeCreatorCatalog.ts');
const { getCreatorClasses, getCreatorClass, getAvailableCreatorClasses } = require('../src/engine/creatorCatalog.ts');
const { isBookAllowed } = require('../src/engine/restrictions.ts');

test('catalogue natif : parité exacte, ordre, capacités et sous-classes conservés', () => {
  assert.deepEqual(getCreatorClasses(nativeCreatorCatalog), classes);
  const expectedCount = classes.reduce((total, item) => total + 1 + item.features.length +
    item.subclasses.reduce((n, sub) => n + 1 + sub.features.length, 0), 0);
  assert.equal(nativeCreatorCatalog.entries.length, expectedCount);
  for (const item of classes) {
    assert.equal(getCreatorClass(nativeCreatorCatalog, item.id), item);
    const owner = nativeCreatorCatalog.entries.find(entry => entry.category === 'class' && entry.domainId === item.id);
    const subclasses = nativeCreatorCatalog.entries.filter(entry => entry.category === 'subclass' && entry.ownerKey === owner.catalogKey);
    assert.deepEqual(subclasses.map(entry => entry.definition), item.subclasses);
  }
  assert.equal(new Set(nativeCreatorCatalog.entries.map(entry => entry.catalogKey)).size, expectedCount);
  for (const entry of nativeCreatorCatalog.entries) {
    assert.equal(entry.reference.origin, 'native');
    assert.equal(entry.availability, 'ready');
    assert.equal(entry.domainId, entry.definition.id);
    assert.equal(entry.provenance.canonicalBookId, 'XSRD');
  }
  assert.equal(getCreatorClass(nativeCreatorCatalog, 'missing'), undefined);
});

test('identités stables et contextuelles, provenance et définitions intactes', () => {
  const make = (id, source) => ({ ...structuredClone(classes[0]), id, name: 'Gardien fictif', bookId: source,
    features: [{ id: 'shared', name: 'Éclat fictif', description: '', levelRequired: 1 }],
    subclasses: [{ id: 'shared', name: 'Voie fictive', description: '', bookId: 'FRHoF', ruleset: '2024',
      features: [{ id: 'shared', name: 'Écho fictif', description: '', levelRequired: 3 }] }] });
  const data = [make('a', 'srd-5.2.1'), make('b', 'UNKNOWN-SOURCE')];
  const before = JSON.stringify(data);
  const first = buildNativeCreatorCatalog(data);
  const reordered = buildNativeCreatorCatalog([...data].reverse());
  assert.deepEqual(first.entries.map(e => e.catalogKey).sort(), reordered.entries.map(e => e.catalogKey).sort());
  assert.equal(new Set(first.entries.map(e => e.catalogKey)).size, first.entries.length);
  assert.equal(JSON.stringify(data), before);
  assert.equal(first.entries[0].definition, data[0]);
  assert.equal(first.entries[0].provenance.originalSource, 'srd-5.2.1');
  assert.equal(first.entries[0].provenance.canonicalBookId, 'XSRD');
  const sub = first.entries.find(e => e.category === 'subclass');
  assert.equal(sub.provenance.originalSource, 'FRHoF');
  assert.equal(sub.provenance.canonicalBookId, 'FRHOF');
  const feature = first.entries.find(e => e.category === 'subclassFeature');
  assert.equal(feature.provenance.canonicalBookId, 'FRHOF');
  assert.equal(feature.provenance.bookInherited, true);
  assert.throws(() => buildNativeCreatorCatalog([data[0], data[0]]), /dupliquée/);
});

test('restrictions : parité, alias et sources inconnues explicitement autorisées', () => {
  for (const books of [[], ['XSRD'], ['srd-5.2.1'], ['PHB'], ['XPHB'], ['UNKNOWN']]) {
    assert.deepEqual(getAvailableCreatorClasses(nativeCreatorCatalog, books),
      classes.filter(item => isBookAllowed(item.bookId, books)));
  }
  const fictive = { ...structuredClone(classes[0]), id: 'fictive', bookId: 'UNKNOWN' };
  const catalog = buildNativeCreatorCatalog([fictive]);
  assert.deepEqual(getAvailableCreatorClasses(catalog, ['XSRD']), []);
  assert.deepEqual(getAvailableCreatorClasses(catalog, ['unknown']), [fictive]);
});

test('les états non utilisables ne fournissent aucune classe sélectionnable', () => {
  const entry = nativeCreatorCatalog.entries.find(e => e.category === 'class');
  for (const availability of ['preview-only', 'stale', 'archived', 'missing', 'invalid', 'conflict']) {
    const { definition, validation, rulesProfile, ...base } = entry;
    const catalog = { ...nativeCreatorCatalog, entries: [{ ...base, availability }] };
    assert.deepEqual(getCreatorClasses(catalog), []);
  }
});

test('contrat TypeScript : définition interdite sans validation et catégorie corrélée', () => {
  const config = ts.readConfigFile(path.join(__dirname, '../tsconfig.app.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.join(__dirname, '..'));
  const program = ts.createProgram([path.join(__dirname, 'types/creator-catalog.ts')], {
    ...parsed.options, incremental: false
  });
  const errors = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});

const { getUnlockedClassFeatures } = require('../src/engine/classProgression.ts');
const { validateFeatureChoices, cleanSubclassChoices } = require('../src/engine/characterChoices.ts');
const { getFightingStyleCount, validateFightingStyles } = require('../src/engine/fightingStyles.ts');
const { getWeaponMasteryCount, validateWeaponMasteries } = require('../src/engine/weaponMastery.ts');
const { getBattleMasterProgression } = require('../src/engine/battleMaster.ts');
const { weapons } = require('../src/data/weapons.ts');

test('progression : parité des classes et sous-classes aux niveaux 1 à 20', () => {
  for (const original of classes) {
    const definition = getCreatorClass(nativeCreatorCatalog, original.id);
    for (const subclassId of ['', ...original.subclasses.map(sub => sub.id)]) {
      for (let level = 1; level <= 20; level++) {
        assert.deepEqual(getUnlockedClassFeatures(definition, level, subclassId),
          getUnlockedClassFeatures(original, level, subclassId));
      }
    }
  }
  const fighter = getCreatorClass(nativeCreatorCatalog, 'fighter-2024');
  assert.equal(getUnlockedClassFeatures(fighter, 2, 'battle-master-2024').some(f => f.source === 'subclass'), false);
  assert.equal(getUnlockedClassFeatures(fighter, 3, 'battle-master-2024').some(f => f.feature.id === 'battle-master-combat-superiority'), true);
  assert.equal(getUnlockedClassFeatures(fighter, 20, '').some(f => f.feature.id === 'fighter-three-extra-attacks'), true);
});

test('Guerrier : styles, maîtrises, manœuvres et choix conservent leurs seuils', () => {
  const fighter = getCreatorClass(nativeCreatorCatalog, 'fighter-2024');
  const battleMaster = fighter.subclasses.find(sub => sub.id === 'battle-master-2024');
  const maneuvers = battleMaster.features.find(f => f.id === 'battle-master-combat-superiority').choices[0];
  const key = 'feature:subclass:battle-master-combat-superiority:battle-master-maneuvers';
  for (let level = 1; level <= 20; level++) {
    assert.equal(getFightingStyleCount(fighter.id, 'champion-2024', level), level < 7 ? 1 : 2);
    assert.deepEqual(validateFightingStyles(fighter.id, 'champion-2024', level, ['defense', 'archery', 'defense', 'invalid']),
      level < 7 ? ['defense'] : ['defense', 'archery']);
    const masteryCount = level >= 10 ? 5 : level >= 4 ? 4 : 3;
    assert.equal(getWeaponMasteryCount(fighter.id, level), masteryCount);
    assert.deepEqual(validateWeaponMasteries(fighter.id, level, weapons.map(w => w.id), ['srd-5.2.1']),
      weapons.slice(0, masteryCount).map(w => w.id));
    assert.deepEqual(validateWeaponMasteries(fighter.id, level, weapons.map(w => w.id), []), []);
    const known = level >= 15 ? 7 : level >= 7 ? 5 : level >= 3 ? 3 : 0;
    const progression = getBattleMasterProgression(level);
    assert.deepEqual(progression, {
      maneuversKnown: known,
      superiorityDice: level >= 15 ? 6 : level >= 7 ? 5 : level >= 3 ? 4 : 0,
      superiorityDie: level >= 18 ? 12 : level >= 10 ? 10 : 8
    });
    const choices = { subclassId: battleMaster.id, 'custom:unknown': ['retained'],
      [key]: maneuvers.options.map(option => option.id) };
    const cleaned = validateFeatureChoices(choices, fighter, level, battleMaster.id);
    assert.deepEqual(cleaned[key] ?? [], choices[key].slice(0, known));
    assert.deepEqual(cleaned['custom:unknown'], ['retained']);
  }
  const choices = { subclassId: battleMaster.id, [key]: ['precision-attack'], 'custom:unknown': 'kept' };
  assert.deepEqual(cleanSubclassChoices(choices, fighter, 'champion-2024'), {
    subclassId: 'champion-2024', 'custom:unknown': 'kept'
  });
  assert.equal(getFightingStyleCount('barbarian-2024', '', 20), 0);
  assert.equal(getWeaponMasteryCount('barbarian-2024', 20), 0);
});

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ClassSelector = require('../src/components/character/ClassSelector.tsx').default;
const SubclassSelector = require('../src/components/character/SubclassSelector.tsx').default;
const CharacterBuilder = require('../src/components/character/CharacterBuilder.tsx').default;
const StartingEquipmentSelector = require('../src/components/character/StartingEquipmentSelector.tsx').default;

test('sélecteurs : classes natives uniquement, sous-classes, seuil et restrictions inchangés', () => {
  let changes = 0;
  const onChange = () => { changes++; };
  const props = { selectedId: 'fighter-2024', selectedSubclassId: 'battle-master-2024',
    selectedSkills: [], selectedFightingStyles: [], selectedWeaponMasteries: [], selectedFeatureChoices: {},
    allowedBooks: ['srd-5.2.1'], characterLevel: 3, onChange, onSubclassChange: onChange,
    onSkillsChange: onChange, onFeatureChoiceChange: onChange, onWeaponMasteriesChange: onChange,
    onFightingStylesChange: onChange };
  const html = renderToStaticMarkup(React.createElement(ClassSelector, props));
  assert.equal((html.match(/class="class-builder-option(?: selected)?"/g) ?? []).length, classes.length);
  assert.ok(html.includes('Maître de bataille'));
  assert.ok(html.includes('Champion'));
  assert.ok(html.includes('Style de combat'));
  const denied = renderToStaticMarkup(React.createElement(ClassSelector, { ...props, allowedBooks: [] }));
  assert.ok(denied.includes('Aucune classe disponible'));
  const fighter = getCreatorClass(nativeCreatorCatalog, 'fighter-2024');
  const renderSub = (characterLevel, allowedBooks) => renderToStaticMarkup(React.createElement(SubclassSelector, {
    characterClass: fighter, characterLevel, allowedBooks, selectedId: '', onChange
  }));
  assert.ok(renderSub(2, ['XSRD']).includes('niveau 3'));
  assert.ok(renderSub(3, []).includes('Aucune sous-classe disponible'));
  // Vérifie aussi la source propre d'une sous-classe, indépendamment de sa classe.
  const fictive = { ...fighter, subclasses: [{ ...fighter.subclasses[0], bookId: 'FRHoF' }] };
  const subProps = { characterClass: fictive, characterLevel: 3, selectedId: '', onChange };
  assert.ok(renderToStaticMarkup(React.createElement(SubclassSelector, { ...subProps, allowedBooks: ['XSRD'] })).includes('Aucune sous-classe disponible'));
  assert.ok(renderToStaticMarkup(React.createElement(SubclassSelector, { ...subProps, allowedBooks: ['FRHOF'] })).includes('Champion'));
  assert.equal(changes, 0);
});

test('personnage v1 : consultation sans mutation, sauvegarde exacte et aucun accès IndexedDB', () => {
  const { loadCharacters, saveCharacters, CHARACTER_STORAGE_KEY } = require('../src/services/storage.ts');
  assert.equal(CHARACTER_STORAGE_KEY, 'atelier-aventuriers:characters:v1');
  const character = { schemaVersion: 1, id: 'native-existing-character', name: 'Gardienne fictive', level: 3,
    speciesId: '', classId: 'fighter-2024', backgroundId: '',
    abilities: { str: 15, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    choices: { subclassId: 'battle-master-2024', 'custom:unknown': ['keep'], classEquipmentOptionId: 'fighter-gold',
      'feature:subclass:battle-master-combat-superiority:battle-master-maneuvers': ['precision-attack'] },
    gameState: { currentHP: 1, temporaryHP: 0, usedHitDice: 0, usedSpellSlots: {}, conditions: [] } };
  const raw = JSON.stringify([character]);
  const values = new Map([[CHARACTER_STORAGE_KEY, raw]]);
  const writes = [];
  global.localStorage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { writes.push(key); values.set(key, value); } };
  Object.defineProperty(global, 'indexedDB', { configurable: true, get() { throw Error('IndexedDB ne doit pas être lu'); } });
  try {
    const loaded = loadCharacters();
    assert.equal(loaded.status, 'loaded');
    const before = JSON.stringify(loaded.characters);
    let changes = 0;
    const onChange = () => { changes++; };
    for (let consultation = 0; consultation < 2; consultation++) {
      buildNativeCreatorCatalog(classes);
      getCreatorClass(nativeCreatorCatalog, character.classId);
      renderToStaticMarkup(React.createElement(CharacterBuilder, {
        character: loaded.characters[0], campaign: null, onChange, onClose: () => {}
      }));
      const equipment = renderToStaticMarkup(React.createElement(StartingEquipmentSelector, { character, onChange }));
      assert.ok(equipment.includes('Guerrier'));
      assert.ok(equipment.includes('155 PO'));
    }
    assert.equal(changes, 0);
    assert.deepEqual(writes, []);
    assert.equal(JSON.stringify(loaded.characters), before);
    assert.equal(saveCharacters(loaded.characters).success, true);
    assert.equal(values.get(CHARACTER_STORAGE_KEY), raw);
    assert.deepEqual(loadCharacters().characters, [character]);
    assert.deepEqual(writes, [CHARACTER_STORAGE_KEY]);
  } finally {
    delete global.indexedDB;
    delete global.localStorage;
  }
});
