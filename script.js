// ---------- Config ----------
const SETTINGS_KEY = 'shift-2-2-settings';
const MARKS_KEY = 'shift-2-2-marks';
const NOTES_KEY = 'shift-2-2-notes';
const NOTIF_KEY = 'shift-2-2-notif';
const LAST_NOTIFIED_KEY = 'shift-2-2-last-notified';
const CONFETTI_SHOWN_KEY = 'shift-2-2-confetti-shown';

const DEFAULT_SETTINGS = {
  start: '2026-07-03',
  end: '2026-08-02',
  workLen: 2,
  restLen: 2,
};

const DEFAULT_NOTIF = {
  enabled: false,
  time: '20:00',
};

// Manual overrides for days that don't follow the regular pattern.
// Key: ISO date string (YYYY-MM-DD), value: 'work' or 'rest'.
const OVERRIDES = {
  '2026-07-05': 'rest',
};

const MONTH_NAMES = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTH_TITLES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

// ---------- Generic storage helpers ----------
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* ignore */ }
}

// ---------- Date helpers ----------
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISOToNoonDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid - aMid) / MS);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ---------- Schedule state (rebuilt whenever settings change) ----------
let settings = { ...DEFAULT_SETTINGS, ...loadJSON(SETTINGS_KEY, {}) };
let START, END, WORK_LEN, REST_LEN, shiftDays, totalDays;

function rebuildSchedule() {
  START = parseISOToNoonDate(settings.start);
  END = parseISOToNoonDate(settings.end);
  WORK_LEN = Math.max(1, parseInt(settings.workLen, 10) || 2);
  REST_LEN = Math.max(1, parseInt(settings.restLen, 10) || 2);

  shiftDays = [];
  let cur = new Date(START);
  if (END < START) END = new Date(START);
  while (cur <= END) {
    shiftDays.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  totalDays = shiftDays.length;
}

function isWorkDay(date) {
  const iso = toISO(date);
  if (OVERRIDES[iso]) {
    return OVERRIDES[iso] === 'work';
  }
  const diff = daysBetween(START, date);
  if (diff < 0) return null;
  const cycleLen = WORK_LEN + REST_LEN;
  const cycle = ((diff % cycleLen) + cycleLen) % cycleLen;
  return cycle < WORK_LEN;
}

function inRange(date) {
  return date >= startOfDay(START) && date <= startOfDay(END);
}

// ---------- Marks & notes storage ----------
let marks = loadJSON(MARKS_KEY, {});
let notes = loadJSON(NOTES_KEY, {});

function saveMarks() {
  saveJSON(MARKS_KEY, marks);
}
function saveNotes() {
  saveJSON(NOTES_KEY, notes);
}

// ---------- Stats calculation ----------
function computeStats() {
  const today = startOfDay(new Date());

  let worked = 0, rested = 0, easy = 0, hard = 0, elapsed = 0;

  shiftDays.forEach(day => {
    const work = isWorkDay(day);
    const iso = toISO(day);
    if (day <= today) {
      elapsed++;
      if (work) worked++; else rested++;
    }
    if (marks[iso] === 'easy') easy++;
    if (marks[iso] === 'hard') hard++;
  });

  let daysLeft;
  if (today < startOfDay(START)) daysLeft = totalDays;
  else if (today > startOfDay(END)) daysLeft = 0;
  else daysLeft = daysBetween(today, END);

  const clampedElapsed = Math.min(Math.max(elapsed, 0), totalDays);
  const percent = totalDays > 0 ? Math.round((clampedElapsed / totalDays) * 100) : 0;

  return { worked, rested, easy, hard, elapsed: clampedElapsed, daysLeft, percent };
}

// ---------- Rendering: header & stats ----------
function renderHeader() {
  const today = startOfDay(new Date());
  const pill = document.getElementById('todayPill');
  const d = today.getDate();
  const m = MONTH_NAMES[today.getMonth()];
  pill.textContent = `сегодня, ${d} ${m}`;

  const rangeLabel = document.getElementById('rangeLabel');
  const startD = START.getDate(), startM = MONTH_NAMES[START.getMonth()];
  const endD = END.getDate(), endM = MONTH_NAMES[END.getMonth()];
  rangeLabel.textContent = `${startD} ${startM} — ${endD} ${endM}`;

  const foot = document.querySelector('.foot p');
  if (foot) {
    foot.textContent = `${startD} ${startM} ${START.getFullYear()} — ${endD} ${endM} ${END.getFullYear()} · график ${WORK_LEN}/${REST_LEN}`;
  }
}

function renderStats() {
  const s = computeStats();
  document.getElementById('statWorked').textContent = s.worked;
  document.getElementById('statRested').textContent = s.rested;
  document.getElementById('statEasy').textContent = s.easy;
  document.getElementById('statHard').textContent = s.hard;

  document.getElementById('progressPercent').textContent = `${s.percent}%`;
  document.getElementById('progressFill').style.width = `${s.percent}%`;
  document.getElementById('progressDaysLabel').textContent = `День ${s.elapsed} из ${totalDays}`;

  let leftLabel;
  if (s.daysLeft <= 0) leftLabel = 'Смена завершена';
  else leftLabel = `Осталось ${s.daysLeft} дн.`;
  document.getElementById('daysLeftLabel').textContent = leftLabel;

  checkCompletionConfetti(s.percent);
}

// ---------- Rendering: swipeable calendar ----------
const monthsContainer = document.getElementById('months');
const monthDotsContainer = document.getElementById('monthDots');

function renderCalendar() {
  monthsContainer.innerHTML = '';
  monthDotsContainer.innerHTML = '';

  const monthsToRender = [];
  let cursor = new Date(START.getFullYear(), START.getMonth(), 1);
  const lastMonth = new Date(END.getFullYear(), END.getMonth(), 1);
  while (cursor <= lastMonth) {
    monthsToRender.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const today = startOfDay(new Date());
  let todayMonthIndex = 0;

  monthsToRender.forEach((monthDate, idx) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    if (year === today.getFullYear() && month === today.getMonth()) {
      todayMonthIndex = idx;
    }

    const block = document.createElement('div');
    block.className = 'month-block';

    const title = document.createElement('div');
    title.className = 'month-title';
    title.textContent = `${MONTH_TITLES[month]} ${year}`;
    block.appendChild(title);

    const weekdayRow = document.createElement('div');
    weekdayRow.className = 'weekday-row';
    WEEKDAYS.forEach(w => {
      const span = document.createElement('span');
      span.textContent = w;
      weekdayRow.appendChild(span);
    });
    block.appendChild(weekdayRow);

    const grid = document.createElement('div');
    grid.className = 'day-grid';

    const firstOfMonth = new Date(year, month, 1);
    let leadEmpty = firstOfMonth.getDay() - 1;
    if (leadEmpty < 0) leadEmpty = 6;

    for (let i = 0; i < leadEmpty; i++) {
      const empty = document.createElement('div');
      empty.className = 'day-cell empty';
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d, 12, 0, 0);
      const cell = document.createElement('div');
      cell.textContent = d;
      cell.className = 'day-cell';

      if (!inRange(date)) {
        cell.classList.add('out-of-range');
      } else {
        const work = isWorkDay(date);
        const iso = toISO(date);
        if (work) {
          cell.classList.add('work');
          if (marks[iso] === 'easy') cell.classList.add('marked-easy');
          if (marks[iso] === 'hard') cell.classList.add('marked-hard');
          cell.addEventListener('click', () => openSheet(date));

          if (notes[iso] && notes[iso].trim()) {
            const dot = document.createElement('span');
            dot.className = 'mark-dot';
            dot.style.background = 'rgba(0,0,0,0.55)';
            cell.appendChild(dot);
          }
        } else {
          cell.classList.add('rest');
        }
      }

      if (sameDay(date, today)) {
        cell.classList.add('today');
      }

      grid.appendChild(cell);
    }

    block.appendChild(grid);
    monthsContainer.appendChild(block);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'month-dot';
    dot.setAttribute('aria-label', `${MONTH_TITLES[month]}`);
    dot.addEventListener('click', () => {
      monthsContainer.scrollTo({ left: idx * monthsContainer.clientWidth, behavior: 'smooth' });
    });
    monthDotsContainer.appendChild(dot);
  });

  updateActiveDot();

  // Jump straight to the month containing "today" on first render
  requestAnimationFrame(() => {
    monthsContainer.scrollTo({ left: todayMonthIndex * monthsContainer.clientWidth, behavior: 'auto' });
    updateActiveDot();
  });
}

function updateActiveDot() {
  const dots = monthDotsContainer.querySelectorAll('.month-dot');
  if (!dots.length || monthsContainer.clientWidth === 0) return;
  const index = Math.round(monthsContainer.scrollLeft / monthsContainer.clientWidth);
  dots.forEach((d, i) => d.classList.toggle('active', i === index));
}

let scrollDebounce;
monthsContainer.addEventListener('scroll', () => {
  clearTimeout(scrollDebounce);
  scrollDebounce = setTimeout(updateActiveDot, 60);
});

window.addEventListener('resize', () => updateActiveDot());

// ---------- Rendering: weekly trend chart (Chart.js) ----------
let trendChartInstance = null;

function renderTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const weekSize = 7;
  const labels = [];
  const easyData = [];
  const hardData = [];

  for (let i = 0; i < shiftDays.length; i += weekSize) {
    const chunk = shiftDays.slice(i, i + weekSize);
    let easyCount = 0, hardCount = 0;
    chunk.forEach(day => {
      const iso = toISO(day);
      if (marks[iso] === 'easy') easyCount++;
      if (marks[iso] === 'hard') hardCount++;
    });
    labels.push(`Нед ${Math.floor(i / weekSize) + 1}`);
    easyData.push(easyCount);
    hardData.push(hardCount);
  }

  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  trendChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Легко',
          data: easyData,
          backgroundColor: 'rgba(107, 220, 138, 0.85)',
          borderRadius: 6,
          maxBarThickness: 22,
        },
        {
          label: 'Сложно',
          data: hardData,
          backgroundColor: 'rgba(255, 107, 87, 0.85)',
          borderRadius: 6,
          maxBarThickness: 22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          ticks: { color: 'rgba(255,255,255,0.55)', font: { size: 11 } },
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { color: 'rgba(255,255,255,0.4)', stepSize: 1, font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
      },
      plugins: {
        legend: {
          labels: { color: 'rgba(255,255,255,0.75)', boxWidth: 10, font: { size: 12 } },
        },
      },
    },
  });
}

function renderAll() {
  renderHeader();
  renderStats();
  renderCalendar();
  renderTrendChart();
}

// ---------- Bottom sheet: mark a work day ----------
const overlay = document.getElementById('sheetOverlay');
const sheetDate = document.getElementById('sheetDate');
const sheetSubtitle = document.getElementById('sheetSubtitle');
const sheetNote = document.getElementById('sheetNote');
const btnEasy = document.getElementById('btnEasy');
const btnHard = document.getElementById('btnHard');
const btnClear = document.getElementById('btnClear');
const sheetClose = document.getElementById('sheetClose');

let activeISO = null;

function openSheet(date) {
  activeISO = toISO(date);
  const d = date.getDate();
  const m = MONTH_NAMES[date.getMonth()];
  sheetDate.textContent = `${d} ${m}`;
  const current = marks[activeISO];
  sheetSubtitle.textContent = current
    ? `Отмечено: ${current === 'easy' ? 'легко' : 'сложно'}`
    : 'Как прошёл рабочий день?';
  sheetNote.value = notes[activeISO] || '';
  overlay.classList.add('open');
}

function closeSheet() {
  overlay.classList.remove('open');
  activeISO = null;
}

function saveNoteForActive() {
  const val = sheetNote.value.trim();
  if (val) {
    notes[activeISO] = val;
  } else {
    delete notes[activeISO];
  }
  saveNotes();
}

btnEasy.addEventListener('click', () => {
  if (!activeISO) return;
  marks[activeISO] = 'easy';
  saveMarks();
  saveNoteForActive();
  closeSheet();
  renderAll();
  launchConfetti(60);
});

btnHard.addEventListener('click', () => {
  if (!activeISO) return;
  marks[activeISO] = 'hard';
  saveMarks();
  saveNoteForActive();
  closeSheet();
  renderAll();
});

btnClear.addEventListener('click', () => {
  if (!activeISO) return;
  delete marks[activeISO];
  delete notes[activeISO];
  saveMarks();
  saveNotes();
  closeSheet();
  renderAll();
});

sheetClose.addEventListener('click', closeSheet);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeSheet();
});

// ---------- Settings sheet: schedule editor + notifications ----------
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsBtn = document.getElementById('settingsBtn');
const settingsClose = document.getElementById('settingsClose');

const inputStart = document.getElementById('inputStart');
const inputEnd = document.getElementById('inputEnd');
const inputWorkLen = document.getElementById('inputWorkLen');
const inputRestLen = document.getElementById('inputRestLen');
const btnSaveSchedule = document.getElementById('btnSaveSchedule');

const inputNotifTime = document.getElementById('inputNotifTime');
const btnEnableNotif = document.getElementById('btnEnableNotif');
const btnTestNotif = document.getElementById('btnTestNotif');
const notifStatus = document.getElementById('notifStatus');

let notifSettings = { ...DEFAULT_NOTIF, ...loadJSON(NOTIF_KEY, {}) };

function fillSettingsForm() {
  inputStart.value = settings.start;
  inputEnd.value = settings.end;
  inputWorkLen.value = settings.workLen;
  inputRestLen.value = settings.restLen;
  inputNotifTime.value = notifSettings.time;
  updateNotifStatusLabel();
}

function openSettings() {
  fillSettingsForm();
  settingsOverlay.classList.add('open');
}

function closeSettings() {
  settingsOverlay.classList.remove('open');
}

settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) closeSettings();
});

btnSaveSchedule.addEventListener('click', () => {
  const newStart = inputStart.value;
  const newEnd = inputEnd.value;
  const newWorkLen = parseInt(inputWorkLen.value, 10);
  const newRestLen = parseInt(inputRestLen.value, 10);

  if (!newStart || !newEnd) {
    notifStatus.textContent = 'Укажи обе даты';
    return;
  }
  if (newEnd < newStart) {
    notifStatus.textContent = 'Конец периода раньше начала';
    return;
  }

  settings = {
    start: newStart,
    end: newEnd,
    workLen: newWorkLen > 0 ? newWorkLen : 2,
    restLen: newRestLen > 0 ? newRestLen : 2,
  };
  saveJSON(SETTINGS_KEY, settings);
  rebuildSchedule();
  renderAll();
  closeSettings();
});

// ---------- Notifications ----------
function updateNotifStatusLabel() {
  if (!('Notification' in window)) {
    notifStatus.textContent = 'Уведомления не поддерживаются этим браузером';
    btnEnableNotif.disabled = true;
    return;
  }
  if (Notification.permission === 'denied') {
    notifStatus.textContent = 'Уведомления заблокированы в настройках браузера';
  } else if (Notification.permission === 'granted' && notifSettings.enabled) {
    notifStatus.textContent = `Включены · напомним в ${notifSettings.time}`;
  } else {
    notifStatus.textContent = 'Уведомления выключены';
  }
}

async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

async function showLocalNotification(title, body) {
  const options = {
    body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'shift-reminder',
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({ type: 'SHOW_NOTIFICATION', payload: { title, options } });
        return;
      }
    }
    new Notification(title, options);
  } catch (e) {
    try { new Notification(title, options); } catch (e2) { /* ignore */ }
  }
}

btnEnableNotif.addEventListener('click', async () => {
  const granted = await requestNotifPermission();
  if (!granted) {
    updateNotifStatusLabel();
    return;
  }
  notifSettings.enabled = true;
  notifSettings.time = inputNotifTime.value || notifSettings.time;
  saveJSON(NOTIF_KEY, notifSettings);
  updateNotifStatusLabel();
  showLocalNotification('Напоминания включены', `Будем напоминать в ${notifSettings.time}, если рабочий день не отмечен`);
});

inputNotifTime.addEventListener('change', () => {
  notifSettings.time = inputNotifTime.value;
  saveJSON(NOTIF_KEY, notifSettings);
  updateNotifStatusLabel();
});

btnTestNotif.addEventListener('click', async () => {
  const granted = await requestNotifPermission();
  if (!granted) {
    updateNotifStatusLabel();
    return;
  }
  showLocalNotification('Смена 2/2', 'Это тестовое уведомление 👋');
});

function checkReminderTick() {
  if (!notifSettings.enabled) return;
  if (Notification.permission !== 'granted') return;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentHM = `${hh}:${mm}`;

  if (currentHM !== notifSettings.time) return;

  const todayISO = toISO(now);
  const lastNotified = localStorage.getItem(LAST_NOTIFIED_KEY);
  if (lastNotified === todayISO) return;

  const today = startOfDay(now);
  if (!inRange(today)) return;

  const work = isWorkDay(today);
  if (!work) return;
  if (marks[todayISO]) return;

  showLocalNotification('Не забудь отметить смену', 'Сегодня рабочий день — легко или сложно прошёл?');
  localStorage.setItem(LAST_NOTIFIED_KEY, todayISO);
}

setInterval(checkReminderTick, 60 * 1000);

// ---------- Confetti (vanilla canvas, no dependency) ----------
const confettiCanvas = document.getElementById('confettiCanvas');
const confettiCtx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let confettiRAF = null;

function resizeConfettiCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeConfettiCanvas();
window.addEventListener('resize', resizeConfettiCanvas);

const CONFETTI_COLORS = ['#ffffff', '#6bdc8a', '#ff6b57', '#dcdce6', '#8f8f95'];

function launchConfetti(count = 80) {
  const w = confettiCanvas.width;
  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x: w / 2 + (Math.random() - 0.5) * w * 0.4,
      y: -20 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 6,
      vy: 2 + Math.random() * 4,
      size: 4 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      life: 0,
      maxLife: 140 + Math.random() * 60,
    });
  }
  if (!confettiRAF) {
    confettiRAF = requestAnimationFrame(tickConfetti);
  }
}

function tickConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  confettiParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.rotation += p.rotationSpeed;
    p.life++;

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate((p.rotation * Math.PI) / 180);
    confettiCtx.fillStyle = p.color;
    const fade = Math.max(0, 1 - p.life / p.maxLife);
    confettiCtx.globalAlpha = fade;

    if (p.shape === 'rect') {
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    } else {
      confettiCtx.beginPath();
      confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      confettiCtx.fill();
    }
    confettiCtx.restore();
  });

  confettiParticles = confettiParticles.filter(
    p => p.life < p.maxLife && p.y < confettiCanvas.height + 40
  );

  if (confettiParticles.length > 0) {
    confettiRAF = requestAnimationFrame(tickConfetti);
  } else {
    confettiRAF = null;
  }
}

function checkCompletionConfetti(percent) {
  const flagKey = `${CONFETTI_SHOWN_KEY}-${settings.start}-${settings.end}`;
  if (percent >= 100 && !localStorage.getItem(flagKey)) {
    localStorage.setItem(flagKey, '1');
    launchConfetti(160);
  }
}

// ---------- Service worker registration (PWA) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
  });
}

// ---------- Init ----------
rebuildSchedule();
renderAll();
updateNotifStatusLabel();
