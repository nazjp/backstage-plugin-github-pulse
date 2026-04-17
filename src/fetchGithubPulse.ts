import type { ScmAuthApi } from '@backstage/integration-react';
import type { ScmIntegrationsRegistry } from './scmTypes';
import { Octokit } from '@octokit/rest';
import { DateTime } from 'luxon';

export type GithubPulseAuthorBucket = {
  login: string;
  avatarUrl?: string;
  count: number;
};

export type GithubPulseDayBucket = {
  /** ISO date YYYY-MM-DD (UTC). */
  date: string;
  count: number;
};

export type GithubPulseIssueItem = {
  number: number;
  title: string;
  url: string;
  createdAt?: string;
  userLogin?: string;
  userAvatarUrl?: string;
};

export type GithubPulseMergedPrItem = {
  number: number;
  title: string;
  url: string;
  mergedAt?: string;
  userLogin?: string;
};

export type GithubPulseResult = {
  defaultBranch: string;
  sinceIso: string;
  untilIso: string;
  sinceLabel: string;
  untilLabel: string;
  days: number;
  mergedPrs: number;
  openPrs: number;
  closedIssues: number;
  openIssues: number;
  /** Issues created in the window (matches GitHub “new issues” style). */
  newIssuesOpened: number;
  /** Non-merge commits on default branch in window (GitHub “excluding merges”). */
  nonMergeCommitsOnDefault: number;
  uniqueNonMergeAuthors: number;
  additions: number;
  deletions: number;
  filesChanged: number;
  commitsByDay: GithubPulseDayBucket[];
  topAuthors: GithubPulseAuthorBucket[];
  recentMergedPrs: GithubPulseMergedPrItem[];
  openedIssues: GithubPulseIssueItem[];
};

const MAX_COMMIT_PAGES = 12;

async function listCommitsSince(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  sinceIso: string,
): Promise<
  Array<{
    sha: string;
    html_url: string;
    commit: { message: string; author?: { date?: string | null } | null };
    author: { login?: string | null; avatar_url?: string } | null;
    parents: { sha: string }[];
  }>
> {
  const out: Array<{
    sha: string;
    html_url: string;
    commit: { message: string; author?: { date?: string | null } | null };
    author: { login?: string | null; avatar_url?: string } | null;
    parents: { sha: string }[];
  }> = [];
  for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
    const res = await octokit.repos.listCommits({
      owner,
      repo,
      sha: branch,
      since: sinceIso,
      per_page: 100,
      page,
    });
    out.push(...res.data);
    if (res.data.length < 100) {
      break;
    }
  }
  return out;
}

function truncateMessage(message: string, max = 72) {
  const firstLine = message.split('\n')[0] ?? message;
  return firstLine.length > max ? `${firstLine.slice(0, max)}…` : firstLine;
}

function isNonMergeCommit(
  c: { parents: { sha: string }[] },
): boolean {
  return c.parents.length < 2;
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
  const since = DateTime.utc().minus({ days }).startOf('day');
  const until = DateTime.utc();
  const sinceDay = since.toISODate()!;
  const sinceIso = since.toISO()!;
  const untilIso = until.toISO()!;
  const sinceLabel = since.toLocaleString(DateTime.DATE_MED);
  const untilLabel = until.toLocaleString(DateTime.DATE_MED);

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
    allCommitsRaw,
    mergedCountRes,
    mergedListRes,
    openPrsRes,
    closedIssuesRes,
    openIssuesRes,
    newIssuesCountRes,
    openedIssuesListRes,
    branchHead,
  ] = await Promise.all([
    listCommitsSince(octokit, owner, repo, defaultBranch, sinceIso),
    octokit.search.issuesAndPullRequests({
      q: `repo:${repoLabel} is:pr is:merged merged:>=${sinceDay}`,
      per_page: 1,
    }),
    octokit.search.issuesAndPullRequests({
      q: `repo:${repoLabel} is:pr is:merged merged:>=${sinceDay}`,
      sort: 'updated',
      order: 'desc',
      per_page: 10,
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
    octokit.search.issuesAndPullRequests({
      q: `repo:${repoLabel} is:issue created:>=${sinceDay}`,
      per_page: 1,
    }),
    octokit.search.issuesAndPullRequests({
      q: `repo:${repoLabel} is:issue created:>=${sinceDay}`,
      sort: 'created',
      order: 'desc',
      per_page: 10,
    }),
    octokit.repos.getBranch({ owner, repo, branch: defaultBranch }),
  ]);

  const headSha = branchHead.data.commit.sha;

  const nonMergeOnDefault = allCommitsRaw.filter(isNonMergeCommit);
  const nonMergeCommitsOnDefault = nonMergeOnDefault.length;

  const authorMap = new Map<string, { count: number; avatarUrl?: string }>();
  for (const c of nonMergeOnDefault) {
    const login = c.author?.login ?? 'unknown';
    const cur = authorMap.get(login) ?? { count: 0, avatarUrl: c.author?.avatar_url };
    cur.count += 1;
    if (c.author?.avatar_url) {
      cur.avatarUrl = c.author.avatar_url;
    }
    authorMap.set(login, cur);
  }
  const uniqueNonMergeAuthors = authorMap.size;

  const topAuthors: GithubPulseAuthorBucket[] = [...authorMap.entries()]
    .map(([login, v]) => ({
      login,
      avatarUrl: v.avatarUrl,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const dayMap = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    dayMap.set(since.plus({ days: i }).toISODate()!, 0);
  }
  for (const c of nonMergeOnDefault) {
    const d = c.commit.author?.date;
    if (!d) {
      continue;
    }
    const day = DateTime.fromISO(d, { zone: 'utc' }).toISODate();
    if (day && dayMap.has(day)) {
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }
  }
  const commitsByDay: GithubPulseDayBucket[] = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  let additions = 0;
  let deletions = 0;
  let filesChanged = 0;
  if (allCommitsRaw.length > 0) {
    const oldest = allCommitsRaw[allCommitsRaw.length - 1];
    const baseSha = oldest.parents[0]?.sha ?? oldest.sha;
    try {
      const compare = await octokit.repos.compareCommits({
        owner,
        repo,
        base: baseSha,
        head: headSha,
      });
      for (const f of compare.data.files ?? []) {
        additions += f.additions ?? 0;
        deletions += f.deletions ?? 0;
        filesChanged += 1;
      }
    } catch {
      additions = 0;
      deletions = 0;
      filesChanged = 0;
    }
  }

  const recentMergedPrs: GithubPulseMergedPrItem[] = mergedListRes.data.items.map(
    item => {
      const pr = item.pull_request as { merged_at?: string | null } | undefined;
      const user = item.user;
      return {
        number: item.number,
        title: truncateMessage(item.title, 80),
        url: item.html_url,
        mergedAt: pr?.merged_at ?? undefined,
        userLogin: user?.login ?? undefined,
      };
    },
  );

  const openedIssues: GithubPulseIssueItem[] = openedIssuesListRes.data.items.map(item => ({
    number: item.number,
    title: truncateMessage(item.title, 80),
    url: item.html_url,
    createdAt: item.created_at,
    userLogin: item.user?.login ?? undefined,
    userAvatarUrl: item.user?.avatar_url ?? undefined,
  }));

  return {
    defaultBranch,
    sinceIso,
    untilIso,
    sinceLabel,
    untilLabel,
    days,
    mergedPrs: mergedCountRes.data.total_count,
    openPrs: openPrsRes.data.total_count,
    closedIssues: closedIssuesRes.data.total_count,
    openIssues: openIssuesRes.data.total_count,
    newIssuesOpened: newIssuesCountRes.data.total_count,
    nonMergeCommitsOnDefault,
    uniqueNonMergeAuthors,
    additions,
    deletions,
    filesChanged,
    commitsByDay,
    topAuthors,
    recentMergedPrs,
    openedIssues,
  };
}
