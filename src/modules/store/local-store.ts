import type { Store } from '../../types/modules';
import type { IntentGraph } from '../../types/intent-graph';
import { emptyGraph } from '../../types/intent-graph';

const STORAGE_KEY = 'made2:graph';

// V7: full autosave + OBJ/glTF export. V0: JSON round-trip to localStorage.
export class LocalStore implements Store {
  save(graph: IntentGraph): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
    } catch {
      // localStorage unavailable (private browsing quota, etc.) — silently skip
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

  async export(_fmt: 'obj' | 'glb'): Promise<Blob> {
    throw new Error('Store.export: not implemented until V7');
  }
}
