'use client';

import Link from 'next/link';
import { calculateTeamCardMetrics } from '@/lib/analysis';
import { teamAvatarUrl, teamNumberFromKey } from '@/lib/team-utils';
import type { TeamAnalytics } from '@/lib/types';

type TeamCardProps = {
  team: TeamAnalytics;
  allTeams: TeamAnalytics[];
};

function PerformanceBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="performance-row">
      <span>{label}</span>
      <div className="performance-track">
        <div
          className={`performance-fill tone-${tone}`}
          style={{ width: `${Math.max(6, value * 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`team-stat-chip tone-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function TeamCard({ team, allTeams }: TeamCardProps) {
  const bars = calculateTeamCardMetrics(allTeams, team);
  const record = `${team.tba.wins}-${team.tba.losses}-${team.tba.ties}`;

  return (
    <Link href={`/teams/${team.teamKey}`} className="team-card">
      <div className="team-card-header">
        <div className="team-card-identity">
          <img
            src={teamAvatarUrl(team.teamKey)}
            alt=""
            className="team-avatar team-avatar-large"
          />
          <div className="team-card-copy">
            <div className="team-card-title-row">
              <strong>{teamNumberFromKey(team.teamKey)}</strong>
              <span>({record})</span>
            </div>
            <span className="team-card-name">{team.name}</span>
          </div>
        </div>

        <div className="team-rank-pill">#{team.tba.rank}</div>
      </div>

      <div className="team-stat-row">
        <StatChip label="OPR" value={team.tba.opr.toFixed(1)} tone="secondary" />
        <StatChip
          label="Tele actual"
          value={team.robot.teleFuelApc.toFixed(1)}
          tone="success"
        />
        <StatChip
          label="Auto actual"
          value={team.robot.autoFuelApc.toFixed(1)}
          tone="warning"
        />
      </div>

      <div className="performance-grid">
        <PerformanceBar label="Auto" value={bars.auto} tone="warning" />
        <PerformanceBar label="Teleop" value={bars.tele} tone="success" />
        <PerformanceBar label="Defense" value={bars.defense} tone="info" />
        <PerformanceBar label="Reliable" value={bars.reliable} tone="danger" />
      </div>

      <div className="team-card-footer">
        <span>Defense {team.robot.totalDefenseScore.toFixed(1)}</span>
        <span>{team.scoutedMatches ?? 0} matches tracked</span>
      </div>
    </Link>
  );
}
