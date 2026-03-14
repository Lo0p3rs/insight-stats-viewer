import type { TeamAnalytics, TeamDetail, TeamMatchAnalytics } from '@/lib/types';

export type TeamSortMode = 'rank' | 'opr' | 'tele' | 'auto' | 'defense';

export type PerformanceMetricKey =
  | 'autoCycleScore'
  | 'teleCycleScore'
  | 'autoAccuracy'
  | 'teleAccuracy'
  | 'autoCycleRate'
  | 'teleCycleRate'
  | 'intakeDefenseEffectiveness'
  | 'scoringDefenseEffectiveness'
  | 'failureCount';

export type MatchRangeKey = 'all' | 'last3' | 'last5' | 'last8';

export const performanceMetricOptions: Array<{
  key: PerformanceMetricKey;
  label: string;
  accessor: (match: TeamMatchAnalytics) => number | null;
  formatter: (value: number) => string;
}> = [
  {
    key: 'autoCycleScore',
    label: 'Auto Cycle Score',
    accessor: (match) => match.robot?.auto.cycles.cycleScoreAvg ?? null,
    formatter: (value) => value.toFixed(1),
  },
  {
    key: 'teleCycleScore',
    label: 'Tele Cycle Score',
    accessor: (match) => match.robot?.tele.cycles.cycleScoreAvg ?? null,
    formatter: (value) => value.toFixed(1),
  },
  {
    key: 'autoAccuracy',
    label: 'Auto Accuracy',
    accessor: (match) => match.robot?.auto.cycles.accuracyAvg ?? null,
    formatter: (value) => `${(value * 100).toFixed(0)}%`,
  },
  {
    key: 'teleAccuracy',
    label: 'Tele Accuracy',
    accessor: (match) => match.robot?.tele.cycles.accuracyAvg ?? null,
    formatter: (value) => `${(value * 100).toFixed(0)}%`,
  },
  {
    key: 'autoCycleRate',
    label: 'Auto Cycle Rate',
    accessor: (match) => match.robot?.auto.cycles.rateAvg ?? null,
    formatter: (value) => value.toFixed(1),
  },
  {
    key: 'teleCycleRate',
    label: 'Tele Cycle Rate',
    accessor: (match) => match.robot?.tele.cycles.rateAvg ?? null,
    formatter: (value) => value.toFixed(1),
  },
  {
    key: 'intakeDefenseEffectiveness',
    label: 'Intake Defense Effectiveness',
    accessor: (match) => match.robot?.defense.intake.effNum ?? null,
    formatter: (value) => value.toFixed(1),
  },
  {
    key: 'scoringDefenseEffectiveness',
    label: 'Scoring Defense Effectiveness',
    accessor: (match) => match.robot?.defense.offense.effNum ?? null,
    formatter: (value) => value.toFixed(1),
  },
  {
    key: 'failureCount',
    label: 'Failure Count',
    accessor: (match) => match.robot?.failures.count ?? null,
    formatter: (value) => value.toFixed(0),
  },
];

export const matchRangeOptions: Array<{
  key: MatchRangeKey;
  label: string;
  count: number;
}> = [
  { key: 'all', label: 'All Matches', count: -1 },
  { key: 'last3', label: 'Last 3', count: 3 },
  { key: 'last5', label: 'Last 5', count: 5 },
  { key: 'last8', label: 'Last 8', count: 8 },
];

export function qualificationMatches(detail: TeamDetail | null) {
  return detail
    ? [...detail.matches]
        .filter((match) => match.level === 'qm')
        .sort((a, b) => a.matchSort - b.matchSort)
    : [];
}

export function filterTeams(teams: TeamAnalytics[], query: string) {
  if (!query.trim()) return teams;
  const normalizedQuery = query.trim().toLowerCase();
  return teams.filter((team) => {
    const name = team.name.toLowerCase();
    return (
      name.includes(normalizedQuery) ||
      team.teamKey.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function sortTeams(teams: TeamAnalytics[], sortMode: TeamSortMode) {
  const list = [...teams];

  switch (sortMode) {
    case 'rank':
      list.sort((a, b) => a.tba.rank - b.tba.rank);
      break;
    case 'opr':
      list.sort((a, b) => b.tba.opr - a.tba.opr);
      break;
    case 'tele':
      list.sort((a, b) => b.robot.teleCycleScore - a.robot.teleCycleScore);
      break;
    case 'auto':
      list.sort((a, b) => b.robot.autoCycleScore - a.robot.autoCycleScore);
      break;
    case 'defense':
      list.sort((a, b) => b.robot.totalDefenseScore - a.robot.totalDefenseScore);
      break;
    default:
      break;
  }

  return list;
}

export function getMaxMetric(teams: TeamAnalytics[], extractor: (team: TeamAnalytics) => number) {
  return teams.reduce((max, team) => Math.max(max, extractor(team)), 0);
}

export function calculateTeamCardMetrics(teams: TeamAnalytics[], team: TeamAnalytics) {
  const maxAuto = getMaxMetric(teams, (entry) => entry.robot.autoCycleScore);
  const maxTele = getMaxMetric(teams, (entry) => entry.robot.teleCycleScore);
  const maxDefense = getMaxMetric(teams, (entry) => entry.robot.totalDefenseScore);
  const maxFailure = getMaxMetric(teams, (entry) => entry.robot.failureCount);

  const safePercent = (value: number, maxValue: number) =>
    maxValue > 0 ? Math.min(1, value / maxValue) : 0;

  return {
    auto: safePercent(team.robot.autoCycleScore, maxAuto),
    tele: safePercent(team.robot.teleCycleScore, maxTele),
    defense: safePercent(team.robot.totalDefenseScore, maxDefense),
    reliable:
      maxFailure > 0 ? Math.max(0, 1 - team.robot.failureCount / maxFailure) : 1,
  };
}

export function getMatchRange(matches: TeamMatchAnalytics[], range: MatchRangeKey) {
  const option = matchRangeOptions.find((entry) => entry.key === range) ?? matchRangeOptions[0];
  if (option.count === -1) return matches;
  return matches.slice(-option.count);
}

export function getMetricSeries(
  matches: TeamMatchAnalytics[],
  metricKey: PerformanceMetricKey,
) {
  const metric = performanceMetricOptions.find((entry) => entry.key === metricKey) ?? performanceMetricOptions[0];
  return matches
    .map((match) => ({
      match,
      value: metric.accessor(match),
    }))
    .filter(
      (entry): entry is { match: TeamMatchAnalytics; value: number } =>
        entry.value !== null && !Number.isNaN(entry.value),
    );
}

export function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function trend(values: number[]) {
  if (values.length < 2) return 0;
  const midpoint = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, midpoint);
  const secondHalf = values.slice(midpoint);
  const firstAverage = average(firstHalf);
  const secondAverage = average(secondHalf);
  if (Math.abs(firstAverage) < 0.001) return 0;
  return ((secondAverage - firstAverage) / firstAverage) * 100;
}

export type RankedMetric = {
  label: string;
  value: string;
  rank: number | null;
  rankLabel: string;
  tone: 'good' | 'mid' | 'low';
};

function buildRankedMetric(
  teams: TeamAnalytics[],
  team: TeamAnalytics,
  label: string,
  extractor: (entry: TeamAnalytics) => number,
  formatter: (value: number) => string,
) {
  const sorted = [...teams].sort((a, b) => extractor(b) - extractor(a));
  const index = sorted.findIndex((entry) => entry.teamKey === team.teamKey);
  const rank = index === -1 ? null : index + 1;
  const percentile = rank === null ? 1 : rank / Math.max(1, sorted.length);
  const tone =
    percentile <= 0.2 ? 'good' : percentile <= 0.5 ? 'mid' : 'low';

  return {
    label,
    value: formatter(extractor(team)),
    rank,
    rankLabel: rank === null ? 'Unranked' : `#${rank} of ${sorted.length}`,
    tone,
  } satisfies RankedMetric;
}

export function buildTeamStatMetrics(teams: TeamAnalytics[], team: TeamAnalytics) {
  return [
    buildRankedMetric(teams, team, 'OPR', (entry) => entry.tba.opr, (value) => value.toFixed(1)),
    buildRankedMetric(
      teams,
      team,
      'Auto Cycle Score',
      (entry) => entry.robot.autoCycleScore,
      (value) => value.toFixed(1),
    ),
    buildRankedMetric(
      teams,
      team,
      'Tele Cycle Score',
      (entry) => entry.robot.teleCycleScore,
      (value) => value.toFixed(1),
    ),
    buildRankedMetric(
      teams,
      team,
      'Defense Score',
      (entry) => entry.robot.totalDefenseScore,
      (value) => value.toFixed(1),
    ),
    buildRankedMetric(
      teams,
      team,
      'Auto Accuracy',
      (entry) => entry.robot.autoCycleAccuracy,
      (value) => `${(value * 100).toFixed(0)}%`,
    ),
    buildRankedMetric(
      teams,
      team,
      'Tele Accuracy',
      (entry) => entry.robot.teleCycleAccuracy,
      (value) => `${(value * 100).toFixed(0)}%`,
    ),
    buildRankedMetric(
      teams,
      team,
      'Human Accuracy',
      (entry) => entry.humanPlayer.accuracy,
      (value) => `${(value * 100).toFixed(0)}%`,
    ),
    buildRankedMetric(
      teams,
      team,
      'Reliability',
      (entry) => 1 - entry.robot.failureCount / Math.max(1, entry.robot.failureCount + 1),
      (value) => `${(value * 100).toFixed(0)}%`,
    ),
  ];
}
