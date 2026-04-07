'use client';

import Link from 'next/link';
import { teamAvatarUrl } from '@/lib/team-utils';
import type { TeamScoutingSummary } from '@/lib/scouting-summary';

type ScoutingSummaryCardProps = {
  team: TeamScoutingSummary;
  activeChipKeys: string[];
  onToggleChip: (chipKey: string) => void;
};

export default function ScoutingSummaryCard({
  team,
  activeChipKeys,
  onToggleChip,
}: ScoutingSummaryCardProps) {
  return (
    <article className="surface-card scouting-card">
      <div className="scouting-card-header">
        <div className="scouting-card-identity">
          <img
            src={teamAvatarUrl(team.teamKey)}
            alt=""
            className="team-avatar team-avatar-large"
          />
          <div className="scouting-card-copy">
            <div className="scouting-card-title-row">
              <Link href={`/teams/${team.teamKey}`} className="scouting-team-link">
                <strong>{team.teamNumber}</strong>
              </Link>
              <span className="section-note">{team.rankLabel}</span>
            </div>
            <div className="scouting-team-name">{team.displayName || `Team ${team.teamNumber}`}</div>
            <div className="scouting-card-meta">
              <span>{team.record} record</span>
              <span>
                {team.noteCount} notes / {team.scoutedMatches} tracked / {team.totalMatches} played
              </span>
            </div>
          </div>
        </div>

        <Link href={`/teams/${team.teamKey}`} className="btn btn-ghost scouting-open-link">
          Open
        </Link>
      </div>

      <p className="scouting-card-summary">{team.summary}</p>

      <div className="scouting-chip-row">
        {team.chips.length > 0 ? (
          team.chips.map((chip) => {
            const active = activeChipKeys.includes(chip.key);
            return (
              <button
                key={chip.key}
                type="button"
                className={`scouting-chip scouting-chip-${chip.tone} ${
                  active ? 'active' : ''
                }`}
                onClick={() => onToggleChip(chip.key)}
              >
                <span>{chip.label}</span>
                <small>{chip.count}</small>
              </button>
            );
          })
        ) : (
          <span className="scouting-chip scouting-chip-empty">No highlights yet</span>
        )}
      </div>

      <div className="scouting-stat-grid">
        {team.statBadges.map((stat) => (
          <div key={stat.label} className="scouting-stat">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      {team.highlights.length > 0 ? (
        <div className="scouting-highlight-list">
          {team.highlights.map((highlight) => (
            <div key={highlight} className="scouting-highlight">
              “{highlight}”
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
