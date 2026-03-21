'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RetryError from '@/components/RetryError';
import { fetchEventMatches, fetchTeamAnalytics, fetchTeamDetail } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useEventContext } from '@/lib/event-context';
import { formatPercent } from '@/lib/format';
import {
  compareEventMatches,
  formatMatchKeyLabel,
  formatMatchLabel,
  getRobotScoutedTeams,
} from '@/lib/matches';
import { resolveTeamDisplayName, teamAvatarUrl, teamNumberFromKey } from '@/lib/team-utils';
import type {
  EventMatch,
  MatchPhaseData,
  TeamAnalytics,
  TeamDetail,
  TeamMatchAnalytics,
} from '@/lib/types';

type MatchTeamEntry = {
  teamKey: string;
  detail: TeamDetail | null;
  overview: TeamAnalytics | null;
  match: TeamMatchAnalytics | null;
};

function getPhaseScore(phase: MatchPhaseData | null | undefined) {
  if (!phase) {
    return 0;
  }

  return phase.cycles.cycleCount * phase.cycles.cycleScoreAvg;
}

function TeamMatchCard({
  entry,
  selectedEventKey,
  scouted,
}: {
  entry: MatchTeamEntry;
  selectedEventKey: string | null;
  scouted: boolean;
}) {
  const teamNumber = teamNumberFromKey(entry.teamKey);
  const displayName = resolveTeamDisplayName({
    analyticsName: entry.overview?.name,
    detail: entry.detail,
    eventKey: selectedEventKey,
  });
  const robot = entry.match?.robot ?? null;
  const defenseScore = robot
    ? robot.defense.intake.effNum + robot.defense.offense.effNum
    : 0;

  return (
    <article className="surface-card match-detail-team-card">
      <div className="match-detail-team-head">
        <div className="team-identity">
          <img className="team-avatar" src={teamAvatarUrl(entry.teamKey)} alt="" />
          <div className="team-identity-copy">
            <h3>Team {teamNumber}</h3>
            {displayName ? <div className="team-name-line">{displayName}</div> : null}
            <div className="hero-tag-row">
              <span className={`hero-tag ${scouted ? '' : 'match-chip-muted'}`}>
                {scouted ? 'Scouted' : 'No scout'}
              </span>
              {entry.overview ? (
                <span className="hero-tag">Rank #{entry.overview.tba.rank}</span>
              ) : null}
            </div>
          </div>
        </div>

        <Link href={`/teams/${entry.teamKey}`} className="btn btn-ghost">
          Open team
        </Link>
      </div>

      {robot ? (
        <>
          <div className="match-detail-metric-grid">
            <div className="hero-stat">
              <span>Auto</span>
              <strong>{getPhaseScore(robot.auto).toFixed(1)}</strong>
            </div>
            <div className="hero-stat">
              <span>Tele</span>
              <strong>{getPhaseScore(robot.tele).toFixed(1)}</strong>
            </div>
            <div className="hero-stat">
              <span>Defense</span>
              <strong>{defenseScore.toFixed(1)}</strong>
            </div>
            <div className="hero-stat">
              <span>Failures</span>
              <strong>{robot.failures.count.toFixed(0)}</strong>
            </div>
          </div>

          <div className="match-phase-grid">
            <section className="match-phase-card">
              <span className="section-kicker">Auto</span>
              <strong>{robot.auto.cycles.cycleCount.toFixed(0)} cycles</strong>
              <small>
                {robot.auto.cycles.cycleScoreAvg.toFixed(1)} score/cycle,{' '}
                {formatPercent(robot.auto.cycles.accuracyAvg)} accuracy
              </small>
            </section>

            <section className="match-phase-card">
              <span className="section-kicker">Teleop</span>
              <strong>{robot.tele.cycles.cycleCount.toFixed(0)} cycles</strong>
              <small>
                {robot.tele.cycles.cycleScoreAvg.toFixed(1)} score/cycle,{' '}
                {formatPercent(robot.tele.cycles.accuracyAvg)} accuracy
              </small>
            </section>

            <section className="match-phase-card">
              <span className="section-kicker">Tower</span>
              <strong>{robot.tele.tower.level}</strong>
              <small>
                Auto {robot.auto.tower.succeeded ? 'made' : 'missed'} | Tele{' '}
                {robot.tele.tower.succeeded ? 'made' : 'missed'}
              </small>
            </section>

            <section className="match-phase-card">
              <span className="section-kicker">Defense</span>
              <strong>
                {robot.defense.intake.played || robot.defense.offense.played
                  ? 'Observed'
                  : 'Not observed'}
              </strong>
              <small>
                Intake {robot.defense.intake.effNum.toFixed(1)} | Scoring{' '}
                {robot.defense.offense.effNum.toFixed(1)}
              </small>
            </section>
          </div>

          <div className="match-note-panel">
            <span className="section-kicker">Notes</span>
            <p>{robot.notes?.trim() || 'No notes for this match.'}</p>
          </div>
        </>
      ) : (
        <div className="empty-state compact">
          <strong>No scouting data for this team in this match.</strong>
        </div>
      )}
    </article>
  );
}

export default function MatchDetailPage() {
  const params = useParams();
  const matchKey = Array.isArray(params.matchKey)
    ? params.matchKey[0]
    : params.matchKey;
  const {
    selectedEvent,
    selectedEventKey,
    eventVersion,
    loading: eventLoading,
  } = useEventContext();
  const [match, setMatch] = useState<EventMatch | null>(null);
  const [teamEntries, setTeamEntries] = useState<MatchTeamEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (eventLoading) {
      return;
    }

    const token = getToken();
    if (!selectedEventKey || !token || !matchKey) {
      setMatch(null);
      setTeamEntries([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      fetchEventMatches(token, selectedEventKey),
      fetchTeamAnalytics(token, selectedEventKey),
    ])
      .then(async ([eventMatches, teamAnalytics]) => {
        if (cancelled) {
          return;
        }

        const scheduledMatch =
          [...eventMatches].sort(compareEventMatches).find((item) => item.matchKey === matchKey) ??
          null;
        setMatch(scheduledMatch);

        if (!scheduledMatch) {
          setTeamEntries([]);
          return;
        }

        const overviewByKey = Object.fromEntries(
          teamAnalytics.map((team) => [team.teamKey, team]),
        );
        const teamKeys = [
          ...scheduledMatch.alliances.red.teamKeys,
          ...scheduledMatch.alliances.blue.teamKeys,
        ];
        const detailResults = await Promise.allSettled(
          teamKeys.map((teamKey) => fetchTeamDetail(token, teamKey, selectedEventKey)),
        );

        if (cancelled) {
          return;
        }

        const entries = teamKeys.map<MatchTeamEntry>((teamKey, index) => {
          const detailResult = detailResults[index];
          const detail =
            detailResult && detailResult.status === 'fulfilled' ? detailResult.value : null;
          const overview =
            detail?.overviews.find((item) => item.eventKey === selectedEventKey) ??
            detail?.overviews[0] ??
            overviewByKey[teamKey] ??
            null;
          const matchData =
            detail?.matches.find((item) => item.matchKey === scheduledMatch.matchKey) ?? null;

          return {
            teamKey,
            detail,
            overview,
            match: matchData,
          };
        });

        setTeamEntries(entries);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setMatch(null);
          setTeamEntries([]);
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
  }, [eventLoading, eventVersion, matchKey, reloadNonce, selectedEventKey]);

  const pageLoading = eventLoading || loading;
  const scoutedTeams = match ? getRobotScoutedTeams(match) : new Set<string>();
  const redEntries = teamEntries.filter((entry) =>
    match?.alliances.red.teamKeys.includes(entry.teamKey),
  );
  const blueEntries = teamEntries.filter((entry) =>
    match?.alliances.blue.teamKeys.includes(entry.teamKey),
  );

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

      {!pageLoading && !error && selectedEventKey ? (
        <>
          {match ? (
            <>
              <section className="hero-panel animate-in">
                <div className="team-identity-copy">
                  <span className="hero-kicker">Match</span>
                  <h1>{formatMatchLabel(match)}</h1>
                  <div className="team-name-line">
                    {selectedEvent?.name ?? formatMatchKeyLabel(match.matchKey)}
                  </div>
                  <div className="hero-tag-row">
                    <span className="hero-tag">{scoutedTeams.size}/6 scouted</span>
                    <span className="hero-tag">
                      {match.alliances.red.score ?? '--'} - {match.alliances.blue.score ?? '--'}
                    </span>
                  </div>
                </div>

                <div className="hero-summary">
                  <div className="hero-stat">
                    <span>Red Score</span>
                    <strong>{match.alliances.red.score ?? '--'}</strong>
                  </div>
                  <div className="hero-stat">
                    <span>Blue Score</span>
                    <strong>{match.alliances.blue.score ?? '--'}</strong>
                  </div>
                  <div className="hero-stat">
                    <span>Red Scouted</span>
                    <strong>
                      {
                        match.alliances.red.teamKeys.filter((teamKey) => scoutedTeams.has(teamKey))
                          .length
                      }
                    </strong>
                  </div>
                  <div className="hero-stat">
                    <span>Blue Scouted</span>
                    <strong>
                      {
                        match.alliances.blue.teamKeys.filter((teamKey) => scoutedTeams.has(teamKey))
                          .length
                      }
                    </strong>
                  </div>
                </div>
              </section>

              <section className="surface-card animate-in">
                <div className="section-heading">
                  <div>
                    <div className="section-kicker">Red Alliance</div>
                    <h2>Team Match Data</h2>
                  </div>
                </div>
                <div className="match-detail-team-grid">
                  {redEntries.map((entry) => (
                    <TeamMatchCard
                      key={entry.teamKey}
                      entry={entry}
                      selectedEventKey={selectedEventKey}
                      scouted={scoutedTeams.has(entry.teamKey)}
                    />
                  ))}
                </div>
              </section>

              <section className="surface-card animate-in">
                <div className="section-heading">
                  <div>
                    <div className="section-kicker">Blue Alliance</div>
                    <h2>Team Match Data</h2>
                  </div>
                </div>
                <div className="match-detail-team-grid">
                  {blueEntries.map((entry) => (
                    <TeamMatchCard
                      key={entry.teamKey}
                      entry={entry}
                      selectedEventKey={selectedEventKey}
                      scouted={scoutedTeams.has(entry.teamKey)}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="surface-card empty-state">
              <strong>Match not found for the selected event.</strong>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
