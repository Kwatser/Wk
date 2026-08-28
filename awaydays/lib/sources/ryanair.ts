/**
 * Ryanair als prijsbron.
 *
 * Wat de spike van 28 augustus vaststelde, en waarom deze adapter is zoals hij is:
 *
 *  - `farfnd/.../cheapestPerDay` werkt vanaf een Actions-runner (HTTP 200) en geeft
 *    één prijs per dag voor een hele maand in één call. Dat is de reden dat een
 *    sweep in tientallen calls past en niet in honderden.
 *  - `booking/v4/availability` geeft HTTP 409 "Availability declined" en is dus geen
 *    bron voor vertrektijden.
 *  - `timtbl/3/schedules` geeft wél tijden, per dag, voor beide richtingen en ook in
 *    het winterschema.
 *
 * De prijs hangt aan een DAG, de tijden aan een VLUCHT. Draait er die dag meer dan
 * één rotatie, dan is niet te zeggen bij welke vlucht de dagprijs hoort. Deze
 * adapter verzint dat verband niet: hij geeft per vlucht een offer met de dagprijs
 * en laat de rangschiklaag het als onzeker markeren.
 */

import type { Offer, PriceSource } from '../types';
import { airportTz } from '../../config/trips';
import { zonedTimeToUtc } from '../time';
import { CallBudget } from '../budget';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const BASE = 'https://services-api.ryanair.com';

interface ScheduledFlight { carrier: string; number: string; dep: string; arr: string }

async function getJson(
  url: string,
  budget: CallBudget,
): Promise<{ status: number; json: unknown }> {
  await budget.take();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    budget.record(res.status);
    if (!res.ok) return { status: res.status, json: null };
    return { status: res.status, json: await res.json() };
  } catch {
    budget.record(0);
    return { status: 0, json: null };
  }
}

/** Eén call per route per maand. Geeft prijs per dag, of leeg als de route niet bestaat. */
async function fetchMonthPrices(
  from: string, to: string, monthStart: string, budget: CallBudget,
): Promise<Map<string, number>> {
  const url =
    `${BASE}/farfnd/v4/oneWayFares/${from}/${to}/cheapestPerDay` +
    `?outboundMonthOfDate=${monthStart}&currency=EUR`;
  const { json } = await getJson(url, budget);

  const out = new Map<string, number>();
  const fares = (json as { outbound?: { fares?: unknown[] } })?.outbound?.fares ?? [];
  for (const raw of fares) {
    const f = raw as { day?: string; unavailable?: boolean; price?: { value?: number } };
    if (!f?.day || f.unavailable === true) continue;
    const value = f.price?.value;
    if (typeof value === 'number') out.set(f.day, value);
  }
  return out;
}

/** Eén call per route per maand. Geeft de dienstregeling per dag. */
async function fetchMonthSchedule(
  from: string, to: string, year: number, month: number, budget: CallBudget,
): Promise<Map<string, ScheduledFlight[]>> {
  const url = `${BASE}/timtbl/3/schedules/${from}/${to}/years/${year}/months/${month}`;
  const { json } = await getJson(url, budget);

  const out = new Map<string, ScheduledFlight[]>();
  const days = (json as { days?: unknown[] })?.days ?? [];
  for (const raw of days) {
    const d = raw as { day?: number; flights?: unknown[] };
    if (typeof d?.day !== 'number') continue;
    const flights: ScheduledFlight[] = [];
    for (const rawF of d.flights ?? []) {
      const f = rawF as {
        carrierCode?: string; number?: string;
        departureTime?: string; arrivalTime?: string;
      };
      if (!f?.departureTime || !f?.arrivalTime) continue;
      flights.push({
        carrier: f.carrierCode ?? 'FR',
        number: f.number ?? '',
        dep: f.departureTime,
        arr: f.arrivalTime,
      });
    }
    if (flights.length) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
      out.set(iso, flights);
    }
  }
  return out;
}

/**
 * Vertrek- en aankomsttijd naar instants. Landt de vlucht op de klok eerder dan hij
 * vertrekt, dan is het over middernacht heen — dan telt er een dag bij de aankomst.
 */
function toInstants(dateISO: string, f: ScheduledFlight, from: string, to: string) {
  const departUtc = zonedTimeToUtc(dateISO, f.dep, airportTz(from));
  let arriveUtc = zonedTimeToUtc(dateISO, f.arr, airportTz(to));
  if (arriveUtc.getTime() <= departUtc.getTime()) {
    arriveUtc = new Date(arriveUtc.getTime() + 24 * 3_600_000);
  }
  return { departUtc, arriveUtc };
}

/** Alle maanden die door een datumbereik geraakt worden, als {year, month, iso}. */
export function monthsBetween(fromDate: string, toDate: string) {
  const out: Array<{ year: number; month: number; iso: string }> = [];
  const [fy, fm] = fromDate.split('-').map(Number) as [number, number];
  const [ty, tm] = toDate.split('-').map(Number) as [number, number];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push({ year: y, month: m, iso: `${y}-${String(m).padStart(2, '0')}-01` });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export function createRyanairSource(budget: CallBudget): PriceSource & {
  rotationsPerDay: Map<string, number>;
} {
  // Per 'route|datum' hoeveel rotaties er die dag waren. De rangschiklaag gebruikt
  // dit om een dagprijs als onzeker te markeren.
  const rotationsPerDay = new Map<string, number>();

  return {
    name: 'ryanair',
    rotationsPerDay,

    async fetchRoute(from, to, fromDate, toDate): Promise<Offer[]> {
      const fetchedAt = new Date().toISOString();
      const offers: Offer[] = [];

      for (const { year, month, iso } of monthsBetween(fromDate, toDate)) {
        const [prices, schedule] = [
          await fetchMonthPrices(from, to, iso, budget),
          await fetchMonthSchedule(from, to, year, month, budget),
        ];

        for (const [dateISO, flights] of schedule) {
          if (dateISO < fromDate || dateISO > toDate) continue;
          const price = prices.get(dateISO);
          if (price === undefined) continue;

          rotationsPerDay.set(`${from}-${to}|${dateISO}`, flights.length);

          for (const f of flights) {
            const { departUtc, arriveUtc } = toInstants(dateISO, f, from, to);
            offers.push({
              from, to,
              outboundDate: dateISO,
              departUtc: departUtc.toISOString(),
              arriveUtc: arriveUtc.toISOString(),
              carrier: f.carrier,
              stops: 0,
              baseFare: price,
              currency: 'EUR',
              seatsLeft: null,
              source: 'ryanair',
              fetchedAt,
              schemaVersion: 1,
            });
          }
        }
      }
      return offers;
    },
  };
}
