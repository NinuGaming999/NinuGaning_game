const OPTIONS = [
  { key: 'all', label: 'All Time' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'daily', label: 'Daily' },
];

export default function LeaderboardToggle({ active, onChange }) {
  return (
    <div className="flex gap-1 bg-[#1A1A1A] p-1 rounded-lg">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`flex-1 py-1.5 rounded-md text-xs font-bold tracking-wide transition duration-200 ${
            active === opt.key ? 'bg-[#FF2E2E] text-white' : 'bg-[#3D3D3D] text-white hover:bg-[#4D4D4D]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
