export function calculateExpiry(sct: string, st: number): string {
  return new Date(
    new Date(sct).getTime() + st * 1000
  ).toISOString();
}

export function isExpired(sct: string, st: number): boolean {
  return Date.now() > new Date(sct).getTime() + st * 1000;
}
