/**
 * De sweep. Draait in GitHub Actions en schrijft één JSON weg.
 *
 * Twee modi:
 *
 *  - Kandidaat-sweep (standaard, ongewijzigd): alle 16 kandidaatdatums, gedeelde
 *    datumlijst voor beide trips. Voor de periode dat het speelschema nog niet
 *    vaststaat.
 *  - Bevestigde datums (MATCH_DATES): elke trip krijgt zijn eigen datum, want een
 *    gedeelde lijst zou Porto-vluchten op de Madrid-datum meenemen en andersom.
 *    Voor een trip met `variants: ['standard', 'nightBefore']` in config/trips.ts
 *    wordt ook de avond-ervoor-variant berekend en per veld naast het
 *    standaardmodel gezet, met het prijsverschil ertussen.
 *
 * Vorm van een sweep, en waarom:
 *   - Per route twee calls per maand (prijzen en dienstregeling), niet per datum.
 *     Dat is het verschil tussen tientallen calls en tienduizenden (R8).
 *   - Alleen de acht routes waarvan de spike bewees dat Ryanair er prijzen geeft.
 *   - Heen op wedstrijddag, terug de dag erna: beide richtingen worden opgehaald
 *     en gepaard tot één retour. Bij nightBefore verschuift alleen de heenkant.
 *   - De bagagetoeslag geldt per retour, niet per vlucht, dus hij wordt één keer
 *     bij de opgetelde heen- en terugprijs geteld.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { TRIPS, airportTz, type Trip, type DepartureField } from '../config/trips';
import { CallBudget, DEFAULTS, BudgetExceeded, CircuitOpen } from '../lib/budget';
import { createRyanairSource, monthsBetween } from '../lib/sources/ryanair';
import { judge, judgeNightBefore } from '../lib/feasibility';
import { buildRow, byTicketPrice, byTotalCost, roundEuro, type RankedRow } from '../lib/rank';
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

interface ConfirmedMatch { date: string; kickoff?: string }

/** MATCH_DATES='{"porto":"2026-10-20","madrid":{"date":"2026-11-24","kickoff":"21:00"}}' */
function parseMatchDates(): Record<string, ConfirmedMatch> | null {
  const raw = process.env.MATCH_DATES?.trim();
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Record<string, string | ConfirmedMatch>;
  const out: Record<string, ConfirmedMatch> = {};
  for (const [tripId, v] of Object.entries(parsed)) {
    out[tripId] = typeof v === 'string' ? { date: v } : v;
  }
  return out;
}

function scanDates(): string[] {
  const raw = process.env.SCAN_DATES?.trim();
  if (!raw) return CANDIDATE_DATES;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Goedkoopste terugvlucht op een gegeven datum, of null. */
function cheapestReturn(offers: Offer[], date: string): Offer | null {
  const sameDay = offers.filter((o) => o.outboundDate === date);
  if (!sameDay.length) return null;
  return sameDay.reduce((a, b) => (b.baseFare < a.baseFare ? b : a));
}

interface ComparisonRow {
  field: string;
  standard: (RankedRow & { date: string }) | null;
  nightBefore: (RankedRow & { date: string }) | null;
  ticketDelta: number | null;
  totalDelta: number | null;
}

/**
 * Bevestigde-datums-modus. Elke trip zijn eigen datum, en voor trips met de
 * nightBefore-variant een vergelijkingstabel per veld.
 */
async function runConfirmed(matchDates: Record<string, ConfirmedMatch>) {
  const budget = new CallBudget({ ...DEFAULTS, maxCalls: DRY_RUN ? 0 : 200 });
  const source = createRyanairSource(budget);
  const skipped: Array<{ route: string; reden: string }> = [];
  let plannedCalls = 0;

  const perTrip: Array<{
    trip: string;
    matchDate: string;
    kickoffCet: string;
    goedkoopsteTicket: Array<RankedRow & { date: string }>;
    goedkoopsteTotaal: Array<RankedRow & { date: string }>;
    nightBeforeComparison: ComparisonRow[] | null;
  }> = [];

  for (const trip of TRIPS as Trip[]) {
    const confirmed = matchDates[trip.id];
    if (!confirmed) {
      throw new Error(`MATCH_DATES mist een datum voor trip '${trip.id}'`);
    }
    const matchDate = confirmed.date;
    const kickoff = confirmed.kickoff ?? KICKOFF;
    const dayBefore = addDays(matchDate, -1);
    const dayAfter = addDays(matchDate, 1);
    const supportsNightBefore = trip.variants.includes('nightBefore');

    plannedCalls +=
      (trip.fields as DepartureField[]).filter((f) => f.ryanairServes).length *
      4 * monthsBetween(dayBefore, dayAfter).length;

    const standardRows: Array<RankedRow & { date: string }> = [];
    const comparison: ComparisonRow[] = [];

    for (const field of trip.fields as DepartureField[]) {
      if (!field.ryanairServes || DRY_RUN) continue;

      try {
        const heen = await source.fetchRoute(field.code, trip.arrival, dayBefore, dayAfter);
        const terug = await source.fetchRoute(trip.arrival, field.code, dayBefore, dayAfter);
        const retour = cheapestReturn(terug, dayAfter);

        let bestStandard: (RankedRow & { date: string }) | null = null;
        for (const out of heen.filter((o) => o.outboundDate === matchDate)) {
          const verdict = judge(out, matchDate, kickoff);
          if (!verdict.feasible) continue;
          const combined: Offer = { ...out, baseFare: out.baseFare + (retour?.baseFare ?? 0) };
          const rotations = source.rotationsPerDay.get(`${field.code}-${trip.arrival}|${matchDate}`) ?? 1;
          const row = { ...buildRow({ offer: combined, field, rotationsThatDay: rotations }), date: matchDate };
          standardRows.push(row);
          if (!bestStandard || row.comparable < bestStandard.comparable) bestStandard = row;
        }

        let bestNightBefore: (RankedRow & { date: string }) | null = null;
        if (supportsNightBefore) {
          for (const out of heen.filter((o) => o.outboundDate === dayBefore)) {
            const verdict = judgeNightBefore(out, matchDate, kickoff);
            if (!verdict.feasible) continue;
            const combined: Offer = { ...out, baseFare: out.baseFare + (retour?.baseFare ?? 0) };
            const rotations = source.rotationsPerDay.get(`${field.code}-${trip.arrival}|${dayBefore}`) ?? 1;
            const row = {
              ...buildRow({ offer: combined, field, rotationsThatDay: rotations, variant: 'nightBefore' }),
              date: dayBefore,
            };
            if (!bestNightBefore || row.comparable < bestNightBefore.comparable) bestNightBefore = row;
          }
        }

        if (supportsNightBefore) {
          comparison.push({
            field: field.code,
            standard: bestStandard,
            nightBefore: bestNightBefore,
            ticketDelta: bestStandard && bestNightBefore
              ? roundEuro(bestNightBefore.comparable - bestStandard.comparable) : null,
            totalDelta: bestStandard && bestNightBefore
              ? roundEuro(bestNightBefore.total - bestStandard.total) : null,
          });
        }
      } catch (err) {
        if (err instanceof BudgetExceeded || err instanceof CircuitOpen) {
          skipped.push({ route: `${field.code}-${trip.arrival}`, reden: err.message });
          continue;
        }
        throw err;
      }
    }

    perTrip.push({
      trip: trip.id,
      matchDate,
      kickoffCet: kickoff,
      goedkoopsteTicket: byTicketPrice(standardRows).slice(0, 15),
      goedkoopsteTotaal: byTotalCost(standardRows).slice(0, 15),
      nightBeforeComparison: supportsNightBefore ? comparison : null,
    });
  }

  if (DRY_RUN) {
    console.log(`Droogloop (bevestigde datums): ${plannedCalls} calls voor ${Object.keys(matchDates).length} wedstrijden.`);
    return;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    mode: 'confirmed' as const,
    callsUsed: budget.callsUsed,
    skipped,
    perTrip,
  };

  mkdirSync('data', { recursive: true });
  writeFileSync('data/latest.json', JSON.stringify(payload, null, 2));

  console.log(`${budget.callsUsed} calls (bevestigde datums).`);
  for (const t of perTrip) {
    console.log(`\n=== ${t.trip} — ${t.matchDate}, aftrap ${t.kickoffCet} CET ===`);
    if (!t.goedkoopsteTicket.length) {
      console.log('  Geen enkele haalbare standaardoptie.');
    }
    for (const r of t.goedkoopsteTicket.slice(0, 8)) {
      const dep = formatInZone(new Date(r.offer.departUtc), airportTz(r.offer.from));
      const arr = formatInZone(new Date(r.offer.arriveUtc), airportTz(r.offer.to));
      console.log(
        `  standaard  ${r.field.code}  vertrek ${dep} aankomst ${arr} (lokaal)  ` +
        `EUR ${r.comparable} (${r.base} + ${r.extra} bagage)  totaal EUR ${r.total}` +
        (r.priceAmbiguous ? '  [dagprijs, meerdere rotaties]' : ''),
      );
    }
    if (t.nightBeforeComparison) {
      console.log(`  --- avond ervoor versus standaard, per veld ---`);
      const describe = (row: (RankedRow & { date: string }) | null) => {
        if (!row) return 'geen optie';
        const dep = formatInZone(new Date(row.offer.departUtc), airportTz(row.offer.from));
        const arr = formatInZone(new Date(row.offer.arriveUtc), airportTz(row.offer.to));
        return `EUR ${row.comparable} (${row.date} ${dep}→${arr} lokaal)` +
          (row.priceAmbiguous ? ' [dagprijs]' : '');
      };
      for (const c of t.nightBeforeComparison) {
        const delta = c.ticketDelta === null ? ''
          : c.ticketDelta <= 0 ? `  ==> avond ervoor EUR ${Math.abs(c.ticketDelta)} goedkoper`
          : `  ==> avond ervoor EUR ${c.ticketDelta} duurder`;
        console.log(`    ${c.field}`);
        console.log(`      standaard:     ${describe(c.standard)}`);
        console.log(`      avond ervoor:  ${describe(c.nightBefore)}${delta}`);
      }
    }
  }
}

async function runCandidateSweep() {
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

async function main() {
  const matchDates = parseMatchDates();
  if (matchDates) await runConfirmed(matchDates);
  else await runCandidateSweep();
}

main().catch((e) => { console.error(e); process.exit(1); });
