import type {
  ContributionStatus,
  TeamAnalytics,
  TeamMatchAnalytics,
  TeamSummary,
} from '@/lib/types';
import { formatPercent } from '@/lib/format';

export type RankMetricKey =
  | 'autoFuelApc'
  | 'autoCycleFuelCountAvg'
  | 'autoCycleCountAvg'
  | 'autoCycleAccuracy'
  | 'autoTowerReliability'
  | 'teleFuelApc'
  | 'teleCycleFuelCountAvg'
  | 'teleCycleCountAvg'
  | 'teleCycleAccuracy'
  | 'defenseScore'
  | 'failureCount'
  | 'failureRecovery';

const rankMetricConfig: Record<
  RankMetricKey,
  { direction: 'asc' | 'desc'; value: (team: TeamAnalytics) => number }
> = {
  autoFuelApc: {
    direction: 'desc',
    value: (team) => team.robot.autoFuelApc,
  },
  autoCycleFuelCountAvg: {
    direction: 'desc',
    value: (team) => team.robot.autoCycleFuelCountAvg ?? 0,
  },
  autoCycleCountAvg: {
    direction: 'desc',
    value: (team) => team.robot.autoCycleCountAvg,
  },
  autoCycleAccuracy: {
    direction: 'desc',
    value: (team) => team.robot.autoCycleAccuracy,
  },
  autoTowerReliability: {
    direction: 'desc',
    value: (team) => team.robot.autoTowerReliability,
  },
  teleFuelApc: {
    direction: 'desc',
    value: (team) => team.robot.teleFuelApc,
  },
  teleCycleFuelCountAvg: {
    direction: 'desc',
    value: (team) => team.robot.teleCycleFuelCountAvg ?? 0,
  },
  teleCycleCountAvg: {
    direction: 'desc',
    value: (team) => team.robot.teleCycleCountAvg,
  },
  teleCycleAccuracy: {
    direction: 'desc',
    value: (team) => team.robot.teleCycleAccuracy,
  },
  defenseScore: {
    direction: 'desc',
    value: (team) => team.robot.defenseScore,
  },
  failureCount: {
    direction: 'asc',
    value: (team) => team.robot.failureCount,
  },
  failureRecovery: {
    direction: 'desc',
    value: (team) => team.robot.failureRecovery,
  },
};

export function getCombinedApc(team: TeamAnalytics) {
  return team.robot.autoFuelApc + team.robot.teleFuelApc;
}

export type ContributionPhase = 'auto' | 'tele' | 'total';
export type ContributionMetric = 'ahp' | 'ehp';
export type ContributionStatMode = 'recent' | 'median';

function getContributionBucket(
  team: TeamAnalytics,
  phase: ContributionPhase,
  metric: ContributionMetric,
) {
  if (metric === 'ahp') {
    if (phase === 'auto') return team.robot.contribution.autoAhp;
    if (phase === 'tele') return team.robot.contribution.teleAhp;
    return team.robot.contribution.totalAhp;
  }

  if (phase === 'auto') return team.robot.contribution.autoEhp;
  if (phase === 'tele') return team.robot.contribution.teleEhp;
  return team.robot.contribution.totalEhp;
}

export function getContributionSummaryValue(
  team: TeamAnalytics,
  phase: ContributionPhase = 'total',
  metric: ContributionMetric = 'ahp',
  mode: ContributionStatMode = 'recent',
) {
  const bucket = getContributionBucket(team, phase, metric);
  return mode === 'median' ? bucket.median : bucket.recent;
}

export function getRecentActualContribution(
  team: TeamAnalytics,
  phase: ContributionPhase = 'total',
) {
  const value = getContributionSummaryValue(team, phase, 'ahp', 'recent');
  if (value !== null) {
    return value;
  }

  if (phase === 'auto') return team.robot.autoFuelApc;
  if (phase === 'tele') return team.robot.teleFuelApc;
  return getCombinedApc(team);
}

export function getMedianActualContribution(
  team: TeamAnalytics,
  phase: ContributionPhase = 'total',
) {
  return getContributionSummaryValue(team, phase, 'ahp', 'median');
}

export function getRecentEstimatedContribution(
  team: TeamAnalytics,
  phase: ContributionPhase = 'total',
) {
  return getContributionSummaryValue(team, phase, 'ehp', 'recent');
}

export function getMedianEstimatedContribution(
  team: TeamAnalytics,
  phase: ContributionPhase = 'total',
) {
  return getContributionSummaryValue(team, phase, 'ehp', 'median');
}

export function getMatchActualContribution(
  match: TeamMatchAnalytics,
  phase: ContributionPhase = 'total',
) {
  if (!match.contribution) {
    return null;
  }

  if (phase === 'auto') return match.contribution.auto.ahp;
  if (phase === 'tele') return match.contribution.tele.ahp;
  return match.contribution.totalAhp;
}

export function getMatchEstimatedContribution(
  match: TeamMatchAnalytics,
  phase: ContributionPhase = 'total',
) {
  if (!match.contribution) {
    return null;
  }

  if (phase === 'auto') return match.contribution.auto.ehp;
  if (phase === 'tele') return match.contribution.tele.ehp;
  return match.contribution.totalEhp;
}

export function formatContributionStatus(status: ContributionStatus | null | undefined) {
  switch (status) {
    case 'actual_full_alliance':
      return 'Actual score'
    case 'actual_with_partner_priors':
      return 'Actual with priors'
    case 'no_actual_score':
      return 'Awaiting actual score'
    case 'insufficient_alliance_data':
      return 'Limited alliance data'
    case 'missing_report':
    default:
      return 'Missing report'
  }
}

export function isHighConfidenceContribution(status: ContributionStatus | null | undefined) {
  return status === 'actual_full_alliance'
}

export function getCombinedCycles(team: TeamAnalytics) {
  return team.robot.autoCycleCountAvg + team.robot.teleCycleCountAvg;
}

export function getCombinedAccuracy(team: TeamAnalytics) {
  const totalCycles = getCombinedCycles(team);
  if (totalCycles <= 0) {
    return 0;
  }

  return (
    team.robot.autoCycleAccuracy * (team.robot.autoCycleCountAvg / totalCycles) +
    team.robot.teleCycleAccuracy * (team.robot.teleCycleCountAvg / totalCycles)
  );
}

export function computeTeamRanks(teams: TeamAnalytics[], teamKey: string) {
  const ranks: Partial<Record<RankMetricKey, number>> = {};

  (Object.keys(rankMetricConfig) as RankMetricKey[]).forEach((metricKey) => {
    const config = rankMetricConfig[metricKey];
    const sortedTeams = [...teams].sort((left, right) => {
      const difference = config.value(left) - config.value(right);
      return config.direction === 'asc' ? difference : -difference;
    });

    const teamIndex = sortedTeams.findIndex((team) => team.teamKey === teamKey);
    if (teamIndex >= 0) {
      ranks[metricKey] = teamIndex + 1;
    }
  });

  return ranks;
}

export function formatAutoPathLabel(autoPath: string) {
  return autoPath
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function getAutoPathRows(team: TeamAnalytics) {
  return [
    { key: 'single_left', label: 'Single Left', count: team.robot.autoPathSingleLeftCount },
    { key: 'single_right', label: 'Single Right', count: team.robot.autoPathSingleRightCount },
    { key: 'double_left', label: 'Double Left', count: team.robot.autoPathDoubleLeftCount },
    { key: 'double_right', label: 'Double Right', count: team.robot.autoPathDoubleRightCount },
    { key: 'outpost', label: 'Outpost', count: team.robot.autoPathOutpostCount },
    { key: 'depot', label: 'Depot', count: team.robot.autoPathDepotCount },
    {
      key: 'outpost_and_depot',
      label: 'Outpost + Depot',
      count: team.robot.autoPathOutpostAndDepotCount,
    },
    { key: 'preload', label: 'Preload', count: team.robot.autoPathPreloadCount },
    { key: 'no_path', label: 'No Path', count: team.robot.autoPathNoPathCount },
  ];
}

export function getMostUsedAutoPath(team: TeamAnalytics) {
  const rows = getAutoPathRows(team).sort((left, right) => right.count - left.count);
  return rows[0] && rows[0].count > 0 ? rows[0] : null;
}

export function formatMatchLabel(matchKey: string, fallbackNumber?: number) {
  const suffix = matchKey.split('_').pop() ?? matchKey;

  const qualificationMatch = /^qm(\d+)$/.exec(suffix);
  if (qualificationMatch) {
    return `QM ${qualificationMatch[1]}`;
  }

  if (typeof fallbackNumber === 'number' && Number.isFinite(fallbackNumber)) {
    return `M${fallbackNumber}`;
  }

  return suffix.toUpperCase();
}

export function getSummaryHeadline(summary: TeamSummary | null) {
  if (!summary) {
    return 'Summary not available.';
  }

  const summaryText = summary.summaryText?.trim();
  if (summaryText) {
    return summaryText;
  }

  const firstStrength = summary.notes.strengths[0];
  if (firstStrength) {
    return firstStrength;
  }

  const firstAllianceFit = summary.notes.allianceFit[0];
  if (firstAllianceFit) {
    return firstAllianceFit;
  }

  const firstConcern = summary.notes.concerns[0];
  if (firstConcern) {
    return firstConcern;
  }

  return 'Summary not available.';
}

export function getSummaryStatusLabel(summary: TeamSummary | null) {
  switch (summary?.status) {
    case 'established':
      return 'Detailed';
    case 'tentative':
      return 'Early';
    default:
      return 'Limited';
  }
}

export function getSummaryEvidenceCount(summary: TeamSummary | null) {
  if (!summary) {
    return 0;
  }

  return (
    summary.evidence.generalNoteCount +
    summary.evidence.defenseNoteCount +
    summary.evidence.scoutNoteCount
  );
}

export function hasSummaryContent(summary: TeamSummary | null) {
  if (!summary) {
    return false;
  }

  return Boolean(summary.summaryText?.trim()) ||
    summary.defense.length > 0 ||
    summary.notes.strengths.length > 0 ||
    summary.notes.concerns.length > 0 ||
    summary.notes.allianceFit.length > 0 ||
    summary.notes.isolatedNotes.length > 0;
}

export type TrendMetricKey =
  | 'totalActualContribution'
  | 'totalEstimatedContribution'
  | 'autoActualContribution'
  | 'autoEstimatedContribution'
  | 'teleActualContribution'
  | 'teleEstimatedContribution'
  | 'autoCycleCount'
  | 'autoFuelTotal'
  | 'autoFuelPerCycle'
  | 'teleCycleCount'
  | 'teleFuelTotal'
  | 'teleFuelPerCycle'
  | 'defenseScore'
  | 'failureCount';

export const trendMetricOptions: Array<{
  key: TrendMetricKey;
  label: string;
  value: (match: TeamMatchAnalytics) => number | null;
  format: (value: number) => string;
}> = [
  {
    key: 'totalActualContribution',
    label: 'Actual Contribution',
    value: (match) => getMatchActualContribution(match),
    format: (value) => value.toFixed(1),
  },
  {
    key: 'totalEstimatedContribution',
    label: 'Estimated Contribution',
    value: (match) => getMatchEstimatedContribution(match),
    format: (value) => value.toFixed(1),
  },
  {
    key: 'autoActualContribution',
    label: 'Auto Actual Contribution',
    value: (match) => getMatchActualContribution(match, 'auto'),
    format: (value) => value.toFixed(1),
  },
  {
    key: 'autoEstimatedContribution',
    label: 'Auto Estimated Contribution',
    value: (match) => getMatchEstimatedContribution(match, 'auto'),
    format: (value) => value.toFixed(1),
  },
  {
    key: 'teleActualContribution',
    label: 'Tele Actual Contribution',
    value: (match) => getMatchActualContribution(match, 'tele'),
    format: (value) => value.toFixed(1),
  },
  {
    key: 'teleEstimatedContribution',
    label: 'Tele Estimated Contribution',
    value: (match) => getMatchEstimatedContribution(match, 'tele'),
    format: (value) => value.toFixed(1),
  },
  {
    key: 'autoCycleCount',
    label: 'Auto Cycle Count',
    value: (match) => match.robot?.auto.cycles.cycleCount ?? null,
    format: (value) => value.toFixed(0),
  },
  {
    key: 'autoFuelTotal',
    label: 'Auto Fuel Total',
    value: (match) =>
      match.robot
        ? match.robot.auto.cycles.cycleCount * (match.robot.auto.cycles.fuelCountAvg ?? 0)
        : null,
    format: (value) => value.toFixed(1),
  },
  {
    key: 'autoFuelPerCycle',
    label: 'Auto Fuel/Cycle',
    value: (match) => match.robot?.auto.cycles.fuelCountAvg ?? null,
    format: (value) => value.toFixed(1),
  },
  {
    key: 'teleCycleCount',
    label: 'Tele Cycle Count',
    value: (match) => match.robot?.tele.cycles.cycleCount ?? null,
    format: (value) => value.toFixed(0),
  },
  {
    key: 'teleFuelTotal',
    label: 'Tele Fuel Total',
    value: (match) =>
      match.robot
        ? match.robot.tele.cycles.cycleCount * (match.robot.tele.cycles.fuelCountAvg ?? 0)
        : null,
    format: (value) => value.toFixed(1),
  },
  {
    key: 'teleFuelPerCycle',
    label: 'Tele Fuel/Cycle',
    value: (match) => match.robot?.tele.cycles.fuelCountAvg ?? null,
    format: (value) => value.toFixed(1),
  },
  {
    key: 'defenseScore',
    label: 'Defense Score',
    value: (match) => match.robot?.defense.calculatedScore ?? null,
    format: (value) => value.toFixed(1),
  },
  {
    key: 'failureCount',
    label: 'Failure Count',
    value: (match) => match.robot?.failures.count ?? null,
    format: (value) => value.toFixed(0),
  },
];

export type TrendRangeKey = 'all' | 'last3' | 'last5' | 'last8';

export const trendRangeOptions: Array<{
  key: TrendRangeKey;
  label: string;
  count: number;
}> = [
  { key: 'all', label: 'All Matches', count: -1 },
  { key: 'last3', label: 'Last 3', count: 3 },
  { key: 'last5', label: 'Last 5', count: 5 },
  { key: 'last8', label: 'Last 8', count: 8 },
];

export function getTrendMatches(matches: TeamMatchAnalytics[], range: TrendRangeKey) {
  const rangeOption =
    trendRangeOptions.find((option) => option.key === range) ?? trendRangeOptions[0];

  if (rangeOption.count === -1) {
    return matches;
  }

  return matches.slice(-rangeOption.count);
}

export function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function trend(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const midpoint = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, midpoint);
  const secondHalf = values.slice(midpoint);
  const firstAverage = average(firstHalf);
  const secondAverage = average(secondHalf);

  if (Math.abs(firstAverage) < 0.001) {
    return 0;
  }

  return ((secondAverage - firstAverage) / firstAverage) * 100;
}

export function formatRank(rank: number | undefined) {
  return typeof rank === 'number' ? `#${rank}` : null;
}

export function formatAccuracy(value: number) {
  return formatPercent(value);
}
