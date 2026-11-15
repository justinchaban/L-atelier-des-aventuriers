
import type {
  ContentCategory,
  ContentImportResult
} from '../models/ContentSource';

import {
  getBookBySourceCode
} from '../data/books';

// ==========================================
// TYPES
// ==========================================

export type JsonRecord = Record<string, unknown>;

export interface DetectedContent {
  category: ContentCategory;
  originalKey: string;
  entries: JsonRecord[];
}

export interface DetectedBook {
  bookId: string | null;
  sourceCode: string;
  bookName: string | null;
  categories: Partial<
    Record<ContentCategory, number>
  >;
  total: number;
}

export interface FeatureLink {
  ownerType: 'class' | 'subclass';
  ownerName: string;
  ownerSource: string;

  className: string;
  classSource: string;

  subclassName?: string;
  subclassSource?: string;

  featureName: string;
  featureSource: string;
  level: number;

  reference: string;
  resolved: boolean;
  feature: JsonRecord | null;
}

export interface ContentParseResult {
  success: boolean;
  filename: string;
  content: DetectedContent[];
  books: DetectedBook[];
  analyzed: number;

  featureLinks: FeatureLink[];
  resolvedFeatures: number;
  unresolvedFeatures: number;

  report: ContentImportResult;
}

// ==========================================
// CORRESPONDANCE DES CATÉGORIES
// ==========================================

const CATEGORY_KEYS: Record<
  string,
  ContentCategory
> = {
  class: 'class',
  subclass: 'subclass',
  classFeature: 'classFeature',
  subclassFeature: 'subclassFeature',
  race: 'species',
  species: 'species',
  background: 'background',
  feat: 'feat',
  spell: 'spell',
  item: 'equipment',
  baseitem: 'equipment',
  itemGroup: 'equipment'
};

// ==========================================
// VALIDATION JSON
// ==========================================

export function isJsonRecord(
  value: unknown
): value is JsonRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function parseJsonText(
  text: string
): unknown {
  return JSON.parse(text) as unknown;
}

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

// ==========================================
// DÉTECTION DES CATÉGORIES
// ==========================================

export function detectContent(
  data: unknown
): DetectedContent[] {
  if (!isJsonRecord(data)) {
    return [];
  }

  const detected: DetectedContent[] = [];

  for (const [key, value] of Object.entries(data)) {
    const category = CATEGORY_KEYS[key];

    if (!category || !Array.isArray(value)) {
      continue;
    }

    detected.push({
      category,
      originalKey: key,
      entries: value.filter(isJsonRecord)
    });
  }

  return detected;
}

// ==========================================
// EXTRACTION DE LA SOURCE
// ==========================================

export function getEntrySource(
  entry: JsonRecord
): string | null {
  const source = getString(entry.source);

  return source
    ? normalizeSource(source)
    : null;
}

// ==========================================
// REGROUPEMENT PAR LIVRE
// ==========================================

export function detectBooks(
  content: DetectedContent[]
): DetectedBook[] {
  const detected = new Map<
    string,
    DetectedBook
  >();

  for (const group of content) {
    for (const entry of group.entries) {
      if (!getString(entry.name)) {
        continue;
      }

      const sourceCode =
        getEntrySource(entry) ?? 'UNKNOWN';

      const book =
        getBookBySourceCode(sourceCode);

      let detectedBook = detected.get(
        sourceCode
      );

      if (!detectedBook) {
        detectedBook = {
          bookId: book?.id ?? null,
          sourceCode,
          bookName: book?.name ?? null,
          categories: {},
          total: 0
        };

        detected.set(
          sourceCode,
          detectedBook
        );
      }

      detectedBook.total += 1;

      detectedBook.categories[
        group.category
      ] =
        (
          detectedBook.categories[
            group.category
          ] ?? 0
        ) + 1;
    }
  }

  return Array.from(
    detected.values()
  ).sort((a, b) =>
    a.sourceCode.localeCompare(
      b.sourceCode
    )
  );
}

// ==========================================
// INDEX DES CAPACITÉS
// ==========================================

function createFeatureKey(
  category: 'classFeature' | 'subclassFeature',
  name: string,
  className: string,
  classSource: string,
  level: number,
  featureSource: string,
  subclassName = '',
  subclassSource = ''
): string {
  return JSON.stringify([
    category,
    name.trim().toLowerCase(),
    className.trim().toLowerCase(),
    normalizeSource(classSource),
    subclassName.trim().toLowerCase(),
    normalizeSource(subclassSource),
    level,
    normalizeSource(featureSource)
  ]);
}

function createFeatureIndex(
  content: DetectedContent[]
): Map<string, JsonRecord[]> {
  const index = new Map<
    string,
    JsonRecord[]
  >();

  for (const group of content) {
    if (
      group.category !== 'classFeature' &&
      group.category !== 'subclassFeature'
    ) {
      continue;
    }

    for (const entry of group.entries) {
      const name = getString(entry.name);
      const className = getString(
        entry.className
      );
      const classSource = getString(
        entry.classSource
      );
      const featureSource = getEntrySource(
        entry
      );

      const level = entry.level;

      if (
        !name ||
        !className ||
        !classSource ||
        !featureSource ||
        typeof level !== 'number' ||
        !Number.isInteger(level)
      ) {
        continue;
      }

      let subclassName = '';
      let subclassSource = '';

      if (
        group.category === 'subclassFeature'
      ) {
        const nameValue = getString(
          entry.subclassShortName
        );

        const sourceValue = getString(
          entry.subclassSource
        );

        if (!nameValue || !sourceValue) {
          continue;
        }

        subclassName = nameValue;
        subclassSource = sourceValue;
      }

      const key = createFeatureKey(
        group.category,
        name,
        className,
        classSource,
        level,
        featureSource,
        subclassName,
        subclassSource
      );

      const matches = index.get(key) ?? [];

      matches.push(entry);
      index.set(key, matches);
    }
  }

  return index;
}

// ==========================================
// EXTRACTION DES RÉFÉRENCES
// ==========================================

function extractReference(
  value: unknown,
  property: 'classFeature' | 'subclassFeature'
): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (!isJsonRecord(value)) {
    return null;
  }

  return getString(value[property]);
}

// ==========================================
// RÉSOLUTION DES CAPACITÉS DE CLASSE
// ==========================================

function resolveClassFeatures(
  entry: JsonRecord,
  index: Map<string, JsonRecord[]>
): FeatureLink[] {
  const className = getString(entry.name);
  const classSource = getEntrySource(entry);

  if (!className || !classSource) {
    return [];
  }

  if (!Array.isArray(entry.classFeatures)) {
    return [];
  }

  const links: FeatureLink[] = [];

  for (const value of entry.classFeatures) {
    const reference = extractReference(
      value,
      'classFeature'
    );

    if (!reference) {
      continue;
    }

    const parts = reference.split('|');

    if (parts.length < 4) {
      continue;
    }

    const featureName = parts[0]?.trim();
    const referencedClass = parts[1]?.trim();

    // Dans certaines références 2014,
    // la source de classe est omise.
    const referencedSource = normalizeSource(
      parts[2]?.trim() || 'PHB'
    );

    const level = Number(parts[3]);

    const featureSource = normalizeSource(
      parts[4]?.trim() || referencedSource
    );

    if (
      !featureName ||
      !referencedClass ||
      !Number.isInteger(level) ||
      level < 1 ||
      level > 20
    ) {
      continue;
    }

    const key = createFeatureKey(
      'classFeature',
      featureName,
      referencedClass,
      referencedSource,
      level,
      featureSource
    );

    const matches = index.get(key) ?? [];

    // On ne considère une référence résolue
    // que si elle correspond à une seule entrée.
    const feature =
      matches.length === 1
        ? matches[0]
        : null;

    links.push({
      ownerType: 'class',
      ownerName: className,
      ownerSource: classSource,

      className: referencedClass,
      classSource: referencedSource,

      featureName,
      featureSource,
      level,

      reference,
      resolved: feature !== null,
      feature
    });
  }

  return links;
}

// ==========================================
// RÉSOLUTION DES CAPACITÉS DE SOUS-CLASSE
// ==========================================

function resolveSubclassFeatures(
  entry: JsonRecord,
  index: Map<string, JsonRecord[]>
): FeatureLink[] {
  const subclassName =
    getString(entry.shortName) ??
    getString(entry.name);

  const subclassSource = getEntrySource(
    entry
  );

  const className = getString(
    entry.className
  );

  const classSource = getString(
    entry.classSource
  );

  if (
    !subclassName ||
    !subclassSource ||
    !className ||
    !classSource
  ) {
    return [];
  }

  if (
    !Array.isArray(entry.subclassFeatures)
  ) {
    return [];
  }

  const links: FeatureLink[] = [];

  for (const value of entry.subclassFeatures) {
    const reference = extractReference(
      value,
      'subclassFeature'
    );

    if (!reference) {
      continue;
    }

    const parts = reference.split('|');

    if (parts.length < 6) {
      continue;
    }

    const featureName = parts[0]?.trim();
    const referencedClass = parts[1]?.trim();

    const referencedClassSource =
      normalizeSource(
        parts[2]?.trim() || 'PHB'
      );

    const referencedSubclass =
      parts[3]?.trim();

    const referencedSubclassSource =
      normalizeSource(
        parts[4]?.trim() || 'PHB'
      );

    const level = Number(parts[5]);

    const featureSource = normalizeSource(
      parts[6]?.trim() ||
      referencedSubclassSource
    );

    if (
      !featureName ||
      !referencedClass ||
      !referencedSubclass ||
      !Number.isInteger(level) ||
      level < 1 ||
      level > 20
    ) {
      continue;
    }

    const key = createFeatureKey(
      'subclassFeature',
      featureName,
      referencedClass,
      referencedClassSource,
      level,
      featureSource,
      referencedSubclass,
      referencedSubclassSource
    );

    const matches = index.get(key) ?? [];

    const feature =
      matches.length === 1
        ? matches[0]
        : null;

    links.push({
      ownerType: 'subclass',
      ownerName: subclassName,
      ownerSource: subclassSource,

      className: referencedClass,
      classSource: referencedClassSource,

      subclassName: referencedSubclass,
      subclassSource: referencedSubclassSource,

      featureName,
      featureSource,
      level,

      reference,
      resolved: feature !== null,
      feature
    });
  }

  return links;
}

// ==========================================
// RÉSOLUTION GLOBALE
// ==========================================

export function resolveFeatureLinks(
  content: DetectedContent[]
): FeatureLink[] {
  const index = createFeatureIndex(content);
  const links: FeatureLink[] = [];

  for (const group of content) {
    if (group.category === 'class') {
      for (const entry of group.entries) {
        links.push(
          ...resolveClassFeatures(
            entry,
            index
          )
        );
      }
    }

    if (group.category === 'subclass') {
      for (const entry of group.entries) {
        links.push(
          ...resolveSubclassFeatures(
            entry,
            index
          )
        );
      }
    }
  }

  return links;
}

// ==========================================
// RAPPORT VIDE
// ==========================================

function createEmptyReport(
  sourceId: string
): ContentImportResult {
  return {
    sourceId,
    imported: 0,
    skipped: 0,
    warnings: [],
    errors: []
  };
}

function createEmptyResult(
  filename: string,
  report: ContentImportResult
): ContentParseResult {
  return {
    success: false,
    filename,
    content: [],
    books: [],
    analyzed: 0,

    featureLinks: [],
    resolvedFeatures: 0,
    unresolvedFeatures: 0,

    report
  };
}

// ==========================================
// ANALYSE DU JSON
// ==========================================

export function analyzeContentJson(
  text: string,
  filename: string,
  sourceId: string
): ContentParseResult {
  const report = createEmptyReport(
    sourceId
  );

  let data: unknown;

  try {
    data = parseJsonText(text);
  } catch {
    report.errors.push(
      'Le fichier ne contient pas un JSON valide.'
    );

    return createEmptyResult(
      filename,
      report
    );
  }

  if (!isJsonRecord(data)) {
    report.errors.push(
      'La racine du fichier JSON doit être un objet.'
    );

    return createEmptyResult(
      filename,
      report
    );
  }

  const content = detectContent(data);

  if (content.length === 0) {
    report.warnings.push(
      'Aucune catégorie de contenu reconnue.'
    );
  }

  let analyzed = 0;

  // ----------------------------------------
  // VALIDATION DES ENTRÉES
  // ----------------------------------------

  for (const group of content) {
    if (group.entries.length === 0) {
      report.warnings.push(
        `La catégorie "${group.originalKey}" est vide.`
      );
    }

    for (const entry of group.entries) {
      if (!getString(entry.name)) {
        report.skipped += 1;

        report.warnings.push(
          `Une entrée de "${group.originalKey}" ` +
          'ne possède pas de nom valide.'
        );

        continue;
      }

      analyzed += 1;
    }
  }

  // ----------------------------------------
  // IDENTIFICATION DES LIVRES
  // ----------------------------------------

  const books = detectBooks(content);

  for (const book of books) {
    if (book.sourceCode === 'UNKNOWN') {
      report.warnings.push(
        `${book.total} entrée(s) ne possèdent ` +
        'pas de source identifiable.'
      );

      continue;
    }

    if (!book.bookId) {
      report.warnings.push(
        `Source inconnue : "${book.sourceCode}" ` +
        `(${book.total} entrée(s)).`
      );
    }
  }

  // ----------------------------------------
  // RÉSOLUTION DES RÉFÉRENCES
  // ----------------------------------------

  const featureLinks = resolveFeatureLinks(
    content
  );

  const resolvedFeatures =
    featureLinks.filter(
      link => link.resolved
    ).length;

  const unresolvedFeatures =
    featureLinks.length - resolvedFeatures;

  if (unresolvedFeatures > 0) {
    report.warnings.push(
      `${unresolvedFeatures} référence(s) ` +
      'de capacités non résolue(s). ' +
      'Certaines définitions peuvent être ' +
      'absentes, héritées ou ambiguës.'
    );
  }

  return {
    success: report.errors.length === 0,
    filename,
    content,
    books,
    analyzed,

    featureLinks,
    resolvedFeatures,
    unresolvedFeatures,

    report
  };
}

// ==========================================
// LECTURE D'UN FICHIER LOCAL
// ==========================================

export async function readContentFile(
  file: File,
  sourceId: string
): Promise<ContentParseResult> {
  try {
    const text = await file.text();

    return analyzeContentJson(
      text,
      file.name,
      sourceId
    );
  } catch {
    const report = createEmptyReport(
      sourceId
    );

    report.errors.push(
      'Impossible de lire le fichier sélectionné.'
    );

    return createEmptyResult(
      file.name,
      report
    );
  }
}
