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
const { createLibraryIdentity, normalizeLibraryName, serializeLibraryJson, fingerprintLibraryText, fingerprintLibraryJson } = require('../src/engine/libraryIdentity.ts');
const { LIBRARY_IDENTITY_VERSION, LIBRARY_RECORD_VERSION } = require('../src/models/Library.ts');
const base = () => ({ provider: '5etools', category: 'class', name: 'Veilleur de papier', source: 'FRHoF' });
function identity(input) {
  const result = createLibraryIdentity(input);
  assert.equal(result.success, true, JSON.stringify(result));
  return result.identity;
}

test('identités versionnées et stables, sans identifiant métier', () => {
  assert.equal(LIBRARY_RECORD_VERSION, 1); assert.equal(LIBRARY_IDENTITY_VERSION, 1);
  const first = identity(base());
  assert.equal(first.id, identity(base()).id);
  assert.ok(first.id.startsWith('library:v1:'));
  assert.equal(first.identityVersion, 1);
  assert.equal(first.bookId, 'FRHOF');
  assert.equal(first.id.includes('fighter-2024'), false);
});

test('normalisation prudente : casse, NFC, alias et sources originales inchangées', () => {
  const input = Object.freeze({ ...base(), name: ' Éclaireur de papier ', source: ' srd-5.2.1 ' });
  const snapshot = JSON.stringify(input);
  const first = identity(input);
  assert.equal(first.id, identity({ ...input, name: 'e\u0301claireur de papier', source: 'XSRD' }).id);
  assert.equal(first.bookId, 'XSRD');
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(normalizeLibraryName(' A  B '), 'a  b');
  assert.notEqual(identity({ ...base(), name: 'A-B' }).id, identity({ ...base(), name: 'A B' }).id);
  assert.notEqual(identity({ ...base(), name: 'Éclat' }).id, identity({ ...base(), name: 'Eclat' }).id);
});

test('catégories, fournisseurs, livres et espaces distincts ne fusionnent pas', () => {
  const id = identity(base()).id;
  for (const change of [{ category: 'feat' }, { provider: 'srd' }, { source: 'PHB' }]) assert.notEqual(identity({ ...base(), ...change }).id, id);
  assert.notEqual(identity({ ...base(), source: 'PHB' }).id, identity({ ...base(), source: 'XPHB' }).id);
  assert.notEqual(identity({ ...base(), provider: 'homebrew', namespace: 'atelier-a' }).id, identity({ ...base(), provider: 'homebrew', namespace: 'atelier-b' }).id);
});

test('identité insuffisante : diagnostic sans clé de remplacement', () => {
  for (const input of [null, {}, { ...base(), source: '' }, { ...base(), name: ' ' }, { ...base(), provider: 'other' }, { ...base(), category: 'other' }, { ...base(), provider: 'custom' }, { ...base(), provider: 'homebrew', namespace: ' ' }, { ...base(), category: 'subclass' }, { ...base(), category: 'equipment' }]) {
    const result = createLibraryIdentity(input);
    assert.equal(result.success, false); assert.ok(result.issues.length); assert.equal(result.identity, undefined);
  }
  assert.equal(identity({ ...base(), source: 'FICTIVE-UNKNOWN-SOURCE' }).bookId, 'FICTIVE-UNKNOWN-SOURCE');
});

test('sous-classes : contexte propriétaire nécessaire et discriminant', () => {
  const input = { ...base(), category: 'subclass', classOwner: { name: 'Veilleur', source: 'PHB' } };
  const id = identity(input).id;
  assert.equal(id, identity({ ...input, classOwner: { name: ' VEILLEUR ', source: 'phb' } }).id);
  assert.notEqual(id, identity({ ...input, classOwner: { name: 'Veilleur', source: 'XPHB' } }).id);
  assert.notEqual(id, identity({ ...input, classOwner: { name: 'Cartographe', source: 'PHB' } }).id);
});

test('capacités : niveau et propriétaires empêchent les collisions', () => {
  const input = { ...base(), category: 'subclassFeature', classOwner: { name: 'Veilleur', source: 'PHB' }, subclassOwner: { name: 'Plieur', source: 'FRHoF' }, level: 3 };
  const id = identity(input).id;
  assert.notEqual(id, identity({ ...input, level: 7 }).id);
  assert.notEqual(id, identity({ ...input, subclassOwner: { name: 'Plieur', source: 'PHB' } }).id);
  assert.notEqual(id, identity({ ...input, subclassOwner: { name: 'Tisseur', source: 'FRHoF' } }).id);
  for (const level of [undefined, 0, 21, 3.5, '3', NaN]) assert.equal(createLibraryIdentity({ ...input, level }).success, false);
  assert.equal(createLibraryIdentity({ ...input, subclassOwner: undefined }).success, false);
  assert.equal(createLibraryIdentity({ ...base(), category: 'classFeature', classOwner: input.classOwner, level: 3 }).success, true);
  assert.equal(createLibraryIdentity({ ...base(), level: 3 }).success, false);
  assert.equal(createLibraryIdentity({ ...base(), classOwner: input.classOwner }).success, false);
});

test('familles équipement distinctes, sans heuristique de fusion', () => {
  const ids = ['item', 'baseitem', 'itemGroup'].map(originalKey => identity({ ...base(), category: 'equipment', originalKey }).id);
  assert.equal(new Set(ids).size, 3);
});

test('tuple non ambigu même avec séparateurs et caractères spéciaux', () => {
  assert.notEqual(identity({ ...base(), name: 'a|b', source: 'c' }).id, identity({ ...base(), name: 'a', source: 'b|c' }).id);
});

test('JSON déterministe : tri récursif y compris clés numériques, tableaux ordonnés', () => {
  const a = { z: [{ b: 2, a: 1 }], '2': 'two', '10': 'ten' };
  const b = { '10': 'ten', '2': 'two', z: [{ a: 1, b: 2 }] };
  assert.equal(serializeLibraryJson(a), serializeLibraryJson(b));
  assert.equal(serializeLibraryJson(a), '{"10":"ten","2":"two","z":[{"a":1,"b":2}]}');
  assert.notEqual(serializeLibraryJson([1, 2]), serializeLibraryJson([2, 1]));
  assert.deepEqual(JSON.parse(serializeLibraryJson(a)), a);
});

test('valeurs non JSON, cycles et tableaux creux refusés sans coercition', () => {
  const cyclic = {}; cyclic.self = cyclic;
  for (const value of [undefined, NaN, Infinity, 1n, () => 1, Symbol('x'), new Date(), new Map(), { a: undefined }, [undefined], new Array(2), cyclic]) assert.throws(() => serializeLibraryJson(value), TypeError);
  const shared = { x: 1 }; assert.equal(serializeLibraryJson([shared, shared]), '[{"x":1},{"x":1}]');
});

test('aucun accesseur exécuté ni propriété supplémentaire ignorée', () => {
  let called = false;
  const object = { get x() { called = true; return 1; } };
  assert.throws(() => serializeLibraryJson(object), TypeError); assert.equal(called, false);
  const array = [1]; Object.defineProperty(array, 'hidden', { value: 2 });
  assert.throws(() => serializeLibraryJson(array), TypeError);
  assert.throws(() => serializeLibraryJson({ [Symbol('x')]: 1 }), TypeError);
  const special = Object.create(null); special.__proto__ = 'original';
  assert.equal(serializeLibraryJson(special), '{"__proto__":"original"}');
});

test('SHA-256 natif connu, versionné et déterministe', async () => {
  assert.equal(await fingerprintLibraryText('abc'), 'sha256:v1:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await fingerprintLibraryText('Écho'), await fingerprintLibraryText('Écho'));
  await assert.rejects(fingerprintLibraryText(null), TypeError);
});

test('empreintes : format du fichier distinct, structure équivalente dédupliquée', async () => {
  assert.notEqual(await fingerprintLibraryText('{"a":1}'), await fingerprintLibraryText('{ "a": 1 }'));
  assert.equal(await fingerprintLibraryJson({ b: 2, a: 1 }), await fingerprintLibraryJson({ a: 1, b: 2 }));
  assert.notEqual(await fingerprintLibraryJson([1, 2]), await fingerprintLibraryJson([2, 1]));
  assert.notEqual(await fingerprintLibraryJson({ source: 'FRHoF' }), await fingerprintLibraryJson({ source: 'FRHOF' }));
  assert.notEqual(await fingerprintLibraryJson({ name: 'Écho' }), await fingerprintLibraryJson({ name: 'E\u0301cho' }));
});

test('contenu modifié : identité inchangée, révision différente', async () => {
  const first = { ...base(), entries: ['Un pli fictif.'] };
  const second = { ...base(), entries: ['Un autre pli fictif.'] };
  assert.equal(identity(first).id, identity(second).id);
  assert.notEqual(await fingerprintLibraryJson(first), await fingerprintLibraryJson(second));
});
