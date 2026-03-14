'use client';

type TabOption = {
  key: string;
  label: string;
};

type TabsProps = {
  options: TabOption[];
  value: string;
  onChange: (key: string) => void;
};

export default function Tabs({ options, value, onChange }: TabsProps) {
  return (
    <div className="tabs-row" role="tablist" aria-label="Detail tabs">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          className={`tab-chip ${value === option.key ? 'active' : ''}`}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
