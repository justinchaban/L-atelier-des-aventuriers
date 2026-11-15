import { normalizeBookId } from '../data/books';

import type { Campaign } from '../models/Campaign';

export interface SourceContent {
  id: string;
  bookId: string;
}

export function isContentAllowed(
  content: SourceContent,
  campaign: Campaign
): boolean {
  return isBookAllowed(content.bookId, campaign.allowedBooks);
}

/** Vérifie une autorisation explicite, sans supposer le contenu disponible. */
export function isBookAllowed(bookId: string, allowedBooks: readonly string[]): boolean {
  const canonicalId = normalizeBookId(bookId);
  return canonicalId !== '' && allowedBooks.some(id => normalizeBookId(id) === canonicalId);
}
