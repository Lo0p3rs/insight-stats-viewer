export function teamAvatarUrl(teamKey: string, year = 2026): string {
  return `https://www.thebluealliance.com/avatar/${year}/${teamKey}.png`;
}

export function teamNumberFromKey(teamKey: string): string {
  const match = /(\d+)$/.exec(teamKey);
  return match?.[1] ?? teamKey;
}
