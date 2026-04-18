import { resolveTeamDisplayName, teamNumberFromKey } from '@/lib/team-utils';
import type {
  TbaTeamSimple,
  TeamAnalytics,
  TeamDetail,
  TeamMatchAnalytics,
} from '@/lib/types';

export type ScoutingChipTone = 'good' | 'style' | 'watch';

export type ScoutingChip = {
  key: string;
  label: string;
  tone: ScoutingChipTone;
  count: number;
};

export type TeamScoutingSummary = {
  teamKey: string;
  teamNumber: string;
  displayName: string;
  rank: number;
  rankLabel: string;
  record: string;
  noteCount: number;
  scoutedMatches: number;
  totalMatches: number;
  summary: string;
  highlights: string[];
  chips: ScoutingChip[];
  statBadges: Array<{
    label: string;
    value: string;
  }>;
};

export type ScoutingSummaryReport = {
  teams: TeamScoutingSummary[];
  chips: ScoutingChip[];
};

type SignalDefinition = {
  key: string;
  chipKey: string;
  phrases: string[];
  summaryCopy: string;
};

type RankedMetricKey = 'auto' | 'tele' | 'defense' | 'reliability';

type TeamSignalMatch = {
  key: string;
  chipKey: string;
  count: number;
  summaryCopy: string;
};

const fixedChips: Array<{
  key: string;
  label: string;
  tone: ScoutingChipTone;
}> = [
  { key: 'high-scorer', label: 'high scorer', tone: 'good' },
  { key: 'good-passer', label: 'good passer', tone: 'good' },
  { key: 'strong-defense', label: 'strong defense', tone: 'good' },
  { key: 'all-rounder', label: 'all rounder', tone: 'style' },
  { key: 'reliability-risk', label: 'reliability risk', tone: 'watch' },
];

const chipByKey = new Map(fixedChips.map((chip) => [chip.key, chip]));

const signalDefinitions: SignalDefinition[] = [
  {
    key: 'good-driver',
    chipKey: 'all-rounder',
    phrases: [
      'good driver',
      'great driver',
      'smart driver',
      'strong driver',
      'driver is good',
      'drives well',
      'good driving',
      'smart driving',
      'well driven',
      'driver awareness',
    ],
    summaryCopy: 'clean driver control',
  },
  {
    key: 'good-defense',
    chipKey: 'strong-defense',
    phrases: [
      'good defense',
      'great defense',
      'strong defense',
      'plays defense',
      'plays good defense',
      'effective defense',
      'aggressive defense',
      'defense anchor',
      'shutdown defense',
      'shuts down',
    ],
    summaryCopy: 'real defensive impact',
  },
  {
    key: 'intake-defense',
    chipKey: 'strong-defense',
    phrases: [
      'good intake defense',
      'strong intake defense',
      'intake defense',
      'denies intake',
      'cuts off intake',
      'cuts off source',
      'blocks intake',
      'stops intake',
    ],
    summaryCopy: 'useful intake denial',
  },
  {
    key: 'scoring-defense',
    chipKey: 'strong-defense',
    phrases: [
      'good scoring defense',
      'strong scoring defense',
      'scoring defense',
      'contests shots',
      'pressures scorer',
      'blocks shots',
      'shuts down scorer',
      'disrupts scoring',
    ],
    summaryCopy: 'useful scoring disruption',
  },
  {
    key: 'defensive-iq',
    chipKey: 'strong-defense',
    phrases: [
      'smart defense',
      'good defensive iq',
      'smart defender',
      'good target selection',
      'knows who to guard',
      'good help defense',
      'rotates well on defense',
    ],
    summaryCopy: 'smart defensive reads',
  },
  {
    key: 'good-passing',
    chipKey: 'good-passer',
    phrases: [
      'good passing',
      'passes well',
      'good passer',
      'accurate passer',
      'clean passes',
      'connects passes',
      'good outlet pass',
      'good handoff',
    ],
    summaryCopy: 'dependable passing',
  },
  {
    key: 'good-feeder',
    chipKey: 'good-passer',
    phrases: [
      'good feeder',
      'feeds well',
      'quick feeder',
      'good source runs',
      'good at feeding',
      'fast outlet',
    ],
    summaryCopy: 'strong feeder support',
  },
  {
    key: 'handles-pressure',
    chipKey: 'all-rounder',
    phrases: [
      'handles defense well',
      'good under defense',
      'composed under defense',
      'keeps scoring under defense',
      'works through contact',
      'not bothered by defense',
      'handles pressure',
    ],
    summaryCopy: 'calm under pressure',
  },
  {
    key: 'field-aware',
    chipKey: 'all-rounder',
    phrases: [
      'field aware',
      'good awareness',
      'smart positioning',
      'good positioning',
      'aware driver',
      'good spacing',
      'sees the field',
      'smart robot',
    ],
    summaryCopy: 'smart field awareness',
  },
  {
    key: 'versatile',
    chipKey: 'all-rounder',
    phrases: [
      'versatile',
      'well rounded',
      'all around',
      'does everything',
      'can do both',
      'multi role',
      'can defend and score',
      'switches roles well',
    ],
    summaryCopy: 'useful role flexibility',
  },
  {
    key: 'aggressive',
    chipKey: 'strong-defense',
    phrases: [
      'aggressive',
      'physical',
      'pushes hard',
      'plays physical',
      'hard defense',
      'bullying defender',
      'very physical',
    ],
    summaryCopy: 'a physical defensive style',
  },
  {
    key: 'communicates-well',
    chipKey: 'all-rounder',
    phrases: [
      'good communication',
      'communicates well',
      'good teamwork',
      'works well with partners',
      'coordinates well',
      'good alliance partner',
    ],
    summaryCopy: 'clear alliance coordination',
  },
  {
    key: 'passing-risk',
    chipKey: 'reliability-risk',
    phrases: [
      'bad passing',
      'poor passing',
      'throws away passes',
      'misses passes',
      'inaccurate passing',
      'turnover on passes',
    ],
    summaryCopy: 'passing inconsistency',
  },
  {
    key: 'penalty-risk',
    chipKey: 'reliability-risk',
    phrases: ['penalty', 'penalties', 'foul', 'fouls'],
    summaryCopy: 'penalty risk',
  },
  {
    key: 'defense-vulnerable',
    chipKey: 'reliability-risk',
    phrases: [
      'struggles with defense',
      'struggles under defense',
      'shut down easily',
      'gets bullied',
      'can not handle defense',
      'cant handle defense',
      'folds under defense',
      'rushed under pressure',
    ],
    summaryCopy: 'trouble under pressure',
  },
  {
    key: 'role-confusion',
    chipKey: 'reliability-risk',
    phrases: [
      'gets in the way',
      'bad spacing',
      'clogs lane',
      'role confusion',
      'overlaps partners',
      'poor coordination',
      'unclear role',
    ],
    summaryCopy: 'role confusion',
  },
  {
    key: 'reliability-risk',
    chipKey: 'reliability-risk',
    phrases: [
      'broke down',
      'broke',
      'broken',
      'disabled',
      'died',
      'disconnect',
      'brownout',
      'stopped moving',
      'mechanical issue',
      'mechanical problems',
      'unreliable',
    ],
    summaryCopy: 'reliability concerns',
  },
];

const signalOrderByKey = new Map(
  signalDefinitions.map((signal, index) => [signal.key, index]),
);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasNormalizedPhraseMatch(normalizedTextValue: string, phrase: string) {
  const haystack = ` ${normalizedTextValue} `;
  const needle = ` ${normalizeText(phrase)} `;
  return haystack.includes(needle);
}

function splitNoteFragments(notes: string[]) {
  return notes.flatMap((note) =>
    note
      .split(/[\n.;!?]+/)
      .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
      .filter((fragment) => fragment.length >= 12),
  );
}

function trimFragment(fragment: string, maxLength = 110) {
  if (fragment.length <= maxLength) {
    return fragment;
  }

  return `${fragment.slice(0, maxLength - 1).trimEnd()}…`;
}

function naturalList(values: string[]) {
  if (values.length === 0) {
    return '';
  }
  if (values.length === 1) {
    return values[0]!;
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function buildRankMap(
  teams: TeamAnalytics[],
  value: (team: TeamAnalytics) => number,
  direction: 'asc' | 'desc' = 'desc',
) {
  return new Map(
    [...teams]
      .sort((left, right) => {
        const diff = value(left) - value(right);
        return direction === 'asc' ? diff : -diff;
      })
      .map((team, index) => [team.teamKey, index + 1]),
  );
}

function getQualificationMatches(detail?: TeamDetail | null) {
  if (!detail) {
    return [] as TeamMatchAnalytics[];
  }

  return [...detail.matches]
    .filter((match) => match.level === 'qm')
    .sort((left, right) => left.matchSort - right.matchSort);
}

function getMatchedSignals(notes: string[]) {
  const matches = new Map<string, TeamSignalMatch>();

  notes.forEach((note) => {
    const normalizedNote = normalizeText(note);
    if (!normalizedNote) {
      return;
    }

    signalDefinitions.forEach((signal) => {
      const hasMatch = signal.phrases.some((phrase) =>
        hasNormalizedPhraseMatch(normalizedNote, phrase),
      );
      if (!hasMatch) {
        return;
      }

      const current = matches.get(signal.key);
      matches.set(signal.key, {
        key: signal.key,
        chipKey: signal.chipKey,
        count: (current?.count ?? 0) + 1,
        summaryCopy: signal.summaryCopy,
      });
    });
  });

  return [...matches.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return (
      (signalOrderByKey.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
      (signalOrderByKey.get(right.key) ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

function getHighlightFragments(notes: string[], matchedSignals: TeamSignalMatch[]) {
  const matchedKeys = new Set(matchedSignals.map((signal) => signal.key));

  return splitNoteFragments(notes)
    .map((fragment) => {
      const normalizedFragment = normalizeText(fragment);
      const score = signalDefinitions.reduce((total, signal) => {
        if (!matchedKeys.has(signal.key)) {
          return total;
        }

        const hitCount = signal.phrases.reduce(
          (sum, phrase) =>
            hasNormalizedPhraseMatch(normalizedFragment, phrase) ? sum + 1 : sum,
          0,
        );

        return total + hitCount;
      }, 0);

      return {
        fragment,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.fragment.length - left.fragment.length;
    })
    .slice(0, 2)
    .map((entry) => trimFragment(entry.fragment));
}

function buildStatSupportLine(
  team: TeamAnalytics,
  rankMaps: Record<RankedMetricKey, Map<string, number>>,
  teamCount: number,
) {
  const candidates: Array<{
    score: number;
    copy: string;
  }> = [];

  const teleRank = rankMaps.tele.get(team.teamKey) ?? teamCount;
  const autoRank = rankMaps.auto.get(team.teamKey) ?? teamCount;
  const defenseRank = rankMaps.defense.get(team.teamKey) ?? teamCount;
  const reliabilityRank = rankMaps.reliability.get(team.teamKey) ?? teamCount;

  const pushCandidate = (rank: number, copy: string) => {
    const strength = Math.max(0, teamCount - rank + 1);
    candidates.push({ score: strength, copy });
  };

  pushCandidate(teleRank, `${team.robot.teleFuelApc.toFixed(1)} tele actual`);
  pushCandidate(autoRank, `${team.robot.autoFuelApc.toFixed(1)} auto actual`);
  pushCandidate(defenseRank, `${team.robot.totalDefenseScore.toFixed(1)} defense`);
  pushCandidate(
    reliabilityRank,
    team.robot.failureCount === 0
      ? 'no logged failures'
      : `${team.robot.failureCount.toFixed(0)} logged failures`,
  );

  const topStats = candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((entry) => entry.copy);

  return topStats.length > 0
    ? `The numbers support that with ${naturalList(topStats)}.`
    : team.tba.rank > 0
      ? `The numbers still keep them at rank #${team.tba.rank}.`
      : '';
}

function buildSummaryLine(
  notes: string[],
  matchedSignals: TeamSignalMatch[],
  team: TeamAnalytics,
  rankMaps: Record<RankedMetricKey, Map<string, number>>,
  teamCount: number,
) {
  const chipCounts = matchedSignals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.chipKey] = (acc[signal.chipKey] ?? 0) + signal.count;
    return acc;
  }, {});

  const strengths = fixedChips
    .filter((chip) => chip.tone !== 'watch' && (chipCounts[chip.key] ?? 0) > 0)
    .slice(0, 3)
    .map((chip) => {
      switch (chip.key) {
        case 'high-scorer':
          return 'high scoring upside';
        case 'good-passer':
          return 'dependable passing';
        case 'strong-defense':
          return 'real defensive value';
        case 'all-rounder':
          return 'all-around utility';
        default:
          return chip.label;
      }
    });
  const watchouts = fixedChips
    .filter((chip) => chip.tone === 'watch' && (chipCounts[chip.key] ?? 0) > 0)
    .slice(0, 2)
    .map((chip) => chip.label);

  if (notes.length === 0) {
    return [
      'Scout notes are still thin for this team.',
      buildStatSupportLine(team, rankMaps, teamCount),
    ]
      .filter(Boolean)
      .join(' ');
  }

  const intro =
    strengths.length > 0
      ? `Notes point to ${naturalList(strengths)}.`
      : watchouts.length > 0
        ? `Notes mainly flag ${naturalList(watchouts)}.`
        : 'Scout notes are available, but they are still mixed and brief.';

  const support = buildStatSupportLine(team, rankMaps, teamCount);
  const watch =
    strengths.length > 0 && watchouts.length > 0
      ? `Watch ${naturalList(watchouts)}.`
      : '';

  return [intro, support, watch].filter(Boolean).join(' ');
}

function buildDisplayName(
  team: TeamAnalytics,
  detail: TeamDetail | undefined,
  eventKey: string,
  tbaTeamsByKey: Record<string, TbaTeamSimple>,
) {
  const fallbackTeam = tbaTeamsByKey[team.teamKey];
  return resolveTeamDisplayName({
    analyticsName: team.name,
    detail,
    eventKey,
    fallbackName: fallbackTeam?.nickname || fallbackTeam?.name || '',
  });
}

function sortRankValue(team: TeamAnalytics) {
  return team.tba.rank > 0 ? team.tba.rank : Number.POSITIVE_INFINITY;
}

function buildHighScorerChip(team: TeamAnalytics, teamCount: number): ScoutingChip | null {
  if (teamCount === 0) {
    return null;
  }

  const totalFuel = team.robot.autoFuelApc + team.robot.teleFuelApc;
  const highScorerSignal =
    team.tba.rank > 0 && team.tba.rank <= Math.max(8, Math.ceil(teamCount * 0.2));
  const highScorerVolume = totalFuel >= 8.5 || team.tba.opr >= 20;

  if (!highScorerSignal && !highScorerVolume) {
    return null;
  }

  const chip = chipByKey.get('high-scorer');
  if (!chip) {
    return null;
  }

  return {
    key: chip.key,
    label: chip.label,
    tone: chip.tone,
    count: 1,
  };
}

export function buildScoutingSummaryReport({
  eventKey,
  teams,
  details,
  tbaTeams,
}: {
  eventKey: string;
  teams: TeamAnalytics[];
  details: TeamDetail[];
  tbaTeams: TbaTeamSimple[];
}): ScoutingSummaryReport {
  const detailsByKey = Object.fromEntries(details.map((detail) => [detail.teamKey, detail]));
  const tbaTeamsByKey = Object.fromEntries(tbaTeams.map((team) => [team.key, team]));
  const teamCount = teams.length;
  const rankMaps: Record<RankedMetricKey, Map<string, number>> = {
    auto: buildRankMap(teams, (team) => team.robot.autoFuelApc),
    tele: buildRankMap(teams, (team) => team.robot.teleFuelApc),
    defense: buildRankMap(teams, (team) => team.robot.totalDefenseScore),
    reliability: buildRankMap(teams, (team) => team.robot.failureCount, 'asc'),
  };
  const eventChipCounts = new Map<
    string,
    {
      label: string;
      tone: ScoutingChipTone;
      count: number;
    }
  >();

  const summaries = [...teams]
    .sort((left, right) => {
      const leftRank = sortRankValue(left);
      const rightRank = sortRankValue(right);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return Number(teamNumberFromKey(left.teamKey)) - Number(teamNumberFromKey(right.teamKey));
    })
    .map<TeamScoutingSummary>((team) => {
      const detail = detailsByKey[team.teamKey] as TeamDetail | undefined;
      const matches = getQualificationMatches(detail);
      const scoutedMatches = matches.filter((match) => match.robot).length;
      const notes = matches
        .map((match) => match.robot?.notes?.trim() ?? '')
        .filter((note) => note.length > 0);
      const matchedSignals = getMatchedSignals(notes);
      const highlights = getHighlightFragments(notes, matchedSignals);
      const teamChipCounts = matchedSignals.reduce<Record<string, number>>((acc, signal) => {
        acc[signal.chipKey] = (acc[signal.chipKey] ?? 0) + signal.count;
        return acc;
      }, {});
      const chips = fixedChips
        .map<ScoutingChip | null>((chip) => {
          const count = teamChipCounts[chip.key] ?? 0;
          if (count <= 0) {
            return null;
          }

          return {
            key: chip.key,
            label: chip.label,
            tone: chip.tone,
            count,
          };
        })
        .filter((chip): chip is ScoutingChip => chip !== null);
      const highScorerChip = buildHighScorerChip(team, teamCount);
      if (highScorerChip && !chips.some((chip) => chip.key === highScorerChip.key)) {
        chips.unshift(highScorerChip);
      }

      chips.forEach((chip) => {
        const current = eventChipCounts.get(chip.key);
        eventChipCounts.set(chip.key, {
          label: chip.label,
          tone: chip.tone,
          count: (current?.count ?? 0) + 1,
        });
      });

      return {
        teamKey: team.teamKey,
        teamNumber: teamNumberFromKey(team.teamKey),
        displayName: buildDisplayName(team, detail, eventKey, tbaTeamsByKey),
        rank: team.tba.rank,
        rankLabel: team.tba.rank > 0 ? `Rank #${team.tba.rank}` : 'Unranked',
        record: `${team.tba.wins}-${team.tba.losses}-${team.tba.ties}`,
        noteCount: notes.length,
        scoutedMatches,
        totalMatches: matches.length,
        summary: buildSummaryLine(notes, matchedSignals, team, rankMaps, teamCount),
        highlights,
        chips,
        statBadges: [
          { label: 'Auto actual', value: team.robot.autoFuelApc.toFixed(1) },
          { label: 'Tele actual', value: team.robot.teleFuelApc.toFixed(1) },
          { label: 'Defense', value: team.robot.totalDefenseScore.toFixed(1) },
          { label: 'OPR', value: team.tba.opr.toFixed(1) },
        ],
      };
    });

  const availableChips = fixedChips.map<ScoutingChip>((chip) => ({
    key: chip.key,
    label: chip.label,
    tone: chip.tone,
    count: eventChipCounts.get(chip.key)?.count ?? 0,
  }));

  return {
    teams: summaries,
    chips: availableChips,
  };
}
