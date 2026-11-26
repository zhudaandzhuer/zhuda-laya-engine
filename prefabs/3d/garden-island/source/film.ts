// The micro film "A day off": the shots, as data. Each shot places the
// character, says what it does, and moves the camera from one framing to
// another. Times of day are the island's own hours.
export interface Framing {
  yaw: number;
  pitch: number;
  distance: number;
  /** A fixed place to look at; without it the camera looks at the character. */
  lookAt?: [number, number, number];
}
export interface Shot {
  id: string;
  /** The narration line spoken over it (film/lines.json), if any. */
  line?: string;
  /** Seconds; a shot with a line is lengthened to hold the line. */
  seconds: number;
  hour: [number, number];
  at: [number, number];
  /** Which way the character faces at the start, radians (0: toward +z, south). */
  face: number;
  walkTo?: [number, number];
  /** A clip played where it stands, from `actAt` seconds into the shot. */
  act?: string;
  actAt?: number;
  from: Framing;
  to: Framing;
  fStop?: number;
}

export const FPS = 24;

export const SHOTS: Shot[] = [
  // Dawn: the sea and the far islands; the island wakes.
  { id: 's01-dawn', line: 'l01', seconds: 12, hour: [5.9, 6.5], at: [-6, 34], face: 3.1, from: { yaw: 0.9, pitch: 0.05, distance: 30, lookAt: [-40, 6, 60] }, to: { yaw: 0.75, pitch: 0.07, distance: 30, lookAt: [-30, 5, 50] } },
  // The beach: walking up from the water's edge.
  { id: 's02-beach', line: 'l02', seconds: 13, hour: [6.9, 7.3], at: [1.5, 37.2], face: 3.1, walkTo: [3.4, 27.5], from: { yaw: 1.25, pitch: 0.12, distance: 9 }, to: { yaw: 0.95, pitch: 0.16, distance: 7.5 } },
  // The path under the blossom, lanterns still pale.
  { id: 's03-path', line: 'l03', seconds: 13, hour: [8.4, 8.8], at: [4.3, 23.5], face: 3.1, walkTo: [2.0, 15.6], from: { yaw: 0.1, pitch: 0.16, distance: 7 }, to: { yaw: -0.25, pitch: 0.22, distance: 8.5 } },
  // Under a tree: it stops and looks up; petals fall past.
  { id: 's04-lookup', line: 'l04', seconds: 12, hour: [9.2, 9.4], at: [6.5, 14], face: 0.9, act: 'ReachRight', actAt: 4.5, from: { yaw: 0.7, pitch: 0.04, distance: 4.4 }, to: { yaw: 1.1, pitch: -0.1, distance: 3.6 }, fStop: 2 },
  // The pond, wide: it comes down to the shore.
  { id: 's05-pond', line: 'l05', seconds: 17, hour: [10.4, 10.8], at: [14.2, 2.2], face: 3.3, walkTo: [14.7, -2.4], from: { yaw: 0.75, pitch: 0.42, distance: 15, lookAt: [11, 2.2, -7] }, to: { yaw: 0.45, pitch: 0.34, distance: 12, lookAt: [11.5, 2.2, -6] } },
  // On the stepping stones.
  { id: 's06-stones', line: 'l06', seconds: 13, hour: [11.2, 11.5], at: [14.6, -3.2], face: 3.6, walkTo: [10.6, -8.2], from: { yaw: 1.9, pitch: 0.12, distance: 5 }, to: { yaw: 2.3, pitch: 0.2, distance: 5.5 }, fStop: 2.8 },
  // The stream: a walk along its bank.
  { id: 's07-stream', line: 'l07', seconds: 11, hour: [13, 13.3], at: [-2.2, 4.6], face: 4.4, walkTo: [-8.2, 8.9], from: { yaw: 2.5, pitch: 0.36, distance: 8 }, to: { yaw: 2.9, pitch: 0.3, distance: 7 } },
  // The bamboo.
  { id: 's08-bamboo', line: 'l08', seconds: 14, hour: [15, 15.4], at: [-16.5, -5.5], face: 4.2, walkTo: [-20.5, -9.5], act: 'Talk', actAt: 8.5, from: { yaw: 1.2, pitch: 0.06, distance: 6.5 }, to: { yaw: 1.55, pitch: 0.1, distance: 5 } },
  // The meadow of flowers: it greets the wind.
  { id: 's09-meadow', line: 'l09', seconds: 15, hour: [16.4, 16.9], at: [-4.6, 12.2], face: 0.3, act: 'Wave', actAt: 9, from: { yaw: 0.2, pitch: 0.05, distance: 3.6 }, to: { yaw: -0.3, pitch: 0.12, distance: 5.5 }, fStop: 2.4 },
  // Dusk on the terrace by the sea.
  { id: 's10-terrace', line: 'l10', seconds: 17, hour: [17.9, 18.5], at: [-20.6, 18.6], face: 4.3, walkTo: [-24.6, 17.2], act: 'Sit', actAt: 9, from: { yaw: 1.15, pitch: 0.2, distance: 11 }, to: { yaw: 0.95, pitch: 0.12, distance: 7.5 } },
  // Night: the lanterns and the fireflies.
  { id: 's11-night', line: 'l11', seconds: 17, hour: [20.6, 21.4], at: [2.6, 13.2], face: 0, walkTo: [4.3, 20.5], from: { yaw: 0.35, pitch: 0.2, distance: 7 }, to: { yaw: 0.05, pitch: 0.28, distance: 9 } },
  // The last look at the sea, under the stars.
  { id: 's12-stars', line: 'l12', seconds: 13, hour: [22, 22.4], at: [2.5, 36.5], face: 0.1, act: 'Wave', actAt: 8.5, from: { yaw: 3.3, pitch: 0.1, distance: 5 }, to: { yaw: 3.0, pitch: 0.03, distance: 7 } },
  // The end card is laid over this: a slow rise over the island by night.
  { id: 's13-end', seconds: 12, hour: [22.4, 22.6], at: [2.5, 36.5], face: 0.1, from: { yaw: 0.25, pitch: 0.22, distance: 46, lookAt: [0, 4, 8] }, to: { yaw: 0.1, pitch: 0.34, distance: 62, lookAt: [0, 5, 6] } },
];
