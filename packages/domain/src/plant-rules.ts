export const BLOCKLIST: string[] = [
  'Strelitzia nicolai',
  'Strelitzia reginae',
  'Agapanthus praecox',
  "Ophiopogon japonicus 'Nigrescens'",
  'Cordyline australis',
  'Phoenix canariensis',
  'Washingtonia robusta',
  'Washingtonia filifera',
];

export function isBlocklisted(species: string): boolean {
  const lower = species.toLowerCase();
  return BLOCKLIST.some((b) => b.toLowerCase() === lower);
}

export function validateSpecies(
  species: string,
  palette: { species: string }[],
): { valid: boolean; reason?: string } {
  if (isBlocklisted(species)) {
    return { valid: false, reason: 'Blocklisted: outside studio design philosophy' };
  }
  if (!palette.some((p) => p.species.toLowerCase() === species.toLowerCase())) {
    return { valid: false, reason: 'Unknown species: not in approved palette' };
  }
  return { valid: true };
}
