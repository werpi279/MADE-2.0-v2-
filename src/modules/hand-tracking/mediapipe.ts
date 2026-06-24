import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { HandTracking, DetectedHand } from '../../types/modules';

// WASM and model are fetched from CDN at runtime — no backend needed (spec §6).
const WASM_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

export class MediaPipeHandTracking implements HandTracking {
  private landmarker: HandLandmarker | null = null;
  private lastVideoTime = -1;

  async setup(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  }

  track(video: HTMLVideoElement, timestamp: number): DetectedHand[] {
    if (!this.landmarker) return [];
    if (video.readyState < 2) return [];
    if (timestamp === this.lastVideoTime) return [];
    this.lastVideoTime = timestamp;

    const result = this.landmarker.detectForVideo(video, timestamp);
    return result.landmarks.map((hand, i) => ({
      landmarks: hand.map(lm => ({ x: lm.x, y: lm.y, z: lm.z ?? 0 })),
      // MediaPipe reports handedness from its perspective (mirrored feed) —
      // flip it so 'Right' means the user's right hand.
      handedness: result.handednesses[i]?.[0]?.categoryName === 'Right' ? 'Left' : 'Right',
    }));
  }
}
