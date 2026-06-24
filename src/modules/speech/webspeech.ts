import type { Speech, VoiceEvent } from '../../types/modules';

const COMMAND_WORDS = new Set([
  'lock', 'reject', 'undo', 'redo',
  'sphere', 'ball', 'globe',
  'cylinder', 'tube', 'pipe', 'column',
  'box', 'cube', 'block',
  'flat', 'round', 'smooth', 'sharp',
]);

const SHAPE_BIAS_WORDS = new Set([
  'sphere', 'ball', 'globe', 'orb', 'round',
  'cylinder', 'tube', 'pipe', 'column', 'rod', 'pillar',
  'box', 'cube', 'block', 'flat', 'square', 'rectangular', 'slab',
  'ring', 'torus', 'donut', 'loop',
  'cone', 'pyramid', 'arch', 'dome',
]);

const SpeechRecognitionCtor =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

// Command grammar: single explicit words trigger intent immediately.
// Ambient: free speech is scanned for shape-bias keywords.
// Swappable to VoskSpeech or WhisperSpeech for fully offline use.
export class WebSpeech implements Speech {
  private cb: ((e: VoiceEvent) => void) | null = null;
  private rec: InstanceType<typeof SpeechRecognitionCtor> | null = null;

  onEvent(cb: (e: VoiceEvent) => void): void {
    this.cb = cb;
    if (!SpeechRecognitionCtor) return;  // not supported in this browser
    this._start();
  }

  private _start(): void {
    const rec = new SpeechRecognitionCtor();
    rec.continuous     = true;
    rec.interimResults = false;
    rec.lang           = 'en-US';
    rec.maxAlternatives = 1;

    // Command grammar biases towards known words (Chrome/Edge only)
    const GrammarList = (window as any).SpeechGrammarList ?? (window as any).webkitSpeechGrammarList;
    if (GrammarList) {
      const gl = new GrammarList();
      gl.addFromString(
        `#JSGF V1.0; grammar commands; public <command> = ${[...COMMAND_WORDS].join(' | ')};`,
        1,
      );
      rec.grammars = gl;
    }

    rec.onresult = (ev: any) => {
      const text: string = ev.results[ev.resultIndex]?.[0]?.transcript?.trim().toLowerCase() ?? '';
      if (!text || !this.cb) return;

      const words: string[] = text.split(/\W+/).filter((w: string) => w.length > 0);
      const isCommand = words.some((w: string) => COMMAND_WORDS.has(w));

      if (isCommand) {
        this.cb({
          kind:     'command',
          text,
          intent:   _parseIntent(words),
          keywords: words.filter((w: string) => COMMAND_WORDS.has(w)),
        });
      } else {
        const keywords = words.filter((w: string) => SHAPE_BIAS_WORDS.has(w));
        if (keywords.length) {
          this.cb({ kind: 'ambient', text, keywords });
        }
      }
    };

    // Auto-restart so recognition stays alive between pauses
    rec.onend = () => { try { rec.start(); } catch { /* ignore */ } };
    rec.onerror = (ev: any) => {
      if (ev.error === 'no-speech') return;  // normal silence
      console.warn('WebSpeech error:', ev.error);
    };

    try { rec.start(); } catch { return; }
    this.rec = rec;
  }
}

function _parseIntent(words: string[]): string {
  if (words.includes('lock'))                                                  return 'lock';
  if (words.includes('reject') || words.includes('undo'))                     return 'reject';
  if (words.some((w: string) => ['sphere', 'ball', 'globe', 'round'].includes(w))) return 'concept:sphere';
  if (words.some((w: string) => ['cylinder', 'tube', 'pipe', 'column'].includes(w))) return 'concept:cylinder';
  if (words.some((w: string) => ['box', 'cube', 'block', 'flat'].includes(w)))      return 'concept:box';
  return 'unknown';
}
