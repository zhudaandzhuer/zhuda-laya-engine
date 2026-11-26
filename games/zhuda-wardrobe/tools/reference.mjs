// What the wardrobe's figure and garments are compared with: published measurements of real bodies
// and real garments, in centimetres. Nothing here was chosen to fit what the tools make; where a
// source gives a range the whole range is kept. Looked up on 2026-11-25.
//
// BODY: ASTM D5585-95 (2001), "Standard Table of Body Measurements for Adult Female Misses Figure
// Type", size 8 (stature 165.1 cm), from the standard's preview at standards.iteh.ai. Converted
// from inches. The figure is 168 cm; girths are compared as they stand, heights scaled by stature.
const inch = (v) => +(v * 2.54).toFixed(1);
export const BODY = {
  source: 'ASTM D5585-95 (2001) Table 1, misses size 8',
  stature: inch(65),
  girths: { bust: inch(35), waist: inch(27), highHip: inch(34.5), hip: inch(37.5), midNeck: inch(13.75), upperArm: inch(10.75), elbow: inch(9.75), wrist: inch(6), thighMax: inch(21.75), thighMid: inch(19.75), knee: inch(14.125), calf: inch(13.625), ankle: inch(9.125) },
  heights: { cervicale: inch(56), waist: inch(40), hip: inch(32), crotch: inch(29.5), knee: inch(18), ankle: inch(2.75) },
  widths: { acrossShoulder: inch(15.125) },
  // The same table: the shoulder falls 23 degrees from the side of the neck to its point.
  shoulderSlope: 23,
  // Foot length is 15.1 % of stature in women (ANSUR II, 1,986 women, as quoted in arXiv 2610.25187).
  footToStature: 0.151,
};
// GARMENTS: finished measurements of real garments as their makers publish them.
export const GARMENTS = {
  tee: {
    sources: ['MUJI women\'s jersey crew neck short sleeve T-shirt size chart (muji.us)', 'QVC garment specifications, "Missy Tee" and "Missy Crew Neck" (qvc.com)', 'Macquarie University shop T-shirt size chart, women\'s (shop.mq.edu.au)', 'Wikipedia, "Ease (sewing)": wearing ease 5 to 6.5 cm at the bust'],
    // Chest round: bust plus wearing ease up to a relaxed fit (MUJI M is 113 round, Macquarie 12 is 101).
    chestEase: [5, 24],
    // From the high point of the shoulder to the hem: 62 (MUJI M) to 69.5 (QVC M).
    length: [62, 69.5],
    // Short sleeve from the shoulder seam: 14.6 (QVC) to 21 (MUJI).
    sleeve: [14.6, 21],
    // Sleeve opening round: 33 to 46 (QVC, sizes XS to M).
    sleeveOpening: [33, 46],
    // Crew neck: the front of the neckline 9.5 to 10.5 below the shoulder's high point, the back 3 to 4.
    frontNeckDrop: [9.5, 13.7],
    backNeckDrop: [3, 5],
    // The hem is about as wide as the chest: MUJI M 52.5 against 56.5 across.
    hemToChest: [0.9, 1.05],
  },
  jeans: {
    sources: ['QVC garment specifications, "Missy Straight Leg" and "Missy Jean" (qvc.com)'],
    inseam: [68.5, 81],
    // Knee round, 33 cm below the crotch: 34 to 44; leg opening round: 32 to 48.
    knee: [34, 44],
    legOpening: [32, 48],
    frontRise: [21, 28],
  },
  skirt: {
    sources: ['Lands\' End women\'s A-line skirt garment measurements (landsend.com)', 'Twig + Tale Meadow skirt finished measurements (side waist to hem)', 'Closet Core Sage skirt finished measurements'],
    // Side waist to hem: above the knee 39.5 to 43, at the knee 46.6 to 50, below it 53.5 to 62, maxi 83.5 to 96.
    lengths: { mini: [39.5, 43], knee: [46.6, 50], midi: [53.5, 62.5], maxi: [83.5, 96] },
    // Hem sweep of an A-line skirt at sizes 6 to 8: 118 to 121 below the knee, 142 to 145 at 83.5 long.
    sweep: { knee: [100, 125], maxi: [140, 150] },
    hipEase: [4, 10],
  },
  hat: {
    sources: ['Pitt Rivers Museum, conical bamboo hat 2022.80.11 (44 cm across, 12 cm high)', 'sellers of Vietnamese non la: 40 to 43 cm across, 17.8 to 20 cm high (terrapintrading.co.uk, 1stdibs.com)'],
    diameter: [40, 44],
    height: [11.4, 20],
  },
  pack: {
    sources: ['20-litre day packs as their makers give them: Decathlon 48 x 27 x 13 and 45 x 28 x 13, Outdoor Research Heyday 43.2 x 27.9 x 17.8, Eurohike React 42.5 x 27 x 18, Beyond Nordic BN503 45 x 24 x 17.5'],
    height: [40, 48],
    width: [24, 28],
    depth: [13, 20],
  },
};
