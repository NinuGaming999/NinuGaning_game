export default function RollButton({ onRoll, rolling, fixed }) {
  const shape = fixed ? 'artifact-roll-button-fixed' : 'artifact-roll-button-wide';
  return <button type="button" onClick={onRoll} disabled={rolling} className={`artifact-roll-button ${shape}`}>
    <span>{rolling ? 'ROLLING…' : '🎲 ROLL ARTIFACT'}</span><small>{rolling ? 'Generating five pieces' : 'Generate a new five-piece set'}</small>
  </button>;
}
