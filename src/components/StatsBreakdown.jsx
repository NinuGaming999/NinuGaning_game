import { BASE_ATK, BASE_CRIT_DMG, BASE_CRIT_RATE } from '../utils/damageCalculator';

export default function StatsBreakdown({ roll }) {
  const totalAtk = roll ? Math.round(roll.totalATK) : BASE_ATK;
  const totalCritRate = roll ? roll.critRate : BASE_CRIT_RATE;
  const totalCritDmg = roll ? roll.critDmg : BASE_CRIT_DMG;

  const stats = [
    { label: 'Total ATK', value: totalAtk.toLocaleString() },
    { label: 'Total CRIT Rate', value: `${(totalCritRate * 100).toFixed(1)}%` },
    { label: 'Total CRIT DMG', value: `${(totalCritDmg * 100).toFixed(1)}%` },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-[400px]">
      {stats.map((s) => (
        <div key={s.label} className="bg-[#2D2D2D] border border-[#FF2E2E] rounded-lg py-4 px-2 text-center">
          <div className="text-[#FFD700] text-xl md:text-2xl font-bold">{s.value}</div>
          <div className="text-[#CCCCCC] text-[11px] md:text-xs mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
