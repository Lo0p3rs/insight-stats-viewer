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

export type MatchPredictionPhaseProjection = {
  label: string;
  winner: PredictedWinner | 'even';
  redValue: number;
  blueValue: number;
  detail: string;
};

export type MatchPredictionAllianceReport = {
  fit: AllianceFitResult;
  strengths: string[];
  weaknesses: string[];
  failureFlags: Array<{
    teamKey: string;
    failureCount: number;
  }>;
  fuelProjection: {
    auto: number;
    tele: number;
  };
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
  phaseProjections: MatchPredictionPhaseProjection[];
};

export type AllianceBuilderSummary = {
  fit: AllianceFitResult;
  compositeScore: number;
  climbPercent: number;
  strengths: string[];
  weaknesses: string[];
  failureFlags: Array<{
    teamKey: string;
    failureCount: number;
  }>;
};

export type AllianceComboRecommendation = AllianceBuilderSummary & {
  teamKeys: string[];
};

export type ThirdPickRecommendation = AllianceBuilderSummary & {
  teamKey: string;
  patchLabel: string;
  patchDelta: number;
  valueScore: number;
  rationale: string[];
};

export type SpecialistCategoryKey =
  | 'auto'
  | 'tele'
  | 'defense'
  | 'failures'
  | 'climb';

export type SpecialistRecommendation = {
  key: SpecialistCategoryKey;
  label: string;
  description: string;
  teams: Array<{
    teamKey: string;
    valueLabel: string;
  }>;
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

function normalizedScore(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }

  return clamp(value / max);
}

const MULTIPLE_FAILURE_THRESHOLD = 2;
const THIRD_PICK_PROTECTED_RANK = 12;

function buildFailureFlags(selectedTeams: TeamAnalytics[]) {
  return selectedTeams
    .filter((team) => team.robot.failureCount >= MULTIPLE_FAILURE_THRESHOLD)
    .sort((left, right) => right.robot.failureCount - left.robot.failureCount)
    .map((team) => ({
      teamKey: team.teamKey,
      failureCount: team.robot.failureCount,
    }));
}

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10;
}

function getPhaseFuelApc(team: TeamAnalytics, phase: 'auto' | 'tele') {
  return phase === 'auto' ? team.robot.autoFuelApc : team.robot.teleFuelApc;
}

function distributionBalance(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return 1;
  }

  const shares = values.map((value) => value / total);
  const idealShare = 1 / shares.length;
  const averageShareDeviation = average(
    shares.map((share) => Math.abs(share - idealShare)),
  );

  return clamp(1 - averageShareDeviation / idealShare);
}

function applyTopPerformanceRegression(
  fieldTeams: TeamAnalytics[],
  selectedTeams: TeamAnalytics[],
  phase: 'auto' | 'tele',
  phaseFuelValues: number[],
) {
  const maxPhaseFuel = maxValue(
    fieldTeams.map((team) => getPhaseFuelApc(team, phase)),
  );
  if (maxPhaseFuel <= 0) {
    return phaseFuelValues;
  }

  const topPhaseTeamKeys = new Set(
    [...fieldTeams]
      .sort((left, right) => {
        const diff = getPhaseFuelApc(right, phase) - getPhaseFuelApc(left, phase);
        if (diff !== 0) {
          return diff;
        }

        return left.teamKey.localeCompare(right.teamKey);
      })
      .slice(0, 5)
      .map((team) => team.teamKey),
  );

  return selectedTeams.map((team, index) => {
    const value = phaseFuelValues[index] ?? 0;
    if (!topPhaseTeamKeys.has(team.teamKey)) {
      return value;
    }

    const topPerformancePressure = normalizedScore(value, Math.max(maxPhaseFuel, 1));
    const topPerformanceTax =
      clamp(
        (topPerformancePressure - (phase === 'auto' ? 0.52 : 0.48)) /
          (phase === 'auto' ? 0.34 : 0.28),
      ) * (phase === 'auto' ? 0.04 : 0.07);

    return value * (1 - topPerformanceTax);
  });
}

function adjustFuelForDefenseRole(
  fieldTeams: TeamAnalytics[],
  selectedTeams: TeamAnalytics[],
  phase: 'auto' | 'tele',
  phaseFuelValues: number[],
) {
  if (phase === 'auto') {
    return phaseFuelValues;
  }

  const totalFuel = phaseFuelValues.reduce((sum, value) => sum + value, 0);
  const maxFieldDefense = maxValue(
    fieldTeams.map((team) => team.robot.totalDefenseScore),
  );
  const maxFieldFuel = maxValue(
    fieldTeams.map((team) => getPhaseFuelApc(team, phase)),
  );
  if (totalFuel <= 0 || maxFieldDefense <= 0 || maxFieldFuel <= 0) {
    return phaseFuelValues;
  }

  const normalizedDefense = selectedTeams.map((team) =>
    normalizedScore(team.robot.totalDefenseScore, maxFieldDefense),
  );
  const averageDefense = average(normalizedDefense);

  return phaseFuelValues.map((value, index) => {
    const defenseProminence = clamp(
      (normalizedDefense[index] - averageDefense) / Math.max(0.16, 1 - averageDefense),
    );
    const fuelStrength = normalizedScore(value, maxFieldFuel);
    const scorerRelief = clamp((fuelStrength - 0.34) / 0.5);
    const roleTax = defenseProminence * (1 - scorerRelief * 0.72) * 0.12;

    return value * (1 - roleTax);
  });
}

function buildPhaseFuelProjection(
  fieldTeams: TeamAnalytics[],
  selectedTeams: TeamAnalytics[],
  fit: AllianceFitResult,
  phase: 'auto' | 'tele',
) {
  const rawPhaseFuelValues = selectedTeams.map((team) => getPhaseFuelApc(team, phase));
  const regressedPhaseFuelValues = applyTopPerformanceRegression(
    fieldTeams,
    selectedTeams,
    phase,
    rawPhaseFuelValues,
  );
  const phaseFuelValues = adjustFuelForDefenseRole(
    fieldTeams,
    selectedTeams,
    phase,
    regressedPhaseFuelValues,
  );
  const baselineFuel = phaseFuelValues.reduce((sum, value) => sum + value, 0);
  if (baselineFuel <= 0) {
    return 0;
  }

  const averageFieldFuel = average(
    fieldTeams.map((team) => getPhaseFuelApc(team, phase)),
  );
  const maxPhaseFuel = maxValue(
    fieldTeams.map((team) => getPhaseFuelApc(team, phase)),
  );
  const phaseBalance = distributionBalance(phaseFuelValues);
  const fieldBaseline = averageFieldFuel * selectedTeams.length;
  const fieldStrength =
    fieldBaseline > 0
      ? clamp(baselineFuel / fieldBaseline, 0.55, 1.35)
      : 1;
  const fieldStrengthBonus = clamp(
    (fieldStrength - 1) * (phase === 'auto' ? 0.08 : 0.06),
    -0.05,
    0.04,
  );
  const leadShare = maxValue(phaseFuelValues) / baselineFuel;
  const topShares = phaseFuelValues
    .map((value) => value / baselineFuel)
    .sort((left, right) => right - left);
  const topTwoShare = (topShares[0] ?? 0) + (topShares[1] ?? 0);
  const concentrationPenalty =
    clamp((leadShare - (phase === 'auto' ? 0.48 : 0.44)) / (phase === 'auto' ? 0.28 : 0.24)) *
    (phase === 'auto' ? 0.05 : 0.07);
  const overlapPenalty =
    clamp(
      (topTwoShare - (phase === 'auto' ? 0.9 : 0.74)) /
        (phase === 'auto' ? 0.24 : 0.18),
    ) * (phase === 'auto' ? 0.04 : 0.08);
  const primaryPhaseScore =
    getBreakdownScore(fit, phase === 'auto' ? 'Auto' : 'Teleop') / 100;
  const supportPhaseScore =
    getBreakdownScore(fit, phase === 'auto' ? 'Teleop' : 'Auto') / 100;
  const scoringStrength = primaryPhaseScore * 0.72 + supportPhaseScore * 0.28;

  const multiplier =
    phase === 'auto'
      ? clamp(
          0.74 +
            scoringStrength * 0.12 +
            phaseBalance * 0.05 +
            fieldStrengthBonus -
            concentrationPenalty -
            overlapPenalty,
          0.62,
          0.9,
        )
      : clamp(
          0.7 +
            scoringStrength * 0.14 +
            phaseBalance * 0.06 +
            fieldStrengthBonus -
            concentrationPenalty -
            overlapPenalty,
          0.56,
          0.88,
        );

  return roundToTenths(baselineFuel * multiplier);
}

// Fuel projection starts from APC, then regresses those averages downward so the
// projection reads as expected match output instead of peak output.
function buildFuelProjection(
  fieldTeams: TeamAnalytics[],
  selectedTeams: TeamAnalytics[],
  fit: AllianceFitResult,
) {
  return {
    auto: buildPhaseFuelProjection(fieldTeams, selectedTeams, fit, 'auto'),
    tele: buildPhaseFuelProjection(fieldTeams, selectedTeams, fit, 'tele'),
  };
}

type AllianceScoreKey = 'auto' | 'tele' | 'defense' | 'climb';

function summarizeWeakSpot(label: string) {
  switch (label) {
    case 'Auto':
      return 'auto output is still shallow';
    case 'Teleop':
      return 'teleop scoring needs a clearer closer';
    case 'Defense':
      return 'there is no clear defense anchor yet';
    case 'Role Spread':
      return 'too much of the load still sits on one robot';
    default:
      return 'there is still a visible gap';
  }
}

function climbLevelScore(level: string) {
  const normalizedLevel = level.trim().toLowerCase();
  if (!normalizedLevel || normalizedLevel === 'none') {
    return 0;
  }

  if (normalizedLevel.includes('trav') || normalizedLevel.includes('high')) {
    return 1;
  }

  if (normalizedLevel.includes('mid')) {
    return 0.78;
  }

  if (normalizedLevel.includes('low')) {
    return 0.58;
  }

  if (normalizedLevel.includes('park')) {
    return 0.32;
  }

  return 0.45;
}

function climbScore(team: TeamAnalytics) {
  return clamp(
    climbLevelScore(team.robot.teleTowerLevel) * 0.65 +
      team.robot.teleTowerReliability * 0.35,
  );
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

  const climbAverage = average(selectedTeams.map((team) => climbScore(team)));
  const narrative = buildAllianceNarrative(fit);
  const fuelProjection = buildFuelProjection(fieldTeams, selectedTeams, fit);
  const failureFlags = buildFailureFlags(selectedTeams);

  return {
    fit,
    strengths: narrative.strengths,
    weaknesses: narrative.weaknesses,
    failureFlags,
    fuelProjection,
    metrics: [
      { label: 'Auto Fit', value: `${getBreakdownScore(fit, 'Auto')}` },
      { label: 'Tele Fit', value: `${getBreakdownScore(fit, 'Teleop')}` },
      { label: 'Defense', value: `${getBreakdownScore(fit, 'Defense')}` },
      { label: 'Climb', value: toPercentLabel(climbAverage) },
    ],
  } satisfies MatchPredictionAllianceReport;
}

function buildAllianceCompositeSummary(
  fieldTeams: TeamAnalytics[],
  selectedTeams: TeamAnalytics[],
) {
  const fit = buildAllianceFit(fieldTeams, selectedTeams);
  if (!fit) {
    return null;
  }

  const climbPercent = Math.round(
    average(selectedTeams.map((team) => climbScore(team))) * 100,
  );
  const narrative = buildAllianceNarrative(fit);
  const failureFlags = buildFailureFlags(selectedTeams);

  return {
    fit,
    compositeScore: Math.round(fit.score * 0.88 + climbPercent * 0.12),
    climbPercent,
    strengths: narrative.strengths,
    weaknesses: narrative.weaknesses,
    failureFlags,
  } satisfies AllianceBuilderSummary;
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

function phaseProjectionWinner(redValue: number, blueValue: number) {
  const diff = redValue - blueValue;
  return Math.abs(diff) < 0.8 ? 'even' : diff > 0 ? 'red' : 'blue';
}

function applyMatchupFuelPressure(
  baseFuel: number,
  ownFit: AllianceFitResult,
  opponentFit: AllianceFitResult,
  phase: 'auto' | 'tele',
) {
  if (phase === 'auto') {
    return roundToTenths(baseFuel);
  }

  const phaseFit = getBreakdownScore(ownFit, 'Teleop') / 100;
  const roleSpread = getBreakdownScore(ownFit, 'Role Spread') / 100;
  const opponentDefense = getBreakdownScore(opponentFit, 'Defense') / 100;
  const phaseResilience = phaseFit * 0.65 + roleSpread * 0.35;
  const pressureGap = opponentDefense - phaseResilience;
  const multiplier =
    clamp(1 - pressureGap * 0.14, 0.76, 1.12);

  return roundToTenths(baseFuel * multiplier);
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
    climb: climbScore(team),
  }));

  const autoScores = scoredTeams.map((entry) => entry.auto);
  const teleScores = scoredTeams.map((entry) => entry.tele);
  const defenseScores = scoredTeams.map((entry) => entry.defense);

  const autoCoverage = clamp(maxValue(autoScores) * 0.65 + average(autoScores) * 0.35);
  const teleCoverage = clamp(maxValue(teleScores) * 0.65 + average(teleScores) * 0.35);
  const defenseCoverage = clamp(
    maxValue(defenseScores) * 0.7 + average(defenseScores) * 0.3,
  );

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
      role: 'Climb Closer',
      statLabel: 'Climb',
      scoreKey: 'climb',
      format: (entry) => toPercentLabel(entry.climb),
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
    (entry) => entry.auto + entry.tele + entry.defense + entry.climb,
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
      label: 'Role Spread',
      score: Math.round(synergy * 100),
      detail: 'How well the workload is distributed across distinct roles.',
    },
  ];

  const overallScore = Math.round(
    (autoCoverage * 0.28 +
      teleCoverage * 0.28 +
      defenseCoverage * 0.22 +
      synergy * 0.22) *
      100,
  );

  const weakestBreakdown = [...breakdown].sort((left, right) => left.score - right.score)[0]!;
  const risks: string[] = [];
  if (defenseCoverage < 0.45) {
    risks.push('No defender-grade partner is separating from the group yet.');
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
      ? 'The selected robots cover opening pressure, scoring volume, and support roles well enough to plan around.'
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

export function buildAllianceBuilderSummary(
  fieldTeams: TeamAnalytics[],
  selectedTeams: TeamAnalytics[],
) {
  return buildAllianceCompositeSummary(fieldTeams, selectedTeams);
}

export function buildTopAllianceRecommendations(
  fieldTeams: TeamAnalytics[],
  limit = 8,
) {
  const recommendations: AllianceComboRecommendation[] = [];

  for (let firstIndex = 0; firstIndex < fieldTeams.length - 2; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < fieldTeams.length - 1;
      secondIndex += 1
    ) {
      for (
        let thirdIndex = secondIndex + 1;
        thirdIndex < fieldTeams.length;
        thirdIndex += 1
      ) {
        const teamGroup = [
          fieldTeams[firstIndex]!,
          fieldTeams[secondIndex]!,
          fieldTeams[thirdIndex]!,
        ];
        const summary = buildAllianceCompositeSummary(fieldTeams, teamGroup);
        if (!summary) {
          continue;
        }

        recommendations.push({
          ...summary,
          teamKeys: teamGroup.map((team) => team.teamKey),
        });
      }
    }
  }

  return recommendations
    .sort((left, right) => {
      if (right.compositeScore !== left.compositeScore) {
        return right.compositeScore - left.compositeScore;
      }
      if (right.fit.score !== left.fit.score) {
        return right.fit.score - left.fit.score;
      }
      return right.climbPercent - left.climbPercent;
    })
    .slice(0, limit);
}

export function buildThirdPickRecommendations(
  fieldTeams: TeamAnalytics[],
  lockedTeams: TeamAnalytics[],
  limit = 8,
) {
  if (lockedTeams.length < 2) {
    return [] as ThirdPickRecommendation[];
  }

  const lockedSummary = buildAllianceCompositeSummary(fieldTeams, lockedTeams);
  if (!lockedSummary) {
    return [] as ThirdPickRecommendation[];
  }

  const weakestCurrentBreakdown = [...lockedSummary.fit.breakdown].sort(
    (left, right) => left.score - right.score,
  )[0]!;
  const lockedKeys = new Set(lockedTeams.map((team) => team.teamKey));
  const maxFieldRank = Math.max(
    THIRD_PICK_PROTECTED_RANK + 1,
    ...fieldTeams.map((team) => team.tba.rank || 0),
  );

  return fieldTeams
    .filter(
      (team) =>
        !lockedKeys.has(team.teamKey) &&
        (team.tba.rank <= 0 || team.tba.rank > THIRD_PICK_PROTECTED_RANK),
    )
    .map<ThirdPickRecommendation | null>((team) => {
      const summary = buildAllianceCompositeSummary(fieldTeams, [...lockedTeams, team]);
      if (!summary) {
        return null;
      }

      const effectiveRank = team.tba.rank > 0 ? team.tba.rank : maxFieldRank;
      const rankDepthScore = clamp(
        (effectiveRank - THIRD_PICK_PROTECTED_RANK) /
          Math.max(1, maxFieldRank - THIRD_PICK_PROTECTED_RANK),
      );
      const patchedScore = getBreakdownScore(summary.fit, weakestCurrentBreakdown.label);
      const patchDelta = patchedScore - weakestCurrentBreakdown.score;
      const valueScore = Math.round(
        summary.compositeScore * 0.68 +
          patchDelta * 1.1 +
          summary.climbPercent * 0.12 +
          rankDepthScore * 16,
      );
      const candidateRoles = summary.fit.assignments
        .filter((assignment) => assignment.teamKey === team.teamKey)
        .map((assignment) => assignment.role);
      const rationale = [
        patchDelta > 0
          ? `Patches ${weakestCurrentBreakdown.label.toLowerCase()} by ${patchDelta} points.`
          : summary.fit.summary,
        team.tba.rank > THIRD_PICK_PROTECTED_RANK
          ? `Realistic third-pick range at rank #${team.tba.rank}.`
          : team.tba.rank <= 0
            ? 'Unranked on TBA, but still treated as an available late-board value play.'
            : null,
        candidateRoles.length > 0
          ? `Projects as ${candidateRoles.join(' and ')}.`
          : null,
        summary.climbPercent >= 68 ? 'Adds a dependable endgame closer.' : null,
        team.robot.failureCount >= MULTIPLE_FAILURE_THRESHOLD
          ? `${team.robot.failureCount} recorded failures; verify notes before locking the trio.`
          : null,
      ].filter((item): item is string => Boolean(item));

      return {
        ...summary,
        teamKey: team.teamKey,
        patchLabel: weakestCurrentBreakdown.label,
        patchDelta,
        valueScore,
        rationale,
      };
    })
    .filter((recommendation): recommendation is ThirdPickRecommendation => recommendation !== null)
    .sort((left, right) => {
      if (right.valueScore !== left.valueScore) {
        return right.valueScore - left.valueScore;
      }
      if (right.compositeScore !== left.compositeScore) {
        return right.compositeScore - left.compositeScore;
      }
      if (right.patchDelta !== left.patchDelta) {
        return right.patchDelta - left.patchDelta;
      }
      return right.climbPercent - left.climbPercent;
    })
    .slice(0, limit);
}

export function buildSpecialistRecommendations(
  fieldTeams: TeamAnalytics[],
  limit = 5,
) {
  const categories: Array<{
    key: SpecialistCategoryKey;
    label: string;
    description: string;
    extractor: (team: TeamAnalytics) => number;
    formatter: (value: number) => string;
    filter?: (team: TeamAnalytics) => boolean;
  }> = [
    {
      key: 'auto',
      label: 'Auto Spark',
      description: 'Fastest opening burst and early-cycle pressure.',
      extractor: (team) => team.robot.autoFuelApc,
      formatter: (value) => value.toFixed(1),
    },
    {
      key: 'tele',
      label: 'Tele Carry',
      description: 'Best sustained teleop scoring volume.',
      extractor: (team) => team.robot.teleFuelApc,
      formatter: (value) => value.toFixed(1),
    },
    {
      key: 'defense',
      label: 'Defense Anchor',
      description: 'Strongest pure disruption option on the field.',
      extractor: (team) => team.robot.totalDefenseScore,
      formatter: (value) => value.toFixed(1),
    },
    {
      key: 'climb',
      label: 'Climb Closer',
      description: 'Most dependable endgame finisher and tower contributor.',
      extractor: (team) => climbScore(team) * 100,
      formatter: (value) => `${Math.round(value)}%`,
    },
    {
      key: 'failures',
      label: 'Failure Watch',
      description: 'Teams with repeat failure history that need a second look.',
      extractor: (team) => team.robot.failureCount,
      formatter: (value) => `${Math.round(value)} failure${Math.round(value) === 1 ? '' : 's'}`,
      filter: (team) => team.robot.failureCount >= MULTIPLE_FAILURE_THRESHOLD,
    },
  ];

  return categories.map((category) => ({
    key: category.key,
    label: category.label,
    description: category.description,
    teams: [...fieldTeams]
      .filter((team) => category.filter ? category.filter(team) : true)
      .sort((left, right) => category.extractor(right) - category.extractor(left))
      .slice(0, limit)
      .map((team) => ({
        teamKey: team.teamKey,
        valueLabel: category.formatter(category.extractor(team)),
      })),
  })) satisfies SpecialistRecommendation[];
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

  const redFuelProjection = {
    auto: applyMatchupFuelPressure(red.fuelProjection.auto, red.fit, blue.fit, 'auto'),
    tele: applyMatchupFuelPressure(red.fuelProjection.tele, red.fit, blue.fit, 'tele'),
  };
  const blueFuelProjection = {
    auto: applyMatchupFuelPressure(blue.fuelProjection.auto, blue.fit, red.fit, 'auto'),
    tele: applyMatchupFuelPressure(blue.fuelProjection.tele, blue.fit, red.fit, 'tele'),
  };
  const redReport = {
    ...red,
    fuelProjection: redFuelProjection,
  } satisfies MatchPredictionAllianceReport;
  const blueReport = {
    ...blue,
    fuelProjection: blueFuelProjection,
  } satisfies MatchPredictionAllianceReport;

  const redClimb = Number(redReport.metrics.find((metric) => metric.label === 'Climb')?.value.replace('%', '') ?? '0');
  const blueClimb = Number(blueReport.metrics.find((metric) => metric.label === 'Climb')?.value.replace('%', '') ?? '0');

  const edges = [
    categoryEdge(
      'Auto',
      getBreakdownScore(redReport.fit, 'Auto'),
      getBreakdownScore(blueReport.fit, 'Auto'),
      'Opening burst and first-cycle pressure.',
    ),
    categoryEdge(
      'Teleop',
      getBreakdownScore(redReport.fit, 'Teleop'),
      getBreakdownScore(blueReport.fit, 'Teleop'),
      'Sustained scoring once the match settles.',
    ),
    categoryEdge(
      'Defense',
      getBreakdownScore(redReport.fit, 'Defense'),
      getBreakdownScore(blueReport.fit, 'Defense'),
      'Ability to pressure the opponent without collapsing your own flow.',
    ),
    categoryEdge(
      'Role Spread',
      getBreakdownScore(redReport.fit, 'Role Spread'),
      getBreakdownScore(blueReport.fit, 'Role Spread'),
      'Whether the workload is shared cleanly across all three robots.',
    ),
    categoryEdge(
      'Climb',
      redClimb,
      blueClimb,
      'Endgame ceiling and tower conversion rate.',
    ),
  ];

  const redIndex =
    getBreakdownScore(redReport.fit, 'Auto') * 0.22 +
    getBreakdownScore(redReport.fit, 'Teleop') * 0.3 +
    getBreakdownScore(redReport.fit, 'Defense') * 0.18 +
    getBreakdownScore(redReport.fit, 'Role Spread') * 0.14 +
    redClimb * 0.16;
  const blueIndex =
    getBreakdownScore(blueReport.fit, 'Auto') * 0.22 +
    getBreakdownScore(blueReport.fit, 'Teleop') * 0.3 +
    getBreakdownScore(blueReport.fit, 'Defense') * 0.18 +
    getBreakdownScore(blueReport.fit, 'Role Spread') * 0.14 +
    blueClimb * 0.16;
  const phaseProjections = [
    {
      label: 'Auto Fuel',
      winner: phaseProjectionWinner(redFuelProjection.auto, blueFuelProjection.auto),
      redValue: redFuelProjection.auto,
      blueValue: blueFuelProjection.auto,
      detail:
        'Auto projection blends APC with alliance auto scoring strength, then lightly regresses only the event\'s top auto scorers.',
    },
    {
      label: 'Tele Fuel',
      winner: phaseProjectionWinner(redFuelProjection.tele, blueFuelProjection.tele),
      redValue: redFuelProjection.tele,
      blueValue: blueFuelProjection.tele,
      detail:
        'Tele projection blends APC with alliance tele scoring strength, lightly regresses only the event\'s top tele scorers, slightly discounts defense-first lower scorers, and adds defense pressure.',
    },
  ] satisfies MatchPredictionPhaseProjection[];

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
    red: redReport,
    blue: blueReport,
    edges,
    phaseProjections,
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
