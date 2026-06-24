import type { GestureRecognizer, DetectedHand, HandLandmark, PoseState } from '../../types/modules';
import type { Pt2D } from '../../types/intent-graph';

const PINCH_ENGAGE = 0.70;   // strength threshold for penDown

// --- Geometry helpers -------------------------------------------------------

function dist(a: HandLandmark, b: HandLandmark): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Wrist → middle-MCP distance: stable hand-size reference. */
function handSize(lm: HandLandmark[]): number { return dist(lm[0], lm[9]); }

/** Continuous pinch strength: 1 when thumb tip touches index tip, 0 when fully open. */
function pinchStrength(lm: HandLandmark[]): number {
  const hs = handSize(lm);
  return Math.max(0, Math.min(1, 1 - dist(lm[4], lm[8]) / (hs * 0.45)));
}

/** Finger is "extended" when its tip is meaningfully farther from the wrist than its PIP. */
function fingerExtended(lm: HandLandmark[], tip: number, pip: number): boolean {
  return dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.1;
}

/** Continuous openness: 0 = all fingers curled, 1 = all extended. */
function handOpenness(lm: HandLandmark[]): number {
  const hs = handSize(lm) + 1e-6;
  // tip-to-wrist distances, normalised — extended ~1.5–2× hs, curled ~0.5–0.7× hs
  const raw = [
    dist(lm[8],  lm[0]) / hs,
    dist(lm[12], lm[0]) / hs,
    dist(lm[16], lm[0]) / hs,
    dist(lm[20], lm[0]) / hs,
  ];
  const norm = raw.map(v => Math.max(0, Math.min(1, (v - 0.7) / 0.6)));
  return norm.reduce((a, b) => a + b) / 4;
}

/** ☝  Single finger point: index extended, middle/ring/pinky curled. */
function isPointing(lm: HandLandmark[]): boolean {
  return (
    fingerExtended(lm, 8, 6) &&
    !fingerExtended(lm, 12, 10) &&
    !fingerExtended(lm, 16, 14) &&
    !fingerExtended(lm, 20, 18)
  );
}

/** ✌  V/peace sign: index + middle extended, ring + pinky curled. */
function isTwoFingerPoint(lm: HandLandmark[]): boolean {
  return (
    fingerExtended(lm, 8, 6) &&
    fingerExtended(lm, 12, 10) &&
    !fingerExtended(lm, 16, 14) &&
    !fingerExtended(lm, 20, 18)
  );
}

/** L-shape frame pose: thumb tip far from palm, index extended, rest curled. */
function isFramePose(lm: HandLandmark[]): boolean {
  const hs = handSize(lm);
  return (
    dist(lm[4], lm[0]) > hs * 1.2 &&
    fingerExtended(lm, 8, 6) &&
    !fingerExtended(lm, 12, 10)
  );
}

/** All four fingers curled tightly. */
function gripStrength(lm: HandLandmark[]): number {
  const hs = handSize(lm) + 1e-6;
  const curls = [8, 12, 16, 20].map(tip =>
    Math.max(0, Math.min(1, 1 - (dist(lm[tip], lm[0]) / hs - 0.5) / 0.5))
  );
  return curls.reduce((a, b) => a + b) / 4;
}

/** Angle of wrist→index-MCP on the XY screen plane. */
function wristRoll(lm: HandLandmark[]): number {
  return Math.atan2(lm[5].y - lm[0].y, lm[5].x - lm[0].x);
}

/** Palm centroid (wrist + 4 MCPs), normalised screen coords. */
function palmCenter(lm: HandLandmark[]): Pt2D {
  const ids = [0, 5, 9, 13, 17];
  return {
    x: ids.reduce((s, i) => s + lm[i].x, 0) / ids.length,
    y: ids.reduce((s, i) => s + lm[i].y, 0) / ids.length,
  };
}

// --- Rule-based recognizer --------------------------------------------------

export class RuleGestureRecognizer implements GestureRecognizer {
  recognize(hands: DetectedHand[]): PoseState[] {
    const states = hands.map(({ landmarks: lm, handedness }) => {
      const pinch = pinchStrength(lm);
      const open  = handOpenness(lm);
      const gs    = gripStrength(lm);

      // Cup: open + pointing upward (low wrist-roll) — rough heuristic
      const cupVal = open > 0.6 ? open : 0;

      return {
        pinch,
        openness: open,
        cup: cupVal,
        grip: gs > 0.7,
        framePose: isFramePose(lm),
        toss: false,       // temporal; needs velocity — deferred to later milestone
        wristRoll: wristRoll(lm),
        penDown: pinch >= PINCH_ENGAGE,
        hand: handedness === 'Right' ? 'right' : ('left' as const),
        indexTipNorm: { x: lm[8].x, y: lm[8].y },
        palmCenterNorm: palmCenter(lm),
      } satisfies PoseState;
    });

    return states;
  }
}

// Re-export helpers for modules that need them directly (navigate, sculpt in V3+)
export { isPointing, isTwoFingerPoint, isFramePose, pinchStrength, handOpenness,
         gripStrength, wristRoll, palmCenter, handSize };
