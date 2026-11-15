
export type ContentProvider =
  | 'srd'
  | '5etools'
  | 'homebrew'
  | 'custom';

// ==========================================
// ÉDITIONS DES RÈGLES
// ==========================================

export type RulesEdition =
  | '2014'
  | '2024';

// ==========================================
// CATÉGORIES DE CONTENU
// ==========================================

export type ContentCategory =
  | 'class'
  | 'subclass'
  | 'classFeature'
  | 'subclassFeature'
  | 'species'
  | 'background'
  | 'feat'
  | 'spell'
  | 'equipment';

// ==========================================
// SOURCE DE CONTENU
// ==========================================

export interface ContentSource {
  id: string;
  name: string;
  abbreviation: string;

  provider: ContentProvider;
  edition: RulesEdition;

  description?: string;

  enabled: boolean;
}

// ==========================================
// RÉFÉRENCE VERS UN CONTENU
// ==========================================

export interface ContentReference {
  sourceId: string;
  category: ContentCategory;

  originalName: string;
  originalSource: string;

  internalId: string;
}

// ==========================================
// RAPPORT D'IMPORTATION
// ==========================================

export interface ContentImportResult {
  sourceId: string;

  imported: number;
  skipped: number;

  warnings: string[];
  errors: string[];
}
