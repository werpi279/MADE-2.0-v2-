import type { FormProvider, FormRequest } from '../../types/modules';
import type { Mesh } from '../../types/intent-graph';

// V5: parametric templates (free, in-browser). Namer tier of the force-input floor.
// Returns null -> falls through to GenerationProvider.
export class TemplateProvider implements FormProvider {
  async provide(_req: FormRequest): Promise<Mesh | null> {
    return null;
  }
}
