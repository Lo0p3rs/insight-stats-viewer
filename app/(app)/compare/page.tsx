'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RetryError from '@/components/RetryError';
import {
  fetchEventMatches,
  fetchTbaEventTeams,
  fetchTeamAnalytics,
} from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useEventContext } from '@/lib/event-context';
import {
  buildMatchCounts,
  getCoverageValue,
  getPlayedValue,
  getScoutedValue,
  type MatchCounts,
} from '@/lib/event-stats';
import { formatPercent } from '@/lib/format';
import {
  teamAvatarUrl,
  teamDisplayName,
  teamNumberFromKey,
} from '@/lib/team-utils';
import type { TbaTeamSimple, TeamAnalytics } from '@/lib/types';

type RankDirection = 'asc' | 'desc';

type MetricKey =
  | 'autoFuelApc'
  | 'autoCycleCountAvg'
  | 'autoTowerReliability'
  | 'teleFuelApc'
  | 'teleCycleCountAvg'
  | 'teleTowerReliability'
  | 'totalDefenseScore'
  | 'failureCount'
  | 'failureRecovery';

type MetricDefinition = {
  key: MetricKey;
  label: string;
  extractor: (team: TeamAnalytics) => number;
  formatter: (value: number) => string;
  direction?: RankDirection;
};

type MetricSection = {
  label: string;
  metrics: MetricDefinition[];
};

type AccentTone = 'one' | 'two' | 'three';

type SelectedTeam = {
  slotIndex: number;
  slotLabel: string;
  accent: AccentTone;
  team: TeamAnalytics;
};

const slotLabels = ['Team 1', 'Team 2', 'Team 3'] as const;
const slotAccents: AccentTone[] = ['one', 'two', 'three'];

function buildRankMap(
  teams: TeamAnalytics[],
  extractor: (team: TeamAnalytics) => number,
  direction: RankDirection = 'desc',
) {
  return new Map(
    [...teams]
      .sort((left, right) => {
        const diff = extractor(left) - extractor(right);
        return direction === 'asc' ? diff : -diff;
      })
      .map((team, index) => [team.teamKey, index + 1]),
  );
}

function resolveTeamName(
  team: TeamAnalytics,
  tbaNameByKey: Record<string, string>,
) {
  return (
    teamDisplayName(team.name) ||
    tbaNameByKey[team.teamKey] ||
    teamNumberFromKey(team.teamKey)
  );
}

function sortTeamsByRank(teams: TeamAnalytics[]) {
  return [...teams].sort((left, right) => {
    if (left.tba.rank !== right.tba.rank) {
      return left.tba.rank - right.tba.rank;
    }

    return (
      Number(teamNumberFromKey(left.teamKey)) -
      Number(teamNumberFromKey(right.teamKey))
    );
  });
}

function areTeamKeyListsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function deriveSelectedTeamKeys(
  orderedTeams: TeamAnalytics[],
  current: string[],
) {
  if (orderedTeams.length === 0) {
    return ['', '', ''];
  }

  const availableKeys = new Set(orderedTeams.map((team) => team.teamKey));
  const first =
    current[0] && availableKeys.has(current[0])
      ? current[0]
      : orderedTeams[0]?.teamKey ?? '';
  const second =
    current[1] &&
    current[1] !== first &&
    availableKeys.has(current[1])
      ? current[1]
      : orderedTeams.find((team) => team.teamKey !== first)?.teamKey ?? '';
  const third =
    current[2] &&
    current[2] !== first &&
    current[2] !== second &&
    availableKeys.has(current[2])
      ? current[2]
      : '';

  return [first, second, third];
}

function getWinningIndexes(values: number[], lowerIsBetter = false) {
  if (values.length === 0) {
    return new Set<number>();
  }

  const target = lowerIsBetter ? Math.min(...values) : Math.max(...values);
  return new Set(
    values
      .map((value, index) => (Math.abs(value - target) < 0.0001 ? index : -1))
      .filter((index) => index !== -1),
  );
}

function getBarWidth(
  value: number,
  values: number[],
  lowerIsBetter = false,
) {
  if (values.length === 0) {
    return 100;
  }

  if (lowerIsBetter) {
    const ceiling = Math.max(...values);
    if (ceiling <= 0) {
      return 100;
    }

    const transformedValues = values.map((candidate) => ceiling - candidate);
    const transformed = ceiling - value;
    const maxTransformed = Math.max(...transformedValues);
    if (maxTransformed <= 0) {
      return 100;
    }

    return Math.max(14, (transformed / maxTransformed) * 100);
  }

  const maxValue = Math.max(...values);
  if (maxValue <= 0) {
    return 100;
  }

  return Math.max(14, (value / maxValue) * 100);
}

function ComparisonRow({
  label,
  items,
  lowerIsBetter = false,
}: {
  label: string;
  items: Array<{
    heading: string;
    value: number;
    display: string;
    rank: number | null;
    accent: AccentTone;
  }>;
  lowerIsBetter?: boolean;
}) {
  const values = items.map((item) => item.value);
  const winners = getWinningIndexes(values, lowerIsBetter);

  return (
    <div className="compare-row">
      <div className="compare-row-label">
        <span className="section-kicker">Metric</span>
        <strong>{label}</strong>
      </div>

      <div
        className="compare-value-grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item, index) => (
          <article
            key={`${label}-${item.heading}`}
            className={`compare-cell ${winners.has(index) ? 'better' : 'neutral'}`}
          >
            <div className="compare-cell-top">
              <span>{item.heading}</span>
              <small>{item.rank ? `#${item.rank}` : 'Unranked'}</small>
            </div>
            <strong>{item.display}</strong>
            <div className="compare-bar" aria-hidden="true">
              <div
                className={`compare-bar-fill compare-bar-fill-${item.accent}`}
                style={{ width: `${getBarWidth(item.value, values, lowerIsBetter)}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const metricSections: MetricSection[] = [
  {
    label: 'Auto',
    metrics: [
      {
        key: 'autoFuelApc',
        label: 'Auto APC',
        extractor: (team) => team.robot.autoFuelApc,
        formatter: (value) => value.toFixed(1),
      },
      {
        key: 'autoCycleCountAvg',
        label: 'Auto Cycles',
        extractor: (team) => team.robot.autoCycleCountAvg,
        formatter: (value) => value.toFixed(1),
      },
      {
        key: 'autoTowerReliability',
        label: 'Auto Tower',
        extractor: (team) => team.robot.autoTowerReliability,
        formatter: (value) => formatPercent(value),
      },
    ],
  },
  {
    label: 'Teleop',
    metrics: [
      {
        key: 'teleFuelApc',
        label: 'Tele APC',
        extractor: (team) => team.robot.teleFuelApc,
        formatter: (value) => value.toFixed(1),
      },
      {
        key: 'teleCycleCountAvg',
        label: 'Tele Cycles',
        extractor: (team) => team.robot.teleCycleCountAvg,
        formatter: (value) => value.toFixed(1),
      },
      {
        key: 'teleTowerReliability',
        label: 'Tele Tower',
        extractor: (team) => team.robot.teleTowerReliability,
        formatter: (value) => formatPercent(value),
      },
    ],
  },
  {
    label: 'Defense & Reliability',
    metrics: [
      {
        key: 'totalDefenseScore',
        label: 'Defense',
        extractor: (team) => team.robot.totalDefenseScore,
        formatter: (value) => value.toFixed(1),
      },
      {
        key: 'failureCount',
        label: 'Failure Count',
        extractor: (team) => team.robot.failureCount,
        formatter: (value) => value.toFixed(0),
        direction: 'asc',
      },
      {
        key: 'failureRecovery',
        label: 'Recovery',
        extractor: (team) => team.robot.failureRecovery,
        formatter: (value) => formatPercent(value),
      },
    ],
  },
];

export default function ComparePage() {
  const {
    selectedEvent,
    selectedEventKey,
    eventVersion,
    loading: eventLoading,
  } = useEventContext();
  const [teams, setTeams] = useState<TeamAnalytics[]>([]);
  const [tbaTeams, setTbaTeams] = useState<TbaTeamSimple[]>([]);
  const [countsMap, setCountsMap] = useState<Record<string, MatchCounts>>({});
  const [selectedTeamKeys, setSelectedTeamKeys] = useState<string[]>(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (eventLoading) {
      return;
    }

    const token = getToken();
    if (!selectedEventKey || !token) {
      setTeams([]);
      setTbaTeams([]);
      setCountsMap({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchTeamAnalytics(token, selectedEventKey),
      fetchEventMatches(token, selectedEventKey),
      fetchTbaEventTeams(selectedEventKey),
    ])
      .then(([teamData, matchData, tbaTeamData]) => {
        if (!cancelled) {
          setTeams(teamData);
          setCountsMap(buildMatchCounts(matchData));
          setTbaTeams(tbaTeamData);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setTeams([]);
          setCountsMap({});
          setTbaTeams([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventLoading, eventVersion, reloadNonce, selectedEventKey]);

  const sortedTeams = sortTeamsByRank(teams);

  useEffect(() => {
    const nextSelection = deriveSelectedTeamKeys(sortedTeams, selectedTeamKeys);
    if (!areTeamKeyListsEqual(selectedTeamKeys, nextSelection)) {
      setSelectedTeamKeys(nextSelection);
    }
  }, [selectedTeamKeys, sortedTeams]);

  const tbaNameByKey = Object.fromEntries(
    tbaTeams.map((team) => [
      team.key,
      teamDisplayName(team.nickname) || teamDisplayName(team.name),
    ]),
  );
  const teamByKey: Record<string, TeamAnalytics> = Object.fromEntries(
    teams.map((team) => [team.teamKey, team]),
  );
  const selectedTeams = selectedTeamKeys.reduce<SelectedTeam[]>(
    (entries, teamKey, slotIndex) => {
      const team = teamByKey[teamKey];
      if (!team) {
        return entries;
      }

      entries.push({
        slotIndex,
        slotLabel: slotLabels[slotIndex],
        accent: slotAccents[slotIndex],
        team,
      });
      return entries;
    },
    [],
  );
  const pageLoading = eventLoading || loading;
  const teamCount = sortedTeams.length;
  const topSelectedRank =
    selectedTeams.length > 0
      ? Math.min(...selectedTeams.map((entry) => entry.team.tba.rank))
      : null;

  const rankMaps = {
    autoFuelApc: buildRankMap(teams, (team) => team.robot.autoFuelApc),
    autoCycleCountAvg: buildRankMap(teams, (team) => team.robot.autoCycleCountAvg),
    autoTowerReliability: buildRankMap(teams, (team) => team.robot.autoTowerReliability),
    teleFuelApc: buildRankMap(teams, (team) => team.robot.teleFuelApc),
    teleCycleCountAvg: buildRankMap(teams, (team) => team.robot.teleCycleCountAvg),
    teleTowerReliability: buildRankMap(teams, (team) => team.robot.teleTowerReliability),
    totalDefenseScore: buildRankMap(teams, (team) => team.robot.totalDefenseScore),
    failureCount: buildRankMap(teams, (team) => team.robot.failureCount, 'asc'),
    failureRecovery: buildRankMap(teams, (team) => team.robot.failureRecovery),
  } satisfies Record<MetricKey, Map<string, number>>;

  const handleTeamChange = (slotIndex: number, nextTeamKey: string) => {
    setSelectedTeamKeys((current) => {
      const next = [...current];
      next[slotIndex] = nextTeamKey;
      return next;
    });
  };

  const getSelectableTeams = (slotIndex: number) => {
    const blockedKeys = new Set(
      selectedTeamKeys.filter((teamKey, index) => index !== slotIndex && teamKey),
    );

    return sortedTeams.filter(
      (team) =>
        team.teamKey === selectedTeamKeys[slotIndex] || !blockedKeys.has(team.teamKey),
    );
  };

  return (
    <div className="page page-wide">
      <section className="surface-card overview-hero animate-in">
        <div className="overview-hero-copy">
          <span className="hero-kicker">Compare</span>
          <h1>{selectedEvent?.name ?? 'Select an event to compare teams'}</h1>
        </div>

        <div className="overview-hero-stats">
          <div className="overview-hero-stat">
            <span>Teams</span>
            <strong>{teamCount}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Comparing</span>
            <strong>{selectedTeams.length}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Best Rank</span>
            <strong>{topSelectedRank ? `#${topSelectedRank}` : '-'}</strong>
          </div>
          <div className="overview-hero-stat overview-hero-stat-accent">
            <span>Mode</span>
            <strong>Up To 3 Teams</strong>
          </div>
        </div>
      </section>

      {!pageLoading && !selectedEventKey ? (
        <div className="surface-card empty-state">
          <strong>Select an event.</strong>
        </div>
      ) : null}

      {pageLoading ? <div className="loading">Loading...</div> : null}

      {!pageLoading && error ? (
        <RetryError
          error={error}
          onRetry={() => setReloadNonce((value) => value + 1)}
        />
      ) : null}

      {!pageLoading && !error && selectedEventKey ? (
        <>
          {teamCount < 2 ? (
            <div className="surface-card empty-state">
              <strong>At least two teams are needed to compare.</strong>
            </div>
          ) : (
            <>
              <section className="surface-card animate-in">
                <div className="section-heading">
                  <div>
                    <div className="section-kicker">Selection</div>
                    <h2>Pick Up To Three Teams</h2>
                  </div>
                </div>

                <div className="compare-toolbar">
                  {slotLabels.map((slotLabel, slotIndex) => (
                    <label
                      key={slotLabel}
                      className="compare-picker"
                    >
                      <span className="field-label">
                        {slotIndex === 2 ? `${slotLabel} (Optional)` : slotLabel}
                      </span>
                      <select
                        value={selectedTeamKeys[slotIndex]}
                        onChange={(event) => handleTeamChange(slotIndex, event.target.value)}
                      >
                        {slotIndex === 2 ? <option value="">No third team</option> : null}
                        {getSelectableTeams(slotIndex).map((team) => (
                          <option key={`${slotLabel}-${team.teamKey}`} value={team.teamKey}>
                            {teamNumberFromKey(team.teamKey)} | {resolveTeamName(team, tbaNameByKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>

              {selectedTeams.length >= 2 ? (
                <>
                  <section className="compare-team-grid animate-in">
                    {selectedTeams.map((entry) => {
                      const played = getPlayedValue(entry.team, countsMap);
                      const scouted = getScoutedValue(entry.team, countsMap);
                      const coverage = getCoverageValue(entry.team, countsMap);
                      const displayName = resolveTeamName(entry.team, tbaNameByKey);

                      return (
                        <article key={entry.team.teamKey} className="surface-card compare-team-card">
                          <div className="compare-team-header">
                            <div className="team-identity">
                              <img
                                className="team-avatar team-avatar-xl"
                                src={teamAvatarUrl(entry.team.teamKey)}
                                alt=""
                              />
                              <div className="team-identity-copy">
                                <span className="hero-kicker">{entry.slotLabel}</span>
                                <h2>Team {teamNumberFromKey(entry.team.teamKey)}</h2>
                                <div className="team-name-line">{displayName}</div>
                                <div className="hero-tag-row">
                                  <span className="hero-tag">Rank #{entry.team.tba.rank}</span>
                                  <span className="hero-tag">
                                    {entry.team.tba.wins}-{entry.team.tba.losses}-{entry.team.tba.ties}
                                  </span>
                                  <span className="hero-tag">
                                    {scouted}/{played} scouted
                                  </span>
                                </div>
                              </div>
                            </div>

                            <Link href={`/teams/${entry.team.teamKey}`} className="btn btn-ghost">
                              Open team
                            </Link>
                          </div>

                          <div className="hero-summary">
                            <div className="hero-stat">
                              <span>OPR</span>
                              <strong>{entry.team.tba.opr.toFixed(1)}</strong>
                            </div>
                            <div className="hero-stat">
                              <span>Coverage</span>
                              <strong>{formatPercent(coverage)}</strong>
                            </div>
                            <div className="hero-stat">
                              <span>Auto APC</span>
                              <strong>{entry.team.robot.autoFuelApc.toFixed(1)}</strong>
                            </div>
                            <div className="hero-stat">
                              <span>Tele APC</span>
                              <strong>{entry.team.robot.teleFuelApc.toFixed(1)}</strong>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </section>

                  {metricSections.map((section) => (
                    <section key={section.label} className="surface-card animate-in">
                      <div className="section-heading">
                        <div>
                          <div className="section-kicker">Comparison</div>
                          <h2>{section.label}</h2>
                        </div>
                      </div>

                      <div className="compare-row-list">
                        {section.metrics.map((metric) => (
                          <ComparisonRow
                            key={`${section.label}-${metric.key}`}
                            label={metric.label}
                            lowerIsBetter={metric.direction === 'asc'}
                            items={selectedTeams.map((entry) => {
                              const value = metric.extractor(entry.team);
                              return {
                                heading: `Team ${teamNumberFromKey(entry.team.teamKey)}`,
                                value,
                                display: metric.formatter(value),
                                rank: rankMaps[metric.key].get(entry.team.teamKey) ?? null,
                                accent: entry.accent,
                              };
                            })}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
