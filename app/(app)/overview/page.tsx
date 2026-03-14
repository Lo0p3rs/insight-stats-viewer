'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import RetryError from '@/components/RetryError';
import { fetchEventMatches, fetchTeamAnalytics } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useEventContext } from '@/lib/event-context';
import {
  buildMatchCounts,
  getPlayedValue,
  getScoutedValue,
  type MatchCounts,
} from '@/lib/event-stats';
import { formatPercent } from '@/lib/format';
import { teamAvatarUrl, teamNumberFromKey } from '@/lib/team-utils';
import type { TeamAnalytics } from '@/lib/types';

type SortKey =
  | 'team'
  | 'record'
  | 'played'
  | 'scouted'
  | 'rank'
  | 'autoScore'
  | 'autoRate'
  | 'autoCount'
  | 'autoAccuracy'
  | 'autoTowerReliability'
  | 'teleScore'
  | 'teleRate'
  | 'teleCount'
  | 'teleAccuracy'
  | 'teleTowerLevel'
  | 'teleTowerReliability'
  | 'intakeDefenseCount'
  | 'intakeDefenseEffectiveness'
  | 'scoringDefenseCount'
  | 'scoringDefenseEffectiveness'
  | 'intakeDefenseScore'
  | 'scoringDefenseScore'
  | 'defense'
  | 'failures'
  | 'failureRecovery';

type Column = {
  key: SortKey;
  label: string;
  render: (team: TeamAnalytics) => ReactNode;
  sortValue: (team: TeamAnalytics) => number | string;
  sticky?: boolean;
};

const essentialColumnKeys: SortKey[] = [
  'team',
  'record',
  'played',
  'scouted',
  'rank',
  'autoScore',
  'autoAccuracy',
  'teleScore',
  'teleAccuracy',
  'defense',
  'failures',
  'failureRecovery',
];

export default function OverviewPage() {
  const {
    selectedEvent,
    selectedEventKey,
    eventVersion,
    loading: eventLoading,
  } = useEventContext();
  const [teams, setTeams] = useState<TeamAnalytics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [countsMap, setCountsMap] = useState<Record<string, MatchCounts>>({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [countsError, setCountsError] = useState<unknown | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showMoreData, setShowMoreData] = useState(false);

  useEffect(() => {
    if (eventLoading) {
      return;
    }

    const token = getToken();
    if (!selectedEventKey || !token) {
      setTeams([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTeamAnalytics(token, selectedEventKey)
      .then((data) => {
        if (!cancelled) {
          setTeams(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
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
  }, [eventLoading, selectedEventKey, eventVersion, reloadNonce]);

  useEffect(() => {
    if (eventLoading) {
      return;
    }

    const token = getToken();
    if (!selectedEventKey || !token) {
      setCountsMap({});
      setCountsLoading(false);
      return;
    }

    let cancelled = false;
    setCountsLoading(true);
    setCountsError(null);

    fetchEventMatches(token, selectedEventKey)
      .then((matches) => {
        if (!cancelled) {
          setCountsMap(buildMatchCounts(matches));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCountsMap({});
          setCountsError(err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCountsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventLoading, selectedEventKey, eventVersion, reloadNonce]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDir('asc');
  };

  const columns: Column[] = [
    {
      key: 'team',
      label: 'Team',
      sticky: true,
      render: (team) => (
        <div className="team-cell">
          <img className="team-avatar" src={teamAvatarUrl(team.teamKey)} alt="" />
          <Link href={`/teams/${team.teamKey}`}>
            <strong>{teamNumberFromKey(team.teamKey)}</strong>
          </Link>
        </div>
      ),
      sortValue: (team) => Number(teamNumberFromKey(team.teamKey)),
    },
    {
      key: 'record',
      label: 'Record',
      render: (team) => `${team.tba.wins}-${team.tba.losses}-${team.tba.ties}`,
      sortValue: (team) => team.tba.wins - team.tba.losses + team.tba.ties * 0.5,
    },
    {
      key: 'played',
      label: 'Played',
      render: (team) => getPlayedValue(team, countsMap),
      sortValue: (team) => getPlayedValue(team, countsMap),
    },
    {
      key: 'scouted',
      label: 'Scouted',
      render: (team) =>
        `${getScoutedValue(team, countsMap)}/${getPlayedValue(team, countsMap)}`,
      sortValue: (team) => getScoutedValue(team, countsMap),
    },
    {
      key: 'rank',
      label: 'Rank',
      render: (team) => `#${team.tba.rank}`,
      sortValue: (team) => team.tba.rank,
    },
    {
      key: 'autoScore',
      label: 'Auto Score',
      render: (team) => team.robot.autoCycleScore.toFixed(1),
      sortValue: (team) => team.robot.autoCycleScore,
    },
    {
      key: 'autoRate',
      label: 'Auto Rate',
      render: (team) => team.robot.autoCycleRate.toFixed(1),
      sortValue: (team) => team.robot.autoCycleRate,
    },
    {
      key: 'autoCount',
      label: 'Auto Count',
      render: (team) => team.robot.autoCycleCountAvg.toFixed(1),
      sortValue: (team) => team.robot.autoCycleCountAvg,
    },
    {
      key: 'autoAccuracy',
      label: 'Auto Accuracy',
      render: (team) => formatPercent(team.robot.autoCycleAccuracy),
      sortValue: (team) => team.robot.autoCycleAccuracy,
    },
    {
      key: 'autoTowerReliability',
      label: 'Auto Tower',
      render: (team) => formatPercent(team.robot.autoTowerReliability),
      sortValue: (team) => team.robot.autoTowerReliability,
    },
    {
      key: 'teleScore',
      label: 'Tele Score',
      render: (team) => team.robot.teleCycleScore.toFixed(1),
      sortValue: (team) => team.robot.teleCycleScore,
    },
    {
      key: 'teleRate',
      label: 'Tele Rate',
      render: (team) => team.robot.teleCycleRate.toFixed(1),
      sortValue: (team) => team.robot.teleCycleRate,
    },
    {
      key: 'teleCount',
      label: 'Tele Count',
      render: (team) => team.robot.teleCycleCountAvg.toFixed(1),
      sortValue: (team) => team.robot.teleCycleCountAvg,
    },
    {
      key: 'teleAccuracy',
      label: 'Tele Accuracy',
      render: (team) => formatPercent(team.robot.teleCycleAccuracy),
      sortValue: (team) => team.robot.teleCycleAccuracy,
    },
    {
      key: 'teleTowerLevel',
      label: 'Tele Tower',
      render: (team) => team.robot.teleTowerLevel,
      sortValue: (team) => team.robot.teleTowerLevel,
    },
    {
      key: 'teleTowerReliability',
      label: 'Tele Rel.',
      render: (team) => formatPercent(team.robot.teleTowerReliability),
      sortValue: (team) => team.robot.teleTowerReliability,
    },
    {
      key: 'intakeDefenseCount',
      label: 'Intake Cnt',
      render: (team) => team.robot.intakeDefenseCount.toFixed(0),
      sortValue: (team) => team.robot.intakeDefenseCount,
    },
    {
      key: 'intakeDefenseEffectiveness',
      label: 'Intake Eff',
      render: (team) => team.robot.intakeDefenseEffectiveness.toFixed(1),
      sortValue: (team) => team.robot.intakeDefenseEffectiveness,
    },
    {
      key: 'scoringDefenseCount',
      label: 'Scoring Cnt',
      render: (team) => team.robot.scoringDefenseCount.toFixed(0),
      sortValue: (team) => team.robot.scoringDefenseCount,
    },
    {
      key: 'scoringDefenseEffectiveness',
      label: 'Scoring Eff',
      render: (team) => team.robot.scoringDefenseEffectiveness.toFixed(1),
      sortValue: (team) => team.robot.scoringDefenseEffectiveness,
    },
    {
      key: 'intakeDefenseScore',
      label: 'Intake Def',
      render: (team) => team.robot.intakeDefenseScore.toFixed(1),
      sortValue: (team) => team.robot.intakeDefenseScore,
    },
    {
      key: 'scoringDefenseScore',
      label: 'Scoring Def',
      render: (team) => team.robot.scoringDefenseScore.toFixed(1),
      sortValue: (team) => team.robot.scoringDefenseScore,
    },
    {
      key: 'defense',
      label: 'Defense',
      render: (team) => team.robot.totalDefenseScore.toFixed(1),
      sortValue: (team) => team.robot.totalDefenseScore,
    },
    {
      key: 'failures',
      label: 'Failure Count',
      render: (team) => team.robot.failureCount.toFixed(0),
      sortValue: (team) => team.robot.failureCount,
    },
    {
      key: 'failureRecovery',
      label: 'Recovery',
      render: (team) => formatPercent(team.robot.failureRecovery),
      sortValue: (team) => team.robot.failureRecovery,
    },
  ];

  const visibleColumns = columns.filter(
    (column) => showMoreData || essentialColumnKeys.includes(column.key),
  );

  useEffect(() => {
    if (showMoreData) {
      return;
    }

    if (!essentialColumnKeys.includes(sortKey)) {
      setSortKey('rank');
      setSortDir('asc');
    }
  }, [showMoreData, sortKey]);

  const activeColumn =
    visibleColumns.find((column) => column.key === sortKey) ??
    columns.find((column) => column.key === sortKey) ??
    visibleColumns.find((column) => column.key === 'rank')!;

  const sortedTeams = [...teams].sort((left, right) => {
    const leftValue = activeColumn.sortValue(left);
    const rightValue = activeColumn.sortValue(right);

    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      const stringCompare = leftValue.localeCompare(rightValue, undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      return sortDir === 'asc' ? stringCompare : -stringCompare;
    }

    const numberCompare = Number(leftValue) - Number(rightValue);
    return sortDir === 'asc' ? numberCompare : -numberCompare;
  });

  const totalGamesPlayed = teams.reduce(
    (sum, team) => sum + getPlayedValue(team, countsMap),
    0,
  );
  const totalGamesScouted = teams.reduce(
    (sum, team) => sum + getScoutedValue(team, countsMap),
    0,
  );
  const scoutingCoverage =
    totalGamesPlayed > 0 ? totalGamesScouted / totalGamesPlayed : 0;

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕';
  const pageLoading = eventLoading || loading;
  const scoutingStatusText = countsLoading
    ? 'Updating counts...'
    : countsError
      ? 'Using fallback counts.'
      : '';

  return (
    <div className="page page-wide">
      <section className="surface-card overview-hero animate-in">
        <div className="overview-hero-copy">
          <span className="hero-kicker">Overview</span>
          <h1>{selectedEvent?.name ?? 'Select an event to begin'}</h1>
        </div>

        <div className="overview-hero-stats">
          <div className="overview-hero-stat">
            <span>Teams</span>
            <strong>{teams.length}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Played</span>
            <strong>{totalGamesPlayed}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Scouted</span>
            <strong>{totalGamesScouted}</strong>
          </div>
          <div className="overview-hero-stat overview-hero-stat-accent">
            <span>Coverage</span>
            <strong>{formatPercent(scoutingCoverage)}</strong>
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
            <section className="surface-card table-shell animate-in">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Teams</div>
                  <h2>Team Stats</h2>
                </div>
                <div className="table-controls">
                  <label className="data-toggle">
                    <input
                      type="checkbox"
                      checked={showMoreData}
                      onChange={(event) => setShowMoreData(event.target.checked)}
                    />
                    <span className="data-toggle-track" aria-hidden="true">
                      <span className="data-toggle-thumb" />
                    </span>
                    <span className="data-toggle-copy">More stats</span>
                  </label>
                </div>
              </div>

              {scoutingStatusText ? (
                <span className="section-note">{scoutingStatusText}</span>
              ) : null}

              <div className="table-card">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {visibleColumns.map((column) => (
                          <th
                            key={column.key}
                            className={column.sticky ? 'sticky-cell' : undefined}
                          >
                            <button type="button" onClick={() => handleSort(column.key)}>
                              {column.label}{' '}
                              <span className="sort-indicator">
                                {sortIndicator(column.key)}
                              </span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTeams.map((team) => (
                        <tr key={team.teamKey}>
                          {visibleColumns.map((column) => (
                            <td
                              key={column.key}
                              className={column.sticky ? 'sticky-cell' : undefined}
                            >
                              {column.render(team)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
