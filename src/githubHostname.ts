import {
  ANNOTATION_LOCATION,
  ANNOTATION_SOURCE_LOCATION,
  parseLocationRef,
  type Entity,
} from '@backstage/catalog-model';
import type { ScmIntegrationsRegistry } from './scmTypes';

export function getGithubHostnameFromEntity(
  entity: Entity,
  scmIntegrations: ScmIntegrationsRegistry,
): string {
  let location = entity.metadata.annotations?.[ANNOTATION_SOURCE_LOCATION];
  if (!location) {
    location = entity.metadata.annotations?.[ANNOTATION_LOCATION];
  }
  if (!location) {
    return 'github.com';
  }
  const { target } = parseLocationRef(location);
  const scm = scmIntegrations.github.byUrl(target);
  if (scm) {
    return scm.config.host;
  }
  return 'github.com';
}
