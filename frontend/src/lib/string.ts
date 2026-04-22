export function truncateMiddle(value: string, maxChars: number): string {
  if (maxChars <= 3 || value.length <= maxChars) return value;
  const keep = maxChars - 3;
  const left = Math.ceil(keep / 2);
  const right = Math.floor(keep / 2);
  return `${value.slice(0, left)}...${value.slice(value.length - right)}`;
}
