import type { GestureRecognizer, HandFrame, PoseState } from '../../types/modules';

const IDLE: PoseState = {
  pinch: 0, openness: 1, cup: 0, grip: false,
  framePose: false, toss: false, wristRoll: 0,
  penDown: false, hand: null,
};

// V2: hand-tuned rules for pinch, openness, cup, grip, frame, toss, wristRoll, penDown.
// Swappable to MLGestureRecognizer via config.gestureRecognizer = 'ml'.
export class RuleGestureRecognizer implements GestureRecognizer {
  recognize(_hands: HandFrame[]): PoseState {
    return { ...IDLE };
  }
}
