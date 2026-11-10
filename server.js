// KaraCar — Tesla karaoke server. Zero dependencies, Node 18+.
// Serves the static app and a small JSON API:
//   GET  /api/search?q=            YouTube search (innertube, or Data API if YT_API_KEY is set)
//   GET  /api/lyrics?title=&artist=&channel=&duration=   lyric candidates (Kugou + NetEase word-level, LRCLIB line-level)
//   GET  /api/instrumental?title=&channel=&duration=&id=  matching backing-track video, if any
//   POST /api/room                 create a passenger room  -> {id, key, token, expires}
//   POST /api/room/:id/token       refresh guest token (car key)
//   POST /api/room/:id/state       car publishes now-playing + queue (car key)
//   POST /api/room/:id/add         guest adds a song (guest token)
//   GET  /api/room/:id/events      SSE stream (car: ?key=, guest: ?token=)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 8080;
const YT_API_KEY = process.env.YT_API_KEY || '';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const GUEST_TOKEN_TTL = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// ---------------------------------------------------------------------------
// Abuse protection: per-IP fixed-window rate limits and global caps.
// Behind Render or a Cloudflare Tunnel the client IP arrives in cf-connecting-ip.
// ---------------------------------------------------------------------------
const LIMITS = {
  search: [40, 60e3], lyrics: [40, 60e3], roomNew: [10, 3600e3], room: [240, 60e3],
  guestAdd: [30, 60e3], libNew: [5, 3600e3], lib: [120, 60e3]
};
const MAX_ROOMS = 5000;
const MAX_LIBS = 20000;
const MAX_GUESTS_PER_ROOM = 30;
const hits = new Map();

function clientIp(req) {
  const fwd = req.headers['cf-connecting-ip'] || req.headers['true-client-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0];
  return String(fwd || req.socket.remoteAddress || '').trim();
}

function limited(req, bucket) {
  const [max, windowMs] = LIMITS[bucket];
  const key = bucket + '|' + clientIp(req);
  const now = Date.now();
  let h = hits.get(key);
  if (!h || now > h.reset) {
    if (hits.size > 100000) hits.clear();
    h = { n: 0, reset: now + windowMs };
    hits.set(key, h);
  }
  return ++h.n > max;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, h] of hits) if (now > h.reset) hits.delete(k);
}, 60e3).unref();

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self' https://www.youtube.com https://s.ytimg.com https://cdnjs.cloudflare.com",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    "img-src 'self' data: https://i.ytimg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
};

const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = fn().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { exp: Date.now() + ttlMs, value });
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return value;
}

function parseDuration(text) {
  if (!text) return 0;
  return text.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
}

// ---------------------------------------------------------------------------
// YouTube search
// ---------------------------------------------------------------------------
async function searchInnertube(q) {
  const res = await fetchWithTimeout('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: '2.20241010.00.00', hl: 'zh-TW', gl: 'TW' } },
      query: q,
      params: 'EgIQAQ%3D%3D' // videos only
    })
  });
  if (!res.ok) throw new Error('youtube ' + res.status);
  const json = await res.json();
  const out = [];
  JSON.stringify(json, (k, v) => {
    if (k === 'videoRenderer' && v && v.videoId && v.lengthText) {
      out.push({
        id: v.videoId,
        title: (v.title?.runs || []).map((r) => r.text).join(''),
        channel: v.ownerText?.runs?.[0]?.text || '',
        duration: parseDuration(v.lengthText.simpleText),
        thumb: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`
      });
    }
    return v;
  });
  return out.slice(0, 20);
}

async function searchDataApi(q) {
  const u = new URL('https://www.googleapis.com/youtube/v3/search');
  u.search = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '20', q, key: YT_API_KEY });
  const s = await (await fetchWithTimeout(u)).json();
  if (s.error) throw new Error(s.error.message);
  const ids = s.items.map((i) => i.id.videoId);
  const d = new URL('https://www.googleapis.com/youtube/v3/videos');
  d.search = new URLSearchParams({ part: 'contentDetails', id: ids.join(','), key: YT_API_KEY });
  const details = await (await fetchWithTimeout(d)).json();
  const dur = Object.fromEntries((details.items || []).map((v) => {
    const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(v.contentDetails.duration) || [];
    return [v.id, (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)];
  }));
  const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return s.items.map((i) => ({
    id: i.id.videoId,
    title: decode(i.snippet.title),
    channel: decode(i.snippet.channelTitle),
    duration: dur[i.id.videoId] || 0,
    thumb: `https://i.ytimg.com/vi/${i.id.videoId}/mqdefault.jpg`
  }));
}

async function searchYoutube(q) {
  if (YT_API_KEY) {
    try { return await searchDataApi(q); } catch (e) { console.warn('Data API failed, falling back:', e.message); }
  }
  return searchInnertube(q);
}

// ---------------------------------------------------------------------------
// Lyrics: title cleanup, Kugou KRC (word-level), LRCLIB (line-level)
// Unified format: { lines: [{ t, d, text, words?: [{ t, d, text }] }] }, all times in ms.
// ---------------------------------------------------------------------------
// Latin tags need word boundaries: "ver" must not hit "River", "Forever" or "Lover".
const NOISE_RE = /\b(?:official|mv|m\/v|lyrics?|audio|video|hd|4k|live|remaster(?:ed)?|karaoke|ktv|cover|flac|ver\.?|version|visuali[sz]er)\b|歌詞|歌词|動態|动态|伴奏|字幕|翻唱|純享|纯享|無損|无损|版/i;

export function cleanTitle(rawTitle, channel) {
  let t = String(rawTitle || '');
  // "Artist「Song」..." / "周杰倫 Jay Chou【晴天 Sunny Day】" — the bracket holds the song name.
  const quoted = /^([^「【『《\[]+?)\s*[「【『《]([^」】』》]+)[」】』》]/.exec(t);
  if (quoted && !NOISE_RE.test(quoted[2]) && !/[-–—]/.test(quoted[1])) {
    return { track: quoted[2].trim(), artist: quoted[1].trim() };
  }
  t = t.replace(/[【\[(（「『][^】\])）」』]*[】\])）」』]/g, (m) => {
    // Keep bracket content that looks like the actual song name (e.g. 周杰倫【晴天】), drop noise tags.
    const inner = m.slice(1, -1);
    return NOISE_RE.test(inner) ? ' ' : ` ${inner} `;
  });
  t = t.replace(/\b(feat\.?|ft\.?)\s+.+$/i, '');
  t = t.replace(/official\s*(music\s*)?video|lyric\s*video|official\s*mv|\bmv\b|\bm\/v\b/gi, ' ');
  t = t.replace(/[|｜].*$/, '');
  t = t.replace(/\s{2,}/g, ' ').trim();

  let artist = '';
  let track = t;
  const sep = /^(.+?)\s*[-–—]\s*(.+)$/.exec(t);
  if (sep) { artist = sep[1].trim(); track = sep[2].trim(); }
  else if (channel) artist = String(channel).replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').replace(/official/i, '').trim();
  return { track: track || t, artist };
}

const KRC_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];
const CREDIT_RE = /^\s*(lrc\s*制作|合声|合聲|和音|配唱|录音|統籌|统筹|母带|母帶|弦乐|弦樂|人声|人聲|歌词制作|歌詞製作|作词|作曲|编曲|編曲|作詞|制作人|製作人|监制|監製|词|詞|曲|原唱|演唱|歌手|混音|和声|和聲|吉他|贝斯|貝斯|鼓|录音|錄音|出品|发行|發行|op|sp|lyrics?|lyrics by|lyricist|composer|composed by|music by|arranger|arranged by|producer|produced by|written by|vocals?)[^:：]{0,4}\s*[:：]/i;

// Lyric files usually open with a "Song (version) - Artist" header line. Pull it out so it is not sung,
// and keep it to detect DJ/live/remix versions that would be out of sync with the video.
function splitHeader(lines) {
  let header = '';
  const first = lines[0];
  if (first && first.t < 20000 && first.text.length < 60 && /\S\s*[-–]\s*\S/.test(first.text)) { header = first.text; lines.shift(); }
  return { lines, header };
}

function parseKrc(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\[(\d+),(\d+)\](.*)$/.exec(raw);
    if (!m) continue;
    const start = +m[1];
    const words = [];
    const re = /<(\d+),(\d+),\d+>([^<]*)/g;
    let w;
    while ((w = re.exec(m[3]))) words.push({ t: start + +w[1], d: +w[2], text: w[3] });
    const lineText = words.map((x) => x.text).join('');
    if (!lineText.trim() || CREDIT_RE.test(lineText)) continue;
    lines.push({ t: start, d: +m[2], text: lineText, words });
  }
  return lines;
}

function parseLrc(text) {
  const lines = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    let body = raw.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '');
    let words;
    if (/<\d+:\d+(?:\.\d+)?>/.test(body)) {
      // Enhanced LRC: <mm:ss.xx>word
      words = [...body.matchAll(/<(\d+):(\d+(?:\.\d+)?)>([^<]*)/g)].map((m) => ({ t: Math.round((+m[1] * 60 + +m[2]) * 1000), text: m[3] }));
      words = words.filter((w) => w.text);
      words.forEach((w, i) => { w.d = words[i + 1] ? words[i + 1].t - w.t : 600; });
      body = words.map((w) => w.text).join('');
    }
    if (!body.trim() || CREDIT_RE.test(body)) continue;
    for (const s of stamps) lines.push({ t: Math.round((+s[1] * 60 + +s[2]) * 1000), text: body.trim(), words });
  }
  lines.sort((a, b) => a.t - b.t);
  lines.forEach((l, i) => { l.d = lines[i + 1] ? lines[i + 1].t - l.t : 5000; });
  return lines;
}

async function kugouCandidates(keyword, durationSec) {
  const params = { ver: 1, man: 'yes', client: 'pc', keyword };
  if (durationSec) params.duration = Math.round(durationSec * 1000);
  const s = await (await fetchWithTimeout('https://lyrics.kugou.com/search?' + new URLSearchParams(params))).json();
  const cands = (s.candidates || []).slice(0, 5);
  const out = await Promise.all(cands.map(async (c) => {
    try {
      const d = await (await fetchWithTimeout('https://lyrics.kugou.com/download?' + new URLSearchParams({
        ver: 1, client: 'pc', id: c.id, accesskey: c.accesskey, fmt: 'krc', charset: 'utf8'
      }))).json();
      if (!d.content) return null;
      const buf = Buffer.from(d.content, 'base64').subarray(4);
      for (let i = 0; i < buf.length; i++) buf[i] ^= KRC_KEY[i % 16];
      const { lines, header } = splitHeader(parseKrc(zlib.inflateSync(buf).toString('utf8')));
      if (lines.length < 4) return null;
      return { source: 'kugou', sync: 'word', title: c.song, artist: c.singer, version: header, duration: Math.round(c.duration / 1000), lines };
    } catch { return null; }
  }));
  return out.filter(Boolean);
}

async function lrclibCandidates(track, artist) {
  const params = { track_name: track };
  if (artist) params.artist_name = artist;
  let res = await fetchWithTimeout('https://lrclib.net/api/search?' + new URLSearchParams(params), { headers: { 'user-agent': 'KaraCar/1.0' } });
  let list = res.ok ? await res.json() : [];
  if (!list.length && artist) {
    res = await fetchWithTimeout('https://lrclib.net/api/search?' + new URLSearchParams({ q: `${track} ${artist}` }), { headers: { 'user-agent': 'KaraCar/1.0' } });
    list = res.ok ? await res.json() : [];
  }
  const seen = new Set();
  return list.filter((r) => r.syncedLyrics).filter((r) => {
    const k = r.syncedLyrics.slice(0, 400);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 4).map((r) => {
    const { lines, header } = splitHeader(parseLrc(r.syncedLyrics));
    return { source: 'lrclib', sync: lines.some((l) => l.words) ? 'word' : 'line', title: r.trackName, artist: r.artistName, version: header, duration: Math.round(r.duration || 0), lines };
  }).filter((c) => c.lines.length >= 4);
}

// NetEase Cloud Music: lyrics only (never audio). YRC lines look like
// [start,dur](t,d,0)word(t,d,0)word with absolute ms times.
const NE_HEADERS = { 'user-agent': UA, referer: 'https://music.163.com/' };
function parseYrc(text) {
  const lines = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const m = /^\[(\d+),(\d+)\](.*)$/.exec(raw);
    if (!m) continue;
    const words = [...m[3].matchAll(/\((\d+),(\d+),\d+\)([^(]*)/g)].map((w) => ({ t: +w[1], d: +w[2], text: w[3] }));
    const lineText = words.map((x) => x.text).join('');
    if (!lineText.trim() || CREDIT_RE.test(lineText)) continue;
    lines.push({ t: +m[1], d: +m[2], text: lineText, words });
  }
  return lines;
}

async function neteaseCandidates(keyword) {
  const s = await (await fetchWithTimeout('https://music.163.com/api/cloudsearch/pc?' + new URLSearchParams({ s: keyword, type: 1, limit: 5 }), { headers: NE_HEADERS })).json();
  const songs = (s.result && s.result.songs) || [];
  const out = await Promise.all(songs.map(async (song) => {
    try {
      const l = await (await fetchWithTimeout('https://music.163.com/api/song/lyric/v1?' + new URLSearchParams({ id: song.id, lv: 1, yv: 1, tv: 0, rv: 0, kv: 0 }), { headers: NE_HEADERS })).json();
      const yrc = l.yrc && l.yrc.lyric ? parseYrc(l.yrc.lyric) : [];
      const word = yrc.length >= 4;
      const { lines, header } = splitHeader(word ? yrc : parseLrc((l.lrc && l.lrc.lyric) || ''));
      if (lines.length < 4) return null;
      return {
        source: 'netease', sync: word ? 'word' : 'line', title: song.name,
        artist: (song.ar || []).map((a) => a.name).join(' / '), version: header || (song.alia || []).join(' '),
        duration: Math.round((song.dt || 0) / 1000), lines
      };
    } catch { return null; }
  }));
  return out.filter(Boolean);
}

const CJK_RE = /[぀-ヿ㐀-鿿가-힯]/;
// "晴天 Sunny Day" -> "晴天", "周杰倫 Jay Chou" -> "周杰倫"; leaves pure-latin names alone.
const stripLatin = (s) => {
  if (!CJK_RE.test(s)) return s;
  const out = s.replace(/[A-Za-z][A-Za-z0-9 .'&!?,]*/g, ' ').replace(/[()（）]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return out || s;
};
const latinOnly = (s) => (s.match(/[A-Za-z][A-Za-z0-9 .'&]*/g) || []).join(' ').trim();

async function lyricVariant(track, art, duration) {
  const keyword = art ? `${art} - ${track}` : track;
  const [kg, ne, lr] = await Promise.all([
    kugouCandidates(keyword, duration).catch(() => []),
    neteaseCandidates(art ? `${art} ${track}` : track).catch(() => []),
    lrclibCandidates(track, art).catch(() => [])
  ]);
  return [...kg, ...ne, ...lr];
}

// Find a backing-track (no vocals) upload of the same song on YouTube, close in length.
const INST_RE = /伴奏|伴唱|消音|去人声|去人聲|純音樂|纯音乐|instrumental|karaoke|off\s*vocal|inst\.?\b|カラオケ|オフボーカル|mr\b|노래방/i;
async function findInstrumental({ title, channel, duration, id }) {
  const { track, artist } = cleanTitle(title, channel);
  const base = `${stripLatin(artist)} ${stripLatin(track)}`.trim();
  const seen = new Set([id]);
  const picks = [];
  for (const q of [`${base} 伴奏`, `${base} instrumental karaoke`]) {
    for (const r of await searchYoutube(q).catch(() => [])) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      if (!INST_RE.test(r.title) || /cover|翻唱|live|现场|現場|remix|dj/i.test(r.title)) continue;
      const name = stripLatin(track).toLowerCase();
      if (name && !r.title.toLowerCase().includes(name)) continue;
      const diff = duration && r.duration ? Math.abs(r.duration - duration) : 30;
      if (diff > 20) continue;
      picks.push({ id: r.id, title: r.title, duration: r.duration, diff });
    }
    if (picks.length) break;
  }
  picks.sort((a, b) => a.diff - b.diff);
  return { alt: picks[0] || null };
}

// Fold the common traditional/simplified pairs seen in song titles so 周杰倫 matches 周杰伦.
const T2S = Object.fromEntries([...'倫們這個來時說話愛戀聽歡樂與為無風雲夢憶淚離開門間東車長龍鳳飛聲樂國華語會過還邊遠進對後裡見歲盡蘭陳張劉黃楊趙吳孫鄭謝蔣韓馮許鄧蕭葉蘇盧呂魏陸顏賴齊龐']
  .map((ch, i) => [ch, '伦们这个来时说话爱恋听欢乐与为无风云梦忆泪离开门间东车长龙凤飞声乐国华语会过还边远进对后里见岁尽兰陈张刘黄杨赵吴孙郑谢蒋韩冯许邓萧叶苏卢吕魏陆颜赖齐庞'[i]]));
const normName = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').replace(/./gu, (ch) => T2S[ch] || ch);
const contains = (hay, needle) => { const n = normName(needle); return n.length >= 2 && normName(hay).includes(n); };
// Dice coefficient over characters (CJK) / bigrams (latin); 1 = same name.
function similarity(a, b) {
  a = normName(a); b = normName(b);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 1;
  const grams = (s) => (CJK_RE.test(s) ? [...s] : Array.from({ length: Math.max(1, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
  const ga = grams(a), gb = grams(b);
  const pool = new Map();
  for (const g of gb) pool.set(g, (pool.get(g) || 0) + 1);
  let hit = 0;
  for (const g of ga) if (pool.get(g)) { hit++; pool.set(g, pool.get(g) - 1); }
  return (2 * hit) / (ga.length + gb.length);
}

async function findLyrics({ title, artist, channel, duration, q }) {
  const cleaned = cleanTitle(title, channel);
  const track = q ? q : cleaned.track;
  const art = q ? '' : (artist || cleaned.artist);
  // Try the cleaned title first, then progressively looser variants until something matches.
  const variants = [[track, art], [stripLatin(track), stripLatin(art)], [stripLatin(track), latinOnly(art)], [stripLatin(track), '']];
  // Bilingual titles ("江南 River South") search far better by the CJK name alone, so try that first.
  if (stripLatin(track) !== track) variants.unshift(variants.splice(1, 1)[0]);
  const name = stripLatin(track);
  const tried = new Set();
  let found = [];
  for (const [t, a] of variants) {
    const sig = t + '|' + a;
    if (!t || tried.has(sig)) continue;
    tried.add(sig);
    found = found.concat(await lyricVariant(t, a, duration));
    // Stop once something actually carries the song's name, not just any hit.
    if (found.some((c) => similarity(name, c.title) >= 0.8)) break;
  }
  const seen = new Set();
  const all = found.filter((c) => {
    const sig = c.lines.slice(0, 6).map((l) => l.t + l.text).join('|');
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  const dur = Number(duration) || 0;
  const videoTitle = String(title || q).toLowerCase();
  const VERSION_RE = /dj|live|现场|現場|remix|伴奏|翻唱|cover|女声|男声|女版|男版|加速|慢速|0\.\d+x|铃声|片段|粤语|粵語|国语版|國語版|闽南语|台语版|日语版|日文版|英文版|韩语版|纯音乐|純音樂|钢琴|鋼琴|piano|instrumental|acoustic|伴唱|demo/i;
  // Rank: closest length to the video wins, word-level breaks ties, and DJ/live/remix versions
  // are pushed down unless the video itself is that version.
  // A wrong song with the right length used to win; now the name has to match too.
  const score = (c) => {
    const diff = dur && c.duration ? Math.min(Math.abs(c.duration - dur), 40) : 12;
    const tag = VERSION_RE.exec(c.version + ' ' + c.title);
    const versionPenalty = tag && !videoTitle.includes(tag[0].toLowerCase()) ? 40 : 0;
    // Compare against the whole video title so "Artist - Song" and bracketed names both count.
    const nameMiss = 1 - Math.max(similarity(track, c.title), similarity(name, c.title), contains(videoTitle, c.title) ? 1 : 0);
    const artistMiss = art || channel ? 1 - Math.max(similarity(art, c.artist), contains(videoTitle + ' ' + (channel || ''), c.artist) ? 1 : 0) : 0;
    return diff * 1.2 + (c.sync === 'word' ? 0 : 6) + versionPenalty + nameMiss * 45 + artistMiss * 18;
  };
  all.forEach((c) => { c.score = Math.round(score(c)); });
  all.sort((a, b) => a.score - b.score);
  return { query: { track, artist: art }, candidates: all.slice(0, 6) };
}

// ---------------------------------------------------------------------------
// Passenger rooms (in memory)
// ---------------------------------------------------------------------------
const rooms = new Map();
const rid = (n) => crypto.randomBytes(n).toString('base64url');

function createRoom() {
  const room = {
    id: rid(6), key: rid(18), token: rid(12), tokenExp: Date.now() + GUEST_TOKEN_TTL,
    state: { now: null, queue: [] }, pending: [], car: new Set(), guests: new Set(), touched: Date.now()
  };
  rooms.set(room.id, room);
  return room;
}

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sanitizeSong(s) {
  if (!s || typeof s !== 'object' || !/^[\w-]{11}$/.test(s.id)) return null;
  const str = (v, n) => String(v ?? '').slice(0, n);
  return {
    id: s.id, title: str(s.title, 200), channel: str(s.channel, 100),
    duration: Math.max(0, Math.min(Number(s.duration) || 0, 36000)),
    thumb: `https://i.ytimg.com/vi/${s.id}/mqdefault.jpg`
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [id, r] of rooms) if (now - r.touched > 24 * 3600 * 1000 && !r.car.size) rooms.delete(id);
  for (const r of rooms.values()) for (const res of [...r.car, ...r.guests]) res.write(': ping\n\n');
}, 25000).unref();

async function handleRoom(req, res, parts, url) {
  if (parts.length === 0 && req.method === 'POST') {
    if (limited(req, 'roomNew')) return sendJson(res, 429, { error: 'rate_limited' });
    if (rooms.size >= MAX_ROOMS) return sendJson(res, 503, { error: 'busy' });
    const r = createRoom();
    return sendJson(res, 200, { id: r.id, key: r.key, token: r.token, expires: r.tokenExp });
  }
  if (limited(req, parts[1] === 'add' ? 'guestAdd' : 'room')) return sendJson(res, 429, { error: 'rate_limited' });
  const room = rooms.get(parts[0]);
  if (!room) return sendJson(res, 404, { error: 'room_not_found' });
  room.touched = Date.now();
  const action = parts[1];
  const isCar = (k) => typeof k === 'string' && k === room.key;
  const guestOk = (t) => typeof t === 'string' && t === room.token && Date.now() < room.tokenExp;

  if (action === 'events' && req.method === 'GET') {
    const key = url.searchParams.get('key');
    const token = url.searchParams.get('token');
    const car = isCar(key);
    if (!car && !guestOk(token)) return sendJson(res, 403, { error: 'expired' });
    if (!car && room.guests.size >= MAX_GUESTS_PER_ROOM) return sendJson(res, 429, { error: 'room_full' });
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 3000\n\n');
    const set = car ? room.car : room.guests;
    set.add(res);
    const announceGuests = () => { for (const c of room.car) sse(c, 'guests', { count: room.guests.size }); };
    if (car) { for (const p of room.pending.splice(0)) sse(res, 'add', p); sse(res, 'guests', { count: room.guests.size }); }
    else { sse(res, 'state', room.state); announceGuests(); }
    req.on('close', () => { set.delete(res); if (!car) announceGuests(); });
    return;
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method' });
  const body = await readBody(req);

  if (action === 'token') {
    if (!isCar(body.key)) return sendJson(res, 403, { error: 'forbidden' });
    room.token = rid(12);
    room.tokenExp = Date.now() + GUEST_TOKEN_TTL;
    for (const g of room.guests) g.end();
    room.guests.clear();
    for (const c of room.car) sse(c, 'guests', { count: 0 });
    return sendJson(res, 200, { token: room.token, expires: room.tokenExp });
  }
  if (action === 'state') {
    if (!isCar(body.key)) return sendJson(res, 403, { error: 'forbidden' });
    room.state = {
      now: body.now ? sanitizeSong(body.now) : null,
      queue: (Array.isArray(body.queue) ? body.queue : []).slice(0, 50).map((q) => {
        const s = sanitizeSong(q);
        return s && { ...s, by: String(q.by || '').slice(0, 24) };
      }).filter(Boolean)
    };
    for (const g of room.guests) sse(g, 'state', room.state);
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'add') {
    if (!guestOk(body.token)) return sendJson(res, 403, { error: 'expired' });
    const song = sanitizeSong(body.song);
    if (!song) return sendJson(res, 400, { error: 'bad_song' });
    const item = { song, by: String(body.by || '').slice(0, 24), next: !!body.next, at: Date.now() };
    if (room.car.size) for (const c of room.car) sse(c, 'add', item);
    else if (room.pending.length < 100) room.pending.push(item);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: 'not_found' });
}

// ---------------------------------------------------------------------------
// Playlist sync: a short code shared between devices, stored as JSON files.
// ---------------------------------------------------------------------------
const LIB_DIR = path.join(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data'), 'libs');
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const libFile = (code) => path.join(LIB_DIR, code + '.json');
const validCode = (c) => typeof c === 'string' && /^[A-HJ-NP-Z2-9]{8}$/.test(c);

function validLib(d) {
  return d && typeof d === 'object' && Array.isArray(d.playlists) && d.playlists.length <= 200 && d.songs && typeof d.songs === 'object';
}

let libCount = null;

async function handleLib(req, res, code) {
  await fs.promises.mkdir(LIB_DIR, { recursive: true });
  if (!code && req.method === 'POST') {
    if (limited(req, 'libNew')) return sendJson(res, 429, { error: 'rate_limited' });
    if (libCount === null) libCount = (await fs.promises.readdir(LIB_DIR)).length;
    if (libCount >= MAX_LIBS) return sendJson(res, 503, { error: 'busy' });
    const body = await readBody(req, 2 * 1024 * 1024);
    if (!validLib(body.data)) return sendJson(res, 400, { error: 'bad_data' });
    let c;
    do { c = Array.from(crypto.randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(''); } while (fs.existsSync(libFile(c)));
    await fs.promises.writeFile(libFile(c), JSON.stringify(body.data));
    libCount++;
    return sendJson(res, 200, { code: c });
  }
  if (limited(req, 'lib')) return sendJson(res, 429, { error: 'rate_limited' });
  if (!validCode(code)) return sendJson(res, 404, { error: 'not_found' });
  if (req.method === 'GET') {
    try { return sendJson(res, 200, { data: JSON.parse(await fs.promises.readFile(libFile(code), 'utf8')) }); }
    catch { return sendJson(res, 404, { error: 'not_found' }); }
  }
  if (req.method === 'PUT') {
    if (!fs.existsSync(libFile(code))) return sendJson(res, 404, { error: 'not_found' });
    const body = await readBody(req, 2 * 1024 * 1024);
    if (!validLib(body.data)) return sendJson(res, 400, { error: 'bad_data' });
    await fs.promises.writeFile(libFile(code), JSON.stringify(body.data));
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: 'method' });
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json'
};

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/guest' || pathname === '/g') pathname = '/guest.html';
  const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  try {
    if (p === '/api/search') {
      if (limited(req, 'search')) return sendJson(res, 429, { error: 'rate_limited' });
      const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
      if (!q) return sendJson(res, 400, { error: 'empty' });
      const results = await cached('s:' + q, 30 * 60 * 1000, () => searchYoutube(q));
      return sendJson(res, 200, { results });
    }
    if (p === '/api/lyrics') {
      if (limited(req, 'lyrics')) return sendJson(res, 429, { error: 'rate_limited' });
      const sp = url.searchParams;
      const str = (k) => (sp.get(k) || '').trim().slice(0, 200);
      const args = { title: str('title'), artist: str('artist'), channel: str('channel'), duration: Math.min(Number(sp.get('duration')) || 0, 36000), q: str('q') };
      if (!args.title && !args.q) return sendJson(res, 400, { error: 'empty' });
      const key = 'l:' + JSON.stringify(args);
      return sendJson(res, 200, await cached(key, 6 * 3600 * 1000, () => findLyrics(args)));
    }
    if (p === '/api/instrumental') {
      if (limited(req, 'search')) return sendJson(res, 429, { error: 'rate_limited' });
      const sp = url.searchParams;
      const args = {
        title: (sp.get('title') || '').trim().slice(0, 200), channel: (sp.get('channel') || '').trim().slice(0, 100),
        duration: Math.min(Number(sp.get('duration')) || 0, 36000), id: (sp.get('id') || '').slice(0, 20)
      };
      if (!args.title) return sendJson(res, 400, { error: 'empty' });
      return sendJson(res, 200, await cached('i:' + JSON.stringify(args), 6 * 3600 * 1000, () => findInstrumental(args)));
    }
    if (p === '/api/health') return sendJson(res, 200, { ok: true });
    if (p.startsWith('/api/room')) {
      const parts = p.slice('/api/room'.length).split('/').filter(Boolean);
      return await handleRoom(req, res, parts, url);
    }
    if (p === '/api/lib' || p.startsWith('/api/lib/')) return await handleLib(req, res, p.split('/')[3]);
    if (p.startsWith('/api/')) return sendJson(res, 404, { error: 'not_found' });
    return serveStatic(req, res, p);
  } catch (e) {
    console.error(p, e);
    // Don't echo internal error details to clients.
    if (!res.headersSent) sendJson(res, 502, { error: 'upstream' });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`KaraCar running on http://localhost:${PORT}`));
}
