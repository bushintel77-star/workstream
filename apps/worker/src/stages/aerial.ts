export async function fetchAerial(
  lat: number,
  lng: number,
  zoom?: number,
): Promise<{ uri: string }> {
  return { uri: `https://placeholder.aerial/${lat},${lng}?z=${zoom ?? 18}` };
}
