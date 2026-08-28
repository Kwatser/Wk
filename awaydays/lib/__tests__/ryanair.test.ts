import { describe, it, expect } from 'vitest';
import { monthsBetween } from '../sources/ryanair';

describe('monthsBetween', () => {
  it('geeft één maand bij een bereik binnen die maand', () => {
    expect(monthsBetween('2026-09-08', '2026-09-10')).toEqual([
      { year: 2026, month: 9, iso: '2026-09-01' },
    ]);
  });

  it('loopt correct over de jaargrens', () => {
    expect(monthsBetween('2026-12-08', '2027-01-27').map((m) => m.iso)).toEqual([
      '2026-12-01', '2027-01-01',
    ]);
  });

  it('dekt alle maanden van de kandidaatdatums in één keer', () => {
    // Speelronde 1 tot en met 8: september 2026 tot en met januari 2027.
    expect(monthsBetween('2026-09-08', '2027-01-27')).toHaveLength(5);
  });
});
