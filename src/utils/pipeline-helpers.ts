export function getDocsBarColor(percent: number): string {
  if (percent >= 75) return '#6ABF4B';
  if (percent >= 50) return '#D4A017';
  return '#DC0202';
}
