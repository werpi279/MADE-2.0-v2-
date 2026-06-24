import type { FormProvider, FormRequest, GenerationBackend } from '../../types/modules';
import type { Mesh } from '../../types/intent-graph';

const isTauri = (): boolean => typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';

// Prompter tier of the force-input floor.
// Only reachable when running inside the Tauri app shell (desktop).
// In the browser build this falls through to null immediately.
export class GenerationProvider implements FormProvider {
  constructor(private backend: GenerationBackend) {}

  async provide(req: FormRequest): Promise<Mesh | null> {
    if (!isTauri()) return null;
    if (!req.sketch) return null;

    try {
      return await this.backend.generate(req.sketch, {
        prompt:  req.concept,
        quality: 'fast',
      });
    } catch (err) {
      console.warn('GenerationProvider: backend failed', err);
      return null;
    }
  }
}
