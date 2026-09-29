export default function Header({ title = 'Artifact Roll Simulator', onBack }) {
  return (
    <header className="arcade-header">
      <div className="arcade-header-left">
        {onBack && <button type="button" className="arcade-back" onClick={onBack}>← ARCADE</button>}
        <div className="arcade-brand"><span>N</span><strong>NINU GAMING</strong></div>
      </div>
      <div className="arcade-title"><small>ARCADE SESSION</small><strong>{title}</strong></div>
      <div className="arcade-header-right">
        <span className="arcade-session-dot" title="Signed in" />
        <button type="button" title="How to play" className="arcade-help">?</button>
      </div>
    </header>
  );
}
