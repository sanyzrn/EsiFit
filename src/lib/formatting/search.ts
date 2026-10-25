/** Common Persian/Arabic keyboard variants and half-spaces. */
export function normalizePersianSearch(value: string): string {
  return value.replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[\u200c\u200d\s]+/g," ").trim().toLocaleLowerCase("fa");
}
