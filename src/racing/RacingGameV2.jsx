import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const MOVE_SPEED = 360;
const REVERSE_SPEED = 250;
const MAX_HP = 100;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function hash(seed, n) {
  let x = (seed ^ Math.imul(n + 1, 0x45d9f3b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function traffic(seed, index) {
  const lane = [-1, 0, 1][Math.floor(hash(seed, index * 11 + 3) * 3)];
  const change = hash(seed, index * 13 + 7) > 0.7;
  const dir = hash(seed, index * 17 + 9) > 0.5 ? 1 : -1;
  return {
    id: String(index),
    distance: index * 260 + 120 + hash(seed, index * 19 + 2) * 120,
    lane,
    target: change ? clamp(lane + dir, -1, 1) : lane,
    change,
    baseSpeed: 150 + hash(seed, index * 23 + 4) * 170,
    kind: hash(seed, index * 29 + 5) > 0.82 ? 'truck' : 'car',
  };
}

function score(s) {
  return Math.max(
    0,
    Math.round(
      Math.abs(s.distance) * 8 +
        s.near * 250 +
        s.over * 120 +
        s.comboBest * 180 -
        s.hits * 400
    )
  );
}

function car(ctx, x, y, scale, color, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const w = 36 * scale;
  const h = 66 * scale;

  ctx.fillStyle = '#111';
  ctx.fillRect(-w * 0.62, -h * 0.32, 6 * scale, 18 * scale);
  ctx.fillRect(w * 0.46, -h * 0.32, 6 * scale, 18 * scale);
  ctx.fillRect(-w * 0.62, h * 0.14, 6 * scale, 18 * scale);
  ctx.fillRect(w * 0.46, h * 0.14, 6 * scale, 18 * scale);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 6 * scale);
  ctx.fill();

  ctx.fillStyle = '#9bd3ff';
  ctx.beginPath();
  ctx.roundRect(-w * 0.32, -h * 0.27, w * 0.64, h * 0.24, 4 * scale);
  ctx.fill();

  ctx.restore();
}

export default function RacingGameV2({ initialPlayerName, onBack }) {
  const canvas = useRef(null);
  const raf = useRef(0);
  const last = useRef(0);
  const keys = useRef(new Set());
  const state = useRef(null);
  const joy = useRef({ active: false, x: 0, y: 0, px: 0, py: 0 });

  const [name, setName] = useState(initialPlayerName || '');
  const [phase, setPhase] = useState('menu');
  const [mode, setMode] = useState('single');
  const [hud, setHud] = useState({
    distance: 0,
    score: 0,
    hp: 100,
    near: 0,
    over: 0,
    combo: 0,
    place: 1,
  });
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [matchId, setMatchId] = useState(null);
  const [match, setMatch] = useState(null);
  const [result, setResult] = useState(null);

  const uid = useMemo(() => getUserIdFromName(name), [name]);

  useEffect(() => subscribeToRacingLeaderboard(setRows, () => {}), []);

  const init = useCallback((m, seed) => {
    state.current = {
      running: true,
      seed,
      distance: 0,
      time: 0,
      x: 0,
      hp: 100,
      near: 0,
      over: 0,
      hits: 0,
      combo: 0,
      comboBest: 0,
      seen: new Set(),
      remote: null,
      lastPublish: 0,
      lastHit: 0,
      lastNear: 0,
    };

    keys.current.clear();
    joy.current = { active: false, x: 0, y: 0, px: 0, py: 0 };
    setMode(m);
    setResult(null);
    setPhase('race');
    last.current = performance.now();
  }, []);

  const finishRun = useCallback(
    async (reason) => {
      const s = state.current;
      if (!s || !s.running) return;

      s.running = false;
      const sc = score(s);
      const saved = await saveRacingScore({
        playerName: name.trim(),
        score: sc,
        distance: Math.abs(s.distance),
        nearMisses: s.near,
        overtakes: s.over,
        collisions: s.hits,
      }).catch(() => null);

      if (mode === 'multi' && matchId) {
        await finishMatch(matchId, uid, sc).catch(() => {});
      }

      setResult({
        score: sc,
        distance: Math.round(Math.abs(s.distance)),
        reason,
        saved,
      });
      setPhase('result');
    },
    [matchId, mode, name, uid]
  );

  const single = useCallback(() => {
    if (!name.trim()) return setStatus('Enter your name first.');
    init('single', Math.floor(Math.random() * 0xffffffff));
  }, [init, name]);

  const queue = useCallback(async () => {
    if (!name.trim()) return setStatus('Enter your name first.');
    setMode('multi');
    setPhase('queue');
    setStatus('Searching for a racer...');
    try {
      await queuePlayer(uid, name.trim());
    } catch {
      setStatus('Queue unavailable.');
    }
  }, [name, uid]);

  useEffect(() => {
    if (phase !== 'queue') return undefined;

    let done = false;
    const off = subscribeToQueue(async (q) => {
      if (done) return;

      const opponent = q
        .filter((x) => x?.userId && x.userId !== uid)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];

      if (!opponent) return;

      done = true;
      try {
        const id = await createOrJoinDeterministicMatch(
          uid,
          opponent.userId,
          name.trim(),
          opponent.playerName
        );
        await leaveQueue(uid);
        setMatchId(id);
        setStatus('Opponent found.');
      } catch {
        done = false;
        setStatus('Matchmaking failed.');
      }
    }, () => {});

    return off;
  }, [phase, uid, name]);

  useEffect(() => {
    if (!matchId) return undefined;

    return subscribeToMatch(
      matchId,
      (data) => {
        setMatch(data);
        if (data?.status === 'racing' && !state.current?.running) {
          init('multi', Number(data.seed) || 1);
        }
      },
      () => setStatus('Connection lost.')
    );
  }, [matchId, init]);

  useEffect(() => {
    if (!matchId || !state.current?.running) return;
    publishPlayerState(matchId, uid, {
      ready: true,
      distance: 0,
      lane: 0,
      speed: 0,
      finished: false,
    }).catch(() => {});
  }, [matchId, uid]);

  useEffect(() => {
    if (!match?.states || !state.current) return;
    const opponentId = Object.keys(match.states).find((x) => x !== uid);
    if (opponentId) {
      state.current.remote = { ...match.states[opponentId], userId: opponentId };
    }
  }, [match, uid]);

  useEffect(() => {
    const down = (event) => {
      const key = event.key.toLowerCase();
      if ('wasd'.includes(key)) {
        event.preventDefault();
        keys.current.add(key);
      }
    };

    const up = (event) => {
      const key = event.key.toLowerCase();
      if ('wasd'.includes(key)) {
        event.preventDefault();
        keys.current.delete(key);
      }
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'race') return undefined;

    const c = canvas.current;
    if (!c) return undefined;
    const ctx = c.getContext('2d');

    const resize = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const loop = (now) => {
      const s = state.current;
      if (!s?.running) return;

      const dt = Math.min(0.05, (now - last.current) / 1000 || 0.016);
      last.current = now;
      s.time += dt;

      const w = c.clientWidth;
      const h = c.clientHeight;
      const mobile = w < 850;

      const forward = keys.current.has('w');
      const back = keys.current.has('s');
      const leftKey = keys.current.has('a');
      const rightKey = keys.current.has('d');

      // W/S = direct forward/back movement, A/D = direct left/right movement.
      // Holding combinations gives diagonal movement with no auto-centering.
      let moveX = mobile ? joy.current.x : (rightKey ? 1 : 0) - (leftKey ? 1 : 0);
      let moveY = mobile ? -joy.current.y : (forward ? 1 : 0) - (back ? 1 : 0);

      const len = Math.hypot(moveX, moveY);
      if (len > 1) {
        moveX /= len;
        moveY /= len;
      }

      // Y movement changes the player's actual road position/distance.
      s.distance += moveY * (moveY >= 0 ? MOVE_SPEED : REVERSE_SPEED) * dt;
      s.x = clamp(s.x + moveX * 2.25 * dt, -1.12, 1.12);

      const roadW = Math.min(w * 0.72, 720);
      const laneW = roadW / 3;
      const roadLeft = (w - roadW) / 2;
      const horizon = h * 0.12;
      const playerX = w / 2 + s.x * laneW;
      const playerY = h * 0.78;

      ctx.fillStyle = '#83a75f';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#2e2e2e';
      ctx.fillRect(roadLeft, horizon, roadW, h - horizon);

      ctx.fillStyle = '#f1f1f1';
      ctx.fillRect(roadLeft + 4, horizon, 5, h - horizon);
      ctx.fillRect(roadLeft + roadW - 9, horizon, 5, h - horizon);

      const dash = (Math.abs(s.distance) * 1.1) % 72;
      ctx.fillStyle = '#ddd';
      for (let lane = 1; lane < 3; lane += 1) {
        for (let y = horizon + 20 - dash; y < h; y += 72) {
          ctx.fillRect(roadLeft + lane * laneW - 2, y, 4, 30);
        }
      }

      // Generate traffic continuously around the player's current position.
      // There is deliberately no finish distance: the road continues forever.
      const baseIndex = Math.floor(Math.abs(s.distance) / 260);
      for (let i = Math.max(0, baseIndex - 4); i <= baseIndex + 10; i += 1) {
        const t = traffic(s.seed, i);
        const trafficSpeed = t.baseSpeed;
        const rel = t.distance + trafficSpeed * s.time * 0.45 - Math.abs(s.distance);

        if (rel < -180 || rel > 1400) continue;

        const p = clamp(1 - rel / 1400, 0.08, 1);
        const y = horizon + (h - horizon) * (p * 0.92);

        const progress = t.change
          ? clamp((Math.abs(s.distance) - t.distance + 160) / 150, 0, 1)
          : 0;
        const ease = progress * progress * (3 - 2 * progress);
        const lane = t.lane + (t.target - t.lane) * ease;
        const x = w / 2 + lane * laneW;

        car(
          ctx,
          x,
          y,
          (0.25 + p * 0.8) * (mobile ? 0.9 : 1),
          t.kind === 'truck' ? '#777' : '#d84a4a',
          (t.target - t.lane) * ease * 0.15
        );

        if (t.change && rel < 450 && rel > 0) {
          ctx.fillStyle = '#ffd84d';
          ctx.font = 'bold 11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(t.target > t.lane ? '→ SWITCH' : '← SWITCH', x, y - 32 * p);
        }

        const hit = rel < 105 && rel > -20 && Math.abs(lane - s.x) < 0.25;
        if (hit && now - s.lastHit > 700) {
          s.lastHit = now;
          s.hits += 1;
          s.hp -= t.kind === 'truck' ? 30 : 20;
          s.combo = 0;
        } else if (
          rel < 100 &&
          rel > -5 &&
          Math.abs(lane - s.x) < 0.52 &&
          now - s.lastNear > 600
        ) {
          s.lastNear = now;
          s.near += 1;
          s.combo += 1;
          s.comboBest = Math.max(s.comboBest, s.combo);
        }

        if (rel < -20 && !s.seen.has(t.id)) {
          s.seen.add(t.id);
          s.over += 1;
          s.combo += 1;
          s.comboBest = Math.max(s.comboBest, s.combo);
        }
      }

      if (mode === 'multi' && s.remote) {
        const gap = (Number(s.remote.distance) || 0) - s.distance;
        const remoteLane = Number(s.remote.lane) || 0;
        if (gap > -90 && gap < 160 && Math.abs(remoteLane - s.x) < 0.25) {
          s.hits += 1;
          s.hp -= 8;
          s.combo = 0;
        }
      }

      car(ctx, playerX, playerY, 1.15, '#ff2e2e', s.x * -0.08);

      s.hp = clamp(s.hp, 0, MAX_HP);
      const place =
        mode === 'multi' &&
        s.remote &&
        (Number(s.remote.distance) || 0) > s.distance
          ? 2
          : 1;

      setHud({
        distance: Math.round(Math.abs(s.distance)),
        score: score(s),
        hp: Math.round(s.hp),
        near: s.near,
        over: s.over,
        combo: Math.floor(s.combo),
        place,
      });

      if (mode === 'multi' && matchId && now - s.lastPublish > 120) {
        s.lastPublish = now;
        publishPlayerState(matchId, uid, {
          ready: true,
          distance: Math.round(s.distance),
          lane: s.x,
          speed: moveY * (moveY >= 0 ? MOVE_SPEED : REVERSE_SPEED),
          finished: false,
        }).catch(() => {});
      }

      if (s.hp <= 0) {
        finishRun('WRECKED');
        return;
      }

      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', resize);
    };
  }, [finishRun, matchId, mode, phase, uid]);

  const touch = (event) => {
    const r = event.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = r.width * 0.38;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const f = Math.min(1, max / len);

    joy.current.x = (dx * f) / max;
    joy.current.y = (dy * f) / max;
    joy.current.px = dx * f;
    joy.current.py = dy * f;
  };

  if (phase === 'queue') {
    return (
      <div className="min-h-screen bg-[#111] text-white grid place-items-center p-5">
        <div className="text-center">
          <div className="text-[#43D17A] text-xs font-black tracking-[.3em]">MULTIPLAYER QUEUE</div>
          <h1 className="text-4xl font-black mt-2">WAITING FOR RACER</h1>
          <p className="text-[#888] mt-3">{status}</p>
          <button
            onClick={() => {
              leaveQueue(uid).catch(() => {});
              setPhase('menu');
              setMode('single');
            }}
            className="mt-6 border border-[#555] rounded-lg px-5 py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="min-h-screen bg-[#111] text-white grid place-items-center p-5">
        <div className="w-full max-w-2xl rounded-2xl border border-[#333] bg-[#191919] p-8 text-center">
          <div className="text-[#43D17A] text-xs font-black tracking-[.3em]">RACE ENDED</div>
          <h1 className="text-5xl font-black mt-2">{result?.reason}</h1>
          <div className="text-6xl font-black mt-6 text-[#FFD84D]">
            {Number(result?.score || 0).toLocaleString()}
          </div>
          <p className="text-[#888] mt-2">
            {Number(result?.distance || 0).toLocaleString()} m traveled
          </p>
          {result?.saved && (
            <div className="text-[#43D17A] mt-4 font-bold">New racing record saved!</div>
          )}
          <div className="flex gap-3 justify-center mt-7">
            <button
              onClick={() => setPhase('menu')}
              className="border border-[#555] rounded-lg px-5 py-3"
            >
              Back
            </button>
            <button
              onClick={mode === 'single' ? single : queue}
              className="bg-[#FF2E2E] rounded-lg px-5 py-3 font-black"
            >
              Race Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-white">
      <header className="border-b-2 border-[#FF2E2E] px-5 py-4 flex justify-between">
        <button onClick={onBack} className="text-[#aaa] font-bold">NINU GAMING</button>
        <b className="text-[#43D17A] tracking-[.2em]">INFINITE RUSH</b>
        <span className="text-xs text-[#777]">INFINITE ROAD</span>
      </header>

      <main className="max-w-6xl mx-auto p-5 md:p-8">
        <div className="grid md:grid-cols-[1.1fr_.9fr] gap-5">
          <section className="rounded-2xl border border-[#333] bg-[#191919] p-6">
            <div className="text-xs font-black tracking-[.3em] text-[#43D17A]">RACING</div>
            <h1 className="text-5xl font-black mt-2">INFINITE RUSH</h1>
            <p className="text-[#999] mt-3">
              Infinite straight highway. W/S move forward and backward. A/D move left and right.
              Combine them for diagonal movement.
            </p>

            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 32))}
              placeholder="Player name"
              className="mt-6 w-full bg-[#101010] border border-[#444] focus:border-[#43D17A] outline-none rounded-lg px-4 py-3"
            />

            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <button
                onClick={single}
                className="rounded-xl border border-[#43D17A] p-4 text-left"
              >
                <b className="text-[#43D17A]">SINGLE PLAYER</b>
                <div className="font-black text-xl mt-1">Chase a record</div>
              </button>
              <button
                onClick={queue}
                className="rounded-xl border border-[#FF2E2E] p-4 text-left"
              >
                <b className="text-[#FF2E2E]">MULTIPLAYER</b>
                <div className="font-black text-xl mt-1">Find a rival</div>
              </button>
            </div>

            {status && <div className="text-[#FF7777] text-sm mt-3">{status}</div>}
          </section>

          <section className="rounded-2xl border border-[#333] bg-[#191919] p-6">
            <b>RACING LEADERBOARD</b>
            <div className="space-y-1 mt-3 max-h-96 overflow-auto">
              {rows.slice(0, 25).map((r, i) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[35px_1fr_100px] bg-[#222] rounded px-3 py-2"
                >
                  <span className="text-[#777]">{i + 1}</span>
                  <span>{r.playerName}</span>
                  <b className="text-right text-[#FFD84D]">
                    {Number(r.score || 0).toLocaleString()}
                  </b>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {phase === 'race' && (
        <div className="fixed inset-0 bg-[#101010]">
          <canvas ref={canvas} className="w-full h-full block touch-none" />

          <div className="absolute top-3 left-3 right-3 grid grid-cols-3 gap-2 pointer-events-none">
            <div className="bg-black/60 rounded-lg p-2">
              <small>DISTANCE</small>
              <b className="block text-xl">{hud.distance}m</b>
            </div>
            <div className="bg-black/60 rounded-lg p-2 text-center">
              <small>{mode === 'multi' ? 'POSITION' : 'SINGLE'}</small>
              <b className="block text-xl">
                {mode === 'multi' ? (hud.place === 1 ? '1ST' : '2ND') : 'SOLO'}
              </b>
            </div>
            <div className="bg-black/60 rounded-lg p-2 text-right">
              <small>SCORE</small>
              <b className="block text-xl text-[#FFD84D]">{hud.score.toLocaleString()}</b>
            </div>
          </div>

          <div className="absolute bottom-3 left-3 bg-black/60 rounded-lg p-2 text-xs pointer-events-none">
            HP {hud.hp}% · Near {hud.near} · Overtakes {hud.over} · Combo {hud.combo}
          </div>

          {typeof window !== 'undefined' && window.innerWidth < 850 ? (
            <div
              onPointerDown={(e) => {
                joy.current.active = true;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                touch(e);
              }}
              onPointerMove={(e) => joy.current.active && touch(e)}
              onPointerUp={() => {
                joy.current.active = false;
                joy.current.x = 0;
                joy.current.y = 0;
                joy.current.px = 0;
                joy.current.py = 0;
              }}
              onPointerCancel={() => {
                joy.current.active = false;
                joy.current.x = 0;
                joy.current.y = 0;
                joy.current.px = 0;
                joy.current.py = 0;
              }}
              className="absolute left-5 bottom-5 w-36 h-36 rounded-full border-2 border-white/25 bg-black/30 touch-none"
              style={{ touchAction: 'none' }}
            >
              <div
                className="absolute left-1/2 top-1/2 w-16 h-16 rounded-full bg-white/20 border border-white/50"
                style={{
                  transform: `translate(calc(-50% + ${joy.current.px}px),calc(-50% + ${joy.current.py}px))`,
                }}
              />
            </div>
          ) : (
            <div className="absolute bottom-4 right-4 bg-black/65 rounded-lg p-3 text-xs">
              W = FORWARD<br />
              S = BACKWARD<br />
              A = LEFT<br />
              D = RIGHT<br />
              W+A / W+D = DIAGONAL
            </div>
          )}
        </div>
      )}
    </div>
  );
}
