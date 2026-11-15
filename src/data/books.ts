
export interface Book {
  id: string;
  name: string;
  ruleset: '2014' | '2024';
  category: 'core' | 'supplement' | 'srd';
  integrated: boolean;
}

export const books: Book[] = [
  // ========================================
  // SRD
  // ========================================

  {
    id: 'XSRD',
    name: 'SRD 5.2.1',
    ruleset: '2024',
    category: 'srd',
    integrated: false
  },

  // ========================================
  // LIVRES PRINCIPAUX 2024
  // ========================================

  {
    id: 'XPHB',
    name: 'Manuel des Joueurs (2024)',
    ruleset: '2024',
    category: 'core',
    integrated: false
  },
  {
    id: 'XDMG',
    name: 'Guide du Maître (2024)',
    ruleset: '2024',
    category: 'core',
    integrated: false
  },
  {
    id: 'XMM',
    name: 'Manuel des Monstres (2024)',
    ruleset: '2024',
    category: 'core',
    integrated: false
  },

  // ========================================
  // LIVRES PRINCIPAUX 2014
  // ========================================

  {
    id: 'PHB',
    name: 'Manuel des Joueurs (2014)',
    ruleset: '2014',
    category: 'core',
    integrated: false
  },
  {
    id: 'DMG',
    name: 'Guide du Maître (2014)',
    ruleset: '2014',
    category: 'core',
    integrated: false
  },
  {
    id: 'MM',
    name: 'Manuel des Monstres (2014)',
    ruleset: '2014',
    category: 'core',
    integrated: false
  },

  // ========================================
  // SUPPLÉMENTS 2014
  // ========================================

  {
    id: 'XGE',
    name: 'Guide complet de Xanathar',
    ruleset: '2014',
    category: 'supplement',
    integrated: false
  },
  {
    id: 'TCE',
    name: 'Chaudron des merveilles de Tasha',
    ruleset: '2014',
    category: 'supplement',
    integrated: false
  },
  {
    id: 'VRGR',
    name: 'Guide de Van Richten sur Ravenloft',
    ruleset: '2014',
    category: 'supplement',
    integrated: false
  },
  {
    id: 'SCAG',
    name: 'Guide des aventuriers de la Côte des Épées',
    ruleset: '2014',
    category: 'supplement',
    integrated: false
  },
  {
    id: 'EGW',
    name: "Guide de l'explorateur de Wildemount",
    ruleset: '2014',
    category: 'supplement',
    integrated: false
  },

  // ========================================
  // SUPPLÉMENTS 2024
  // ========================================

  {
    id: 'FRHoF',
    name: 'Forgotten Realms: Heroes of Faerûn',
    ruleset: '2024',
    category: 'supplement',
    integrated: false
  },
  {
    id: 'AU',
    name: 'Arcana Unleashed',
    ruleset: '2024',
    category: 'supplement',
    integrated: false
  }
];

// ==========================================
// ANCIENS IDENTIFIANTS
// ==========================================

const legacyBookIds: Record<string, string> = {
  'srd-5.2.1': 'XSRD',
  'phb-2024': 'XPHB',
  'xge-2017': 'XGE',
  'tce-2020': 'TCE'
};

// ==========================================
// NORMALISATION
// ==========================================

export function normalizeBookId(
  id: string
): string {
  const trimmed = id.trim();

  const legacyId =
    legacyBookIds[trimmed.toLowerCase()];

  if (legacyId) {
    return legacyId;
  }

  return trimmed.toUpperCase();
}

// ==========================================
// RECHERCHE
// ==========================================

export function getBookById(
  id: string
): Book | undefined {
  const normalizedId = normalizeBookId(id);

  return books.find(
    book => book.id.toUpperCase() === normalizedId
  );
}

export function getBookBySourceCode(
  sourceCode: string
): Book | undefined {
  return getBookById(sourceCode);
}

export function getBookIdFromSource(
  sourceCode: string
): string | null {
  return getBookBySourceCode(sourceCode)?.id ?? null;
}
