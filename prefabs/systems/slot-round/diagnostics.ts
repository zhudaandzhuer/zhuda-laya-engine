// A bounded local log of runtime events (the last `limit`, default 400), each a JSON copy.
// From games/dungeon-spin (Diagnostics.ts), unchanged.

export interface DiagnosticEntry {
  sequence: number;
  at: number;
  type: string;
  [key: string]: any;
}

export class Diagnostics {
  private limit: number;
  private now: () => number;
  public entries: DiagnosticEntry[] = [];
  public sequence: number = 0;

  constructor({ limit = 400, now = () => Date.now() }: { limit?: number; now?: () => number } = {}) {
    this.limit = limit;
    this.now = now;
  }

  public record(type: string, data: Record<string, any> = {}): DiagnosticEntry {
    const entry: DiagnosticEntry = {
      sequence: ++this.sequence,
      at: this.now(),
      type,
      ...JSON.parse(JSON.stringify(data))
    };
    this.entries.push(entry);
    if (this.entries.length > this.limit) {
      this.entries.shift();
    }
    return entry;
  }

  /** The last count entries (added from <original-cascade-slot>). */
  public tail(count: number = 5): DiagnosticEntry[] {
    return this.entries.slice(-count);
  }

  public export(): { version: 1; entries: DiagnosticEntry[] } {
    return {
      version: 1,
      entries: JSON.parse(JSON.stringify(this.entries))
    };
  }
}
