import type { Character } from '../models/Character';
const KEY = 'atelier-aventuriers:characters:v1';
export function loadCharacters(): Character[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Character =>
      item !== null && typeof item === 'object' && item.schemaVersion === 1 &&
      typeof item.id === 'string' && typeof item.name === 'string' &&
      Number.isInteger(item.level) && item.level >= 1 && item.level <= 20 &&
      item.abilities !== null && typeof item.abilities === 'object' &&
      ['str','dex','con','int','wis','cha'].every(k => Number.isInteger(item.abilities[k]) && item.abilities[k] >= 1 && item.abilities[k] <= 30) &&
      item.gameState !== null && typeof item.gameState === 'object'
    );
  } catch { return []; }
}
export function saveCharacters(characters: Character[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(characters)); return true; }
  catch { return false; }
}
