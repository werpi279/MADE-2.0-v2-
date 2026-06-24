import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { Store } from '../../types/modules';
import type { IntentGraph } from '../../types/intent-graph';
import { emptyGraph } from '../../types/intent-graph';

const STORAGE_KEY = 'made2:graph';

// Autosave to localStorage + OBJ/glTF export via Three.js exporters.
// meshProvider is injected by MADEApp after module wiring so the store
// can resolve the current scene without importing the geometry engine.
export class LocalStore implements Store {
  private provider: (() => THREE.Object3D | null) | null = null;

  /** Injected by MADEApp after all modules are wired. */
  setMeshProvider(fn: () => THREE.Object3D | null): void {
    this.provider = fn;
  }

  save(graph: IntentGraph): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
    } catch {
      // localStorage unavailable (private-browsing quota) — silently skip
    }
  }

  load(): IntentGraph {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as IntentGraph;
    } catch {
      // corrupted or unavailable — return empty
    }
    return emptyGraph();
  }

  async export(fmt: 'obj' | 'glb'): Promise<Blob> {
    const object = this.provider?.();
    if (!object) throw new Error('Store.export: no mesh available — draw and lock a shape first');

    if (fmt === 'obj') {
      const text = new OBJExporter().parse(object);
      return new Blob([text], { type: 'model/obj' });
    }

    // glTF / GLB (binary)
    return new Promise<Blob>((resolve, reject) => {
      new GLTFExporter().parse(
        object,
        result => resolve(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })),
        err    => reject(err),
        { binary: true },
      );
    });
  }
}
