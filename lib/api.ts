import type { Event, TeamAnalytics, TeamDetail, TeamMatchAnalytics } from '@/lib/types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'https://insight-api.futuremartians.org/';

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'X-FMS-VERSION': '2.0.0+1',
};

const USERNAME = 'insight_user';

function buildUrl(path: string) {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
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

async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = extractErrorMessage(data) ?? message;
    } catch {
      try {
        const text = await response.text();
        message = extractErrorMessage(text) ?? message;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function loginWithCode(code: string): Promise<string> {
  const response = await fetch(buildUrl('auth/token'), {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: USERNAME,
      password: code,
    }),
  });

  if (!response.ok) {
    let message = `Login failed (${response.status})`;
    try {
      const data = await response.json();
      message = extractErrorMessage(data) ?? message;
    } catch {
      try {
        const text = await response.text();
        message = extractErrorMessage(text) ?? message;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const token = data.access_token;
  if (typeof token !== 'string') {
    throw new Error('Token missing in login response.');
  }
  return token;
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

  const passing = (raw.passing as Record<string, unknown>) ?? {};
  const mobility = (raw.mobility as Record<string, unknown>) ?? {};

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
