import { describe, it, expect } from 'vitest';
import { addDays, zonedTimeToUtc, kickoffInstant, formatInZone } from '../time';

describe('addDays', () => {
  // C5 uit de review: de oude versie ging via toISOString op een lokale datum en
  // kon daardoor een dag verspringen. Deze rekent op componenten in UTC.
  it('gaat correct over een jaargrens', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('gaat correct over een maandgrens in een schrikkeljaar', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('verspringt niet, ongeacht de lokale tijdzone van de machine', () => {
    // De retourdatum van elke trip hangt hieraan.
    expect(addDays('2026-09-08', 1)).toBe('2026-09-09');
    expect(addDays('2027-01-27', 1)).toBe('2027-01-28');
  });
});

describe('zonedTimeToUtc', () => {
  it('rekent zomertijd goed om (CEST = UTC+2)', () => {
    expect(zonedTimeToUtc('2026-09-08', '21:00', 'Europe/Amsterdam').toISOString())
      .toBe('2026-09-08T19:00:00.000Z');
  });

  it('rekent wintertijd goed om (CET = UTC+1)', () => {
    // Speelronde 8 valt na de klokwissel; dit is precies de fout van een uur
    // die risico R10 beschrijft.
    expect(zonedTimeToUtc('2027-01-27', '21:00', 'Europe/Amsterdam').toISOString())
      .toBe('2027-01-27T20:00:00.000Z');
  });

  it('rekent Portugese tijd goed om (WEST = UTC+1 in september)', () => {
    expect(zonedTimeToUtc('2026-09-08', '20:00', 'Europe/Lisbon').toISOString())
      .toBe('2026-09-08T19:00:00.000Z');
  });
});

describe('kickoffInstant', () => {
  it('aftrap 21:00 CET is in Porto 20:00 op de klok', () => {
    const k = kickoffInstant('2026-09-08', '21:00');
    expect(formatInZone(k, 'Europe/Lisbon')).toBe('20:00');
  });

  it('aftrap 21:00 CET is in Madrid ook 21:00 op de klok', () => {
    const k = kickoffInstant('2026-09-08', '21:00');
    expect(formatInZone(k, 'Europe/Madrid')).toBe('21:00');
  });

  it('houdt het uur verschil met Porto ook in het winterschema', () => {
    const k = kickoffInstant('2027-01-27', '21:00');
    expect(formatInZone(k, 'Europe/Lisbon')).toBe('20:00');
    expect(formatInZone(k, 'Europe/Madrid')).toBe('21:00');
  });
});
