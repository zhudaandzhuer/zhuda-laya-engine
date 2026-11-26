// The one state source a slot's HUD reads: balance, bet unit, currency mode (and its symbol),
// jurisdiction, locale, and a bus that announces changes. Pure TypeScript.
// Split from <original-cascade-slot>/client/src/core/store/GameReactiveStore.ts. Changes: not
// a singleton, the bus is passed in, the currency symbols are an option; the source's
// DualClockManager (a rAF + Worker clock it started with an empty callback) is not carried:
// time comes from the engine's runtime session.
import type { FSMState } from '../../systems/slot-round/contracts.ts';
import type { CurrencyMode } from './protocol.ts';
import { EventBus } from './event-bus.ts';

export type Jurisdiction = 'GLOBAL' | 'UKGC' | 'DE_GGL' | 'SWEEPS_US';

export type SlotEvents = {
  'locale:changed': { locale: string; direction: 'ltr' | 'rtl' };
  'currency:changed': { mode: CurrencyMode; symbol: string };
  'balance:updated': number;
  'bet:changed': { singleBet: number; totalBet: number };
};

export const DEFAULT_CURRENCY_SYMBOLS: Record<CurrencyMode, string> = { FIAT: '$', CRYPTO: 'USDT ', SWEEPS_GC: 'GC ', SWEEPS_SC: 'SC ', DEMO: '' };

export class SlotStore {
  balance: number;
  readonly initialBalance: number;
  singleBet = 10;
  currencyMode: CurrencyMode = 'DEMO';
  locale = 'en-US';
  jurisdiction: Jurisdiction = 'GLOBAL';
  fsmState: FSMState = 'IDLE';
  readonly bus: EventBus<SlotEvents>;
  private symbols: Record<CurrencyMode, string>;

  constructor({ balance = 100000, bus = new EventBus<SlotEvents>(), symbols = DEFAULT_CURRENCY_SYMBOLS }: { balance?: number; bus?: EventBus<SlotEvents>; symbols?: Record<CurrencyMode, string> } = {}) {
    this.balance = balance;
    this.initialBalance = balance;
    this.bus = bus;
    this.symbols = symbols;
  }

  /** Session net: balance minus the starting balance (what UKGC-style net position shows). */
  getNetPosition(): number {
    return this.balance - this.initialBalance;
  }

  getCurrencySymbol(): string {
    return this.symbols[this.currencyMode] ?? '';
  }

  /** Sweeps coins put the session under the sweepstakes jurisdiction. */
  async setCurrencyMode(mode: CurrencyMode): Promise<void> {
    this.currencyMode = mode;
    if (mode === 'SWEEPS_GC' || mode === 'SWEEPS_SC') this.jurisdiction = 'SWEEPS_US';
    await this.bus.emit('currency:changed', { mode, symbol: this.getCurrencySymbol() });
  }

  async setLocale(locale: string, direction: 'ltr' | 'rtl' = 'ltr'): Promise<void> {
    this.locale = locale;
    await this.bus.emit('locale:changed', { locale, direction });
  }

  async setBalance(points: number): Promise<void> {
    this.balance = points;
    await this.bus.emit('balance:updated', points);
  }

  formatMoney(amount: number): string {
    return `${this.getCurrencySymbol()}${amount.toLocaleString('en-US')}`;
  }
}
