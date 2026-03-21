import type { MatchCounts } from '@/lib/event-stats';
import type { TeamAnalytics, TeamDetail, TeamMatchAnalytics } from '@/lib/types';

export type AllianceFitTone = 'high' | 'mid' | 'low';

export type AllianceFitResult = {
  score: number;
  tone: AllianceFitTone;
  headline: string;
  summary: string;
  breakdown: Array<{
    label: string;
    score: number;
    detail: string;
  }>;
  assignments: Array<{
    role: string;
    teamKey: string;
    statLabel: string;
    statValue: string;
  }>;
  risks: string[];
};

export type TrendAlert = {
  teamKey: string;
  variant: 'up' | 'down' | 'defense' | 'risk';
  title: string;
  detail: string;
  deltaLabel: string;
  supportLabel: string;
  sortScore: number;
};

export type PredictedWinner = 'red' | 'blue';

export type MatchPredictionConfidence = 'high' | 'medium' | 'low';

export type MatchPredictionEdge = {
  label: string;
  winner: PredictedWinner | 'even';
  redScore: number;
  blueScore: number;
  detail: string;
};

export type MatchPredictionAllianceReport = {
  fit: AllianceFitResult;
  strengths: string[];
  weaknesses: string[];
  metrics: Array<{
    label: string;
    value: string;
  }>;
};

export type MatchPredictionResult = {
  winner: PredictedWinner;
  confidence: MatchPredictionConfidence;
  edgeLabel: string;
  summary: string;
  rationale: string[];
  red: MatchPredictionAllianceReport;
  blue: MatchPredictionAllianceReport;
  edges: MatchPredictionEdge[];
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxValue(values: number[]) {
  return values.reduce((best, value) => Math.max(best, value), 0);
}

function toPercentLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getMatchPhaseScore(match: TeamMatchAnalytics, phase: 'auto' | 'tele') {
  const data = match.robot?.[phase];
  if (!data) {
    return 0;
  }

  return data.cycles.cycleCount * data.cycles.cycleScoreAvg;
}

function getMatchOffenseScore(match: TeamMatchAnalytics) {
  return getMatchPhaseScore(match, 'auto') + getMatchPhaseScore(match, 'tele');
}

function getMatchDefenseScore(match: TeamMatchAnalytics) {
  if (!match.robot) {
    return 0;
  }

  return match.robot.defense.intake.effNum + match.robot.defense.offense.effNum;
}

function getScoutedQualificationMatches(detail: TeamDetail) {
  return [...detail.matches]
    .filter((match) => match.level === 'qm' && match.robot)
    .sort((left, right) => left.matchSort - right.matchSort);
}

function buildRecentTrend(values: number[]) {
  if (values.length < 4) {
    return null;
  }

  const windowSize = Math.min(3, Math.floor(values.length / 2));
  if (windowSize < 2) {
    return null;
  }

  const recent = values.slice(-windowSize);
  const previous = values.slice(-(windowSize * 2), -windowSize);
  if (previous.length === 0 || recent.length === 0) {
    return null;
  }

  const previousAverage = average(previous);
  const recentAverage = average(recent);
  const denominator = Math.max(1, Math.abs(previousAverage));
  const delta = ((recentAverage - previousAverage) / denominator) * 100;

  return {
    recentAverage,
    previousAverage,
    delta,
    windowSize,
  };
}

function reliabilityScore(team: TeamAnalytics, fieldTeams: TeamAnalytics[]) {
  const maxFailureCount = Math.max(
    1,
    ...fieldTeams.map((entry) => entry.robot.failureCount),
  );
  const failureFloor = 1 - team.robot.failureCount / maxFailureCount;
  const towerReliability =
    (team.robot.autoTowerReliability + team.robot.teleTowerReliability) / 2;

  return clamp(
    failureFloor * 0.5 +
      team.robot.failureRecovery * 0.25 +
      towerReliability * 0.25,
  );
}

function normalizedScore(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }

  return clamp(value / max);
}

type AllianceScoreKey = 'auto' | 'tele' | 'defense' | 'reliability';

function summarizeWeakSpot(label: string) {
  switch (label) {
    case 'Auto':
      return 'auto output is still shallow';
    case 'Teleop':
      return 'teleop scoring needs a clearer closer';
    case 'Defense':
      return 'there is no clear defense anchor yet';
    case 'Reliability':
      return 'failure risk is still the main concern';
    default:
      return 'there is still a visible gap';
  }
}

function normalizedRankingScore(team: TeamAnalytics, fieldTeams: TeamAnalytics[]) {
  const maxOpr = Math.max(1, ...fieldTeams.map((entry) => entry.tba.opr));
  const rankScore =
    team.tba.rank > 0
      ? 1 - (team.tba.rank - 1) / Math.max(1, fieldTeams.length - 1)
      : 0.5;
  const oprScore = normalizedScore(team.tba.opr, maxOpr);
  return clamp(rankScore * 0.45 + oprScore * 0.55);
}

function getBreakdownScore(fit: AllianceFitResult, label: string) {
  return fit.breakdown.find((entry) => entry.label === label)?.score ?? 0;
}

function strengthCopy(label: string) {
  switch (label) {
    case 'Auto':
      return 'Auto pressure is the clearest early edge.';
    case 'Teleop':
      return 'Teleop ceiling gives this alliance its best carry path.';
    case 'Defense':
      return 'There is a real defensive answer if the match turns ugly.';
    case 'Reliability':
      return 'The floor stays playable even if one robot slips a cycle.';
    case 'Role Spread':
      return 'The roles are distributed cleanly across the lineup.';
    default:
      return 'This is one of the strongest categories on paper.';
  }
}

function weaknessCopy(label: string) {
  switch (label) {
    case 'Auto':
      return 'Auto is the easiest place for this alliance to fall behind.';
    case 'Teleop':
      return 'Teleop depth is thinner than the rest of the profile.';
    case 'Defense':
      return 'There is no obvious shutdown defender in this lineup.';
    case 'Reliability':
      return 'Reliability is the main way this alliance can lose control of the match.';
    case 'Role Spread':
      return 'Too much responsibility still sits on one robot.';
    default:
      return 'This is one of the weaker categories on paper.';
  }
}

function buildAllianceNarrative(fit: AllianceFitResult) {
  const strongest = [...fit.breakdown]
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((entry) => strengthCopy(entry.label));
  const weaknesses = fit.risks.length > 0
    ? fit.risks.slice(0, 2)
    : [...fit.breakdown]
        .sort((left, right) => left.score - right.score)
        .slice(0, 2)
        .map((entry) => weaknessCopy(entry.label));

  return {
    strengths: strongest,
    weaknesses,
  };
}

function buildAllianceReport(
  fieldTeams: TeamAnalytics[],
  selectedTeams: TeamAnalytics[],
) {
  const fit = buildAllianceFit(fieldTeams, selectedTeams);
  if (!fit) {
    return null;
  }

  const rankingAverage = average(
    selectedTeams.map((team) => normalizedRankingScore(team, fieldTeams)),
  );
  const narrative = buildAllianceNarrative(fit);

  return {
    fit,
    strengths: narrative.strengths,
    weaknesses: narrative.weaknesses,
    metrics: [
      { label: 'Fit', value: `${fit.score}` },
      { label: 'Auto', value: `${getBreakdownScore(fit, 'Auto')}` },
      { label: 'Tele', value: `${getBreakdownScore(fit, 'Teleop')}` },
      { label: 'Defense', value: `${getBreakdownScore(fit, 'Defense')}` },
      { label: 'Reliability', value: `${getBreakdownScore(fit, 'Reliability')}` },
      { label: 'Ranking', value: toPercentLabel(rankingAverage) },
    ],
  } satisfies MatchPredictionAllianceReport;
}

function categoryEdge(
  label: string,
  redScore: number,
  blueScore: number,
  detail: string,
): MatchPredictionEdge {
  const diff = redScore - blueScore;
  return {
    label,
    redScore,
    blueScore,
    detail,
    winner: Math.abs(diff) < 3 ? 'even' : diff > 0 ? 'red' : 'blue',
  };
}

function confidenceLabel(margin: number): MatchPredictionConfidence {
  if (margin >= 9) {
    return 'high';
  }
  if (margin >= 4) {
    return 'medium';
  }
  return 'low';
}

function edgeLabel(margin: number) {
  if (margin >= 9) {
    return 'Clear edge';
  }
  if (margin >= 4) {
    return 'Solid edge';
  }
  return 'Slight edge';
}

function winnerLabel(side: PredictedWinner) {
  return side === 'red' ? 'Red alliance' : 'Blue alliance';
}

function edgeReason(label: string, side: PredictedWinner | 'even') {
  if (side === 'even') {
    return `${label} is effectively even.`;
  }

  return `${winnerLabel(side)} has the cleaner ${label.toLowerCase()} profile.`;
}

export function buildAllianceFit(
  fieldTeams: TeamAnalytics[],
  selectedTeams: TeamAnalytics[],
): AllianceFitResult | null {
  if (selectedTeams.length < 2 || fieldTeams.length === 0) {
    return null;
  }

  const maxAuto = maxValue(fieldTeams.map((team) => team.robot.autoFuelApc));
  const maxTele = maxValue(fieldTeams.map((team) => team.robot.teleFuelApc));
  const maxDefense = maxValue(fieldTeams.map((team) => team.robot.totalDefenseScore));

  const scoredTeams = selectedTeams.map((team) => ({
    team,
    auto: normalizedScore(team.robot.autoFuelApc, maxAuto),
    tele: normalizedScore(team.robot.teleFuelApc, maxTele),
    defense: normalizedScore(team.robot.totalDefenseScore, maxDefense),
    reliability: reliabilityScore(team, fieldTeams),
  }));

  const autoScores = scoredTeams.map((entry) => entry.auto);
  const teleScores = scoredTeams.map((entry) => entry.tele);
  const defenseScores = scoredTeams.map((entry) => entry.defense);
  const reliabilityScores = scoredTeams.map((entry) => entry.reliability);

  const autoCoverage = clamp(maxValue(autoScores) * 0.65 + average(autoScores) * 0.35);
  const teleCoverage = clamp(maxValue(teleScores) * 0.65 + average(teleScores) * 0.35);
  const defenseCoverage = clamp(
    maxValue(defenseScores) * 0.7 + average(defenseScores) * 0.3,
  );
  const reliabilityCoverage = clamp(average(reliabilityScores));

  type ScoredTeam = (typeof scoredTeams)[number];

  const leadAssignments: Array<{
    role: string;
    statLabel: string;
    scoreKey: AllianceScoreKey;
    format: (entry: ScoredTeam) => string;
  }> = [
    {
      role: 'Auto Lead',
      statLabel: 'Auto APC',
      scoreKey: 'auto',
      format: (entry) => entry.team.robot.autoFuelApc.toFixed(1),
    },
    {
      role: 'Tele Carry',
      statLabel: 'Tele APC',
      scoreKey: 'tele',
      format: (entry) => entry.team.robot.teleFuelApc.toFixed(1),
    },
    {
      role: 'Defense Anchor',
      statLabel: 'Defense',
      scoreKey: 'defense',
      format: (entry) => entry.team.robot.totalDefenseScore.toFixed(1),
    },
    {
      role: 'Safety Floor',
      statLabel: 'Reliability',
      scoreKey: 'reliability',
      format: (entry) => toPercentLabel(entry.reliability),
    },
  ];

  const assignments = leadAssignments.map((assignment) => {
    const leader = [...scoredTeams].sort(
      (left, right) => right[assignment.scoreKey] - left[assignment.scoreKey],
    )[0]!;

    return {
      role: assignment.role,
      teamKey: leader.team.teamKey,
      statLabel: assignment.statLabel,
      statValue: assignment.format(leader),
    };
  });

  const uniqueLeaderCount = new Set(assignments.map((assignment) => assignment.teamKey)).size;
  const roleSpread = clamp(uniqueLeaderCount / selectedTeams.length);

  const contributionTotals = scoredTeams.map(
    (entry) => entry.auto + entry.tele + entry.defense + entry.reliability,
  );
  const contributionSum = contributionTotals.reduce((sum, value) => sum + value, 0);
  const contributionShares =
    contributionSum > 0
      ? contributionTotals.map((value) => value / contributionSum)
      : contributionTotals.map(() => 1 / contributionTotals.length);
  const idealShare = 1 / contributionShares.length;
  const averageShareDeviation = average(
    contributionShares.map((share) => Math.abs(share - idealShare)),
  );
  const loadBalance = clamp(1 - averageShareDeviation / idealShare);
  const synergy = clamp(
    roleSpread * 0.5 + loadBalance * 0.3 + Math.min(autoCoverage, teleCoverage) * 0.2,
  );

  const breakdown = [
    {
      label: 'Auto',
      score: Math.round(autoCoverage * 100),
      detail: 'Opening burst and first-task coverage.',
    },
    {
      label: 'Teleop',
      score: Math.round(teleCoverage * 100),
      detail: 'Sustained scoring ceiling through the match.',
    },
    {
      label: 'Defense',
      score: Math.round(defenseCoverage * 100),
      detail: 'Ability to absorb or apply pressure without stalling the alliance.',
    },
    {
      label: 'Reliability',
      score: Math.round(reliabilityCoverage * 100),
      detail: 'Failure resistance and recovery floor.',
    },
    {
      label: 'Role Spread',
      score: Math.round(synergy * 100),
      detail: 'How well the workload is distributed across distinct roles.',
    },
  ];

  const overallScore = Math.round(
    (autoCoverage * 0.24 +
      teleCoverage * 0.24 +
      defenseCoverage * 0.18 +
      reliabilityCoverage * 0.18 +
      synergy * 0.16) *
      100,
  );

  const weakestBreakdown = [...breakdown].sort((left, right) => left.score - right.score)[0]!;
  const risks: string[] = [];
  if (defenseCoverage < 0.45) {
    risks.push('No defender-grade partner is separating from the group yet.');
  }
  if (reliabilityCoverage < 0.55) {
    risks.push('This combination still carries meaningful failure risk.');
  }
  if (synergy < 0.58) {
    risks.push('One robot is still carrying too many roles on paper.');
  }
  if (Math.min(autoCoverage, teleCoverage) < 0.45) {
    risks.push(`The scoring profile is lopsided: ${summarizeWeakSpot(weakestBreakdown.label)}.`);
  }

  const tone: AllianceFitTone =
    overallScore >= 80 ? 'high' : overallScore >= 65 ? 'mid' : 'low';
  const headline =
    overallScore >= 80
      ? 'Strong complementary fit'
      : overallScore >= 65
        ? 'Playable fit with one clear gap'
        : 'Fit is still fragile';
  const summary =
    risks[0] ??
    (overallScore >= 80
      ? 'The selected robots cover scoring, support, and risk control well enough to plan around.'
      : `The main gap is that ${summarizeWeakSpot(weakestBreakdown.label)}.`);

  return {
    score: overallScore,
    tone,
    headline,
    summary,
    breakdown,
    assignments,
    risks,
  };
}

export function buildMatchPrediction(
  fieldTeams: TeamAnalytics[],
  redTeams: TeamAnalytics[],
  blueTeams: TeamAnalytics[],
): MatchPredictionResult | null {
  if (fieldTeams.length === 0 || redTeams.length < 3 || blueTeams.length < 3) {
    return null;
  }

  const red = buildAllianceReport(fieldTeams, redTeams);
  const blue = buildAllianceReport(fieldTeams, blueTeams);
  if (!red || !blue) {
    return null;
  }

  const redRanking = Number(red.metrics.find((metric) => metric.label === 'Ranking')?.value.replace('%', '') ?? '0');
  const blueRanking = Number(blue.metrics.find((metric) => metric.label === 'Ranking')?.value.replace('%', '') ?? '0');

  const edges = [
    categoryEdge(
      'Auto',
      getBreakdownScore(red.fit, 'Auto'),
      getBreakdownScore(blue.fit, 'Auto'),
      'Opening burst and first-cycle pressure.',
    ),
    categoryEdge(
      'Teleop',
      getBreakdownScore(red.fit, 'Teleop'),
      getBreakdownScore(blue.fit, 'Teleop'),
      'Sustained scoring once the match settles.',
    ),
    categoryEdge(
      'Defense',
      getBreakdownScore(red.fit, 'Defense'),
      getBreakdownScore(blue.fit, 'Defense'),
      'Ability to pressure the opponent without collapsing your own flow.',
    ),
    categoryEdge(
      'Reliability',
      getBreakdownScore(red.fit, 'Reliability'),
      getBreakdownScore(blue.fit, 'Reliability'),
      'Who is more likely to preserve a stable floor under stress.',
    ),
    categoryEdge(
      'Role Spread',
      getBreakdownScore(red.fit, 'Role Spread'),
      getBreakdownScore(blue.fit, 'Role Spread'),
      'Whether the workload is shared cleanly across all three robots.',
    ),
    categoryEdge(
      'Ranking',
      redRanking,
      blueRanking,
      'Event strength and rank-backed ceiling.',
    ),
  ];

  const redIndex =
    getBreakdownScore(red.fit, 'Auto') * 0.2 +
    getBreakdownScore(red.fit, 'Teleop') * 0.26 +
    getBreakdownScore(red.fit, 'Defense') * 0.16 +
    getBreakdownScore(red.fit, 'Reliability') * 0.16 +
    getBreakdownScore(red.fit, 'Role Spread') * 0.12 +
    redRanking * 0.1;
  const blueIndex =
    getBreakdownScore(blue.fit, 'Auto') * 0.2 +
    getBreakdownScore(blue.fit, 'Teleop') * 0.26 +
    getBreakdownScore(blue.fit, 'Defense') * 0.16 +
    getBreakdownScore(blue.fit, 'Reliability') * 0.16 +
    getBreakdownScore(blue.fit, 'Role Spread') * 0.12 +
    blueRanking * 0.1;

  const winner: PredictedWinner = redIndex >= blueIndex ? 'red' : 'blue';
  const margin = Math.abs(redIndex - blueIndex);
  const confidence = confidenceLabel(margin);
  const sortedEdges = [...edges].sort(
    (left, right) => Math.abs((right.redScore - right.blueScore)) - Math.abs(left.redScore - left.blueScore),
  );
  const rationale = sortedEdges
    .filter((edge) => edge.winner === winner)
    .slice(0, 3)
    .map((edge) => edgeReason(edge.label, edge.winner));
  const summary =
    rationale[0] ??
    `${winnerLabel(winner)} is the projection, but the matchup is still thin enough to swing on execution.`;

  return {
    winner,
    confidence,
    edgeLabel: edgeLabel(margin),
    summary,
    rationale,
    red,
    blue,
    edges,
  };
}

export function buildTrendAlerts(
  teams: TeamAnalytics[],
  details: TeamDetail[],
  countsMap: Record<string, MatchCounts> = {},
) {
  const teamByKey = Object.fromEntries(teams.map((team) => [team.teamKey, team]));

  return details
    .map<TrendAlert | null>((detail) => {
      const team = teamByKey[detail.teamKey];
      if (!team) {
        return null;
      }

      const matches = getScoutedQualificationMatches(detail);
      if (matches.length < 4) {
        return null;
      }

      const offenseTrend = buildRecentTrend(matches.map((match) => getMatchOffenseScore(match)));
      const defenseTrend = buildRecentTrend(matches.map((match) => getMatchDefenseScore(match)));
      const failureTrend = buildRecentTrend(
        matches.map((match) => match.robot?.failures.count ?? 0),
      );
      const scoutedMatches = countsMap[detail.teamKey]?.scouted ?? matches.length;
      const playedMatches = countsMap[detail.teamKey]?.played ?? matches.length;
      const supportLabel = `${scoutedMatches}/${playedMatches} scouted`;

      const candidates: TrendAlert[] = [];

      if (offenseTrend && offenseTrend.delta >= 15) {
        candidates.push({
          teamKey: detail.teamKey,
          variant: 'up',
          title: 'Heating up',
          detail: `Offense is up ${Math.round(offenseTrend.delta)}% over the last ${offenseTrend.windowSize} scouted matches.`,
          deltaLabel: `+${Math.round(offenseTrend.delta)}%`,
          supportLabel,
          sortScore: offenseTrend.delta + scoutedMatches * 2,
        });
      }

      if (offenseTrend && offenseTrend.delta <= -15) {
        candidates.push({
          teamKey: detail.teamKey,
          variant: 'down',
          title: 'Cooling off',
          detail: `Offense is down ${Math.abs(Math.round(offenseTrend.delta))}% relative to the previous window.`,
          deltaLabel: `${Math.round(offenseTrend.delta)}%`,
          supportLabel,
          sortScore: Math.abs(offenseTrend.delta) + scoutedMatches * 2,
        });
      }

      if (
        defenseTrend &&
        defenseTrend.delta >= 18 &&
        defenseTrend.recentAverage >= Math.max(1, defenseTrend.previousAverage)
      ) {
        candidates.push({
          teamKey: detail.teamKey,
          variant: 'defense',
          title: 'Defense spike',
          detail: `Defense impact is up ${Math.round(defenseTrend.delta)}% in the most recent window.`,
          deltaLabel: `+${Math.round(defenseTrend.delta)}%`,
          supportLabel,
          sortScore: defenseTrend.delta + scoutedMatches * 1.5,
        });
      }

      if (
        failureTrend &&
        failureTrend.delta >= 30 &&
        failureTrend.recentAverage >= failureTrend.previousAverage + 0.25
      ) {
        candidates.push({
          teamKey: detail.teamKey,
          variant: 'risk',
          title: 'Reliability risk',
          detail: `Failure rate has climbed by ${Math.round(failureTrend.delta)}% in recent matches.`,
          deltaLabel: `+${Math.round(failureTrend.delta)}%`,
          supportLabel,
          sortScore: failureTrend.delta + scoutedMatches * 2.5,
        });
      }

      if (candidates.length === 0) {
        return null;
      }

      return [...candidates].sort((left, right) => right.sortScore - left.sortScore)[0]!;
    })
    .filter((alert): alert is TrendAlert => alert !== null)
    .sort((left, right) => right.sortScore - left.sortScore)
    .slice(0, 6);
}
