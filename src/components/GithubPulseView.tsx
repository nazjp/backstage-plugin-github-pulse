import React from 'react';
import Avatar from '@material-ui/core/Avatar';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Link from '@material-ui/core/Link';
import LinearProgress from '@material-ui/core/LinearProgress';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemText from '@material-ui/core/ListItemText';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import Select from '@material-ui/core/Select';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { DateTime } from 'luxon';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GithubPulseResult } from '../fetchGithubPulse';

const useStyles = makeStyles(theme => ({
  periodRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  statPaper: {
    padding: theme.spacing(1.5),
    textAlign: 'center',
    height: '100%',
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  activityBar: {
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(1.5),
    borderRadius: 4,
    height: 8,
  },
  prBar: {
    '& .MuiLinearProgress-bar': {
      borderRadius: 4,
      backgroundColor: '#8957e5',
    },
  },
  issueBar: {
    '& .MuiLinearProgress-bar': {
      borderRadius: 4,
      backgroundColor: theme.palette.success.main,
    },
  },
  chartWrap: {
    marginTop: theme.spacing(1),
    minHeight: 200,
  },
  commitSummary: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  sectionTitle: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    fontWeight: 600,
  },
}));

function barWidthPercent(count: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((count / max) * 100));
}

function relativeTime(iso?: string): string {
  if (!iso) {
    return '';
  }
  return DateTime.fromISO(iso).toRelative() ?? '';
}

export type GithubPulseViewProps = {
  data: GithubPulseResult;
  periodDays: number;
  onPeriodDaysChange: (days: number) => void;
};

const PERIOD_OPTIONS = [
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 30, label: '1 month' },
];

export function GithubPulseView(props: GithubPulseViewProps) {
  const classes = useStyles();
  const { data } = props;
  const prActivityMax = Math.max(1, data.mergedPrs + data.openPrs);
  const issueActivityMax = Math.max(1, data.closedIssues + data.newIssuesOpened);

  const chartData = data.commitsByDay.map(d => ({
    ...d,
    label: DateTime.fromISO(d.date, { zone: 'utc' }).toFormat('MMM d'),
  }));

  return (
    <Box>
      <Box className={classes.periodRow}>
        <Typography variant="body2" color="textSecondary">
          {data.sinceLabel} – {data.untilLabel}
        </Typography>
        <Box display="flex" alignItems="center">
          <Typography variant="caption" color="textSecondary" style={{ marginRight: 8 }}>
            Period
          </Typography>
          <Select
            value={props.periodDays}
            onChange={e => props.onPeriodDaysChange(Number(e.target.value))}
            variant="outlined"
            margin="dense"
          >
            {PERIOD_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      <Typography variant="subtitle2" color="textSecondary" gutterBottom>
        Pull requests
      </Typography>
      <Typography variant="body2">
        {data.openPrs} Active pull request{data.openPrs === 1 ? '' : 's'}
      </Typography>
      <LinearProgress
        className={`${classes.activityBar} ${classes.prBar}`}
        variant="determinate"
        value={barWidthPercent(data.openPrs, prActivityMax)}
      />

      <Typography variant="subtitle2" color="textSecondary" gutterBottom style={{ marginTop: 16 }}>
        Issues
      </Typography>
      <Typography variant="body2">
        {data.openIssues} Active issue{data.openIssues === 1 ? '' : 's'}
      </Typography>
      <LinearProgress
        className={`${classes.activityBar} ${classes.issueBar}`}
        variant="determinate"
        value={barWidthPercent(data.openIssues, issueActivityMax)}
      />

      <Grid container spacing={2} style={{ marginTop: 8 }}>
        <Grid item xs={6} sm={3}>
          <Paper className={classes.statPaper} elevation={0} variant="outlined">
            <Typography className={classes.statValue} style={{ color: '#8957e5' }}>
              {data.mergedPrs}
            </Typography>
            <Typography className={classes.statLabel}>Merged PRs</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper className={classes.statPaper} elevation={0} variant="outlined">
            <Typography className={classes.statValue} style={{ color: '#3fb950' }}>
              {data.openPrs}
            </Typography>
            <Typography className={classes.statLabel}>Open PRs</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper className={classes.statPaper} elevation={0} variant="outlined">
            <Typography className={classes.statValue} style={{ color: '#8957e5' }}>
              {data.closedIssues}
            </Typography>
            <Typography className={classes.statLabel}>Closed issues</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper className={classes.statPaper} elevation={0} variant="outlined">
            <Typography className={classes.statValue} style={{ color: '#3fb950' }}>
              {data.newIssuesOpened}
            </Typography>
            <Typography className={classes.statLabel}>New issues</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Typography className={classes.sectionTitle}>Commits on {data.defaultBranch}</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Typography className={classes.commitSummary} paragraph>
            Excluding merges, <strong>{data.uniqueNonMergeAuthors}</strong> author
            {data.uniqueNonMergeAuthors === 1 ? '' : 's'} pushed{' '}
            <strong>{data.nonMergeCommitsOnDefault}</strong> commit
            {data.nonMergeCommitsOnDefault === 1 ? '' : 's'} to {data.defaultBranch}.{' '}
            <strong>{data.filesChanged}</strong> file{data.filesChanged === 1 ? '' : 's'} changed with{' '}
            <strong>{data.additions.toLocaleString()}</strong> additions and{' '}
            <strong>{data.deletions.toLocaleString()}</strong> deletions (diff vs. parent of oldest
            commit in this window).
          </Typography>
        </Grid>
        <Grid item xs={12} md={5}>
          <Box className={classes.chartWrap}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v}`, 'Commits']} labelFormatter={l => l} />
                <Bar dataKey="count" fill="#f7811f" radius={[4, 4, 0, 0]} name="Commits" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          {data.topAuthors.length > 0 && (
            <Box display="flex" flexWrap="wrap" justifyContent="center" style={{ gap: 6 }}>
              {data.topAuthors.map(a => (
                <Avatar
                  key={a.login}
                  src={a.avatarUrl}
                  title={`${a.login}: ${a.count} commits`}
                  style={{ width: 28, height: 28 }}
                >
                  {a.login.slice(0, 1).toUpperCase()}
                </Avatar>
              ))}
            </Box>
          )}
        </Grid>
      </Grid>

      {data.recentMergedPrs.length > 0 && (
        <>
          <Typography className={classes.sectionTitle}>
            {data.mergedPrs} Pull request{data.mergedPrs === 1 ? '' : 's'} merged
          </Typography>
          <List dense disablePadding>
            {data.recentMergedPrs.map(pr => (
              <ListItem key={pr.number} disableGutters>
                <ListItemText
                  primary={
                    <Link href={pr.url} target="_blank" rel="noopener noreferrer">
                      {pr.title}{' '}
                      <Typography component="span" variant="body2" color="textSecondary">
                        #{pr.number}
                      </Typography>
                    </Link>
                  }
                  secondary={
                    pr.mergedAt
                      ? `Merged ${relativeTime(pr.mergedAt)}${
                          pr.userLogin ? ` · ${pr.userLogin}` : ''
                        }`
                      : pr.userLogin
                  }
                />
              </ListItem>
            ))}
          </List>
        </>
      )}

      {data.openedIssues.length > 0 && (
        <>
          <Typography className={classes.sectionTitle}>
            {data.newIssuesOpened} Issue{data.newIssuesOpened === 1 ? '' : 's'} opened
          </Typography>
          <List dense disablePadding>
            {data.openedIssues.map(issue => (
              <ListItem key={issue.number} disableGutters>
                <ListItemAvatar>
                  <Avatar src={issue.userAvatarUrl} style={{ width: 32, height: 32 }}>
                    {(issue.userLogin ?? '?').slice(0, 1).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Link href={issue.url} target="_blank" rel="noopener noreferrer">
                      {issue.title}{' '}
                      <Typography component="span" variant="body2" color="textSecondary">
                        #{issue.number}
                      </Typography>
                    </Link>
                  }
                  secondary={
                    issue.createdAt
                      ? `Opened ${relativeTime(issue.createdAt)}${
                          issue.userLogin ? ` · ${issue.userLogin}` : ''
                        }`
                      : issue.userLogin
                  }
                />
              </ListItem>
            ))}
          </List>
        </>
      )}

      {data.recentMergedPrs.length === 0 && data.openedIssues.length === 0 && (
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 16 }}>
          No merges or new issues in this period.
        </Typography>
      )}
    </Box>
  );
}
