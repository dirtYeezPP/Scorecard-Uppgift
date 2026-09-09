/* ==========================================================================
   HUD.JS  —  the bridge between client.js (untouched) and the visuals.

   - Reads game state ONLY through client.js' own globals: getPlayers(),
     getGameInfo(), and the DOM that printPlayers()/printGameInfo()/
     showTotals()/displaySavedGames() render.
   - Watches those containers with MutationObservers, re-decorates the DOM
     after every re-render (score colouring, hole briefings, leaderboard
     bars, ARIA labels) and diffs snapshots to trigger rockets / explosions
     in COSMOS.
   - Adds the chrome: telemetry bar, toasts, boot sequence, mission briefing
     panel, spark bursts, synthesized sound, pointer halo, panel tilt.

   Accessibility:
   - client.js re-renders the table with replaceChildren() on every score
     change, which would throw keyboard focus to <body>. Every control we
     decorate gets a stable data-focus-key and focus is restored after each
     re-render (see restoreFocus()).
   - A visually hidden live region announces score changes; toasts are
     aria-live too. The briefing is a labelled dialog that moves focus in and
     back out. Hole numbers are real <button>s. All colours come from a
     palette that stays >= 6:1 on the panel background.
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     0. Storage shim. client.js' getPlayers() does JSON.parse(null) when
        localStorage has keys but no 'List' — this guarantees 'List' exists
        before client.js runs (this script is loaded first, both deferred).
     ---------------------------------------------------------------------- */
  try { if (localStorage.getItem('List') === null) localStorage.setItem('List', '[]'); } catch (e) { /* private mode etc. */ }

  const PREF_KEY = 'orbital_prefs';
  const prefs = Object.assign({ sfx: true, fx: true }, (() => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (e) { return {}; } })());
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const finePointer = matchMedia('(pointer: fine)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const html = document.documentElement;

  function make(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const displayName = n => String(n == null ? '' : n).replace(/_/g, ' ');
  const pad2 = n => String(n).padStart(2, '0');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* colour per player — a fixed palette (every entry >= 6:1 on the panel
     background) picked by a stable hash of the id so it survives reloads */
  const PALETTE = ['#22e5ff', '#ff3ec9', '#ffd166', '#3dffb0', '#ff9a3c', '#b39cff', '#ff7ab6', '#c8ff5a', '#7ad7ff', '#ffb86b'];
  function colorFor(id) {
    let h = 0; const s = String(id);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  /* safe accessors around client.js globals */
  const safePlayers = () => { try { const p = window.getPlayers ? getPlayers() : []; return Array.isArray(p) ? p : []; } catch (e) { return []; } };
  let holes = [];           // [{id, par, info}]
  let courseName = '';
  let coursePar = 0;
  let activeHole = null;

  const deltaWords = (score, par) => !score ? 'not played' : score === par ? 'par' : score < par ? `${par - score} under par` : `${score - par} over par`;

  /* ======================================================================
     1. Chrome: toasts / live region / sparks / pointer halo / briefing / boot
     ====================================================================== */
  const toastRoot = make('div', 'toasts');
  toastRoot.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastRoot);
  function toast(msg, kind) {
    const t = make('div', 'toast' + (kind ? ' ' + kind : ''));
    t.appendChild(make('i'));
    t.appendChild(make('span', null, msg));
    toastRoot.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 4000);
    while (toastRoot.children.length > 4) toastRoot.firstChild.remove();
  }

  /* screen-reader status line for score changes */
  const status = make('div', 'sr-only');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  document.body.appendChild(status);
  let statusTimer = 0;
  function announce(text) {
    clearTimeout(statusTimer);
    status.textContent = '';
    statusTimer = setTimeout(() => { status.textContent = text; }, 40);
  }

  /* --- spark bursts (2D overlay canvas) --- */
  const sparks = (() => {
    const c = make('canvas', 'sparks');
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    let W = 0, H = 0, running = false, parts = [];
    function size() { W = c.width = innerWidth; H = c.height = innerHeight; }
    size(); addEventListener('resize', size);
    function tick() {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      parts = parts.filter(p => p.life > 0);
      for (const p of parts) {
        p.life -= 0.026; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.97; p.vy *= 0.97;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + p.life), 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, W, H); }
    }
    return function burst(x, y, color, n = 18, power = 5) {
      if (reduceMotion || !prefs.fx) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = Math.random() * power + 1;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, r: Math.random() * 2.2 + 1, life: 1, c: i % 4 === 0 ? '#ffffff' : color });
      }
      if (!running) { running = true; requestAnimationFrame(tick); }
    };
  })();

  /* --- pointer halo (decorative ring that trails the real cursor; the system cursor stays) --- */
  if (finePointer && !reduceMotion) {
    const cur = make('div', 'cursor');
    cur.setAttribute('aria-hidden', 'true');
    const ring = make('div', 'cursor-ring');
    cur.append(ring);
    document.body.appendChild(cur);
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0, idle = 0;
    function step() {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      if (++idle < 90) raf = requestAnimationFrame(step); else raf = 0;
    }
    addEventListener('pointermove', e => {
      x = e.clientX; y = e.clientY; idle = 0;
      const hot = e.target.closest && e.target.closest('button, a, summary, input, [role="button"]');
      cur.classList.toggle('hot', !!hot);
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
    addEventListener('pointerdown', () => cur.classList.add('down'));
    addEventListener('pointerup', () => cur.classList.remove('down'));
    document.addEventListener('mouseleave', () => cur.classList.add('gone'));
    document.addEventListener('mouseenter', () => cur.classList.remove('gone'));
  }

  /* --- mission briefing panel (hole info from info.json) --- */
  const briefing = make('div', 'briefing');
  briefing.hidden = true;
  briefing.setAttribute('role', 'dialog');
  briefing.setAttribute('aria-labelledby', 'briefingTitle');
  briefing.innerHTML = `
    <div class="briefing-head"><h2 class="eyebrow" id="briefingTitle">Mission briefing</h2><button type="button" class="briefing-close" aria-label="Close briefing">✕</button></div>
    <div class="briefing-body">
      <div class="briefing-hole"><span class="briefing-label">Hole</span><span class="briefing-num">--</span></div>
      <div class="briefing-par"><span class="briefing-label">Par</span><span class="briefing-parnum">-</span></div>
      <p class="briefing-info" lang="sv"></p>
      <ul class="briefing-scores" aria-label="Scores on this hole"></ul>
    </div>
    <div class="briefing-nav"><button type="button" class="briefing-prev">◀ Previous hole</button><button type="button" class="briefing-next">Next hole ▶</button></div>`;
  document.body.appendChild(briefing);
  let briefingOpener = null;
  briefing.querySelector('.briefing-close').addEventListener('click', () => closeBriefing());
  briefing.querySelector('.briefing-prev').addEventListener('click', () => openBriefing(wrapHole(activeHole - 1), { keepFocus: true }));
  briefing.querySelector('.briefing-next').addEventListener('click', () => openBriefing(wrapHole(activeHole + 1), { keepFocus: true }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !briefing.hidden) closeBriefing(); });
  function wrapHole(n) { if (!holes.length) return 1; const ids = holes.map(h => h.id); const min = Math.min(...ids), max = Math.max(...ids); return n < min ? max : n > max ? min : n; }
  function openBriefing(id, opts) {
    const h = holes.find(x => x.id === id);
    if (!h) return;
    const wasHidden = briefing.hidden;
    activeHole = id;
    const ttl = briefing.querySelector('#briefingTitle');
    ttl.replaceChildren(document.createTextNode('Mission briefing'), make('span', 'sr-only', `: hole ${h.id}, par ${h.par}`));
    briefing.querySelector('.briefing-num').textContent = pad2(h.id);
    briefing.querySelector('.briefing-parnum').textContent = h.par;
    briefing.querySelector('.briefing-info').textContent = h.info || '';
    const sc = briefing.querySelector('.briefing-scores');
    sc.replaceChildren();
    for (const p of safePlayers()) {
      const v = (p.scores || [])[h.id] || 0;
      const row = make('li', 'briefing-score');
      row.style.setProperty('--pc', colorFor(p.id));
      row.appendChild(make('span', 'bs-name', displayName(p.name)));
      const val = make('b', 'bs-val');
      const shown = make('span', null, v ? String(v) : '—'); shown.setAttribute('aria-hidden', 'true');
      val.append(shown, make('span', 'sr-only', v ? `${plural(v, 'stroke')}, ${deltaWords(v, h.par)}` : 'not played'));
      row.appendChild(val);
      row.dataset.delta = !v ? 'none' : v < h.par ? 'under' : v === h.par ? 'par' : 'over';
      sc.appendChild(row);
    }
    briefing.hidden = false;
    requestAnimationFrame(() => briefing.classList.add('open'));
    if (wasHidden) {
      briefingOpener = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.focusKey ? document.activeElement.dataset.focusKey : null;
      briefing.querySelector('.briefing-close').focus();
    } else if (!(opts && opts.keepFocus)) {
      briefing.querySelector('.briefing-close').focus();
    }
    window.COSMOS && COSMOS.setActiveHole(id);
    pushHoles();
    markActiveRow();
  }
  function closeBriefing() {
    if (briefing.hidden) return;
    briefing.classList.remove('open');
    setTimeout(() => { briefing.hidden = true; }, 260);
    const returnTo = briefingOpener ? $(`[data-focus-key="${CSS.escape(briefingOpener)}"]`) : null;
    activeHole = null;
    window.COSMOS && COSMOS.setActiveHole(null);
    pushHoles();
    markActiveRow();
    (returnTo || $('#scoreboard')).focus({ preventScroll: false });
    briefingOpener = null;
  }
  function markActiveRow() {
    $$('.scoreTableDyn tr.info').forEach(tr => {
      const on = activeHole != null && +tr.cells[0].textContent === activeHole;
      tr.classList.toggle('active-row', on);
      const b = tr.querySelector('.hole-btn'); if (b) b.setAttribute('aria-expanded', String(on));
    });
  }

  /* --- boot sequence overlay (markup lives in index.html) --- */
  const boot = $('#boot');
  const bootLines = [
    '> linking telemetry to client.js ........ OK',
    '> fetching course data (info.json) ....... OK',
    '> baking nebula / spinning up planet ..... OK',
    '> deploying crew satellites .............. OK',
    '> arming scoreboard ...................... GO',
  ];
  let bootDone = false;
  function runBoot() {
    if (!boot) return;
    const quick = sessionStorage.getItem('orbital_booted') === '1' || reduceMotion;
    const log = boot.querySelector('.boot-log');
    const bar = boot.querySelector('.boot-bar i');
    const per = quick ? 80 : 210;
    bootLines.forEach((l, i) => setTimeout(() => { if (log) log.appendChild(make('div', null, l)); if (bar) bar.style.width = ((i + 1) / bootLines.length * 100) + '%'; }, i * per));
    const minTime = per * bootLines.length + 250;
    let sceneReady = false, elapsed = false;
    const tryFinish = () => { if (sceneReady && elapsed) finishBoot(); };
    setTimeout(() => { elapsed = true; tryFinish(); }, minTime);
    const onReady = () => { sceneReady = true; tryFinish(); };
    if (window.COSMOS) COSMOS.on('ready', onReady);
    setTimeout(onReady, 4000);       // never trap the user behind the overlay
    boot.addEventListener('click', finishBoot);
    document.addEventListener('keydown', finishBoot, { once: true });
  }
  function finishBoot() {
    if (bootDone || !boot) return;
    bootDone = true;
    try { sessionStorage.setItem('orbital_booted', '1'); } catch (e) { /* ignore */ }
    boot.classList.add('done');
    html.classList.remove('booting');
    html.classList.add('live');
    setTimeout(() => boot.remove(), 900);
    setTimeout(() => html.classList.add('entered'), 1500);   // entry animation over → plain styles, whatever happened
  }

  /* ======================================================================
     2. Sound (synthesized, no assets; only ever plays in response to a click)
     ====================================================================== */
  const sfx = (() => {
    let ctx = null;
    const get = () => { if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; };
    function tone({ f = 880, f2 = 0, type = 'sine', dur = 0.08, vol = 0.1, delay = 0 }) {
      if (!prefs.sfx) return; const c = get(); if (!c) return;
      const t0 = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise({ dur = 0.4, vol = 0.15, from = 400, to = 3000, delay = 0 }) {
      if (!prefs.sfx) return; const c = get(); if (!c) return;
      const t0 = c.currentTime + delay;
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const flt = c.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = 0.8;
      flt.frequency.setValueAtTime(from, t0); flt.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt).connect(g).connect(c.destination);
      src.start(t0); src.stop(t0 + dur + 0.05);
    }
    return {
      unlock: () => get(),
      blip: () => tone({ f: 1180, f2: 1560, type: 'square', dur: 0.06, vol: 0.035 }),
      bloop: () => tone({ f: 620, f2: 320, type: 'square', dur: 0.09, vol: 0.035 }),
      tick: () => tone({ f: 2400, type: 'triangle', dur: 0.03, vol: 0.02 }),
      launch: () => { noise({ dur: 0.6, vol: 0.16, from: 300, to: 3200 }); tone({ f: 160, f2: 760, type: 'sawtooth', dur: 0.5, vol: 0.035 }); },
      chime: () => { tone({ f: 659, dur: 0.12, vol: 0.06 }); tone({ f: 880, dur: 0.14, vol: 0.06, delay: 0.1 }); tone({ f: 1318, dur: 0.24, vol: 0.06, delay: 0.2 }); },
      alarm: () => { tone({ f: 460, f2: 230, type: 'sawtooth', dur: 0.22, vol: 0.045 }); tone({ f: 460, f2: 230, type: 'sawtooth', dur: 0.22, vol: 0.045, delay: 0.26 }); },
      boom: () => { noise({ dur: 0.7, vol: 0.2, from: 2500, to: 60 }); tone({ f: 90, f2: 30, type: 'sine', dur: 0.6, vol: 0.12 }); },
      warp: () => { noise({ dur: 0.9, vol: 0.12, from: 120, to: 6000 }); tone({ f: 220, f2: 1760, type: 'sine', dur: 0.8, vol: 0.05 }); },
    };
  })();

  /* ======================================================================
     3. Focus bookkeeping (client.js destroys and rebuilds the controls)
     ====================================================================== */
  let lastFocusKey = null, lastFocusAt = 0;
  document.addEventListener('focusin', e => {
    const k = e.target && e.target.dataset ? e.target.dataset.focusKey : null;
    if (k) { lastFocusKey = k; lastFocusAt = performance.now(); }
  });
  function restoreFocus() {
    const active = document.activeElement;
    if (active && active !== document.body && active !== html) return;     // focus is fine
    if (!lastFocusKey || performance.now() - lastFocusAt > 8000) return;
    const again = $(`[data-focus-key="${CSS.escape(lastFocusKey)}"]`);
    if (again) { again.focus({ preventScroll: true }); return; }
    // the control is gone (player removed, game deleted…) → nearest sensible place
    const [kind] = lastFocusKey.split(':');
    const fallback = kind === 'remove' ? $('#playerName') : kind === 'step' || kind === 'hole' ? $('#scoreboard') : $('details.savedGamess > summary');
    if (fallback) fallback.focus({ preventScroll: true });
  }

  /* ======================================================================
     4. Game-state sync: snapshot diffing → COSMOS + DOM decoration
     ====================================================================== */
  let prevSnap = null;
  let prevSaved = null;
  let initial = true;
  let scheduled = false;

  function snapshot(players) {
    const m = new Map();
    for (const p of players) m.set(p.id, { name: p.name, scores: (p.scores || []).map(v => v || 0) });
    return m;
  }

  function parseTotals() {
    const box = $('.scoreTotal');
    const totals = new Map(), leaders = new Set();
    let tie = false, none = false;
    if (!box) return { totals, leaders, tie, none };
    $$('p', box).forEach(p => { const m = p.textContent.match(/^Total score for (.+?) : (-?\d+)/); if (m) totals.set(m[1], +m[2]); });
    $$('h3', box).forEach(h => {
      const t = h.textContent.trim(); let m;
      if ((m = t.match(/^Winner:\s*(.+?)\s+with a total score/))) leaders.add(m[1]);
      else if ((m = t.match(/^It's a tie between (.+?) with each/))) { m[1].split(', ').forEach(n => leaders.add(n)); tie = true; }
      else if (/^No valid scores/.test(t)) none = true;
    });
    return { totals, leaders, tie, none };
  }

  function playedCount(p) { let n = 0; for (const h of holes) if (((p.scores || [])[h.id] || 0) > 0) n++; return n; }

  function rankPlayers(players, totals) {
    const rows = players.map((p, i) => ({ p, i, played: playedCount(p), total: totals.totals.has(p.name) ? totals.totals.get(p.name) : Infinity }));
    const valid = rows.filter(r => r.played > 0).sort((a, b) => a.total - b.total || a.i - b.i);
    let rank = 0, last = null;
    valid.forEach((r, idx) => { if (last !== null && r.total !== last) rank = idx; r.rank = rank; last = r.total; });
    rows.forEach(r => { if (r.played === 0) { r.rank = valid.length; r.dim = true; } });
    return rows;
  }

  function holeStates(players) {
    return holes.map(h => {
      let all = players.length > 0, some = false;
      for (const p of players) { const v = ((p.scores || [])[h.id] || 0) > 0; if (v) some = true; else all = false; }
      const state = h.id === activeHole ? 'active' : all ? 'complete' : some ? 'touched' : 'idle';
      return { id: h.id, state };
    });
  }
  function pushHoles() { if (window.COSMOS && holes.length) COSMOS.setHoles(holeStates(safePlayers())); }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    // a 0 ms timer (not rAF) so decoration also happens in a background tab
    setTimeout(() => { scheduled = false; sync(); }, 0);
  }

  function sync() {
    const players = safePlayers();
    const snap = snapshot(players);
    const events = [];
    if (prevSnap) {
      for (const [id, cur] of snap) {
        const old = prevSnap.get(id);
        if (!old) { events.push({ type: 'add', id, name: cur.name }); continue; }
        const len = Math.max(old.scores.length, cur.scores.length);
        for (let h = 0; h < len; h++) {
          const a = old.scores[h] || 0, b = cur.scores[h] || 0;
          if (a !== b) events.push({ type: 'score', id, hole: h, from: a, to: b });
        }
      }
      for (const [id, old] of prevSnap) if (!snap.has(id)) events.push({ type: 'remove', id, name: old.name });
    }
    prevSnap = snap;

    const totals = parseTotals();
    const ranked = rankPlayers(players, totals);
    const leaderIds = new Set(ranked.filter(r => totals.leaders.has(r.p.name) && !r.dim).map(r => r.p.id));

    if (window.COSMOS) {
      COSMOS.setPlayers(ranked.map(r => ({
        id: r.p.id, name: displayName(r.p.name), color: colorFor(r.p.id), rank: r.rank, dim: !!r.dim,
        isLeader: leaderIds.has(r.p.id),
        sub: r.dim ? 'standby' : (leaderIds.has(r.p.id) ? (totals.tie ? 'tied lead' : '★ leader') : ('#' + (r.rank + 1) + ' · ' + r.total)),
      })), { animate: !initial });
      if (holes.length) COSMOS.setHoles(holeStates(players));
    }

    decorateTable(players, events);
    decorateTotals(players, ranked, leaderIds, totals);
    decoratePlayers(players, ranked, leaderIds);
    decorateSaved();
    updateChips(players, ranked, leaderIds, totals);
    handleEvents(events, players, totals);
    flushObservers();
    restoreFocus();
    initial = false;
  }

  function handleEvents(events, players, totals) {
    if (initial || !events.length) return;
    const scores = events.filter(e => e.type === 'score');
    const adds = events.filter(e => e.type === 'add');
    const removes = events.filter(e => e.type === 'remove');
    const bulk = scores.length > 6 || adds.length + removes.length > 2;
    adds.forEach(e => { toast(`Player added — ${displayName(e.name)}`, 'ok'); });
    removes.forEach(e => { toast(`Player removed — ${displayName(e.name)}`, 'bad'); });
    if (adds.length) sfx.chime();
    if (removes.length) sfx.boom();
    const reset = scores.length > 0 && scores.every(e => e.to === 0) && players.every(p => !(p.scores || []).some(v => v > 0));
    if (reset) { toast('New game started — all scores cleared', 'info'); sfx.warp(); }
    if (bulk) {
      if (!reset) toast(`Game loaded — ${plural(players.length, 'player')}`, 'info');
      sfx.warp();
      if (window.COSMOS) players.forEach(p => COSMOS.pulse(p.id));
      return;
    }
    scores.forEach(e => {
      if (window.COSMOS) COSMOS.launch({ playerId: e.id, holeId: e.hole, dir: e.to > e.from ? 1 : -1 });
      const h = holes.find(x => x.id === e.hole);
      const p = players.find(x => x.id === e.id);
      if (h && p) {
        const total = totals.totals.get(p.name);
        announce(`${displayName(p.name)}, hole ${e.hole}: ${plural(e.to, 'stroke')}, ${deltaWords(e.to, h.par)}.${total != null ? ` Total ${total}.` : ''}`);
        if (e.to > 0 && e.to < h.par) toast(`Under par — ${displayName(p.name)} on hole ${pad2(e.hole)}`, 'ok');
      }
    });
    if (scores.length) sfx.launch();
  }

  /* --- DOM decoration --- */
  function decorateTable(players, events) {
    const box = $('.scoreTableDyn');
    const table = box && box.querySelector('table');
    if (!table) return;
    table.classList.add('holo');
    if (!box.querySelector('.panel-head')) {
      const head = make('div', 'panel-head');
      head.appendChild(make('h2', null, 'Scoreboard'));
      head.appendChild(make('span', 'live', 'live'));
      box.insertBefore(head, box.firstChild);
    }
    // wrap the table in a scroll container (keeps <table> semantics intact)
    let scroll = table.parentElement;
    if (!scroll.classList.contains('table-scroll')) {
      scroll = make('div', 'table-scroll');
      scroll.setAttribute('role', 'region');
      scroll.setAttribute('aria-label', 'Scoreboard, scrolls horizontally');
      scroll.tabIndex = 0;
      table.replaceWith(scroll);
      scroll.appendChild(table);
    }
    if (!table.caption) {
      const cap = table.createCaption();
      cap.textContent = `Scorecard for ${courseName || 'the course'}: hole number, par and strokes per player. Use the plus and minus buttons to change a score.`;
    }
    const changed = new Set(events.filter(e => e.type === 'score').map(e => e.id + ':' + e.hole));
    const rows = Array.from(table.rows);
    const head = rows[0];
    if (head) {
      Array.from(head.cells).forEach((th, i) => {
        th.setAttribute('scope', 'col');
        if (i === 0) { th.classList.add('th-fixed'); th.setAttribute('lang', 'sv'); return; }
        if (i === 1) { th.classList.add('th-fixed'); return; }
        const p = players[i - 2]; if (!p) return;
        th.classList.add('th-player');
        th.style.setProperty('--pc', colorFor(p.id));
        th.title = displayName(p.name);
      });
    }
    for (const tr of rows.slice(1)) {
      if (!tr.classList.contains('info')) continue;
      const cells = tr.cells;
      const holeId = +cells[0].textContent, par = +cells[1].textContent;
      const info = holes.find(h => h.id === holeId);
      let complete = players.length > 0;
      const holeCell = cells[0];
      holeCell.classList.add('hole-cell');
      holeCell.setAttribute('role', 'rowheader');
      if (!holeCell.querySelector('.hole-btn')) {
        const btn = make('button', 'hole-btn', String(holeId));
        btn.type = 'button';
        btn.dataset.hole = holeId;
        btn.dataset.focusKey = 'hole:' + holeId;
        btn.setAttribute('aria-haspopup', 'dialog');
        holeCell.replaceChildren(btn);
      }
      cells[1].classList.add('par-cell');
      cells[1].setAttribute('aria-label', `Par ${par}`);
      players.forEach((p, i) => {
        const cell = cells[2 + i]; if (!cell) return;
        const span = cell.querySelector('span');
        const score = span ? +span.textContent : 0;
        if (!(score > 0)) complete = false;
        cell.classList.add('score-cell');
        cell.style.setProperty('--pc', colorFor(p.id));
        cell.dataset.delta = !score ? 'none' : score < par ? 'under' : score === par ? 'par' : 'over';
        const diff = score - par;
        cell.dataset.badge = !score ? '' : diff === 0 ? 'E' : (diff > 0 ? '+' + diff : String(diff));
        if (span) {
          span.setAttribute('aria-hidden', 'true');
          if (changed.has(p.id + ':' + holeId)) span.classList.add('pop');
          if (!cell.querySelector('.sr-only')) cell.appendChild(make('span', 'sr-only'));
          cell.querySelector('.sr-only').textContent = `${displayName(p.name)}: ${score ? plural(score, 'stroke') + ', ' + deltaWords(score, par) : 'not played'}`;
        }
        const btns = cell.querySelectorAll('button');
        if (btns[0]) { btns[0].classList.add('step', 'minus'); btns[0].setAttribute('aria-label', `Remove one stroke for ${displayName(p.name)} on hole ${holeId}`); btns[0].dataset.dir = '-1'; btns[0].dataset.focusKey = `step:${p.id}:${holeId}:-`; }
        if (btns[1]) { btns[1].classList.add('step', 'plus'); btns[1].setAttribute('aria-label', `Add one stroke for ${displayName(p.name)} on hole ${holeId}`); btns[1].dataset.dir = '1'; btns[1].dataset.focusKey = `step:${p.id}:${holeId}:+`; }
      });
      const btn = holeCell.querySelector('.hole-btn');
      if (btn) btn.setAttribute('aria-label', `Hole ${holeId}, par ${par}${complete ? ', all players scored' : ''}. Show hole info`);
      tr.classList.toggle('complete', complete);
      tr.classList.toggle('active-row', activeHole === holeId);
      if (btn) btn.setAttribute('aria-expanded', String(activeHole === holeId));
    }
    if (!players.length && !box.querySelector('.table-empty')) {
      const empty = make('div', 'table-empty');
      empty.appendChild(make('b', null, 'No crew aboard'));
      empty.appendChild(make('span', null, 'add a player above to start scoring'));
      box.appendChild(empty);
    }
    box.classList.toggle('is-scrollable', scroll.scrollWidth > scroll.clientWidth + 4);
  }

  function decorateTotals(players, ranked, leaderIds, totals) {
    const box = $('.scoreTotal');
    if (!box) return;
    const kids = Array.from(box.children);
    const h3s = kids.filter(k => k.tagName === 'H3');
    if (h3s[0]) { h3s[0].classList.add('totals-title'); }
    if (h3s.length > 1) { const v = h3s[h3s.length - 1]; v.classList.add('verdict'); v.classList.toggle('verdict-none', totals.none); v.classList.toggle('verdict-tie', totals.tie); }
    const cards = kids.filter(k => k.tagName === 'DIV');
    const byName = new Map(players.map(p => [p.name, p]));
    const vals = ranked.filter(r => !r.dim).map(r => r.total);
    const min = vals.length ? Math.min(...vals) : 0, max = vals.length ? Math.max(...vals) : 0;
    cards.forEach((card, i) => {
      const h4 = card.querySelector('h4'); const p = h4 ? byName.get(h4.textContent) : players[i];
      if (!p) return;
      const r = ranked.find(x => x.p.id === p.id);
      card.classList.add('total-card');
      card.style.setProperty('--pc', colorFor(p.id));
      card.dataset.rank = r ? r.rank + 1 : '';
      card.classList.toggle('is-leader', leaderIds.has(p.id));
      card.classList.toggle('is-dim', !!(r && r.dim));
      const total = totals.totals.get(p.name);
      $$('.total-big, .total-bar, .total-played', card).forEach(e => e.remove());   // idempotent re-decoration
      const big = make('div', 'total-big');
      const rankEl = make('span', 'total-rank');
      const rankShown = make('span', null, r && !r.dim ? '#' + (r.rank + 1) : 'standby'); rankShown.setAttribute('aria-hidden', 'true');
      rankEl.append(rankShown, make('span', 'sr-only', r && !r.dim ? `Rank ${r.rank + 1}${leaderIds.has(p.id) ? ', leader' : ''}.` : 'Standby, no holes played yet.'));
      big.appendChild(rankEl);
      const num = make('b', 'total-num', total != null ? String(total) : '—');
      num.setAttribute('aria-hidden', 'true');                     // client.js' own "Total score for X : N" text already says it
      big.appendChild(num);
      if (coursePar && total != null) {
        const d = total - coursePar;
        const vs = make('span', 'total-vs');
        const vsShown = make('span', null, (d === 0 ? 'E' : (d > 0 ? '+' : '') + d) + ' vs par'); vsShown.setAttribute('aria-hidden', 'true');
        vs.append(vsShown, make('span', 'sr-only', d === 0 ? 'Even with par.' : `${Math.abs(d)} ${d > 0 ? 'over' : 'under'} par.`));
        big.appendChild(vs);
      }
      const bar = make('div', 'total-bar'); bar.setAttribute('aria-hidden', 'true');
      const fill = make('i');
      const pct = (r && !r.dim && total != null) ? (max === min ? 100 : 100 - (total - min) / (max - min) * 55) : 12;
      fill.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = pct + '%'; }));
      bar.appendChild(fill);
      const played = make('span', 'total-played', r ? `${r.played}/${holes.length || 18} holes played` : '');
      card.append(big, bar, played);
    });
    box.classList.toggle('empty', !cards.length);
  }

  function decoratePlayers(players, ranked, leaderIds) {
    const box = $('.players');
    if (!box) return;
    $$('.player', box).forEach((div, i) => {
      const p = players[i] || players.find(x => x.id === div.id);
      if (!p) return;
      div.style.setProperty('--pc', colorFor(p.id));
      div.classList.toggle('is-leader', leaderIds.has(p.id));
      let tag = div.querySelector('.player-tag');
      if (!tag) { tag = make('span', 'player-tag'); div.insertBefore(tag, div.firstChild); }
      tag.textContent = 'SAT-' + pad2(i + 1);
      const btn = div.querySelector('button');
      if (btn) { btn.classList.add('danger'); btn.setAttribute('aria-label', `Remove ${displayName(p.name)}`); btn.dataset.focusKey = 'remove:' + p.id; }
    });
    const details = $('details.addPlayer');
    if (details && !players.length && !details.dataset.touched) details.open = true;
  }

  function decorateSaved() {
    const box = $('.savedGames');
    if (!box) return;
    const items = $$('.savedGameItem', box);
    const names = items.map(it => it.querySelector('h4')?.textContent || '');
    items.forEach((it, i) => {
      it.style.setProperty('--pc', colorFor('save_' + names[i]));
      const btns = it.querySelectorAll('button');
      if (btns[0]) { btns[0].classList.add('primary'); btns[0].setAttribute('aria-label', `Load game ${names[i]}`); btns[0].dataset.focusKey = 'load:' + names[i]; }
      if (btns[1]) { btns[1].classList.add('danger'); btns[1].setAttribute('aria-label', `Delete game ${names[i]}`); btns[1].dataset.focusKey = 'delete:' + names[i]; }
      let idx = it.querySelector('.save-idx');
      if (!idx) { idx = make('span', 'save-idx'); it.insertBefore(idx, it.firstChild); }
      idx.textContent = pad2(i + 1);
      idx.setAttribute('aria-hidden', 'true');
    });
    if (!items.length && !box.querySelector('.saved-empty')) box.appendChild(make('p', 'saved-empty', 'Archive empty — save a game to store it here.'));
    if (prevSaved) {
      names.filter(n => !prevSaved.has(n)).forEach(n => { toast(`Game saved — ${n}`, 'ok'); sfx.chime(); });
    }
    prevSaved = new Set(names);
    const count = $('#chipSaved'); if (count) count.textContent = String(items.length);
  }

  /* --- telemetry chips --- */
  function updateChips(players, ranked, leaderIds, totals) {
    const set = (id, v) => { const e = $('#' + id); if (e && e.textContent !== v) { e.textContent = v; e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } };
    set('chipCrew', String(players.length));
    const complete = holes.length ? holeStates(players).filter(h => h.state === 'complete').length : 0;
    set('chipHoles', `${complete}/${holes.length || 18}`);
    const leaders = players.filter(p => leaderIds.has(p.id)).map(p => displayName(p.name));
    set('chipLeader', leaders.length ? leaders.join(' & ') : (totals.none || !players.length ? '—' : '…'));
  }
  const t0 = performance.now();
  setInterval(() => {
    const s = Math.floor((performance.now() - t0) / 1000);
    const e = $('#chipClock'); if (e) e.textContent = `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  }, 1000);

  /* --- observers on the containers client.js re-renders --- */
  const observers = [];
  function flushObservers() { observers.forEach(o => o.takeRecords()); }
  ['.players', '.scoreTableDyn', '.scoreTotal', '.savedGames'].forEach(sel => {
    const node = $(sel);
    if (!node) return;
    const o = new MutationObserver(scheduleSync);
    o.observe(node, { childList: true, subtree: true });
    observers.push(o);
  });

  /* ======================================================================
     5. Interaction: delegated clicks → sound, sparks, briefing
     ====================================================================== */
  document.addEventListener('click', e => {
    const t = e.target;
    const hole = t.closest && t.closest('.hole-btn');
    if (hole) { openBriefing(+hole.dataset.hole); sfx.tick(); sparks(e.clientX, e.clientY, '#ff3ec9', 12, 4); return; }
    const btn = t.closest && t.closest('button, input[type="submit"], summary');
    if (!btn) return;
    sfx.unlock();
    const color = getComputedStyle(btn).getPropertyValue('--pc').trim() || getComputedStyle(btn.parentElement).getPropertyValue('--pc').trim() || '#22e5ff';
    const r = btn.getBoundingClientRect();
    const x = e.clientX || (r.left + r.width / 2), y = e.clientY || (r.top + r.height / 2);
    if (btn.classList.contains('minus')) { sfx.bloop(); sparks(x, y, color, 10, 3.5); }
    else if (btn.classList.contains('plus')) { sfx.blip(); sparks(x, y, color, 16, 5); }
    else if (btn.classList.contains('startNewGameBtn')) { sfx.alarm(); sparks(x, y, '#ff5c7a', 22, 6); }
    else if (btn.classList.contains('saveGameBtn')) { sfx.chime(); sparks(x, y, '#ffd166', 22, 6); }
    else if (btn.classList.contains('danger')) { sfx.bloop(); sparks(x, y, '#ff5c7a', 14, 4); }
    else if (btn.classList.contains('primary')) { sfx.warp(); sparks(x, y, color, 18, 5); }
    else if (btn.tagName === 'SUMMARY') { sfx.tick(); }
    else { sfx.blip(); sparks(x, y, color, 14, 4); }
  }, true);
  $$('details').forEach(d => d.addEventListener('toggle', () => { d.dataset.touched = '1'; }));

  /* --- add-player form: feedback (client.js owns the actual submit) --- */
  const form = $('.addPlayer form');
  if (form) form.addEventListener('submit', () => {
    const v = form.name.value.trim();
    if (!v) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); sfx.alarm(); }
    else sfx.launch();
  });

  /* --- panel tilt toward the cursor (desktop only, subtle) --- */
  if (finePointer && !reduceMotion) {
    let active = null;
    document.addEventListener('pointermove', e => {
      const panel = e.target.closest && e.target.closest('.hud-panel');
      if (panel !== active) { if (active) { active.style.setProperty('--rx', '0deg'); active.style.setProperty('--ry', '0deg'); } active = panel; }
      if (!panel || !prefs.fx) return;
      const r = panel.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      panel.style.setProperty('--rx', (-py * 2).toFixed(2) + 'deg');
      panel.style.setProperty('--ry', (px * 2.5).toFixed(2) + 'deg');
      panel.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%');
      panel.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%');
    }, { passive: true });
  }

  /* --- toggles --- */
  function applyPrefs() {
    html.classList.toggle('fx-off', !prefs.fx);
    html.classList.toggle('sfx-off', !prefs.sfx);
    const fx = $('#togFx'), sx = $('#togSfx');
    if (fx) fx.setAttribute('aria-pressed', String(prefs.fx));
    if (sx) sx.setAttribute('aria-pressed', String(prefs.sfx));
    if (window.COSMOS) COSMOS.setEnabled(prefs.fx);
  }
  $('#togFx')?.addEventListener('click', () => { prefs.fx = !prefs.fx; savePrefs(); applyPrefs(); toast(prefs.fx ? 'Visual effects on' : 'Visual effects off — static background', 'info'); });
  $('#togSfx')?.addEventListener('click', () => { prefs.sfx = !prefs.sfx; savePrefs(); applyPrefs(); if (prefs.sfx) sfx.chime(); toast(prefs.sfx ? 'Sound on' : 'Sound off', 'info'); });

  /* ======================================================================
     6. Boot
     ====================================================================== */
  html.classList.add('booting');
  document.addEventListener('DOMContentLoaded', () => {
    // client.js has executed by now (deferred scripts run in order) → its globals exist.
    const fetchInfo = window.getGameInfo ? getGameInfo() : Promise.reject(new Error('getGameInfo missing'));
    fetchInfo.then(info => {
      holes = Array.isArray(info?.court) ? info.court : [];
      courseName = info?.name || '';
      coursePar = holes.reduce((s, h) => s + (+h.par || 0), 0);
      const cn = $('#courseName'); if (cn) cn.textContent = courseName || 'unknown course';
      const cp = $('#coursePar'); if (cp) cp.textContent = coursePar ? `par ${coursePar}` : '';
      const ch = $('#courseHoles'); if (ch) ch.textContent = `${holes.length} holes`;
      const cap = $('.scoreTableDyn caption'); if (cap) cap.textContent = `Scorecard for ${courseName}: hole number, par and strokes per player. Use the plus and minus buttons to change a score.`;
      scheduleSync();
    }).catch(err => { console.warn('[hud] course info unavailable', err); scheduleSync(); });

    sync();          // establishes the first snapshot without animation
    applyPrefs();
    runBoot();
    addEventListener('resize', () => { const box = $('.scoreTableDyn'); const sc = box && box.querySelector('.table-scroll'); if (sc) box.classList.toggle('is-scrollable', sc.scrollWidth > sc.clientWidth + 4); }, { passive: true });
  });
})();
