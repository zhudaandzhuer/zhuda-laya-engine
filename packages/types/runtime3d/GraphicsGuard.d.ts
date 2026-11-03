export interface ZhudaGraphicsTarget {
    clear(...args: any[]): any;
    drawRect(x: number, y: number, width: number, height: number, fillColor: any, lineColor?: any, lineWidth?: number, percent?: boolean): any;
    drawRoundRect(x: number, y: number, width: number, height: number, lt: number, rt: number, lb: number, rb: number, fillColor: any, lineColor?: any, lineWidth?: number, percent?: boolean, minNum?: number, segPixel?: number): any;
    drawCircle(x: number, y: number, radius: number, fillColor: any, lineColor?: any, lineWidth?: number, percent?: boolean): any;
    drawEllipse(x: number, y: number, width: number, height: number, fillColor: any, lineColor?: any, lineWidth?: number, percent?: boolean): any;
}
/** Validates and clamps vector drawing inputs before they reach Laya.Graphics. */
export declare class ZhudaGraphicsGuard {
    readonly target: ZhudaGraphicsTarget;
    constructor(target: ZhudaGraphicsTarget);
    clear(...args: any[]): any;
    drawRect(x: number, y: number, width: number, height: number, fillColor: any, lineColor?: any, lineWidth?: number, percent?: boolean): any;
    drawRoundRect(x: number, y: number, width: number, height: number, lt: number, rt: number, lb: number, rb: number, fillColor: any, lineColor?: any, lineWidth?: number, percent?: boolean, minNum?: number, segPixel?: number): any;
    drawCircle(x: number, y: number, radius: number, fillColor: any, lineColor?: any, lineWidth?: number, percent?: boolean): any;
    drawEllipse(x: number, y: number, width: number, height: number, fillColor: any, lineColor?: any, lineWidth?: number, percent?: boolean): any;
}
