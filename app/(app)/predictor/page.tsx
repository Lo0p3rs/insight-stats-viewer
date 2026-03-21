'use client';

import { useEffect, useState } from 'react';
import RetryError from '@/components/RetryError';
import Tabs from '@/components/Tabs';
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
  type MatchCounts,
} from '@/lib/event-stats';
import { formatPercent } from '@/lib/format';
import {
  compareEventMatches,
  formatMatchLabel,
  getRobotScoutedTeams,
} from '@/lib/matches';
import { buildMatchPrediction } from '@/lib/strategist';
import {
  teamAvatarUrl,
  teamDisplayName,
  teamNumberFromKey,
} from '@/lib/team-utils';
import type { EventMatch, TbaTeamSimple, TeamAnalytics } from '@/lib/types';

type PredictorMode = 'match' | 'manual';
type AllianceSide = 'red' | 'blue';
type ManualSelectionState = Record<AllianceSide, string[]>;

const predictorModes = [
  { key: 'match', label: 'Use Match' },
  { key: 'manual', label: 'Manual' },
];

const allianceOptions: Array<{
  key: AllianceSide;
  label: string;
  shortLabel: string;
}> = [
  { key: 'red', label: 'Red Alliance', shortLabel: 'Red' },
  { key: 'blue', label: 'Blue Alliance', shortLabel: 'Blue' },
];

function createEmptyManualSelection(): ManualSelectionState {
  return {
    red: ['', '', ''],
    blue: ['', '', ''],
  };
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

function manualSelectionsEqual(
  left: ManualSelectionState,
  right: ManualSelectionState,
) {
  return (
    left.red.every((value, index) => value === right.red[index]) &&
    left.blue.every((value, index) => value === right.blue[index])
  );
}

function normalizeManualSelection(
  teams: TeamAnalytics[],
  current: ManualSelectionState,
) {
  const available = new Set(teams.map((team) => team.teamKey));
  const seen = new Set<string>();
  const sanitize = (values: string[]) =>
    values.map((teamKey) => {
      if (!teamKey || !available.has(teamKey) || seen.has(teamKey)) {
        return '';
      }

      seen.add(teamKey);
      return teamKey;
    });

  return {
    red: sanitize(current.red),
    blue: sanitize(current.blue),
  } satisfies ManualSelectionState;
}

function deriveSelectedMatchKey(matches: EventMatch[], current: string) {
  if (current && matches.some((match) => match.matchKey === current)) {
    return current;
  }

  return matches.find((match) => match.level === 'qm')?.matchKey ?? matches[0]?.matchKey ?? '';
}

function buildMatchOptionLabel(match: EventMatch) {
  const red = match.alliances.red.teamKeys.map(teamNumberFromKey).join(', ');
  const blue = match.alliances.blue.teamKeys.map(teamNumberFromKey).join(', ');
  const scoutedCount = getRobotScoutedTeams(match).size;

  return `${formatMatchLabel(match)} | ${red} vs ${blue} | ${scoutedCount}/6 scouted`;
}

function getAllianceCoverage(
  teams: TeamAnalytics[],
  countsMap: Record<string, MatchCounts>,
) {
  if (teams.length === 0) {
    return 0;
  }

  return (
    teams.reduce((sum, team) => sum + getCoverageValue(team, countsMap), 0) /
    teams.length
  );
}

function getWinnerLabel(winner: 'red' | 'blue') {
  return winner === 'red' ? 'Red alliance' : 'Blue alliance';
}

function getConfidenceTone(confidence: 'high' | 'medium' | 'low') {
  switch (confidence) {
    case 'high':
      return 'high';
    case 'medium':
      return 'mid';
    case 'low':
    default:
      return 'low';
  }
}

function getEdgeTone(winner: 'red' | 'blue' | 'even') {
  return winner;
}

export default function PredictorPage() {
  const {
    selectedEvent,
    selectedEventKey,
    eventVersion,
    loading: eventLoading,
  } = useEventContext();
  const [mode, setMode] = useState<PredictorMode>('match');
  const [teams, setTeams] = useState<TeamAnalytics[]>([]);
  const [matches, setMatches] = useState<EventMatch[]>([]);
  const [tbaTeams, setTbaTeams] = useState<TbaTeamSimple[]>([]);
  const [countsMap, setCountsMap] = useState<Record<string, MatchCounts>>({});
  const [selectedMatchKey, setSelectedMatchKey] = useState('');
  const [manualSelection, setManualSelection] = useState<ManualSelectionState>(
    createEmptyManualSelection(),
  );
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
      setMatches([]);
      setTbaTeams([]);
      setCountsMap({});
      setSelectedMatchKey('');
      setManualSelection(createEmptyManualSelection());
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
          const sortedMatches = [...matchData].sort(compareEventMatches);
          setTeams(teamData);
          setMatches(sortedMatches);
          setTbaTeams(tbaTeamData);
          setCountsMap(buildMatchCounts(sortedMatches));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setTeams([]);
          setMatches([]);
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

  const sortedTeams = sortTeamsByRank(teams);

  useEffect(() => {
    const nextSelection = normalizeManualSelection(sortedTeams, manualSelection);
    if (!manualSelectionsEqual(manualSelection, nextSelection)) {
      setManualSelection(nextSelection);
    }
  }, [manualSelection, sortedTeams]);

  useEffect(() => {
    const nextMatchKey = deriveSelectedMatchKey(matches, selectedMatchKey);
    if (nextMatchKey !== selectedMatchKey) {
      setSelectedMatchKey(nextMatchKey);
    }
  }, [matches, selectedMatchKey]);

  const pageLoading = eventLoading || loading;
  const tbaNameByKey = Object.fromEntries(
    tbaTeams.map((team) => [
      team.key,
      teamDisplayName(team.nickname) || teamDisplayName(team.name),
    ]),
  );
  const teamByKey: Record<string, TeamAnalytics> = Object.fromEntries(
    teams.map((team) => [team.teamKey, team]),
  );
  const matchByKey: Record<string, EventMatch> = Object.fromEntries(
    matches.map((match) => [match.matchKey, match]),
  );
  const selectedMatch = matchByKey[selectedMatchKey] ?? null;
  const selectedScoutedTeams = selectedMatch ? getRobotScoutedTeams(selectedMatch) : null;
  const activeTeamKeys: ManualSelectionState =
    mode === 'match' && selectedMatch
      ? {
          red: [...selectedMatch.alliances.red.teamKeys].slice(0, 3),
          blue: [...selectedMatch.alliances.blue.teamKeys].slice(0, 3),
        }
      : manualSelection;
  const selectedAlliances = {
    red: activeTeamKeys.red
      .map((teamKey) => teamByKey[teamKey])
      .filter((team): team is TeamAnalytics => Boolean(team)),
    blue: activeTeamKeys.blue
      .map((teamKey) => teamByKey[teamKey])
      .filter((team): team is TeamAnalytics => Boolean(team)),
  };
  const selectedTeamCount =
    activeTeamKeys.red.filter(Boolean).length + activeTeamKeys.blue.filter(Boolean).length;
  const missingAnalyticsKeys = [...activeTeamKeys.red, ...activeTeamKeys.blue].filter(
    (teamKey) => teamKey && !teamByKey[teamKey],
  );
  const prediction =
    selectedAlliances.red.length === 3 && selectedAlliances.blue.length === 3
      ? buildMatchPrediction(teams, selectedAlliances.red, selectedAlliances.blue)
      : null;
  const combinedCoverage = getAllianceCoverage(
    [...selectedAlliances.red, ...selectedAlliances.blue],
    countsMap,
  );

  const getSelectableTeams = (side: AllianceSide, slotIndex: number) => {
    const currentKey = manualSelection[side][slotIndex];
    const blockedKeys = new Set(
      [...manualSelection.red, ...manualSelection.blue].filter(Boolean),
    );
    if (currentKey) {
      blockedKeys.delete(currentKey);
    }

    return sortedTeams.filter((team) => !blockedKeys.has(team.teamKey));
  };

  const handleManualTeamChange = (
    side: AllianceSide,
    slotIndex: number,
    nextTeamKey: string,
  ) => {
    setManualSelection((current) => {
      const next: ManualSelectionState = {
        red: [...current.red],
        blue: [...current.blue],
      };
      next[side][slotIndex] = nextTeamKey;
      return normalizeManualSelection(sortedTeams, next);
    });
  };

  return (
    <div className="page page-wide">
      <section className="surface-card overview-hero animate-in">
        <div className="overview-hero-copy">
          <span className="hero-kicker">Predictor</span>
          <h1>{selectedEvent?.name ?? 'Select an event to predict a matchup'}</h1>
        </div>

        <div className="overview-hero-stats">
          <div className="overview-hero-stat">
            <span>Teams</span>
            <strong>{sortedTeams.length}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Matches</span>
            <strong>{matches.length}</strong>
          </div>
          <div className="overview-hero-stat">
            <span>Source</span>
            <strong>
              {mode === 'match'
                ? selectedMatch
                  ? formatMatchLabel(selectedMatch)
                  : 'Use match'
                : 'Manual'}
            </strong>
          </div>
          <div className="overview-hero-stat overview-hero-stat-accent">
            <span>Selected</span>
            <strong>{selectedTeamCount}/6</strong>
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
            <div className="section-heading">
              <div>
                <div className="section-kicker">Selection</div>
                <h2>Build the matchup</h2>
              </div>
              <Tabs
                options={predictorModes}
                value={mode}
                onChange={(value) => setMode(value as PredictorMode)}
              />
            </div>

            {mode === 'match' ? (
              matches.length === 0 ? (
                <div className="empty-state compact">
                  <strong>No schedule is loaded for this event yet.</strong>
                  <span>Switch to manual mode to predict a custom matchup.</span>
                </div>
              ) : (
                <>
                  <div className="predictor-toolbar">
                    <label className="predictor-match-control">
                      <span className="field-label">Scheduled match</span>
                      <select
                        value={selectedMatchKey}
                        onChange={(event) => setSelectedMatchKey(event.target.value)}
                      >
                        {matches.map((match) => (
                          <option key={match.matchKey} value={match.matchKey}>
                            {buildMatchOptionLabel(match)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedMatch && selectedScoutedTeams ? (
                      <div className="predictor-match-meta">
                        <div>
                          <span>Scouted</span>
                          <strong>{selectedScoutedTeams.size}/6</strong>
                        </div>
                        <div>
                          <span>Coverage</span>
                          <strong>
                            {selectedTeamCount > 0 ? formatPercent(combinedCoverage) : '--'}
                          </strong>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {selectedMatch && selectedScoutedTeams ? (
                    <div className="predictor-selection-grid">
                      {allianceOptions.map((alliance) => {
                        const teamKeys = selectedMatch.alliances[alliance.key].teamKeys;
                        const allianceScoutedCount = teamKeys.filter((teamKey) =>
                          selectedScoutedTeams.has(teamKey),
                        ).length;

                        return (
                          <section
                            key={alliance.key}
                            className={`predictor-alliance-select predictor-alliance-select-${alliance.key}`}
                          >
                            <div className="predictor-alliance-select-head">
                              <div>
                                <div className="section-kicker">{alliance.label}</div>
                                <h2>Loaded from schedule</h2>
                              </div>
                              <span
                                className={`match-scout-pill match-scout-pill-${
                                  allianceScoutedCount >= 3
                                    ? 'full'
                                    : allianceScoutedCount > 0
                                      ? 'partial'
                                      : 'none'
                                }`}
                              >
                                {allianceScoutedCount}/3 scouted
                              </span>
                            </div>

                            <div className="predictor-team-list">
                              {teamKeys.map((teamKey) => {
                                const team = teamByKey[teamKey];
                                const displayName = team
                                  ? resolveTeamName(team, tbaNameByKey)
                                  : tbaNameByKey[teamKey] || teamNumberFromKey(teamKey);

                                return (
                                  <div
                                    key={`${alliance.key}-${teamKey}`}
                                    className={`predictor-team-row ${
                                      selectedScoutedTeams.has(teamKey) ? 'scouted' : ''
                                    }`}
                                  >
                                    <div className="team-identity">
                                      <img
                                        className="team-avatar"
                                        src={teamAvatarUrl(teamKey)}
                                        alt=""
                                      />
                                      <div className="predictor-team-copy">
                                        <strong>Team {teamNumberFromKey(teamKey)}</strong>
                                        <span>{displayName}</span>
                                      </div>
                                    </div>

                                    <div className="predictor-team-meta">
                                      <span>
                                        {selectedScoutedTeams.has(teamKey) ? 'Scouted' : 'Unscouted'}
                                      </span>
                                      <strong>
                                        {team
                                          ? formatPercent(getCoverageValue(team, countsMap))
                                          : '--'}
                                      </strong>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ) : null}
                </>
              )
            ) : (
              <div className="predictor-selection-grid">
                {allianceOptions.map((alliance) => {
                  const selectedTeamsForAlliance = manualSelection[alliance.key]
                    .map((teamKey) => teamByKey[teamKey])
                    .filter((team): team is TeamAnalytics => Boolean(team));

                  return (
                    <section
                      key={alliance.key}
                      className={`predictor-alliance-select predictor-alliance-select-${alliance.key}`}
                    >
                      <div className="predictor-alliance-select-head">
                        <div>
                          <div className="section-kicker">{alliance.label}</div>
                          <h2>Choose three teams</h2>
                        </div>
                        <span
                          className={`fit-pill fit-pill-${
                            selectedTeamsForAlliance.length === 3
                              ? 'high'
                              : selectedTeamsForAlliance.length > 0
                                ? 'mid'
                                : 'low'
                          }`}
                        >
                          {selectedTeamsForAlliance.length}/3 selected
                        </span>
                      </div>

                      <div className="predictor-selector-stack">
                        {manualSelection[alliance.key].map((teamKey, slotIndex) => (
                          <label
                            key={`${alliance.key}-${slotIndex}`}
                            className="predictor-picker"
                          >
                            <span className="field-label">
                              {alliance.shortLabel} slot {slotIndex + 1}
                            </span>
                            <select
                              value={teamKey}
                              onChange={(event) =>
                                handleManualTeamChange(
                                  alliance.key,
                                  slotIndex,
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">Select team</option>
                              {getSelectableTeams(alliance.key, slotIndex).map((team) => (
                                <option key={team.teamKey} value={team.teamKey}>
                                  {teamNumberFromKey(team.teamKey)} |{' '}
                                  {resolveTeamName(team, tbaNameByKey)}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>

                      <div className="predictor-team-list">
                        {selectedTeamsForAlliance.length > 0 ? (
                          selectedTeamsForAlliance.map((team) => (
                            <div key={team.teamKey} className="predictor-team-row">
                              <div className="team-identity">
                                <img
                                  className="team-avatar"
                                  src={teamAvatarUrl(team.teamKey)}
                                  alt=""
                                />
                                <div className="predictor-team-copy">
                                  <strong>Team {teamNumberFromKey(team.teamKey)}</strong>
                                  <span>{resolveTeamName(team, tbaNameByKey)}</span>
                                </div>
                              </div>

                              <div className="predictor-team-meta">
                                <span>Coverage</span>
                                <strong>{formatPercent(getCoverageValue(team, countsMap))}</strong>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="predictor-empty-copy">
                            Select teams to build this alliance.
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>

          {missingAnalyticsKeys.length > 0 ? (
            <div className="surface-card empty-state">
              <strong>Analytics are missing for part of this matchup.</strong>
              <span>
                Missing teams: {missingAnalyticsKeys.map(teamNumberFromKey).join(', ')}
              </span>
            </div>
          ) : null}

          {!prediction && missingAnalyticsKeys.length === 0 ? (
            <div className="surface-card empty-state">
              <strong>Pick three red teams and three blue teams to run the prediction.</strong>
            </div>
          ) : null}

          {prediction ? (
            <>
              <section className="surface-card animate-in">
                <div className="predictor-banner">
                  <div
                    className={`predictor-outcome-card predictor-outcome-card-${prediction.winner}`}
                  >
                    <span className="hero-kicker">Prediction</span>
                    <h2>{getWinnerLabel(prediction.winner)} projected to win</h2>
                    <p>{prediction.summary}</p>

                    <div className="hero-tag-row">
                      <span
                        className={`predictor-outcome-pill predictor-outcome-pill-${prediction.winner}`}
                      >
                        {prediction.edgeLabel}
                      </span>
                      <span
                        className={`fit-pill fit-pill-${getConfidenceTone(
                          prediction.confidence,
                        )}`}
                      >
                        {prediction.confidence} confidence
                      </span>
                      <span className="hero-tag">
                        Avg scouting {formatPercent(combinedCoverage)}
                      </span>
                    </div>
                  </div>

                  <div className="predictor-rationale-card">
                    <div className="section-kicker">Swing Factors</div>
                    <div className="predictor-rationale-list">
                      {prediction.rationale.length > 0 ? (
                        prediction.rationale.map((reason) => (
                          <div key={reason} className="predictor-rationale-item">
                            {reason}
                          </div>
                        ))
                      ) : (
                        <div className="predictor-rationale-item">
                          The alliances are close enough that execution and defense timing are
                          likely to decide it.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="predictor-edge-grid animate-in">
                {prediction.edges.map((edge) => (
                  <article
                    key={edge.label}
                    className={`predictor-edge-card predictor-edge-card-${getEdgeTone(
                      edge.winner,
                    )}`}
                  >
                    <div className="predictor-edge-head">
                      <div>
                        <div className="section-kicker">Category</div>
                        <h3>{edge.label}</h3>
                      </div>
                      <span
                        className={`predictor-edge-pill predictor-edge-pill-${getEdgeTone(
                          edge.winner,
                        )}`}
                      >
                        {edge.winner === 'even'
                          ? 'Even'
                          : `${getWinnerLabel(edge.winner)} edge`}
                      </span>
                    </div>

                    <p>{edge.detail}</p>

                    <div className="predictor-metric-grid predictor-metric-grid-compact">
                      <div>
                        <span>Red profile</span>
                        <strong>{Math.round(edge.redScore)}</strong>
                      </div>
                      <div>
                        <span>Blue profile</span>
                        <strong>{Math.round(edge.blueScore)}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              <section className="predictor-alliance-grid animate-in">
                {allianceOptions.map((alliance) => {
                  const report = alliance.key === 'red' ? prediction.red : prediction.blue;
                  const allianceTeams = selectedAlliances[alliance.key];
                  const allianceCoverage = getAllianceCoverage(allianceTeams, countsMap);
                  const metrics = [
                    ...report.metrics,
                    { label: 'Coverage', value: formatPercent(allianceCoverage) },
                  ];

                  return (
                    <article
                      key={alliance.key}
                      className={`surface-card predictor-alliance-card predictor-alliance-card-${alliance.key}`}
                    >
                      <div className="predictor-alliance-head">
                        <div>
                          <div className="section-kicker">{alliance.label}</div>
                          <h2>{report.fit.headline}</h2>
                          <p>{report.fit.summary}</p>
                        </div>
                        <div className="predictor-fit-badge">
                          <span>Fit</span>
                          <strong>{report.fit.score}</strong>
                          <small>{formatPercent(allianceCoverage)} coverage</small>
                        </div>
                      </div>

                      <div className="predictor-team-strip">
                        {allianceTeams.map((team) => (
                          <div key={team.teamKey} className="predictor-team-chip">
                            <img
                              className="team-avatar"
                              src={teamAvatarUrl(team.teamKey)}
                              alt=""
                            />
                            <div>
                              <strong>Team {teamNumberFromKey(team.teamKey)}</strong>
                              <span>{resolveTeamName(team, tbaNameByKey)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="predictor-metric-grid">
                        {metrics.map((metric) => (
                          <div key={`${alliance.key}-${metric.label}`}>
                            <span>{metric.label}</span>
                            <strong>{metric.value}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="predictor-insight-grid">
                        <section className="predictor-bullet-card predictor-bullet-card-strong">
                          <div className="section-kicker">Strengths</div>
                          <div className="predictor-bullet-list">
                            {report.strengths.map((item) => (
                              <div key={item} className="predictor-bullet-item">
                                {item}
                              </div>
                            ))}
                          </div>
                        </section>

                        <section className="predictor-bullet-card predictor-bullet-card-risk">
                          <div className="section-kicker">Weaknesses</div>
                          <div className="predictor-bullet-list">
                            {report.weaknesses.map((item) => (
                              <div key={item} className="predictor-bullet-item">
                                {item}
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>

                      <div className="alliance-fit-role-grid">
                        {report.fit.assignments.map((assignment) => {
                          const assignmentTeam = teamByKey[assignment.teamKey];

                          return (
                            <article
                              key={`${alliance.key}-${assignment.role}-${assignment.teamKey}`}
                              className="alliance-fit-role-card"
                            >
                              <span>{assignment.role}</span>
                              <strong>Team {teamNumberFromKey(assignment.teamKey)}</strong>
                              <small>
                                {assignmentTeam
                                  ? resolveTeamName(assignmentTeam, tbaNameByKey)
                                  : assignment.teamKey}
                              </small>
                              <em>
                                {assignment.statLabel}: {assignment.statValue}
                              </em>
                            </article>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
