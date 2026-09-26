/** Pick the best stand-in photo for an offer: its destination first, then its category. */
export function pickPhoto(photos: Partial<Record<string, string>> | undefined, category: string, destination?: string | null): string | null {
  if (!photos) return null;
  const d = destination?.trim().toLowerCase();
  return (d && photos[d]) || photos[category] || null;
}
