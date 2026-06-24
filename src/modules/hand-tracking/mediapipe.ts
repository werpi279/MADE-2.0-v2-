import type { HandTracking, HandFrame } from '../../types/modules';

// V2: wire MediaPipe HandLandmarker (tasks-vision), GPU delegate, VIDEO mode, 2 hands.
// Stub returns no frames so downstream modules receive empty input.
export class MediaPipeHandTracking implements HandTracking {
  track(_frame: VideoFrame): HandFrame[] {
    return [];
  }
}
