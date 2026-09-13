import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createOrJoinDeterministicMatch,
  finishMatch,
  getUserIdFromName,
  leaveQueue,
  publishPlayerState,
  queuePlayer,
  saveRacingScore,
  startMatchIfReady,
  subscribeToMatch,
  subscribeToQueue,
  subscribeToRacingLeaderboard,
} from '../utils/racingService';

const LANES = [-1, 0, 1];
const MAX_HEALTH = 100;
const TARGET_DISTANCE = 20000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function seeded(seed, n) {
  let x = (seed ^ Math.imul(n + 1, 0x45d9f3b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function trafficForDistance(seed, distance) {
  const segment = Math.floor(distance / 180);
  const items = [];
  for (let i = segment - 1; i <= segment + 4; i += 1) {
    if (i < 0) continue;
    const r = seeded(seed, i * 17 + 3);
    if (r < 0.34) continue;
    const baseLane = LANES[Math.floor(seeded(seed, i * 19 + 8) * 3)];
    const speed = 170 + seeded(seed, i * 23 + 11) * 220;
    const switchRoll = seeded(seed, i * 29 + 15);
    const changing = switchRoll > 0.68;
    const direction = seeded(seed, i * 31 + 21) > 0.5 ? 1 : -1;
    const targetLane = changing ? clamp(baseLane + direction, -1, 1) : baseLane;
    items.push({
      id: `${i}`,
      distance: i * 180 + 75 + seeded(seed, i * 37 + 29) * 90,
      lane: baseLane,
      targetLane,
      changing,
      switchDistance: i * 180 + 105,
      speed,
      angle: changing ? direction * 9 : 0,
      kind: seeded(seed, i * 41 + 32) > 0.82 ? 'truck' : seeded(seed, i * 43 + 39) > 0.67 ? 'bike' : 'car',
    });
  }
  return items;
}

function scoreFromStats(stats) {
  return Math.max(0, Math.round(
    stats.distance * 10 +
    stats.nearMisses * 250 +
    stats.overtakes * 120 +
    stats.bestCombo * 180 +
    stats.boostSeconds * 45 -
    stats.collisions * 350
  ));
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCar(ctx, x, y, scale, body, accent, angle = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle * Math.PI / 180);
  const w = 38 * scale;
  const h = 74 * scale;
  ctx.fillStyle = '#111';
  ctx.fillRect(-w * 0.62, -h * 0.35, 7 * scale, 20 * scale);
  ctx.fillRect(w * 0.48, -h * 0.35, 7 * scale, 20 * scale);
  ctx.fillRect(-w * 0.62, h * 0.15, 7 * scale, 20 * scale);
  ctx.fillRect(w * 0.48, h * 0.15, 7 * scale, 20 * scale);
  ctx.fillStyle = body;
  drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 7 * scale);
  ctx.fill();
  ctx.fillStyle = '#8FC7F2';
  drawRoundedRect(ctx, -w * 0.33, -h * 0.25, w * 0.66, h * 0.28, 5 * scale);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(-w * 0.4, h * 0.26, w * 0.8, 5 * scale);
  ctx.restore();
}

export default function RacingGame({ initialPlayerName, onBack }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const stateRef = useRef(null);
  const keysRef = useRef(new Set());
  const touchRef = useRef({ left: false, right: false, boost: false, brake: false });

  const [playerName, setPlayerName] = useState(initialPlayerName || '');
  const [phase, setPhase] = useState('menu');
  const [mode, setMode] = useState(null);
  const [statusText, setStatusText] = useState('');
  const [hud, setHud] = useState({ distance: 0, score: 0, speed: 0, health: 100, position: 1, nearMisses: 0, overtakes: 0, combo: 0 });
  const [result, setResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [matchId, setMatchId] = useState(null);
  const [matchData, setMatchData] = useState(null);

  const userId = useMemo(() => getUserIdFromName(playerName), [playerName]);

  useEffect(() => {
    const off = subscribeToRacingLeaderboard(setLeaderboard, () => {});
    return off;
  }, []);

  const finishRun = useCallback(async (finalState, reason) => {
    const score = scoreFromStats(finalState);
    stateRef.current.running = false;
    const saved = await saveRacingScore({
      playerName,
      score,
      distance: finalState.distance,
      nearMisses: finalState.nearMisses,
      overtakes: finalState.overtakes,
      collisions: finalState.collisions,
    }).catch(() => null);
    setResult({ score, distance: Math.round(finalState.distance), reason, saved });
    setPhase('result');
  }, [playerName]);

  const beginSingle = useCallback(() => {
    const clean = playerName.trim();
    if (!clean) {
      setStatusText('Enter a player name first.');
      return;
    }
    stateRef.current = {
      running: true,
      seed: Math.floor(Math.random() * 0xffffffff),
      distance: 0,
      lateral: 0,
      lane: 0,
      speed: 280,
      health: MAX_HEALTH,
      boost: 100,
      nearMisses: 0,
      overtakes: 0,
      collisions: 0,
      combo: 0,
      bestCombo: 0,
      boostSeconds: 0,
      passedTraffic: new Set(),
      lastNearMissAt: 0,
      lastPublishedAt: 0,
      remote: null,
    };
    setMode('single');
    setResult(null);
    setStatusText('');
    setPhase('race');
    lastTimeRef.current = performance.now();
  }, [playerName]);

  const beginQueue = useCallback(async () => {
    const clean = playerName.trim();
    if (!clean) {
      setStatusText('Enter a player name first.');
      return;
    }
    setMode('multi');
    setPhase('queue');
    setStatusText('Looking for another racer...');
    try {
      await queuePlayer(userId, clean);
    } catch (error) {
      setStatusText('Could not join the queue. Check Firebase rules.');
    }
  }, [playerName, userId]);

  useEffect(() => {
    if (phase !== 'queue') return undefined;
    const off = subscribeToQueue(async (entries) => {
      const usable = entries
        .filter((entry) => entry?.userId && entry.userId !== userId)
        .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
      if (!usable.length) return;
      const opponent = usable[0];
      const allIds = [userId, opponent.userId];
      const names = [playerName, opponent.playerName];
      try {
        const id = await createOrJoinDeterministicMatch(allIds[0], allIds[1], names[0], names[1]);
        await leaveQueue(userId);
        setMatchId(id);
      } catch (error) {
        setStatusText('Matchmaking failed. Please try again.');
      }
    }, () => {});
    return off;
  }, [phase, playerName, userId]);

  useEffect(() => {
    if (!matchId) return undefined;
    const off = subscribeToMatch(matchId, (data) => {
      setMatchData(data);
      if (!data) return;
      if (data.status === 'countdown' || data.status === 'racing') {
        setPhase('race');
        if (!stateRef.current?.running) {
          stateRef.current = {
            running: true,
            seed: Number(data.seed) || 1,
            distance: 0,
            lateral: 0,
            lane: 0,
            speed: 280,
            health: MAX_HEALTH,
            boost: 100,
            nearMisses: 0,
            overtakes: 0,
            collisions: 0,
            combo: 0,
            bestCombo: 0,
            boostSeconds: 0,
            passedTraffic: new Set(),
            lastNearMissAt: 0,
            lastPublishedAt: 0,
            remote: null,
          };
        }
      }
    }, () => setStatusText('Lost connection to match.'));
    return off;
  }, [matchId]);

  useEffect(() => {
    if (!matchId || !stateRef.current || !stateRef.current.running) return;
    publishPlayerState(matchId, userId, { ready: true, distance: 0, lane: 0, speed: 0, finished: false }).catch(() => {});
    startMatchIfReady(matchId).catch(() => {});
  }, [matchId, userId]);

  useEffect(() => {
    if (!matchId || !matchData?.states) return;
    const otherId = Object.keys(matchData.states).find((id) => id !== userId);
    if (!otherId) return;
    stateRef.current.remote = { ...matchData.states[otherId], userId: otherId };
  }, [matchData, matchId, userId]);

  useEffect(() => {
    const down = (event) => {
      keysRef.current.add(event.key.toLowerCase());
      if (['arrowleft', 'arrowright', ' '].includes(event.key.toLowerCase())) event.preventDefault();
    };
    const up = (event) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'race') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = (now) => {
      const state = stateRef.current;
      if (!state?.running) return;
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000 || 0.016);
      lastTimeRef.current = now;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      const left = keysRef.current.has('arrowleft') || keysRef.current.has('a') || touchRef.current.left;
      const right = keysRef.current.has('arrowright') || keysRef.current.has('d') || touchRef.current.right;
      const boosting = keysRef.current.has('shift') || touchRef.current.boost;
      const braking = keysRef.current.has(' ') || touchRef.current.brake;

      let target = state.speed;
      if (boosting && state.boost > 0) {
        target = 520;
        state.boost = clamp(state.boost - 27 * dt, 0, 100);
        state.boostSeconds += dt;
      } else {
        state.boost = clamp(state.boost + 8 * dt, 0, 100);
      }
      if (braking) target = 150;
      state.speed += (target - state.speed) * Math.min(1, dt * 2.5);

      const steer = (right ? 1 : 0) - (left ? 1 : 0);
      state.lateral += steer * dt * 3.2;
      state.lateral *= Math.pow(0.003, dt);
      state.lateral = clamp(state.lateral, -1.05, 1.05);
      state.lane = clamp(Math.round(state.lateral), -1, 1);

      const oldDistance = state.distance;
      state.distance += state.speed * dt;
      const traffic = trafficForDistance(state.seed, state.distance);
      const playerX = w / 2 + state.lateral * w * 0.18;
      const roadWidth = w * 0.62;
      const laneWidth = roadWidth / 3;
      const roadLeft = (w - roadWidth) / 2;
      const roadShift = Math.sin(state.distance * 0.0032) * w * 0.07;
      const laneX = (lane) => w / 2 + lane * laneWidth * 0.98;

      for (const npc of traffic) {
        const relative = npc.distance - state.distance;
        if (relative < -80 || relative > 1050) continue;
        let tLane = npc.lane;
        let angle = npc.angle;
        if (npc.changing) {
          const progress = clamp((state.distance - (npc.switchDistance - 70)) / 140, 0, 1);
          const smooth = progress * progress * (3 - 2 * progress);
          tLane = npc.lane + (npc.targetLane - npc.lane) * smooth;
          angle = (npc.targetLane - npc.lane) * smooth * 11;
        }
        if (!state.passedTraffic.has(`${npc.id}-pass`) && relative < -25) {
          state.passedTraffic.add(`${npc.id}-pass`);
          if (Math.abs(tLane - state.lateral) > 0.55) {
            state.overtakes += 1;
            state.combo += 1;
            state.bestCombo = Math.max(state.bestCombo, state.combo);
          }
        }
        if (relative > -12 && relative < 120 && Math.abs(tLane - state.lateral) < 0.34) {
          state.health -= (npc.kind === 'truck' ? 34 : 23) * dt * 5;
          if (now - state.lastNearMissAt > 500) {
            state.collisions += 1;
            state.combo = 0;
            state.lastNearMissAt = now;
          }
          state.lateral += state.lateral >= 0 ? -0.45 * dt : 0.45 * dt;
          state.speed *= 0.985;
        } else if (relative > -5 && relative < 80 && Math.abs(tLane - state.lateral) < 0.58) {
          if (now - state.lastNearMissAt > 450) {
            state.nearMisses += 1;
            state.combo += 1;
            state.bestCombo = Math.max(state.bestCombo, state.combo);
            state.lastNearMissAt = now;
          }
        }
      }

      if (mode === 'multi' && state.remote) {
        const remote = state.remote;
        const gap = Math.abs((Number(remote.distance) || 0) - state.distance);
        if (gap < 85 && Math.abs((Number(remote.lane) || 0) - state.lateral) < 0.42) {
          state.speed *= 0.992;
          state.lateral += state.lateral >= 0 ? -0.55 * dt : 0.55 * dt;
        }
        if (matchData?.finish?.winnerId) {
          state.running = false;
          setResult({
            score: scoreFromStats(state),
            distance: Math.round(state.distance),
            reason: matchData.finish.winnerId === userId ? 'YOU WIN' : 'YOU LOSE',
            saved: null,
          });
          setPhase('result');
        }
      }

      const serverReady = matchData?.status === 'racing';
      if (mode === 'multi' && matchId && serverReady && now - state.lastPublishedAt > 120) {
        state.lastPublishedAt = now;
        publishPlayerState(matchId, userId, {
          ready: true,
          distance: Math.round(state.distance),
          lane: state.lateral,
          speed: Math.round(state.speed),
          finished: false,
        }).catch(() => {});
      }

      state.health = clamp(state.health, 0, MAX_HEALTH);
      if (state.health <= 0) {
        state.running = false;
        if (mode === 'multi' && matchId) {
          finishMatch(matchId, userId === Object.keys(matchData?.players || {})[0] ? Object.keys(matchData?.players || {})[1] : Object.keys(matchData?.players || {})[0], scoreFromStats(state)).catch(() => {});
        } else {
          finishRun(state, 'WRECKED').catch(() => {});
        }
      } else if (mode === 'multi' && state.distance >= TARGET_DISTANCE) {
        state.running = false;
        finishMatch(matchId, userId, scoreFromStats(state)).catch(() => {});
      } else if (mode === 'single' && state.distance >= TARGET_DISTANCE) {
        finishRun(state, '20 KM CHALLENGE COMPLETE').catch(() => {});
      }

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0d0d0d';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#18331f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#262626';
      ctx.beginPath();
      ctx.moveTo(w * 0.18 + roadShift, 0);
      ctx.lineTo(w * 0.82 + roadShift, 0);
      ctx.lineTo(w * 0.68, h);
      ctx.lineTo(w * 0.32, h);
      ctx.closePath();
      ctx.fill();

      const laneY = (distanceOffset) => h - 150 - distanceOffset * 0.33;
      for (let i = 0; i < 18; i += 1) {
        const y = (i * 70 + (state.distance * 0.7) % 70) - 60;
        const p = 1 - y / (h + 20);
        const roadYShift = roadShift * p;
        const roadL = w / 2 - roadWidth * 0.5 * p + roadYShift;
        const roadR = w / 2 + roadWidth * 0.5 * p + roadYShift;
        ctx.fillStyle = i % 2 ? '#eeeeee' : '#444';
        ctx.fillRect(roadL - 5, y, 4, 26 * p + 3);
        ctx.fillRect(roadR + 1, y, 4, 26 * p + 3);
      }
      for (let divider = -1; divider <= 1; divider += 1) {
        if (divider === 0) continue;
        for (let i = 0; i < 14; i += 1) {
          const y = ((i * 100 + state.distance * 1.2) % (h + 120)) - 60;
          ctx.strokeStyle = '#c9c9c9';
          ctx.lineWidth = 3;
          ctx.setLineDash([18, 16]);
          ctx.beginPath();
          ctx.moveTo(w / 2 + divider * laneWidth * 0.5 - 1, y);
          ctx.lineTo(w / 2 + divider * laneWidth * 0.5 - 1, y + 45);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      for (const npc of traffic) {
        const relative = npc.distance - state.distance;
        if (relative < -80 || relative > 980) continue;
        const p = clamp(1 - relative / 980, 0.12, 1);
        const y = h - 155 - relative * 0.42;
        let tLane = npc.lane;
        let angle = npc.angle;
        if (npc.changing) {
          const progress = clamp((state.distance - (npc.switchDistance - 70)) / 140, 0, 1);
          const smooth = progress * progress * (3 - 2 * progress);
          tLane = npc.lane + (npc.targetLane - npc.lane) * smooth;
          angle = (npc.targetLane - npc.lane) * smooth * 11;
          if (Math.abs(relative) < 360 && relative > 0) {
            ctx.fillStyle = '#FFD84D';
            ctx.font = `${Math.max(9, 13 * p)}px system-ui`;
            ctx.textAlign = 'center';
            ctx.fillText(npc.targetLane > npc.lane ? '→ SWITCH' : 'SWITCH ←', laneX(tLane), y - 45 * p);
          }
        }
        drawCar(ctx, laneX(tLane), y, 0.55 + p * 0.35, npc.kind === 'truck' ? '#777' : npc.kind === 'bike' ? '#2B77FF' : '#E64B4B', '#FFD84D', angle, p);
      }

      if (mode === 'multi' && state.remote) {
        const remoteGap = Number(state.remote.distance) - state.distance;
        if (remoteGap > -1200 && remoteGap < 900) {
          const ry = h - 155 - remoteGap * 0.42;
          const rp = clamp(1 - remoteGap / 900, 0.18, 1);
          drawCar(ctx, laneX(clamp(Number(state.remote.lane) || 0, -1.05, 1.05)), ry, 0.58 + rp * 0.3, '#7A35D5', '#F2A7FF', (Number(state.remote.lane) || 0) > 0 ? 4 : -4, rp);
        }
      }

      drawCar(ctx, playerX, h - 110, 1.22, '#FF2E2E', '#FFD84D', state.lateral * -4, 1);

      if (state.health < 45) {
        ctx.fillStyle = `rgba(255,0,0,${0.12 + (45 - state.health) / 320})`;
        ctx.fillRect(0, 0, w, h);
      }

      const score = scoreFromStats(state);
      setHud({
        distance: Math.round(state.distance),
        score,
        speed: Math.round(state.speed),
        health: Math.round(state.health),
        position: mode === 'multi' && state.remote && Number(state.remote.distance) > state.distance ? 2 : 1,
        nearMisses: state.nearMisses,
        overtakes: state.overtakes,
        combo: state.combo,
      });

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [finishRun, matchData, matchId, mode, phase, playerName, userId]);

  const touchButton = (key) => ({
    onPointerDown: (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); touchRef.current[key] = true; },
    onPointerUp: () => { touchRef.current[key] = false; },
    onPointerCancel: () => { touchRef.current[key] = false; },
    onPointerLeave: () => { touchRef.current[key] = false; },
  });

  if (phase === 'menu') {
    return (
      <div className="min-h-screen bg-[#101010] text-white flex flex-col">
        <header className="border-b-2 border-[#FF2E2E] px-5 py-4 flex items-center justify-between">
          <div><div className="text-[#43D17A] text-xs font-black tracking-[0.25em]">GAME 02</div><h1 className="text-3xl md:text-4xl font-black">INFINITE RUSH</h1></div>
          <button onClick={onBack} className="border border-[#555] rounded-lg px-4 py-2 text-sm hover:border-[#FF2E2E]">← Arcade</button>
        </header>
        <main className="max-w-5xl w-full mx-auto p-5 md:p-8">
          <div className="rounded-2xl border border-[#333] bg-[#181818] p-5 mb-5">
            <label className="text-xs font-bold tracking-widest text-[#999]">RACER NAME</label>
            <input value={playerName} onChange={(e) => setPlayerName(e.target.value.slice(0, 32))} placeholder="Enter your name" className="mt-2 w-full md:max-w-md bg-[#0f0f0f] border border-[#444] focus:border-[#43D17A] outline-none rounded-lg px-4 py-3" />
            {statusText && <div className="text-[#FF2E2E] text-sm mt-2">{statusText}</div>}
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <button onClick={beginSingle} className="text-left rounded-2xl border border-[#333] bg-[#1A1A1A] p-6 hover:border-[#43D17A] transition"><div className="text-[#43D17A] text-xs font-black tracking-widest">SOLO</div><h2 className="text-3xl font-black mt-2">Endless Record</h2><p className="text-[#999] mt-2">Chase your best score, stack near-misses and survive as long as possible.</p></button>
            <button onClick={beginQueue} className="text-left rounded-2xl border border-[#333] bg-[#1A1A1A] p-6 hover:border-[#FF2E2E] transition"><div className="text-[#FF2E2E] text-xs font-black tracking-widest">2 PLAYER</div><h2 className="text-3xl font-black mt-2">Quick Race</h2><p className="text-[#999] mt-2">Join the queue. When two racers are ready, the same seeded highway starts for both.</p></button>
          </div>
          <div className="mt-6 rounded-2xl border border-[#333] bg-[#181818] p-5">
            <div className="flex items-center justify-between mb-3"><h2 className="font-black">RACING LEADERBOARD</h2><span className="text-xs text-[#777]">TOP 50</span></div>
            <div className="space-y-1 max-h-80 overflow-y-auto">{leaderboard.slice(0, 50).map((row, i) => <div key={row.id} className="grid grid-cols-[40px_1fr_100px] px-3 py-2 rounded bg-[#222]"><span className="text-[#777]">{i + 1}</span><span>{row.playerName}</span><span className="text-right font-bold text-[#FFD84D]">{Number(row.score || 0).toLocaleString()}</span></div>)}</div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'queue') {
    return (
      <div className="min-h-screen bg-[#101010] text-white flex items-center justify-center p-5">
        <div className="w-full max-w-xl rounded-2xl border border-[#333] bg-[#191919] p-8 text-center">
          <div className="text-[#43D17A] text-xs font-black tracking-[0.3em]">MULTIPLAYER QUEUE</div>
          <h1 className="text-4xl font-black mt-2">WAITING FOR A RACER</h1>
          <p className="text-[#888] mt-3">{statusText}</p>
          <div className="mt-7 h-2 rounded-full bg-[#2A2A2A] overflow-hidden"><div className="h-full bg-[#43D17A] animate-pulse w-2/3" /></div>
          <button onClick={() => { leaveQueue(userId).catch(() => {}); setPhase('menu'); setMode(null); }} className="mt-7 border border-[#555] rounded-lg px-5 py-2">Cancel</button>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="min-h-screen bg-[#101010] text-white flex items-center justify-center p-5">
        <div className="w-full max-w-2xl rounded-2xl border border-[#333] bg-[#191919] p-8 text-center">
          <div className="text-[#43D17A] text-xs font-black tracking-[0.3em]">RACE OVER</div>
          <h1 className="text-5xl font-black mt-2">{result?.reason}</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 text-left">
            <div className="bg-[#222] p-4 rounded-xl"><div className="text-xs text-[#777]">SCORE</div><div className="text-2xl font-black">{Number(result?.score || 0).toLocaleString()}</div></div>
            <div className="bg-[#222] p-4 rounded-xl"><div className="text-xs text-[#777]">DISTANCE</div><div className="text-2xl font-black">{Number(result?.distance || 0).toLocaleString()}m</div></div>
            <div className="bg-[#222] p-4 rounded-xl"><div className="text-xs text-[#777]">NEAR MISSES</div><div className="text-2xl font-black">{hud.nearMisses}</div></div>
            <div className="bg-[#222] p-4 rounded-xl"><div className="text-xs text-[#777]">OVERTAKES</div><div className="text-2xl font-black">{hud.overtakes}</div></div>
          </div>
          {result?.saved && <div className="text-[#43D17A] mt-5 text-sm font-bold">New personal racing record saved!</div>}
          <div className="flex gap-3 justify-center mt-8"><button onClick={() => { setPhase('menu'); setMatchId(null); setMatchData(null); setMode(null); }} className="border border-[#555] rounded-lg px-5 py-3">Back to Racing</button><button onClick={mode === 'single' ? beginSingle : beginQueue} className="bg-[#FF2E2E] rounded-lg px-5 py-3 font-black">Race Again</button></div>
        </div>
      </div>
    );
  }

  const countdown = matchData?.status === 'countdown' && matchData?.startAt ? Math.max(0, Math.ceil((Number(matchData.startAt) - Date.now()) / 1000)) : 0;

  return (
    <div className="fixed inset-0 bg-[#101010] text-white select-none overflow-hidden">
      <div className="absolute inset-0">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
      <div className="absolute top-0 left-0 right-0 p-3 md:p-5 pointer-events-none">
        <div className="grid grid-cols-3 gap-2 max-w-5xl mx-auto">
          <div className="rounded-xl bg-black/65 border border-white/10 p-2 md:p-3"><div className="text-[10px] text-[#aaa]">DISTANCE</div><div className="text-xl md:text-2xl font-black">{hud.distance.toLocaleString()}m</div></div>
          <div className="rounded-xl bg-black/65 border border-white/10 p-2 md:p-3 text-center"><div className="text-[10px] text-[#aaa]">POSITION</div><div className="text-xl md:text-2xl font-black">{mode === 'multi' ? `${hud.position === 1 ? '1ST' : '2ND'}` : 'SOLO'}</div></div>
          <div className="rounded-xl bg-black/65 border border-white/10 p-2 md:p-3 text-right"><div className="text-[10px] text-[#aaa]">SCORE</div><div className="text-xl md:text-2xl font-black text-[#FFD84D]">{hud.score.toLocaleString()}</div></div>
        </div>
        <div className="max-w-5xl mx-auto mt-2 grid grid-cols-3 gap-2 text-xs md:text-sm"><div>SPD <b>{hud.speed}</b></div><div className="text-center">HP <b>{hud.health}%</b></div><div className="text-right">COMBO <b>x{hud.combo}</b></div></div>
      </div>
      <div className="absolute bottom-3 left-0 right-0 px-3 md:px-6">
        <div className="max-w-5xl mx-auto flex items-end justify-between gap-3">
          <div className="flex gap-2"><button {...touchButton('left')} className="touch-control w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/70 border border-white/15 text-3xl">←</button><button {...touchButton('right')} className="touch-control w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/70 border border-white/15 text-3xl">→</button></div>
          <div className="flex gap-2"><button {...touchButton('brake')} className="touch-control h-14 px-4 rounded-xl bg-black/70 border border-white/15 font-bold">BRAKE</button><button {...touchButton('boost')} className="touch-control h-14 px-4 rounded-xl bg-[#FF2E2E]/80 border border-[#FF2E2E] font-black">BOOST</button></div>
        </div>
        <div className="max-w-5xl mx-auto mt-2"><div className="h-2 bg-black/60 rounded-full overflow-hidden"><div className="h-full bg-[#FF2E2E]" style={{ width: `${hud.health}%` }} /></div></div>
      </div>
      {mode === 'multi' && <div className="absolute top-24 left-1/2 -translate-x-1/2 rounded-full bg-black/70 border border-[#43D17A]/30 px-4 py-2 text-xs font-bold">{matchData?.players ? `${Object.values(matchData.players).map((p) => p.playerName).join('  VS  ')}` : 'MATCH'}</div>}
      {countdown > 0 && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="text-[120px] md:text-[180px] font-black drop-shadow-2xl">{countdown}</div></div>}
      {hud.combo >= 3 && <div className="absolute left-1/2 top-1/3 -translate-x-1/2 text-center pointer-events-none"><div className="text-[#FFD84D] text-4xl md:text-6xl font-black">COMBO x{hud.combo}</div><div className="text-white font-bold">NEAR MISS / OVERTAKE CHAIN</div></div>}
    </div>
  );
}
