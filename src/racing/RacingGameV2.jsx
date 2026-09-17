import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MountainTrack } from './engine/Track';
import { WorldBuilder } from './engine/World';
import { createCar, CarPhysics, TOTAL_LAPS } from './engine/Car';
import { AIController } from './engine/AI';
import { InputManager } from './engine/Input';
import { ChaseCamera } from './engine/Camera';
import {
  createOrJoinDeterministicMatch,
  finishMatch,
  getUserIdFromName,
  leaveQueue,
  publishPlayerState,
  queuePlayer,
  saveRacingScore,
  subscribeToMatch,
  subscribeToQueue,
  subscribeToRacingLeaderboard,
} from '../utils/racingService';

// This replaces the old open-field traffic-dodging RacingGameV2 with a full
// 3D mountain circuit (lap racing against AI, plus 1v1 realtime multiplayer).
// It's a different genre from the old game, so "collisions"/"nearMisses"
// below are honest proxies rather than literal car-to-car hits:
//   score      -> placement + pace based, or raw distance if you don't finish
//   distance   -> actual meters driven around the 7km circuit
//   nearMisses -> close passes with an AI car (single) or the opponent (multi)
//   overtakes  -> number of times your race position improved
//   collisions -> number of distinct off-road excursions
// The racingLeaderboard/racingQueue/racingMatches Firebase schema and the
// saveRacingScore() call signature are unchanged, so the existing ranking
// system and its Firebase rules keep working as-is.

const AI_COLORS = ['#ff3d88', '#ffa63d', '#b07cff', '#68ff88', '#ff5d52'];
const NEAR_MISS_DIST = 9;
const NEAR_MISS_COOLDOWN_MS = 600;
const OFFTRACK_COOLDOWN_MS = 800;

function isTouchDevice() {
  return (typeof window !== 'undefined' && window.matchMedia?.('(pointer:coarse)').matches) || 'ontouchstart' in window;
}

export default function RacingGameV2({ initialPlayerName, onBack }) {
  const mountRef = useRef(null);
  const canvasRef = useRef(null);
  const speedRef = useRef(null);
  const lapRef = useRef(null);
  const posRef = useRef(null);
  const timeRef = useRef(null);

  const engine = useRef(null); // holds all the three.js/game-loop state for this mount
  const raceState = useRef(null); // { near, over, hits, lastPlace, lastNear, lastOffTrack, raceClock }

  const [name, setName] = useState(initialPlayerName || '');
  const [phase, setPhase] = useState('menu'); // menu | queue | race | result
  const [mode, setMode] = useState('single');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [rows, setRows] = useState([]);
  const [matchId, setMatchId] = useState(null);
  const [touch] = useState(isTouchDevice);

  const uid = useMemo(() => getUserIdFromName(name), [name]);

  useEffect(() => subscribeToRacingLeaderboard(setRows, () => {}), []);

  // ---- three.js engine lifecycle: boot once when we enter the race phase, tear down fully on exit ----
  useEffect(() => {
    if (phase !== 'race' || !canvasRef.current) return undefined;
    let cancelled = false;
    let raf = 0;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: !touch, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !touch;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050910);
    scene.fog = new THREE.FogExp2(0x050910, 0.00145);
    const camera = new THREE.PerspectiveCamera(64, 1, 0.1, touch ? 1500 : 1600);

    const quality = touch
      ? { shadows: false, shadowMapSize: 1024, decorScale: 0.55 }
      : { shadows: true, shadowMapSize: 2048, decorScale: 1 };

    const track = new MountainTrack(scene, quality);
    const world = new WorldBuilder(scene, track, quality);
    world.addBase();

    const input = new InputManager(renderer.domElement);
    const chase = new ChaseCamera(camera, track, input);
    input.cameraProxy = chase;

    const playerMesh = createCar('#19d3ff', name.trim() || 'Racer');
    scene.add(playerMesh);
    const player = new CarPhysics(playerMesh, track);
    player.reset(0);

    const ai = [];
    if (mode === 'single') {
      for (let i = 0; i < 5; i += 1) {
        const mesh = createCar(AI_COLORS[i % AI_COLORS.length], `AI-${i + 1}`);
        scene.add(mesh);
        const controller = new AIController(mesh, track, i + 1);
        controller.init();
        ai.push(controller);
      }
    }

    // Opponent car for multiplayer, filled in as state comes over Firebase.
    let opponentMesh = null;
    if (mode === 'multi') {
      opponentMesh = createCar('#ff914d', 'Opponent');
      opponentMesh.visible = false;
      scene.add(opponentMesh);
    }

    raceState.current = { near: 0, over: 0, hits: 0, lastPlace: 1, lastNearAt: 0, lastOffTrackAt: 0, offTrack: false, raceClock: 0, finished: false };

    function resize() {
      const el = mountRef.current;
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    const clock = new THREE.Clock();
    let lastPublish = 0;

    function place() {
      const others = mode === 'single'
        ? ai.map((a) => a.distance)
        : opponentMesh?.visible ? [opponentMesh.userData.distance || 0] : [];
      return 1 + others.filter((d) => d >= player.distance + 0.0001).length;
    }

    function finish(reason) {
      if (raceState.current.finished) return;
      raceState.current.finished = true;
      const rs = raceState.current;
      const distanceMeters = Math.round(player.distance * track.length);
      const p = place();
      let score;
      if (reason === 'finished') {
        score = Math.max(0, Math.round(30000 - rs.raceClock * 8 - p * 400));
      } else {
        // Didn't finish (left the race) - score from ground covered instead.
        score = distanceMeters;
      }
      saveRacingScore({
        playerName: name.trim(),
        score,
        distance: distanceMeters,
        nearMisses: rs.near,
        overtakes: rs.over,
        collisions: rs.hits,
      }).then((saved) => {
        if (cancelled) return;
        if (mode === 'multi' && matchId) finishMatch(matchId, uid, score).catch(() => {});
        setResult({ score, distance: distanceMeters, place: p, reason, saved: !!saved });
        setPhase('result');
      }).catch(() => {
        if (cancelled) return;
        setResult({ score, distance: distanceMeters, place: p, reason, saved: false });
        setPhase('result');
      });
    }
    engine.current = {
      finish,
      applyOpponent(s) {
        if (!opponentMesh || !s) return;
        opponentMesh.visible = true;
        opponentMesh.position.set(s.x ?? opponentMesh.position.x, typeof s.y === 'number' ? s.y : 0.65, s.z ?? opponentMesh.position.z);
        opponentMesh.rotation.y = s.yaw || 0;
        opponentMesh.userData.distance = s.distance || 0;
        opponentMesh.userData.finished = !!s.finished;
      },
    };

    function loop() {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.04);
      const rs = raceState.current;

      if (!rs.finished) {
        rs.raceClock += dt;
        const wasOffTrack = player.offTrack;
        player.update(dt, input.state);
        if (player.offTrack && !wasOffTrack) {
          const now = performance.now();
          if (now - rs.lastOffTrackAt > OFFTRACK_COOLDOWN_MS) { rs.hits += 1; rs.lastOffTrackAt = now; }
        }

        if (mode === 'single') ai.forEach((a) => a.update(dt));

        // Near-miss + overtake tracking against whichever opponents exist.
        const opponents = mode === 'single' ? ai.map((a) => a.mesh) : (opponentMesh?.visible ? [opponentMesh] : []);
        const now = performance.now();
        for (const om of opponents) {
          if (playerMesh.position.distanceTo(om.position) < NEAR_MISS_DIST && now - rs.lastNearAt > NEAR_MISS_COOLDOWN_MS) {
            rs.near += 1; rs.lastNearAt = now;
          }
        }
        const currentPlace = place();
        if (currentPlace < rs.lastPlace) rs.over += currentPlace <= rs.lastPlace - 1 ? rs.lastPlace - currentPlace : 0;
        rs.lastPlace = currentPlace;

        if (player.finished) finish('finished');

        if (speedRef.current) speedRef.current.textContent = String(Math.round(Math.max(0, player.speed) * 3.6));
        if (lapRef.current) lapRef.current.textContent = `LAP ${Math.min(player.lap, TOTAL_LAPS)}/${TOTAL_LAPS}`;
        if (posRef.current) posRef.current.textContent = `${currentPlace}${currentPlace === 1 ? 'ST' : currentPlace === 2 ? 'ND' : currentPlace === 3 ? 'RD' : 'TH'}`;
        if (timeRef.current) timeRef.current.textContent = rs.raceClock.toFixed(1) + 's';

        if (mode === 'multi' && matchId) {
          const t = performance.now();
          if (t - lastPublish > 150) {
            lastPublish = t;
            // The existing racingMatches security rules require this exact
            // set of fields (ready/lane/speed/distance/finished/userId) with
            // speed >= 0 - preserving that shape here (lane is unused by
            // this game but required by the rule, so it's just sent as 0,
            // and speed is clamped since this car can reverse). x/y/z/yaw
            // are extra fields for actual 3D positioning, which the rule
            // permits alongside the required ones.
            publishPlayerState(matchId, uid, {
              ready: true,
              lane: 0,
              distance: player.distance,
              speed: Math.max(0, player.speed),
              finished: player.finished,
              x: playerMesh.position.x, y: playerMesh.position.y, z: playerMesh.position.z, yaw: player.yaw,
            }).catch(() => {});
          }
        }
      }

      chase.update(dt, player);
      renderer.render(scene, camera);
    }
    loop();

    const ro = new ResizeObserver(resize);
    if (mountRef.current) ro.observe(mountRef.current);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      input.destroy();
      renderer.dispose();
      scene.traverse((obj) => {
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
        else obj.material?.dispose?.();
      });
      engine.current = null;
    };
    // Intentionally only re-run when we (re)enter the race phase for a given mode/match,
    // not on every name/matchId churn - the engine reads `name`/`matchId` via closures
    // that are fixed for the lifetime of one race.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---- opponent state relay for multiplayer ----
  useEffect(() => {
    if (!matchId || mode !== 'multi') return undefined;
    return subscribeToMatch(matchId, (data) => {
      const opp = Object.entries(data?.states || {}).find(([id]) => id !== uid)?.[1];
      engine.current?.applyOpponent(opp);
    }, () => setStatus('Connection lost.'));
  }, [matchId, mode, uid]);

  const single = useCallback(() => {
    if (!name.trim()) { setStatus('Enter your name first.'); return; }
    setMode('single');
    setResult(null);
    setPhase('race');
  }, [name]);

  const queue = useCallback(async () => {
    if (!name.trim()) { setStatus('Enter your name first.'); return; }
    setMode('multi');
    setPhase('queue');
    setStatus('Searching for a racer...');
    try { await queuePlayer(uid, name.trim()); } catch { setStatus('Queue unavailable.'); }
  }, [name, uid]);

  useEffect(() => {
    if (phase !== 'queue') return undefined;
    let done = false;
    const off = subscribeToQueue(async (q) => {
      if (done) return;
      const opponent = q.filter((x) => x?.userId && x.userId !== uid).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
      if (!opponent) return;
      done = true;
      try {
        const id = await createOrJoinDeterministicMatch(uid, opponent.userId, name.trim(), opponent.playerName);
        await leaveQueue(uid);
        setMatchId(id);
        setStatus('Opponent found - starting...');
        setResult(null);
        setPhase('race');
      } catch {
        done = false;
        setStatus('Matchmaking failed.');
      }
    }, () => {});
    return off;
  }, [phase, uid, name]);

  const cancelQueue = useCallback(() => {
    leaveQueue(uid).catch(() => {});
    setPhase('menu');
  }, [uid]);

  const backToMenu = useCallback(() => {
    if (matchId) leaveQueue(uid).catch(() => {});
    setMatchId(null);
    setPhase('menu');
  }, [matchId, uid]);

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none">
      {phase === 'race' && (
        <div ref={mountRef} className="absolute inset-0">
          <canvas ref={canvasRef} className="w-full h-full block" />
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none font-bold tracking-wide text-sm">
            <div>NEON MOUNTAIN RACER</div>
            <div className="flex gap-3">
              <span ref={lapRef}>LAP 1/{TOTAL_LAPS}</span>
              <span ref={posRef}>1ST</span>
              <span ref={timeRef}>0.0s</span>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 pointer-events-none">
            <b ref={speedRef} className="text-4xl">0</b><small className="ml-1">KM/H</small>
          </div>
          <button
            onClick={() => { engine.current?.finish('left'); }}
            className="absolute top-3 right-3 md:right-24 text-xs border border-white/40 rounded px-3 py-1.5 pointer-events-auto"
          >EXIT</button>
          {touch && (
            <div className="absolute inset-x-0 bottom-0 flex justify-between px-4 pb-4 pointer-events-none">
              <div className="flex gap-3 pointer-events-auto">
                <button data-control="left" className="w-16 h-16 rounded-full bg-white/15 text-2xl">◀</button>
                <button data-control="right" className="w-16 h-16 rounded-full bg-white/15 text-2xl">▶</button>
              </div>
              <div className="flex gap-3 items-end pointer-events-auto">
                <button data-control="handbrake" className="w-16 h-16 rounded-full bg-white/15 text-xs font-bold">DRIFT</button>
                <button data-control="brake" className="w-16 h-16 rounded-full bg-white/15 text-xs font-bold">BRAKE</button>
                <button data-control="boost" className="w-16 h-16 rounded-full bg-white/15 text-xs font-bold">BOOST</button>
                <button data-control="gas" className="w-20 h-20 rounded-full bg-[#19d3ff]/30 text-xs font-bold">GAS</button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'menu' && (
        <div className="h-full flex flex-col items-center justify-center gap-4 px-6">
          <h1 className="text-3xl font-black tracking-wide">NEON <span className="text-[#19d3ff]">MOUNTAIN</span> RACER</h1>
          <p className="text-white/60 text-sm">7 KM mountain circuit • 3 laps • AI or 1v1</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="Your name"
            className="bg-white/10 border border-white/30 rounded px-4 py-2 text-center w-64"
          />
          {status && <div className="text-[#ff914d] text-sm">{status}</div>}
          <button onClick={single} className="w-64 py-3 rounded-lg bg-[#19d3ff] text-black font-bold">SINGLE PLAYER</button>
          <button onClick={queue} className="w-64 py-3 rounded-lg border-2 border-[#19d3ff] font-bold">FIND 1v1 RACE</button>
          <button onClick={() => setShowLeaderboard(true)} className="w-64 py-3 rounded-lg border border-white/30 font-bold">LEADERBOARD</button>
          <button onClick={onBack} className="text-white/50 text-sm mt-2">← NINU GAMING</button>
        </div>
      )}

      {phase === 'queue' && (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <div className="animate-pulse text-lg font-bold">{status || 'Searching for a racer...'}</div>
          <button onClick={cancelQueue} className="px-6 py-2 rounded border border-white/30">CANCEL</button>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="h-full flex flex-col items-center justify-center gap-3 px-6">
          <h2 className="text-2xl font-black">{result.reason === 'finished' ? 'RACE COMPLETE' : 'RACE ENDED'}</h2>
          <div className="text-white/80">Score: <b>{result.score}</b> • Distance: <b>{result.distance}m</b> • Place: <b>{result.place}</b></div>
          {!result.saved && <div className="text-[#ff914d] text-xs">Score could not be saved to the leaderboard.</div>}
          <div className="flex gap-3 mt-2">
            <button onClick={mode === 'single' ? single : queue} className="px-6 py-2 rounded bg-[#19d3ff] text-black font-bold">RACE AGAIN</button>
            <button onClick={backToMenu} className="px-6 py-2 rounded border border-white/30">MENU</button>
          </div>
        </div>
      )}

      {showLeaderboard && (
        <div className="fixed inset-0 z-40 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/20">
            <h2 className="font-bold tracking-wide">RACING LEADERBOARD</h2>
            <button onClick={() => setShowLeaderboard(false)} className="text-sm border border-white/30 rounded-full px-4 py-1.5">Close</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {rows.length === 0 && <div className="text-white/50 text-sm">No races yet.</div>}
            {rows.map((r, i) => (
              <div key={r.id || r.userId} className="flex justify-between py-2 border-b border-white/10 text-sm">
                <span>{i + 1}. {r.playerName}</span>
                <span className="text-[#19d3ff] font-bold">{r.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
