export type Event = {
  name: string;
  eventKey: string;
  startDate: string;
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
  robot: {
    autoCycleScore: number;
    autoCycleRate: number;
    autoCycleCountAvg: number;
    autoCycleAccuracy: number;
    autoTowerReliability: number;
    teleCycleScore: number;
    teleCycleRate: number;
    teleCycleCountAvg: number;
    teleCycleAccuracy: number;
    teleTowerLevel: string;
    teleTowerReliability: number;
    intakeDefenseCount: number;
    intakeDefenseEffectiveness: number;
    scoringDefenseCount: number;
    scoringDefenseEffectiveness: number;
    intakeDefenseScore: number;
    scoringDefenseScore: number;
    totalDefenseScore: number;
    failureCount: number;
    failureRecovery: number;
  };
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
  intake: MatchDefenseSide;
  offense: MatchDefenseSide;
};

export type FailureInstance = {
  count: number;
  recoveredCount: number;
  recoveredRate: number;
  recoveryTimeAvg: number;
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
  notes?: string | null;
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
