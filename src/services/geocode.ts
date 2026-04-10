export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RunQuest',
      },
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}
