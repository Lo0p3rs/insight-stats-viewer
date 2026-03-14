'use client';

import type { TeamSortMode } from '@/lib/analysis';

const chips: Array<{ mode: TeamSortMode; label: string; tone: string }> = [
  { mode: 'rank', label: 'RANK', tone: 'primary' },
  { mode: 'opr', label: 'OPR', tone: 'secondary' },
  { mode: 'tele', label: 'TELE', tone: 'success' },
  { mode: 'auto', label: 'AUTO', tone: 'warning' },
  { mode: 'defense', label: 'DEF', tone: 'info' },
];

type SortChipsProps = {
  value: TeamSortMode;
  onChange: (mode: TeamSortMode) => void;
};

export default function SortChips({ value, onChange }: SortChipsProps) {
  return (
    <div className="sort-chip-row">
      <span className="sort-chip-label">Sort by:</span>
      {chips.map((chip) => (
        <button
          key={chip.mode}
          type="button"
          className={`sort-chip tone-${chip.tone} ${
            value === chip.mode ? 'active' : ''
          }`}
          onClick={() => onChange(chip.mode)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
