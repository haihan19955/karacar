// Passenger page: search YouTube and send songs to the car's queue.
(function () {
  const { icon, esc, fmtTime, api, store, toast, prettyTitle } = window.KC;
  const t = (k, v) => I18N.t(k, v);
  const $ = (s) => document.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const roomId = qs.get('r') || '';
  const token = qs.get('t') || '';
  let results = [];
  let state = { now: null, queue: [] };

  I18N.apply();
  $('#g-name').value = store.get('kc.guestname', '');
  $('#g-name').addEventListener('change', (e) => store.set('kc.guestname', e.target.value.trim()));

  function expired() {
    $('#g-main').innerHTML = `<div class="g-expired"><div class="big-ic" style="width:88px;height:88px;border-radius:26px;margin:0 auto 16px;display:grid;place-items:center;background:var(--surface-2);color:var(--pink)">${icon('qr', 40)}</div><p style="font-size:18px;font-weight:600">${esc(t('g_expired'))}</p></div>`;
  }

  function renderState() {
    $('#g-now').innerHTML = state.now ? `
      <div class="g-now"><img src="${esc(state.now.thumb)}" alt=""><div style="min-width:0"><div class="g-label">${esc(t('g_now'))}</div><div class="t">${esc(prettyTitle(state.now.title))}</div></div></div>` : '';
    $('#g-queue').innerHTML = state.queue.length ? `<h3>${esc(t('g_queue'))}</h3>` + state.queue.map((q, i) => `
      <div class="g-q"><span class="n">${i + 1}</span><span class="t">${esc(prettyTitle(q.title))}</span>${q.by ? `<span class="badge by">${esc(q.by)}</span>` : ''}</div>`).join('') : '';
  }

  if (!roomId || !token) { expired(); return; }

  let fails = 0;
  const es = new EventSource(`/api/room/${encodeURIComponent(roomId)}/events?token=${encodeURIComponent(token)}`);
  es.addEventListener('state', (e) => { fails = 0; state = JSON.parse(e.data); renderState(); });
  es.addEventListener('error', () => { if (++fails >= 2) { es.close(); expired(); } });

  async function search(q) {
    q = q.trim();
    if (!q) return;
    $('#g-q').blur();
    const box = $('#g-res');
    box.innerHTML = '<div class="spinner"></div>';
    try {
      results = (await api('/api/search?q=' + encodeURIComponent(q))).results;
      box.innerHTML = results.length ? results.map((s, i) => `
        <div class="g-item" data-i="${i}">
          <img src="${esc(s.thumb)}" alt="" loading="lazy">
          <div style="min-width:0"><div class="t">${esc(s.title)}</div><div class="s">${esc(s.channel)} · ${fmtTime(s.duration)}</div></div>
          <div class="acts">
            <button class="btn btn-primary" data-add="queue">${icon('plus', 18)}${esc(t('g_add'))}</button>
            <button class="btn btn-ghost" data-add="next">${icon('playnext', 18)}${esc(t('g_next'))}</button>
          </div>
        </div>`).join('') : `<p class="muted" style="text-align:center;padding:30px">${esc(t('no_results'))}</p>`;
    } catch (e) {
      box.innerHTML = `<p class="muted" style="text-align:center;padding:30px">${esc(t('search_error'))}</p>`;
    }
  }

  $('#g-form').addEventListener('submit', (e) => { e.preventDefault(); search($('#g-q').value); });
  $('#g-res').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-add]');
    if (!b || b.classList.contains('done')) return;
    const song = results[+b.closest('.g-item').dataset.i];
    try {
      await api(`/api/room/${encodeURIComponent(roomId)}/add`, { body: { token, song, by: $('#g-name').value.trim(), next: b.dataset.add === 'next' } });
      b.classList.add('done');
      b.innerHTML = icon('check', 18) + esc(t('g_added'));
      toast(t('g_added'));
    } catch (err) {
      if (err.status === 403) expired(); else toast(t('search_error'));
    }
  });
})();
