import type { EventMatch, TeamAnalytics } from '@/lib/types';

export type MatchCounts = {
  played: number;
  scouted: number;
};

export function buildMatchCounts(matches: EventMatch[]) {
  const counts: Record<string, MatchCounts> = {};

  matches
    .filter((match) => match.level === 'qm')
    .forEach((match) => {
      const teamKeys = [
        ...match.alliances.red.teamKeys,
        ...match.alliances.blue.teamKeys,
      ];
      const scoutedTeams = new Set(match.scoutingStatus.robot);

      teamKeys.forEach((teamKey) => {
        const entry = counts[teamKey] ?? { played: 0, scouted: 0 };
        entry.played += 1;
        if (scoutedTeams.has(teamKey)) {
          entry.scouted += 1;
        }
        counts[teamKey] = entry;
      });
    });

  return counts;
}

export function getTeamAppearances(team: TeamAnalytics) {
  return team.tba.wins + team.tba.losses + team.tba.ties;
}

export function getPlayedValue(
  team: TeamAnalytics,
  countsMap: Record<string, MatchCounts>,
) {
  return countsMap[team.teamKey]?.played ?? getTeamAppearances(team);
}

export function getScoutedValue(
  team: TeamAnalytics,
  countsMap: Record<string, MatchCounts>,
) {
  return countsMap[team.teamKey]?.scouted ?? team.scoutedMatches ?? 0;
}

export function getCoverageValue(
  team: TeamAnalytics,
  countsMap: Record<string, MatchCounts>,
) {
  const played = getPlayedValue(team, countsMap);
  if (played <= 0) {
    return 0;
  }

  return getScoutedValue(team, countsMap) / played;
}

export function getWinRate(team: TeamAnalytics) {
  const played = getTeamAppearances(team);
  if (played <= 0) {
    return 0;
  }

  return (team.tba.wins + team.tba.ties * 0.5) / played;
}
