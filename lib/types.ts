export type Event = {
  name: string;
  eventKey: string;
  startDate: string;
  configured: boolean;
};

export type EventTeam = {
  eventKey: string;
  teamKey: string;
  number: number;
  name: string;
};

export type Scout = {
  id: string;
  name: string;
};

export type EventAlliance = {
  teamKeys: string[];
  score: number | null;
  autoScore?: number | null;
  teleopScore?: number | null;
};

export type EventMatch = {
  eventKey: string;
  matchKey: string;
  matchNumber: number;
  setNumber: number;
  level: string;
  alliances: {
    red: EventAlliance;
    blue: EventAlliance;
  };
  scoutingStatus: {
    robot: string[];
    ai: string[];
    humanPlayer: string[];
  };
};

export type TbaHubScore = {
  autoPoints: number;
  teleopPoints: number;
  totalPoints: number;
};

export type TbaTeamSimple = {
  key: string;
  teamNumber: number;
  nickname: string;
  name: string;
};

export type TbaEventMatchBreakdown = {
  hubScore: TbaHubScore | null;
};

export type TbaEventMatch = {
  key: string;
  eventKey: string;
  compLevel: string;
  matchNumber: number;
  setNumber: number;
  alliances: {
    red: EventAlliance;
    blue: EventAlliance;
  };
  scoreBreakdown: {
    red: TbaEventMatchBreakdown | null;
    blue: TbaEventMatchBreakdown | null;
  } | null;
};

export type ScoutNote = {
  id: string;
  scoutId: string;
  content: string;
  createdAt: string;
  matchKey: string | null;
};

export type TeamSummaryStatus =
  | 'insufficient_data'
  | 'tentative'
  | 'established';

export type TeamSummaryConfidence = 'low' | 'medium' | 'high';

export type TeamSummaryDefenseEffectiveness =
  | 'poor'
  | 'mixed'
  | 'good'
  | 'elite'
  | 'unknown';

export type TeamSummaryDriverQuality =
  | 'poor'
  | 'mixed'
  | 'good'
  | 'elite'
  | 'unknown';

export type TeamSummaryFoulRisk = 'low' | 'medium' | 'high' | 'unknown';

export type TeamSummaryDefenseStrategy =
  | 'lane_denial'
  | 'scorer_pressure'
  | 'zone_denial'
  | 'disruption'
  | 'opportunistic_defense'
  | 'other';

export type TeamSummaryDefenseWhenUsed = {
  matchPhase:
    | 'auto'
    | 'teleop_early'
    | 'teleop_mid'
    | 'teleop_late'
    | 'endgame'
    | 'unknown';
  situation: string | null;
};

export type TeamSummaryDefenseItem = {
  strategy: TeamSummaryDefenseStrategy;
  description: string;
  whenUsed: TeamSummaryDefenseWhenUsed;
  defenseEffectiveness: TeamSummaryDefenseEffectiveness;
  driverQuality: TeamSummaryDriverQuality;
  foulRisk: TeamSummaryFoulRisk;
  supportingMatches: string[];
  confidence: TeamSummaryConfidence;
};

export type TeamSummaryNotes = {
  strengths: string[];
  concerns: string[];
  allianceFit: string[];
  isolatedNotes: string[];
};

export type TeamSummaryEvidence = {
  robotReportCount: number;
  matchCount: number;
  generalNoteCount: number;
  defenseNoteCount: number;
  scoutNoteCount: number;
  lastMatchKey: string | null;
};

export type TeamSummary = {
  status: TeamSummaryStatus;
  defense: TeamSummaryDefenseItem[];
  notes: TeamSummaryNotes;
  summaryText: string | null;
  evidence: TeamSummaryEvidence;
  generatedAt: string | null;
};

export type TeamRobotOverview = {
  autoFuelCount: number | null;
  autoFuelApc: number;
  autoCycleScore: number;
  autoCycleCountAvg: number;
  autoCycleFuelCountAvg: number | null;
  autoCycleAccuracy: number;
  autoTowerReliability: number;
  teleFuelCount: number | null;
  teleFuelApc: number;
  teleCycleScore: number;
  teleCycleCountAvg: number;
  teleCycleFuelCountAvg: number | null;
  teleCycleAccuracy: number;
  teleTowerLevel: string;
  teleTowerReliability: number;
  drivetrain: string | null;
  autoPathSingleLeftCount: number;
  autoPathSingleRightCount: number;
  autoPathDoubleLeftCount: number;
  autoPathDoubleRightCount: number;
  autoPathOutpostCount: number;
  autoPathDepotCount: number;
  autoPathOutpostAndDepotCount: number;
  autoPathPreloadCount: number;
  autoPathNoPathCount: number;
  intakeDefenseCount: number;
  intakeDefenseEffectiveness: number;
  scoringDefenseCount: number;
  scoringDefenseEffectiveness: number;
  intakeDefenseScore: number;
  scoringDefenseScore: number;
  totalDefenseScore: number;
  defenseScore: number;
  defenseUnawareCount: number;
  defensePenaltyProneCount: number;
  defenseRecklessCount: number;
  defenseShutDownCount: number;
  defenseEliteDrivingCount: number;
  failureCount: number;
  failureRecovery: number;
  scoutNotes: ScoutNote[];
};

export type TeamAnalytics = {
  name: string;
  teamKey: string;
  eventKey: string;
  tba: {
    wins: number;
    losses: number;
    ties: number;
    opr: number;
    rank: number;
  };
  robot: TeamRobotOverview;
  summary: TeamSummary | null;
  humanPlayer: {
    fuelCountAvg: number;
    accuracy: number;
  };
  scoutedMatches?: number;
};

export type MatchCycleData = {
  cycleCount: number;
  cycleScoreAvg: number;
  rateAvg: number;
  accuracyAvg: number;
  fuelCountAvg: number | null;
};

export type MatchTowerData = {
  attempted: boolean;
  succeeded: boolean;
  level: string;
  climbSpeed: string;
  unclimbed: boolean;
  unclimbSpeed: string;
};

export type MatchPhaseData = {
  cycles: MatchCycleData;
  tower: MatchTowerData;
};

export type MatchDefenseSide = {
  played: boolean;
  effectiveness: string;
  effNum: number;
};

export type MatchDefenseData = {
  score: number;
  calculatedScore: number;
  unaware: boolean;
  penaltyProne: boolean;
  reckless: boolean;
  shutDown: boolean;
  eliteDriving: boolean;
  intake: MatchDefenseSide;
  offense: MatchDefenseSide;
};

export type FailureInstance = {
  count: number;
  recoveredCount: number;
  recoveredRate: number;
  recoveryTimeAvg: number | null;
};

export type MatchFailureData = {
  count: number;
  recoveredCount: number;
  recoveredRate: number;
  disabled: FailureInstance;
  major: FailureInstance;
  minor: FailureInstance;
};

export type MatchPassingData = {
  opposingToNeutral: string;
  neutralToAlliance: string;
  opposingToAlliance: string;
};

export type MatchMobilityData = {
  trench: string;
  bump: string;
};

export type MatchRobotData = {
  auto: MatchPhaseData;
  tele: MatchPhaseData;
  defense: MatchDefenseData;
  failures: MatchFailureData;
  passing: MatchPassingData;
  mobility: MatchMobilityData;
  drivetrain: string | null;
  autoPath: string | null;
  notes: string | null;
  defenseNotes: string | null;
};

export type TeamMatchAnalytics = {
  eventKey: string;
  matchKey: string;
  matchSort: number;
  level: string;
  matchNumber: number;
  setNumber: number;
  robot?: MatchRobotData | null;
  humanPlayer?: Record<string, unknown> | null;
};

export type TeamDetail = {
  teamKey: string;
  eventKeys: string[];
  matches: TeamMatchAnalytics[];
  overviews: TeamAnalytics[];
};
