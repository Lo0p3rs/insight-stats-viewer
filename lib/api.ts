import type {
  Event,
  EventMatch,
  EventTeam,
  MatchCycleData,
  MatchDefenseData,
  MatchDefenseSide,
  MatchFailureData,
  MatchMobilityData,
  MatchPassingData,
  MatchPhaseData,
  MatchRobotData,
  MatchTowerData,
  Scout,
  ScoutNote,
  TbaEventMatch,
  TbaTeamSimple,
  TeamAnalytics,
  TeamDetail,
  TeamMatchAnalytics,
  TeamSummary,
  TeamSummaryDefenseItem,
  TeamSummaryDefenseWhenUsed,
  TeamSummaryEvidence,
  TeamSummaryNotes,
} from '@/lib/types';
import {
  AppException,
  ForbiddenException,
  NetworkException,
  NotFoundException,
  OutdatedVersionException,
  ServerException,
  TimeoutException,
  UnauthorizedException,
  UnknownException,
  ValidationException,
} from '@/lib/errors';

const API_BASE = '/api/insight';
const TBA_API_BASE = '/api/tba';
const REQUEST_TIMEOUT_MS = 20000;

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'X-FMS-VERSION': '2.0.0+1',
};

const USERNAME = 'insight_user';

function buildUrl(path: string) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

function buildTbaUrl(path: string) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${TBA_API_BASE}${cleanPath}`;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function toBoolean(value: unknown) {
  return value === true;
}

function extractErrorMessage(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === 'string' && data.trim()) return data;

  if (typeof data === 'object' && data !== null) {
    const objectValue = data as Record<string, unknown>;
    const detail = objectValue.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    const message = objectValue.message;
    if (typeof message === 'string' && message.trim()) return message;
    const error = objectValue.error;
    if (typeof error === 'string' && error.trim()) return error;
  }

  return null;
}

function toAppException(
  status: number,
  message: string | null,
  proxyError: string | null,
) {
  if (proxyError === 'network') {
    return new NetworkException(message ?? 'No internet connection');
  }

  if (proxyError === 'timeout') {
    return new TimeoutException(message ?? 'Connection timed out');
  }

  if (status === 400) {
    return new OutdatedVersionException(message ?? 'App version is outdated', status);
  }

  if (status === 401) {
    return new UnauthorizedException(message ?? 'Unauthorized request', status);
  }

  if (status === 403) {
    return new ForbiddenException(
      message ?? 'You do not have permission to perform this action',
      status,
    );
  }

  if (status === 404) {
    return new NotFoundException(
      message ?? 'Requested resource was not found',
      status,
    );
  }

  if (status === 422) {
    return new ValidationException(message ?? 'Invalid request data', status);
  }

  if (status >= 500) {
    return new ServerException(message ?? 'Server error, please try again later', status);
  }

  return new UnknownException(message ?? 'Request failed', status);
}

function normalizeThrownError(error: unknown): AppException {
  if (error instanceof AppException) {
    return error;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new TimeoutException();
  }

  if (error instanceof TypeError) {
    return new NetworkException();
  }

  if (error instanceof Error && error.message.trim()) {
    return new UnknownException(error.message);
  }

  return new UnknownException();
}

async function parseErrorResponse(response: Response) {
  try {
    const data = await response.json();
    return extractErrorMessage(data);
  } catch {
    try {
      const text = await response.text();
      return extractErrorMessage(text);
    } catch {
      return null;
    }
  }
}

async function fetchWithTimeout(input: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  try {
    const response = await fetchWithTimeout(buildUrl(path), {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...(options?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await parseErrorResponse(response);
      throw toAppException(
        response.status,
        message,
        response.headers.get('x-insight-error'),
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    throw normalizeThrownError(error);
  }
}

async function proxyFetch<T>(input: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetchWithTimeout(input, {
      ...options,
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await parseErrorResponse(response);
      throw toAppException(
        response.status,
        message,
        response.headers.get('x-insight-error'),
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    throw normalizeThrownError(error);
  }
}

export async function loginWithCode(code: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(buildUrl('auth/token'), {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: USERNAME,
        password: code,
      }).toString(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await parseErrorResponse(response);
      throw toAppException(
        response.status,
        message,
        response.headers.get('x-insight-error'),
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const token = data.access_token;
    if (typeof token !== 'string') {
      throw new UnknownException('Token missing in login response.');
    }

    return token;
  } catch (error) {
    throw normalizeThrownError(error);
  }
}

export async function fetchEvents(token: string): Promise<Event[]> {
  const data = await apiFetch<unknown[]>('/events', token);

  return data
    .map((item) => {
      const event = item as Record<string, unknown>;
      return {
        name: toString(event.name),
        eventKey: toString(event.event_key ?? event.eventKey),
        startDate: toString(event.start_date ?? event.startDate),
        configured: event.configured === true,
      };
    })
    .filter((event) => event.configured && event.eventKey);
}

function parseAlliance(raw: unknown) {
  const data = (raw as Record<string, unknown>) ?? {};

  return {
    teamKeys: Array.isArray(data.team_keys)
      ? data.team_keys.filter((teamKey): teamKey is string => typeof teamKey === 'string')
      : [],
    score: toNullableNumber(data.score),
    autoScore: toNullableNumber(data.auto_score),
    teleopScore: toNullableNumber(data.teleop_score),
  };
}

export function parseEventMatch(raw: Record<string, unknown>): EventMatch {
  const alliances = (raw.alliances as Record<string, unknown>) ?? {};
  const scoutingStatus = (raw.scouting_status as Record<string, unknown>) ?? {};

  return {
    eventKey: toString(raw.event_key ?? raw.eventKey),
    matchKey: toString(raw.match_key ?? raw.matchKey),
    matchNumber: toNumber(raw.match_number),
    setNumber: toNumber(raw.set_number),
    level: toString(raw.level),
    alliances: {
      red: parseAlliance(alliances.red),
      blue: parseAlliance(alliances.blue),
    },
    scoutingStatus: {
      robot: Array.isArray(scoutingStatus.robot)
        ? scoutingStatus.robot.filter((teamKey): teamKey is string => typeof teamKey === 'string')
        : [],
      ai: Array.isArray(scoutingStatus.ai)
        ? scoutingStatus.ai.filter((teamKey): teamKey is string => typeof teamKey === 'string')
        : [],
      humanPlayer: Array.isArray(scoutingStatus.human_player)
        ? scoutingStatus.human_player.filter(
            (teamKey): teamKey is string => typeof teamKey === 'string',
          )
        : [],
    },
  };
}

function parseTbaEventMatchBreakdown(raw: unknown) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const hubScore = data.hubScore as Record<string, unknown> | undefined;

  return {
    hubScore: hubScore
      ? {
          autoPoints: toNumber(hubScore.autoPoints),
          teleopPoints: toNumber(hubScore.teleopPoints),
          totalPoints: toNumber(hubScore.totalPoints),
        }
      : null,
  };
}

function parseTbaEventMatch(raw: Record<string, unknown>): TbaEventMatch {
  const alliances = (raw.alliances as Record<string, unknown>) ?? {};
  const scoreBreakdown = (raw.score_breakdown as Record<string, unknown>) ?? null;

  return {
    key: toString(raw.key),
    eventKey: toString(raw.event_key),
    compLevel: toString(raw.comp_level),
    matchNumber: toNumber(raw.match_number),
    setNumber: toNumber(raw.set_number),
    alliances: {
      red: parseAlliance(alliances.red),
      blue: parseAlliance(alliances.blue),
    },
    scoreBreakdown: scoreBreakdown
      ? {
          red: parseTbaEventMatchBreakdown(scoreBreakdown.red),
          blue: parseTbaEventMatchBreakdown(scoreBreakdown.blue),
        }
      : null,
  };
}

export function parseTbaTeamSimple(raw: Record<string, unknown>): TbaTeamSimple {
  return {
    key: toString(raw.key),
    teamNumber: toNumber(raw.team_number),
    nickname: toString(raw.nickname),
    name: toString(raw.name),
  };
}

export async function fetchEventMatches(
  token: string,
  eventKey: string,
): Promise<EventMatch[]> {
  const data = await apiFetch<unknown[]>(
    `/events/${encodeURIComponent(eventKey)}/matches`,
    token,
  );

  return data.map((item) => parseEventMatch(item as Record<string, unknown>));
}

export async function fetchTbaEventMatches(eventKey: string): Promise<TbaEventMatch[]> {
  const data = await proxyFetch<unknown[]>(
    buildTbaUrl(`/event/${encodeURIComponent(eventKey)}/matches`),
  );

  return data.map((item) => parseTbaEventMatch(item as Record<string, unknown>));
}

export async function fetchTbaEventTeams(eventKey: string): Promise<TbaTeamSimple[]> {
  const data = await proxyFetch<unknown[]>(
    buildTbaUrl(`/event/${encodeURIComponent(eventKey)}/teams`),
  );

  return data.map((item) => parseTbaTeamSimple(item as Record<string, unknown>));
}

function parseEventTeam(raw: Record<string, unknown>): EventTeam {
  return {
    eventKey: toString(raw.event_key ?? raw.eventKey),
    teamKey: toString(raw.team_key ?? raw.teamKey),
    number: toNumber(raw.number),
    name: toString(raw.name),
  };
}

export async function fetchEventTeams(
  token: string,
  eventKey: string,
): Promise<EventTeam[]> {
  const data = await apiFetch<unknown[]>(
    `/events/${encodeURIComponent(eventKey)}/teams`,
    token,
  );

  return data.map((item) => parseEventTeam(item as Record<string, unknown>));
}

function parseScout(raw: Record<string, unknown>): Scout {
  return {
    id: toString(raw.id),
    name: toString(raw.name),
  };
}

export async function fetchScouts(token: string): Promise<Scout[]> {
  const data = await apiFetch<unknown[]>('/scouts', token);
  return data.map((item) => parseScout(item as Record<string, unknown>));
}

function parseScoutNote(raw: Record<string, unknown>): ScoutNote {
  return {
    id: toString(raw.id),
    scoutId: toString(raw.scout_id ?? raw.scoutId),
    content: toString(raw.content),
    createdAt: toString(raw.created_at ?? raw.createdAt),
    matchKey: toOptionalString(raw.match_key ?? raw.matchKey),
  };
}

function parseTeamSummaryDefenseWhenUsed(raw: Record<string, unknown>): TeamSummaryDefenseWhenUsed {
  return {
    matchPhase: toString(raw.match_phase ?? raw.matchPhase, 'unknown') as TeamSummaryDefenseWhenUsed['matchPhase'],
    situation: toOptionalString(raw.situation),
  };
}

function parseTeamSummaryDefenseItem(raw: Record<string, unknown>): TeamSummaryDefenseItem {
  return {
    strategy: toString(raw.strategy, 'other') as TeamSummaryDefenseItem['strategy'],
    description: toString(raw.description),
    whenUsed: parseTeamSummaryDefenseWhenUsed(
      (raw.when_used as Record<string, unknown>) ?? {},
    ),
    defenseEffectiveness: toString(
      raw.defense_effectiveness ?? raw.defenseEffectiveness,
      'unknown',
    ) as TeamSummaryDefenseItem['defenseEffectiveness'],
    driverQuality: toString(
      raw.driver_quality ?? raw.driverQuality,
      'unknown',
    ) as TeamSummaryDefenseItem['driverQuality'],
    foulRisk: toString(
      raw.foul_risk ?? raw.foulRisk,
      'unknown',
    ) as TeamSummaryDefenseItem['foulRisk'],
    supportingMatches: Array.isArray(raw.supporting_matches)
      ? raw.supporting_matches.filter((value): value is string => typeof value === 'string')
      : [],
    confidence: toString(raw.confidence, 'low') as TeamSummaryDefenseItem['confidence'],
  };
}

function parseTeamSummaryNotes(raw: Record<string, unknown>): TeamSummaryNotes {
  return {
    strengths: Array.isArray(raw.strengths)
      ? raw.strengths.filter((value): value is string => typeof value === 'string')
      : [],
    concerns: Array.isArray(raw.concerns)
      ? raw.concerns.filter((value): value is string => typeof value === 'string')
      : [],
    allianceFit: Array.isArray(raw.alliance_fit)
      ? raw.alliance_fit.filter((value): value is string => typeof value === 'string')
      : [],
    isolatedNotes: Array.isArray(raw.isolated_notes)
      ? raw.isolated_notes.filter((value): value is string => typeof value === 'string')
      : [],
  };
}

function parseTeamSummaryEvidence(raw: Record<string, unknown>): TeamSummaryEvidence {
  return {
    robotReportCount: toNumber(raw.robot_report_count ?? raw.robotReportCount),
    matchCount: toNumber(raw.match_count ?? raw.matchCount),
    generalNoteCount: toNumber(raw.general_note_count ?? raw.generalNoteCount),
    defenseNoteCount: toNumber(raw.defense_note_count ?? raw.defenseNoteCount),
    scoutNoteCount: toNumber(raw.scout_note_count ?? raw.scoutNoteCount),
    lastMatchKey: toOptionalString(raw.last_match_key ?? raw.lastMatchKey),
  };
}

function parseTeamSummary(raw: Record<string, unknown>): TeamSummary {
  return {
    status: toString(raw.status, 'insufficient_data') as TeamSummary['status'],
    defense: Array.isArray(raw.defense)
      ? raw.defense.map((item) =>
          parseTeamSummaryDefenseItem(item as Record<string, unknown>),
        )
      : [],
    notes: parseTeamSummaryNotes((raw.notes as Record<string, unknown>) ?? {}),
    summaryText: toOptionalString(raw.summary_text ?? raw.summaryText),
    evidence: parseTeamSummaryEvidence((raw.evidence as Record<string, unknown>) ?? {}),
    generatedAt: toOptionalString(raw.generated_at ?? raw.generatedAt),
  };
}

function parseTeamRobotOverview(raw: Record<string, unknown>): TeamAnalytics['robot'] {
  const intakeDefenseScore = toNumber(raw.intake_defense_score);
  const scoringDefenseScore = toNumber(raw.scoring_defense_score);
  const totalDefenseScore = toNumber(
    raw.total_defense_score,
    intakeDefenseScore + scoringDefenseScore,
  );

  return {
    autoFuelCount: toNullableNumber(raw.auto_fuel_count),
    autoFuelApc: toNumber(raw.auto_fuel_apc ?? raw.autoFuelApc),
    autoCycleScore: toNumber(raw.auto_cycle_score),
    autoCycleCountAvg: toNumber(raw.auto_cycle_count_avg),
    autoCycleFuelCountAvg: toNullableNumber(raw.auto_cycle_fuel_count_avg),
    autoCycleAccuracy: toNumber(raw.auto_cycle_accuracy),
    autoTowerReliability: toNumber(raw.auto_tower_reliability),
    teleFuelCount: toNullableNumber(raw.tele_fuel_count),
    teleFuelApc: toNumber(raw.tele_fuel_apc ?? raw.teleFuelApc),
    teleCycleScore: toNumber(raw.tele_cycle_score),
    teleCycleCountAvg: toNumber(raw.tele_cycle_count_avg),
    teleCycleFuelCountAvg: toNullableNumber(raw.tele_cycle_fuel_count_avg),
    teleCycleAccuracy: toNumber(raw.tele_cycle_accuracy),
    teleTowerLevel: toString(raw.tele_tower_level, 'none'),
    teleTowerReliability: toNumber(raw.tele_tower_reliability),
    drivetrain: toOptionalString(raw.drivetrain),
    autoPathSingleLeftCount: toNumber(raw.auto_path_single_left_count),
    autoPathSingleRightCount: toNumber(raw.auto_path_single_right_count),
    autoPathDoubleLeftCount: toNumber(raw.auto_path_double_left_count),
    autoPathDoubleRightCount: toNumber(raw.auto_path_double_right_count),
    autoPathOutpostCount: toNumber(raw.auto_path_outpost_count),
    autoPathDepotCount: toNumber(raw.auto_path_depot_count),
    autoPathOutpostAndDepotCount: toNumber(raw.auto_path_outpost_and_depot_count),
    autoPathPreloadCount: toNumber(raw.auto_path_preload_count),
    autoPathNoPathCount: toNumber(raw.auto_path_no_path_count),
    intakeDefenseCount: toNumber(raw.intake_defense_count),
    intakeDefenseEffectiveness: toNumber(raw.intake_defense_effectiveness),
    scoringDefenseCount: toNumber(raw.scoring_defense_count),
    scoringDefenseEffectiveness: toNumber(raw.scoring_defense_effectiveness),
    intakeDefenseScore,
    scoringDefenseScore,
    totalDefenseScore,
    defenseScore: toNumber(raw.defense_score, totalDefenseScore),
    defenseUnawareCount: toNumber(raw.defense_unaware_count),
    defensePenaltyProneCount: toNumber(raw.defense_penalty_prone_count),
    defenseRecklessCount: toNumber(raw.defense_reckless_count),
    defenseShutDownCount: toNumber(raw.defense_shut_down_count),
    defenseEliteDrivingCount: toNumber(raw.defense_elite_driving_count),
    failureCount: toNumber(raw.failure_count),
    failureRecovery: toNumber(raw.failure_recovery),
    scoutNotes: Array.isArray(raw.scout_notes)
      ? raw.scout_notes.map((item) => parseScoutNote(item as Record<string, unknown>))
      : [],
  };
}

export function parseTeamAnalytics(raw: Record<string, unknown>): TeamAnalytics {
  const tbaRaw = (raw.tba as Record<string, unknown>) ?? {};
  const robotRaw = (raw.robot as Record<string, unknown>) ?? {};
  const humanRaw =
    (raw.human_player as Record<string, unknown>) ??
    (raw.humanPlayer as Record<string, unknown>) ??
    {};

  const scoutedRaw =
    (raw.scouted_matches as number | undefined) ??
    (raw.matches_scouted as number | undefined);

  return {
    name: toString(raw.name),
    teamKey: toString(raw.team_key ?? raw.teamKey),
    eventKey: toString(raw.event_key ?? raw.eventKey),
    tba: {
      wins: toNumber(tbaRaw.wins),
      losses: toNumber(tbaRaw.losses),
      ties: toNumber(tbaRaw.ties),
      opr: toNumber(tbaRaw.opr),
      rank: toNumber(tbaRaw.rank),
    },
    robot: parseTeamRobotOverview(robotRaw),
    summary:
      raw.summary && typeof raw.summary === 'object'
        ? parseTeamSummary(raw.summary as Record<string, unknown>)
        : null,
    humanPlayer: {
      fuelCountAvg: toNumber(humanRaw.fuel_count_avg),
      accuracy: toNumber(humanRaw.accuracy),
    },
    scoutedMatches: typeof scoutedRaw === 'number' ? scoutedRaw : undefined,
  };
}

export async function fetchTeamAnalytics(
  token: string,
  eventKey: string,
): Promise<TeamAnalytics[]> {
  const data = await apiFetch<unknown[]>(
    `/analytics/event/${encodeURIComponent(eventKey)}`,
    token,
  );

  return data.map((item) => parseTeamAnalytics(item as Record<string, unknown>));
}

function parseMatchCycleData(raw: Record<string, unknown> = {}): MatchCycleData {
  return {
    cycleCount: toNumber(raw.cycle_count),
    cycleScoreAvg: toNumber(raw.cycle_score_avg),
    rateAvg: toNumber(raw.rate_avg),
    accuracyAvg: toNumber(raw.accuracy_avg),
    fuelCountAvg: toNullableNumber(raw.fuel_count_avg),
  };
}

function parseMatchTowerData(raw: Record<string, unknown> = {}): MatchTowerData {
  return {
    attempted: toBoolean(raw.attempted),
    succeeded: toBoolean(raw.succeeded),
    level: toString(raw.level, 'none'),
    climbSpeed: toString(raw.climb_speed, 'none'),
    unclimbed: toBoolean(raw.unclimbed),
    unclimbSpeed: toString(raw.unclimb_speed, 'none'),
  };
}

function parseMatchPhase(raw: Record<string, unknown> = {}): MatchPhaseData {
  return {
    cycles: parseMatchCycleData((raw.cycles as Record<string, unknown>) ?? {}),
    tower: parseMatchTowerData((raw.tower as Record<string, unknown>) ?? {}),
  };
}

function parseMatchDefenseSide(raw: Record<string, unknown> = {}): MatchDefenseSide {
  return {
    played: toBoolean(raw.played),
    effectiveness: toString(raw.effectiveness, 'not_observed'),
    effNum: toNumber(raw.eff_num),
  };
}

function parseMatchDefenseData(raw: Record<string, unknown> = {}): MatchDefenseData {
  return {
    score: toNumber(raw.score),
    calculatedScore: toNumber(raw.calculated_score ?? raw.calculatedScore),
    unaware: toBoolean(raw.unaware),
    penaltyProne: toBoolean(raw.penalty_prone ?? raw.penaltyProne),
    reckless: toBoolean(raw.reckless),
    shutDown: toBoolean(raw.shut_down ?? raw.shutDown),
    eliteDriving: toBoolean(raw.elite_driving ?? raw.eliteDriving),
    intake: parseMatchDefenseSide((raw.intake as Record<string, unknown>) ?? {}),
    offense: parseMatchDefenseSide((raw.offense as Record<string, unknown>) ?? {}),
  };
}

function parseFailureInstance(raw: Record<string, unknown> = {}) {
  return {
    count: toNumber(raw.count),
    recoveredCount: toNumber(raw.recovered_count ?? raw.recoveredCount),
    recoveredRate: toNumber(raw.recovered_rate ?? raw.recoveredRate),
    recoveryTimeAvg: toNullableNumber(raw.recovery_time_avg ?? raw.recoveryTimeAvg),
  };
}

function parseMatchFailureData(raw: Record<string, unknown> = {}): MatchFailureData {
  const instances = (raw.instances as Record<string, unknown>) ?? {};

  return {
    count: toNumber(raw.count),
    recoveredCount: toNumber(raw.recovered_count ?? raw.recoveredCount),
    recoveredRate: toNumber(raw.recovered_rate ?? raw.recoveredRate),
    disabled: parseFailureInstance(
      (instances.disabled as Record<string, unknown>) ?? {},
    ),
    major: parseFailureInstance((instances.major as Record<string, unknown>) ?? {}),
    minor: parseFailureInstance((instances.minor as Record<string, unknown>) ?? {}),
  };
}

function parseMatchPassingData(raw: Record<string, unknown> = {}): MatchPassingData {
  return {
    opposingToNeutral: toString(raw.opposing_to_neutral, 'not_observed'),
    neutralToAlliance: toString(raw.neutral_to_alliance, 'not_observed'),
    opposingToAlliance: toString(raw.opposing_to_alliance, 'not_observed'),
  };
}

function parseMatchMobilityData(raw: Record<string, unknown> = {}): MatchMobilityData {
  return {
    trench: toString(raw.trench, 'not_observed'),
    bump: toString(raw.bump, 'not_observed'),
  };
}

function parseMatchRobot(raw: Record<string, unknown>): MatchRobotData {
  return {
    auto: parseMatchPhase((raw.auto as Record<string, unknown>) ?? {}),
    tele: parseMatchPhase((raw.tele as Record<string, unknown>) ?? {}),
    defense: parseMatchDefenseData((raw.defense as Record<string, unknown>) ?? {}),
    failures: parseMatchFailureData((raw.failures as Record<string, unknown>) ?? {}),
    passing: parseMatchPassingData((raw.passing as Record<string, unknown>) ?? {}),
    mobility: parseMatchMobilityData((raw.mobility as Record<string, unknown>) ?? {}),
    drivetrain: toOptionalString(raw.drivetrain),
    autoPath: toOptionalString(raw.auto_path ?? raw.autoPath),
    notes: toOptionalString(raw.notes),
    defenseNotes: toOptionalString(raw.defense_notes ?? raw.defenseNotes),
  };
}

function parseTeamMatchAnalytics(raw: Record<string, unknown>): TeamMatchAnalytics {
  const robotRaw = raw.robot as Record<string, unknown> | undefined;

  return {
    eventKey: toString(raw.event_key ?? raw.eventKey),
    matchKey: toString(raw.match_key ?? raw.matchKey),
    matchSort: toNumber(raw.match_sort),
    level: toString(raw.level),
    matchNumber: toNumber(raw.match_number),
    setNumber: toNumber(raw.set_number),
    robot: robotRaw ? parseMatchRobot(robotRaw) : null,
    humanPlayer: (raw.human_player as Record<string, unknown>) ?? null,
  };
}

export function parseTeamDetailResponse(data: Record<string, unknown>): TeamDetail {
  const matchesRaw = Array.isArray(data.matches)
    ? (data.matches as Record<string, unknown>[])
    : [];
  const overviewsRaw = Array.isArray(data.overviews)
    ? (data.overviews as Record<string, unknown>[])
    : [];

  return {
    teamKey: toString(data.team_key ?? data.teamKey),
    eventKeys: Array.isArray(data.event_keys)
      ? data.event_keys.filter((value): value is string => typeof value === 'string')
      : [],
    matches: matchesRaw.map((match) => parseTeamMatchAnalytics(match)),
    overviews: overviewsRaw.map((overview) => parseTeamAnalytics(overview)),
  };
}

export async function fetchTeamDetail(
  token: string,
  teamKey: string,
  eventKey: string,
): Promise<TeamDetail> {
  const data = await apiFetch<Record<string, unknown>>(
    `/analytics/team/${encodeURIComponent(teamKey)}?event_key=${encodeURIComponent(
      eventKey,
    )}`,
    token,
  );

  return parseTeamDetailResponse(data);
}
