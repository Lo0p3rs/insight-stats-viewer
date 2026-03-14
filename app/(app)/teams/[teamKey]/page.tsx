'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RetryError from '@/components/RetryError';
import TrendChart from '@/components/TrendChart';
import { fetchTeamAnalytics, fetchTeamDetail } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useEventContext } from '@/lib/event-context';
import { formatPercent } from '@/lib/format';
import { teamAvatarUrl, teamDisplayName, teamNumberFromKey } from '@/lib/team-utils';
import type { TeamAnalytics, TeamDetail, TeamMatchAnalytics } from '@/lib/types';

type Metric = {
  id: string;
  label: string;
  extract: (match: TeamMatchAnalytics) => number | null;
  format: (value: number) => string;
};

type RankDefinition = {
  key: string;
  extractor: (team: TeamAnalytics) => number;
  ascending?: boolean;
};

type StatCard = {
  label: string;
  value: string;
  subtitle: string;
  rankKey?: string;
};

type StatSection = {
  label: string;
  items: StatCard[];
};

const metrics: Metric[] = [
  {
    id: 'autoScore',
    label: 'Auto Score',
    extract: (match) => match.robot?.auto.cycles.cycleScoreAvg ?? null,
    format: (value) => value.toFixed(1),
  },
  {
    id: 'autoCount',
    label: 'Auto Count',
    extract: (match) => match.robot?.auto.cycles.cycleCount ?? null,
    format: (value) => value.toFixed(0),
  },
  {
    id: 'autoRate',
    label: 'Auto Rate',
    extract: (match) => match.robot?.auto.cycles.rateAvg ?? null,
    format: (value) => value.toFixed(1),
  },
  {
    id: 'autoAccuracy',
    label: 'Auto Accuracy',
    extract: (match) => match.robot?.auto.cycles.accuracyAvg ?? null,
    format: (value) => formatPercent(value),
  },
  {
    id: 'teleScore',
    label: 'Tele Score',
    extract: (match) => match.robot?.tele.cycles.cycleScoreAvg ?? null,
    format: (value) => value.toFixed(1),
  },
  {
    id: 'teleCount',
    label: 'Tele Count',
    extract: (match) => match.robot?.tele.cycles.cycleCount ?? null,
    format: (value) => value.toFixed(0),
  },
  {
    id: 'teleRate',
    label: 'Tele Rate',
    extract: (match) => match.robot?.tele.cycles.rateAvg ?? null,
    format: (value) => value.toFixed(1),
  },
  {
    id: 'teleAccuracy',
    label: 'Tele Accuracy',
    extract: (match) => match.robot?.tele.cycles.accuracyAvg ?? null,
    format: (value) => formatPercent(value),
  },
  {
    id: 'defenseScore',
    label: 'Defense Score',
    extract: (match) =>
      match.robot
        ? match.robot.defense.intake.effNum + match.robot.defense.offense.effNum
        : null,
    format: (value) => value.toFixed(1),
  },
  {
    id: 'failures',
    label: 'Failure Count',
    extract: (match) => match.robot?.failures.count ?? null,
    format: (value) => value.toFixed(0),
  },
  {
    id: 'failureRecovery',
    label: 'Failure Recovery',
    extract: (match) => match.robot?.failures.recoveredRate ?? null,
    format: (value) => formatPercent(value),
  },
];

const rankDefinitions: RankDefinition[] = [
  { key: 'autoCycleScore', extractor: (team) => team.robot.autoCycleScore },
  { key: 'autoCycleRate', extractor: (team) => team.robot.autoCycleRate },
  { key: 'autoCycleCountAvg', extractor: (team) => team.robot.autoCycleCountAvg },
  { key: 'autoCycleAccuracy', extractor: (team) => team.robot.autoCycleAccuracy },
  {
    key: 'autoTowerReliability',
    extractor: (team) => team.robot.autoTowerReliability,
  },
  { key: 'teleCycleScore', extractor: (team) => team.robot.teleCycleScore },
  { key: 'teleCycleRate', extractor: (team) => team.robot.teleCycleRate },
  { key: 'teleCycleCountAvg', extractor: (team) => team.robot.teleCycleCountAvg },
  { key: 'teleCycleAccuracy', extractor: (team) => team.robot.teleCycleAccuracy },
  {
    key: 'teleTowerReliability',
    extractor: (team) => team.robot.teleTowerReliability,
  },
  {
    key: 'intakeDefenseScore',
    extractor: (team) => team.robot.intakeDefenseScore,
  },
  {
    key: 'scoringDefenseScore',
    extractor: (team) => team.robot.scoringDefenseScore,
  },
  { key: 'totalDefenseScore', extractor: (team) => team.robot.totalDefenseScore },
  {
    key: 'failureCount',
    extractor: (team) => team.robot.failureCount,
    ascending: true,
  },
  {
    key: 'failureRecovery',
    extractor: (team) => team.robot.failureRecovery,
  },
  {
    key: 'fuelCountAvg',
    extractor: (team) => team.humanPlayer.fuelCountAvg,
  },
];

function computeRanks(teams: TeamAnalytics[], teamKey: string) {
  const ranks: Record<string, number> = {};

  rankDefinitions.forEach((definition) => {
    const sorted = [...teams].sort((left, right) => {
      const leftValue = definition.extractor(left);
      const rightValue = definition.extractor(right);
      return definition.ascending
        ? leftValue - rightValue
        : rightValue - leftValue;
    });

    const index = sorted.findIndex((team) => team.teamKey === teamKey);
    if (index !== -1) {
      ranks[definition.key] = index + 1;
    }
  });

  return ranks;
}

function getRankTone(rank: number, total: number) {
  if (total <= 0) return 'neutral';
  const percentile = 1 - (rank - 1) / total;
  if (percentile >= 0.8) return 'top';
  if (percentile >= 0.5) return 'mid';
  return 'low';
}

export default function TeamDetailPage() {
  const params = useParams();
  const teamKey = Array.isArray(params.teamKey)
    ? params.teamKey[0]
    : params.teamKey;
  const {
    selectedEventKey,
    eventVersion,
    loading: eventLoading,
  } = useEventContext();
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [metricId, setMetricId] = useState(metrics[0].id);
  const [teamRanks, setTeamRanks] = useState<Record<string, number>>({});
  const [teamCount, setTeamCount] = useState(0);
  const [teamSummary, setTeamSummary] = useState<TeamAnalytics | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);

  useEffect(() => {
    if (eventLoading) {
      return;
    }

    const token = getToken();
    if (!teamKey || !selectedEventKey || !token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTeamDetail(token, teamKey, selectedEventKey)
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
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
  }, [eventLoading, eventVersion, reloadNonce, selectedEventKey, teamKey]);

  useEffect(() => {
    if (eventLoading) {
      return;
    }

    const token = getToken();
    if (!teamKey || !selectedEventKey || !token) {
      setTeamRanks({});
      setTeamCount(0);
      setTeamSummary(null);
      return;
    }

    let cancelled = false;

    fetchTeamAnalytics(token, selectedEventKey)
      .then((data) => {
        if (!cancelled) {
          setTeamCount(data.length);
          setTeamRanks(computeRanks(data, teamKey));
          setTeamSummary(data.find((team) => team.teamKey === teamKey) ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTeamCount(0);
          setTeamRanks({});
          setTeamSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventLoading, reloadNonce, selectedEventKey, teamKey]);

  const overview = detail
    ? detail.overviews.find((entry) => entry.eventKey === selectedEventKey) ??
      detail.overviews[0] ??
      null
    : null;

  const matches = detail
    ? [...detail.matches]
        .filter((match) => match.level === 'qm')
        .sort((left, right) => left.matchSort - right.matchSort)
    : [];

  const scoutedMatches = matches.filter((match) => match.robot).length;

  const selectedMetric =
    metrics.find((metric) => metric.id === metricId) ?? metrics[0];

  const chartPoints = matches
    .map((match) => ({
      label: `QM ${match.matchNumber}`,
      value: selectedMetric.extract(match),
    }))
    .filter(
      (point): point is { label: string; value: number } =>
        point.value !== null && !Number.isNaN(point.value),
    );

  const values = chartPoints.map((point) => point.value);
  const labels = chartPoints.map((point) => point.label);

  const average =
    values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  const best =
    values.length > 0 ? Math.max(...values) : 0;
  const trend = (() => {
    if (values.length < 2) {
      return 0;
    }

    const midpoint = Math.max(1, Math.floor(values.length / 2));
    const firstHalf = values.slice(0, midpoint);
    const secondHalf = values.slice(midpoint);
    const firstAverage =
      firstHalf.reduce((sum, value) => sum + value, 0) / firstHalf.length;
    const secondAverage =
      secondHalf.reduce((sum, value) => sum + value, 0) /
      Math.max(1, secondHalf.length);

    return ((secondAverage - firstAverage) / Math.max(1, Math.abs(firstAverage))) * 100;
  })();
  const displayedMatches = [...matches].reverse();
  const pageLoading = eventLoading || loading;
  const displayName = teamDisplayName(teamSummary?.name || overview?.name || '');

  const statSections: StatSection[] = overview
    ? [
        {
          label: 'Auto',
          items: [
            {
              label: 'Cycle Score',
              value: overview.robot.autoCycleScore.toFixed(1),
              subtitle: 'cycle score',
              rankKey: 'autoCycleScore',
            },
            {
              label: 'Cycle Rate',
              value: overview.robot.autoCycleRate.toFixed(1),
              subtitle: 'average cycle rate',
              rankKey: 'autoCycleRate',
            },
            {
              label: 'Cycle Count',
              value: overview.robot.autoCycleCountAvg.toFixed(1),
              subtitle: 'average cycles',
              rankKey: 'autoCycleCountAvg',
            },
            {
              label: 'Accuracy',
              value: formatPercent(overview.robot.autoCycleAccuracy),
              subtitle: 'cycle accuracy',
              rankKey: 'autoCycleAccuracy',
            },
            {
              label: 'Tower',
              value: formatPercent(overview.robot.autoTowerReliability),
              subtitle: 'tower reliability',
              rankKey: 'autoTowerReliability',
            },
          ],
        },
        {
          label: 'Teleop',
          items: [
            {
              label: 'Cycle Score',
              value: overview.robot.teleCycleScore.toFixed(1),
              subtitle: 'cycle score',
              rankKey: 'teleCycleScore',
            },
            {
              label: 'Cycle Rate',
              value: overview.robot.teleCycleRate.toFixed(1),
              subtitle: 'average cycle rate',
              rankKey: 'teleCycleRate',
            },
            {
              label: 'Cycle Count',
              value: overview.robot.teleCycleCountAvg.toFixed(1),
              subtitle: 'average cycles',
              rankKey: 'teleCycleCountAvg',
            },
            {
              label: 'Accuracy',
              value: formatPercent(overview.robot.teleCycleAccuracy),
              subtitle: 'cycle accuracy',
              rankKey: 'teleCycleAccuracy',
            },
            {
              label: 'Tower',
              value: overview.robot.teleTowerLevel,
              subtitle: `${formatPercent(overview.robot.teleTowerReliability)} reliability`,
              rankKey: 'teleTowerReliability',
            },
          ],
        },
        {
          label: 'Defense',
          items: [
            {
              label: 'Intake Defense',
              value: overview.robot.intakeDefenseScore.toFixed(1),
              subtitle: `${overview.robot.intakeDefenseCount.toFixed(0)} actions`,
              rankKey: 'intakeDefenseScore',
            },
            {
              label: 'Scoring Defense',
              value: overview.robot.scoringDefenseScore.toFixed(1),
              subtitle: `${overview.robot.scoringDefenseCount.toFixed(0)} actions`,
              rankKey: 'scoringDefenseScore',
            },
            {
              label: 'Total Defense',
              value: overview.robot.totalDefenseScore.toFixed(1),
              subtitle: 'overall pressure',
              rankKey: 'totalDefenseScore',
            },
          ],
        },
        {
          label: 'Reliability',
          items: [
            {
              label: 'Failure Count',
              value: overview.robot.failureCount.toFixed(0),
              subtitle: 'lower is better',
              rankKey: 'failureCount',
            },
            {
              label: 'Failure Recovery',
              value: formatPercent(overview.robot.failureRecovery),
              subtitle: 'recovery rate',
              rankKey: 'failureRecovery',
            },
            {
              label: 'Fuel Count',
              value: overview.humanPlayer.fuelCountAvg.toFixed(1),
              subtitle: 'fuel count average',
              rankKey: 'fuelCountAvg',
            },
          ],
        },
      ]
    : [];

  useEffect(() => {
    if (statSections.length === 0) {
      setSectionIndex(0);
      return;
    }

    setSectionIndex((current) => Math.min(current, statSections.length - 1));
  }, [statSections.length]);

  const activeSection = statSections[sectionIndex] ?? null;
  const cycleSection = (direction: number) => {
    if (statSections.length === 0) {
      return;
    }

    setSectionIndex((current) => {
      const next = current + direction;
      if (next < 0) {
        return statSections.length - 1;
      }
      if (next >= statSections.length) {
        return 0;
      }
      return next;
    });
  };

  return (
    <div className="page">
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

      {!pageLoading && detail && overview ? (
        <>
          <section className="hero-panel team-hero animate-in">
            <div className="team-identity">
              <img
                className="team-avatar team-avatar-xl"
                src={teamAvatarUrl(overview.teamKey)}
                alt=""
              />
              <div className="team-identity-copy">
                <span className="hero-kicker">Team</span>
                <h1>Team {teamNumberFromKey(overview.teamKey)}</h1>
                {displayName ? (
                  <div className="team-name-line">{displayName}</div>
                ) : null}
                <div className="team-identity-actions">
                  <Link href="/overview" className="btn btn-ghost team-back-link">
                    Back
                  </Link>
                </div>
                <div className="hero-tag-row">
                  <span className="hero-tag">Rank #{overview.tba.rank}</span>
                  <span className="hero-tag">{matches.length} played</span>
                  <span className="hero-tag">
                    {scoutedMatches}/{matches.length} scouted
                  </span>
                </div>
              </div>
            </div>

            <div className="hero-summary">
              <div className="hero-stat">
                <span>Record</span>
                <strong>
                  {overview.tba.wins}-{overview.tba.losses}-{overview.tba.ties}
                </strong>
              </div>
              <div className="hero-stat">
                <span>Auto score</span>
                <strong>{overview.robot.autoCycleScore.toFixed(1)}</strong>
              </div>
              <div className="hero-stat">
                <span>Tele score</span>
                <strong>{overview.robot.teleCycleScore.toFixed(1)}</strong>
              </div>
              <div className="hero-stat">
                <span>Total defense</span>
                <strong>{overview.robot.totalDefenseScore.toFixed(1)}</strong>
              </div>
              <div className="hero-stat hero-stat-accent">
                <span>Recovery</span>
                <strong>{formatPercent(overview.robot.failureRecovery)}</strong>
              </div>
            </div>
          </section>

          <section className="detail-grid animate-in">
            <div className="surface-card trend-surface">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Trend</div>
                  <h2>{selectedMetric.label}</h2>
                </div>
              </div>

              <div className="metric-switcher">
                {metrics.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    className={`metric-switch ${
                      metric.id === selectedMetric.id ? 'active' : ''
                    }`}
                    onClick={() => setMetricId(metric.id)}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>

              <TrendChart
                values={values}
                labels={labels}
                formatValue={selectedMetric.format}
              />

              <div className="trend-summary-grid">
                <div className="trend-summary-card">
                  <span>Average</span>
                  <strong>{selectedMetric.format(average)}</strong>
                </div>
                <div className="trend-summary-card">
                  <span>Trend</span>
                  <strong>
                    {trend >= 0 ? '+' : ''}
                    {trend.toFixed(1)}%
                  </strong>
                </div>
                <div className="trend-summary-card">
                  <span>Best</span>
                  <strong>{selectedMetric.format(best)}</strong>
                </div>
                <div className="trend-summary-card">
                  <span>Data points</span>
                  <strong>{values.length}</strong>
                </div>
              </div>
            </div>

            <div className="surface-card profile-surface">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Stats</div>
                  <h2>Team Stats</h2>
                </div>
                {teamCount > 0 ? (
                  <span className="section-note">{teamCount} teams</span>
                ) : null}
              </div>

              {activeSection ? (
                <div className="profile-carousel">
                  <div className="profile-carousel-header">
                    <button
                      type="button"
                      className="profile-carousel-arrow"
                      onClick={() => cycleSection(-1)}
                      aria-label="Show previous stat group"
                    >
                      ←
                    </button>
                    <div className="profile-section-heading">
                      <div className="profile-section-label">
                        {activeSection.label}
                      </div>
                      <span className="section-note">
                        {sectionIndex + 1} of {statSections.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="profile-carousel-arrow"
                      onClick={() => cycleSection(1)}
                      aria-label="Show next stat group"
                    >
                      →
                    </button>
                  </div>

                  <section className="profile-section">
                    <div className="profile-grid">
                      {activeSection.items.map((item) => {
                        const rank = item.rankKey ? teamRanks[item.rankKey] : undefined;
                        const rankTone =
                          rank && teamCount > 0
                            ? getRankTone(rank, teamCount)
                            : 'neutral';

                        return (
                          <article
                            key={`${activeSection.label}-${item.label}`}
                            className="profile-item"
                          >
                            <div className="profile-item-top">
                              <span>{item.label}</span>
                              {rank ? (
                                <span className={`stat-rank stat-rank-${rankTone}`}>
                                  #{rank}
                                </span>
                              ) : null}
                            </div>
                            <strong>{item.value}</strong>
                            <small>{item.subtitle}</small>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </section>

          <section className="surface-card animate-in">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Matches</div>
                  <h2>All Matches</h2>
                </div>
                {displayedMatches.length > 0 ? (
                  <span className="section-note">{displayedMatches.length} shown</span>
                ) : null}
              </div>

            <div className="match-grid">
              {displayedMatches.map((match) => (
                <article key={match.matchKey} className="match-card">
                  <div className="match-card-head">
                    <span className="match-chip">QM {match.matchNumber}</span>
                    <span className="match-chip match-chip-muted">
                      {match.robot ? 'Scouted' : 'No scout'}
                    </span>
                  </div>

                  {match.robot ? (
                    <>
                      <div className="match-metric-grid">
                        <div>
                          <span>Auto</span>
                          <strong>{match.robot.auto.cycles.cycleScoreAvg.toFixed(1)}</strong>
                        </div>
                        <div>
                          <span>Tele</span>
                          <strong>{match.robot.tele.cycles.cycleScoreAvg.toFixed(1)}</strong>
                        </div>
                        <div>
                          <span>Defense</span>
                          <strong>
                            {(
                              match.robot.defense.intake.effNum +
                              match.robot.defense.offense.effNum
                            ).toFixed(1)}
                          </strong>
                        </div>
                        <div>
                          <span>Failures</span>
                          <strong>{match.robot.failures.count.toFixed(0)}</strong>
                        </div>
                      </div>
                      <p className="match-note">
                        {match.robot.notes?.trim() || 'No notes.'}
                      </p>
                    </>
                  ) : (
                    <p className="match-note">
                      No scout data.
                    </p>
                  )}
                </article>
              ))}

              {displayedMatches.length === 0 ? (
                <div className="empty-state compact">
                  <strong>No matches yet.</strong>
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
