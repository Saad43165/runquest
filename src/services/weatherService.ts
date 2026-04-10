export interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  uvIndex: number;
  hourly: HourlyForecast[];
  locationName?: string;
}

export interface HourlyForecast {
  time: string;      // "14:00"
  temperature: number;
  icon: string;
  condition: string;
}

function getWeatherCondition(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: 'Clear Sky', icon: 'sunny-outline' };
  if (code <= 3) return { condition: 'Partly Cloudy', icon: 'partly-sunny-outline' };
  if (code <= 48) return { condition: 'Foggy', icon: 'cloud-outline' };
  if (code <= 67) return { condition: 'Rainy', icon: 'rainy-outline' };
  if (code <= 82) return { condition: 'Snowy', icon: 'snow-outline' };
  if (code >= 95) return { condition: 'Thunderstorm', icon: 'thunderstorm-outline' };
  return { condition: 'Cloudy', icon: 'cloudy-outline' };
}

export async function fetchLocalWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=temperature_2m,weathercode,relativehumidity_2m,windspeed_10m,apparent_temperature,uv_index&forecast_days=2&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const cw = data.current_weather;
    if (!cw) return null;

    const { condition, icon } = getWeatherCondition(cw.weathercode);

    // Find current hour index
    const now = new Date();
    const currentHour = now.getHours();
    const times: string[] = data.hourly?.time ?? [];
    const currentIdx = times.findIndex((t: string) => {
      const h = new Date(t).getHours();
      return h === currentHour;
    });
    const idx = currentIdx >= 0 ? currentIdx : 0;

    const temps: number[] = data.hourly?.temperature_2m ?? [];
    const codes: number[] = data.hourly?.weathercode ?? [];
    const humidity: number[] = data.hourly?.relativehumidity_2m ?? [];
    const wind: number[] = data.hourly?.windspeed_10m ?? [];
    const feelsLike: number[] = data.hourly?.apparent_temperature ?? [];
    const uv: number[] = data.hourly?.uv_index ?? [];

    // Build 6-hour forecast starting from current hour
    const hourly: HourlyForecast[] = [];
    for (let i = 0; i < 6; i++) {
      const hi = idx + i;
      if (hi >= times.length) break;
      const t = new Date(times[hi]);
      const wc = getWeatherCondition(codes[hi] ?? 0);
      hourly.push({
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        temperature: Math.round(temps[hi] ?? cw.temperature),
        icon: wc.icon,
        condition: wc.condition,
      });
    }

    return {
      temperature: Math.round(cw.temperature),
      condition,
      icon,
      humidity: Math.round(humidity[idx] ?? 0),
      windSpeed: Math.round(wind[idx] ?? 0),
      feelsLike: Math.round(feelsLike[idx] ?? cw.temperature),
      uvIndex: Math.round(uv[idx] ?? 0),
      hourly,
    };
  } catch (e) {
    console.warn('Weather fetch failed:', e);
    return null;
  }
}
