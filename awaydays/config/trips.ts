/**
 * De twee uitwedstrijden en hun vertrekvelden.
 *
 * Rijtijd, afstand en parkeertarief komen uit het oorspronkelijke overzicht en
 * zijn schattingen, geen geboekte prijzen. Het veld `ryanairServes` is GEEN
 * overname uit dat overzicht maar het resultaat van de spike van 28 augustus:
 * de live fare-API gaf prijzen voor acht van de dertien routes. Op twee punten
 * spreekt die meting het oude overzicht tegen — zie de notities.
 */

export interface DepartureField {
  code: string;
  city: string;
  driveMinutes: number;
  /** Enkele reis vanaf Eindhoven, bij benadering. */
  driveKm: number;
  /** Schatting per dag; de trip beslaat twee dagen. */
  parkingPerDay: number;
  /** Maatschappijen op de route volgens het oorspronkelijke overzicht. */
  carriers: string[];
  /** Gaf de Ryanair-fare-API prijzen op deze route? Gemeten, niet aangenomen. */
  ryanairServes: boolean;
  note: string;
}

/**
 * 'standard' = het vaste model: ochtendvlucht op wedstrijddag, terug de dag erna.
 * 'nightBefore' = extra nacht vóór de wedstrijd: heen de avond ervoor, terug
 * ongewijzigd de dag na de wedstrijd. Alleen aanzetten voor een trip waar de
 * groep dat expliciet wil vergelijken — het is geen algemene optie.
 */
export type NightModel = 'standard' | 'nightBefore';

export interface Trip {
  id: string;
  club: string;
  city: string;
  country: string;
  arrival: string;
  stadium: string;
  /** Tijdzone van de bestemming. De aftrap zelf staat in CET — zie lib/time.ts. */
  timezone: string;
  transfer: string;
  fields: DepartureField[];
  /** Welke reismodellen voor deze trip berekend worden. Standaard staat altijd aan. */
  variants: NightModel[];
}

export const TRIPS: Trip[] = [
  {
    id: 'porto',
    club: 'FC Porto',
    city: 'Porto',
    country: 'Portugal',
    arrival: 'OPO',
    stadium: 'Estádio do Dragão',
    timezone: 'Europe/Lisbon',
    transfer: 'Metro lijn E van Aeroporto naar Estádio do Dragão, elke 15 minuten.',
    variants: ['standard'],
    fields: [
      { code: 'EIN', city: 'Eindhoven', driveMinutes: 15, driveKm: 10, parkingPerDay: 12,
        carriers: ['FR'], ryanairServes: true,
        note: 'Eén rotatie per dag; het vertrekslot verschuift per seizoen.' },
      { code: 'NRN', city: 'Weeze', driveMinutes: 70, driveKm: 95, parkingPerDay: 7,
        carriers: ['FR'], ryanairServes: true,
        note: 'Blijft ook in het winterschema vliegen.' },
      { code: 'DUS', city: 'Düsseldorf', driveMinutes: 85, driveKm: 110, parkingPerDay: 20,
        carriers: ['FR'], ryanairServes: false,
        note: 'Het oude overzicht noemt Ryanair hier, maar de fare-API gaf geen enkele prijs ' +
              'voor september of januari. Behandeld als niet gedekt tot het tegendeel blijkt.' },
      { code: 'AMS', city: 'Schiphol', driveMinutes: 85, driveKm: 125, parkingPerDay: 30,
        carriers: ['KL', 'HV'], ryanairServes: false,
        note: 'Ryanair vliegt niet vanaf Schiphol. Enige veld met een echt vroeg ochtendvertrek.' },
      { code: 'BRU', city: 'Brussel', driveMinutes: 90, driveKm: 125, parkingPerDay: 25,
        carriers: ['TP', 'SN', 'FR'], ryanairServes: true,
        note: 'Ryanair bleek hier wél te vliegen in september, maar gaf geen januari-prijzen.' },
      { code: 'CRL', city: 'Charleroi', driveMinutes: 105, driveKm: 160, parkingPerDay: 12,
        carriers: ['FR'], ryanairServes: true,
        note: 'Ruimste Ryanair-dekking van alle velden, ook in januari.' },
      { code: 'CGN', city: 'Keulen/Bonn', driveMinutes: 110, driveKm: 145, parkingPerDay: 17,
        carriers: ['FR'], ryanairServes: true,
        note: 'Dekking in beide periodes.' },
    ],
  },
  {
    id: 'madrid',
    club: 'Real Madrid',
    city: 'Madrid',
    country: 'Spanje',
    arrival: 'MAD',
    stadium: 'Santiago Bernabéu',
    timezone: 'Europe/Madrid',
    transfer: 'Metro lijn 8 vanaf Barajas naar Nuevos Ministerios, daar lijn 10 naar Santiago Bernabéu. Ongeveer 40 minuten.',
    // Op verzoek: naast het standaardmodel ook de avond-ervoor-variant vergelijken.
    variants: ['standard', 'nightBefore'],
    fields: [
      { code: 'EIN', city: 'Eindhoven', driveMinutes: 15, driveKm: 10, parkingPerDay: 12,
        carriers: ['FR'], ryanairServes: true,
        note: 'Lage frequentie: de fare-API gaf maar 4 dagen in september en 8 in januari.' },
      { code: 'NRN', city: 'Weeze', driveMinutes: 70, driveKm: 95, parkingPerDay: 7,
        carriers: ['FR'], ryanairServes: false,
        note: 'Het oude overzicht noemt Ryanair op deze route, maar de fare-API gaf geen prijzen. ' +
              'Behandeld als niet gedekt.' },
      { code: 'DUS', city: 'Düsseldorf', driveMinutes: 85, driveKm: 110, parkingPerDay: 20,
        carriers: ['IB', 'EW', 'UX'], ryanairServes: false,
        note: 'Drie maatschappijen, geen Ryanair. Vergt een tweede bron.' },
      { code: 'AMS', city: 'Schiphol', driveMinutes: 85, driveKm: 125, parkingPerDay: 30,
        carriers: ['KL', 'IB', 'UX'], ryanairServes: false,
        note: 'Ongeveer negen vertrekken per dag, eerste rond 07:00. Vergt een tweede bron.' },
      { code: 'BRU', city: 'Brussel', driveMinutes: 90, driveKm: 125, parkingPerDay: 25,
        carriers: ['IB', 'SN', 'UX', 'FR'], ryanairServes: true,
        note: 'Breedste keuze op papier, maar Ryanair gaf geen januari-prijzen.' },
      { code: 'CRL', city: 'Charleroi', driveMinutes: 105, driveKm: 160, parkingPerDay: 12,
        carriers: ['FR'], ryanairServes: true,
        note: 'Dekking in beide periodes.' },
    ],
  },
];

/** Brandstof plus tol, enkele reis per kilometer. Schatting, aanpasbaar. */
export const FUEL_COST_PER_KM = 0.23;

export function tripById(id: string): Trip {
  const t = TRIPS.find((x) => x.id === id);
  if (!t) throw new Error(`onbekende trip: ${id}`);
  return t;
}

/** Alle routeparen die een bron zou moeten bevragen, heen én terug. */
export function coveredRyanairRoutes(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const trip of TRIPS) {
    for (const f of trip.fields) {
      if (f.ryanairServes) out.push([f.code, trip.arrival]);
    }
  }
  return out;
}

/**
 * Tijdzone per luchthaven. De schedules-bron geeft vertrektijd in de tijdzone van
 * het vertrekveld en aankomsttijd in die van de bestemming; zonder deze tabel is
 * elke omrekening naar een instant fout.
 */
export const AIRPORT_TZ: Record<string, string> = {
  EIN: 'Europe/Amsterdam',
  AMS: 'Europe/Amsterdam',
  NRN: 'Europe/Berlin',
  DUS: 'Europe/Berlin',
  CGN: 'Europe/Berlin',
  BRU: 'Europe/Brussels',
  CRL: 'Europe/Brussels',
  OPO: 'Europe/Lisbon',
  MAD: 'Europe/Madrid',
};

export function airportTz(code: string): string {
  const tz = AIRPORT_TZ[code.toUpperCase()];
  if (!tz) throw new Error(`geen tijdzone bekend voor luchthaven ${code}`);
  return tz;
}
