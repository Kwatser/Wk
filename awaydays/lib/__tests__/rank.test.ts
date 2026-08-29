import { describe, it, expect } from 'vitest';
import { buildRow, byTicketPrice, byTotalCost } from '../rank';
import type { Offer } from '../types';
import type { DepartureField } from '../../config/trips';

const veld = (over: Partial<DepartureField> = {}): DepartureField => ({
  code: 'CRL', city: 'Charleroi', driveMinutes: 105, driveKm: 160,
  parkingPerDay: 12, carriers: ['FR'], ryanairServes: true, note: '', ...over,
});

const aanbod = (over: Partial<Offer> = {}): Offer => ({
  from: 'CRL', to: 'OPO', outboundDate: '2026-09-08',
  departUtc: '2026-09-08T05:45:00.000Z', arriveUtc: '2026-09-08T08:00:00.000Z',
  carrier: 'FR', stops: 0, baseFare: 89, currency: 'EUR', seatsLeft: null,
  source: 'ryanair', fetchedAt: '2026-08-28T12:00:00.000Z', schemaVersion: 1, ...over,
});

describe('normalisatie van kale versus all-in tarieven (R3)', () => {
  it('telt de bagagetoeslag bij een Ryanair-fare op', () => {
    const r = buildRow({ offer: aanbod(), field: veld(), rotationsThatDay: 1 });
    expect(r.base).toBe(89);
    expect(r.extra).toBe(40);
    expect(r.comparable).toBe(129);
  });

  it('telt niets op bij een all-in tarief', () => {
    const r = buildRow({
      offer: aanbod({ carrier: 'KL', baseFare: 120 }),
      field: veld({ code: 'AMS' }), rotationsThatDay: 1,
    });
    expect(r.extra).toBe(0);
    expect(r.comparable).toBe(120);
  });

  it('laat het all-in tarief winnen dat op kale prijs zou verliezen', () => {
    // Precies de fout die het eerste plan had: 89 lijkt goedkoper dan 120,
    // maar na normalisatie is 129 duurder.
    const ryanair = buildRow({ offer: aanbod(), field: veld(), rotationsThatDay: 1 });
    const klm = buildRow({
      offer: aanbod({ carrier: 'KL', baseFare: 120 }),
      field: veld({ code: 'AMS', driveKm: 125, parkingPerDay: 30 }), rotationsThatDay: 1,
    });
    expect(byTicketPrice([ryanair, klm])[0]!.carrierName).toBe('KLM');
  });

  it('rekent een onbekende maatschappij geen toeslag toe maar markeert hem wel', () => {
    const r = buildRow({
      offer: aanbod({ carrier: 'ZZ' }), field: veld(), rotationsThatDay: 1,
    });
    expect(r.extra).toBe(0);
    expect(r.carrierName).toBe('onbekend');
  });
});

describe('totale kosten als vangnet (R5)', () => {
  it('telt parkeren en brandstof mee zonder de sortering te sturen', () => {
    const r = buildRow({ offer: aanbod(), field: veld(), rotationsThatDay: 1 });
    expect(r.parking).toBe(24);          // 12 per dag, twee dagen
    expect(r.fuel).toBe(74);             // 160 km heen en terug maal 0,23
    expect(r.total).toBe(129 + 24 + 74);
  });

  it('draait de volgorde om zodra de rijkosten meetellen', () => {
    const charleroi = buildRow({ offer: aanbod({ baseFare: 60 }), field: veld(), rotationsThatDay: 1 });
    const eindhoven = buildRow({
      offer: aanbod({ from: 'EIN', baseFare: 95 }),
      field: veld({ code: 'EIN', driveKm: 10, parkingPerDay: 12 }), rotationsThatDay: 1,
    });
    expect(byTicketPrice([charleroi, eindhoven])[0]!.field.code).toBe('CRL');
    expect(byTotalCost([charleroi, eindhoven])[0]!.field.code).toBe('EIN');
  });
});

describe('onzekere dagprijs', () => {
  it('markeert een dag met meerdere rotaties', () => {
    const een = buildRow({ offer: aanbod(), field: veld(), rotationsThatDay: 1 });
    const twee = buildRow({ offer: aanbod(), field: veld(), rotationsThatDay: 2 });
    expect(een.priceAmbiguous).toBe(false);
    expect(twee.priceAmbiguous).toBe(true);
  });
});

describe('afronding van bedragen', () => {
  it('laat geen drijvende-kommaruis door naar het scherm', () => {
    // 37,99 + 40 gaf eerder 77.99000000000001 in de uitvoer.
    const r = buildRow({
      offer: aanbod({ baseFare: 37.99 }), field: veld(), rotationsThatDay: 1,
    });
    expect(r.comparable).toBe(77.99);
    expect(r.total).toBe(175.99);
  });
});

describe('nightBefore-variant (Madrid, avond ervoor)', () => {
  it('rekent standaard met 2 dagen parkeren', () => {
    const r = buildRow({ offer: aanbod(), field: veld(), rotationsThatDay: 1 });
    expect(r.variant).toBe('standard');
    expect(r.parking).toBe(24); // 12 × 2
    expect(r.totalNote).toBeNull();
  });

  it('rekent nightBefore met 3 dagen parkeren, niet 2', () => {
    const r = buildRow({
      offer: aanbod(), field: veld(), rotationsThatDay: 1, variant: 'nightBefore',
    });
    expect(r.variant).toBe('nightBefore');
    expect(r.parking).toBe(36); // 12 × 3, één dag langer dan standaard
    expect(r.total).toBe(129 + 36 + 74);
  });

  it('labelt het totaal als onvolledig zodra de hotelnacht ontbreekt', () => {
    const r = buildRow({
      offer: aanbod(), field: veld(), rotationsThatDay: 1, variant: 'nightBefore',
    });
    expect(r.totalNote).toBe('excl. extra hotelnacht');
  });

  it('laat een expliciete tripDays de default overschrijven', () => {
    const r = buildRow({
      offer: aanbod(), field: veld(), rotationsThatDay: 1, variant: 'nightBefore', tripDays: 5,
    });
    expect(r.parking).toBe(60); // 12 × 5
  });
});
