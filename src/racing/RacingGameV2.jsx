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

const PLAYER_SPEED = 340;
const TURN_RATE = 9; // radians/sec, how fast the car visually turns to face travel direction
const MAX_HP = 100;
const FIELD_W = 2600;
const FIELD_H = 2600;
const PLAYER_RADIUS = 22;
const NPC_RADIUS = 24;
const NPC_COUNT = 12;
const NEAR_RADIUS_MULT = 2.3;
const HIT_COOLDOWN_MS = 700;
const NEAR_COOLDOWN_MS = 500;
const REMOTE_HIT_COOLDOWN_MS = 700;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function hash(seed, n) {
  let x = (seed ^ Math.imul(n + 1, 0x45d9f3b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// Turns `current` toward `target` (both radians) by at most `maxDelta`,
// always taking the shorter way around the circle.
function turnToward(current, target, maxDelta) {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + clamp(diff, -maxDelta, maxDelta);
}

// A persistent pool of traffic cars scattered across the whole field. They
// never get spawned/despawned as the player moves - they exist for the
// entire race and just roam, so they can't "disappear and not come back".
function makeNpc(seed, index) {
  return {
    id: String(index),
    x: NPC_RADIUS * 2 + hash(seed, index * 11 + 2) * (FIELD_W - NPC_RADIUS * 4),
    y: NPC_RADIUS * 2 + hash(seed, index * 13 + 3) * (FIELD_H - NPC_RADIUS * 4),
    angle: hash(seed, index * 7 + 1) * Math.PI * 2,
    speed: 70 + hash(seed, index * 17 + 4) * 110,
    kind: hash(seed, index * 29 + 5) > 0.8 ? 'truck' : 'car',
    turnAt: 1.5 + hash(seed, index * 23 + 6) * 3,
    wasNear: false,
  };
}

// Simple wandering logic: drive in the current direction, occasionally pick
// a new one, and bounce off the field boundary instead of vanishing.
function stepNpc(npc, dt) {
  npc.turnAt -= dt;
  if (npc.turnAt <= 0) {
    npc.angle += (Math.random() - 0.5) * 2.4;
    npc.turnAt = 1.5 + Math.random() * 3;
  }

  npc.x += Math.cos(npc.angle) * npc.speed * dt;
  npc.y += Math.sin(npc.angle) * npc.speed * dt;

  if (npc.x < NPC_RADIUS) {
    npc.x = NPC_RADIUS;
    npc.angle = Math.PI - npc.angle;
  } else if (npc.x > FIELD_W - NPC_RADIUS) {
    npc.x = FIELD_W - NPC_RADIUS;
    npc.angle = Math.PI - npc.angle;
  }

  if (npc.y < NPC_RADIUS) {
    npc.y = NPC_RADIUS;
    npc.angle = -npc.angle;
  } else if (npc.y > FIELD_H - NPC_RADIUS) {
    npc.y = FIELD_H - NPC_RADIUS;
    npc.angle = -npc.angle;
  }
}

function score(s) {
  return Math.max(
    0,
    Math.round(
      s.traveled * 8 +
        s.near * 250 +
        s.over * 160 +
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

  const init = useCallback((m, seed, spawn) => {
    const npcs = [];
    for (let i = 0; i < NPC_COUNT; i += 1) npcs.push(makeNpc(seed, i));

    state.current = {
      running: true,
      seed,
      x: spawn?.x ?? FIELD_W / 2,
      y: spawn?.y ?? FIELD_H / 2,
      angle: -Math.PI / 2,
      traveled: 0,
      hp: 100,
      near: 0,
      over: 0,
      hits: 0,
      combo: 0,
      comboBest: 0,
      npcs,
      remote: null,
      lastPublish: 0,
      lastHit: 0,
      lastNear: 0,
      lastRemoteHit: 0,
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
        distance: Math.round(s.traveled),
        nearMisses: s.near,
        overtakes: s.over,
        collisions: s.hits,
      }).catch(() => null);

      if (mode === 'multi' && matchId) {
        await finishMatch(matchId, uid, sc).catch(() => {});
      }

      setResult({
        score: sc,
        distance: Math.round(s.traveled),
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
          // Give each racer their own starting corner of the field so they
          // don't spawn on top of each other. Sorting the player ids keeps
          // this deterministic and consistent on both clients.
          const ids = Object.keys(data.players || {}).sort();
          const spawn =
            ids[0] === uid
              ? { x: FIELD_W * 0.3, y: FIELD_H * 0.5 }
              : { x: FIELD_W * 0.7, y: FIELD_H * 0.5 };
          init('multi', Number(data.seed) || 1, spawn);
        }
      },
      () => setStatus('Connection lost.')
    );
  }, [matchId, init, uid]);

  useEffect(() => {
    if (!matchId || !state.current?.running) return;
    publishPlayerState(matchId, uid, {
      ready: true,
      distance: 0,
      lane: 0,
      speed: 0,
      finished: false,
      traveled: 0,
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

      const w = c.clientWidth;
      const h = c.clientHeight;
      const mobile = w < 850;

      const forward = keys.current.has('w');
      const back = keys.current.has('s');
      const leftKey = keys.current.has('a');
      const rightKey = keys.current.has('d');

      // Free movement: WASD / the joystick set a direction vector and the
      // car drives that way across the open field - any direction, not just
      // forward/back on a single line.
      let moveX = mobile ? joy.current.x : (rightKey ? 1 : 0) - (leftKey ? 1 : 0);
      let moveY = mobile ? -joy.current.y : (forward ? 1 : 0) - (back ? 1 : 0);

      const inputLen = Math.hypot(moveX, moveY);
      if (inputLen > 1) {
        moveX /= inputLen;
        moveY /= inputLen;
      }

      if (inputLen > 0.02) {
        const targetAngle = Math.atan2(moveY, moveX);
        s.angle = turnToward(s.angle, targetAngle, TURN_RATE * dt);
        s.x = clamp(s.x + moveX * PLAYER_SPEED * dt, PLAYER_RADIUS, FIELD_W - PLAYER_RADIUS);
        s.y = clamp(s.y + moveY * PLAYER_SPEED * dt, PLAYER_RADIUS, FIELD_H - PLAYER_RADIUS);
        s.traveled += inputLen * PLAYER_SPEED * dt;
      }

      // Camera follows the player, so the field scrolls beneath the car
      // however it drives instead of the car being locked to one axis.
      const camX = s.x;
      const camY = s.y;
      const toScreenX = (wx) => w / 2 + (wx - camX);
      const toScreenY = (wy) => h / 2 + (wy - camY);

      ctx.fillStyle = '#3c5c33';
      ctx.fillRect(0, 0, w, h);

      const fieldLeft = toScreenX(0);
      const fieldTop = toScreenY(0);
      ctx.fillStyle = '#6b8f4e';
      ctx.fillRect(fieldLeft, fieldTop, FIELD_W, FIELD_H);

      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      const grid = 160;
      for (let gx = 0; gx <= FIELD_W; gx += grid) {
        ctx.beginPath();
        ctx.moveTo(toScreenX(gx), toScreenY(0));
        ctx.lineTo(toScreenX(gx), toScreenY(FIELD_H));
        ctx.stroke();
      }
      for (let gy = 0; gy <= FIELD_H; gy += grid) {
        ctx.beginPath();
        ctx.moveTo(toScreenX(0), toScreenY(gy));
        ctx.lineTo(toScreenX(FIELD_W), toScreenY(gy));
        ctx.stroke();
      }

      ctx.strokeStyle = '#caa15a';
      ctx.lineWidth = 10;
      ctx.strokeRect(fieldLeft, fieldTop, FIELD_W, FIELD_H);

      // Traffic: a fixed pool of cars that roams the whole field for the
      // entire race (see stepNpc) and collides using real 2D distance, so
      // hits register reliably instead of only along a single lane band.
      s.npcs.forEach((npc) => {
        stepNpc(npc, dt);

        const dist = Math.hypot(npc.x - s.x, npc.y - s.y);
        const hitRadius = PLAYER_RADIUS + NPC_RADIUS;
        const nearRadius = hitRadius * NEAR_RADIUS_MULT;

        if (dist < hitRadius && now - s.lastHit > HIT_COOLDOWN_MS) {
          s.lastHit = now;
          s.hits += 1;
          s.hp -= npc.kind === 'truck' ? 30 : 20;
          s.combo = 0;
          const nx = (s.x - npc.x) / (dist || 1);
          const ny = (s.y - npc.y) / (dist || 1);
          s.x = clamp(s.x + nx * 26, PLAYER_RADIUS, FIELD_W - PLAYER_RADIUS);
          s.y = clamp(s.y + ny * 26, PLAYER_RADIUS, FIELD_H - PLAYER_RADIUS);
        } else if (dist < nearRadius && now - s.lastNear > NEAR_COOLDOWN_MS) {
          s.lastNear = now;
          s.near += 1;
          s.combo += 1;
          s.comboBest = Math.max(s.comboBest, s.combo);
        }

        if (npc.wasNear && dist >= nearRadius) {
          s.over += 1;
          s.combo += 1;
          s.comboBest = Math.max(s.comboBest, s.combo);
        }
        npc.wasNear = dist < nearRadius;

        const sx = toScreenX(npc.x);
        const sy = toScreenY(npc.y);
        if (sx > -60 && sx < w + 60 && sy > -60 && sy < h + 60) {
          car(ctx, sx, sy, mobile ? 0.95 : 1, npc.kind === 'truck' ? '#777' : '#d84a4a', npc.angle + Math.PI / 2);
        }
      });

      // Opponent car in multiplayer, drawn on the same shared field (it was
      // never rendered before, which made multiplayer feel broken).
      let remoteTraveled = 0;
      if (mode === 'multi' && s.remote) {
        const remoteX = clamp(((Number(s.remote.lane) || 0) + 2) / 4, 0, 1) * FIELD_W;
        const remoteY = clamp(Number(s.remote.distance) || 0, 0, FIELD_H);
        remoteTraveled = Number(s.remote.traveled) || 0;

        const dist = Math.hypot(remoteX - s.x, remoteY - s.y);
        const hitRadius = PLAYER_RADIUS * 2;
        if (dist < hitRadius && now - s.lastRemoteHit > REMOTE_HIT_COOLDOWN_MS) {
          s.lastRemoteHit = now;
          s.hits += 1;
          s.hp -= 8;
          s.combo = 0;
        }

        car(ctx, toScreenX(remoteX), toScreenY(remoteY), 1.1, '#2e6bff', 0);
      }

      car(ctx, w / 2, h / 2, 1.15, '#ff2e2e', s.angle + Math.PI / 2);

      s.hp = clamp(s.hp, 0, MAX_HP);
      const place = mode === 'multi' && s.remote && remoteTraveled > s.traveled ? 2 : 1;

      setHud({
        distance: Math.round(s.traveled),
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
          distance: clamp(s.y, 0, FIELD_H),
          lane: clamp((s.x / FIELD_W) * 4 - 2, -2, 2),
          speed: clamp(Math.round(inputLen > 0.02 ? PLAYER_SPEED : 0), 0, 2000),
          finished: false,
          traveled: s.traveled,
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
        <span className="text-xs text-[#777]">OPEN FIELD</span>
      </header>

      <main className="max-w-6xl mx-auto p-5 md:p-8">
        <div className="grid md:grid-cols-[1.1fr_.9fr] gap-5">
          <section className="rounded-2xl border border-[#333] bg-[#191919] p-6">
            <div className="text-xs font-black tracking-[.3em] text-[#43D17A]">RACING</div>
            <h1 className="text-5xl font-black mt-2">INFINITE RUSH</h1>
            <p className="text-[#999] mt-3">
              Drive freely around an open field. WASD moves the car in any direction you point
              it - combine keys for diagonals. Dodge or ram the traffic roaming the field.
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
              W = UP<br />
              S = DOWN<br />
              A = LEFT<br />
              D = RIGHT<br />
              COMBINE KEYS = DIAGONAL
            </div>
          )}
        </div>
      )}
    </div>
  );
}
