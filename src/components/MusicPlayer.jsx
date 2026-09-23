import { useEffect, useRef, useState } from 'react';

const MUSIC_SRC = '/music/background.mp3';
const STORAGE_KEY = 'ninu-gaming-music-enabled';
const DEFAULT_VOLUME = 0.35;

function readEnabledPreference() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === null ? true : saved !== 'false';
  } catch {
    return true;
  }
}

function writeEnabledPreference(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // localStorage can be unavailable in private/restricted browser contexts.
  }
}

export default function MusicPlayer() {
  const audioRef = useRef(null);
  const enabledRef = useRef(readEnabledPreference());
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(true);
  const [touchLike, setTouchLike] = useState(false);

  useEffect(() => {
    setTouchLike(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.volume = DEFAULT_VOLUME;
    audio.loop = true;
    audio.preload = 'auto';

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleError = () => {
      setAvailable(false);
      setPlaying(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    // Browsers generally block autoplay until the visitor interacts with the page.
    // The first interaction anywhere on the site unlocks the music when enabled.
    const unlock = () => {
      if (!enabledRef.current || !audio.paused) return;
      audio.play().catch(() => {
        // Autoplay may still be blocked by the browser; the visible button remains usable.
      });
    };

    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });

    // Music is ON by default for new visitors. A browser may block audible
    // autoplay until the visitor interacts with the page; the first pointer
    // or keyboard interaction retries playback automatically.
    if (enabledRef.current) {
      audio.play().catch(() => {});
    }

    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio || !available) return;

    if (playing) {
      enabledRef.current = false;
      writeEnabledPreference(false);
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    enabledRef.current = true;
    writeEnabledPreference(true);
    audio.currentTime = 0;
    audio.play().catch(() => {
      // A browser may require the button click itself to be the gesture.
      // If playback is still blocked, another click will retry.
    });
  };

  return (
    <>
      <audio ref={audioRef} src={MUSIC_SRC} aria-hidden="true" />

      <button
        type="button"
        onClick={toggleMusic}
        disabled={!available}
        title={
          !available
            ? 'Add public/music/background.mp3 to enable music'
            : playing
              ? 'Stop music'
              : 'Play music'
        }
        aria-label={
          !available
            ? 'Music file not found'
            : playing
              ? 'Stop background music'
              : 'Play background music'
        }
        className={[
          'fixed z-[100] select-none',
          touchLike ? 'bottom-24 right-4' : 'bottom-5 right-5',
          'flex items-center gap-2 rounded-full border-2 px-3 py-2',
          'bg-black/80 backdrop-blur-sm shadow-2xl transition-all duration-200',
          !available
            ? 'border-white/15 text-white/35 cursor-not-allowed'
            : playing
              ? 'border-[#FF2E2E] text-white hover:bg-[#FF2E2E]/20'
              : 'border-white/25 text-white/80 hover:border-[#FF2E2E] hover:text-white',
        ].join(' ')}
      >
        <span className="text-lg leading-none" aria-hidden="true">{playing ? '♫' : '🔇'}</span>
        <span className="text-[10px] md:text-xs font-black tracking-widest">
          {!available ? 'NO MUSIC' : playing ? 'MUSIC ON' : 'MUSIC OFF'}
        </span>
      </button>
    </>
  );
}
