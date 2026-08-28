/**
 * Eén vorm waar elke bron naartoe normaliseert. Zolang een adapter dit teruggeeft,
 * kan hij vervangen worden zonder dat de reken- of presentatielaag verandert —
 * dat is de afdekking van R1 (de gratis bron kan wegvallen).
 */

export interface Offer {
  from: string;              // IATA vertrek
  to: string;                // IATA aankomst
  outboundDate: string;      // 'YYYY-MM-DD', lokale vertrekdatum
  departUtc: string;         // ISO-instant
  arriveUtc: string;         // ISO-instant
  carrier: string | null;    // IATA-code, bv 'FR'
  stops: number;
  /** Wat de bron letterlijk teruggaf. Niet vergelijkbaar tussen bronnen. */
  baseFare: number;
  currency: string;
  seatsLeft: number | null;
  source: string;            // 'ryanair' | 'travelpayouts' | 'serpapi' | 'handmatig'
  fetchedAt: string;         // ISO-instant
  schemaVersion: 1;          // C6: soort en versie zitten op het object zelf
}

export interface PriceSource {
  readonly name: string;
  /** Eén call per route per sweep — zie R8. Niet per datum. */
  fetchRoute(from: string, to: string, fromDate: string, toDate: string): Promise<Offer[]>;
}
