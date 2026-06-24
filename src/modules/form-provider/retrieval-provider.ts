import type { FormProvider, FormRequest } from '../../types/modules';
import type { Mesh } from '../../types/intent-graph';

// Optional: concept -> mesh corpus lookup (Objaverse-scale index, if available).
// Always returns null if no retrieval corpus is configured.
export class RetrievalProvider implements FormProvider {
  async provide(_req: FormRequest): Promise<Mesh | null> {
    return null;
  }
}
