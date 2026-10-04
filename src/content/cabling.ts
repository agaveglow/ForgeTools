/** Ethernet cabling reference: pinouts, cable types, limits and faults. General industry practice. */

export type Stripe = { base: string; striped: boolean; name: string };
const W = (name: string, base: string): Stripe => ({ name: `White/${name}`, base, striped: true });
const S = (name: string, base: string): Stripe => ({ name, base, striped: false });

const ORANGE = '#f28c28', GREEN = '#2e9e44', BLUE = '#2f6fdb', BROWN = '#7a4a21';

export const T568A: Stripe[] = [W('Green', GREEN), S('Green', GREEN), W('Orange', ORANGE), S('Blue', BLUE), W('Blue', BLUE), S('Orange', ORANGE), W('Brown', BROWN), S('Brown', BROWN)];
export const T568B: Stripe[] = [W('Orange', ORANGE), S('Orange', ORANGE), W('Green', GREEN), S('Blue', BLUE), W('Blue', BLUE), S('Green', GREEN), W('Brown', BROWN), S('Brown', BROWN)];

export type Standard = 'T568A' | 'T568B';
export const PINOUT: Record<Standard, Stripe[]> = { T568A, T568B };

/** The two ends of a cable. Straight uses the same standard both ends; crossover uses A at one end and B at the other. */
export function ends(kind: 'straight' | 'crossover', standard: Standard): [Standard, Standard] {
  if (kind === 'straight') return [standard, standard];
  return ['T568A', 'T568B'];
}

export const PAIRS: Array<[string, string]> = [['Pair 1', 'Pins 4 and 5 (blue)'], ['Pair 2', 'Pins 1 and 2'], ['Pair 3', 'Pins 3 and 6'], ['Pair 4', 'Pins 7 and 8 (brown)']];

export const HOLD = 'Hold the plug with the cable pointing away from you, the contacts facing up and the clip underneath. Pin 1 is on the left.';

export const STEPS = [
  'Choose one standard (T568B is most common in the UK and US) and use it at both ends of every straight cable on the site.',
  'Cut the cable square. Strip about 25 mm of the outer jacket without nicking the wires inside.',
  'Fan out the four pairs, untwist them as little as possible (keep twists to within about 13 mm of the plug) and flatten the wires into the colour order.',
  'Trim the wires level, leaving about 12 mm showing past the jacket, and check the order once more against the diagram.',
  'Slide the wires fully into the plug until each reaches the end. The jacket should sit just inside the plug so the strain-relief crimp grips it.',
  'Crimp with a proper tool, then give the plug a gentle tug.',
  'Test with a cable tester: all eight lines should show in order, with no open, short, crossed or split pair.',
  'Label both ends, and record the run in your own system. Do not leave customer names on labels where they can be read by others.',
];

export const FAULTS: Array<[string, string]> = [
  ['Open (a line missing)', 'A wire not seated in the plug, or a break. Re-terminate the end.'],
  ['Short', 'Two wires touching, or conductor strands bridging pins. Re-cut and re-terminate.'],
  ['Crossed or reversed', 'Wires in the wrong order at one end. Check both ends against the same standard.'],
  ['Split pair', 'Pins match 1 to 1 but the twisted pairing is wrong (for example 3 and 4 used as a pair). The test passes but the link is slow or drops. A basic tester may not catch it; use a tester with a split-pair test.'],
  ['Works slowly or drops', 'Too much untwisting, a kinked cable, a plug not seated, or length over 100 m.'],
  ['Link light but no data', 'A bad pair, a duplex or speed mismatch, or a wrong port setup. Test another cable and port.'],
];

export const CATEGORIES: Array<[string, string]> = [
  ['Cat 5e', 'Up to 1 Gbps at 100 m. Common in older offices.'],
  ['Cat 6', 'Up to 1 Gbps at 100 m, and 10 Gbps up to about 55 m.'],
  ['Cat 6a', '10 Gbps at 100 m. Thicker and stiffer, often screened.'],
  ['Cat 7 and 8', 'Screened. Used in some data-centre and special cases; the connectors are not always RJ45.'],
];

export const LIMITS: string[] = [
  'The standard limit for a twisted-pair Ethernet run is 100 m in total: up to 90 m of fixed cable plus up to 10 m of patch leads.',
  'Solid-core cable is for fixed runs and punch-down. Patch leads are usually stranded and flexible. Do not crimp plugs meant for stranded wire onto solid cable without checking they suit it.',
  'Do not run data cable tightly beside mains cable. Cross at right angles when you must.',
  'Keep the bend radius gentle (about four times the cable width) and do not over-tighten cable ties.',
  'Copper-clad aluminium (CCA) cable is not suitable for PoE or for long runs. Prefer solid copper.',
];

export const POE: Array<[string, string]> = [
  ['PoE (802.3af)', 'Up to 15.4 W per port from the switch, about 12.9 W at the device. Phones, simple access points.'],
  ['PoE+ (802.3at)', 'Up to 30 W per port, about 25.5 W at the device. Many access points and cameras.'],
  ['PoE++ (802.3bt)', 'Up to 60 W or 90 W per port. Pan-tilt cameras, bigger access points, some thin clients.'],
];

export const OTHER_CONNECTORS: Array<[string, string]> = [
  ['RJ45 (8P8C)', 'Ethernet. Eight pins.'],
  ['RJ11 (6P2C or 6P4C)', 'Telephone and DSL. The line normally uses the two centre pins. Fewer and thinner wires than RJ45.'],
  ['LC and SC (fibre)', 'LC is small and common on switches. SC is larger and square. Always clean the end face and never look into a live fibre.'],
  ['Single-mode and multi-mode fibre', 'Single-mode is for long distances and uses a different light source. Multi-mode (OM1 to OM4) is for shorter runs. Do not mix them.'],
  ['SFP', 'A swappable module that sits in a switch port and takes copper or fibre. Match speed and fibre type at both ends.'],
];
