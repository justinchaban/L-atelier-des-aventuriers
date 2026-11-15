
export function getFightingStyleCount(
  classId: string,
  subclassId: string,
  level: number
): number {
  if (classId !== 'fighter-2024' || level < 1) {
    return 0;
  }

  let count = 1;

  if (
    subclassId === 'champion-2024' &&
    level >= 7
  ) {
    count += 1;
  }

  return count;
}


import { fightingStyleChoice } from '../data/fightingStyles';

export function validateFightingStyles(
  classId: string,
  subclassId: string,
  level: number,
  selectedIds: string[]
): string[] {
  const maximum = getFightingStyleCount(
    classId,
    subclassId,
    level
  );

  const allowedIds = new Set(
    fightingStyleChoice.options.map(option => option.id)
  );

  return [...new Set(selectedIds)]
    .filter(id => allowedIds.has(id))
    .slice(0, maximum);
}
