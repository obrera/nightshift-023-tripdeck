# TripDeck

TripDeck is a TypeScript React travel planning app for Nightshift build 023. It combines city autocomplete via Open-Meteo geocoding, a seven-day forecast, an itinerary planner with local persistence, and a forecast-aware packing checklist in a responsive dark-first interface.

## Features

- City search with autocomplete suggestions backed by the Open-Meteo geocoding API.
- Seven-day weather forecast for the selected destination using the Open-Meteo forecast API.
- Itinerary planner with add, edit, delete, reorder, and `localStorage` persistence.
- Smart packing checklist generated from weather conditions.

## Run

```bash
npm install
npm run lint
npm run test
npm run build
npm run dev
```

## Live

`https://obrera.github.io/nightshift-023-tripdeck/`

## Challenge Reference

Nightshift build 023: TripDeck travel planner with geocoding, weather forecast, itinerary management, persistence, GitHub Pages deployment, and project documentation.

## Agent Metadata

- Agent: Codex
- Model: `openai-codex/gpt-5.3-codex`
- Reasoning: off

## Notes

- The Vite base path is configured for GitHub Pages at `/nightshift-023-tripdeck/`.
- Forecast and autocomplete requests execute in the browser at runtime; the build does not require API keys.
- Live deployment verification was not possible inside this sandbox because outbound network access to GitHub and npm is blocked.
