/**
 * Wat een tarief van een maatschappij wél en niet bevat.
 *
 * Dit bestand bestaat om risico R3 uit het plan af te dekken. Ryanair geeft een
 * kale fare terug: geen handbagage boven de kleine tas, geen stoel, geen
 * betaalfee. KLM en Iberia geven een tarief dat die dingen grotendeels al bevat.
 * Die twee getallen ongecorrigeerd op prijs sorteren laat de low-cost carrier
 * structureel te goedkoop bovenaan komen — precies de bron waar de tool op leunt.
 *
 * De bedragen hieronder zijn schattingen, geen gepubliceerde tarieven. Ze staan
 * hier bewust als losse config zodat ze aanpasbaar zijn zodra iemand een echte
 * checkout heeft gezien. In de UI worden ze apart getoond, nooit stil verrekend.
 */

export type FareBasis = 'basic' | 'allin';

export interface CarrierPolicy {
  code: string;
  name: string;
  /** 'basic' = kale fare, toeslagen komen erbij. 'allin' = handbagage zit erin. */
  fareBasis: FareBasis;
  /** Groot handbagagestuk in de bak, retour. Alleen relevant bij 'basic'. */
  cabinBagFee: number;
  /** Betaalfee / servicekosten, retour. */
  paymentFee: number;
  note: string;
}

export const CARRIERS: Record<string, CarrierPolicy> = {
  FR: {
    code: 'FR', name: 'Ryanair', fareBasis: 'basic',
    cabinBagFee: 40, paymentFee: 0,
    note: 'Kale fare. Alleen een kleine tas onder de stoel is gratis; een trolley kost per richting.',
  },
  KL: {
    code: 'KL', name: 'KLM', fareBasis: 'allin',
    cabinBagFee: 0, paymentFee: 0,
    note: 'Handbagage inbegrepen, ook in de goedkoopste klasse.',
  },
  HV: {
    code: 'HV', name: 'Transavia', fareBasis: 'basic',
    cabinBagFee: 30, paymentFee: 0,
    note: 'Basic-tarief zonder trolley; Plus-tarief bevat hem wel.',
  },
  TP: {
    code: 'TP', name: 'TAP Air Portugal', fareBasis: 'allin',
    cabinBagFee: 0, paymentFee: 0,
    note: 'Handbagage inbegrepen.',
  },
  SN: {
    code: 'SN', name: 'Brussels Airlines', fareBasis: 'basic',
    cabinBagFee: 30, paymentFee: 0,
    note: 'Light-tarief zonder trolley.',
  },
  IB: {
    code: 'IB', name: 'Iberia', fareBasis: 'allin',
    cabinBagFee: 0, paymentFee: 0,
    note: 'Handbagage inbegrepen.',
  },
  UX: {
    code: 'UX', name: 'Air Europa', fareBasis: 'allin',
    cabinBagFee: 0, paymentFee: 0,
    note: 'Handbagage inbegrepen.',
  },
  EW: {
    code: 'EW', name: 'Eurowings', fareBasis: 'basic',
    cabinBagFee: 30, paymentFee: 0,
    note: 'Basic-tarief zonder trolley.',
  },
};

/** Onbekende maatschappij: niets aannemen, geen toeslag, wel markeren. */
export const UNKNOWN_CARRIER: CarrierPolicy = {
  code: '??', name: 'onbekend', fareBasis: 'allin',
  cabinBagFee: 0, paymentFee: 0,
  note: 'Maatschappij niet herkend — er is geen toeslag bijgeteld, de prijs kan dus te laag staan.',
};

export function carrierPolicy(code: string | null | undefined): CarrierPolicy {
  if (!code) return UNKNOWN_CARRIER;
  return CARRIERS[code.toUpperCase()] ?? UNKNOWN_CARRIER;
}

/** Toeslag die bij een kale fare hoort. Nul voor all-in tarieven. */
export function surcharge(code: string | null | undefined): number {
  const p = carrierPolicy(code);
  return p.fareBasis === 'basic' ? p.cabinBagFee + p.paymentFee : 0;
}
