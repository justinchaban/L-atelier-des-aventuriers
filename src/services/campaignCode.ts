
import { normalizeBookIds } from '../data/books';
import type { Campaign } from '../models/Campaign';

const PREFIX = 'LADA1:';

export function generateCampaignCode(campaign: Campaign): string {
  const data = {
    version: 1,
    name: campaign.name,
    allowedBooks: normalizeBookIds(campaign.allowedBooks)
  };

  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return PREFIX + btoa(binary);
}

export function importCampaignCode(code: string): Campaign {
  if (!code.trim().startsWith(PREFIX)) {
    throw new Error('Code de campagne non reconnu.');
  }

  try {
    const encoded = code.trim().slice(PREFIX.length);
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));

    if (typeof data !== 'object' || data === null) {
      throw new Error('Données invalides.');
    }

    const value = data as Record<string, unknown>;

    if (
      value.version !== 1 ||
      typeof value.name !== 'string' ||
      !Array.isArray(value.allowedBooks) ||
      !value.allowedBooks.every(
        (id: unknown) =>
          typeof id === 'string' && id.trim().length > 0
      )
    ) {
      throw new Error('Paramètres de campagne invalides.');
    }

    return {
      id: crypto.randomUUID(),
      name: value.name,
      allowedBooks: normalizeBookIds(value.allowedBooks as string[]),
      createdAt: new Date().toISOString()
    };
  } catch {
    throw new Error('Impossible de lire ce code de campagne.');
  }
}
