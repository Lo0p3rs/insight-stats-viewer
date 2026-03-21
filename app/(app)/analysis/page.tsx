'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import InsightScatterChart, {
  type InsightScatterDatum,
} from '@/components/InsightScatterChart';
import RetryError from '@/components/RetryError';
import Tabs from '@/components/Tabs';
import {
  fetchEventMatches,
  fetchTeamDetail,
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
import { buildTrendAlerts, type TrendAlert } from '@/lib/strategist';
import { teamDisplayName, teamNumberFromKey } from '@/lib/team-utils';
import type { TbaTeamSimple, TeamAnalytics, TeamDetail } from '@/lib/types';

type StrategistItem = {
  teamKey: string;
  name: string;
  value: string;
  note: string;
};

type AnalysisTab =
  | 'offenseGraph'
  | 'autoGraph'
  | 'teleGraph'
  | 'leaders'
  | 'sleepers'
  | 'trends';

const analysisTabs: Array<{ key: AnalysisTab; label: string }> = [
  { key: 'offenseGraph', label: 'Auto vs Tele' },
  { key: 'autoGraph', label: 'Auto vs Cycles' },
  { key: 'teleGraph', label: 'Tele vs Cycles' },
  { key: 'leaders', label: 'Top Performers' },
  { key: 'sleepers', label: 'Sleepers' },
  { key: 'trends', label: 'Trend Alerts' },
];

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createLeaderItems(
  teams: TeamAnalytics[],
  value: (team: TeamAnalytics) => string,
  note: (team: TeamAnalytics) => string,
  name: (team: TeamAnalytics) => string,
) {
  return teams.slice(0, 5).map((team) => ({
    teamKey: team.teamKey,
    name: name(team),
    value: value(team),
    note: note(team),
  }));
}

function buildRankMap(
  teams: TeamAnalytics[],
  value: (team: TeamAnalytics) => number,
  direction: 'asc' | 'desc' = 'desc',
) {
  return new Map(
    [...teams]
      .sort((left, right) => {
        const diff = value(left) - value(right);
        return direction === 'asc' ? diff : -diff;
      })
      .map((team, index) => [team.teamKey, index + 1]),
  );
}

export default function AnalysisPage() {
  const {
    selectedEvent,
    selectedEventKey,
    eventVersion,
    loading: eventLoading,
  } = useEventContext();
  const [teams, setTeams] = useState<TeamAnalytics[]>([]);
  const [tbaTeams, setTbaTeams] = useState<TbaTeamSimple[]>([]);
  const [countsMap, setCountsMap] = useState<Record<string, MatchCounts>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [trendAlerts, setTrendAlerts] = useState<TrendAlert[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendResolvedCount, setTrendResolvedCount] = useState(0);
  const [trendDetailCount, setTrendDetailCount] = useState(0);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('offenseGraph');

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
          setTbaTeams(tbaTeamData);
          setCountsMap(buildMatchCounts(matchData));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setTeams([]);
          setTbaTeams([]);
          setCountsMap({});
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

  useEffect(() => {
    if (eventLoading) {
      return;
    }

    const token = getToken();
    if (!selectedEventKey || !token || teams.length === 0) {
      setTrendAlerts([]);
      setTrendLoading(false);
      setTrendResolvedCount(0);
      setTrendDetailCount(0);
      return;
    }

    let cancelled = false;
    setTrendLoading(true);
    setTrendAlerts([]);
    setTrendResolvedCount(0);
    setTrendDetailCount(0);

    void (async () => {
      const details: TeamDetail[] = [];
      const batchSize = 8;

      for (let index = 0; index < teams.length; index += batchSize) {
        const batch = teams.slice(index, index + batchSize);
        const settled = await Promise.allSettled(
          batch.map((team) => fetchTeamDetail(token, team.teamKey, selectedEventKey)),
        );

        if (cancelled) {
          return;
        }

        const successfulDetails = settled.reduce<TeamDetail[]>((entries, result) => {
          if (result.status === 'fulfilled') {
            entries.push(result.value);
          }
          return entries;
        }, []);

        details.push(...successfulDetails);
        setTrendResolvedCount(Math.min(teams.length, index + batch.length));
        setTrendDetailCount(details.length);
      }

      if (!cancelled) {
        setTrendAlerts(buildTrendAlerts(teams, details, countsMap));
      }
    })().finally(() => {
      if (!cancelled) {
        setTrendLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [countsMap, eventLoading, eventVersion, reloadNonce, selectedEventKey, teams]);

  const pageLoading = eventLoading || loading;
  const tbaNameByKey = Object.fromEntries(
    tbaTeams.map((team) => [
      team.key,
      teamDisplayName(team.nickname) || teamDisplayName(team.name),
    ]),
  );
  const teamByKey = Object.fromEntries(teams.map((team) => [team.teamKey, team]));
  const getDisplayName = (team: TeamAnalytics) =>
    teamDisplayName(team.name) ||
    tbaNameByKey[team.teamKey] ||
    teamNumberFromKey(team.teamKey);

  const offensePoints: InsightScatterDatum[] = teams.map((team) => ({
    id: `offense-${team.teamKey}`,
    label: teamNumberFromKey(team.teamKey),
    x: team.robot.autoFuelApc,
    y: team.robot.teleFuelApc,
    meta: `Rank #${team.tba.rank}`,
  }));

  const autoCyclePoints: InsightScatterDatum[] = teams.map((team) => ({
    id: `auto-cycles-${team.teamKey}`,
    label: teamNumberFromKey(team.teamKey),
    x: team.robot.autoFuelApc,
    y: team.robot.autoCycleCountAvg,
    meta: `Rank #${team.tba.rank}`,
  }));

  const teleCyclePoints: InsightScatterDatum[] = teams.map((team) => ({
    id: `tele-cycles-${team.teamKey}`,
    label: teamNumberFromKey(team.teamKey),
    x: team.robot.teleFuelApc,
    y: team.robot.teleCycleCountAvg,
    meta: `Rank #${team.tba.rank}`,
  }));

  const autoLeaders = createLeaderItems(
    [...teams].sort((left, right) => right.robot.autoFuelApc - left.robot.autoFuelApc),
    (team) => team.robot.autoFuelApc.toFixed(1),
    (team) => `Rank #${team.tba.rank}`,
    getDisplayName,
  );

  const teleLeaders = createLeaderItems(
    [...teams].sort((left, right) => right.robot.teleFuelApc - left.robot.teleFuelApc),
    (team) => team.robot.teleFuelApc.toFixed(1),
    (team) => `Rank #${team.tba.rank}`,
    getDisplayName,
  );

  const defenseLeaders = createLeaderItems(
    [...teams].sort((left, right) => right.robot.totalDefenseScore - left.robot.totalDefenseScore),
    (team) => team.robot.totalDefenseScore.toFixed(1),
    (team) => `Rank #${team.tba.rank}`,
    getDisplayName,
  );

  const failureLeaders = createLeaderItems(
    [...teams].sort((left, right) => {
      if (left.robot.failureCount !== right.robot.failureCount) {
        return right.robot.failureCount - left.robot.failureCount;
      }

      return left.robot.failureRecovery - right.robot.failureRecovery;
    }),
    (team) => team.robot.failureCount.toFixed(0),
    (team) => formatPercent(team.robot.failureRecovery),
    getDisplayName,
  );

  const autoApcRanks = buildRankMap(teams, (team) => team.robot.autoFuelApc);
  const teleApcRanks = buildRankMap(teams, (team) => team.robot.teleFuelApc);
  const sleeperCandidates = teams
    .filter((team) => team.tba.rank > 0)
    .map((team) => {
      const autoRank = autoApcRanks.get(team.teamKey) ?? teams.length;
      const teleRank = teleApcRanks.get(team.teamKey) ?? teams.length;
      const offenseRank = (autoRank + teleRank) / 2;

      return {
        team,
        autoRank,
        teleRank,
        gap: team.tba.rank - offenseRank,
      };
    })
    .sort((left, right) => {
      if (left.gap !== right.gap) {
        return right.gap - left.gap;
      }

      return left.team.tba.rank - right.team.tba.rank;
    });

  const sleeperTeams = (
    sleeperCandidates.filter((item) => item.gap >= 2).length > 0
      ? sleeperCandidates.filter((item) => item.gap >= 2)
      : sleeperCandidates
  )
    .slice(0, 4)
    .map<StrategistItem>(({ team, autoRank, teleRank, gap }) => ({
      teamKey: team.teamKey,
      name: getDisplayName(team),
      value: `Gap +${gap.toFixed(1)}`,
      note: `Rank #${team.tba.rank} | Auto APC #${autoRank} | Tele APC #${teleRank}`,
    }));

  const scoutNext = [...teams]
    .filter((team) => team.tba.rank > 0 && team.tba.rank <= 12)
    .sort((left, right) => {
      const coverageDiff =
        getCoverageValue(left, countsMap) - getCoverageValue(right, countsMap);
      if (coverageDiff !== 0) {
        return coverageDiff;
      }

      return left.tba.rank - right.tba.rank;
    })
    .slice(0, 8);

  const averageAuto = average(teams.map((team) => team.robot.autoFuelApc));
  const averageTele = average(teams.map((team) => team.robot.teleFuelApc));
  const averageDefense = average(teams.map((team) => team.robot.totalDefenseScore));
  const averageCoverage = average(
    teams.map((team) => getCoverageValue(team, countsMap)),
  );
  const trendStatusText = trendLoading
    ? `Building alerts... ${trendResolvedCount}/${teams.length}`
    : trendDetailCount > 0
      ? `Using ${trendDetailCount}/${teams.length} detailed team logs`
      : 'Requires at least 4 scouted matches per team';

  return (
    <div className="page page-wide">
      <section className="surface-card overview-hero animate-in">
        <div className="overview-hero-copy">
          <span className="hero-kicker">Analysis</span>
          <h1>{selectedEvent?.name ?? 'Select an event'}</h1>
        </div>

        <div className="overview-hero-stats">
          <div className="overview-hero-stat">
            <span>Teams</span>
            <strong>{teams.length}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Avg Auto APC</span>
            <strong>{averageAuto.toFixed(1)}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Avg Tele APC</span>
            <strong>{averageTele.toFixed(1)}</strong>
          </div>
          <div className="overview-hero-stat overview-hero-stat-accent">
            <span>Coverage</span>
            <strong>{formatPercent(averageCoverage)}</strong>
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
          {teams.length === 0 ? (
            <div className="surface-card empty-state">
              <strong>No teams returned for this event.</strong>
            </div>
          ) : (
            <>
              <section className="surface-card animate-in">
                <div className="section-heading">
                  <div>
                    <div className="section-kicker">Workspace</div>
                    <h2>Analysis Tabs</h2>
                  </div>
                  <span className="section-note">Split by strategist task</span>
                </div>
                <Tabs
                  options={analysisTabs}
                  value={activeTab}
                  onChange={(key) => setActiveTab(key as AnalysisTab)}
                />
              </section>

              {activeTab === 'offenseGraph' ? (
                <section className="surface-card animate-in">
                  <div className="section-heading">
                    <div>
                      <div className="section-kicker">Offense</div>
                      <h2>Auto APC vs Tele APC</h2>
                    </div>
                  </div>
                  <InsightScatterChart
                    data={offensePoints}
                    xLabel="Auto APC"
                    yLabel="Tele APC"
                  />
                </section>
              ) : null}

              {activeTab === 'autoGraph' ? (
                <section className="surface-card animate-in">
                  <div className="section-heading">
                    <div>
                      <div className="section-kicker">Efficiency</div>
                      <h2>Auto APC vs Cycles</h2>
                    </div>
                  </div>
                  <InsightScatterChart
                    data={autoCyclePoints}
                    xLabel="Auto APC"
                    yLabel="Auto Cycles"
                  />
                </section>
              ) : null}

              {activeTab === 'teleGraph' ? (
                <section className="surface-card animate-in">
                  <div className="section-heading">
                    <div>
                      <div className="section-kicker">Efficiency</div>
                      <h2>Tele APC vs Cycles</h2>
                    </div>
                  </div>
                  <InsightScatterChart
                    data={teleCyclePoints}
                    xLabel="Tele APC"
                    yLabel="Tele Cycles"
                  />
                </section>
              ) : null}

              {activeTab === 'leaders' ? (
                <>
                  <section className="analysis-board-grid animate-in">
                    <div className="surface-card">
                      <div className="section-heading">
                        <div>
                          <div className="section-kicker">Leaders</div>
                          <h2>Auto APC</h2>
                        </div>
                      </div>
                      <div className="insight-list">
                        {autoLeaders.map((item) => (
                          <Link
                            key={item.teamKey}
                            href={`/teams/${item.teamKey}`}
                            className="insight-list-item"
                          >
                            <div className="insight-list-heading">
                              <strong>{teamNumberFromKey(item.teamKey)}</strong>
                              <span>{item.name}</span>
                            </div>
                            <span>{item.note}</span>
                            <em>{item.value}</em>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="surface-card">
                      <div className="section-heading">
                        <div>
                          <div className="section-kicker">Leaders</div>
                          <h2>Tele APC</h2>
                        </div>
                      </div>
                      <div className="insight-list">
                        {teleLeaders.map((item) => (
                          <Link
                            key={item.teamKey}
                            href={`/teams/${item.teamKey}`}
                            className="insight-list-item"
                          >
                            <div className="insight-list-heading">
                              <strong>{teamNumberFromKey(item.teamKey)}</strong>
                              <span>{item.name}</span>
                            </div>
                            <span>{item.note}</span>
                            <em>{item.value}</em>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="surface-card">
                      <div className="section-heading">
                        <div>
                          <div className="section-kicker">Leaders</div>
                          <h2>Defense</h2>
                        </div>
                      </div>
                      <div className="insight-list">
                        {defenseLeaders.map((item) => (
                          <Link
                            key={item.teamKey}
                            href={`/teams/${item.teamKey}`}
                            className="insight-list-item"
                          >
                            <div className="insight-list-heading">
                              <strong>{teamNumberFromKey(item.teamKey)}</strong>
                              <span>{item.name}</span>
                            </div>
                            <span>{item.note}</span>
                            <em>{item.value}</em>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="surface-card">
                      <div className="section-heading">
                        <div>
                          <div className="section-kicker">Risk</div>
                          <h2>Most Failures</h2>
                        </div>
                      </div>
                      <div className="insight-list">
                        {failureLeaders.map((item) => (
                          <Link
                            key={item.teamKey}
                            href={`/teams/${item.teamKey}`}
                            className="insight-list-item"
                          >
                            <div className="insight-list-heading">
                              <strong>{teamNumberFromKey(item.teamKey)}</strong>
                              <span>{item.name}</span>
                            </div>
                            <span>{item.note}</span>
                            <em>{item.value}</em>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="surface-card animate-in">
                    <div className="section-heading">
                      <div>
                        <div className="section-kicker">Scout Next</div>
                        <h2>Top Seeds With Thin Coverage</h2>
                      </div>
                      <span className="section-note">Top 12 by rank</span>
                    </div>

                    <div className="analysis-watchlist">
                      {scoutNext.map((team) => {
                        const played = getPlayedValue(team, countsMap);
                        const scouted = getScoutedValue(team, countsMap);
                        const coverage = getCoverageValue(team, countsMap);

                        return (
                          <Link
                            key={team.teamKey}
                            href={`/teams/${team.teamKey}`}
                            className="analysis-watch-item"
                          >
                            <div>
                              <strong>{teamNumberFromKey(team.teamKey)}</strong>
                              <span>{getDisplayName(team)}</span>
                              <span>Rank #{team.tba.rank}</span>
                            </div>
                            <div>
                              <strong>{formatPercent(coverage)}</strong>
                              <span>
                                {scouted}/{played}
                              </span>
                            </div>
                            <div>
                              <strong>
                                {team.tba.wins}-{team.tba.losses}-{team.tba.ties}
                              </strong>
                              <span>Record</span>
                            </div>
                            <div>
                              <strong>
                                {(team.robot.autoFuelApc + team.robot.teleFuelApc).toFixed(1)}
                              </strong>
                              <span>Total APC</span>
                            </div>
                            <div>
                              <strong>{team.robot.totalDefenseScore.toFixed(1)}</strong>
                              <span>Defense</span>
                            </div>
                          </Link>
                        );
                      })}

                      {scoutNext.length === 0 ? (
                        <div className="empty-state compact">
                          <strong>No coverage watch items.</strong>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="surface-card animate-in">
                    <div className="section-heading">
                      <div>
                        <div className="section-kicker">Field Snapshot</div>
                        <h2>Essential Averages</h2>
                      </div>
                    </div>

                    <div className="analysis-metric-grid">
                      <div className="hero-stat">
                        <span>Avg Defense</span>
                        <strong>{averageDefense.toFixed(1)}</strong>
                      </div>
                      <div className="hero-stat">
                        <span>Avg Recovery</span>
                        <strong>
                          {formatPercent(
                            average(teams.map((team) => team.robot.failureRecovery)),
                          )}
                        </strong>
                      </div>
                      <div className="hero-stat">
                        <span>Best Auto APC</span>
                        <strong>
                          {teams.length > 0
                            ? Math.max(...teams.map((team) => team.robot.autoFuelApc)).toFixed(1)
                            : '0.0'}
                        </strong>
                      </div>
                      <div className="hero-stat">
                        <span>Best Tele APC</span>
                        <strong>
                          {teams.length > 0
                            ? Math.max(...teams.map((team) => team.robot.teleFuelApc)).toFixed(1)
                            : '0.0'}
                        </strong>
                      </div>
                    </div>
                  </section>
                </>
              ) : null}

              {activeTab === 'sleepers' ? (
                <section className="surface-card animate-in">
                  <div className="section-heading">
                    <div>
                      <div className="section-kicker">Targets</div>
                      <h2>Sleepers</h2>
                    </div>
                  </div>
                  <div className="insight-list">
                    {sleeperTeams.map((item) => (
                      <Link
                        key={item.teamKey}
                        href={`/teams/${item.teamKey}`}
                        className="insight-list-item"
                      >
                        <div className="insight-list-heading">
                          <strong>{teamNumberFromKey(item.teamKey)}</strong>
                          <span>{item.name}</span>
                        </div>
                        <span>{item.note}</span>
                        <em>{item.value}</em>
                      </Link>
                    ))}

                    {sleeperTeams.length === 0 ? (
                      <div className="empty-state compact">
                        <strong>No sleepers yet.</strong>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {activeTab === 'trends' ? (
                <section className="surface-card animate-in">
                  <div className="section-heading">
                    <div>
                      <div className="section-kicker">Trend Alerts</div>
                      <h2>Recent Movement</h2>
                    </div>
                    <span className="section-note">{trendStatusText}</span>
                  </div>

                  <div className="trend-alert-grid">
                    {trendAlerts.map((alert) => {
                      const team = teamByKey[alert.teamKey];

                      return (
                        <Link
                          key={`${alert.teamKey}-${alert.variant}`}
                          href={`/teams/${alert.teamKey}`}
                          className={`trend-alert-card trend-alert-card-${alert.variant}`}
                        >
                          <div className="trend-alert-head">
                            <span className={`trend-alert-pill trend-alert-pill-${alert.variant}`}>
                              {alert.title}
                            </span>
                            <strong>{alert.deltaLabel}</strong>
                          </div>

                          <div className="insight-list-heading">
                            <strong>{teamNumberFromKey(alert.teamKey)}</strong>
                            <span>
                              {team ? getDisplayName(team) : teamNumberFromKey(alert.teamKey)}
                            </span>
                          </div>

                          <p className="trend-alert-copy">{alert.detail}</p>
                          <small>{alert.supportLabel}</small>
                        </Link>
                      );
                    })}

                    {trendLoading && trendAlerts.length === 0 ? (
                      <div className="surface-card compact-loading-card">
                        <strong>Building trend alerts...</strong>
                        <span className="section-note">
                          Processing team detail logs for this event.
                        </span>
                      </div>
                    ) : null}

                    {!trendLoading && trendAlerts.length === 0 ? (
                      <div className="empty-state compact">
                        <strong>No trend alerts yet.</strong>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
