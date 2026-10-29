/**
 * Runtime visual contract for Spine 4.2 assets.
 *
 * A loaded Sprite or a static fallback image is not evidence that a Spine
 * presentation migrated correctly. This contract gives applications and
 * headless tests a shared, fail-fast check for the actual Spine templet.
 */

export interface SpineVisualContractSpec {
  assetId: string;
  runtimeVersion?: string;
  requiredAnimations?: string[];
  requiredSkins?: string[];
  requiredSlots?: string[];
  requiredEvents?: string[];
  requiredPhysicsConstraints?: number;
  expectedBounds?: { width: number; height: number; tolerancePx?: number };
}

export interface SpineVisualRuntimeSnapshot {
  isSpineTemplet: boolean;
  runtimeVersion: string | null;
  animations: string[];
  skins: string[];
  slots: string[];
  events: string[];
  physicsConstraints: number;
  bounds: { width: number | null; height: number | null };
}

export interface SpineVisualContractReport {
  assetId: string;
  passed: boolean;
  snapshot: SpineVisualRuntimeSnapshot;
  missingAnimations: string[];
  missingSkins: string[];
  missingSlots: string[];
  missingEvents: string[];
  issues: string[];
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))].sort();
}

function readCollection(source: any, methodNames: string[], fallback: unknown[] = []): string[] {
  for (const methodName of methodNames) {
    try {
      const method = source?.[methodName];
      if (typeof method === 'function') {
        const result = method.call(source);
        const values = uniqueStrings(result);
        if (values.length > 0) return values;
      }
    } catch {
      // Continue through known Spine/Laya API variants.
    }
  }
  return uniqueStrings(fallback);
}

function readIndexedCollection(source: any, countMethod: string, nameMethod: string): string[] {
  try {
    if (typeof source?.[countMethod] !== 'function' || typeof source?.[nameMethod] !== 'function') return [];
    const count = Number(source[countMethod]());
    if (!Number.isFinite(count) || count < 0) return [];
    const values: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const value = source[nameMethod](index);
      if (typeof value === 'string' && value) values.push(value);
    }
    return uniqueStrings(values);
  } catch {
    return [];
  }
}

function getSkeletonData(templet: any): any {
  return templet?._skeleton?.data || templet?.skeletonData || templet?.data || null;
}

function getNamedCollection(data: any, key: string): string[] {
  const value = data?.[key];
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean);
  if (value && typeof value === 'object') return Object.keys(value);
  return [];
}

function getVersion(templet: any, data: any): string | null {
  const value = templet?.version || templet?.SpineConst?.VERSION || data?.version || data?.skeleton?.spine;
  return typeof value === 'string' ? value : null;
}

function getBounds(templet: any, data: any): { width: number | null; height: number | null } {
  const width = Number.isFinite(Number(templet?.width)) ? Number(templet.width) : Number(data?.width);
  const height = Number.isFinite(Number(templet?.height)) ? Number(templet.height) : Number(data?.height);
  return {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null
  };
}

export class SpineVisualContract {
  public static inspect(templet: any): SpineVisualRuntimeSnapshot {
    const data = getSkeletonData(templet);
    const animations = readCollection(
      templet,
      ['getAnimationNames', 'getAniNameList', 'getAllAnimationNames'],
      readIndexedCollection(templet, 'getAnimationCount', 'getAniNameByIndex').length > 0
        ? readIndexedCollection(templet, 'getAnimationCount', 'getAniNameByIndex')
        : getNamedCollection(data, 'animations')
    );
    const skins = readCollection(
      templet,
      ['getSkinNames', 'getSkinNameList', 'getAllSkinNames'],
      readIndexedCollection(templet, 'getSkinCount', 'getSkinNameByIndex').length > 0
        ? readIndexedCollection(templet, 'getSkinCount', 'getSkinNameByIndex')
        : getNamedCollection(data, 'skins')
    );
    const slots = readCollection(templet, ['getSlotNames', 'getSlotNameList'], getNamedCollection(data, 'slots'));
    const events = readCollection(templet, ['getEventNames', 'getEventNameList'], getNamedCollection(data, 'events'));
    const constraints = data?.physics || data?.physicsConstraints || templet?.physicsConstraints;
    const physicsConstraints = Array.isArray(constraints)
      ? constraints.length
      : Number(constraints) || (templet?.optimize?.hasPhysics ? 1 : 0);
    return {
      isSpineTemplet: Boolean(templet && (
        typeof templet.buildArmature === 'function' ||
        templet._skeleton ||
        templet.skeletonData ||
        (typeof templet.getAnimationCount === 'function' && typeof templet.getAniNameByIndex === 'function') ||
        templet.optimize
      )),
      runtimeVersion: getVersion(templet, data),
      animations,
      skins,
      slots,
      events,
      physicsConstraints,
      bounds: getBounds(templet, data)
    };
  }

  public static validate(templet: any, spec: SpineVisualContractSpec): SpineVisualContractReport {
    const snapshot = this.inspect(templet);
    const requiredAnimations = uniqueStrings(spec.requiredAnimations);
    const requiredSkins = uniqueStrings(spec.requiredSkins);
    const requiredSlots = uniqueStrings(spec.requiredSlots);
    const requiredEvents = uniqueStrings(spec.requiredEvents);
    const missingAnimations = requiredAnimations.filter((name) => !snapshot.animations.includes(name));
    const missingSkins = requiredSkins.filter((name) => !snapshot.skins.includes(name));
    const missingSlots = requiredSlots.filter((name) => !snapshot.slots.includes(name));
    const missingEvents = requiredEvents.filter((name) => !snapshot.events.includes(name));
    const issues: string[] = [];
    if (!snapshot.isSpineTemplet) issues.push('Loaded object is not a Spine templet; a Sprite/image fallback cannot satisfy this contract.');
    if (spec.runtimeVersion && snapshot.runtimeVersion && !snapshot.runtimeVersion.startsWith(spec.runtimeVersion)) {
      issues.push(`Spine runtime version ${snapshot.runtimeVersion} does not satisfy ${spec.runtimeVersion}.`);
    }
    if (spec.runtimeVersion && !snapshot.runtimeVersion) issues.push(`Spine runtime version is not observable; expected ${spec.runtimeVersion}.`);
    if (missingAnimations.length) issues.push(`Missing animations: ${missingAnimations.join(', ')}`);
    if (missingSkins.length) issues.push(`Missing skins: ${missingSkins.join(', ')}`);
    if (missingSlots.length) issues.push(`Missing slots: ${missingSlots.join(', ')}`);
    if (missingEvents.length) issues.push(`Missing events: ${missingEvents.join(', ')}`);
    if (spec.requiredPhysicsConstraints !== undefined && snapshot.physicsConstraints < spec.requiredPhysicsConstraints) {
      issues.push(`Physics constraints ${snapshot.physicsConstraints} < required ${spec.requiredPhysicsConstraints}.`);
    }
    if (spec.expectedBounds) {
      const tolerance = spec.expectedBounds.tolerancePx ?? 0;
      const widthDelta = snapshot.bounds.width === null ? Infinity : Math.abs(snapshot.bounds.width - spec.expectedBounds.width);
      const heightDelta = snapshot.bounds.height === null ? Infinity : Math.abs(snapshot.bounds.height - spec.expectedBounds.height);
      if (widthDelta > tolerance || heightDelta > tolerance) {
        issues.push(`Bounds differ from contract: runtime ${snapshot.bounds.width}x${snapshot.bounds.height}, expected ${spec.expectedBounds.width}x${spec.expectedBounds.height} ±${tolerance}px.`);
      }
    }
    return {
      assetId: spec.assetId,
      passed: issues.length === 0,
      snapshot,
      missingAnimations,
      missingSkins,
      missingSlots,
      missingEvents,
      issues
    };
  }

  public static assert(templet: any, spec: SpineVisualContractSpec): SpineVisualContractReport {
    const report = this.validate(templet, spec);
    if (!report.passed) {
      throw new Error(`[SpineVisualContract] ${spec.assetId} failed: ${report.issues.join(' | ')}`);
    }
    return report;
  }
}

