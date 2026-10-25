type Meal = { quantity: number; servingMultiplier: number; food: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number } };
export function mealTotals(entries: readonly Meal[]) {
  const sum = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  for (const e of entries) for (const key of Object.keys(sum) as Array<keyof typeof sum>) sum[key] += e.food[key] * e.quantity * e.servingMultiplier;
  return sum;
}
