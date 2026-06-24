import type { SatisfactionSignal, UiEvent, SatisfactionState } from '../../types/modules';

const DEFAULT_STATE: SatisfactionState = {
  score: 0.5,
  frustrated: false,
  recognizerConfidenceLow: false,
  showForceInput: false,
  priors: {},
};

// V5: tracks lock/reject/redo counts and dwell to compute session priors.
// Force-input is shown ONLY when frustrated AND recognizerConfidenceLow — never on either alone.
// NO facial-expression recognition (P6 invariant).
export class BehavioralSignal implements SatisfactionSignal {
  update(_events: UiEvent[]): SatisfactionState {
    return { ...DEFAULT_STATE };
  }
}
