import type { FormProvider, FormRequest } from '../../types/modules';
import type { Mesh } from '../../types/intent-graph';

// Walks the provider list in order, returning the first non-null result.
// Implements: Template -> Generation -> Retrieval fallthrough.
export class FormProviderChain implements FormProvider {
  constructor(private providers: FormProvider[]) {}

  async provide(req: FormRequest): Promise<Mesh | null> {
    for (const p of this.providers) {
      const result = await p.provide(req);
      if (result !== null) return result;
    }
    return null;
  }
}
