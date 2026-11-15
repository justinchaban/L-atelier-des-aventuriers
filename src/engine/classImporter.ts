
import type {
  AbilityId,
  Ruleset
} from '../models/Species';

import type {
  CharacterClass,
  ClassChoice,
  ClassFeature,
  ClassProficiencyEntry,
  HitDie,
  ImportedContentMetadata,
  Subclass
} from '../models/Class';

import type {
  ContentParseResult,
  FeatureLink,
  JsonRecord
} from './contentImporter';

import {
  getEntrySource,
  isJsonRecord
} from './contentImporter';

// ==========================================
// TYPES
// ==========================================

export interface ClassImportResult {
  classes: CharacterClass[];
  importedClasses: number;
  importedSubclasses: number;
  skippedSubclasses: number;
  warnings: string[];
  errors: string[];
}

interface ResolvedSubclass {
  entry: JsonRecord;
  featureOwner: JsonRecord;
  inherited: boolean;
}

interface FeatureContext {
  ownerType: 'class' | 'subclass';
  className: string;
  classSource: string;
  ownerName: string;
  ownerSource: string;
}

// ==========================================
// CONSTANTES
// ==========================================

const ABILITIES: AbilityId[] = [
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha'
];

const HIT_DICE: HitDie[] = [
  6,
  8,
  10,
  12
];

// ==========================================
// UTILITAIRES
// ==========================================

function getString(
  value: unknown
): string | null {
  if (
    typeof value !== 'string' ||
    value.trim() === ''
  ) {
    return null;
  }

  return value.trim();
}

function normalizeSource(
  value: string
): string {
  return value.trim().toUpperCase();
}

function sameText(
  first: string,
  second: string
): boolean {
  return (
    first.trim().toLowerCase() ===
    second.trim().toLowerCase()
  );
}

function isAbility(
  value: unknown
): value is AbilityId {
  return (
    typeof value === 'string' &&
    ABILITIES.includes(value as AbilityId)
  );
}

function makeId(
  ...parts: string[]
): string {
  return parts
    .map(part =>
      part
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    )
    .filter(Boolean)
    .join('-');
}

function getRuleset(
  source: string,
  entry: JsonRecord
): Ruleset {
  if (
    entry.edition === 'one' ||
    source === 'XPHB' ||
    source === 'XSRD'
  ) {
    return '2024';
  }

  return '2014';
}

function createMetadata(
  entry: JsonRecord,
  reference?: string
): ImportedContentMetadata {
  return {
    provider: '5etools',
    originalName:
      getString(entry.name) ?? '',
    originalSource:
      getEntrySource(entry) ?? 'UNKNOWN',
    originalReference: reference,
    hasUnresolvedCopy: false
  };
}

// ==========================================
// DONNÉES DE CLASSE
// ==========================================

function getHitDie(
  entry: JsonRecord
): HitDie | null {
  if (!isJsonRecord(entry.hd)) {
    return null;
  }

  const faces = entry.hd.faces;

  if (
    typeof faces !== 'number' ||
    !HIT_DICE.includes(faces as HitDie)
  ) {
    return null;
  }

  return faces as HitDie;
}

function getPrimaryAbilities(
  entry: JsonRecord
): AbilityId[] {
  if (!Array.isArray(entry.primaryAbility)) {
    return [];
  }

  const abilities = new Set<AbilityId>();

  for (const value of entry.primaryAbility) {
    if (isAbility(value)) {
      abilities.add(value);
      continue;
    }

    if (!isJsonRecord(value)) {
      continue;
    }

    for (const [key, enabled] of Object.entries(
      value
    )) {
      if (
        enabled === true &&
        isAbility(key)
      ) {
        abilities.add(key);
      }
    }
  }

  return Array.from(abilities);
}

function getSavingThrows(
  entry: JsonRecord
): AbilityId[] {
  if (!Array.isArray(entry.proficiency)) {
    return [];
  }

  return Array.from(
    new Set(
      entry.proficiency.filter(isAbility)
    )
  );
}

function getProficiencies(
  entry: JsonRecord
): ClassProficiencyEntry[] {
  const result: ClassProficiencyEntry[] = [];

  if (
    !isJsonRecord(entry.startingProficiencies)
  ) {
    return result;
  }

  const starting = entry.startingProficiencies;

  const categories: Array<{
    key: string;
    type: ClassProficiencyEntry['type'];
  }> = [
    { key: 'armor', type: 'armor' },
    { key: 'weapons', type: 'weapon' },
    { key: 'tools', type: 'tool' }
  ];

  for (const category of categories) {
    const values = starting[category.key];

    if (!Array.isArray(values)) {
      continue;
    }

    for (const value of values) {
      if (typeof value !== 'string') {
        continue;
      }

      const id = value.trim().toLowerCase();

      if (
        !result.some(
          item =>
            item.type === category.type &&
            item.id === id
        )
      ) {
        result.push({
          type: category.type,
          id
        });
      }
    }
  }

  return result;
}

function getSkillChoices(
  entry: JsonRecord
): ClassChoice | undefined {
  if (
    !isJsonRecord(entry.startingProficiencies)
  ) {
    return undefined;
  }

  const skills =
    entry.startingProficiencies.skills;

  if (!Array.isArray(skills)) {
    return undefined;
  }

  for (const skillEntry of skills) {
    if (
      !isJsonRecord(skillEntry) ||
      !isJsonRecord(skillEntry.choose)
    ) {
      continue;
    }

    const choose = skillEntry.choose;

    if (
      !Array.isArray(choose.from) ||
      typeof choose.count !== 'number' ||
      !Number.isInteger(choose.count) ||
      choose.count < 1
    ) {
      continue;
    }

    const options = choose.from
      .filter(
        (value): value is string =>
          typeof value === 'string' &&
          value.trim() !== ''
      )
      .map(value => ({
        id: makeId(value),
        name: value
      }));

    if (options.length === 0) {
      continue;
    }

    return {
      id: 'class-skills',
      name: 'Compétences de classe',
      description:
        'Choisissez vos compétences de classe.',
      count: choose.count,
      options
    };
  }

  return undefined;
}

// ==========================================
// RÉSOLUTION DES HÉRITAGES _copy
// ==========================================

function findSubclass(
  subclasses: JsonRecord[],
  reference: JsonRecord
): JsonRecord | undefined {
  const name = getString(reference.name);
  const source = getString(reference.source);

  const className =
    getString(reference.className);

  const classSource =
    getString(reference.classSource);

  const shortName =
    getString(reference.shortName);

  if (
    !name ||
    !source ||
    !className ||
    !classSource
  ) {
    return undefined;
  }

  return subclasses.find(entry => {
    const entryName = getString(entry.name);
    const entrySource = getEntrySource(entry);

    const entryClassName =
      getString(entry.className);

    const entryClassSource =
      getString(entry.classSource);

    const entryShortName =
      getString(entry.shortName);

    return (
      entryName !== null &&
      entrySource !== null &&
      entryClassName !== null &&
      entryClassSource !== null &&
      sameText(entryName, name) &&
      entrySource === normalizeSource(source) &&
      sameText(entryClassName, className) &&
      normalizeSource(entryClassSource) ===
        normalizeSource(classSource) &&
      (
        !shortName ||
        (
          entryShortName !== null &&
          sameText(entryShortName, shortName)
        )
      )
    );
  });
}

function resolveSubclassCopy(
  entry: JsonRecord,
  subclasses: JsonRecord[],
  warnings: string[],
  visited = new Set<JsonRecord>()
): ResolvedSubclass | null {
  const name = getString(entry.name) ??
    'Sous-classe inconnue';

  if (visited.has(entry)) {
    warnings.push(
      `${name} : héritage _copy circulaire.`
    );

    return null;
  }

  const copy = entry._copy;

  if (!isJsonRecord(copy)) {
    return {
      entry,
      featureOwner: entry,
      inherited: false
    };
  }

  if (isJsonRecord(copy._mod)) {
    warnings.push(
      `${name} : modifications _mod ` +
      'non prises en charge.'
    );

    return null;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(entry);

  const parent = findSubclass(
    subclasses,
    copy
  );

  if (!parent) {
    warnings.push(
      `${name} : source de _copy ` +
      'introuvable dans ce fichier.'
    );

    return null;
  }

  const resolvedParent = resolveSubclassCopy(
    parent,
    subclasses,
    warnings,
    nextVisited
  );

  if (!resolvedParent) {
    return null;
  }

  // Héritage des propriétés du parent,
  // puis application des propriétés locales.
  //
  // _copy et _preserve ne sont pas des
  // propriétés de notre modèle final.

  const {
    _copy: ignoredCopy,
    ...localProperties
  } = entry;

  void ignoredCopy;

  const merged: JsonRecord = {
    ...resolvedParent.entry,
    ...localProperties
  };

  // On conserve les caractéristiques
  // d'identification de l'enfant.
  //
  // Ses capacités restent celles du parent
  // tant qu'elles ne sont pas remplacées
  // explicitement.

  return {
    entry: merged,
    featureOwner:
      Array.isArray(entry.subclassFeatures)
        ? entry
        : resolvedParent.featureOwner,
    inherited: true
  };
}

// ==========================================
// CAPACITÉS
// ==========================================

function convertFeature(
  link: FeatureLink,
  targetClassSource: string,
  targetSubclassName?: string,
  targetSubclassSource?: string
): ClassFeature | null {
  if (!link.resolved || !link.feature) {
    return null;
  }

  const entry = link.feature;

  return {
    id: makeId(
      link.ownerType,
      link.className,
      targetClassSource,
      targetSubclassName ?? '',
      targetSubclassSource ?? '',
      link.featureName,
      link.featureSource,
      String(link.level)
    ),

    name: link.featureName,
    description: '',
    levelRequired: link.level,
    bookId: link.featureSource,

    importMetadata: createMetadata(
      entry,
      link.reference
    ),

    structuredEntries:
      Array.isArray(entry.entries)
        ? entry.entries
        : []
  };
}

function getFeatures(
  links: FeatureLink[],
  context: FeatureContext,
  warnings: string[],
  targetClassSource?: string,
  targetSubclassName?: string,
  targetSubclassSource?: string
): ClassFeature[] {
  const matchingLinks = links.filter(
    link =>
      link.ownerType === context.ownerType &&
      sameText(
        link.className,
        context.className
      ) &&
      link.classSource === context.classSource &&
      sameText(
        link.ownerName,
        context.ownerName
      ) &&
      link.ownerSource === context.ownerSource
  );

  const features: ClassFeature[] = [];

  for (const link of matchingLinks) {
    const feature = convertFeature(
      link,
      targetClassSource ?? context.classSource,
      targetSubclassName,
      targetSubclassSource
    );

    if (!feature) {
      warnings.push(
        `Capacité non résolue : ${link.reference}`
      );

      continue;
    }

    features.push(feature);
  }

  return features.sort(
    (a, b) =>
      a.levelRequired - b.levelRequired
  );
}

// ==========================================
// NIVEAU DE SOUS-CLASSE
// ==========================================

function getSubclassLevel(
  entry: JsonRecord,
  links: FeatureLink[]
): number | null {
  if (!Array.isArray(entry.classFeatures)) {
    return null;
  }

  for (const value of entry.classFeatures) {
    if (
      !isJsonRecord(value) ||
      value.gainSubclassFeature !== true
    ) {
      continue;
    }

    const reference =
      getString(value.classFeature);

    if (!reference) {
      continue;
    }

    const parts = reference.split('|');
    const level = Number(parts[3]);

    if (
      Number.isInteger(level) &&
      level >= 1 &&
      level <= 20
    ) {
      return level;
    }
  }

  const name = getString(entry.name);
  const source = getEntrySource(entry);

  if (!name || !source) {
    return null;
  }

  const levels = links
    .filter(
      link =>
        link.ownerType === 'subclass' &&
        sameText(link.className, name) &&
        link.classSource === source
    )
    .map(link => link.level);

  return levels.length > 0
    ? Math.min(...levels)
    : null;
}

// ==========================================
// CONVERSION DES SOUS-CLASSES
// ==========================================

function convertSubclasses(
  classEntry: JsonRecord,
  subclasses: JsonRecord[],
  links: FeatureLink[],
  warnings: string[]
): {
  subclasses: Subclass[];
  skipped: number;
} {
  const className =
    getString(classEntry.name);

  const classSource =
    getEntrySource(classEntry);

  if (!className || !classSource) {
    return {
      subclasses: [],
      skipped: 0
    };
  }

  const converted: Subclass[] = [];
  let skipped = 0;

  for (const originalEntry of subclasses) {
    const entryClassName =
      getString(originalEntry.className);

    const entryClassSource =
      getString(originalEntry.classSource);

    if (
      !entryClassName ||
      !entryClassSource ||
      !sameText(entryClassName, className) ||
      normalizeSource(entryClassSource) !==
        classSource
    ) {
      continue;
    }

    const name =
      getString(originalEntry.name);

    const source =
      getEntrySource(originalEntry);

    if (!name || !source) {
      skipped++;

      warnings.push(
        'Sous-classe avec nom ou source invalide.'
      );

      continue;
    }

    const resolved = resolveSubclassCopy(
      originalEntry,
      subclasses,
      warnings
    );

    if (!resolved) {
      skipped++;
      continue;
    }

    const entry = resolved.entry;

    const shortName =
      getString(entry.shortName) ?? name;

    // Pour une entrée héritée, les références
    // des capacités peuvent appartenir à
    // la version 2014 de la classe.
    //
    // Nous recherchons donc les capacités
    // du véritable propriétaire d'origine.

    const featureOwner =
      resolved.featureOwner;

    const featureClassName =
      getString(featureOwner.className) ??
      className;

    const featureClassSource =
      getString(featureOwner.classSource);

    const featureShortName =
      getString(featureOwner.shortName) ??
      getString(featureOwner.name) ??
      shortName;

    const featureSource =
      getEntrySource(featureOwner);

    if (
      !featureClassSource ||
      !featureSource
    ) {
      skipped++;

      warnings.push(
        `${name} : provenance des capacités ` +
        'introuvable.'
      );

      continue;
    }

    const features = getFeatures(
      links,
      {
        ownerType: 'subclass',
        className: featureClassName,
        classSource:
          normalizeSource(featureClassSource),
        ownerName: featureShortName,
        ownerSource: featureSource
      },
      warnings,
      classSource,
      shortName,
      source
    );

    if (
      !Array.isArray(entry.subclassFeatures) ||
      features.length === 0
    ) {
      skipped++;

      warnings.push(
        `${name} (${source}) : aucune ` +
        'capacité exploitable.'
      );

      continue;
    }

    if (resolved.inherited) {
      warnings.push(
        `${name} (${source}) : capacités ` +
        `héritées de ${featureSource} ` +
        `pour la classe ${featureClassSource}.`
      );
    }

    converted.push({
      id: makeId(
        className,
        classSource,
        shortName,
        source
      ),

      name,
      shortName,
      description: '',
      bookId: source,

      // L'édition des règles est déterminée
      // par l'origine de la sous-classe.
      ruleset: getRuleset(source, entry),

      features,

      importMetadata: {
        ...createMetadata(originalEntry),
        hasUnresolvedCopy: false
      }
    });
  }

  return {
    subclasses: converted,
    skipped
  };
}

// ==========================================
// CONVERSION DES CLASSES
// ==========================================

export function importClasses(
  analysis: ContentParseResult,
  selectedSource = 'XPHB'
): ClassImportResult {
  const result: ClassImportResult = {
    classes: [],
    importedClasses: 0,
    importedSubclasses: 0,
    skippedSubclasses: 0,
    warnings: [],
    errors: []
  };

  if (!analysis.success) {
    result.errors.push(
      "L'analyse du fichier JSON a échoué."
    );

    return result;
  }

  const classGroup = analysis.content.find(
    group => group.category === 'class'
  );

  const subclassGroup = analysis.content.find(
    group => group.category === 'subclass'
  );

  if (!classGroup) {
    result.errors.push(
      'Aucune classe détectée dans le fichier.'
    );

    return result;
  }

  const source =
    normalizeSource(selectedSource);

  const matchingClasses =
    classGroup.entries.filter(
      entry => getEntrySource(entry) === source
    );

  if (matchingClasses.length === 0) {
    result.errors.push(
      `Aucune classe trouvée pour "${source}".`
    );

    return result;
  }

  for (const entry of matchingClasses) {
    const name = getString(entry.name);

    if (!name) {
      result.warnings.push(
        'Classe sans nom ignorée.'
      );

      continue;
    }

    if (isJsonRecord(entry._copy)) {
      result.warnings.push(
        `${name} : héritage de classe _copy ` +
        'non pris en charge.'
      );

      continue;
    }

    const hitDie = getHitDie(entry);

    if (!hitDie) {
      result.warnings.push(
        `${name} : dé de vie invalide.`
      );

      continue;
    }

    const primaryAbilities =
      getPrimaryAbilities(entry);

    if (primaryAbilities.length === 0) {
      result.warnings.push(
        `${name} : caractéristiques ` +
        'principales non renseignées.'
      );
    }

    const savingThrows =
      getSavingThrows(entry);

    const proficiencies =
      getProficiencies(entry);

    const skillChoices =
      getSkillChoices(entry);

    const features = getFeatures(
      analysis.featureLinks,
      {
        ownerType: 'class',
        className: name,
        classSource: source,
        ownerName: name,
        ownerSource: source
      },
      result.warnings
    );

    const subclassLevel = getSubclassLevel(
      entry,
      analysis.featureLinks
    );

    if (subclassLevel === null) {
      result.warnings.push(
        `${name} : niveau de sous-classe ` +
        'introuvable.'
      );

      continue;
    }

    const subclassResult = convertSubclasses(
      entry,
      subclassGroup?.entries ?? [],
      analysis.featureLinks,
      result.warnings
    );

    const characterClass: CharacterClass = {
      id: makeId(name, source),
      name,
      description: '',
      bookId: source,
      ruleset: getRuleset(source, entry),
      hitDie,
      primaryAbilities,
      savingThrows,
      proficiencies,
      skillChoices,
      features,
      subclassLevel,
      subclasses: subclassResult.subclasses,
      importMetadata: createMetadata(entry)
    };

    result.classes.push(characterClass);

    result.importedSubclasses +=
      subclassResult.subclasses.length;

    result.skippedSubclasses +=
      subclassResult.skipped;
  }

  result.importedClasses =
    result.classes.length;

  return result;
}
