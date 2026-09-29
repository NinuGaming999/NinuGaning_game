export default function NameInput({ value, onChange, disabled }) {
  return <div className="artifact-player-field">
    <span>PLAYER ID</span>
    <input type="text" value={value} onChange={(e)=>onChange(e.target.value.replace(/\n/g,'').slice(0,30))} disabled={disabled} readOnly title="Your username comes from your account" />
    <small>Locked to your verified arcade account</small>
  </div>;
}
