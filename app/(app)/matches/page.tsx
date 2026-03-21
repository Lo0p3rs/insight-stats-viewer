'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RetryError from '@/components/RetryError';
import { fetchEventMatches } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useEventContext } from '@/lib/event-context';
import {
  compareEventMatches,
  filterEventMatches,
  formatMatchLabel,
  getRobotScoutedCount,
  getRobotScoutedTeams,
  isMatchCompleted,
  type MatchLevelFilter,
} from '@/lib/matches';
import { teamNumberFromKey } from '@/lib/team-utils';
import type { EventMatch } from '@/lib/types';

const matchFilters: Array<{ key: MatchLevelFilter; label: string }> = [
  { key: 'qm', label: 'QM' },
  { key: 'sf', label: 'SF' },
  { key: 'f', label: 'F' },
  { key: 'all', label: 'All' },
];

export default function MatchesPage() {
  const {
    selectedEvent,
    selectedEventKey,
    eventVersion,
    loading: eventLoading,
  } = useEventContext();
  const [matches, setMatches] = useState<EventMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [filter, setFilter] = useState<MatchLevelFilter>('qm');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (eventLoading) {
      return;
    }

    const token = getToken();
    if (!selectedEventKey || !token) {
      setMatches([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchEventMatches(token, selectedEventKey)
      .then((data) => {
        if (!cancelled) {
          setMatches([...data].sort(compareEventMatches));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setMatches([]);
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
  const filteredMatches = filterEventMatches(matches, filter, query);
  const completedMatches = matches.filter((match) => isMatchCompleted(match)).length;
  const fullyScoutedMatches = matches.filter(
    (match) => getRobotScoutedCount(match) >= 6,
  ).length;
  const missedTeamSlots = matches
    .filter((match) => isMatchCompleted(match))
    .reduce((sum, match) => sum + Math.max(0, 6 - getRobotScoutedCount(match)), 0);

  return (
    <div className="page page-wide">
      <section className="surface-card overview-hero animate-in">
        <div className="overview-hero-copy">
          <span className="hero-kicker">Matches</span>
          <h1>{selectedEvent?.name ?? 'Select an event to inspect the schedule'}</h1>
        </div>

        <div className="overview-hero-stats">
          <div className="overview-hero-stat">
            <span>Shown</span>
            <strong>{filteredMatches.length}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Completed</span>
            <strong>{completedMatches}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Fully Scouted</span>
            <strong>{fullyScoutedMatches}</strong>
          </div>
          <div className="overview-hero-stat overview-hero-stat-accent">
            <span>Missed Team Slots</span>
            <strong>{missedTeamSlots}</strong>
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
          <section className="surface-card animate-in">
            <div className="dev-toolbar">
              <label>
                <span className="field-label">Search matches or team numbers</span>
                <input
                  type="search"
                  placeholder="e.g. 254 or Qual 12"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              <div className="subpage-tabs" aria-label="Match filters">
                {matchFilters.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`subpage-tab ${filter === option.key ? 'active' : ''}`}
                    onClick={() => setFilter(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="match-list-grid animate-in">
            {filteredMatches.map((match) => {
              const scoutedTeams = getRobotScoutedTeams(match);
              const scoutedCount = scoutedTeams.size;
              const tone =
                scoutedCount >= 6 ? 'full' : scoutedCount > 0 ? 'partial' : 'none';

              return (
                <Link
                  key={match.matchKey}
                  href={`/matches/${encodeURIComponent(match.matchKey)}`}
                  className={`match-schedule-card match-schedule-card-${tone}`}
                >
                  <div className="match-schedule-head">
                    <div>
                      <span className="match-chip">{formatMatchLabel(match)}</span>
                    </div>
                    <div className={`match-scout-pill match-scout-pill-${tone}`}>
                      {scoutedCount}/6 scouted
                    </div>
                  </div>

                  <div className="match-schedule-body">
                    <section className="match-schedule-alliance match-schedule-alliance-red">
                      <div className="match-schedule-alliance-head">
                        <span>Red</span>
                        <strong>{match.alliances.red.score ?? '--'}</strong>
                      </div>

                      <div className="match-schedule-team-list">
                        {match.alliances.red.teamKeys.map((teamKey) => (
                          <div
                            key={`${match.matchKey}-${teamKey}`}
                            className={`match-schedule-team ${
                              scoutedTeams.has(teamKey) ? 'scouted' : ''
                            }`}
                          >
                            <span className="match-schedule-team-indicator" aria-hidden="true" />
                            <strong>{teamNumberFromKey(teamKey)}</strong>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="match-schedule-alliance match-schedule-alliance-blue">
                      <div className="match-schedule-alliance-head">
                        <span>Blue</span>
                        <strong>{match.alliances.blue.score ?? '--'}</strong>
                      </div>

                      <div className="match-schedule-team-list">
                        {match.alliances.blue.teamKeys.map((teamKey) => (
                          <div
                            key={`${match.matchKey}-${teamKey}`}
                            className={`match-schedule-team ${
                              scoutedTeams.has(teamKey) ? 'scouted' : ''
                            }`}
                          >
                            <span className="match-schedule-team-indicator" aria-hidden="true" />
                            <strong>{teamNumberFromKey(teamKey)}</strong>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </Link>
              );
            })}

            {filteredMatches.length === 0 ? (
              <div className="surface-card empty-state">
                <strong>No matches match this filter.</strong>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
