import { useMemo, useState } from 'react';
import LeaderboardToggle from './LeaderboardToggle';

function filterByTimeframe(entries, timeframe) {
  const now=Date.now();
  if(timeframe==='weekly') return entries.filter(e=>now-e.timestamp<7*24*60*60*1000);
  if(timeframe==='daily') return entries.filter(e=>now-e.timestamp<24*60*60*1000);
  return entries;
}
export default function Leaderboard({ leaderboard,currentPlayerName,loading,error }) {
  const [timeframe,setTimeframe]=useState('all');
  const rows=useMemo(()=>filterByTimeframe(leaderboard,timeframe).slice().sort((a,b)=>b.meltDamage-a.meltDamage).slice(0,50),[leaderboard,timeframe]);
  return <div className="leaderboard-panel">
    <div className="leaderboard-heading"><div><span>GLOBAL SCOREBOARD</span><h2>Artifact Leaders</h2></div><em>LIVE</em></div>
    <LeaderboardToggle active={timeframe} onChange={setTimeframe}/>
    {error&&<div className="leaderboard-error">{error}</div>}
    <div className="leaderboard-table">
      <div className="leaderboard-table-head"><span>#</span><span>PLAYER</span><span>SCORE</span></div>
      {loading&&rows.length===0&&<div className="leaderboard-empty">Loading leaderboard…</div>}
      {!loading&&rows.length===0&&<div className="leaderboard-empty">No rolls yet — be the first.</div>}
      {rows.map((row,i)=>{const isMe=currentPlayerName&&row.playerName===currentPlayerName;return <div key={row.id||`${row.playerName}-${row.timestamp}`} className={`leaderboard-row ${isMe?'me':''}`}><span className="rank">{String(i+1).padStart(2,'0')}</span><span className="leader-player"><i>{row.playerName.slice(0,2).toUpperCase()}</i><b>{row.playerName}</b></span><strong>{Number(row.meltDamage||0).toLocaleString()}</strong></div>;})}
    </div>
  </div>;
}
