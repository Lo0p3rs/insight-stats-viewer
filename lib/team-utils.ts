import type { TeamDetail } from '@/lib/types';

export function teamAvatarUrl(teamKey: string, year = 2026): string {
  return `https://www.thebluealliance.com/avatar/${year}/${teamKey}.png`;
}

export function teamNumberFromKey(teamKey: string): string {
  const match = /(\d+)$/.exec(teamKey);
  return match?.[1] ?? teamKey;
}

export function teamDisplayName(name?: string | null): string {
  const rawName = name?.trim() ?? '';
  const trimmed = rawName.split('(')[0]?.trim();
  return trimmed || rawName;
}

export function resolveTeamDisplayName({
  analyticsName,
  detail,
  eventKey,
  fallbackName,
}: {
  analyticsName?: string | null;
  detail?: TeamDetail | null;
  eventKey?: string | null;
  fallbackName?: string | null;
}): string {
  const currentOverviewName =
    detail?.overviews.find((overview) => overview.eventKey === eventKey)?.name ?? '';
  const fallbackOverviewName =
    detail?.overviews.find((overview) => teamDisplayName(overview.name))?.name ?? '';

  return (
    teamDisplayName(analyticsName) ||
    teamDisplayName(currentOverviewName) ||
    teamDisplayName(fallbackOverviewName) ||
    teamDisplayName(fallbackName)
  );
}
