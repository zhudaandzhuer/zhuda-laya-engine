// 豬大衣櫥 — the rules of a wardrobe, pure: what a look is, what wearing a part does to the
// other slots, what of the body and of the parts under a part is not drawn while it is worn, what
// a look costs to draw, and a look as a short code. The parts come from assets/wardrobe.json and
// what they hide from assets/masks.json (both written by tools/build-parts.mjs).

/** One part to a slot. Listed from the skin outwards: of two parts worn together the later is over the other. */
export const SLOTS = ['shoes', 'bottom', 'top', 'full', 'waist', 'hair', 'back', 'hat'] as const;
export type Slot = (typeof SLOTS)[number];
export interface PartDef {
  id: string;
  /** `full` is one garment that takes the place of a top and a bottom. */
  slot: Slot;
  name: string;
  file: string;
  /** Regions of the body wholly under this part: they are not drawn while it is worn. */
  covers: string[];
  tintable: boolean;
  triangles: number;
  /** How many of its leading triangles are cloth lying on the body (they may be hidden under an outer part). */
  tight: number;
  /** Parts it comes through, or that come through it, in some pose: not worn together. */
  avoid: string[];
  /** Whether the body stays under it in every pose of every clip (the build's measure). */
  passes: boolean;
  /** Made by another tool than the kit: its skeleton is the body's by joint names only. */
  foreign?: boolean;
}
export interface Manifest {
  schemaVersion: 2;
  joints: string[];
  body: { file: string; regions: Record<string, number>; clips: string[] };
  /** The file of masks, beside the manifest. */
  masks: string;
  parts: PartDef[];
}
/**
 * What each part hides while worn: of the body, by region, and of each part that can be under it.
 * A mask is a bit per triangle in the file's order, as base64.
 */
export type Masks = Record<string, { ends?: string; body: Record<string, string>; parts: Record<string, string> }>;
/** What is worn in each slot (a part's id), and the colour chosen for each part (an index into its palette). */
export type Look = { [slot in Slot]: string | null } & { colours: Record<string, number> };
/** Cloth colours and hair colours, as display RGB. */
export const CLOTH: [number, number, number][] = [[0.93, 0.92, 0.88], [0.2, 0.33, 0.52], [0.62, 0.2, 0.2], [0.24, 0.42, 0.3], [0.85, 0.68, 0.3], [0.2, 0.2, 0.23], [0.55, 0.42, 0.62], [0.82, 0.5, 0.42]];
export const HAIR: [number, number, number][] = [[0.1, 0.09, 0.09], [0.36, 0.22, 0.14], [0.62, 0.33, 0.18], [0.2, 0.26, 0.34], [0.9, 0.9, 0.92]];
export const paletteOf = (part: PartDef) => (part.slot === 'hair' ? HAIR : CLOTH);

export const emptyLook = (): Look => ({ shoes: null, bottom: null, top: null, full: null, waist: null, hair: null, back: null, hat: null, colours: {} });
/** The order of slots in a look's code. New slots are added at the end: an older, shorter code still reads. */
const CODE: Slot[] = ['hair', 'top', 'bottom', 'shoes', 'full', 'waist', 'back', 'hat'];

function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
/** How many of the first `triangles` bits of a mask are set. */
export function hiddenIn(mask: Uint8Array | null, triangles: number): number {
  if (!mask) return 0;
  let n = 0;
  for (let t = 0; t < triangles; t++) if (mask[t >> 3] & (1 << (t & 7))) n++;
  return n;
}

/** What is wrong with a manifest, as sentences; none when it can be used. */
export function validateManifest(m: Manifest): string[] {
  const issues: string[] = [];
  if (m?.schemaVersion !== 2) return ['schemaVersion: must be 2'];
  if (!m.joints?.length) issues.push('joints: the skeleton has no joints');
  const regions = Object.keys(m.body?.regions ?? {});
  if (!regions.length) issues.push('body.regions: the body has no regions');
  const ids = new Set((m.parts ?? []).map((p) => p.id));
  const seen = new Set<string>();
  for (const [i, p] of (m.parts ?? []).entries()) {
    const at = `parts[${i}] (${p.id})`;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(p.id ?? '')) issues.push(`${at}: id must be lowercase letters, digits and dashes`);
    if (seen.has(p.id)) issues.push(`${at}: id used twice`);
    seen.add(p.id);
    if (!SLOTS.includes(p.slot)) issues.push(`${at}: unknown slot ${p.slot}`);
    for (const region of p.covers ?? []) if (!regions.includes(region)) issues.push(`${at}: covers ${region}, which the body does not have`);
    if (!(p.triangles > 0)) issues.push(`${at}: triangles must be above 0`);
    if (!(p.tight >= 0 && p.tight <= p.triangles)) issues.push(`${at}: tight must be from 0 to its triangles`);
    if (!p.file) issues.push(`${at}: no file`);
    for (const other of p.avoid ?? []) {
      if (!ids.has(other)) issues.push(`${at}: avoids ${other}, which is not a part`);
      else if (!m.parts.find((q) => q.id === other)!.avoid?.includes(p.id)) issues.push(`${at}: avoids ${other}, which does not avoid it`);
    }
  }
  return issues;
}
/** What is wrong with the masks for a manifest: a mask for something unknown, or of the wrong length. */
export function validateMasks(m: Manifest, masks: Masks): string[] {
  const issues: string[] = [];
  const parts = new Map(m.parts.map((p) => [p.id, p]));
  const bytes = (triangles: number) => Math.ceil(triangles / 8);
  for (const [id, entry] of Object.entries(masks)) {
    if (!parts.has(id)) issues.push(`masks.${id}: not a part`);
    for (const [region, text] of Object.entries(entry.body ?? {})) {
      const triangles = m.body.regions[region];
      if (triangles === undefined) issues.push(`masks.${id}.body.${region}: the body has no such region`);
      else if (fromBase64(text).length !== bytes(triangles)) issues.push(`masks.${id}.body.${region}: not ${bytes(triangles)} bytes`);
    }
    for (const [inner, text] of Object.entries(entry.parts ?? {})) {
      const part = parts.get(inner);
      if (!part) issues.push(`masks.${id}.parts.${inner}: not a part`);
      else if (fromBase64(text).length !== bytes(part.triangles)) issues.push(`masks.${id}.parts.${inner}: not ${bytes(part.triangles)} bytes`);
    }
  }
  return issues;
}

export class Wardrobe {
  readonly manifest: Manifest;
  private readonly byId: Map<string, PartDef>;
  private readonly masks: Masks;
  private readonly decoded = new Map<string, Uint8Array>();
  constructor(manifest: Manifest, masks: Masks = {}) {
    const issues = [...validateManifest(manifest), ...(manifest?.schemaVersion === 2 ? validateMasks(manifest, masks) : [])];
    if (issues.length) throw Error(issues.join('; '));
    this.manifest = manifest;
    this.masks = masks;
    this.byId = new Map(manifest.parts.map((p) => [p.id, p]));
  }
  part(id: string): PartDef {
    const p = this.byId.get(id);
    if (!p) throw Error(`no part ${id}`);
    return p;
  }
  partsOf(slot: Slot): PartDef[] {
    return this.manifest.parts.filter((p) => p.slot === slot);
  }
  /**
   * Puts a part on. A full garment takes off the top and the bottom; a top or a bottom takes off a
   * full garment; and whatever is worn that the part must avoid comes off too.
   */
  wear(look: Look, id: string): Look {
    const p = this.part(id);
    const next: Look = { ...look, colours: { ...look.colours } };
    if (p.slot === 'full') (next.top = null), (next.bottom = null);
    if (p.slot === 'top' || p.slot === 'bottom') next.full = null;
    next[p.slot] = id;
    for (const slot of SLOTS) if (next[slot] && next[slot] !== id && p.avoid.includes(next[slot]!)) next[slot] = null;
    return next;
  }
  takeOff(look: Look, slot: Slot): Look {
    return { ...look, [slot]: null, colours: { ...look.colours } };
  }
  /** Sets a part's colour; an index outside its palette, or a part that is not tintable, changes nothing. */
  colour(look: Look, id: string, index: number): Look {
    const p = this.part(id);
    if (!p.tintable || !Number.isInteger(index) || index < 0 || index >= paletteOf(p).length) return look;
    return { ...look, colours: { ...look.colours, [id]: index } };
  }
  colourOf(look: Look, id: string): [number, number, number] {
    const p = this.part(id);
    return p.tintable ? paletteOf(p)[look.colours[id] ?? 0] : [1, 1, 1];
  }
  /** What is worn, from the skin outwards. */
  worn(look: Look): PartDef[] {
    return SLOTS.map((slot) => look[slot]).filter((id): id is string => !!id).map((id) => this.part(id));
  }
  private mask(key: string, text: string): Uint8Array {
    let mask = this.decoded.get(key);
    if (!mask) this.decoded.set(key, (mask = fromBase64(text)));
    return mask;
  }
  private union(masks: Uint8Array[]): Uint8Array | null {
    if (!masks.length) return null;
    if (masks.length === 1) return masks[0];
    const out = new Uint8Array(masks[0].length);
    for (const mask of masks) for (let i = 0; i < out.length; i++) out[i] |= mask[i];
    return out;
  }
  /** The triangles of a region of the body not drawn under what is worn (a bit each), or null when all are. */
  bodyMask(look: Look, region: string): Uint8Array | null {
    return this.union(this.worn(look).flatMap((p) => (this.masks[p.id]?.body?.[region] ? [this.mask(`${p.id}/body/${region}`, this.masks[p.id].body[region])] : [])));
  }
  /** The triangles of a worn part not drawn under the other parts worn, or null when all are. */
  partMask(look: Look, id: string): Uint8Array | null {
    return this.union(this.worn(look).flatMap((p) => (this.masks[p.id]?.parts?.[id] ? [this.mask(`${p.id}/parts/${id}`, this.masks[p.id].parts[id])] : [])));
  }
  /** The regions of the body wholly under what is worn, in the body's order: their nodes need not be drawn at all. */
  hidden(look: Look): string[] {
    const covered = new Set(this.worn(look).flatMap((p) => p.covers));
    return Object.entries(this.manifest.body.regions)
      .filter(([region, triangles]) => covered.has(region) || hiddenIn(this.bodyMask(look, region), triangles) === triangles)
      .map(([region]) => region);
  }
  /** Triangles drawn for a look: of the body what no part hides, and of every part worn what no other hides. */
  triangles(look: Look): number {
    const hidden = new Set(this.hidden(look));
    const body = Object.entries(this.manifest.body.regions).reduce((sum, [region, n]) => sum + (hidden.has(region) ? 0 : n - hiddenIn(this.bodyMask(look, region), n)), 0);
    return body + this.worn(look).reduce((sum, p) => sum + p.triangles - hiddenIn(this.partMask(look, p.id), p.triangles), 0);
  }
  /** A look as `hair.top.bottom.shoes.full.waist.back.hat~colours` (`_` for nothing; colours as part:index). */
  encode(look: Look): string {
    const slots = CODE.map((slot) => look[slot] ?? '_').join('.');
    const colours = this.worn(look).filter((p) => (look.colours[p.id] ?? 0) > 0).map((p) => `${p.id}:${look.colours[p.id]}`).sort().join(',');
    return colours ? `${slots}~${colours}` : slots;
  }
  /** Reads a code back; anything unknown, in the wrong slot or against the rules is left out. */
  decode(code: string): Look {
    let look = emptyLook();
    const [slots = '', colours = ''] = String(code).split('~');
    const ids = slots.split('.');
    CODE.forEach((slot, i) => {
      const p = this.byId.get(ids[i] ?? '');
      if (p && p.slot === slot) look = this.wear(look, p.id);
    });
    for (const pair of colours.split(',')) {
      const [id, index] = pair.split(':');
      if (this.byId.has(id) && this.worn(look).some((p) => p.id === id)) look = this.colour(look, id, Number(index));
    }
    return look;
  }
  /**
   * A look by a seed: most slots filled most of the time, a full garment now and then, colours at
   * random; only parts that pass the build's measure, and nothing with what it must avoid.
   */
  random(seed: number): Look {
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let look = emptyLook();
    const chance: Record<Slot, number> = { hair: 0.95, bottom: 0.9, top: 0.9, shoes: 0.85, full: 0.25, waist: 0.4, back: 0.25, hat: 0.25 };
    for (const slot of ['bottom', 'top', 'full', 'shoes', 'hair', 'waist', 'back', 'hat'] as Slot[]) {
      const worn = this.worn(look);
      const parts = this.partsOf(slot).filter((p) => p.passes && !worn.some((w) => w.avoid.includes(p.id)));
      if (parts.length && next() < chance[slot]) look = this.wear(look, parts[Math.floor(next() * parts.length)].id);
    }
    for (const p of this.worn(look)) if (p.tintable) look = this.colour(look, p.id, Math.floor(next() * paletteOf(p).length));
    return look;
  }
}
