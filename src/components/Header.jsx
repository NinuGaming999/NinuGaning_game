export default function Header({ title = 'Artifact Roll Simulator', onBack }) {
  return (
    <header className="h-[50px] md:h-[60px] bg-[#1A1A1A] border-b-2 border-[#FF2E2E] flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-white border border-[#555] rounded-lg px-2.5 py-1 text-xs md:text-sm hover:border-[#FF2E2E] transition duration-200"
          >
            ← Arcade
          </button>
        )}
        <span className="text-white font-bold text-sm md:text-lg tracking-wide">NINU GAMING</span>
      </div>
      <span className="text-white font-bold text-sm md:text-2xl tracking-wide text-center truncate mx-2">{title}</span>
      <button
        type="button"
        title="How to play"
        className="text-white border border-[#FF2E2E] rounded-full w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-sm hover:bg-[#FF2E2E] transition duration-200"
      >
        ?
      </button>
    </header>
  );
}
