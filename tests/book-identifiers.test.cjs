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
const { books, normalizeBookId, normalizeBookIds, getBookById } = require('../src/data/books.ts');
const { isBookAllowed, isContentAllowed } = require('../src/engine/restrictions.ts');
const { createCampaign } = require('../src/models/Campaign.ts');
const { generateCampaignCode, importCampaignCode } = require('../src/services/campaignCode.ts');
const { analyzeContentJson } = require('../src/engine/contentImporter.ts');
const { importClasses } = require('../src/engine/classImporter.ts');

test('normalisation canonique, alias, casse, espaces et idempotence', () => {
  for (const [input, expected] of [
    [' srd-5.2.1 ', 'XSRD'], ['xsrd', 'XSRD'], ['phb-2024', 'XPHB'],
    ['xge-2017', 'XGE'], ['tce-2020', 'TCE'], ['FRHoF', 'FRHOF'], [' my-source ', 'MY-SOURCE'], ['constructor', 'CONSTRUCTOR'], ['__proto__', '__PROTO__']
  ]) {
    assert.equal(normalizeBookId(input), expected);
    assert.equal(normalizeBookId(expected), expected);
  }
  assert.deepEqual(normalizeBookIds(['srd-5.2.1', 'XSRD', ' ', 'My-Source']), ['XSRD', 'MY-SOURCE']);
  assert.notEqual(normalizeBookId('PHB'), normalizeBookId('XPHB'));
  for (const book of books) assert.equal(book.id, normalizeBookId(book.id));
  assert.equal(getBookById('FRHoF').id, 'FRHOF');
});

test('autorisation explicite indépendante du catalogue et de la disponibilité', () => {
  assert.equal(isBookAllowed('XSRD', ['srd-5.2.1']), true);
  assert.equal(isBookAllowed('srd-5.2.1', ['XSRD']), true);
  assert.equal(isBookAllowed('FRHoF', ['FRHOF']), true);
  assert.equal(isBookAllowed('PHB', ['XPHB']), false);
  assert.equal(isBookAllowed('UNKNOWN-SOURCE', []), false);
  assert.equal(isBookAllowed('', ['']), false);
  assert.equal(isBookAllowed('unknown-source', ['UNKNOWN-SOURCE']), true);
  assert.equal(getBookById('UNKNOWN-SOURCE'), undefined);
  assert.equal(isContentAllowed({ id: 'fighter-2024', bookId: 'srd-5.2.1' }, { allowedBooks: ['XSRD'] }), true);
});

test('codes historiques et nouveaux, sources inconnues conservées et validation', () => {
  const campaign = { ...createCampaign(), name: 'Épopée', allowedBooks: ['srd-5.2.1', 'FRHoF', 'my-source', 'XSRD'] };
  const oldCode = 'LADA1:' + Buffer.from(JSON.stringify({ version: 1, name: campaign.name, allowedBooks: campaign.allowedBooks })).toString('base64');
  for (const code of [oldCode, generateCampaignCode(campaign)]) {
    const result = importCampaignCode(code);
    assert.equal(result.name, campaign.name);
    assert.deepEqual(result.allowedBooks, ['XSRD', 'FRHOF', 'MY-SOURCE']);
  }
  assert.deepEqual(createCampaign().allowedBooks, ['XSRD']);
  for (const allowedBooks of [[' '], [42], null]) {
    const code = 'LADA1:' + Buffer.from(JSON.stringify({ version: 1, name: 'Test', allowedBooks })).toString('base64');
    assert.throws(() => importCampaignCode(code));
  }
});

test('catalogues intégrés canoniques et identifiants métier préservés', () => {
  for (const [file, key] of [['classes', 'classes'], ['species', 'species'], ['backgrounds', 'backgrounds'], ['feats', 'feats'], ['equipment', 'equipment'], ['weapons', 'weapons']]) {
    const items = require(`../src/data/${file}.ts`)[key];
    assert.ok(Array.isArray(items), file);
    for (const item of items) {
      assert.equal(item.bookId, normalizeBookId(item.bookId));
      assert.equal(isBookAllowed(item.bookId, ['srd-5.2.1']), true);
    }
  }
  assert.ok(require('../src/data/classes.ts').classes.some(c => c.id === 'fighter-2024'));
});

test('imports : livre canonique, provenance et références originales intactes', () => {
  const reference = 'Feature|Test|FRHoF|3|FRHoF';
  const raw = {
    class: [{ name: 'Test', source: 'FRHoF', edition: 'one', hd: { faces: 10 }, classFeatures: [{ classFeature: reference, gainSubclassFeature: true }] }],
    classFeature: [{ name: 'Feature', source: 'FRHoF', className: 'Test', classSource: 'FRHoF', level: 3, entries: ['Description'] }]
  };
  const snapshot = JSON.stringify(raw);
  const analysis = analyzeContentJson(snapshot, 'test.json', 'local-import');
  const result = importClasses(analysis, 'frhof');
  assert.equal(analysis.report.sourceId, 'local-import');
  assert.equal(analysis.books[0].bookId, 'FRHOF');
  assert.equal(result.classes.length, 1);
  const cls = result.classes[0];
  assert.equal(cls.bookId, 'FRHOF');
  assert.equal(cls.importMetadata.originalSource, 'FRHoF');
  assert.equal(cls.features[0].bookId, 'FRHOF');
  assert.equal(cls.features[0].importMetadata.originalReference, reference);
  assert.equal(cls.features[0].importMetadata.originalSource, 'FRHoF');
  assert.equal(JSON.stringify(raw), snapshot);
  assert.equal(analysis.content[0].entries[0].source, 'FRHoF');
});


test('fichier Guerrier : conversion conservée, sous-classes canoniques', () => {
  const text = fs.readFileSync(require('node:path').join(__dirname, '../class/class-fighter.json'), 'utf8');
  const analysis = analyzeContentJson(text, 'class-fighter.json', 'local-import');
  for (const source of ['PHB', 'XPHB']) {
    const result = importClasses(analysis, source);
    assert.equal(result.classes.length, 1);
    assert.equal(result.classes[0].id, `fighter-${source.toLowerCase()}`);
    assert.ok(result.classes[0].features.length > 0);
    assert.ok(result.classes[0].subclasses.length > 0);
    for (const subclass of result.classes[0].subclasses) {
      assert.equal(subclass.bookId, normalizeBookId(subclass.bookId));
    }
  }
});
