import type {
  Event,
  EventMatch,
  TeamAnalytics,
  TeamDetail,
  TeamMatchAnalytics,
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

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function toString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function extractErrorMessage(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === 'string' && data.trim() !== '') return data;
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const detail = obj.detail;
    if (typeof detail === 'string' && detail.trim() !== '') return detail;
    const message = obj.message;
    if (typeof message === 'string' && message.trim() !== '') return message;
    const error = obj.error;
    if (typeof error === 'string' && error.trim() !== '') return error;
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
  return data.map((item) => ({
    name: toString((item as Record<string, unknown>).name),
    eventKey: toString(
      (item as Record<string, unknown>).event_key ??
        (item as Record<string, unknown>).eventKey,
    ),
    startDate: toString(
      (item as Record<string, unknown>).start_date ??
        (item as Record<string, unknown>).startDate,
    ),
  }));
}

function parseAlliance(raw: unknown) {
  const data = (raw as Record<string, unknown>) ?? {};
  return {
    teamKeys: Array.isArray(data.team_keys)
      ? data.team_keys
          .filter((teamKey): teamKey is string => typeof teamKey === 'string')
      : [],
    score:
      typeof data.score === 'number' && !Number.isNaN(data.score)
        ? data.score
        : null,
  };
}

function parseEventMatch(raw: Record<string, unknown>): EventMatch {
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
        ? scoutingStatus.robot.filter(
            (teamKey): teamKey is string => typeof teamKey === 'string',
          )
        : [],
      ai: Array.isArray(scoutingStatus.ai)
        ? scoutingStatus.ai.filter(
            (teamKey): teamKey is string => typeof teamKey === 'string',
          )
        : [],
      humanPlayer: Array.isArray(scoutingStatus.human_player)
        ? scoutingStatus.human_player.filter(
            (teamKey): teamKey is string => typeof teamKey === 'string',
          )
        : [],
    },
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

function parseTeamAnalytics(raw: Record<string, unknown>): TeamAnalytics {
  const tbaRaw = (raw.tba as Record<string, unknown>) ?? {};
  const robotRaw = (raw.robot as Record<string, unknown>) ?? {};
  const humanRaw = (raw.human_player as Record<string, unknown>) ??
    (raw.humanPlayer as Record<string, unknown>) ??
    {};
  const intakeDefenseScore = toNumber(robotRaw.intake_defense_score);
  const scoringDefenseScore = toNumber(robotRaw.scoring_defense_score);
  const totalDefenseScore =
    toNumber(robotRaw.total_defense_score) ||
    intakeDefenseScore + scoringDefenseScore;

  const scoutedRaw =
    (raw.scouted_matches as number | undefined) ??
    (raw.matches_scouted as number | undefined);
  const scoutedMatches =
    typeof scoutedRaw === 'number' ? scoutedRaw : undefined;

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
    robot: {
      autoCycleScore: toNumber(robotRaw.auto_cycle_score),
      autoCycleRate: toNumber(robotRaw.auto_cycle_rate),
      autoCycleCountAvg: toNumber(robotRaw.auto_cycle_count_avg),
      autoCycleAccuracy: toNumber(robotRaw.auto_cycle_accuracy),
      autoTowerReliability: toNumber(robotRaw.auto_tower_reliability),
      teleCycleScore: toNumber(robotRaw.tele_cycle_score),
      teleCycleRate: toNumber(robotRaw.tele_cycle_rate),
      teleCycleCountAvg: toNumber(robotRaw.tele_cycle_count_avg),
      teleCycleAccuracy: toNumber(robotRaw.tele_cycle_accuracy),
      teleTowerLevel: toString(robotRaw.tele_tower_level, 'none'),
      teleTowerReliability: toNumber(robotRaw.tele_tower_reliability),
      intakeDefenseCount: toNumber(robotRaw.intake_defense_count),
      intakeDefenseEffectiveness: toNumber(
        robotRaw.intake_defense_effectiveness,
      ),
      scoringDefenseCount: toNumber(robotRaw.scoring_defense_count),
      scoringDefenseEffectiveness: toNumber(
        robotRaw.scoring_defense_effectiveness,
      ),
      intakeDefenseScore,
      scoringDefenseScore,
      totalDefenseScore,
      failureCount: toNumber(robotRaw.failure_count),
      failureRecovery: toNumber(robotRaw.failure_recovery),
    },
    humanPlayer: {
      fuelCountAvg: toNumber(humanRaw.fuel_count_avg),
      accuracy: toNumber(humanRaw.accuracy),
    },
    scoutedMatches,
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

function parseMatchPhase(raw: Record<string, unknown> = {}) {
  const cycles = (raw.cycles as Record<string, unknown>) ?? {};
  const tower = (raw.tower as Record<string, unknown>) ?? {};
  return {
    cycles: {
      cycleCount: toNumber(cycles.cycle_count),
      cycleScoreAvg: toNumber(cycles.cycle_score_avg),
      rateAvg: toNumber(cycles.rate_avg),
      accuracyAvg: toNumber(cycles.accuracy_avg),
    },
    tower: {
      attempted: Boolean(tower.attempted),
      succeeded: Boolean(tower.succeeded),
      level: toString(tower.level, 'none'),
      climbSpeed: toString(tower.climb_speed, 'none'),
      unclimbed: Boolean(tower.unclimbed),
      unclimbSpeed: toString(tower.unclimb_speed, 'none'),
    },
  };
}

function parseMatchRobot(raw: Record<string, unknown>) {
  const defense = (raw.defense as Record<string, unknown>) ?? {};
  const intake = (defense.intake as Record<string, unknown>) ?? {};
  const offense = (defense.offense as Record<string, unknown>) ?? {};
  const failures = (raw.failures as Record<string, unknown>) ?? {};
  const instances = (failures.instances as Record<string, unknown>) ?? {};
  const passing = (raw.passing as Record<string, unknown>) ?? {};
  const mobility = (raw.mobility as Record<string, unknown>) ?? {};

  return {
    auto: parseMatchPhase((raw.auto as Record<string, unknown>) ?? {}),
    tele: parseMatchPhase((raw.tele as Record<string, unknown>) ?? {}),
    defense: {
      intake: {
        played: Boolean(intake.played),
        effectiveness: toString(intake.effectiveness, 'not_observed'),
        effNum: toNumber(intake.eff_num),
      },
      offense: {
        played: Boolean(offense.played),
        effectiveness: toString(offense.effectiveness, 'not_observed'),
        effNum: toNumber(offense.eff_num),
      },
    },
    failures: {
      count: toNumber(failures.count),
      recoveredCount: toNumber(failures.recovered_count),
      recoveredRate: toNumber(failures.recovered_rate),
      disabled: {
        count: toNumber((instances.disabled as Record<string, unknown>)?.count),
        recoveredCount: toNumber(
          (instances.disabled as Record<string, unknown>)?.recovered_count,
        ),
        recoveredRate: toNumber(
          (instances.disabled as Record<string, unknown>)?.recovered_rate,
        ),
        recoveryTimeAvg: toNumber(
          (instances.disabled as Record<string, unknown>)?.recovery_time_avg,
        ),
      },
      major: {
        count: toNumber((instances.major as Record<string, unknown>)?.count),
        recoveredCount: toNumber(
          (instances.major as Record<string, unknown>)?.recovered_count,
        ),
        recoveredRate: toNumber(
          (instances.major as Record<string, unknown>)?.recovered_rate,
        ),
        recoveryTimeAvg: toNumber(
          (instances.major as Record<string, unknown>)?.recovery_time_avg,
        ),
      },
      minor: {
        count: toNumber((instances.minor as Record<string, unknown>)?.count),
        recoveredCount: toNumber(
          (instances.minor as Record<string, unknown>)?.recovered_count,
        ),
        recoveredRate: toNumber(
          (instances.minor as Record<string, unknown>)?.recovered_rate,
        ),
        recoveryTimeAvg: toNumber(
          (instances.minor as Record<string, unknown>)?.recovery_time_avg,
        ),
      },
    },
    passing: {
      opposingToNeutral: toString(passing.opposing_to_neutral, 'none'),
      neutralToAlliance: toString(passing.neutral_to_alliance, 'none'),
      opposingToAlliance: toString(passing.opposing_to_alliance, 'none'),
    },
    mobility: {
      trench: toString(mobility.trench, 'none'),
      bump: toString(mobility.bump, 'none'),
    },
    notes: raw.notes ? toString(raw.notes) : null,
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

  const matchesRaw = Array.isArray(data.matches)
    ? (data.matches as Record<string, unknown>[])
    : [];
  const overviewsRaw = Array.isArray(data.overviews)
    ? (data.overviews as Record<string, unknown>[])
    : [];

  return {
    teamKey: toString(data.team_key ?? data.teamKey),
    eventKeys: Array.isArray(data.event_keys)
      ? (data.event_keys as string[])
      : [],
    matches: matchesRaw.map((match) => parseTeamMatchAnalytics(match)),
    overviews: overviewsRaw.map((overview) => parseTeamAnalytics(overview)),
  };
}
