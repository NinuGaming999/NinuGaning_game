import Leaderboard from './Leaderboard';

export default function LeaderboardModal({ open, onClose, ...leaderboardProps }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/85 flex flex-col" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="flex items-center justify-between p-4 border-b-2 border-[#FF2E2E] shrink-0">
        <h2 className="text-white font-bold text-lg tracking-wide">LEADERBOARD</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-white text-sm border border-[#FF2E2E] rounded-full px-4 py-1.5 hover:bg-[#FF2E2E] transition duration-200"
        >
          Close
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <Leaderboard {...leaderboardProps} />
      </div>
      <div className="p-4 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-full border-2 border-[#FF2E2E] text-white font-bold py-3 rounded-lg hover:bg-[#FF2E2E] transition duration-200"
        >
          Close Modal
        </button>
      </div>
    </div>
  );
}
