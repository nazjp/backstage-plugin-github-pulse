import type { ScmAuthApi } from '@backstage/integration-react';
import type { ScmIntegrationsRegistry } from './scmTypes';
import { Octokit } from '@octokit/rest';
import { DateTime } from 'luxon';

export type GithubPulseResult = {
  defaultBranch: string;
  sinceIso: string;
  days: number;
  mergedPrs: number;
  openPrs: number;
  closedIssues: number;
  openIssues: number;
  recentCommits: Array<{
    sha: string;
    message: string;
    author?: string;
    url: string;
  }>;
  recentMergedPrs: Array<{
    number: number;
    title: string;
    url: string;
    mergedAt?: string;
  }>;
};

function truncateMessage(message: string, max = 72) {
  const firstLine = message.split('\n')[0] ?? message;
  return firstLine.length > max ? `${firstLine.slice(0, max)}…` : firstLine;
}

export async function fetchGithubPulse(options: {
  hostname: string;
  owner: string;
  repo: string;
  days?: number;
  scmAuthApi: ScmAuthApi;
  scmIntegrations: ScmIntegrationsRegistry;
}): Promise<GithubPulseResult> {
  const days = options.days ?? 7;
  const since = DateTime.utc().minus({ days });
  const sinceDay = since.toISODate()!;
  const sinceIso = since.toISO()!;

  const { token } = await options.scmAuthApi.getCredentials({
    url: `https://${options.hostname}/`,
    additionalScope: {
      customScopes: {
        github: ['repo'],
      },
    },
  });

  const integration = options.scmIntegrations.github.byHost(options.hostname);
  const baseUrl = integration?.config.apiBaseUrl?.replace(/\/$/, '');

  const octokit = new Octokit({
    auth: token,
    ...(baseUrl ? { baseUrl } : {}),
  });

  const { owner, repo } = options;
  const repoLabel = `${owner}/${repo}`;

  const repoInfo = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoInfo.data.default_branch;

  const [
    commitsRes,
    mergedCountRes,
    mergedListRes,
    openPrsRes,
    closedIssuesRes,
    openIssuesRes,
  ] = await Promise.all([
    octokit.repos.listCommits({
      owner,
      repo,
      sha: defaultBranch,
      since: sinceIso,
      per_page: 8,
    }),
    octokit.search.issuesAndPullRequests({
      q: `repo:${repoLabel} is:pr is:merged merged:>=${sinceDay}`,
      per_page: 1,
    }),
    octokit.search.issuesAndPullRequests({
      q: `repo:${repoLabel} is:pr is:merged merged:>=${sinceDay}`,
      sort: 'updated',
      order: 'desc',
      per_page: 8,
    }),
    octokit.search.issuesAndPullRequests({
      q: `repo:${repoLabel} is:pr is:open`,
      per_page: 1,
    }),
    octokit.search.issuesAndPullRequests({
      q: `repo:${repoLabel} is:issue is:closed closed:>=${sinceDay}`,
      per_page: 1,
    }),
    octokit.search.issuesAndPullRequests({
      q: `repo:${repoLabel} is:issue is:open`,
      per_page: 1,
    }),
  ]);

  const recentCommits = commitsRes.data.map(c => ({
    sha: c.sha,
    message: truncateMessage(c.commit.message),
    author: c.commit.author?.name ?? c.author?.login ?? undefined,
    url: c.html_url,
  }));

  const recentMergedPrs = mergedListRes.data.items.map(item => {
    const pr = item.pull_request as { merged_at?: string | null } | undefined;
    return {
      number: item.number,
      title: item.title,
      url: item.html_url,
      mergedAt: pr?.merged_at ?? undefined,
    };
  });

  return {
    defaultBranch,
    sinceIso,
    days,
    mergedPrs: mergedCountRes.data.total_count,
    openPrs: openPrsRes.data.total_count,
    closedIssues: closedIssuesRes.data.total_count,
    openIssues: openIssuesRes.data.total_count,
    recentCommits,
    recentMergedPrs,
  };
}
