import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [],
            }),
        })
      )
    );
  });

  it('renders the main TripDeck heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TripDeck' })).toBeInTheDocument();
    expect(screen.getByText(/itinerary planner/i)).toBeInTheDocument();
  });
});
