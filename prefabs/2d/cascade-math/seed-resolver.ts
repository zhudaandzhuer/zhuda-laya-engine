// Seeded rounds for LocalSession: a round's key is 'seed:<n>' (or 'seed:<n>:buy',
// 'seed:<n>:ante'), and resolving it always plays the same round with Mulberry32(n), so
// LocalSession can re-check every saved round on load. Pure TypeScript.
import type { CascadeBonusPayload, CascadeRoundPayload, ResolvedRound } from '../slot-client/protocol.ts';
import { toResolvedRound } from '../slot-client/server-round.ts';
import type { CascadeConfig } from './config.ts';
import { CascadeEngine } from './engine.ts';
import { Mulberry32 } from './rng.ts';

export type SeedMode = 'normal' | 'buy' | 'ante';

export function seedKey(seed: number, mode: SeedMode = 'normal'): string {
  return mode === 'normal' ? `seed:${seed >>> 0}` : `seed:${seed >>> 0}:${mode}`;
}

export function parseSeedKey(key: string): { seed: number; mode: SeedMode } | null {
  const m = /^seed:(\d{1,10})(?::(buy|ante))?$/.exec(key);
  if (!m || Number(m[1]) > 0xffffffff) return null;
  return { seed: Number(m[1]), mode: (m[2] as SeedMode) ?? 'normal' };
}

/** resolve(fixture, singleBet) for LocalSession; unknown keys throw. */
export function createSeedResolver(config: CascadeConfig): (fixture: string, singleBet: number) => ResolvedRound<CascadeRoundPayload, CascadeBonusPayload> {
  return (fixture, singleBet) => {
    const parsed = parseSeedKey(fixture);
    if (!parsed) throw new Error(`unknown round key: ${fixture}`);
    const engine = new CascadeEngine(config, new Mulberry32(parsed.seed), { now: () => 0 });
    const round = engine.spin({ betAmount: singleBet, buyFeature: parsed.mode === 'buy', anteBet: parsed.mode === 'ante' }, fixture);
    return toResolvedRound(round, config.cols, config.rows);
  };
}
