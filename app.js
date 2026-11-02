'use strict';

/* =========================================================
   FastMath — quick calculation practice
   Answer mode: Multiple Choice / Type Answer (type number)
   ========================================================= */

const $ = (sel) => document.querySelector(sel);

const OPS = {
  add: { symbol: '+', label: 'Add' },
  sub: { symbol: '−', label: 'Subtract' },
  mul: { symbol: '×', label: 'Multiply' },
  div: { symbol: '÷', label: 'Divide' },
};

const RANGE = {
  1: { lo: 1, hi: 9, mulLo: 2, mulHi: 9, divLo: 2, divHi: 9 },
  2: { lo: 10, hi: 99, mulLo: 2, mulHi: 12, divLo: 2, divHi: 12 },
  3: { lo: 100, hi: 999, mulLo: 11, mulHi: 25, divLo: 3, divHi: 20 },
};

const MAX_DIGITS = 6;

const el = {
  timer: $('#timer'),
  timerLabel: $('#timerLabel'),
  hudCorrect: $('#hudCorrect'),
  hudWrong: $('#hudWrong'),
  hudIndex: $('#hudIndex'),
  questionCard: $('#questionCard'),
  question: $('#question'),
  qTag: $('#qTag'),
  answers: $('#answers'),
  typeBox: $('#typeBox'),
  answerInput: $('#answerInput'),
  submitBtn: $('#submitBtn'),
  kbdHint: $('#kbdHint'),
  modeSeg: $('#modeSeg'),
  autoNext: $('#autoNext'),
  autoNextRow: $('#autoNextRow'),
  modeHint: $('#modeHint'),
  mixed: $('#mixed'),
  endOnWrong: $('#endOnWrong'),
  levelSeg: $('#levelSeg'),
  startBtn: $('#startBtn'),
  stopBtn: $('#stopBtn'),
  pauseBtn: $('#pauseBtn'),
  resumeBtn: $('#resumeBtn'),
  startOverlay: $('#startOverlay'),
  pauseOverlay: $('#pauseOverlay'),
  resultOverlay: $('#resultOverlay'),
  overlayStart: $('#overlayStart'),
  againBtn: $('#againBtn'),
  shareText: $('#shareText'),
  copyBtn: $('#copyBtn'),
  shareBtn: $('#shareBtn'),
  shareStatus: $('#shareStatus'),
  resultTitle: $('#resultTitle'),
  resultSub: $('#resultSub'),
  rCorrect: $('#rCorrect'),
  rFastest: $('#rFastest'),
  rFastestNote: $('#rFastestNote'),
  rTotal: $('#rTotal'),
  rAvg: $('#rAvg'),
  rWrong: $('#rWrong'),
  rAcc: $('#rAcc'),
  rSpeed: $('#rSpeed'),
};

const state = {
  screen: 'idle', // idle | playing | result
  level: 2,
  mode: 'choice', // choice | type
  autoNext: true,
  endOnWrong: true,
  question: null,
  locked: new Set(), // wrong options (index) / wrong values (text)
  stats: null,
  totalStart: 0,
  qStart: 0,
  timerId: null,
  lastText: '',
  lastOp: '',
  runId: 0,
  paused: false,
  pausedTotal: 0,
  qPausedMs: 0,
  pauseAt: 0,
};

const isTypeMode = () => state.mode === 'type';

/* ---------------- util ---------------- */

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtClock(ms) {
  const t = Math.max(0, ms) / 1000;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

const fmtSeconds = (ms) => `${(ms / 1000).toFixed(1)} sec`;

/* running time, pause duration not counted */
function elapsed() {
  const frozen = state.paused ? performance.now() - state.pauseAt : 0;
  return Math.max(0, performance.now() - state.totalStart - state.pausedTotal - frozen);
}

function qElapsed() {
  const frozen = state.paused ? performance.now() - state.pauseAt : 0;
  return Math.max(0, performance.now() - state.qStart - state.qPausedMs - frozen);
}

const canFocus = () => window.matchMedia('(pointer: fine)').matches;

/* ---------------- result text for sharing ---------------- */

const OP_WORDS = { add: 'addition', sub: 'subtraction', mul: 'multiplication', div: 'division' };
const DIGIT_WORDS = { 1: '1 digit', 2: '2 digits', 3: '3 digits' };

/* English number style: dot as decimal separator */
function enNum(value) {
  return value.toFixed(1).replace('.', '.');
}

function enDuration(ms) {
  const s = ms / 1000;
  if (s < 60) return `${enNum(s)} sec`;
  const m = Math.floor(s / 60);
  return `${m} min ${enNum(s - m * 60)} sec`;
}

/* "addition" / "addition & subtraction" / "mixed arithmetic" */
function describeTopic(ops, mixed) {
  if (mixed || ops.length === 4) return 'mixed arithmetic';
  const list = ops.map((o) => OP_WORDS[o] || o);
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} & ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`;
}

function buildShareText(s, totalMs) {
  const ops = selectedOps();
  const topic = describeTopic(ops, el.mixed.checked);
  const digit = DIGIT_WORDS[state.level] || `${state.level} digits`;
  const lines = [];

  const total = `${s.correct} questions`;
  lines.push(`Hi, I just finished ${total} ${topic} (${digit}) on FastMath.`);

  if (s.correct === 0) {
    lines.push(`Time ${enDuration(totalMs)}, but no correct answers yet — try again!`);
    return lines.join('\n');
  }

  const parts = [
    `Total time ${enDuration(totalMs)}`,
    `avg 1 question ${enDuration(totalMs / s.correct)}`,
  ];
  if (s.fastest !== null) parts.push(`fastest ${enDuration(s.fastest)}`);
  lines.push(`${parts.join(', ')}.`);

  if (s.wrong === 0) {
    if (s.correct >= 50) lines.push(`Crazy, ${total} with zero mistakes! 🔥`);
    else if (s.correct >= 25) lines.push('Awesome, zero mistakes! 🔥');
    else lines.push('Perfect, zero mistakes! 🔥');
  } else {
    lines.push(
      `Stopped at question ${s.correct + 1} because of ${s.wrong} wrong answers. ` +
        (s.correct >= 20 ? 'Still great progress!' : 'Practice again tomorrow!')
    );
  }

  lines.push('#FastMath #QuickMath');
  return lines.join('\n');
}

/* ---------------- settings ---------------- */

function selectedOps() {
  if (el.mixed.checked) return Object.keys(OPS);
  const list = [...document.querySelectorAll('input[name="op"]:checked')].map((i) => i.value);
  return list.length ? list : Object.keys(OPS);
}

function saveSettings() {
  try {
    localStorage.setItem(
      'fastmath',
      JSON.stringify({
        level: state.level,
        mode: state.mode,
        autoNext: el.autoNext.checked,
        endOnWrong: el.endOnWrong.checked,
        mixed: el.mixed.checked,
        ops: [...document.querySelectorAll('input[name="op"]')].map((i) => [i.value, i.checked]),
      })
    );
  } catch (_) {
    /* storage unavailable — ignore */
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('fastmath');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (RANGE[s.level]) setLevel(s.level, false);
    if (s.mode === 'type' || s.mode === 'choice') setMode(s.mode, false);
    if (typeof s.autoNext === 'boolean') {
      el.autoNext.checked = s.autoNext;
      state.autoNext = s.autoNext;
    }
    if (typeof s.endOnWrong === 'boolean') {
      state.endOnWrong = s.endOnWrong;
      el.endOnWrong.checked = s.endOnWrong;
    }
    if (typeof s.mixed === 'boolean') el.mixed.checked = s.mixed;
    if (Array.isArray(s.ops)) {
      for (const [value, checked] of s.ops) {
        const input = document.querySelector(`input[name="op"][value="${value}"]`);
        if (input) input.checked = checked;
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function setLevel(level, persist = true) {
  state.level = level;
  for (const b of el.levelSeg.children) b.classList.toggle('active', b.dataset.level === String(level));
  if (persist) saveSettings();
}

function setMode(mode, persist = true) {
  state.mode = mode;
  for (const b of el.modeSeg.children) b.classList.toggle('active', b.dataset.mode === mode);

  const type = mode === 'type';
  el.answers.hidden = type;
  el.typeBox.hidden = !type;
  el.autoNextRow.hidden = !type;
  el.answerInput.disabled = state.paused || state.screen !== 'playing';

  el.kbdHint.innerHTML = type
    ? 'Type number then <kbd>Enter</kbd><span class="kbd-spacer"></span><span>or auto advance</span>'
    : 'Press <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> or click an answer';
  el.modeHint.textContent = type
    ? 'Type the answer. Wrong = red card & you stay on that question until you type correctly.'
    : 'Click one option. Wrong = red card & you stay on that question.';

  if (persist) saveSettings();
}

/* ---------------- questions ---------------- */

function buildQuestion(op, r) {
  let a, b, ans;

  switch (op) {
    case 'add':
      a = randInt(r.lo, r.hi);
      b = randInt(r.lo, r.hi);
      ans = a + b;
      break;
    case 'sub':
      a = randInt(r.lo, r.hi);
      b = randInt(1, a);
      ans = a - b;
      break;
    case 'mul':
      a = randInt(r.mulLo, r.mulHi);
      b = randInt(r.mulLo, r.mulHi);
      ans = a * b;
      break;
    default: {
      // div: ensure division result is exact
      b = randInt(r.divLo, r.divHi);
      const c = randInt(r.divLo, r.divHi);
      a = b * c;
      ans = c;
    }
  }

  const text = `${a} ${OPS[op].symbol} ${b}`;
  const q = { op, a, b, ans, text };
  if (!isTypeMode()) q.options = buildOptions(ans);
  return q;
}

function buildOptions(ans) {
  const step = ans >= 100 ? 10 : ans >= 20 ? 5 : 1;
  const candidates = [
    ans + step, ans - step, ans + 1, ans - 1, ans + 2, ans - 2,
    ans + step * 2, ans - step * 2, ans + 10, ans - 10, ans + 3, ans - 3,
    ans + 9, ans - 9,
  ];
  const set = new Set();
  for (const c of candidates) {
    if (Number.isInteger(c) && c >= 0 && c !== ans && !set.has(c)) set.add(c);
    if (set.size === 3) break;
  }
  let guard = 0;
  while (set.size < 3 && guard++ < 60) {
    const c = Math.max(0, ans + randInt(-step * 4, step * 4));
    if (c !== ans && !set.has(c)) set.add(c);
  }
  return shuffle([ans, ...set]);
}

function nextQuestion() {
  const ops = selectedOps();
  const r = RANGE[state.level];
  let q = null;

  for (let i = 0; i < 8; i++) {
    let op = pick(ops);
    if (ops.length > 1 && op === state.lastOp && Math.random() < 0.65) op = pick(ops);
    q = buildQuestion(op, r);
    if (q.text !== state.lastText) break;
  }

  state.lastText = q.text;
  state.lastOp = q.op;
  state.question = q;
  state.locked = new Set();
  renderQuestion();
  // if paused, new question timer starts when pause is lifted
  state.qStart = state.paused ? state.pauseAt : performance.now();
  state.qPausedMs = 0;
}

/* ---------------- render ---------------- */

function renderQuestion() {
  const q = state.question;
  el.question.textContent = q.text;
  el.qTag.textContent = OPS[q.op].label;
  el.questionCard.classList.remove('wrong', 'right');

  if (isTypeMode()) {
    el.answers.innerHTML = '';
    el.answerInput.value = '';
    el.answerInput.classList.remove('is-right', 'is-wrong');
    el.answerInput.disabled = state.paused || state.screen !== 'playing';
    if (!el.answerInput.disabled && canFocus()) el.answerInput.focus({ preventScroll: true });
  } else {
    el.answers.innerHTML = '';
    q.options.forEach((value, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'answer';
      btn.textContent = value;
      btn.dataset.index = String(i);
      btn.disabled = state.paused;
      btn.addEventListener('click', () => onAnswer(i));
      el.answers.appendChild(btn);
    });
  }
}

/* ---------------- answering ---------------- */

function markCorrect(btn) {
  const run = state.runId;
  const q = state.question;
  const qMs = qElapsed();

  state.stats.correct += 1;
  if (state.locked.size === 0 && (state.stats.fastest === null || qMs < state.stats.fastest)) {
    state.stats.fastest = qMs;
    state.stats.fastestText = q.text;
  }

  el.hudCorrect.textContent = state.stats.correct;
  el.hudIndex.textContent = String(state.stats.correct);
  el.questionCard.classList.add('right');

  if (isTypeMode()) {
    el.answerInput.classList.add('is-right');
    el.answerInput.disabled = true;
  } else {
    btn.classList.add('is-right');
    for (const b of el.answers.children) b.disabled = true;
  }

  setTimeout(() => {
    if (state.screen === 'playing' && state.runId === run) nextQuestion();
  }, 260);
}

function markWrong() {
  const run = state.runId;
  state.stats.wrong += 1;
  el.hudWrong.textContent = state.stats.wrong;
  el.hudIndex.textContent = String(state.stats.correct);

  el.questionCard.classList.remove('wrong');
  void el.questionCard.offsetWidth; // restart animation
  el.questionCard.classList.add('wrong');

  if (state.endOnWrong) {
    setTimeout(() => {
      if (state.screen === 'playing' && state.runId === run) finish();
    }, 750);
  }
}

function onAnswer(index) {
  if (state.screen !== 'playing' || state.paused || state.locked.has(index)) return;

  const q = state.question;
  const btn = el.answers.children[index];

  if (q.options[index] === q.ans) {
    markCorrect(btn);
  } else {
    state.locked.add(index);
    btn.classList.add('is-wrong');
    btn.disabled = true;
    markWrong();
  }
}

/* --- "Type Answer" mode --- */

function cleanInput() {
  const raw = el.answerInput.value.replace(/\D/g, '').slice(0, MAX_DIGITS);
  if (raw !== el.answerInput.value) el.answerInput.value = raw;
  return raw;
}

function syncTyped() {
  const raw = cleanInput();
  if (!state.autoNext) return;
  if (state.screen !== 'playing' || state.paused) return;
  if (raw !== '' && Number(raw) === state.question.ans) submitTyped();
}

function submitTyped() {
  if (state.screen !== 'playing' || state.paused) return;
  const q = state.question;
  const raw = cleanInput();
  if (raw === '') return;

  if (Number(raw) === q.ans) {
    markCorrect(null);
  } else if (state.locked.has(raw)) {
    // same wrong value repeated: don't count twice
    el.answerInput.value = '';
    el.answerInput.classList.remove('is-wrong');
    void el.answerInput.offsetWidth;
    el.answerInput.classList.add('is-wrong');
  } else {
    state.locked.add(raw);
    el.answerInput.value = '';
    el.answerInput.classList.add('is-wrong');
    markWrong();
  }
}

/* ---------------- game flow ---------------- */

function tick() {
  if (state.screen !== 'playing' || state.paused) return;
  el.timer.textContent = fmtClock(elapsed());
}

function start() {
  state.stats = { correct: 0, wrong: 0, fastest: null, fastestText: '' };
  state.screen = 'playing';
  state.lastText = '';
  state.lastOp = '';
  state.runId += 1;
  state.paused = false;
  state.pausedTotal = 0;
  state.qPausedMs = 0;

  el.timer.textContent = '00:00.0';
  el.timer.classList.remove('paused');
  el.timerLabel.textContent = 'Time';
  el.hudCorrect.textContent = '0';
  el.hudWrong.textContent = '0';
  el.hudIndex.textContent = '0';

  el.startOverlay.classList.remove('show');
  el.resultOverlay.classList.remove('show');
  el.pauseOverlay.classList.remove('show');
  el.pauseBtn.textContent = '⏸ Pause';
  el.stopBtn.disabled = false;
  el.pauseBtn.disabled = false;
  el.answerInput.classList.remove('is-right', 'is-wrong');

  clearInterval(state.timerId);
  state.totalStart = performance.now();
  state.timerId = setInterval(tick, 100);

  nextQuestion();
}

function pause() {
  if (state.screen !== 'playing' || state.paused) return;
  state.paused = true;
  state.pauseAt = performance.now();

  clearInterval(state.timerId);
  el.pauseBtn.textContent = '▶ Resume';
  el.pauseOverlay.classList.add('show');
  el.timer.classList.add('paused');
  el.timerLabel.textContent = 'Paused';
  el.questionCard.classList.add('dimmed');
  for (const b of el.answers.children) b.disabled = true;
  el.answerInput.disabled = true;
}

function resume() {
  if (state.screen !== 'playing' || !state.paused) return;
  const delta = performance.now() - state.pauseAt;
  state.pausedTotal += delta;
  state.qPausedMs += delta;
  state.paused = false;

  state.timerId = setInterval(tick, 100);
  el.pauseBtn.textContent = '⏸ Pause';
  el.pauseOverlay.classList.remove('show');
  el.timer.classList.remove('paused');
  el.timerLabel.textContent = 'Time';
  el.questionCard.classList.remove('dimmed');

  const resolved = isTypeMode() ? el.answerInput.classList.contains('is-right') : false;
  for (const b of el.answers.children) {
    b.disabled = state.locked.has(Number(b.dataset.index)) || b.classList.contains('is-right');
  }
  el.answerInput.disabled = resolved;
  if (!el.answerInput.disabled && canFocus()) el.answerInput.focus({ preventScroll: true });
  tick();
}

function togglePause() {
  if (state.paused) resume();
  else pause();
}

function finish() {
  if (state.paused) {
    state.pausedTotal += performance.now() - state.pauseAt;
    state.paused = false;
  }
  state.screen = 'result';
  clearInterval(state.timerId);

  const totalMs = elapsed();
  const s = state.stats;
  const totalAnswers = s.correct + s.wrong;

  el.timer.textContent = fmtClock(totalMs);
  el.stopBtn.disabled = true;
  el.pauseBtn.disabled = true;
  el.pauseOverlay.classList.remove('show');
  el.pauseBtn.textContent = '⏸ Pause';
  el.timer.classList.remove('paused');
  el.timerLabel.textContent = 'Time';
  el.questionCard.classList.remove('dimmed');
  el.answerInput.disabled = true;
  el.startBtn.textContent = 'Restart';

  el.rCorrect.textContent = String(s.correct);
  el.rFastest.textContent = s.fastest === null ? '—' : fmtSeconds(s.fastest);
  el.rFastestNote.textContent = s.fastest === null ? 'none yet' : `for ${s.fastestText}`;
  el.rTotal.textContent = fmtSeconds(totalMs);
  el.rAvg.textContent = s.correct ? `avg ${fmtSeconds(totalMs / s.correct)} / question` : 'avg —';
  el.rWrong.textContent = String(s.wrong);
  el.rAcc.textContent = totalAnswers ? `accuracy ${Math.round((s.correct / totalAnswers) * 100)}%` : 'accuracy —';

  if (s.correct === 0) {
    el.resultTitle.textContent = 'No correct answers yet';
    el.resultSub.textContent = 'Try again — answer the first question correctly!';
    el.rSpeed.textContent = '';
  } else {
    const perMin = (s.correct / (totalMs / 60000)).toFixed(1);
    el.resultTitle.textContent = 'Done!';
    el.resultSub.textContent = totalAnswers > s.correct ? 'Great — you lasted until a wrong answer.' : 'Perfect, zero mistakes!';
    el.rSpeed.textContent = `Average speed ${perMin} questions per minute`;
  }

  fillShare(totalMs);
  el.resultOverlay.classList.add('show');
}

/* ---------------- share results ---------------- */

function fillShare(totalMs) {
  el.shareText.value = buildShareText(state.stats, totalMs);
  el.shareStatus.textContent = '';
  el.shareStatus.classList.remove('show', 'warn');
  el.shareBtn.hidden = !(navigator.share && window.isSecureContext);
}

function setShareStatus(message, warn = false) {
  el.shareStatus.textContent = message;
  el.shareStatus.classList.add('show');
  el.shareStatus.classList.toggle('warn', warn);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      /* fall through to manual */
    }
  }
  // manual method: important when opened directly from file:// (not secure context)
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  let done = false;
  try {
    done = document.execCommand('copy');
  } catch (_) {
    done = false;
  }
  document.body.removeChild(ta);
  return done;
}

el.copyBtn.addEventListener('click', async () => {
  const text = el.shareText.value.trim();
  if (!text) return;
  const okCopy = await copyText(text);
  if (okCopy) {
    setShareStatus('Copied! Just paste to Instagram, WhatsApp, or X.');
  } else {
    el.shareText.focus();
    el.shareText.select();
    setShareStatus('Browser blocked auto-copy — text is selected, press Ctrl+C / Cmd+C.', true);
  }
});

el.shareBtn.addEventListener('click', async () => {
  const text = el.shareText.value.trim();
  if (!text) return;
  try {
    await navigator.share({ text });
    setShareStatus('Shared!');
  } catch (err) {
    if (err && err.name === 'AbortError') return; // user cancelled
    setShareStatus('Failed to share — use "Copy Result" instead.', true);
  }
});

el.shareText.addEventListener('focus', () => el.shareText.select());

/* ---------------- events ---------------- */

el.startBtn.addEventListener('click', start);
el.overlayStart.addEventListener('click', start);
el.againBtn.addEventListener('click', start);
el.pauseBtn.addEventListener('click', togglePause);
el.resumeBtn.addEventListener('click', resume);
el.stopBtn.addEventListener('click', () => {
  if (state.screen === 'playing') finish();
});

el.levelSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-level]');
  if (btn) setLevel(Number(btn.dataset.level));
});

el.modeSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn || btn.dataset.mode === state.mode) return;
  setMode(btn.dataset.mode);
  if (state.screen === 'playing') {
    clearInputState();
    renderQuestion();
  }
});

el.mixed.addEventListener('change', saveSettings);
el.autoNext.addEventListener('change', () => {
  state.autoNext = el.autoNext.checked;
  saveSettings();
});
el.endOnWrong.addEventListener('change', () => {
  state.endOnWrong = el.endOnWrong.checked;
  saveSettings();
});
for (const input of document.querySelectorAll('input[name="op"]')) {
  input.addEventListener('change', saveSettings);
}

el.answerInput.addEventListener('input', syncTyped);
el.answerInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  submitTyped();
});
el.submitBtn.addEventListener('click', submitTyped);

// clicking question area focuses input box
el.questionCard.addEventListener('click', () => {
  if (isTypeMode() && state.screen === 'playing' && !state.paused && canFocus()) {
    el.answerInput.focus({ preventScroll: true });
  }
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === 'Enter' || e.key === ' ') {
    if (state.paused) {
      e.preventDefault();
      resume();
    } else if (state.screen !== 'playing') {
      e.preventDefault();
      start();
    }
    return;
  }

  if (e.key === 'p' || e.key === 'P') {
    if (state.screen === 'playing') {
      e.preventDefault();
      togglePause();
    }
    return;
  }

  if (state.screen !== 'playing' || state.paused) return;

  if (isTypeMode()) {
    // digits still go to input even if focus taken away
    if (/^\d$/.test(e.key) && document.activeElement !== el.answerInput && canFocus()) {
      el.answerInput.value += e.key;
      el.answerInput.focus({ preventScroll: true });
      syncTyped();
    }
    return;
  }

  const n = Number(e.key);
  if (n >= 1 && n <= 4 && el.answers.children[n - 1]) onAnswer(n - 1);
});

function clearInputState() {
  el.answerInput.value = '';
  el.answerInput.classList.remove('is-right', 'is-wrong');
}

/* ---------------- init ---------------- */

loadSettings();
state.autoNext = el.autoNext.checked;
state.endOnWrong = el.endOnWrong.checked;
setMode(state.mode, false);
el.startOverlay.classList.add('show');
