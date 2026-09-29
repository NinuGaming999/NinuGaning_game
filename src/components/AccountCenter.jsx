import { useEffect, useMemo, useState } from 'react';
import { getDatabase, getUserIdFromName } from '../utils/firebaseService';
import { friendlyError, sendResetEmail, signOutUser } from '../utils/authService';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function DataCard({ label, value, hint, accent }) {
  return <div className={`account-stat account-accent-${accent}`}><div className="account-label">{label}</div><div className="account-value">{value}</div><div className="account-hint">{hint}</div></div>;
}

export default function AccountCenter({ user, playerName, onBack, onSignOut }) {
  const [data, setData] = useState({ artifact: null, racing: null, collection: {}, currency: {} });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const userId = useMemo(() => getUserIdFromName(playerName), [playerName]);

  useEffect(() => {
    if (!userId) return undefined;
    const db = getDatabase();
    let active = true;
    const refs = [
      db.ref(`leaderboard/${userId}`),
      db.ref(`racingLeaderboard/${userId}`),
      db.ref(`cardCollection/${userId}`),
      db.ref(`cardCurrency/${userId}`),
    ];
    Promise.all(refs.map((ref) => ref.once('value'))).then(([artifact, racing, collection, currency]) => {
      if (!active) return;
      setData({ artifact: artifact.val(), racing: racing.val(), collection: collection.val() || {}, currency: currency.val() || {} });
    }).catch((err) => active && setError(friendlyError(err))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [userId]);

  const collectionStats = useMemo(() => {
    const entries = Object.values(data.collection || {});
    return { unique: entries.filter((e) => Number(e?.count) > 0).length, copies: entries.reduce((n, e) => n + (Number(e?.count) || 0), 0) };
  }, [data.collection]);

  const points = useMemo(() => {
    const racing = Number(data.racing?.score) || 0;
    const artifact = Number(data.artifact?.meltDamage) || 0;
    const spent = Number(data.currency?.spent) || 0;
    const earned = Math.floor(racing / 100) + Math.floor(artifact / 500);
    return { earned, spent, balance: Math.max(0, earned - spent) };
  }, [data]);

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        email: user?.email || '',
        emailVerified: !!user?.emailVerified,
        playerName,
        createdAt: user?.metadata?.creationTime || null,
        lastSignInAt: user?.metadata?.lastSignInTime || null,
      },
      gameData: { artifactBest: data.artifact, racingBest: data.racing, cardCollection: data.collection, cardCurrency: data.currency, arcadePoints: points },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ninu-gaming-${playerName.replace(/[^a-z0-9_-]/gi, '_')}-data.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('Your arcade data export was prepared.');
  };

  const resetPassword = async () => {
    if (!user?.email) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await sendResetEmail(user.email);
      setNotice('Password reset email sent. Check your Inbox and Spam/Junk folder.');
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="account-page">
      <div className="account-glow account-glow-one" /><div className="account-glow account-glow-two" />
      <header className="account-header">
        <button type="button" className="account-back" onClick={onBack}>← ARCADE</button>
        <div className="account-brand"><span className="account-mark">N</span><span><small>NINU GAMING</small><strong>ACCOUNT CONTROL</strong></span></div>
        <button type="button" className="account-signout" onClick={onSignOut}>SIGN OUT</button>
      </header>
      <main className="account-main">
        <section className="account-hero">
          <div><div className="account-eyebrow">PLAYER CONTROL CENTER</div><h1>Everything about<br /><span>{playerName}</span> in one place.</h1><p>Manage your arcade identity, inspect progression, review stored game data, and control account security.</p></div>
          <div className="account-verified"><i /> VERIFIED ACCOUNT</div>
        </section>
        {(error || notice) && <div className={`account-message ${error ? 'is-error' : 'is-ok'}`}>{error || notice}</div>}
        <section className="account-grid">
          <DataCard label="ARTIFACT BEST" value={loading ? '…' : Number(data.artifact?.meltDamage || 0).toLocaleString()} hint="Highest Melt Damage" accent="red" />
          <DataCard label="RACING BEST" value={loading ? '…' : Number(data.racing?.score || 0).toLocaleString()} hint="Highest race score" accent="green" />
          <DataCard label="ELEMENTALS" value={loading ? '…' : `${collectionStats.unique} / 35`} hint={`${collectionStats.copies} total card copies`} accent="cyan" />
          <DataCard label="ARCADE POINTS" value={loading ? '…' : points.balance.toLocaleString()} hint={`${points.earned} earned · ${points.spent} spent`} accent="gold" />
        </section>
        <section className="account-panels">
          <div className="account-panel">
            <div className="account-panel-head"><div><span>PROFILE</span><h2>Your arcade identity</h2></div><b>01</b></div>
            <div className="account-row"><span>PLAYER NAME</span><strong>{playerName}</strong></div>
            <div className="account-row"><span>EMAIL</span><strong>{user?.email || '—'}</strong></div>
            <div className="account-row"><span>EMAIL STATUS</span><strong className="good">VERIFIED</strong></div>
            <div className="account-row"><span>ACCOUNT CREATED</span><strong>{formatDate(user?.metadata?.creationTime)}</strong></div>
            <div className="account-row"><span>LAST SIGN-IN</span><strong>{formatDate(user?.metadata?.lastSignInTime)}</strong></div>
          </div>
          <div className="account-panel">
            <div className="account-panel-head"><div><span>SECURITY</span><h2>Account controls</h2></div><b>02</b></div>
            <button type="button" className="account-action" disabled={busy} onClick={resetPassword}><span><strong>{busy ? 'SENDING RESET…' : 'Reset password'}</strong><small>Send a fresh password reset link to your account email.</small></span><b>→</b></button>
            <button type="button" className="account-action" onClick={exportData}><span><strong>Export my arcade data</strong><small>Download profile, scores, collection and currency as JSON.</small></span><b>↓</b></button>
            <button type="button" className="account-action danger" onClick={onSignOut}><span><strong>Sign out of this device</strong><small>End the current Firebase session.</small></span><b>↪</b></button>
          </div>
          <div className="account-panel account-wide">
            <div className="account-panel-head"><div><span>PROGRESSION</span><h2>Your arcade footprint</h2></div><b>03</b></div>
            <div className="progress-track"><i style={{ width: `${Math.min(100, collectionStats.unique / 35 * 100)}%` }} /></div>
            <div className="account-progress-line"><span>Elementals collection</span><strong>{collectionStats.unique}/35</strong></div>
            <div className="progress-track green"><i style={{ width: `${Math.min(100, Number(data.racing?.distance || 0) / 7000 * 100)}%` }} /></div>
            <div className="account-progress-line"><span>Recorded race distance</span><strong>{Number(data.racing?.distance || 0).toLocaleString()}m</strong></div>
            <div className="progress-track red"><i style={{ width: `${Math.min(100, Number(data.artifact?.critRate || 0))}%` }} /></div>
            <div className="account-progress-line"><span>Best artifact crit rate</span><strong>{(Number(data.artifact?.critRate || 0) * 100).toFixed(1)}%</strong></div>
          </div>
        </section>
      </main>
    </div>
  );
}
