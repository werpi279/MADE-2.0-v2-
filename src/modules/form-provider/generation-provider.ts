import type { FormProvider, FormRequest, GenerationBackend } from '../../types/modules';
import type { Mesh } from '../../types/intent-graph';

// V6: delegates to the configured GenerationBackend (default: LocalSidecar/TripoSR, CPU).
// Prompter tier of the force-input floor — only reachable from the app shell.
export class GenerationProvider implements FormProvider {
  constructor(private backend: GenerationBackend) {}

  async provide(_req: FormRequest): Promise<Mesh | null> {
    return null;  // no-op until V6
  }
}
