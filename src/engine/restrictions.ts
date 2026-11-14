
import type { Campaign } from '../models/Campaign';

export interface SourceContent {
  id: string;
  bookId: string;
}

export function isContentAllowed(
  content: SourceContent,
  campaign: Campaign
): boolean {
  return campaign.allowedBooks.includes(content.bookId);
}
