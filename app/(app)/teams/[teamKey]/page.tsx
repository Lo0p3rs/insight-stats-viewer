'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TrendChart from '@/components/TrendChart';
import { fetchTeamDetail } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useEventContext } from '@/lib/event-context';
import { teamAvatarUrl, teamNumberFromKey } from '@/lib/team-utils';
import type { TeamDetail, TeamMatchAnalytics } from '@/lib/types';

type Metric = {
  id: string;
  label: string;
  extract: (match: TeamMatchAnalytics) => number | null;
  format: (value: number) => string;
};

const metrics: Metric[] = [
  {
    id: 'autoScore',
    label: 'Auto Cycle Score',
    extract: (match) => match.robot?.auto.cycles.cycleScoreAvg ?? null,
    format: (value) => value.toFixed(1),
  },
  {
    id: 'autoCount',
    label: 'Auto Cycle Count',
    extract: (match) => match.robot?.auto.cycles.cycleCount ?? null,
    format: (value) => value.toFixed(0),
  },
  {
    id: 'autoAccuracy',
    label: 'Auto Accuracy',
    extract: (match) => match.robot?.auto.cycles.accuracyAvg ?? null,
    format: (value) => `${(value * 100).toFixed(0)}%`,
  },
  {
    id: 'teleScore',
    label: 'Tele Cycle Score',
    extract: (match) => match.robot?.tele.cycles.cycleScoreAvg ?? null,
    format: (value) => value.toFixed(1),
  },
  {
    id: 'teleCount',
    label: 'Tele Cycle Count',
    extract: (match) => match.robot?.tele.cycles.cycleCount ?? null,
    format: (value) => value.toFixed(0),
  },
  {
    id: 'teleAccuracy',
    label: 'Tele Accuracy',
    extract: (match) => match.robot?.tele.cycles.accuracyAvg ?? null,
    format: (value) => `${(value * 100).toFixed(0)}%`,
  },
];

export default function TeamDetailPage() {
  const params = useParams();
  const teamKey = Array.isArray(params.teamKey)
    ? params.teamKey[0]
    : params.teamKey;
  const { selectedEventKey } = useEventContext();
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricId, setMetricId] = useState(metrics[0].id);

  useEffect(() => {
    const token = getToken();
    if (!teamKey || !selectedEventKey || !token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTeamDetail(token, teamKey, selectedEventKey)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load team.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamKey, selectedEventKey]);

  const overview = detail
    ? detail.overviews.find((entry) => entry.eventKey === selectedEventKey) ??
      detail.overviews[0] ??
      null
    : null;

  const matches = detail
    ? [...detail.matches]
        .filter((match) => match.level === 'qm')
        .sort((a, b) => a.matchSort - b.matchSort)
    : [];

  const scoutedMatches = matches.filter((match) => match.robot).length;

  const selectedMetric = metrics.find((metric) => metric.id === metricId) ?? metrics[0];
  const chartPoints = matches
    .map((match) => ({
      value: selectedMetric.extract(match),
      label: `QM ${match.matchNumber}`,
    }))
    .filter(
      (point): point is { value: number; label: string } =>
        point.value !== null && !Number.isNaN(point.value),
    );

  const dataPoints = chartPoints.map((point) => point.value);
  const labels = chartPoints.map((point) => point.label);

  const average =
    dataPoints.length > 0
      ? dataPoints.reduce((sum, value) => sum + value, 0) / dataPoints.length
      : 0;

  const trend = (() => {
    if (dataPoints.length < 2) return 0;
    const first = dataPoints[0];
    const last = dataPoints[dataPoints.length - 1];
    const base = Math.max(1, Math.abs(first));
    return ((last - first) / base) * 100;
  })();

  return (
    <div className="page">
      <header className="page-header">
        <h1>Team Detail</h1>
        <p>Event-level stats and scouting trends.</p>
      </header>

      {!selectedEventKey ? (
        <div className="helper-text">Select an event to load team data.</div>
      ) : null}

      {loading ? <div className="loading">Loading team...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && detail && overview ? (
        <>
          <section className="card trend-card animate-in">
            <div className="team-cell">
              <img
                className="team-avatar"
                src={teamAvatarUrl(overview.teamKey)}
                alt=""
              />
              <div>
                <div className="pill">
                  Team {teamNumberFromKey(overview.teamKey)}
                </div>
                <strong>{overview.name}</strong>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat-tile">
                <span>Record</span>
                <strong>
                  {overview.tba.wins}-{overview.tba.losses}-{overview.tba.ties}
                </strong>
              </div>
              <div className="stat-tile">
                <span>Rank</span>
                <strong>#{overview.tba.rank}</strong>
              </div>
              <div className="stat-tile">
                <span>OPR</span>
                <strong>{overview.tba.opr.toFixed(1)}</strong>
              </div>
              <div className="stat-tile">
                <span>Auto Cycle Score</span>
                <strong>{overview.robot.autoCycleScore.toFixed(1)}</strong>
              </div>
              <div className="stat-tile">
                <span>Tele Cycle Score</span>
                <strong>{overview.robot.teleCycleScore.toFixed(1)}</strong>
              </div>
              <div className="stat-tile">
                <span>Defense Score</span>
                <strong>{overview.robot.totalDefenseScore.toFixed(1)}</strong>
              </div>
              <div className="stat-tile">
                <span>Failures</span>
                <strong>{overview.robot.failureCount.toFixed(0)}</strong>
              </div>
              <div className="stat-tile">
                <span>Scouted Matches</span>
                <strong>
                  {scoutedMatches}/{matches.length}
                </strong>
              </div>
            </div>
          </section>

          <section className="card trend-card animate-in">
            <div className="trend-head">
              <div>
                <div className="helper-text">Trend line</div>
                <strong>{selectedMetric.label}</strong>
              </div>
              <select
                value={metricId}
                onChange={(event) => setMetricId(event.target.value)}
              >
                {metrics.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.label}
                  </option>
                ))}
              </select>
            </div>
            <TrendChart values={dataPoints} labels={labels} />
            <div className="trend-metrics">
              <div className="trend-metric">
                Avg: {selectedMetric.format(average)}
              </div>
              <div className="trend-metric">
                Trend: {trend >= 0 ? '+' : ''}
                {trend.toFixed(1)}%
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
