// Module selection. To swap an implementation:
//   1. Write a class that implements the target interface in src/modules/<name>/
//   2. Change the key here
//   3. Wire the new class in src/modules/index.ts
// NEVER change src/types/modules.ts — those are the spine contracts.

export const config = {
  handTracking:       'mediapipe',
  gestureRecognizer:  'rules',
  spatialMapping:     'screen-plane',
  speech:             'webspeech',
  shapeRecognizer:    'clip',
  interpreter:        'hypothesis-engine',
  formProvider:       ['template', 'generation', 'retrieval'] as const,
  generation: {
    provider: 'triposr',
    backend:  'local-cpu',   // swap: 'local-gpu' | 'cloud-api' | 'webgpu' | 'none'
  },
  geometryEngine:     'mesh',   // swap: 'sdf-voxel'
  renderer:           'three',
  satisfactionSignal: 'behavioral',
  store:              'local',
  shell:              'browser' as 'browser' | 'app',
} as const;
