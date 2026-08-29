import { describe, it, expect } from 'vitest';
import { judge, judgeNightBefore } from '../feasibility';
import type { Offer } from '../types';

function offer(arriveUtc: string, over: Partial<Offer> = {}): Offer {
  return {
    from: 'CRL', to: 'OPO', outboundDate: '2026-09-08',
    departUtc: '2026-09-08T05:45:00.000Z', arriveUtc,
    carrier: 'FR', stops: 0, baseFare: 40, currency: 'EUR',
    seatsLeft: null, source: 'ryanair', fetchedAt: '2026-08-28T12:00:00.000Z',
    schemaVersion: 1, ...over,
  };
}

// Aftrap 21:00 CET op 2026-09-08 is 19:00 UTC. Drie uur ervoor is 16:00 UTC.
describe('de 3-uursregel', () => {
  it('laat een vlucht toe die precies op de grens landt', () => {
    const v = judge(offer('2026-09-08T16:00:00.000Z'), '2026-09-08', '21:00');
    expect(v.feasible).toBe(true);
    expect(v.bufferMinutes).toBe(180);
  });

  it('wijst een vlucht af die één minuut te laat landt', () => {
    const v = judge(offer('2026-09-08T16:01:00.000Z'), '2026-09-08', '21:00');
    expect(v.feasible).toBe(false);
    expect(v.reason).toBe('te-laat-geland');
  });

  it('rekent de wintertijd mee in plaats van de zomertijd', () => {
    // 2027-01-27 21:00 CET = 20:00 UTC. Landen om 17:00 UTC geeft exact drie uur.
    // Met een zomertijd-aanname zou dit ten onrechte afgewezen worden.
    const v = judge(
      offer('2027-01-27T17:00:00.000Z', { outboundDate: '2027-01-27' }),
      '2027-01-27', '21:00',
    );
    expect(v.feasible).toBe(true);
  });

  it('houdt rekening met de vroege aftrap van 18:45', () => {
    // 18:45 CET = 16:45 UTC. Drie uur ervoor is 13:45 UTC.
    const laat = judge(offer('2026-09-08T14:00:00.000Z'), '2026-09-08', '18:45');
    expect(laat.feasible).toBe(false);
    const opTijd = judge(offer('2026-09-08T13:45:00.000Z'), '2026-09-08', '18:45');
    expect(opTijd.feasible).toBe(true);
  });
});

describe('overige eisen', () => {
  it('wijst overstapvluchten af', () => {
    const v = judge(offer('2026-09-08T10:00:00.000Z', { stops: 1 }), '2026-09-08', '21:00');
    expect(v.reason).toBe('overstap');
  });

  it('wijst een vlucht op een andere dag af', () => {
    const v = judge(
      offer('2026-09-07T10:00:00.000Z', { outboundDate: '2026-09-07' }),
      '2026-09-08', '21:00',
    );
    expect(v.reason).toBe('verkeerde-datum');
  });
});

// Madrid, avond ervoor: wedstrijddag 2026-11-24, dus heen op 2026-11-23. Geen
// kickoff-marge — een late avondvlucht die de 3-uursregel zou afwijzen, mag hier
// gewoon door.
describe('judgeNightBefore', () => {
  it('accepteert een late avondvlucht die de 3-uursregel zou afwijzen', () => {
    const laatsteVluchtVanDeDag = offer('2026-11-23T21:00:00.000Z', {
      outboundDate: '2026-11-23', departUtc: '2026-11-23T19:00:00.000Z',
    });
    const staandaard = judge(laatsteVluchtVanDeDag, '2026-11-23', '21:00');
    expect(staandaard.feasible).toBe(false); // ter controle: zou hier wél afgewezen worden

    const v = judgeNightBefore(laatsteVluchtVanDeDag, '2026-11-24', '21:00');
    expect(v.feasible).toBe(true);
    expect(v.reason).toBeNull();
  });

  it('wijst een vlucht op wedstrijddag zelf af (verkeerde dag)', () => {
    const v = judgeNightBefore(
      offer('2026-11-24T08:00:00.000Z', { outboundDate: '2026-11-24' }),
      '2026-11-24', '21:00',
    );
    expect(v.feasible).toBe(false);
    expect(v.reason).toBe('verkeerde-datum');
  });

  it('wijst overstapvluchten af, net als het standaardmodel', () => {
    const v = judgeNightBefore(
      offer('2026-11-23T08:00:00.000Z', { outboundDate: '2026-11-23', stops: 1 }),
      '2026-11-24', '21:00',
    );
    expect(v.reason).toBe('overstap');
  });

  it('berekent bufferMinutes puur informatief, zonder erop te filteren', () => {
    // Bijna 25 uur voor de aftrap geland — zou bij `judge` nooit een issue zijn,
    // maar het getal moet wel kloppen als informatie.
    const v = judgeNightBefore(
      offer('2026-11-23T20:00:00.000Z', { outboundDate: '2026-11-23' }),
      '2026-11-24', '21:00',
    );
    expect(v.feasible).toBe(true);
    expect(v.bufferMinutes).toBe(24 * 60);
  });
});
