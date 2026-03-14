'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchTeamAnalytics, fetchTeamDetail } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useEventContext } from '@/lib/event-context';
import { teamAvatarUrl, teamNumberFromKey } from '@/lib/team-utils';
import type { TeamAnalytics } from '@/lib/types';

type SortKey =
  | 'team'
  | 'name'
  | 'record'
  | 'played'
  | 'scouted'
  | 'rank'
  | 'opr'
  | 'autoScore'
  | 'autoRate'
  | 'teleScore'
  | 'teleRate'
  | 'defense'
  | 'failures'
  | 'humanAccuracy';

type ScoutedInfo = { scouted: number; total: number };

export default function OverviewPage() {
  const { selectedEventKey } = useEventContext();
  const [teams, setTeams] = useState<TeamAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [scoutedMap, setScoutedMap] = useState<Record<string, ScoutedInfo>>({});
  const [scoutedStatus, setScoutedStatus] = useState<{
    loading: boolean;
    completed: number;
    total: number;
  }>({ loading: false, completed: 0, total: 0 });

  useEffect(() => {
    const token = getToken();
    if (!selectedEventKey || !token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setScoutedMap({});
    setScoutedStatus({ loading: false, completed: 0, total: 0 });
    setLoading(true);
    setError(null);
    fetchTeamAnalytics(token, selectedEventKey)
      .then((data) => {
        if (!cancelled) setTeams(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load teams.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEventKey]);

  useEffect(() => {
    const token = getToken();
    if (!selectedEventKey || !token || teams.length === 0) return;
    if (scoutedStatus.completed >= teams.length && teams.length > 0) return;

    const inlineCounts = teams.filter(
      (team) => typeof team.scoutedMatches === 'number',
    );

    if (inlineCounts.length) {
      setScoutedMap((prev) => {
        const next = { ...prev };
        inlineCounts.forEach((team) => {
          const matchesPlayed = team.tba.wins + team.tba.losses + team.tba.ties;
          next[team.teamKey] = {
            scouted: team.scoutedMatches ?? 0,
            total: matchesPlayed,
          };
        });
        return next;
      });
    }

    const missingTeams = teams.filter(
      (team) => typeof team.scoutedMatches !== 'number',
    );

    if (missingTeams.length === 0) {
      setScoutedStatus({
        loading: false,
        completed: teams.length,
        total: teams.length,
      });
      return;
    }

    if (scoutedStatus.loading) return;

    let cancelled = false;
    const total = teams.length;
    setScoutedStatus({ loading: true, completed: inlineCounts.length, total });

    const queue = [...missingTeams];
    const limit = 5;

    const worker = async () => {
      while (queue.length && !cancelled) {
        const team = queue.shift();
        if (!team) break;
        try {
          const detail = await fetchTeamDetail(
            token,
            team.teamKey,
            selectedEventKey,
          );
          const qualMatches = detail.matches.filter((match) => match.level === 'qm');
          const scouted = qualMatches.filter((match) => match.robot).length;
          const totalMatches = qualMatches.length;
          if (!cancelled) {
            setScoutedMap((prev) => ({
              ...prev,
              [team.teamKey]: { scouted, total: totalMatches },
            }));
          }
        } catch {
          if (!cancelled) {
            const matchesPlayed =
              team.tba.wins + team.tba.losses + team.tba.ties;
            setScoutedMap((prev) => ({
              ...prev,
              [team.teamKey]: { scouted: 0, total: matchesPlayed },
            }));
          }
        } finally {
          if (!cancelled) {
            setScoutedStatus((prev) => ({
              ...prev,
              completed: Math.min(prev.completed + 1, total),
            }));
          }
        }
      }
    };

    Promise.all(Array.from({ length: limit }, () => worker())).finally(() => {
      if (!cancelled) {
        setScoutedStatus((prev) => ({
          ...prev,
          loading: false,
          completed: total,
        }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedEventKey, teams, scoutedStatus.loading, scoutedStatus.completed]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const getSortValue = (team: TeamAnalytics) => {
    const played = team.tba.wins + team.tba.losses + team.tba.ties;
    const scoutedInfo = scoutedMap[team.teamKey];
    const scouted = scoutedInfo?.scouted ?? 0;
    switch (sortKey) {
      case 'team':
        return Number(teamNumberFromKey(team.teamKey));
      case 'name':
        return team.name;
      case 'record':
        return team.tba.wins - team.tba.losses + team.tba.ties * 0.5;
      case 'played':
        return played;
      case 'scouted':
        return scouted;
      case 'rank':
        return team.tba.rank;
      case 'opr':
        return team.tba.opr;
      case 'autoScore':
        return team.robot.autoCycleScore;
      case 'autoRate':
        return team.robot.autoCycleRate;
      case 'teleScore':
        return team.robot.teleCycleScore;
      case 'teleRate':
        return team.robot.teleCycleRate;
      case 'defense':
        return team.robot.totalDefenseScore;
      case 'failures':
        return team.robot.failureCount;
      case 'humanAccuracy':
        return team.humanPlayer.accuracy;
      default:
        return team.tba.rank;
    }
  };

  const sortedTeams = (() => {
    const list = [...teams];
    const compare = (a: TeamAnalytics, b: TeamAnalytics) => {
      const aVal = getSortValue(a);
      const bVal = getSortValue(b);
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal);
      }
      return Number(aVal) - Number(bVal);
    };
    list.sort(compare);
    return sortDir === 'asc' ? list : list.reverse();
  })();

  const scoutedStatusText = scoutedStatus.loading
    ? `Loading scouted matches: ${scoutedStatus.completed}/${scoutedStatus.total}`
    : scoutedStatus.total
      ? `Scouted matches loaded (${scoutedStatus.total} teams)`
      : '';

  return (
    <div className="page">
      <header className="page-header">
        <h1>Event Overview</h1>
        <p>Sortable team analytics for the selected event.</p>
      </header>

      {!selectedEventKey ? (
        <div className="helper-text">Select an event to load teams.</div>
      ) : null}

      {scoutedStatusText ? (
        <div className="helper-text">{scoutedStatusText}</div>
      ) : null}

      {loading ? <div className="loading">Loading teams...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && !error ? (
        <div className="table-card animate-in">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    <button onClick={() => handleSort('team')}>
                      Team {sortKey === 'team' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('name')}>
                      Name {sortKey === 'name' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('record')}>
                      Record {sortKey === 'record' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('played')}>
                      Matches Played {sortKey === 'played' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('scouted')}>
                      Matches Scouted {sortKey === 'scouted' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('rank')}>
                      Rank {sortKey === 'rank' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('opr')}>
                      OPR {sortKey === 'opr' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('autoScore')}>
                      Auto Score {sortKey === 'autoScore' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('autoRate')}>
                      Auto Rate {sortKey === 'autoRate' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('teleScore')}>
                      Tele Score {sortKey === 'teleScore' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('teleRate')}>
                      Tele Rate {sortKey === 'teleRate' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('defense')}>
                      Defense {sortKey === 'defense' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('failures')}>
                      Failures {sortKey === 'failures' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('humanAccuracy')}>
                      Human Accuracy{' '}
                      {sortKey === 'humanAccuracy'
                        ? sortDir === 'asc'
                          ? '^'
                          : 'v'
                        : ''}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map((team) => {
                  const played = team.tba.wins + team.tba.losses + team.tba.ties;
                  const scoutedInfo = scoutedMap[team.teamKey];
                  const scouted = scoutedInfo?.scouted ?? 0;
                  const scoutedTotal = scoutedInfo?.total ?? played;
                  return (
                    <tr key={team.teamKey}>
                      <td>
                        <div className="team-cell">
                          <img
                            className="team-avatar"
                            src={teamAvatarUrl(team.teamKey)}
                            alt=""
                          />
                          <Link href={`/teams/${team.teamKey}`}>
                            <strong>{teamNumberFromKey(team.teamKey)}</strong>
                          </Link>
                        </div>
                      </td>
                      <td>{team.name}</td>
                      <td>
                        {team.tba.wins}-{team.tba.losses}-{team.tba.ties}
                      </td>
                      <td>{played}</td>
                      <td>
                        {scouted}/{scoutedTotal}
                      </td>
                      <td>#{team.tba.rank}</td>
                      <td>{team.tba.opr.toFixed(1)}</td>
                      <td>{team.robot.autoCycleScore.toFixed(1)}</td>
                      <td>{team.robot.autoCycleRate.toFixed(1)}</td>
                      <td>{team.robot.teleCycleScore.toFixed(1)}</td>
                      <td>{team.robot.teleCycleRate.toFixed(1)}</td>
                      <td>{team.robot.totalDefenseScore.toFixed(1)}</td>
                      <td>{team.robot.failureCount.toFixed(0)}</td>
                      <td>{(team.humanPlayer.accuracy * 100).toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
