import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { GenerationBackend, GenerationOpts } from '../../types/modules';
import type { Mesh } from '../../types/intent-graph';

// Tauri IPC is available only in the desktop app shell; detect via window.__TAURI_INTERNALS__.
const isTauri = (): boolean => typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';

// V6: spawns TripoSR Python sidecar via Tauri IPC; CPU-only, ~1-2 min on target hardware.
// In the browser build this always throws; callers (GenerationProvider) guard with isTauri().
export class LocalSidecar implements GenerationBackend {
  async generate(image: ImageData, opts: GenerationOpts): Promise<Mesh> {
    if (!isTauri()) {
      throw new Error('LocalSidecar: requires Tauri app shell — not available in browser build');
    }

    const { invoke } = await import('@tauri-apps/api/core');

    // Encode image as PNG base64
    const canvas = document.createElement('canvas');
    canvas.width  = image.width;
    canvas.height = image.height;
    canvas.getContext('2d')!.putImageData(image, 0, 0);
    const base64 = canvas.toDataURL('image/png').split(',')[1];

    const objText: string = await invoke('generate_mesh', {
      imageBase64: base64,
      quality: opts.quality ?? 'fast',
    });

    return _objToMesh(objText);
  }
}

function _objToMesh(objText: string): THREE.Mesh {
  const loader = new OBJLoader();
  const group  = loader.parse(objText);
  const mat    = new THREE.MeshStandardMaterial({ color: 0xc4845a, roughness: 0.88, metalness: 0 });

  // Use the first mesh found, or a placeholder if parsing gave nothing
  for (const child of group.children) {
    if (child instanceof THREE.Mesh) {
      child.material = mat;
      return child;
    }
  }

  return new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 3), mat);
}
