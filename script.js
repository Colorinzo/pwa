// ---------- Config ----------
const SETTINGS_KEY = 'shift-2-2-settings';
const MARKS_KEY = 'shift-2-2-marks';
const NOTIF_KEY = 'shift-2-2-notif';
const LAST_NOTIFIED_KEY = 'shift-2-2-last-notified';

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
  // Guard against a misconfigured end date before start date
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
  if (diff < 0) return null; // before range
  const cycleLen = WORK_LEN + REST_LEN;
  const cycle = ((diff % cycleLen) + cycleLen) % cycleLen;
  return cycle < WORK_LEN;
}

function inRange(date) {
  return date >= startOfDay(START) && date <= startOfDay(END);
}

// ---------- Marks storage ----------
let marks = loadJSON(MARKS_KEY, {});
function saveMarks() {
  saveJSON(MARKS_KEY, marks);
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

// ---------- Rendering ----------
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
}

function renderCalendar() {
  const container = document.getElementById('months');
  container.innerHTML = '';

  const monthsToRender = [];
  let cursor = new Date(START.getFullYear(), START.getMonth(), 1);
  const lastMonth = new Date(END.getFullYear(), END.getMonth(), 1);
  while (cursor <= lastMonth) {
    monthsToRender.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const today = startOfDay(new Date());

  monthsToRender.forEach(monthDate => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

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
    container.appendChild(block);
  });
}

function renderAll() {
  renderHeader();
  renderStats();
  renderCalendar();
}

// ---------- Bottom sheet: mark a work day ----------
const overlay = document.getElementById('sheetOverlay');
const sheetDate = document.getElementById('sheetDate');
const sheetSubtitle = document.getElementById('sheetSubtitle');
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
  overlay.classList.add('open');
}

function closeSheet() {
  overlay.classList.remove('open');
  activeISO = null;
}

btnEasy.addEventListener('click', () => {
  if (!activeISO) return;
  marks[activeISO] = 'easy';
  saveMarks();
  closeSheet();
  renderAll();
});

btnHard.addEventListener('click', () => {
  if (!activeISO) return;
  marks[activeISO] = 'hard';
  saveMarks();
  closeSheet();
  renderAll();
});

btnClear.addEventListener('click', () => {
  if (!activeISO) return;
  delete marks[activeISO];
  saveMarks();
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

// Checks once a minute whether it's time to remind the user about today's
// unmarked work day. Fires only while the app/tab is open (no push server).
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
  if (marks[todayISO]) return; // already marked

  showLocalNotification('Не забудь отметить смену', 'Сегодня рабочий день — легко или сложно прошёл?');
  localStorage.setItem(LAST_NOTIFIED_KEY, todayISO);
}

setInterval(checkReminderTick, 60 * 1000);

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
