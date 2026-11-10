export interface ZhudaGraphicsTarget {
  clear(...args: any[]): any;
  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: any,
    lineColor?: any,
    lineWidth?: number,
    percent?: boolean,
  ): any;
  drawRoundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    lt: number,
    rt: number,
    lb: number,
    rb: number,
    fillColor: any,
    lineColor?: any,
    lineWidth?: number,
    percent?: boolean,
    minNum?: number,
    segPixel?: number,
  ): any;
  drawCircle(
    x: number,
    y: number,
    radius: number,
    fillColor: any,
    lineColor?: any,
    lineWidth?: number,
    percent?: boolean,
  ): any;
  drawEllipse(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: any,
    lineColor?: any,
    lineWidth?: number,
    percent?: boolean,
  ): any;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw Error(`Invalid Graphics ${name}`);
  return value;
}

function nonNegative(name: string, value: number): number {
  return Math.max(0, finite(name, value));
}

/** Validates and clamps vector drawing inputs before they reach Laya.Graphics. */
export class ZhudaGraphicsGuard {
  readonly target: ZhudaGraphicsTarget;
  constructor(target: ZhudaGraphicsTarget) {
    if (!target) throw Error('Graphics target is required');
    this.target = target;
  }

  clear(...args: any[]): any {
    return this.target.clear(...args);
  }

  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: any,
    lineColor?: any,
    lineWidth = 1,
    percent = false,
  ): any {
    return this.target.drawRect(
      finite('x', x),
      finite('y', y),
      nonNegative('width', width),
      nonNegative('height', height),
      fillColor,
      lineColor,
      nonNegative('lineWidth', lineWidth),
      percent,
    );
  }

  drawRoundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    lt: number,
    rt: number,
    lb: number,
    rb: number,
    fillColor: any,
    lineColor?: any,
    lineWidth = 1,
    percent = false,
    minNum?: number,
    segPixel?: number,
  ): any {
    const w = nonNegative('width', width),
      h = nonNegative('height', height);
    const maxRadius = Math.min(w, h) / 2;
    return this.target.drawRoundRect(
      finite('x', x),
      finite('y', y),
      w,
      h,
      Math.min(maxRadius, nonNegative('lt', lt)),
      Math.min(maxRadius, nonNegative('rt', rt)),
      Math.min(maxRadius, nonNegative('lb', lb)),
      Math.min(maxRadius, nonNegative('rb', rb)),
      fillColor,
      lineColor,
      nonNegative('lineWidth', lineWidth),
      percent,
      minNum === undefined ? undefined : nonNegative('minNum', minNum),
      segPixel === undefined ? undefined : nonNegative('segPixel', segPixel),
    );
  }

  drawCircle(
    x: number,
    y: number,
    radius: number,
    fillColor: any,
    lineColor?: any,
    lineWidth = 1,
    percent = false,
  ): any {
    return this.target.drawCircle(
      finite('x', x),
      finite('y', y),
      nonNegative('radius', radius),
      fillColor,
      lineColor,
      nonNegative('lineWidth', lineWidth),
      percent,
    );
  }

  drawEllipse(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: any,
    lineColor?: any,
    lineWidth = 1,
    percent = false,
  ): any {
    return this.target.drawEllipse(
      finite('x', x),
      finite('y', y),
      nonNegative('width', width),
      nonNegative('height', height),
      fillColor,
      lineColor,
      nonNegative('lineWidth', lineWidth),
      percent,
    );
  }
}
