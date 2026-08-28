/**
 * De sweep. Draait in GitHub Actions en schrijft één JSON weg.
 *
 * Vorm van een sweep, en waarom:
 *   - Per route twee calls per maand (prijzen en dienstregeling), niet per datum.
 *     Dat is het verschil tussen tientallen calls en tienduizenden (R8).
 *   - Alleen de acht routes waarvan de spike bewees dat Ryanair er prijzen geeft.
 *   - Heen op wedstrijddag, terug de dag erna: beide richtingen worden opgehaald
 *     en gepaard tot één retour.
 *   - De bagagetoeslag geldt per retour, niet per vlucht, dus hij wordt één keer
 *     bij de opgetelde heen- en terugprijs geteld.
 *
 * Zonder argumenten scant hij alle kandidaatdatums. Met SCAN_DATES=2026-09-08,...
 * alleen die, wat het geval is zodra het speelschema bekend is.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { TRIPS, airportTz, type Trip, type DepartureField } from '../config/trips';
import { CallBudget, DEFAULTS, BudgetExceeded, CircuitOpen } from '../lib/budget';
import { createRyanairSource } from '../lib/sources/ryanair';
import { judge } from '../lib/feasibility';
import { buildRow, byTicketPrice, byTotalCost, type RankedRow } from '../lib/rank';
import { addDays, formatInZone } from '../lib/time';
import type { Offer } from '../lib/types';

const CANDIDATE_DATES = [
  '2026-09-08', '2026-09-09', '2026-09-10',
  '2026-10-13', '2026-10-14', '2026-10-20', '2026-10-21',
  '2026-11-03', '2026-11-04', '2026-11-24', '2026-11-25',
  '2026-12-08', '2026-12-09',
  '2027-01-19', '2027-01-20', '2027-01-27',
];

const DRY_RUN = process.argv.includes('--dry-run');
const KICKOFF = process.env.KICKOFF_CET ?? '21:00';

function scanDates(): string[] {
  const raw = process.env.SCAN_DATES?.trim();
  if (!raw) return CANDIDATE_DATES;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Goedkoopste terugvlucht op de dag na de wedstrijd, of null. */
function cheapestReturn(offers: Offer[], date: string): Offer | null {
  const sameDay = offers.filter((o) => o.outboundDate === date);
  if (!sameDay.length) return null;
  return sameDay.reduce((a, b) => (b.baseFare < a.baseFare ? b : a));
}

async function main() {
  const dates = scanDates();
  const from = dates[0]!;
  const to = dates[dates.length - 1]!;
  const budget = new CallBudget({ ...DEFAULTS, maxCalls: DRY_RUN ? 0 : 200 });
  const source = createRyanairSource(budget);

  const rows: Array<RankedRow & { trip: string; date: string; returnFare: number | null }> = [];
  const skipped: Array<{ route: string; reden: string }> = [];
  let plannedCalls = 0;

  for (const trip of TRIPS as Trip[]) {
    for (const field of trip.fields as DepartureField[]) {
      if (!field.ryanairServes) continue;

      // Twee richtingen, elk twee calls per aangeraakte maand.
      plannedCalls += 4 * new Set(dates.map((d) => d.slice(0, 7))).size;
      if (DRY_RUN) continue;

      try {
        const heen = await source.fetchRoute(field.code, trip.arrival, from, addDays(to, 1));
        const terug = await source.fetchRoute(trip.arrival, field.code, from, addDays(to, 1));

        for (const date of dates) {
          const back = addDays(date, 1);
          const retour = cheapestReturn(terug, back);

          for (const out of heen.filter((o) => o.outboundDate === date)) {
            const verdict = judge(out, date, KICKOFF);
            if (!verdict.feasible) continue;

            // Toeslag geldt per retour: één keer over de opgetelde prijs.
            const combined: Offer = {
              ...out,
              baseFare: out.baseFare + (retour?.baseFare ?? 0),
            };
            const rotations = source.rotationsPerDay.get(`${field.code}-${trip.arrival}|${date}`) ?? 1;
            rows.push({
              ...buildRow({ offer: combined, field, rotationsThatDay: rotations }),
              trip: trip.id,
              date,
              returnFare: retour?.baseFare ?? null,
            });
          }
        }
      } catch (err) {
        if (err instanceof BudgetExceeded || err instanceof CircuitOpen) {
          skipped.push({ route: `${field.code}-${trip.arrival}`, reden: err.message });
          break;
        }
        throw err;
      }
    }
  }

  if (DRY_RUN) {
    console.log(`Droogloop: ${plannedCalls} calls voor ${dates.length} datums.`);
    console.log(`Dat is ${(plannedCalls / dates.length).toFixed(1)} calls per datum,`);
    console.log('tegenover 2 per route per datum bij een naïeve implementatie.');
    return;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    kickoffCet: KICKOFF,
    dates,
    callsUsed: budget.callsUsed,
    skipped,
    perTrip: TRIPS.map((t) => ({
      trip: t.id,
      goedkoopsteTicket: byTicketPrice(rows.filter((r) => r.trip === t.id)).slice(0, 15),
      goedkoopsteTotaal: byTotalCost(rows.filter((r) => r.trip === t.id)).slice(0, 15),
    })),
  };

  mkdirSync('data', { recursive: true });
  writeFileSync('data/latest.json', JSON.stringify(payload, null, 2));

  console.log(`${budget.callsUsed} calls, ${rows.length} haalbare opties.`);
  for (const t of payload.perTrip) {
    console.log(`\n=== ${t.trip} — goedkoopste retour, non-stop, 3u voor aftrap binnen ===`);
    if (!t.goedkoopsteTicket.length) {
      console.log('  Geen enkele haalbare optie op de gescande datums.');
      continue;
    }
    for (const r of t.goedkoopsteTicket.slice(0, 8)) {
      // Lokale tijden, want een reiziger leest geen UTC. Vertrek in de tijdzone
      // van het vertrekveld, aankomst in die van de bestemming.
      const dep = formatInZone(new Date(r.offer.departUtc), airportTz(r.offer.from));
      const arr = formatInZone(new Date(r.offer.arriveUtc), airportTz(r.offer.to));
      console.log(
        `  ${r.date}  ${r.field.code}  vertrek ${dep} aankomst ${arr} (lokaal)  ` +
        `EUR ${r.comparable} (${r.base} + ${r.extra} bagage)  ` +
        `totaal met parkeren en brandstof EUR ${r.total}` +
        (r.priceAmbiguous ? '  [dagprijs, meerdere rotaties die dag]' : ''),
      );
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
