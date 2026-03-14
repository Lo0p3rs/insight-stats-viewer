'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import InsightScatterChart, {
  type InsightScatterDatum,
} from '@/components/InsightScatterChart';
import RetryError from '@/components/RetryError';
import { fetchEventMatches, fetchTeamAnalytics } from '@/lib/api';
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
import { teamDisplayName, teamNumberFromKey } from '@/lib/team-utils';
import type { TeamAnalytics } from '@/lib/types';

type StrategistItem = {
  teamKey: string;
  name: string;
  value: string;
  note: string;
};

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
) {
  return teams.slice(0, 5).map((team) => ({
    teamKey: team.teamKey,
    name: teamDisplayName(team.name),
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
  const [countsMap, setCountsMap] = useState<Record<string, MatchCounts>>({});
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
    ])
      .then(([teamData, matchData]) => {
        if (!cancelled) {
          setTeams(teamData);
          setCountsMap(buildMatchCounts(matchData));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setTeams([]);
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

  const pageLoading = eventLoading || loading;

  const offensePoints: InsightScatterDatum[] = teams.map((team) => ({
    id: `offense-${team.teamKey}`,
    label: teamNumberFromKey(team.teamKey),
    x: team.robot.autoCycleScore,
    y: team.robot.teleCycleScore,
    meta: `Rank #${team.tba.rank}`,
  }));

  const autoAccuracyPoints: InsightScatterDatum[] = teams.map((team) => ({
    id: `auto-accuracy-${team.teamKey}`,
    label: teamNumberFromKey(team.teamKey),
    x: team.robot.autoCycleScore,
    y: team.robot.autoCycleAccuracy,
    meta: `Rank #${team.tba.rank}`,
  }));

  const teleAccuracyPoints: InsightScatterDatum[] = teams.map((team) => ({
    id: `tele-accuracy-${team.teamKey}`,
    label: teamNumberFromKey(team.teamKey),
    x: team.robot.teleCycleScore,
    y: team.robot.teleCycleAccuracy,
    meta: `Rank #${team.tba.rank}`,
  }));

  const autoLeaders = createLeaderItems(
    [...teams].sort((left, right) => right.robot.autoCycleScore - left.robot.autoCycleScore),
    (team) => team.robot.autoCycleScore.toFixed(1),
    (team) => `Rank #${team.tba.rank}`,
  );

  const teleLeaders = createLeaderItems(
    [...teams].sort((left, right) => right.robot.teleCycleScore - left.robot.teleCycleScore),
    (team) => team.robot.teleCycleScore.toFixed(1),
    (team) => `Rank #${team.tba.rank}`,
  );

  const defenseLeaders = createLeaderItems(
    [...teams].sort((left, right) => right.robot.totalDefenseScore - left.robot.totalDefenseScore),
    (team) => team.robot.totalDefenseScore.toFixed(1),
    (team) => `Rank #${team.tba.rank}`,
  );

  const reliabilityLeaders = createLeaderItems(
    [...teams].sort((left, right) => {
      if (left.robot.failureCount !== right.robot.failureCount) {
        return left.robot.failureCount - right.robot.failureCount;
      }

      return right.robot.failureRecovery - left.robot.failureRecovery;
    }),
    (team) => team.robot.failureCount.toFixed(0),
    (team) => formatPercent(team.robot.failureRecovery),
  );

  const autoScoreRanks = buildRankMap(teams, (team) => team.robot.autoCycleScore);
  const teleScoreRanks = buildRankMap(teams, (team) => team.robot.teleCycleScore);
  const sleeperCandidates = teams
    .filter((team) => team.tba.rank > 0)
    .map((team) => {
      const autoRank = autoScoreRanks.get(team.teamKey) ?? teams.length;
      const teleRank = teleScoreRanks.get(team.teamKey) ?? teams.length;
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
      name: teamDisplayName(team.name),
      value: `Gap +${gap.toFixed(1)}`,
      note: `Rank #${team.tba.rank} | Auto #${autoRank} | Tele #${teleRank}`,
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

  const averageAuto = average(teams.map((team) => team.robot.autoCycleScore));
  const averageTele = average(teams.map((team) => team.robot.teleCycleScore));
  const averageDefense = average(teams.map((team) => team.robot.totalDefenseScore));
  const averageCoverage = average(
    teams.map((team) => getCoverageValue(team, countsMap)),
  );

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
            <span>Avg Auto</span>
            <strong>{averageAuto.toFixed(1)}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Avg Tele</span>
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
          <section className="analysis-grid animate-in">
            <div className="surface-card">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Offense</div>
                  <h2>Auto vs Tele</h2>
                </div>
              </div>
              <InsightScatterChart
                data={offensePoints}
                xLabel="Auto"
                yLabel="Tele"
              />
            </div>

            <div className="surface-card">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Efficiency</div>
                  <h2>Auto vs Accuracy</h2>
                </div>
              </div>
              <InsightScatterChart
                data={autoAccuracyPoints}
                xLabel="Auto"
                yLabel="Accuracy"
                formatY={(value) => formatPercent(value)}
              />
            </div>

            <div className="surface-card">
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
            </div>

            <div className="surface-card">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Efficiency</div>
                  <h2>Tele vs Accuracy</h2>
                </div>
              </div>
              <InsightScatterChart
                data={teleAccuracyPoints}
                xLabel="Tele"
                yLabel="Accuracy"
                formatY={(value) => formatPercent(value)}
              />
            </div>
          </section>

          <section className="analysis-board-grid animate-in">
            <div className="surface-card">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Leaders</div>
                  <h2>Auto</h2>
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
                  <h2>Tele</h2>
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
                  <div className="section-kicker">Reliability</div>
                  <h2>Fewest Failures</h2>
                </div>
              </div>
              <div className="insight-list">
                {reliabilityLeaders.map((item) => (
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
                      <span>{teamDisplayName(team.name)}</span>
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
                        {(team.robot.autoCycleScore + team.robot.teleCycleScore).toFixed(1)}
                      </strong>
                      <span>Auto + Tele</span>
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
                <span>Best Auto</span>
                <strong>
                  {teams.length > 0
                    ? Math.max(...teams.map((team) => team.robot.autoCycleScore)).toFixed(1)
                    : '0.0'}
                </strong>
              </div>
              <div className="hero-stat">
                <span>Best Tele</span>
                <strong>
                  {teams.length > 0
                    ? Math.max(...teams.map((team) => team.robot.teleCycleScore)).toFixed(1)
                    : '0.0'}
                </strong>
              </div>
            </div>
          </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
