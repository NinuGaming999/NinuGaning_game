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
    <div className="artifact-stats">
      {stats.map((s) => (
        <div key={s.label} className="artifact-stat">
          <div className="artifact-stat-value">{s.value}</div>
          <div className="artifact-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
