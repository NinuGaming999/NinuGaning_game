export default function RollButton({ onRoll, rolling, fixed }) {
  const baseClasses =
    'bg-[#FF2E2E] text-white font-bold text-base md:text-lg tracking-wide transition-all duration-200 hover:bg-[#C41E3A] hover:scale-105 hover:shadow-[0_0_20px_rgba(255,46,46,0.8)] active:scale-95 disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-none';

  const shapeClasses = fixed
    ? 'fixed bottom-0 left-0 right-0 w-full h-[50px] z-30'
    : 'w-[300px] h-[56px] rounded-lg';

  return (
    <button type="button" onClick={onRoll} disabled={rolling} className={`${baseClasses} ${shapeClasses}`}>
      {rolling ? 'Rolling...' : '🎲 ROLL ARTIFACT'}
    </button>
  );
}
