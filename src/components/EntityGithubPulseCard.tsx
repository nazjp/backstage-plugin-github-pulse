import React from 'react';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { scmAuthApiRef, scmIntegrationsApiRef } from '@backstage/integration-react';
import { useEntity } from '@backstage/plugin-catalog-react';
import Link from '@material-ui/core/Link';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import { useAsync } from 'react-use';
import { GITHUB_PROJECT_SLUG_ANNOTATION } from '../constants';
import { fetchGithubPulse } from '../fetchGithubPulse';
import { getGithubHostnameFromEntity } from '../githubHostname';

export type EntityGithubPulseCardProps = {
  /** Rolling window in days (default 7). */
  days?: number;
  variant?: 'gridItem' | 'flex';
};

export function EntityGithubPulseCard(props: EntityGithubPulseCardProps) {
  const { entity } = useEntity();
  const scmAuthApi = useApi(scmAuthApiRef);
  const scmIntegrations = useApi(scmIntegrationsApiRef);
  const days = props.days ?? 7;

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
      days,
      scmAuthApi,
      scmIntegrations,
    });
  }, [hostname, owner, repo, days, scmAuthApi, scmIntegrations]);

  const pulseUrl = `https://${hostname}/${owner}/${repo}/pulse`;

  return (
    <InfoCard
      title="GitHub pulse"
      subheader={`Last ${days} days · ${value?.defaultBranch ?? '…'}`}
      deepLink={{
        link: pulseUrl,
        title: 'Open on GitHub',
      }}
      variant={props.variant}
    >
      {loading && <Progress />}
      {error && <ResponseErrorPanel error={error} />}
      {value && !loading && !error && (
        <>
          <Typography variant="body2" paragraph>
            Merged PRs: <strong>{value.mergedPrs}</strong>
            {' · '}
            Open PRs: <strong>{value.openPrs}</strong>
            {' · '}
            Issues closed: <strong>{value.closedIssues}</strong>
            {' · '}
            Open issues: <strong>{value.openIssues}</strong>
          </Typography>
          <Typography variant="subtitle2" gutterBottom>
            Recent merges
          </Typography>
          <List dense disablePadding>
            {value.recentMergedPrs.length === 0 && (
              <ListItem>
                <ListItemText primary="No merges in this window." />
              </ListItem>
            )}
            {value.recentMergedPrs.map(pr => (
              <ListItem key={pr.number} disableGutters>
                <ListItemText
                  primary={
                    <Link href={pr.url} target="_blank" rel="noopener noreferrer">
                      #{pr.number} {pr.title}
                    </Link>
                  }
                />
              </ListItem>
            ))}
          </List>
          <Typography variant="subtitle2" gutterBottom>
            Recent commits on {value.defaultBranch}
          </Typography>
          <List dense disablePadding>
            {value.recentCommits.length === 0 && (
              <ListItem>
                <ListItemText primary="No commits in this window." />
              </ListItem>
            )}
            {value.recentCommits.map(c => (
              <ListItem key={c.sha} disableGutters>
                <ListItemText
                  primary={
                    <Link href={c.url} target="_blank" rel="noopener noreferrer">
                      <code>{c.sha.slice(0, 7)}</code> {c.message}
                    </Link>
                  }
                  secondary={c.author}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </InfoCard>
  );
}
