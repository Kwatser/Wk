/**
 * De ranglijst.
 *
 * Sorteren gebeurt op ticketprijs, zoals gevraagd. Twee dingen gebeuren daar
 * omheen omdat de kale prijs alleen misleidt:
 *
 * R3 — een Ryanair-fare is kaal en een KLM-fare grotendeels all-in. Ongecorrigeerd
 *      vergelijken laat de low-cost carrier structureel te goedkoop bovenaan komen.
 *      Daarom telt `comparable` de bagagetoeslag erbij, zichtbaar uitgesplitst.
 *
 * R5 — parkeren en brandstof tellen niet mee in de sortering, maar staan wel als
 *      tweede getal in de rij. Wie alleen reist deelt die kosten met niemand, en
 *      dan is de goedkoopste vlucht lang niet altijd de goedkoopste reis.
 */

import type { Offer } from './types';
import { carrierPolicy, surcharge } from '../config/carriers';
import { FUEL_COST_PER_KM, type DepartureField } from '../config/trips';

export interface RankedRow {
  offer: Offer;
  field: DepartureField;
  /** Kale fare zoals de bron hem gaf. */
  base: number;
  /** Toeslag die bij een basic fare hoort; 0 bij all-in. */
  extra: number;
  /** base + extra. Hierop wordt gesorteerd. */
  comparable: number;
  /** Parkeren voor twee dagen. */
  parking: number;
  /** Brandstof en tol, heen en terug. */
  fuel: number;
  /** comparable + parking + fuel. Alleen ter vergelijking, niet de sorteersleutel. */
  total: number;
  carrierName: string;
  /**
   * Waar de prijs vandaan komt is per dag, niet per vlucht. Draaide er die dag
   * meer dan één rotatie, dan weten we niet bij welke vlucht de prijs hoort.
   */
  priceAmbiguous: boolean;
}

export interface RankInput {
  offer: Offer;
  field: DepartureField;
  rotationsThatDay: number;
}

/**
 * Bedragen afronden op centen. Zonder dit lekt de drijvende-kommarepresentatie
 * door naar het scherm: 37,99 + 40 werd EUR 77.99000000000001.
 */
function euro(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildRow({ offer, field, rotationsThatDay }: RankInput): RankedRow {
  const extra = surcharge(offer.carrier);
  const comparable = euro(offer.baseFare + extra);
  const parking = field.parkingPerDay * 2;
  const fuel = Math.round(field.driveKm * 2 * FUEL_COST_PER_KM);

  return {
    offer, field,
    base: euro(offer.baseFare),
    extra,
    comparable,
    parking,
    fuel,
    total: euro(comparable + parking + fuel),
    carrierName: carrierPolicy(offer.carrier).name,
    priceAmbiguous: rotationsThatDay > 1,
  };
}

/** Gevraagde sortering: kale ticketprijs, na normalisatie voor bagage.
 *  Generiek zodat een rij extra velden mag dragen zonder ze te verliezen. */
export function byTicketPrice<T extends RankedRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.comparable - b.comparable || a.total - b.total);
}

/** Het vangnet uit R5: wat kost de reis werkelijk? */
export function byTotalCost<T extends RankedRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.total - b.total || a.comparable - b.comparable);
}
