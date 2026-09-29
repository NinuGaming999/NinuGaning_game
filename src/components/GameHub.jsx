import { useEffect, useState } from 'react';
import { getDatabase, getUserIdFromName } from '../utils/firebaseService';

function GameCard({ title, description, badge, accent, icon, stats, onPlay }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`hub-game-card hub-${accent} ${open ? 'is-open' : ''}`}>
      <button type="button" className="hub-card-hit" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="hub-card-top"><span>{badge}</span><b>{open ? 'CLOSE ↑' : 'DETAILS ↗'}</b></div>
        <div className="hub-game-icon">{icon}</div>
        <h2>{title}</h2><p>{description}</p>
        <div className="hub-card-footer"><span>{open ? 'EXPANDED VIEW' : 'CLICK TO EXPAND'}</span><i>{open ? '−' : '+'}</i></div>
      </button>
      {open && <div className="hub-expanded">
        <div className="hub-detail-copy"><span>GAME OVERVIEW</span><p>{stats.detail}</p></div>
        <div className="hub-detail-stats">{stats.items.map(([label,value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
        <button type="button" className="hub-play" onClick={onPlay}>LAUNCH {title.toUpperCase()} <span>→</span></button>
      </div>}
    </article>
  );
}

export default function GameHub({ playerName, onSignOut, onOpenArtifact, onOpenRacing, onOpenCards, onOpenAccount }) {
  const [stats, setStats] = useState({ artifact:null, racing:null, collection:0, spent:0 });
  useEffect(() => {
    const id=getUserIdFromName(playerName); if(!id) return undefined;
    const db=getDatabase(); let active=true;
    Promise.all([
      db.ref(`leaderboard/${id}`).once('value'),
      db.ref(`racingLeaderboard/${id}`).once('value'),
      db.ref(`cardCollection/${id}`).once('value'),
      db.ref(`cardCurrency/${id}/spent`).once('value'),
    ]).then(([artifact,racing,collection,spent]) => {
      if(!active) return;
      setStats({ artifact:artifact.val(), racing:racing.val(), collection:Object.values(collection.val()||{}).filter(e=>Number(e?.count)>0).length, spent:Number(spent.val())||0 });
    }).catch(()=>{});
    return ()=>{active=false};
  },[playerName]);

  return <div className="hub-page">
    <header className="hub-header"><div className="hub-shell hub-header-inner">
      <div className="hub-brand"><span className="hub-mark"><img className="brand-img" src="/favicon.png" alt="NINU Gaming" /></span><span><small>NINU GAMING</small><strong>ARCADE</strong></span></div>
      <div className="hub-header-actions">
        <button type="button" className="hub-account" onClick={onOpenAccount}><span className="hub-online" /> {playerName} <b>ACCOUNT ↗</b></button>
        <button type="button" className="hub-signout" onClick={onSignOut}>SIGN OUT</button>
      </div>
    </div></header>
    <main className="hub-shell hub-main">
      <section className="hub-hero"><div><div className="hub-eyebrow">PLAYER HUB · {playerName.toUpperCase()}</div>
        <h1>Choose your<br /><span>next world.</span></h1>
        <p>Every section expands before you launch it. Inspect your records, understand each game, then jump straight into the action.</p>
      </div><div className="hub-orbit"><div className="hub-orbit-ring ring-a"/><div className="hub-orbit-ring ring-b"/><div className="hub-orbit-core"><img className="brand-img" src="/favicon.png" alt="NINU Gaming" /></div></div></section>
      <section className="hub-summary">
        <div><small>ARTIFACT BEST</small><strong>{stats.artifact?Number(stats.artifact.meltDamage||0).toLocaleString():'—'}</strong><span>MELT DAMAGE</span></div>
        <div><small>RACING BEST</small><strong>{stats.racing?Number(stats.racing.score||0).toLocaleString():'—'}</strong><span>RACE SCORE</span></div>
        <div><small>COLLECTION</small><strong>{stats.collection}/35</strong><span>ELEMENTAL CARDS</span></div>
        <div><small>POINTS SPENT</small><strong>{stats.spent.toLocaleString()}</strong><span>ARCADE CURRENCY</span></div>
      </section>
      <div className="hub-section-head"><div><span>01 · THE ARCADE</span><h2>Pick a game.</h2></div><small>EXPAND · INSPECT · LAUNCH</small></div>
      <section className="hub-games">
        <GameCard title="Artifact Roll Simulator" description="Roll a complete Arlecchino artifact set and chase the most absurd Melt Damage your RNG can produce." badge="GAME 01 · RNG" accent="red" icon="✦" stats={{detail:'Five pieces, real stat rolls, live scoring, and a leaderboard that keeps only your best result.',items:[['SET','5 PIECES'],['FOCUS','CRIT + ATK'],['LEADERBOARD','LIVE']]}} onPlay={onOpenArtifact}/>
        <GameCard title="Neon Mountain Racer" description="Drive the full 7 km mountain circuit with boost, drifting, AI opponents, and live 1v1 matchmaking." badge="GAME 02 · RACING" accent="green" icon="↗" stats={{detail:'Three laps, pace-based scoring, a racing leaderboard, and a real-time matchmaking path.',items:[['TRACK','7 KM'],['LAPS','3'],['MODE','AI / 1V1']]}} onPlay={onOpenRacing}/>
        <GameCard title="Elementals" description="Use points earned elsewhere to open five-card packs, build your collection, and enter reaction-based duels." badge="GAME 03 · CARDS" accent="cyan" icon="◆" stats={{detail:'35 collectible cards, five-card packs, elemental reactions, and a random-opponent duel arena.',items:[['CARDS','35'],['PACK','5 CARDS'],['DUEL','REACTIONS']]}} onPlay={onOpenCards}/>
      </section>
      <button type="button" className="hub-control-banner" onClick={onOpenAccount}><span><small>ACCOUNT CONTROL CENTER</small><strong>Manage your profile, security, stats & data</strong></span><b>OPEN CONTROL CENTER →</b></button>
      <footer className="hub-footer">NINU GAMING ARCADE · THREE WORLDS · ONE PLAYER IDENTITY</footer>
    </main>
  </div>;
}
