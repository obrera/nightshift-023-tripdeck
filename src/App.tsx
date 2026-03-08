import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { CityOption, ForecastDay, ItineraryItem } from './types';

const CITY_STORAGE_KEY = 'tripdeck:selected-city';
const ITINERARY_STORAGE_KEY = 'tripdeck:itinerary';

const WEATHER_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Heavy showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe hail storm',
};

const initialForm = {
  title: '',
  day: '',
  time: '',
  notes: '',
};

function parseStoredCity(): CityOption | null {
  const raw = localStorage.getItem(CITY_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CityOption;
  } catch {
    return null;
  }
}

function parseStoredItinerary(): ItineraryItem[] {
  const raw = localStorage.getItem(ITINERARY_STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as ItineraryItem[];
  } catch {
    return [];
  }
}

function weatherIcon(code: number): string {
  if (code === 0) return '☀';
  if ([1, 2].includes(code)) return '⛅';
  if ([3, 45, 48].includes(code)) return '☁';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄';
  if ([95, 96, 99].includes(code)) return '⛈';
  return '•';
}

function buildPackingList(forecast: ForecastDay[]): string[] {
  if (!forecast.length) return [];

  const suggestions = new Set<string>([
    'Phone charger',
    'Reusable water bottle',
    'Comfortable walking shoes',
  ]);

  const coldest = Math.min(...forecast.map((day) => day.tempMin));
  const hottest = Math.max(...forecast.map((day) => day.tempMax));
  const wettest = Math.max(...forecast.map((day) => day.precipitationProbability));
  const windiest = Math.max(...forecast.map((day) => day.windSpeed));
  const snowy = forecast.some((day) => [71, 73, 75, 77, 85, 86].includes(day.weatherCode));
  const stormy = forecast.some((day) => day.weatherCode >= 95);

  if (coldest < 8) suggestions.add('Warm layers');
  if (coldest < 0) suggestions.add('Gloves and a beanie');
  if (hottest > 26) suggestions.add('Sunscreen');
  if (hottest > 28) suggestions.add('Breathable outfits');
  if (wettest >= 40) suggestions.add('Compact umbrella');
  if (wettest >= 60) suggestions.add('Water-resistant jacket');
  if (windiest > 25) suggestions.add('Windbreaker');
  if (snowy) suggestions.add('Insulated boots');
  if (stormy) suggestions.add('Backup indoor plan');

  return Array.from(suggestions);
}

function toDisplayDate(value: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date(`${value}T12:00:00`));
}

function todayInputValue(timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityOption[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setSelectedCity(parseStoredCity());
    setItinerary(parseStoredItinerary());
  }, []);

  useEffect(() => {
    if (!selectedCity) return;
    localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(selectedCity));
  }, [selectedCity]);

  useEffect(() => {
    localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(itinerary));
  }, [itinerary]);

  useEffect(() => {
    if (selectedCity && !form.day) {
      setForm((current) => ({ ...current, day: todayInputValue(selectedCity.timezone) }));
    }
  }, [selectedCity, form.day]);

  useEffect(() => {
    const selectedLabel = selectedCity
      ? [selectedCity.name, selectedCity.admin1, selectedCity.country].filter(Boolean).join(', ')
      : '';

    if (!query.trim() || (selectedLabel && query === selectedLabel)) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setSearching(true);
        setSearchError(null);
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=7&language=en&format=json`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Geocoding request failed with status ${response.status}`);
        }

        const data = (await response.json()) as {
          results?: Array<{
            id: number;
            name: string;
            country: string;
            admin1?: string;
            latitude: number;
            longitude: number;
            timezone: string;
          }>;
        };

        const normalized = (data.results ?? []).map((city) => ({
          id: city.id,
          name: city.name,
          country: city.country,
          admin1: city.admin1,
          latitude: city.latitude,
          longitude: city.longitude,
          timezone: city.timezone,
        }));

        setResults(normalized);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSearchError('Unable to load city suggestions right now.');
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query, selectedCity]);

  useEffect(() => {
    if (!selectedCity) {
      setForecast([]);
      return;
    }

    const controller = new AbortController();

    async function loadForecast() {
      try {
        setForecastLoading(true);
        setForecastError(null);
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${selectedCity.latitude}&longitude=${selectedCity.longitude}&timezone=${encodeURIComponent(selectedCity.timezone)}&forecast_days=7&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Forecast request failed with status ${response.status}`);
        }

        const data = (await response.json()) as {
          daily: {
            time: string[];
            weather_code: number[];
            temperature_2m_max: number[];
            temperature_2m_min: number[];
            precipitation_probability_max: number[];
            wind_speed_10m_max: number[];
          };
        };

        const days = data.daily.time.map((date, index) => ({
          date,
          weatherCode: data.daily.weather_code[index],
          tempMax: data.daily.temperature_2m_max[index],
          tempMin: data.daily.temperature_2m_min[index],
          precipitationProbability: data.daily.precipitation_probability_max[index],
          windSpeed: data.daily.wind_speed_10m_max[index],
        }));

        setForecast(days);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setForecastError('Unable to load the forecast right now.');
      } finally {
        setForecastLoading(false);
      }
    }

    void loadForecast();

    return () => controller.abort();
  }, [selectedCity]);

  const packingList = useMemo(() => buildPackingList(forecast), [forecast]);

  function selectCity(city: CityOption) {
    setSelectedCity(city);
    setQuery([city.name, city.admin1, city.country].filter(Boolean).join(', '));
    setResults([]);
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      ...initialForm,
      day: selectedCity ? todayInputValue(selectedCity.timezone) : '',
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || !form.day || !form.time) return;

    if (editingId) {
      setItinerary((current) =>
        current.map((item) =>
          item.id === editingId
            ? { ...item, title: form.title.trim(), day: form.day, time: form.time, notes: form.notes.trim() }
            : item
        )
      );
      resetForm();
      return;
    }

    const item: ItineraryItem = {
      id: crypto.randomUUID(),
      title: form.title.trim(),
      day: form.day,
      time: form.time,
      notes: form.notes.trim(),
    };

    setItinerary((current) => [...current, item]);
    resetForm();
  }

  function startEdit(item: ItineraryItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      day: item.day,
      time: item.time,
      notes: item.notes,
    });
  }

  function removeItem(id: string) {
    setItinerary((current) => current.filter((item) => item.id !== id));
    if (editingId === id) resetForm();
  }

  function moveItem(id: string, direction: -1 | 1) {
    setItinerary((current) => {
      const items = [...current];
      const index = items.findIndex((item) => item.id === id);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= items.length) {
        return current;
      }

      [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
      return items;
    });
  }

  const cityLabel = selectedCity
    ? [selectedCity.name, selectedCity.admin1, selectedCity.country].filter(Boolean).join(', ')
    : 'Pick a city to start planning';

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <span className="eyebrow">Nightshift Build 023</span>
          <h1>TripDeck</h1>
          <p className="hero-copy">
            Search a city, compare the next seven days, shape an itinerary, and auto-pack for the forecast.
          </p>
        </div>
        <div className="hero-card">
          <p className="hero-card-label">Current destination</p>
          <h2>{cityLabel}</h2>
          <p>{selectedCity ? `Timezone: ${selectedCity.timezone}` : 'Geocoding and forecast data are powered by Open-Meteo.'}</p>
        </div>
      </header>

      <main className="grid">
        <section className="panel search-panel">
          <div className="panel-heading">
            <div>
              <span className="section-tag">Capability 1</span>
              <h2>City Search</h2>
            </div>
            {searching ? <span className="status-pill">Searching…</span> : null}
          </div>

          <label className="field">
            <span>Search by city name</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try Lisbon, Seoul, or Buenos Aires"
              aria-label="Search for a city"
            />
          </label>

          {searchError ? <p className="error-text">{searchError}</p> : null}

          <div className="search-results" role="listbox" aria-label="City suggestions">
            {results.map((city) => {
              const label = [city.name, city.admin1, city.country].filter(Boolean).join(', ');
              return (
                <button
                  key={city.id}
                  className="result-button"
                  type="button"
                  onClick={() => selectCity(city)}
                >
                  <span>{label}</span>
                  <small>
                    {city.latitude.toFixed(2)}, {city.longitude.toFixed(2)}
                  </small>
                </button>
              );
            })}
            {!results.length && query.trim() && !searching && !searchError ? (
              <p className="muted-text">No matching cities found.</p>
            ) : null}
          </div>
        </section>

        <section className="panel forecast-panel">
          <div className="panel-heading">
            <div>
              <span className="section-tag">Capability 2</span>
              <h2>Forecast</h2>
            </div>
            {forecastLoading ? <span className="status-pill">Refreshing…</span> : null}
          </div>

          {selectedCity ? (
            <>
              {forecastError ? <p className="error-text">{forecastError}</p> : null}
              <div className="forecast-grid">
                {forecast.map((day) => (
                  <article className="forecast-card" key={day.date}>
                    <p className="forecast-date">{toDisplayDate(day.date, selectedCity.timezone)}</p>
                    <div className="forecast-icon" aria-hidden="true">
                      {weatherIcon(day.weatherCode)}
                    </div>
                    <h3>{WEATHER_LABELS[day.weatherCode] ?? 'Conditions pending'}</h3>
                    <p className="temp-range">
                      {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
                    </p>
                    <dl className="metrics">
                      <div>
                        <dt>Rain</dt>
                        <dd>{day.precipitationProbability}%</dd>
                      </div>
                      <div>
                        <dt>Wind</dt>
                        <dd>{Math.round(day.windSpeed)} km/h</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">Select a city to unlock the seven-day forecast.</p>
          )}
        </section>

        <section className="panel itinerary-panel">
          <div className="panel-heading">
            <div>
              <span className="section-tag">Capability 3</span>
              <h2>Itinerary Planner</h2>
            </div>
            <span className="status-pill">{itinerary.length} item(s)</span>
          </div>

          <form className="itinerary-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Sunrise food tour"
                required
              />
            </label>

            <div className="split-fields">
              <label className="field">
                <span>Day</span>
                <input
                  type="date"
                  value={form.day}
                  onChange={(event) => setForm((current) => ({ ...current, day: event.target.value }))}
                  required
                />
              </label>

              <label className="field">
                <span>Time</span>
                <input
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                  required
                />
              </label>
            </div>

            <label className="field">
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Tickets booked, meeting point, backup plan..."
                rows={3}
              />
            </label>

            <div className="form-actions">
              <button className="primary-button" type="submit">
                {editingId ? 'Save changes' : 'Add item'}
              </button>
              <button className="ghost-button" type="button" onClick={resetForm}>
                Reset
              </button>
            </div>
          </form>

          <div className="itinerary-list">
            {itinerary.map((item, index) => (
              <article className="itinerary-card" key={item.id}>
                <div>
                  <p className="itinerary-time">
                    {toDisplayDate(item.day, selectedCity?.timezone)} at {item.time}
                  </p>
                  <h3>{item.title}</h3>
                  <p>{item.notes || 'No notes yet.'}</p>
                </div>
                <div className="item-actions">
                  <button type="button" className="mini-button" onClick={() => moveItem(item.id, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => moveItem(item.id, 1)}
                    disabled={index === itinerary.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" className="mini-button" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button type="button" className="mini-button danger" onClick={() => removeItem(item.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {!itinerary.length ? (
              <p className="empty-state">No itinerary items yet. Add a few anchors for your trip.</p>
            ) : null}
          </div>
        </section>

        <section className="panel packing-panel">
          <div className="panel-heading">
            <div>
              <span className="section-tag">Bonus</span>
              <h2>Smart Packing</h2>
            </div>
          </div>

          {packingList.length ? (
            <ul className="packing-list">
              {packingList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Forecast-aware packing suggestions appear once a destination is selected.</p>
          )}
        </section>
      </main>
    </div>
  );
}
