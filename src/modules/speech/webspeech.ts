import type { Speech, VoiceEvent } from '../../types/modules';

// V4: Web Speech API. Small command grammar = deliberate; free speech = ambient bias keywords.
// Swappable to VoskSpeech or WhisperSpeech for offline use.
export class WebSpeech implements Speech {
  onEvent(_cb: (e: VoiceEvent) => void): void {
    // no-op until V4
  }
}
