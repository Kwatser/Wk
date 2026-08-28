/**
 * Alle tijdrekenwerk op één plek. Twee redenen, allebei uit de review:
 *
 * R10 — de 3-uursregel moet over tijdzones heen kloppen. Porto ligt een uur
 * achter op Nederland, Madrid gelijk, en speelronde 4 t/m 8 valt na de
 * klokwissel. Eén fout van een uur maakt de filter stil verkeerd, in de richting
 * die je de aftrap laat missen. Daarom rekent alles hier in UTC-instants en is
 * er precies één plek waar wandkloktijd naar een instant gaat.
 *
 * C5 — de oude addDays bouwde een lokale datum op 12:00 en sneed daarna
 * toISOString() af. Dat verspringt een dag vanaf UTC+13. Hieronder puur
 * componentrekenwerk in UTC.
 *
 * De aftrap is UEFA-breed in CET, niet in lokale tijd: 21:00 CET is in Porto
 * 20:00 lokaal. Daarom is Europe/Amsterdam de kloktijd waarin de aftrap wordt
 * uitgedrukt, en leiden we de rest af als instant.
 */

export const KICKOFF_ZONE = 'Europe/Amsterdam';

/** 'YYYY-MM-DD' naar getallen, met een controle in plaats van een aanname. */
function parseDate(dateISO: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) throw new Error(`ongeldige datum: ${dateISO}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** 'HH:MM' naar getallen. */
function parseTime(hhmm: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`ongeldige tijd: ${hhmm}`);
  return [Number(m[1]), Number(m[2])];
}

/** Datum-rekenen zonder tijdzone-effecten. 'YYYY-MM-DD' in, 'YYYY-MM-DD' uit. */
export function addDays(dateISO: string, n: number): string {
  const [y, m, d] = parseDate(dateISO);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/**
 * Hoeveel wijkt de wandklok in `timeZone` af van UTC op dit instant?
 * Positief = vóór op UTC (Europa in de zomer: +7200000).
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);

  const get = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    if (!p) throw new Error(`tijdzone-onderdeel ${type} ontbreekt voor ${timeZone}`);
    return Number(p.value);
  };

  // Sommige engines geven 24 terug voor middernacht in plaats van 0.
  const hour = get('hour') % 24;
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asIfUtc - instant.getTime();
}

/**
 * Wandkloktijd in een tijdzone naar een UTC-instant.
 * Twee iteraties omdat de offset zelf van het instant afhangt: rond een
 * klokwissel klopt de eerste schatting niet.
 */
export function zonedTimeToUtc(dateISO: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = parseDate(dateISO);
  const [hh, mi] = parseTime(hhmm);
  const naive = Date.UTC(y, m - 1, d, hh, mi);

  let instant = naive - zoneOffsetMs(new Date(naive), timeZone);
  instant = naive - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** Het instant van de aftrap. `kickoffLocal` is CET-wandkloktijd, bv '21:00'. */
export function kickoffInstant(dateISO: string, kickoffLocal: string): Date {
  return zonedTimeToUtc(dateISO, kickoffLocal, KICKOFF_ZONE);
}

/** Een instant tonen als wandkloktijd in een tijdzone, bv '07:05'. */
export function formatInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone, hour12: false, hour: '2-digit', minute: '2-digit',
  }).format(instant);
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
