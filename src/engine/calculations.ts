export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
export function proficiencyBonus(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new RangeError('Niveau attendu : 1 à 20');
  return 2 + Math.floor((level - 1) / 4);
}
export function pointBuyCost(score: number): number {
  const costs: Record<number, number> = {8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
  if (!(score in costs)) throw new RangeError('Achat de points : score de 8 à 15');
  return costs[score];
}
