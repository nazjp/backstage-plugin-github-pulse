import React, { useEffect, useState } from 'react';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { scmAuthApiRef, scmIntegrationsApiRef } from '@backstage/integration-react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useAsync } from 'react-use';
import { GITHUB_PROJECT_SLUG_ANNOTATION } from '../constants';
import { fetchGithubPulse } from '../fetchGithubPulse';
import { getGithubHostnameFromEntity } from '../githubHostname';
import { GithubPulseView } from './GithubPulseView';

export type EntityGithubPulseCardProps = {
  /** Initial rolling window in days (default 7). User can change period in the card. */
  days?: number;
  variant?: 'gridItem' | 'flex';
};

export function EntityGithubPulseCard(props: EntityGithubPulseCardProps) {
  const { entity } = useEntity();
  const scmAuthApi = useApi(scmAuthApiRef);
  const scmIntegrations = useApi(scmIntegrationsApiRef);
  const initialDays = props.days ?? 7;
  const [periodDays, setPeriodDays] = useState(initialDays);

  useEffect(() => {
    setPeriodDays(initialDays);
  }, [initialDays]);

  const projectSlug = entity.metadata.annotations?.[GITHUB_PROJECT_SLUG_ANNOTATION];
  const [owner, repo] = (projectSlug ?? '').split('/');

  const hostname = getGithubHostnameFromEntity(entity, scmIntegrations);

  const { value, loading, error } = useAsync(async () => {
    if (!owner || !repo) {
      throw new Error(
        `Missing or invalid "${GITHUB_PROJECT_SLUG_ANNOTATION}" (expected org/repo).`,
      );
    }
    return fetchGithubPulse({
      hostname,
      owner,
      repo,
      days: periodDays,
      scmAuthApi,
      scmIntegrations,
    });
  }, [hostname, owner, repo, periodDays, scmAuthApi, scmIntegrations]);

  const pulseUrl = `https://${hostname}/${owner}/${repo}/pulse`;

  return (
    <InfoCard
      title="GitHub pulse"
      subheader={value ? `Default branch: ${value.defaultBranch}` : undefined}
      deepLink={{
        link: pulseUrl,
        title: 'Open on GitHub',
      }}
      variant={props.variant}
    >
      {loading && <Progress />}
      {error && <ResponseErrorPanel error={error} />}
      {value && !loading && !error && (
        <GithubPulseView
          data={value}
          periodDays={periodDays}
          onPeriodDaysChange={setPeriodDays}
        />
      )}
    </InfoCard>
  );
}
