// KaraCar — car app. Vanilla JS, no build step.
(function () {
  const { icon, esc, fmtTime, api, store, toast, prettyTitle } = window.KC;
  const t = (k, v) => I18N.t(k, v);
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  // ─────────────────────────────────────────────────────────────────────────
  // Lyrics storage (IndexedDB, with an in-memory fallback)
  // ─────────────────────────────────────────────────────────────────────────
  const idb = (function () {
    const mem = new Map();
    let dbp;
    function open() {
      if (!dbp) {
        dbp = new Promise((resolve, reject) => {
          const r = indexedDB.open('karacar', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('lyrics');
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
      }
      return dbp;
    }
    async function tx(mode, fn) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const x = db.transaction('lyrics', mode);
        const req = fn(x.objectStore('lyrics'));
        x.oncomplete = () => resolve(req && req.result);
        x.onerror = () => reject(x.error);
      });
    }
    return {
      async get(k) { if (mem.has(k)) return mem.get(k); try { return (await tx('readonly', (s) => s.get(k))) || null; } catch (e) { return null; } },
      async set(k, v) { mem.set(k, v); try { await tx('readwrite', (s) => s.put(v, k)); } catch (e) { /* memory only */ } },
      async del(k) { mem.delete(k); try { await tx('readwrite', (s) => s.delete(k)); } catch (e) { /* ignore */ } }
    };
  })();

  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────
  const S = {
    view: 'search',
    current: null,
    queue: [],              // [{ song, by }]
    history: [],
    context: null,          // { id: playlistId, index }
    autoplay: store.get('kc.autoplay', true),
    mode: 'video',
    playing: false,
    userPaused: false,
    lyrics: null,           // { lines, sync, offset, source, title, artist } | { none: true }
    lyrState: 'idle',       // idle | loading | ready | none | error
    curLine: -2,
    lineEls: [],
    wordEls: [],
    candCache: {},
    plSel: 'fav',
    hotCat: 'cat_mandarin',
    guestLog: store.get('kc.guestlog', []),
    lastResults: []
  };

  let lib = store.get('kc.lib', null) || { updated: 0, playlists: [{ id: 'fav', name: '', songs: [] }], songs: {} };

  function songMeta(s) {
    return { id: s.id, title: s.title, channel: s.channel || '', duration: s.duration || 0, thumb: s.thumb || `https://i.ytimg.com/vi/${s.id}/mqdefault.jpg` };
  }
  const plName = (pl) => pl.name || t('default_playlist');
  const getPl = (id) => lib.playlists.find((p) => p.id === id);

  let syncTimer;
  function saveLib(skipSync) {
    lib.updated = Date.now();
    store.set('kc.lib', lib);
    if (!skipSync) { clearTimeout(syncTimer); syncTimer = setTimeout(syncPush, 1500); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Views & navigation
  // ─────────────────────────────────────────────────────────────────────────
  const TAB_ICONS = { search: 'search', library: 'list', hot: 'fire', guests: 'qr', player: 'mic' };
  const TAB_KEYS = { search: 'nav_search', library: 'nav_library', hot: 'nav_hot', guests: 'nav_guests', player: 'nav_player' };

  function renderTabs() {
    $$('.tab').forEach((b) => {
      const v = b.dataset.go;
      b.innerHTML = icon(TAB_ICONS[v], 26) + `<span>${esc(t(TAB_KEYS[v]))}</span>` + (v === 'player' ? '<span class="eq"><i></i><i></i><i></i></span>' : '');
      b.classList.toggle('active', v === S.view);
    });
    $('.tab-player').classList.toggle('live', !!S.current && S.playing);
  }

  function go(view) {
    S.view = view;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
    renderTabs();
    if (view === 'library') renderLibrary();
    if (view === 'hot') renderHot();
    if (view === 'guests') openGuests();
    if (view === 'player') setTimeout(recenter, 50);
    if (view === 'search' && !S.lastResults.length && !$('#search-results').children.length) renderSearchHint();
    updateMini();
  }

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); go(g.dataset.go); }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Search
  // ─────────────────────────────────────────────────────────────────────────
  function renderSearchHint() {
    $('#search-results').innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big-ic">${icon('mic', 48)}</div><h2>${esc(t('search_hint_title'))}</h2><p>${esc(t('search_hint'))}</p></div>`;
  }

  async function doSearch(q) {
    q = (q || '').trim();
    if (!q) return;
    $('#search-input').value = q;
    $('#search-input').blur();
    const box = $('#search-results');
    box.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton"></div>').join('');
    try {
      const { results } = await api('/api/search?q=' + encodeURIComponent(q));
      S.lastResults = results;
      if (!results.length) { box.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>${esc(t('no_results'))}</p></div>`; return; }
      box.innerHTML = results.map((s, i) => `
        <article class="card" data-i="${i}">
          <div class="thumb" data-act="play"><img loading="lazy" src="${esc(s.thumb)}" alt=""><span class="dur">${fmtTime(s.duration)}</span><div class="play-ov"><span>${icon('play', 28)}</span></div></div>
          <div class="card-body">
            <div><div class="card-title">${esc(s.title)}</div><div class="card-sub">${esc(s.channel)}</div></div>
            <div class="card-actions">
              <button class="btn btn-primary" data-act="play">${icon('play', 18)}${esc(t('play_now'))}</button>
              <button class="btn btn-ghost" data-act="next" title="${esc(t('play_next'))}">${icon('playnext', 20)}</button>
              <button class="btn btn-ghost" data-act="queue" title="${esc(t('add_queue'))}">${icon('plus', 20)}</button>
              <button class="btn btn-ghost" data-act="save" title="${esc(t('add_playlist'))}">${icon('heart', 20)}</button>
            </div>
          </div>
        </article>`).join('');
    } catch (e) {
      box.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>${esc(t('search_error'))}</p></div>`;
    }
  }

  $('#search-form').addEventListener('submit', (e) => { e.preventDefault(); doSearch($('#search-input').value); });
  $('#search-results').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    const card = e.target.closest('.card');
    if (!b || !card) return;
    songAction(b.dataset.act, S.lastResults[+card.dataset.i]);
  });

  function songAction(act, song, ctx) {
    if (!song) return;
    song = songMeta(song);
    if (act === 'play') play(song, { context: ctx || null, show: true });
    else if (act === 'next') { enqueue(song, '', true); }
    else if (act === 'queue') { enqueue(song, '', false); }
    else if (act === 'save') openPlaylistPicker(song);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Queue
  // ─────────────────────────────────────────────────────────────────────────
  function enqueue(song, by, next, silent) {
    if (!S.current) { play(song, { show: false }); if (!silent) toast(t('toast_queued', { title: prettyTitle(song.title) })); return; }
    const item = { song: songMeta(song), by: by || '' };
    if (next) S.queue.unshift(item); else S.queue.push(item);
    if (!silent) toast(t(next ? 'toast_playing_next' : 'toast_queued', { title: prettyTitle(song.title) }));
    renderQueue();
    publishState();
  }

  function renderQueue() {
    const box = $('#queue-list');
    if (!S.queue.length) { box.innerHTML = `<div class="q-empty">${esc(t('nothing_queued'))}</div>`; return; }
    box.innerHTML = S.queue.map((q, i) => `
      <div class="q-item" data-i="${i}">
        <img src="${esc(q.song.thumb)}" alt="">
        <div style="min-width:0"><div class="q-title">${esc(prettyTitle(q.song.title))}</div>
          <div class="q-sub">${q.by ? `<span class="badge by">${icon('phone', 12)} ${esc(q.by)}</span>` : ''}<span>${fmtTime(q.song.duration)}</span></div></div>
        <div class="q-actions">
          <button class="ctrl" data-q="play" aria-label="Play">${icon('play', 18)}</button>
          <button class="ctrl" data-q="up" aria-label="Up">${icon('up', 20)}</button>
          <button class="ctrl" data-q="down" aria-label="Down">${icon('down', 20)}</button>
          <button class="ctrl" data-q="remove" aria-label="Remove">${icon('trash', 18)}</button>
        </div>
      </div>`).join('');
  }

  $('#queue-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    const i = +b.closest('.q-item').dataset.i;
    const a = b.dataset.q;
    if (a === 'play') { const [it] = S.queue.splice(i, 1); play(it.song); }
    else if (a === 'up' && i > 0) { [S.queue[i - 1], S.queue[i]] = [S.queue[i], S.queue[i - 1]]; }
    else if (a === 'down' && i < S.queue.length - 1) { [S.queue[i + 1], S.queue[i]] = [S.queue[i], S.queue[i + 1]]; }
    else if (a === 'remove') S.queue.splice(i, 1);
    renderQueue();
    publishState();
  });

  $('#autoplay').checked = S.autoplay;
  $('#autoplay').addEventListener('change', (e) => { S.autoplay = e.target.checked; store.set('kc.autoplay', S.autoplay); });

  // ─────────────────────────────────────────────────────────────────────────
  // YouTube player
  // ─────────────────────────────────────────────────────────────────────────
  let player = null;
  let playerReady = false;
  let pendingVideo = null;

  function createPlayer() {
    if (player || !window.YT || !YT.Player) return;
    player = new YT.Player('yt', {
      width: '100%', height: '100%',
      host: 'https://www.youtube.com',
      playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, modestbranding: 1, iv_load_policy: 3, fs: 0, disablekb: 1, cc_load_policy: 0, origin: location.origin },
      events: {
        onReady: () => {
          playerReady = true;
          if (pendingVideo) { player.loadVideoById(pendingVideo); pendingVideo = null; }
        },
        onStateChange: onPlayerState,
        onError: onPlayerError
      }
    });
  }
  const prevReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () { if (prevReady) prevReady(); createPlayer(); };
  if (window.YT && YT.Player) createPlayer();

  function loadVideo(id) {
    if (playerReady) player.loadVideoById(id);
    else { pendingVideo = id; createPlayer(); }
  }

  const clock = { base: 0, at: 0, lastRaw: -1 };
  function nowMs() {
    if (!playerReady || !S.current || !player.getCurrentTime) return 0;
    const raw = (player.getCurrentTime() || 0) * 1000;
    const now = performance.now();
    if (!S.playing) { clock.base = raw; clock.at = now; clock.lastRaw = raw; return raw; }
    // The iframe only reports time a few times per second; interpolate between reports
    // and nudge toward each new report so word fills stay smooth.
    if (raw !== clock.lastRaw) {
      clock.lastRaw = raw;
      const est = clock.base + (now - clock.at);
      if (Math.abs(raw - est) > 300) { clock.base = raw; clock.at = now; }
      else { clock.base = est + (raw - est) * 0.15; clock.at = now; }
    }
    return clock.base + (now - clock.at);
  }

  let lastAutoResume = 0;
  function onPlayerState(e) {
    const st = e.data;
    const wasPlaying = S.playing;
    S.playing = st === 1;
    if (st === 1) { clock.base = (player.getCurrentTime() || 0) * 1000; clock.at = performance.now(); S.userPaused = false; }
    if (st === 0) next(true);
    // Tesla pauses video while the car is moving. If the pause wasn't ours, hide the video
    // and resume so the audio and lyrics continue.
    if (st === 2 && wasPlaying && !S.userPaused && S.mode === 'video' && Date.now() - lastAutoResume > 10000) {
      lastAutoResume = Date.now();
      setMode('lyrics');
      toast(t('driving_hint'), 4500);
      setTimeout(() => { if (!S.userPaused) player.playVideo(); }, 400);
    }
    updatePlayButtons();
    renderTabs();
  }

  function onPlayerError(e) {
    const blocked = e.data === 101 || e.data === 150 || e.data === 153;
    toast(t(blocked ? 'embed_blocked' : 'video_error'), 4000);
    setTimeout(() => next(true), 1800);
  }

  function play(song, opts) {
    opts = opts || {};
    if (S.current && !opts.fromHistory) { S.history.push(S.current); if (S.history.length > 50) S.history.shift(); }
    if (opts.context !== undefined) S.context = opts.context;
    S.current = songMeta(song);
    S.playing = false;
    S.userPaused = false;
    clock.base = 0; clock.at = performance.now(); clock.lastRaw = -1;
    loadVideo(song.id);
    $('#stage').classList.remove('idle');
    $('#stage-backdrop').style.backgroundImage = `url("https://i.ytimg.com/vi/${song.id}/hqdefault.jpg")`;
    updateNowPlaying();
    renderQueue();
    publishState();
    if (opts.show) go('player'); else updateMini();
    if (S.view === 'library') renderLibrary();
    loadLyricsFor(S.current);
  }

  function next(auto) {
    if (S.queue.length) { const it = S.queue.shift(); play(it.song); return; }
    if (S.context && (S.autoplay || !auto)) {
      const pl = getPl(S.context.id);
      const idx = S.context.index + 1;
      if (pl && idx < pl.songs.length && lib.songs[pl.songs[idx]]) {
        S.context = { id: pl.id, index: idx };
        play(lib.songs[pl.songs[idx]]);
        return;
      }
    }
    if (auto) { S.playing = false; updatePlayButtons(); toast(t('end_of_queue')); }
  }

  function prev() {
    if (!S.current) return;
    if (nowMs() > 4000 || !S.history.length) { player.seekTo(0, true); return; }
    S.queue.unshift({ song: S.current, by: '' });
    if (S.context && S.context.index > 0) S.context.index -= 1;
    play(S.history.pop(), { fromHistory: true });
  }

  function togglePlay() {
    if (!S.current || !playerReady) return;
    if (S.playing) { S.userPaused = true; player.pauseVideo(); }
    else { S.userPaused = false; player.playVideo(); }
  }

  function updatePlayButtons() {
    const ic = icon(S.playing ? 'pause' : 'play', 30);
    $('#c-play').innerHTML = ic;
    $('#mini-play').innerHTML = icon(S.playing ? 'pause' : 'play', 24);
  }

  function updateNowPlaying() {
    const s = S.current;
    if (!s) return;
    $('#np-thumb').src = s.thumb;
    $('#np-title').textContent = prettyTitle(s.title);
    const lyr = S.lyrics && S.lyrics.lines ? `<span class="badge ${S.lyrics.sync}">${esc(t(S.lyrics.sync === 'word' ? 'lyr_word' : 'lyr_line'))}</span>` : '';
    $('#np-sub').innerHTML = lyr + `<span>${esc(s.channel)}</span>`;
    $('#mini-thumb').src = s.thumb;
    $('#mini-title').textContent = prettyTitle(s.title);
    updateFavButton();
  }

  function updateFavButton() {
    const saved = S.current && lib.playlists.some((p) => p.songs.includes(S.current.id));
    $('#fav-btn').classList.toggle('on', !!saved);
    $('#fav-btn').innerHTML = saved
      ? icon('heart', 22).replace('fill="none"', 'fill="currentColor"')
      : icon('heart', 22);
  }

  function updateMini() {
    const show = !!S.current && S.view !== 'player';
    $('#mini').hidden = !show;
    document.body.classList.toggle('has-mini', show);
  }

  $('#c-play').addEventListener('click', togglePlay);
  $('#c-next').addEventListener('click', () => next(false));
  $('#c-prev').addEventListener('click', prev);
  $('#mini-play').addEventListener('click', togglePlay);
  $('#mini-next').addEventListener('click', () => next(false));
  $('#mini-open').addEventListener('click', () => go('player'));
  $('#mini-thumb').addEventListener('click', () => go('player'));
  $('#fav-btn').addEventListener('click', () => S.current && openPlaylistPicker(S.current));

  const seek = $('#seek');
  let seeking = false;
  seek.addEventListener('input', () => { seeking = true; seek.style.setProperty('--pct', seek.value + '%'); });
  seek.addEventListener('change', () => {
    seeking = false;
    if (!playerReady || !S.current) return;
    const d = player.getDuration() || S.current.duration;
    player.seekTo((seek.value / 100) * d, true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Lyrics: fetch, render, tick
  // ─────────────────────────────────────────────────────────────────────────
  function toRecord(c) {
    return { source: c.source, sync: c.sync, title: c.title, artist: c.artist, duration: c.duration, lines: c.lines, offset: 0 };
  }

  function lyricsQuery(song) {
    return '/api/lyrics?' + new URLSearchParams({ title: song.title, channel: song.channel || '', duration: song.duration || 0 });
  }

  async function fetchBestLyrics(song) {
    const data = await api(lyricsQuery(song));
    S.candCache[song.id] = data;
    const rec = data.candidates.length ? toRecord(data.candidates[0]) : { none: true, at: Date.now() };
    await idb.set(song.id, rec);
    setLibLyr(song.id, rec);
    return rec;
  }

  function setLibLyr(id, rec) {
    if (!lib.songs[id]) return;
    lib.songs[id].lyr = rec && rec.lines ? rec.sync : 'none';
    saveLib(true);
  }

  async function loadLyricsFor(song) {
    const id = song.id;
    S.lyrics = null;
    S.lyrState = 'loading';
    renderLyrics();
    let rec = await idb.get(id);
    // Retry "not found" after a day — lyric sites add songs all the time.
    if (rec && rec.none && Date.now() - rec.at > 86400000) rec = null;
    if (!rec) {
      try { rec = await fetchBestLyrics(song); }
      catch (e) { if (S.current && S.current.id === id) { S.lyrState = 'error'; renderLyrics(); } return; }
    }
    if (!S.current || S.current.id !== id) return;
    setLyrics(rec);
  }

  function setLyrics(rec) {
    S.lyrics = rec;
    S.lyrState = rec && rec.lines ? 'ready' : 'none';
    renderLyrics();
    updateNowPlaying();
    updateOffset();
  }

  function renderLyrics() {
    const scroll = $('#lyr-scroll');
    const status = $('#lyr-status');
    S.curLine = -2;
    if (S.lyrState === 'loading') {
      status.innerHTML = `<div class="spinner" style="margin:0 auto 14px"></div>${esc(t('fetching_lyrics'))}`;
    } else if (S.lyrState === 'none' || S.lyrState === 'error') {
      status.innerHTML = `<div>${esc(t('lyrics_not_found'))}</div><button class="btn btn-ghost" id="lyr-status-btn">${icon('search', 20)}${esc(t('choose_lyrics'))}</button>`;
      $('#lyr-status-btn').onclick = () => openLyricsChooser(S.current);
    } else status.innerHTML = '';
    if (!S.lyrics || !S.lyrics.lines) { scroll.innerHTML = ''; S.lineEls = []; S.wordEls = []; return; }
    scroll.innerHTML = S.lyrics.lines.map((l, i) => {
      const inner = l.words && l.words.length
        ? l.words.map((w) => `<span class="w">${esc(w.text)}</span>`).join('')
        : `<span class="w">${esc(l.text)}</span>`;
      return `<p class="lyr-line" data-i="${i}">${inner}</p>`;
    }).join('');
    S.lineEls = Array.from(scroll.children);
    S.wordEls = S.lineEls.map((el) => Array.from(el.children));
    setCurrentLine(-1);
  }

  function findLine(tms) {
    const lines = S.lyrics.lines;
    let lo = 0, hi = lines.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].t <= tms) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  function setCurrentLine(i) {
    S.curLine = i;
    const n = S.lineEls.length;
    const far = S.mode === 'video' ? 2 : 99;
    for (let k = 0; k < n; k++) {
      const c = S.lineEls[k].classList;
      c.toggle('past', k < i);
      c.toggle('current', k === i);
      c.toggle('next', k === i + 1);
      c.toggle('far', k < i - 1 || k > i + far);
    }
    recenter();
    clearTimeout(setCurrentLine.t);
    setCurrentLine.t = setTimeout(recenter, 380); // font-size transition changes positions
    const line = i >= 0 && S.lyrics && S.lyrics.lines[i];
    $('#mini-line').textContent = line ? line.text : '';
  }

  function recenter() {
    if (!S.lineEls.length) return;
    const el = S.lineEls[Math.max(0, S.curLine)];
    if (!el) return;
    $('#lyr-scroll').style.transform = `translateY(${-(el.offsetTop + el.offsetHeight / 2)}px)`;
  }

  function tickLyrics(ms) {
    if (!S.lyrics || !S.lyrics.lines || !S.lineEls.length) return;
    const lines = S.lyrics.lines;
    const tm = ms + (S.lyrics.offset || 0);
    const i = findLine(tm);
    if (i !== S.curLine) setCurrentLine(i);
    if (i >= 0) {
      const l = lines[i];
      const spans = S.wordEls[i];
      if (l.words && l.words.length) {
        for (let k = 0; k < l.words.length; k++) {
          const w = l.words[k];
          const p = clamp((tm - w.t) / Math.max(w.d, 1));
          if (spans[k]._p !== p) { spans[k]._p = p; spans[k].style.setProperty('--p', p.toFixed(3)); }
        }
      } else {
        // Line-synced lyrics: sweep the fill across the line at a natural singing pace.
        const dur = Math.min(l.d || 4000, Math.max(1500, l.text.length * 260));
        const p = clamp((tm - l.t) / dur);
        if (spans[0]._p !== p) { spans[0]._p = p; spans[0].style.setProperty('--p', p.toFixed(3)); }
      }
    }
    // Countdown dots before the first line and after long instrumental gaps.
    const nx = lines[i + 1];
    let showDots = false, lit = 0;
    if (nx) {
      const prevEnd = i >= 0 ? lines[i].t + (lines[i].d || 0) : 0;
      const gapLong = i < 0 || nx.t - prevEnd > 6000;
      const until = nx.t - tm;
      if (gapLong && tm > prevEnd && until > 0 && until < 3600) { showDots = true; lit = Math.ceil(until / 1200); }
    }
    const cd = $('#lyr-countdown');
    if (cd._on !== showDots || cd._lit !== lit) {
      cd._on = showDots; cd._lit = lit;
      cd.classList.toggle('on', showDots);
      Array.from(cd.children).forEach((d, k) => d.classList.toggle('lit', k < lit));
    }
  }

  // Tap a line to make it the current one (re-sync).
  $('#lyr-scroll').addEventListener('click', (e) => {
    const el = e.target.closest('.lyr-line');
    if (!el || !S.lyrics || !S.lyrics.lines) return;
    const line = S.lyrics.lines[+el.dataset.i];
    S.lyrics.offset = Math.round(line.t - nowMs() + 30);
    idb.set(S.current.id, S.lyrics);
    el.classList.remove('tapped'); void el.offsetWidth; el.classList.add('tapped');
    updateOffset();
    toast(t('synced_toast'), 1400);
  });

  function updateOffset() {
    const o = (S.lyrics && S.lyrics.offset) || 0;
    $('#off-val').textContent = (o > 0 ? '+' : '') + (o / 1000).toFixed(1) + 's';
  }
  function nudge(ms) {
    if (!S.lyrics || !S.lyrics.lines) return;
    S.lyrics.offset = (S.lyrics.offset || 0) + ms;
    idb.set(S.current.id, S.lyrics);
    updateOffset();
  }
  $('#off-minus').addEventListener('click', () => nudge(-500));
  $('#off-plus').addEventListener('click', () => nudge(500));

  // Animation loop
  let lastUi = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!S.current || !playerReady) return;
    const ms = nowMs();
    tickLyrics(ms);
    if (ts - lastUi > 250) {
      lastUi = ts;
      const d = (player.getDuration && player.getDuration()) || S.current.duration || 0;
      $('#t-cur').textContent = fmtTime(ms / 1000);
      $('#t-dur').textContent = fmtTime(d);
      if (!seeking && d) { const pct = Math.min(100, (ms / 10) / d); seek.value = pct; seek.style.setProperty('--pct', pct + '%'); }
    }
  }
  requestAnimationFrame(frame);

  // ─────────────────────────────────────────────────────────────────────────
  // Lyrics chooser
  // ─────────────────────────────────────────────────────────────────────────
  async function openLyricsChooser(song) {
    if (!song) return;
    const cur = await idb.get(song.id);
    const body = openModal(t('choose_lyrics'), `
      <form class="inline" id="lc-form">
        <input class="field" id="lc-q" data-i18n-ph="manual_search" placeholder="${esc(t('manual_search'))}">
        <button class="btn btn-primary" type="submit">${icon('search', 20)}</button>
      </form>
      <div id="lc-list"><div class="spinner"></div></div>
      ${cur && cur.lines ? `<button class="btn btn-ghost" id="lc-remove">${icon('trash', 18)}${esc(t('remove_lyrics'))}</button>` : ''}`);

    const list = $('#lc-list', body);
    let cands = [];
    const show = (data) => {
      cands = data.candidates;
      if (!cands.length) { list.innerHTML = `<div class="empty" style="padding:30px"><p>${esc(t('lyrics_not_found'))}</p></div>`; return; }
      list.innerHTML = cands.map((c, i) => {
        const inUse = cur && cur.lines && cur.source === c.source && cur.lines.length === c.lines.length && cur.lines[0].t === c.lines[0].t;
        const diff = song.duration && c.duration ? Math.abs(c.duration - song.duration) : null;
        return `<div class="cand ${inUse ? 'inuse' : ''}" style="margin-bottom:10px">
          <div class="grow">
            <div class="t">${esc(c.title)} <span style="color:var(--text-dim);font-weight:600">· ${esc(c.artist)}</span></div>
            <div class="s"><span class="badge ${c.sync}">${esc(t(c.sync === 'word' ? 'lyr_word' : 'lyr_line'))}</span><span>${esc(c.source === 'kugou' ? 'Kugou' : 'LRCLIB')}</span><span>${fmtTime(c.duration)}</span>${diff !== null ? `<span>${esc(t('sec_diff', { d: diff }))}</span>` : ''}</div>
            <div class="pv">${esc(c.lines.slice(0, 3).map((l) => l.text).join(' / '))}</div>
          </div>
          <button class="btn ${inUse ? 'btn-ghost' : 'btn-primary'}" data-use="${i}">${esc(t(inUse ? 'in_use' : 'use_this'))}</button>
        </div>`;
      }).join('');
    };
    const load = async (url) => {
      list.innerHTML = '<div class="spinner"></div>';
      try { show(await api(url)); } catch (e) { list.innerHTML = `<div class="empty" style="padding:30px"><p>${esc(t('search_error'))}</p></div>`; }
    };
    if (S.candCache[song.id]) show(S.candCache[song.id]);
    else load(lyricsQuery(song)).then(() => {});

    $('#lc-form', body).addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#lc-q', body).value.trim();
      if (q) { $('#lc-q', body).blur(); load('/api/lyrics?' + new URLSearchParams({ q, duration: song.duration || 0 })); }
    });
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-use]');
      if (!b) return;
      const rec = toRecord(cands[+b.dataset.use]);
      await idb.set(song.id, rec);
      setLibLyr(song.id, rec);
      if (S.current && S.current.id === song.id) setLyrics(rec);
      closeModal();
      if (S.view === 'library') renderLibrary();
    });
    const rm = $('#lc-remove', body);
    if (rm) rm.addEventListener('click', async () => {
      const rec = { none: true, at: Date.now() };
      await idb.set(song.id, rec);
      setLibLyr(song.id, rec);
      if (S.current && S.current.id === song.id) setLyrics(rec);
      closeModal();
      toast(t('lyrics_removed'));
      if (S.view === 'library') renderLibrary();
    });
  }
  $('#lyr-btn').addEventListener('click', () => openLyricsChooser(S.current));

  // ─────────────────────────────────────────────────────────────────────────
  // Display modes
  // ─────────────────────────────────────────────────────────────────────────
  const MODE_ICONS = { video: 'video', lyrics: 'lyrics', karaoke: 'karaoke' };
  function renderModeSeg() {
    $$('#mode-seg button').forEach((b) => {
      b.innerHTML = icon(MODE_ICONS[b.dataset.mode], 20) + esc(t('mode_' + b.dataset.mode));
      b.classList.toggle('active', b.dataset.mode === S.mode);
    });
  }
  function setMode(m) {
    S.mode = m;
    $('#stage').dataset.mode = m;
    document.body.classList.toggle('karaoke', m === 'karaoke');
    renderModeSeg();
    if (S.curLine > -2) setCurrentLine(S.curLine);
    if (m === 'karaoke') {
      armAutoHide();
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    } else {
      document.body.classList.remove('controls-hidden');
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }
  $('#mode-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
  $('#exit-karaoke').addEventListener('click', () => setMode('video'));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && S.mode === 'karaoke') setTimeout(recenter, 100); });
  window.addEventListener('resize', () => setTimeout(recenter, 100));

  let hideTimer;
  function armAutoHide() {
    document.body.classList.remove('controls-hidden');
    clearTimeout(hideTimer);
    if (S.mode === 'karaoke') hideTimer = setTimeout(() => document.body.classList.add('controls-hidden'), 4000);
  }
  ['pointerdown', 'pointermove'].forEach((ev) => document.addEventListener(ev, () => { if (S.mode === 'karaoke') armAutoHide(); }, { passive: true }));

  // Same best-effort heuristic as the car's own browser behaviour: if the tab gets hidden while
  // a video is showing, switch to lyrics so audio + lyrics carry on.
  let forcedByHide = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.mode === 'video' && S.current) { forcedByHide = true; setMode('lyrics'); }
    else if (!document.hidden && forcedByHide) { forcedByHide = false; setMode('video'); }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Playlists
  // ─────────────────────────────────────────────────────────────────────────
  function addToPlaylist(plId, song) {
    const pl = getPl(plId);
    if (!pl) return;
    if (pl.songs.includes(song.id)) { toast(t('toast_already', { name: plName(pl) })); return; }
    const prevLyr = lib.songs[song.id] && lib.songs[song.id].lyr;
    lib.songs[song.id] = Object.assign(songMeta(song), prevLyr ? { lyr: prevLyr } : {});
    pl.songs.push(song.id);
    saveLib();
    toast(t('toast_saved', { name: plName(pl) }));
    updateFavButton();
    if (!prevLyr) idb.get(song.id).then((rec) => { if (rec) setLibLyr(song.id, rec); });
    if (S.view === 'library') renderLibrary();
  }

  function newPlaylist(name) {
    const pl = { id: 'p' + Date.now().toString(36), name: name.trim().slice(0, 40), songs: [] };
    lib.playlists.push(pl);
    saveLib();
    return pl;
  }

  function askName(title, initial, cb) {
    const body = openModal(title, `<form class="inline" id="nm-form"><input class="field" id="nm" maxlength="40" value="${esc(initial || '')}"><button class="btn btn-primary" type="submit">${esc(t('ok'))}</button></form>`);
    const input = $('#nm', body);
    setTimeout(() => input.focus(), 50);
    $('#nm-form', body).addEventListener('submit', (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) return; closeModal(); cb(v); });
  }

  function openPlaylistPicker(song) {
    const body = openModal(t('add_playlist'), lib.playlists.map((p) => `
      <button class="opt" data-pl="${esc(p.id)}"><span class="pl-cover">${icon('list', 22)}</span><span class="grow"><div class="t">${esc(plName(p))}</div><div class="s">${esc(t('songs_count', { n: p.songs.length }))}</div></span>${p.songs.includes(song.id) ? icon('check', 22) : ''}</button>`).join('') +
      `<button class="opt" data-pl="__new"><span class="pl-cover" style="background:var(--surface-3)">${icon('plus', 22)}</span><span class="grow t">${esc(t('new_playlist'))}</span></button>`);
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pl]');
      if (!b) return;
      if (b.dataset.pl === '__new') askName(t('playlist_name_prompt'), '', (name) => addToPlaylist(newPlaylist(name).id, song));
      else { closeModal(); addToPlaylist(b.dataset.pl, song); }
    });
  }

  function renderLibrary() {
    if (!getPl(S.plSel)) S.plSel = lib.playlists[0].id;
    $('#pl-list').innerHTML = lib.playlists.map((p) => `
      <button class="pl-item ${p.id === S.plSel ? 'active' : ''}" data-sel="${esc(p.id)}">
        <span class="pl-cover">${icon(p.id === 'fav' ? 'heart' : 'list', 22)}</span>
        <span><div class="pl-name">${esc(plName(p))}</div><div class="pl-count">${esc(t('songs_count', { n: p.songs.length }))}</div></span>
      </button>`).join('');
    const pl = getPl(S.plSel);
    const songs = pl.songs.map((id) => lib.songs[id]).filter(Boolean);
    const rows = songs.length ? songs.map((s, i) => {
      const lyr = s.lyr || '';
      const badge = lyr ? `<span class="badge ${lyr}">${esc(t(lyr === 'word' ? 'lyr_word' : lyr === 'line' ? 'lyr_line' : 'lyr_none'))}</span>` : '';
      return `<div class="row ${S.current && S.current.id === s.id ? 'playing' : ''}" data-i="${i}">
        <div class="row-n">${i + 1}</div>
        <img src="${esc(s.thumb)}" alt="" data-r="play">
        <div style="min-width:0"><div class="row-title">${esc(prettyTitle(s.title))}</div><div class="row-sub">${badge}<span>${esc(s.channel)}</span><span>${fmtTime(s.duration)}</span></div></div>
        <div class="row-actions">
          <button class="ctrl" data-r="play" aria-label="${esc(t('play_now'))}">${icon('play', 20)}</button>
          <button class="ctrl" data-r="next" aria-label="${esc(t('play_next'))}">${icon('playnext', 20)}</button>
          <button class="ctrl" data-r="queue" aria-label="${esc(t('add_queue'))}">${icon('plus', 20)}</button>
          <button class="ctrl" data-r="lyrics" aria-label="${esc(t('lyrics_source'))}">${icon('lyrics', 20)}</button>
          <button class="ctrl" data-r="remove" aria-label="${esc(t('remove'))}">${icon('trash', 18)}</button>
        </div>
      </div>`;
    }).join('') : `<div class="empty"><div class="big-ic">${icon('heart', 44)}</div><p>${esc(t('empty_playlist'))}</p></div>`;

    $('#pl-main').innerHTML = `
      <div class="pl-header">
        <div class="pl-header-text"><h2>${esc(plName(pl))}</h2><p class="muted">${esc(t('songs_count', { n: songs.length }))}</p></div>
        <div class="pl-actions">
          <button class="btn btn-primary" data-pa="playall" ${songs.length ? '' : 'disabled'}>${icon('play', 18)}${esc(t('play_all'))}</button>
          <button class="btn btn-ghost" data-pa="shuffle" ${songs.length ? '' : 'disabled'}>${icon('shuffle', 18)}${esc(t('shuffle'))}</button>
          <button class="btn btn-ghost" data-pa="lyrics" ${songs.length ? '' : 'disabled'}>${icon('lyrics', 18)}${esc(t('fetch_all_lyrics'))}</button>
          ${pl.id !== 'fav' ? `<button class="btn btn-ghost" data-pa="rename">${icon('edit', 18)}</button><button class="btn btn-ghost" data-pa="delete">${icon('trash', 18)}</button>` : ''}
        </div>
      </div>
      <div class="rows">${rows}</div>`;
  }

  $('#pl-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sel]');
    if (b) { S.plSel = b.dataset.sel; renderLibrary(); }
  });
  $('#pl-new').innerHTML = icon('plus', 26);
  $('#pl-new').addEventListener('click', () => askName(t('new_playlist'), '', (name) => { S.plSel = newPlaylist(name).id; renderLibrary(); }));

  $('#pl-main').addEventListener('click', async (e) => {
    const pl = getPl(S.plSel);
    const pa = e.target.closest('[data-pa]');
    if (pa) {
      const ids = pl.songs.filter((id) => lib.songs[id]);
      const a = pa.dataset.pa;
      if (a === 'playall') play(lib.songs[ids[0]], { context: { id: pl.id, index: 0 }, show: true });
      else if (a === 'shuffle') {
        const order = ids.slice().sort(() => Math.random() - 0.5);
        S.queue = order.slice(1).map((id) => ({ song: songMeta(lib.songs[id]), by: '' }));
        play(lib.songs[order[0]], { context: null, show: true });
      } else if (a === 'rename') askName(t('rename'), pl.name, (name) => { pl.name = name; saveLib(); renderLibrary(); });
      else if (a === 'delete') {
        confirmModal(t('delete_confirm', { name: plName(pl) }), () => {
          lib.playlists = lib.playlists.filter((p) => p.id !== pl.id);
          gcSongs();
          saveLib();
          S.plSel = 'fav';
          renderLibrary();
        });
      } else if (a === 'lyrics') fetchAllLyrics(ids);
      return;
    }
    const r = e.target.closest('[data-r]');
    if (!r) return;
    const i = +r.closest('.row').dataset.i;
    const ids = pl.songs.filter((id) => lib.songs[id]);
    const song = lib.songs[ids[i]];
    const a = r.dataset.r;
    if (a === 'play') play(song, { context: { id: pl.id, index: pl.songs.indexOf(song.id) }, show: true });
    else if (a === 'next') enqueue(song, '', true);
    else if (a === 'queue') enqueue(song, '', false);
    else if (a === 'lyrics') openLyricsChooser(song);
    else if (a === 'remove') { pl.songs = pl.songs.filter((id) => id !== song.id); gcSongs(); saveLib(); renderLibrary(); updateFavButton(); }
  });

  function gcSongs() {
    const used = new Set(lib.playlists.flatMap((p) => p.songs));
    Object.keys(lib.songs).forEach((id) => { if (!used.has(id)) delete lib.songs[id]; });
  }

  let fetchingAll = false;
  async function fetchAllLyrics(ids) {
    if (fetchingAll) return;
    fetchingAll = true;
    const todo = ids.filter((id) => !lib.songs[id].lyr || lib.songs[id].lyr === 'none');
    let ok = ids.length - todo.length;
    for (let i = 0; i < todo.length; i++) {
      toast(t('fetch_all_progress', { i: i + 1, n: todo.length }), 60000);
      try { const rec = await fetchBestLyrics(lib.songs[todo[i]]); if (rec.lines) ok++; } catch (e) { /* keep going */ }
      if (S.view === 'library') renderLibrary();
    }
    fetchingAll = false;
    toast(t('fetch_all_done', { ok, n: ids.length }), 3500);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Hot songs
  // ─────────────────────────────────────────────────────────────────────────
  function renderHot() {
    const cats = Object.keys(window.HOT_SONGS);
    $('#hot-cats').innerHTML = cats.map((c) => `<button class="chip ${c === S.hotCat ? 'active' : ''}" data-cat="${c}">${esc(t(c))}</button>`).join('');
    $('#hot-grid').innerHTML = window.HOT_SONGS[S.hotCat].map(([title, artist], i) => `
      <button class="hot-card" data-q="${esc(title + ' ' + artist)}"><span class="hot-rank">${i + 1}</span><span><div class="hot-title">${esc(title)}</div><div class="hot-artist">${esc(artist)}</div></span></button>`).join('');
  }
  $('#hot-cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { S.hotCat = b.dataset.cat; renderHot(); } });
  $('#hot-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) { go('search'); doSearch(b.dataset.q); } });

  // ─────────────────────────────────────────────────────────────────────────
  // Passenger room (QR song requests)
  // ─────────────────────────────────────────────────────────────────────────
  let room = store.get('kc.room', null);
  let es = null;
  let countdownTimer = null;

  async function createRoom() {
    room = await api('/api/room', { method: 'POST', body: {} });
    store.set('kc.room', room);
    connectRoom();
  }

  async function refreshToken() {
    try {
      const r = await api(`/api/room/${room.id}/token`, { body: { key: room.key } });
      room.token = r.token; room.expires = r.expires;
      store.set('kc.room', room);
    } catch (e) {
      if (e.status === 404 || e.status === 403) await createRoom(); else throw e;
    }
  }

  async function openGuests() {
    const box = $('#qr-box');
    $('#qr-refresh').innerHTML = icon('refresh', 20) + esc(t('guests_refresh'));
    renderGuestLog();
    try {
      if (!room) { box.className = 'qr-box'; box.textContent = t('guests_creating'); await createRoom(); }
      else if (Date.now() > room.expires - 60000) await refreshToken();
      if (!es) connectRoom();
      renderQR();
    } catch (e) {
      box.className = 'qr-box expired';
      box.textContent = t('guests_error');
    }
  }

  function guestUrl() {
    return `${location.origin}/guest?r=${encodeURIComponent(room.id)}&t=${encodeURIComponent(room.token)}&lang=${I18N.lang}`;
  }

  function renderQR() {
    const box = $('#qr-box');
    box.className = 'qr-box';
    const qr = qrcode(0, 'M');
    qr.addData(guestUrl());
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
    clearInterval(countdownTimer);
    const tick = () => {
      const left = room.expires - Date.now();
      if (left <= 0) {
        clearInterval(countdownTimer);
        $('#qr-countdown').textContent = '0:00';
        box.className = 'qr-box expired';
        box.textContent = t('guests_expired');
        return;
      }
      $('#qr-countdown').textContent = fmtTime(left / 1000);
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  $('#qr-refresh').addEventListener('click', async () => {
    try { if (!room) await createRoom(); else await refreshToken(); renderQR(); }
    catch (e) { toast(t('guests_error')); }
  });

  let esFails = 0;
  function connectRoom() {
    if (es) es.close();
    if (!room) return;
    es = new EventSource(`/api/room/${encodeURIComponent(room.id)}/events?key=${encodeURIComponent(room.key)}`);
    es.addEventListener('open', () => { esFails = 0; publishState(); });
    es.addEventListener('add', (e) => {
      const item = JSON.parse(e.data);
      const by = item.by || t('guest_anonymous');
      enqueue(item.song, by, item.next, true);
      toast(t('guest_request_toast', { by, title: prettyTitle(item.song.title) }), 3500);
      S.guestLog.unshift({ song: item.song, by, at: Date.now() });
      S.guestLog = S.guestLog.slice(0, 20);
      store.set('kc.guestlog', S.guestLog);
      if (S.view === 'guests') renderGuestLog();
    });
    es.addEventListener('guests', (e) => {
      const n = JSON.parse(e.data).count;
      const pill = $('#guest-pill');
      pill.hidden = !n;
      pill.textContent = `${t('nav_guests')} · ${n}`;
    });
    es.addEventListener('error', () => {
      esFails++;
      // The server may have restarted and lost the room: make a new one.
      if (esFails === 3) {
        api(`/api/room/${room.id}/state`, { body: { key: room.key } }).catch((err) => {
          if (err.status === 404 || err.status === 403) { es.close(); es = null; createRoom().then(() => { if (S.view === 'guests') renderQR(); }); }
        });
      }
    });
  }

  function renderGuestLog() {
    const box = $('#guest-log');
    box.innerHTML = S.guestLog.length ? S.guestLog.map((g) => `
      <div class="log-item"><img src="${esc(g.song.thumb)}" alt=""><div style="min-width:0"><div class="t">${esc(prettyTitle(g.song.title))}</div><div class="s">${esc(g.by)} · ${new Date(g.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div></div>`).join('')
      : `<p class="muted">${esc(t('guests_none'))}</p>`;
  }

  let pubTimer;
  function publishState() {
    if (!room) return;
    clearTimeout(pubTimer);
    pubTimer = setTimeout(() => {
      api(`/api/room/${room.id}/state`, { body: { key: room.key, now: S.current, queue: S.queue.map((q) => Object.assign({}, q.song, { by: q.by })) } }).catch(() => {});
    }, 300);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cross-device playlist sync
  // ─────────────────────────────────────────────────────────────────────────
  let syncCode = store.get('kc.sync', '');

  function libForSync() {
    // Lyric badges describe this device's lyric cache, so don't sync them.
    const songs = {};
    Object.values(lib.songs).forEach((s) => { songs[s.id] = songMeta(s); });
    return { updated: lib.updated, playlists: lib.playlists, songs };
  }

  async function syncPush() {
    if (!syncCode) return;
    try { await api('/api/lib/' + syncCode, { method: 'PUT', body: { data: libForSync() } }); } catch (e) { /* retry on next change */ }
  }

  async function syncPull() {
    if (!syncCode) return;
    try {
      const r = await api('/api/lib/' + syncCode);
      if (r.data && r.data.updated > lib.updated) {
        Object.values(r.data.songs).forEach((s) => { if (lib.songs[s.id] && lib.songs[s.id].lyr) s.lyr = lib.songs[s.id].lyr; });
        lib = r.data;
        store.set('kc.lib', lib);
        if (S.view === 'library') renderLibrary();
        updateFavButton();
      } else if (r.data && r.data.updated < lib.updated) syncPush();
    } catch (e) { /* offline */ }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Modal, settings
  // ─────────────────────────────────────────────────────────────────────────
  function openModal(title, html) {
    $('#modal-title').textContent = title;
    const old = $('#modal-body');
    const body = old.cloneNode(false); // drop old listeners
    old.replaceWith(body);
    body.innerHTML = html;
    $('#modal').hidden = false;
    return body;
  }
  function closeModal() { $('#modal').hidden = true; }
  function confirmModal(msg, onOk) {
    const body = openModal(msg, `<div class="inline"><button class="btn btn-ghost" id="cf-no" style="flex:1">${esc(t('cancel'))}</button><button class="btn btn-primary" id="cf-yes" style="flex:1">${esc(t('ok'))}</button></div>`);
    $('#cf-no', body).onclick = closeModal;
    $('#cf-yes', body).onclick = () => { closeModal(); onOk(); };
  }
  $('#modal-close').innerHTML = icon('close', 24);
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

  function openSettings() {
    const size = store.get('kc.size', 'm');
    const body = openModal(t('settings'), `
      <div class="set-row"><span class="label">${esc(t('language'))}</span>
        <div class="lang-grid">${Object.entries(I18N.LANGS).map(([k, v]) => `<button class="chip ${k === I18N.lang ? 'active' : ''}" data-lang="${k}">${esc(v)}</button>`).join('')}</div></div>
      <div class="set-row"><span class="label">${esc(t('lyric_size'))}</span>
        <div class="lang-grid">${['s', 'm', 'l'].map((k) => `<button class="chip ${k === size ? 'active' : ''}" data-size="${k}">${esc(t('size_' + k))}</button>`).join('')}</div></div>
      <div class="set-row"><div><div class="label">${esc(t('sync_title'))}</div><div class="desc">${esc(t('sync_desc'))}</div></div>
        <div id="sync-area"></div></div>
      <div class="set-row"><div><div class="label">${esc(t('tesla_fullscreen'))}</div><div class="desc">${esc(t('tesla_tip'))}</div></div>
        <button class="btn btn-ghost" id="tesla-fs">${icon('expand', 20)}${esc(t('tesla_fullscreen'))}</button></div>`);

    const renderSync = () => {
      const area = $('#sync-area', body);
      if (syncCode) {
        area.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><span class="code">${esc(syncCode)}</span><button class="btn btn-ghost btn-sm" id="sync-off">${esc(t('sync_off'))}</button></div>`;
        $('#sync-off', area).onclick = () => { syncCode = ''; store.set('kc.sync', ''); renderSync(); };
      } else {
        area.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-primary" id="sync-new">${icon('sync', 18)}${esc(t('sync_start'))}</button>
          <form class="inline" id="sync-form"><input class="field" id="sync-in" maxlength="8" placeholder="${esc(t('sync_enter'))}" style="text-transform:uppercase;width:220px"><button class="btn btn-ghost">${esc(t('sync_link'))}</button></form></div>`;
        $('#sync-new', area).onclick = async () => {
          try { const r = await api('/api/lib', { body: { data: libForSync() } }); syncCode = r.code; store.set('kc.sync', syncCode); renderSync(); }
          catch (e) { toast(t('search_error')); }
        };
        $('#sync-form', area).onsubmit = async (e) => {
          e.preventDefault();
          const code = $('#sync-in', area).value.trim().toUpperCase();
          try {
            const r = await api('/api/lib/' + code);
            syncCode = code; store.set('kc.sync', code);
            if (r.data) { lib = r.data; store.set('kc.lib', lib); }
            toast(t('sync_linked'));
            renderSync();
            if (S.view === 'library') renderLibrary();
          } catch (err) { toast(t('sync_bad')); }
        };
      }
    };
    renderSync();

    body.addEventListener('click', (e) => {
      const l = e.target.closest('[data-lang]');
      if (l) { I18N.set(l.dataset.lang); refreshLanguage(); openSettings(); return; }
      const s = e.target.closest('[data-size]');
      if (s) {
        store.set('kc.size', s.dataset.size);
        applySize();
        $$('[data-size]', body).forEach((b) => b.classList.toggle('active', b === s));
      }
    });
    $('#tesla-fs', body).onclick = () => { location.href = 'https://www.youtube.com/redirect?q=' + encodeURIComponent(location.href); };
  }
  $('#settings-btn').innerHTML = icon('gear', 26);
  $('#settings-btn').addEventListener('click', openSettings);

  function applySize() {
    const size = store.get('kc.size', 'm');
    document.body.classList.remove('lyr-s', 'lyr-m', 'lyr-l');
    document.body.classList.add('lyr-' + size);
    setTimeout(recenter, 400);
  }

  function refreshLanguage() {
    I18N.apply();
    renderTabs();
    renderModeSeg();
    renderQueue();
    $('#lyr-btn').innerHTML = icon('lyrics', 20) + esc(t('lyrics_source'));
    if (S.view === 'search') { if (S.lastResults.length) doSearch($('#search-input').value); else renderSearchHint(); }
    if (S.view === 'library') renderLibrary();
    if (S.view === 'hot') renderHot();
    if (S.view === 'guests') openGuests();
    if (S.lyrState !== 'ready') renderLyrics();
    updateNowPlaying();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────────────────────────────────
  $('.searchbar-ic').innerHTML = icon('search', 28);
  $('#c-prev').innerHTML = icon('prev', 26);
  $('#c-next').innerHTML = icon('next', 26);
  $('#mini-next').innerHTML = icon('next', 22);
  $('#off-minus').innerHTML = icon('minus', 20);
  $('#off-plus').innerHTML = icon('plus', 20);
  $('#exit-karaoke').innerHTML = icon('close', 28);
  $('#stage').classList.add('idle');
  if (/Tesla/i.test(navigator.userAgent)) document.documentElement.classList.add('tesla');
  updatePlayButtons();
  updateFavButton();
  applySize();
  refreshLanguage();
  go('search');
  if (room) connectRoom();
  syncPull();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncPull(); });
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (S.mode === 'karaoke') setMode('video'); }
  });
})();
