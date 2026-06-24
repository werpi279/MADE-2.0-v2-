import type { SatisfactionSignal, UiEvent, SatisfactionState } from '../../types/modules';

const WINDOW_SIZE = 10;       // events to consider for frustration
const REJECT_THRESHOLD = 3;   // minimum rejects to flag frustration
const REJECT_RATIO     = 0.6; // fraction of window events that are rejects
const FORCE_THRESHOLD  = 2;   // how many forces (with no locks) signal low confidence

// Force-input is shown ONLY when frustrated AND recognizerConfidenceLow — never on either alone.
// NO facial-expression recognition (invariant).
// Behavioural only: lock/reject/force/dwell counts within a sliding window.
export class BehavioralSignal implements SatisfactionSignal {
  private window: UiEvent[] = [];
  private totalLocks  = 0;
  private totalRejects = 0;
  private totalForces  = 0;
  private priors: Record<string, number> = {};

  update(events: UiEvent[]): SatisfactionState {
    for (const ev of events) {
      this.window.push(ev);
      if (ev.kind === 'lock')   { this.totalLocks++;   this.priors[ev.nodeId ?? ''] = (this.priors[ev.nodeId ?? ''] ?? 0) + 1; }
      if (ev.kind === 'reject') this.totalRejects++;
      if (ev.kind === 'force')  this.totalForces++;
    }
    if (this.window.length > WINDOW_SIZE) {
      this.window = this.window.slice(-WINDOW_SIZE);
    }

    const wRejects = this.window.filter(e => e.kind === 'reject').length;
    const wLocks   = this.window.filter(e => e.kind === 'lock').length;
    const wTotal   = this.window.length;

    // Frustrated: high reject fraction and minimum absolute count
    const rejectRatio = wTotal > 0 ? wRejects / wTotal : 0;
    const frustrated  = wRejects >= REJECT_THRESHOLD && rejectRatio >= REJECT_RATIO;

    // Low confidence: user had to force concepts several times without earning locks
    const recognizerConfidenceLow = this.totalForces >= FORCE_THRESHOLD && this.totalLocks === 0;

    // Score: ranges 0–1 based on lock vs reject balance in the window
    const score = Math.max(0.05, Math.min(1,
      0.5 + wLocks * 0.08 - wRejects * 0.07,
    ));

    return {
      score,
      frustrated,
      recognizerConfidenceLow,
      showForceInput: frustrated && recognizerConfidenceLow,
      priors: { ...this.priors },
    };
  }
}
