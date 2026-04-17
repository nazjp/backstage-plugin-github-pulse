import type { ApiRef } from '@backstage/core-plugin-api';
import { scmIntegrationsApiRef } from '@backstage/integration-react';

/** Inferred from `scmIntegrationsApiRef` (avoids a mismatched `ScmIntegrationsApi` name). */
export type ScmIntegrationsRegistry = typeof scmIntegrationsApiRef extends ApiRef<
  infer R
>
  ? R
  : never;
