/**
 * Welke opties mogen meedoen in de ranglijst?
 *
 * Het reismodel ligt vast: heen op wedstrijddag, één nacht ter plaatse, terug de
 * dag erna. De harde eis daarbovenop is dat je minimaal drie uur voor de aftrap
 * geland bent — genoeg voor bagage, metro en een uur vertraging.
 *
 * Alles rekent in instants, nooit in wandkloktijd. De aftrap staat in CET, ook
 * voor Porto waar het een uur eerder op de klok is; zie lib/time.ts.
 */

import type { Offer } from './types';
import { kickoffInstant, addDays, HOUR } from './time';

export const MIN_BUFFER_HOURS = 3;

export type RejectReason =
  | 'overstap'
  | 'te-laat-geland'
  | 'verkeerde-datum';

export interface Verdict {
  offer: Offer;
  feasible: boolean;
  reason: RejectReason | null;
  /** Marge tussen landen en aftrap, in minuten. Negatief = na de aftrap. */
  bufferMinutes: number;
}

export function judge(
  offer: Offer,
  matchDate: string,
  kickoffCet: string,
  bufferHours: number = MIN_BUFFER_HOURS,
): Verdict {
  const kickoff = kickoffInstant(matchDate, kickoffCet);
  const arrive = new Date(offer.arriveUtc);
  const bufferMinutes = Math.round((kickoff.getTime() - arrive.getTime()) / 60_000);

  let reason: RejectReason | null = null;
  if (offer.outboundDate !== matchDate) reason = 'verkeerde-datum';
  else if (offer.stops > 0) reason = 'overstap';
  else if (kickoff.getTime() - arrive.getTime() < bufferHours * HOUR) reason = 'te-laat-geland';

  return { offer, feasible: reason === null, reason, bufferMinutes };
}

export function feasibleOnly(
  offers: Offer[],
  matchDate: string,
  kickoffCet: string,
  bufferHours: number = MIN_BUFFER_HOURS,
): Verdict[] {
  return offers
    .map((o) => judge(o, matchDate, kickoffCet, bufferHours))
    .filter((v) => v.feasible);
}

/**
 * Beoordeling voor de avond-ervoor-variant: heen op de dag vóór de wedstrijd in
 * plaats van op wedstrijddag zelf. Bewust een aparte functie, geen parameter op
 * `judge` — de 3-uursregel is hier niet van toepassing (je bent al een nacht
 * eerder aanwezig), en `judge` moet voor het standaardmodel onaangeroerd blijven.
 *
 * `bufferMinutes` wordt nog wel berekend, puur informatief: hoeveel marge er is
 * tot de aftrap. Dat getal bepaalt hier niets, in tegenstelling tot bij `judge`.
 */
export function judgeNightBefore(
  offer: Offer,
  matchDate: string,
  kickoffCet: string,
): Verdict {
  const dayBefore = addDays(matchDate, -1);
  const kickoff = kickoffInstant(matchDate, kickoffCet);
  const arrive = new Date(offer.arriveUtc);
  const bufferMinutes = Math.round((kickoff.getTime() - arrive.getTime()) / 60_000);

  let reason: RejectReason | null = null;
  if (offer.outboundDate !== dayBefore) reason = 'verkeerde-datum';
  else if (offer.stops > 0) reason = 'overstap';

  return { offer, feasible: reason === null, reason, bufferMinutes };
}
