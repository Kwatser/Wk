/**
 * Rem op het aantal calls (R8).
 *
 * De eerste versie van het plan zette hier geen grens, wat neerkwam op tienduizenden
 * calls per dag naar een gratis, ongedocumenteerd endpoint. Dat wordt geblokkeerd,
 * en terecht. Deze module houdt de teller bij, spreidt de calls, en breekt af zodra
 * Ryanair begint te weigeren in plaats van door te rammen.
 */

export interface BudgetOptions {
  maxCalls: number;
  spacingMs: number;
  /** Na dit aantal weigeringen op rij stopt de sweep. */
  breakerThreshold: number;
}

export const DEFAULTS: BudgetOptions = {
  maxCalls: 120,
  spacingMs: 350,
  breakerThreshold: 3,
};

export class BudgetExceeded extends Error {}
export class CircuitOpen extends Error {}

export class CallBudget {
  private used = 0;
  private consecutiveRejections = 0;
  private lastCallAt = 0;

  constructor(private readonly opts: BudgetOptions = DEFAULTS) {}

  get callsUsed(): number { return this.used; }

  /** Wacht tot de volgende call mag, of gooit als het budget of de breaker op is. */
  async take(): Promise<void> {
    if (this.used >= this.opts.maxCalls) {
      throw new BudgetExceeded(`callbudget op na ${this.used} calls`);
    }
    if (this.consecutiveRejections >= this.opts.breakerThreshold) {
      throw new CircuitOpen(
        `${this.consecutiveRejections} weigeringen op rij — sweep afgebroken`,
      );
    }
    const wait = this.opts.spacingMs - (Date.now() - this.lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCallAt = Date.now();
    this.used += 1;
  }

  /** 403, 409 en 429 zijn weigeringen; die tellen mee voor de breaker. */
  record(status: number): void {
    if (status === 403 || status === 409 || status === 429 || status === 0) {
      this.consecutiveRejections += 1;
    } else {
      this.consecutiveRejections = 0;
    }
  }
}
