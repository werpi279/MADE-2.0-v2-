import type { Interpreter, GraphEdit, Context, VoiceEvent } from '../../types/modules';
import type { Stroke, Hypothesis } from '../../types/intent-graph';

// V3: constructive hypothesis (literal primitive assembly).
// V4: + retrieval hypothesis (CLIP concept match -> morph); scoring + hysteresis.
// Propose-only: never commits silently. commit() promotes on lock; force() is deterministic override.
export class HypothesisEngine implements Interpreter {
  update(_strokes: Stroke[], _voice: VoiceEvent[], _ctx: Context): Hypothesis[] {
    return [];
  }

  commit(_h: Hypothesis): GraphEdit {
    return { type: 'add-node' };
  }

  force(label: string, target: string): GraphEdit {
    return { type: 'force-concept', nodeId: target, data: { concept: label } };
  }
}
