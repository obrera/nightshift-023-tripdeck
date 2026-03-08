export type CityOption = {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type ForecastDay = {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  windSpeed: number;
};

export type ItineraryItem = {
  id: string;
  title: string;
  day: string;
  time: string;
  notes: string;
};
