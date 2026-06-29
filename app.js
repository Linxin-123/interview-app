/* ============================================================================
   app.js — Interview Studio main logic
   ----------------------------------------------------------------------------
   - Reads ALL content from interview_question_bank.json (edit that file to
     update questions / interviewers — no code changes needed).
   - Drives the digital human in avatar.js (speaking / listening / mouth).
   - Speaks questions with the browser voice and highlights each word as it is
     said (this also pulses the avatar's mouth).
   - Optional: set EVAL_ENDPOINT to your own /api/evaluate URL (e.g. a free
     serverless function holding your GEMINI_API_KEY) for rich AI feedback.
     If left blank, a solid local scoring summary is shown — fully free.
   ========================================================================== */

/* >>> OPTIONAL: paste your serverless evaluation URL here for Gemini feedback.
       Leave "" to run 100% free with local scoring. <<< */
const EVAL_ENDPOINT = "";

/* ---------- starfield ---------- */
(function () {
  const s = document.getElementById('stars');
  for (let i = 0; i < 60; i++) {
    const d = document.createElement('div'); d.className = 'star';
    const sz = Math.random() < 0.85 ? 1.5 : 2.5;
    d.style.width = d.style.height = sz + 'px';
    d.style.left = Math.random() * 100 + '%'; d.style.top = Math.random() * 100 + '%';
    d.style.animationDelay = (Math.random() * 4) + 's';
    d.style.opacity = .2 + Math.random() * .6;
    s.appendChild(d);
  }
})();

const $ = function (id) { return document.getElementById(id); };
function setupStatus(m, isErr) { const s = $('setupStatus'); s.textContent = m; s.className = 'status' + (isErr ? ' err' : ' ok'); }

const state = {
  bank: null,
  role: null, round: 'round1', minutes: 20, intl: false,
  interviewer: null, voice: null,
  questions: [], idx: 0, answers: [],
  recognition: null, answering: false, ansStart: 0, ansText: '', finished: false,
  camOn: false, camStream: null
};

InterviewAvatar.init({ host: $('avatarHost'), studio: $('studio') });

/* ---------- load the separated question bank ---------- */
fetch('interview_question_bank.json')
  .then(function (r) { if (!r.ok) throw 0; return r.json(); })
  .then(function (b) { state.bank = b; bootFromBank(); })
  .catch(function () { setupStatus('Could not load interview_question_bank.json — keep it next to index.html.', true); });

function bootFromBank() {
  state.role = Object.keys(state.bank.roles)[0];
  state.interviewer = state.bank.interviewers[0];
  buildRoleGrid(); buildPersonGrid(); buildRoundGrid(); refresh();
  assignVoices();   // voices may already be loaded before the bank arrived
}

/* ---------- generic option tile (keeps the "light-up" press effect) ---------- */
function optBtn(html, pressed, onClick, group) {
  const b = document.createElement('button');
  b.className = 'opt'; b.dataset.group = group; b.setAttribute('aria-pressed', pressed);
  b.innerHTML = html;
  b.onclick = function () {
    document.querySelectorAll('.opt[data-group="' + group + '"]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    b.setAttribute('aria-pressed', 'true'); onClick();
  };
  return b;
}

function buildRoleGrid() {
  const g = $('roleGrid'); g.innerHTML = '';
  Object.keys(state.bank.roles).forEach(function (k) {
    const v = state.bank.roles[k];
    g.appendChild(optBtn('<span class="ic">' + v.icon + '</span>' + v.title + '<small>' + v.subtitle + '</small>',
      k === state.role, function () { state.role = k; refresh(); }, 'role'));
  });
}
function buildPersonGrid() {
  const g = $('personGrid'); if (!g || !state.interviewer) return; g.innerHTML = '';
  state.bank.interviewers.forEach(function (p) {
    const vname = p.voice ? p.voice.name : 'auto-selecting…';
    g.appendChild(optBtn(
      '<div class="person"><img class="face" src="' + p.photo + '" alt="' + p.name + '">' +
      '<div class="pmeta"><b>' + p.name + ' <span class="vtag">' + genderTag(p.gender) + '</span></b>' +
      '<small>' + p.title + '</small>' +
      '<small class="vname">🎙 ' + vname + '</small></div></div>',
      p.id === state.interviewer.id,
      function () { state.interviewer = p; state.voice = p.voice || null; fillVoiceDropdown(); refresh(); },
      'person'));
  });
}
function buildRoundGrid() {
  const g = $('roundGrid'); g.innerHTML = '';
  Object.keys(state.bank.rounds).forEach(function (k) {
    const v = state.bank.rounds[k];
    g.appendChild(optBtn('<span class="ic">' + v.icon + '</span>' + v.title + '<small>' + v.subtitle + '</small>',
      k === state.round, function () { state.round = k; refresh(); }, 'round'));
  });
}
function refresh() {
  const avg = state.bank.config.avgMinutesPerQuestion[state.round] || 3;
  const q = Math.max(1, Math.round(state.minutes / avg));
  $('minsLabel').textContent = state.minutes + ' min · ~' + q + ' Q';
}

/* ---------- voices: give each interviewer a DISTINCT, gender-correct voice ----------
   The Web Speech API does NOT expose gender, so we infer it from the voice name.
   ('female' is checked before 'male' because the word "female" contains "male".) */
const FEMALE_HINTS = ['female', 'woman', 'zira', 'hazel', 'susan', 'catherine', 'linda', 'heera',
  'eva', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'serena', 'allison', 'ava',
  'aria', 'jenny', 'michelle', 'sonia', 'libby', 'clara', 'amber', 'nora', 'emma', 'amy', 'joanna',
  'salli', 'google us english', 'google uk english female', 'sora'];
const MALE_HINTS = ['male', 'man', 'david', 'mark', 'george', 'james', 'ryan', 'guy', 'daniel',
  'alex', 'fred', 'oliver', 'thomas', 'paul', 'richard', 'eric', 'brian', 'arthur', 'matthew',
  'william', 'liam', 'google uk english male'];

function inferGender(v) {
  const n = (v.name || '').toLowerCase();
  for (let i = 0; i < FEMALE_HINTS.length; i++) if (n.indexOf(FEMALE_HINTS[i]) >= 0) return 'female';
  for (let i = 0; i < MALE_HINTS.length; i++) if (n.indexOf(MALE_HINTS[i]) >= 0) return 'male';
  return 'unknown';
}
function genderTag(g) { return g === 'female' ? '♀ Female' : g === 'male' ? '♂ Male' : '• Voice'; }

function scoreVoice(v, person) {
  const n = (v.name || '').toLowerCase(), lang = (v.lang || '').toLowerCase();
  let s = 0;
  const hi = (person.voiceHints || []).findIndex(function (h) { return n.indexOf(h) >= 0; });
  if (hi >= 0) s += 1000 - hi * 60;                 // earlier hint = stronger preference
  const g = inferGender(v), want = person.gender || 'unknown';
  if (g === want) s += 600; else if (g === 'unknown') s += 120; else s -= 600; // never a male face + female voice
  const acc = (person.accent || 'en-US').toLowerCase();
  if (lang === acc) s += 300; else if (lang.split('-')[0] === acc.split('-')[0]) s += 80;
  if (/google|microsoft|natural|online|premium/.test(n)) s += 40;
  return s;
}

function assignVoices() {
  const all = window._voices || [];
  if (!all.length || !state.bank) return;
  const taken = {};
  state.bank.interviewers.forEach(function (p) {
    let best = null, bestS = -1e9;
    all.forEach(function (v) {
      if (taken[v.name]) return;                     // keep all three voices different
      const sc = scoreVoice(v, p);
      if (sc > bestS) { bestS = sc; best = v; }
    });
    if (!best) { all.forEach(function (v) { const sc = scoreVoice(v, p); if (sc > bestS) { bestS = sc; best = v; } }); }
    if (best) { p.voice = best; taken[best.name] = true; }
  });
  if (state.interviewer) state.voice = state.interviewer.voice || state.voice;
  buildPersonGrid();
  fillVoiceDropdown();
}

function fillVoiceDropdown() {
  const sel = $('voiceSelect'); if (!sel) return;
  const all = window._voices || [];
  if (!all.length) { sel.innerHTML = '<option>No English voices found</option>'; return; }
  sel.innerHTML = '';
  all.forEach(function (v) {
    const o = document.createElement('option');
    o.value = v.name;
    o.textContent = genderTag(inferGender(v)) + ' — ' + v.name + ' (' + v.lang + ')';
    sel.appendChild(o);
  });
  if (state.interviewer && state.interviewer.voice) sel.value = state.interviewer.voice.name;
  sel.onchange = function () {
    const v = all.find(function (x) { return x.name === sel.value; });
    if (v && state.interviewer) { state.interviewer.voice = v; state.voice = v; buildPersonGrid(); }
  };
}

function loadVoices() {
  window._voices = speechSynthesis.getVoices().filter(function (v) { return (v.lang || '').toLowerCase().indexOf('en') === 0; });
  assignVoices();
}
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

/* ---------- build the interview question list ---------- */
function buildInterview() {
  const src = (state.bank.questions[state.role] && state.bank.questions[state.role][state.round]) || [];
  const pool = src.map(function (q) { return { id: q.id, text: q.text }; });
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  const avg = state.bank.config.avgMinutesPerQuestion[state.round] || 3;
  const n = Math.max(1, Math.round(state.minutes / avg));
  let qs = pool.slice(0, n);
  if (state.intl && state.round === 'round1' && state.bank.international && state.bank.international.length) {
    const extra = state.bank.international.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 2)
      .map(function (txt, i) { return { id: 'intl_' + i, text: txt }; });
    qs.splice(1, 0, extra[0], extra[1]);
  }
  return qs;
}

/* ---------- present a question: photoreal clip if it exists, else voice ----------
   Drop an MP4 named after the question id into videos/  (e.g. videos/m1_7.mp4)
   and it will play with perfect lip-sync. No clip yet -> photo + voice. */
const VIDEO_DIR = 'videos/';
function presentQuestion(q) {
  return new Promise(function (resolve) {
    const v = $('qVideo');
    const src = VIDEO_DIR + q.id + '.mp4';
    // show the question text as a static caption (the clip carries the audio)
    renderCaption(q.text);
    $('capText').querySelectorAll('.w').forEach(function (w) { w.classList.add('said'); });

    let settled = false;
    const fallback = function () { if (settled) return; settled = true; v.style.display = 'none'; v.onended = v.onerror = null; speak(q.text).then(resolve); };
    const finish = function () { if (settled) return; settled = true; v.style.display = 'none'; v.onended = v.onerror = null; InterviewAvatar.speaking(false); resolve(); };

    v.onerror = fallback;
    v.onended = finish;
    v.src = src;
    v.style.display = 'block';
    InterviewAvatar.speaking(true);
    const p = v.play();
    if (p && p.catch) p.catch(fallback);     // autoplay blocked / missing file -> voice
  });
}

/* ---------- speak a question: highlight words + pulse avatar mouth ---------- */
function renderCaption(text) {
  $('capKicker').textContent = 'Examiner asks';
  const ct = $('capText'); ct.innerHTML = '';
  text.split(/(\s+)/).forEach(function (tok) {
    if (/^\s+$/.test(tok)) { ct.appendChild(document.createTextNode(tok)); return; }
    const sp = document.createElement('span'); sp.className = 'w'; sp.textContent = tok; ct.appendChild(sp);
  });
  return ct.querySelectorAll('.w');
}

function speak(text) {
  return new Promise(function (resolve) {
    const words = renderCaption(text);
    InterviewAvatar.speaking(true);
    const u = new SpeechSynthesisUtterance(text);
    if (state.voice) u.voice = state.voice;
    u.rate = 0.95; u.pitch = 1.0;

    // Continuous mouth "flap" while speaking — works even if the voice
    // never reports word boundaries (drives the 3D jaw).
    const flap = setInterval(function () {
      InterviewAvatar.mouth(0.25 + Math.random() * 0.65);
    }, 110);

    // onboundary (when available) lights up the caption word-by-word.
    let wi = 0;
    u.onboundary = function (e) {
      if (e.name && e.name !== 'word') return;
      if (words[wi]) words[wi].classList.add('said');
      wi++;
    };
    const done = function () {
      clearInterval(flap);
      words.forEach(function (w) { w.classList.add('said'); });
      InterviewAvatar.mouth(0); InterviewAvatar.speaking(false); resolve();
    };
    u.onend = done; u.onerror = done;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  });
}

/* ---------- speech recognition (silent transcription) ---------- */
function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR(); r.lang = 'en-US'; r.interimResults = true; r.continuous = true;
  r.onresult = function (e) {
    let f = '', interim = '';
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) f += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    state.ansText = f.trim();
    $('liveBox').textContent = (state.ansText + ' ' + interim).trim() || 'Listening…';
  };
  r.onerror = function () {};
  return r;
}

/* ---------- camera self-view ---------- */
function toggleCamera() {
  state.camOn = !state.camOn;
  $('camBtn').textContent = state.camOn ? '📷 Camera on' : '📷 Camera off';
  $('pip').classList.toggle('on', state.camOn);
  if (state.camOn) {
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
      .then(function (s) { state.camStream = s; $('selfVideo').srcObject = s; })
      .catch(function () { state.camOn = false; $('camBtn').textContent = '📷 Camera off'; $('pip').classList.remove('on'); });
  } else if (state.camStream) {
    state.camStream.getTracks().forEach(function (t) { t.stop(); }); state.camStream = null;
  }
}

/* ---------- flow ---------- */
async function startInterview() {
  if (!state.bank) { setupStatus('Question bank not loaded yet.', true); return; }
  state.intl = $('intl').checked;
  state.recognition = setupRecognition();
  state.questions = buildInterview();
  state.idx = 0; state.answers = []; state.finished = false;

  $('setup').style.display = 'none'; $('report').style.display = 'none'; $('stage').style.display = 'block';
  $('npName').textContent = state.interviewer.name;
  $('npTitle').textContent = state.interviewer.title;

  await InterviewAvatar.mount(state.interviewer);
  renderProgress();
  askCurrent();
}

function askCurrent() {
  if (state.idx >= state.questions.length) { finish(); return; }
  renderProgress(); InterviewAvatar.listening(false);
  const btn = $('bigBtn'); btn.disabled = true; btn.classList.remove('rec'); btn.textContent = 'Examiner is asking…';
  $('liveBox').classList.remove('on');
  $('askState').textContent = 'Listen to the question…';
  presentQuestion(state.questions[state.idx]).then(function () {
    $('askState').textContent = 'Your turn';
    btn.disabled = false; btn.textContent = '🎤 Press to answer';
  });
}

function pressBig() {
  if (state.finished) return;
  const btn = $('bigBtn');
  if (!state.answering) {
    state.answering = true; state.ansText = ''; state.ansStart = Date.now();
    if (state.recognition) { try { state.recognition.start(); } catch (e) {} }
    InterviewAvatar.listening(true);
    $('capKicker').textContent = 'You are answering';
    $('liveBox').classList.add('on'); $('liveBox').textContent = 'Listening…';
    btn.classList.add('rec'); btn.textContent = '● Recording — press when finished';
    $('askState').textContent = 'Speak your answer…';
  } else {
    state.answering = false;
    if (state.recognition) { try { state.recognition.stop(); } catch (e) {} }
    InterviewAvatar.listening(false);
    const secs = Math.round((Date.now() - state.ansStart) / 1000);
    setTimeout(function () {
      state.answers.push({
        q: state.questions[state.idx].text, a: state.ansText, secs: secs,
        words: state.ansText ? state.ansText.split(/\s+/).filter(Boolean).length : 0
      });
      state.idx++; btn.classList.remove('rec'); askCurrent();
    }, 300);
  }
}

function renderProgress() {
  const p = $('progress'); p.innerHTML = '';
  state.questions.forEach(function (_, i) {
    const d = document.createElement('div');
    d.className = 'dot' + (i < state.idx ? ' done' : i === state.idx ? ' now' : '');
    p.appendChild(d);
  });
}

/* ---------- finish + report ---------- */
async function finish() {
  state.finished = true;
  speechSynthesis.cancel(); InterviewAvatar.speaking(false); InterviewAvatar.listening(false);
  try { const v = $('qVideo'); v.pause(); v.onended = v.onerror = null; v.style.display = 'none'; } catch (e) {}
  if (state.recognition) { try { state.recognition.stop(); } catch (e) {} }
  if (state.camStream) { state.camStream.getTracks().forEach(function (t) { t.stop(); }); state.camStream = null; }

  $('stage').style.display = 'none'; $('report').style.display = 'block';
  const roleTitle = state.bank.roles[state.role].title, roundTitle = state.bank.rounds[state.round].title;
  $('reportRole').textContent = roleTitle + ' · ' + roundTitle + ' · ' + state.answers.length + ' questions answered · with ' + state.interviewer.name;

  localReport();                  // instant local summary
  if (EVAL_ENDPOINT) tryAIReport();   // optional richer AI feedback on top
}

function localReport() {
  const ans = state.answers; let totalSecs = 0, totalWords = 0;
  ans.forEach(function (x) { totalSecs += x.secs; totalWords += x.words; });
  const avgSecs = ans.length ? Math.round(totalSecs / ans.length) : 0;
  const avgWords = ans.length ? Math.round(totalWords / ans.length) : 0;
  const fillers = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'kind of', 'sort of'];
  let fc = 0;
  ans.forEach(function (x) { const t = (x.a || '').toLowerCase(); fillers.forEach(function (f) { fc += (t.split(f).length - 1); }); });

  $('statgrid').innerHTML =
    '<div class="stat"><b>' + ans.length + '</b><small>questions</small></div>' +
    '<div class="stat"><b>' + avgSecs + 's</b><small>avg answer</small></div>' +
    '<div class="stat"><b>' + avgWords + '</b><small>avg words</small></div>';

  const tips = [];
  if (avgSecs && avgSecs < 35) tips.push('Your answers were quite short. Aim for 60–90 seconds and use the STAR structure (Situation, Task, Action, Result).');
  if (avgSecs > 150) tips.push('Some answers ran long. Make your point in the first sentence, then give one clear example.');
  if (fc >= 5) tips.push('You used filler words about ' + fc + ' times (um, like, you know…). A short pause sounds more confident.');
  if (avgSecs >= 35 && avgSecs <= 150 && fc < 5) tips.push('Good pacing and clarity — keep practising with fresh random questions.');
  tips.push('Re-read your answers below and rewrite one. Turning a rough spoken answer into a polished one is the fastest way to improve.');
  $('tips').innerHTML = tips.map(function (t) { return '<div class="fb">💡 ' + t + '</div>'; }).join('');

  $('qaList').innerHTML = ans.map(function (x, i) {
    return '<div class="qa"><div class="q">Q' + (i + 1) + '. ' + x.q + '</div>' +
      '<div class="a">' + (x.a ? escapeHtml(x.a) : '<i>(no words captured)</i>') + ' · ' + x.secs + 's</div></div>';
  }).join('');
}

function tryAIReport() {
  const payload = {
    role: state.role, accent: state.interviewer.accent, roundType: Number(state.round.replace('round', '')),
    answers: state.answers.map(function (x, i) { return { questionId: 'q' + i, questionText: x.q, userAnswer: x.a }; })
  };
  $('tips').insertAdjacentHTML('afterbegin', '<div class="fb" id="aiLoading">✨ Asking your AI coach for detailed feedback…</div>');
  fetch(EVAL_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(function (r) { return r.json(); })
    .then(function (ev) {
      const el = $('aiLoading'); if (el) el.remove();
      if (!ev || typeof ev.score === 'undefined') return;
      let html = '<div class="fb"><b>AI coach · overall ' + ev.score + '/100</b><br>' + escapeHtml(ev.encouragingComment || '') + '</div>';
      (ev.generalStrengths || []).forEach(function (s) { html += '<div class="fb">💪 ' + escapeHtml(s) + '</div>'; });
      $('tips').insertAdjacentHTML('afterbegin', html);
    })
    .catch(function () { const el = $('aiLoading'); if (el) el.textContent = 'AI feedback unavailable — showing local summary.'; });
}

function escapeHtml(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* ---------- wires ---------- */
$('mins').addEventListener('input', function (e) { state.minutes = +e.target.value; refresh(); });
$('startBtn').addEventListener('click', startInterview);
$('bigBtn').addEventListener('click', pressBig);
$('repeatBtn').addEventListener('click', function () { if (!state.finished && !state.answering && state.idx < state.questions.length) askCurrent(); });
$('camBtn').addEventListener('click', toggleCamera);
$('endBtn').addEventListener('click', function () { if (!state.finished) finish(); });
$('againBtn').addEventListener('click', function () { $('report').style.display = 'none'; $('setup').style.display = 'block'; });
