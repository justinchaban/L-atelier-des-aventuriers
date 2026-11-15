import { isBookAllowed } from './restrictions';
import { weapons } from '../data/weapons';

export function getWeaponMasteryCount(
  classId: string,
  level: number
): number {
  if (classId !== 'fighter-2024') {
    return 0;
  }

  if (level >= 10) {
    return 5;
  }

  if (level >= 4) {
    return 4;
  }

  if (level >= 1) {
    return 3;
  }

  return 0;
}


export function validateWeaponMasteries(
  classId: string,
  level: number,
  selectedIds: string[],
  allowedBooks: string[]
): string[] {
  const maximum = getWeaponMasteryCount(classId, level);

  const availableIds = new Set(
    weapons
      .filter(weapon =>
        isBookAllowed(weapon.bookId, allowedBooks)
      )
      .map(weapon => weapon.id)
  );

  const validIds: string[] = [];

  for (const id of selectedIds) {
    if (!availableIds.has(id)) {
      continue;
    }

    if (validIds.includes(id)) {
      continue;
    }

    if (validIds.length >= maximum) {
      break;
    }

    validIds.push(id);
  }

  return validIds;
}
