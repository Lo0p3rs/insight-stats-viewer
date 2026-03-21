import type { EventMatch } from '@/lib/types';

export type MatchLevelFilter = 'all' | 'qm' | 'sf' | 'f';

const levelOrder: Record<string, number> = {
  qm: 0,
  qf: 1,
  sf: 2,
  f: 3,
};

export function compareEventMatches(left: EventMatch, right: EventMatch) {
  const levelDiff =
    (levelOrder[left.level] ?? Number.MAX_SAFE_INTEGER) -
    (levelOrder[right.level] ?? Number.MAX_SAFE_INTEGER);
  if (levelDiff !== 0) {
    return levelDiff;
  }

  if (left.level === 'sf' || left.level === 'qf') {
    const setDiff = left.setNumber - right.setNumber;
    if (setDiff !== 0) {
      return setDiff;
    }
  }

  const matchDiff = left.matchNumber - right.matchNumber;
  if (matchDiff !== 0) {
    return matchDiff;
  }

  return left.matchKey.localeCompare(right.matchKey);
}

export function formatMatchLabel(match: Pick<EventMatch, 'level' | 'matchNumber' | 'setNumber'>) {
  switch (match.level) {
    case 'qm':
      return `Qual ${match.matchNumber}`;
    case 'qf':
      return `Quarter ${match.setNumber}-${match.matchNumber}`;
    case 'sf':
      return `Semi ${match.setNumber}-${match.matchNumber}`;
    case 'f':
      return `Final ${match.matchNumber}`;
    default:
      return `${match.level.toUpperCase()} ${match.matchNumber}`;
  }
}

export function formatMatchKeyLabel(matchKey: string) {
  const parts = matchKey.split('_');
  const segment = parts[parts.length - 1] ?? matchKey;
  const quarterMatch = /^qf(\d+)m(\d+)$/i.exec(segment);
  if (quarterMatch) {
    return `Quarter ${quarterMatch[1]}-${quarterMatch[2]}`;
  }

  const semiMatch = /^sf(\d+)m(\d+)$/i.exec(segment);
  if (semiMatch) {
    return `Semi ${semiMatch[1]}-${semiMatch[2]}`;
  }

  const qualMatch = /^qm(\d+)$/i.exec(segment);
  if (qualMatch) {
    return `Qual ${qualMatch[1]}`;
  }

  const finalMatch = /^f(\d+)$/i.exec(segment);
  if (finalMatch) {
    return `Final ${finalMatch[1]}`;
  }

  return segment.toUpperCase();
}

export function matchLevelCopy(level: string) {
  switch (level) {
    case 'qm':
      return 'Qualification';
    case 'qf':
      return 'Quarterfinal';
    case 'sf':
      return 'Semifinal';
    case 'f':
      return 'Final';
    default:
      return level.toUpperCase();
  }
}

export function getMatchTeamKeys(match: EventMatch) {
  return [...match.alliances.red.teamKeys, ...match.alliances.blue.teamKeys];
}

export function getRobotScoutedTeams(match: EventMatch) {
  return new Set(match.scoutingStatus.robot);
}

export function getRobotScoutedCount(match: EventMatch) {
  return getRobotScoutedTeams(match).size;
}

export function isMatchCompleted(match: EventMatch) {
  return match.alliances.red.score !== null && match.alliances.blue.score !== null;
}

export function filterEventMatches(
  matches: EventMatch[],
  levelFilter: MatchLevelFilter,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  const digitQuery = normalizedQuery.replace(/\D/g, '');

  return matches.filter((match) => {
    if (levelFilter !== 'all' && match.level !== levelFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const label = formatMatchLabel(match).toLowerCase();
    if (label.includes(normalizedQuery) || match.matchKey.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    return getMatchTeamKeys(match).some((teamKey) => {
      const normalizedTeamKey = teamKey.toLowerCase();
      const teamDigits = normalizedTeamKey.replace(/\D/g, '');
      return (
        normalizedTeamKey.includes(normalizedQuery) ||
        (digitQuery.length > 0 && teamDigits === digitQuery)
      );
    });
  });
}
