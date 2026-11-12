export const config = {
  width: 420,
  height: 570,
  dangerY: 108,
  spawnY: 49,
  stepMs: 1000 / 120,
  mergeMs: 200,
  softContactGap: 2,
  dangerMs: 3000,
  supportMs: 120,
  nextDelayMs: 160,
  maxWaitMs: 1350,
  rotateDegrees: 15,
  movePixelsPerSecond: 320,
  dropWeights: [60, 30, 10],
  banScore: 2000,
  shake: {
    duration: 700,
    screenX: 17,
    screenY: 13,
    pulses: [
      { at: 0, x: -7, lift: 3 },
      { at: 155, x: 12, lift: 4 },
      { at: 310, x: -12, lift: 4 },
      { at: 490, x: 2, lift: 9 },
    ],
  },
  mergeEffectMs: 440,
  banEffectMs: 720,
  volume: 0.12,
  gravity: 1.15,
  maxSpeed: 17,
  body: { density: 0.001, friction: 0.58, frictionStatic: 0.8, frictionAir: 0.019, restitution: 0.07 },
};

// Width, height, color, and points awarded when this card is created.
export const levels = [
  [73, 31, '#a5edf7', 0],
  [86, 35, '#a7efc3', 10],
  [100, 41, '#e9f4a6', 20],
  [115, 47, '#ffde91', 40],
  [134, 56, '#ffbd9b', 80],
  [153, 65, '#ffa6c8', 160],
  [178, 76, '#d8b5ff', 320],
  [205, 88, '#ff93aa', 640],
];

// Shape and response parameters for the two deformable materials.
export const materials = {
  flexible: {
    roundness: 0.24, squash: 0.035, bend: 0.12, response: 0.16, rebound: 0.91,
    sag: 1.05, maxSag: 0.92, topFollow: 0.91, supportWidth: 0.22, sagResponse: 0.075,
  },
//  gel: { roundness: 0.8, squash: 0.5, bend: 0.4, response: 0.10, rebound: 0.965 },
  gel: {
    roundness: 0.72, squash: 0.47, bend: 0.18, response: 0.09, rebound: 0.97,
    sag: 1.8, maxSag: 0.88, topFollow: 0.17, supportWidth: 0.12, sagResponse: 0.06,
    edgeSag: 0.16, bridgeSag: 2.8, floorPressure: 0.31,
  },
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function horizontalRadius(level, angle) {
  const [width, height] = levels[level - 1];
  return (width * Math.abs(Math.cos(angle)) + height * Math.abs(Math.sin(angle))) / 2;
}
