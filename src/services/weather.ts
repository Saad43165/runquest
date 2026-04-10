export type Weather = { temperature: number; windspeed: number } | null;

export async function getCurrentWeather(lat: number, lon: number): Promise<Weather> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      console.warn(`Weather API failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const cw = data?.current_weather;

    if (!cw || typeof cw.temperature !== 'number') {
      return null;
    }

    return {
      temperature: cw.temperature,
      windspeed: cw.windspeed ?? 0,
    };
  } catch (err) {
    console.warn('Failed to fetch weather:', err);
    return null;
  }
}
