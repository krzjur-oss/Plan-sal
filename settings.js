// ================================================================
//  settings.js — Etap 7 refaktoryzacji PlanLekcji
//  Zawiera: openSettingsPanel, closeSettingsPanel, switchSettingsTab,
//           zakładki: klasy, nauczyciele, przedmioty, godziny, sale
// ================================================================

import {
  appState, schedData,
} from './state.js';

import {
  esc, notify, showConfirm,
  flattenColumns,
} from './helpers.js';

import { persistAll, normalizeClassName } from './import-export.js';

import { openEditWizard } from './storage.js';

import { renderSchedule } from './schedule.js';
import { focusFirstIn } from './ui.js';

// ================================================================
//  PANEL USTAWIEŃ — nawigacja
// ================================================================

let _settingsTab = 'classes';
let _lastFocusSettings = null; // element fokusowany przed otwarciem panelu ustawień

export function openSettingsPanel(tab) {
  if (!appState) return;
  _lastFocusSettings = document.activeElement; // zapamiętaj fokus
  _settingsTab = tab || _settingsTab || 'classes';
  document.getElementById('settingsPanelOverlay').classList.add('show');
  document.getElementById('settingsPanel').classList.add('open');
  _renderSettingsTab(_settingsTab);
  focusFirstIn(document.getElementById('settingsPanel'));
}

export function closeSettingsPanel() {
  document.getElementById('settingsPanelOverlay').classList.remove('show');
  document.getElementById('settingsPanel').classList.remove('open');
  // Przywróć fokus do elementu który otworzył panel
  _lastFocusSettings?.focus({ preventScroll: true });
  _lastFocusSettings = null;
}

export function switchSettingsTab(tab) {
  // Reset dirty flag when switching tabs
  _spHoursDirty = false;
  const btn = document.getElementById('spHoursSaveBtn');
  if (btn) btn.style.display = 'none';
  _settingsTab = tab;
  document.querySelectorAll('.settings-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  _renderSettingsTab(tab);
}

function _renderSettingsTab(tab) {
  const body = document.getElementById('settingsBody');
  if (!body) return;
  switch (tab) {
    case 'classes':  body.innerHTML = _spBuildClasses();  break;
    case 'teachers': body.innerHTML = _spBuildTeachers(); break;
    case 'subjects': body.innerHTML = _spBuildSubjects(); break;
    case 'hours':    body.innerHTML = _spBuildHours();    break;
    case 'rooms':    body.innerHTML = _spBuildRooms();    break;
    default:         body.innerHTML = '';
  }
}

// ================================================================
//  HELPERS — zbiory używanych elementów
// ================================================================

function _spUsedClasses() {
  const used = new Set();
  const yk = appState.yearKey;
  Object.values(schedData[yk] || {}).forEach(day =>
    Object.values(day).forEach(hour =>
      Object.values(hour).forEach(entry => {
        (entry.classes || []).forEach(c => used.add(c));
        if (entry.className) used.add(entry.className);
      })
    )
  );
  return used;
}

function _spUsedTeachers() {
  const used = new Set();
  const yk = appState.yearKey;
  Object.values(schedData[yk] || {}).forEach(day =>
    Object.values(day).forEach(hour =>
      Object.values(hour).forEach(entry => {
        if (entry.teacherAbbr) used.add(entry.teacherAbbr);
      })
    )
  );
  return used;
}

function _spUsedSubjects() {
  const used = new Set();
  const yk = appState.yearKey;
  Object.values(schedData[yk] || {}).forEach(day =>
    Object.values(day).forEach(hour =>
      Object.values(hour).forEach(entry => {
        if (entry.subject) used.add(entry.subject);
      })
    )
  );
  return used;
}

// ================================================================
//  ZAKŁADKA: KLASY
// ================================================================

function _spBuildClasses() {
  const usedAbbrs = _spUsedClasses();
  const all       = appState.classes || [];
  const baseNames = [...new Set(all.filter(c => !c.baseClass).map(c => c.name))].sort();

  const sortedCls = all
    .map((c, i) => ({c, i}))
    .sort((a, b) =>
      (a.c.name || '').localeCompare(b.c.name || '', 'pl', {sensitivity: 'base'}) ||
      (a.c.group || '').localeCompare(b.c.group || '', 'pl', {sensitivity: 'base'})
    );

  const rows = sortedCls.map(({c, i}) => {
    const abbr       = c.abbr || c.name;
    const inUse      = usedAbbrs.has(abbr);
    const isSubgroup = c.group && c.group.trim().toLowerCase() !== 'cała klasa' && c.group.trim() !== '';
    const baseOpts   = baseNames
      .filter(n => n !== c.name)
      .map(n => `<option value="${esc(n)}"${n === (c.baseClass || '') ? ' selected' : ''}>${esc(n)}</option>`)
      .join('');

    return `<div class="sp-row">
      <input class="sp-inp" style="max-width:72px;font-family:var(--mono);font-weight:700"
        value="${esc(c.name)}" placeholder="np. 1A" title="Nazwa klasy"
        onchange="spClassSetName(${i},this.value)">
      <input class="sp-inp-mono" value="${esc(abbr)}" maxlength="12" placeholder="skrót"
        title="Skrót (unikalny identyfikator)"
        onchange="spClassSetAbbr(${i},this.value)">
      <input class="sp-inp" value="${esc(c.group || '')}" placeholder="cała klasa / gr.1 / religia…"
        title="Nazwa grupy"
        onchange="spClassSetGroup(${i},this.value)">
      ${isSubgroup
        ? `<select class="class-base-sel" style="font-size:0.72rem;width:80px;flex-shrink:0"
              title="Klasa bazowa" onchange="spClassSetBase(${i},this.value)">
            <option value=""${!c.baseClass ? ' selected' : ''}>—</option>${baseOpts}
          </select>`
        : `<span style="width:80px;flex-shrink:0"></span>`}
      ${inUse ? `<span class="sp-badge-used" title="Używana w planie">w planie</span>` : ''}
      <button class="icon-btn danger" title="${inUse ? 'Uwaga: używana w planie!' : 'Usuń'}"
        onclick="spClassDelete(${i})" style="${inUse ? 'opacity:0.5' : ''}">✕</button>
    </div>`;
  }).join('');

  return '<div class="sp-section-title">Klasy i grupy</div>' +
    '<button class="btn btn-sm sp-add-btn" onclick="spClassAdd()" style="margin-bottom:6px">＋ Dodaj klasę</button>' +
    (rows || '<div class="sp-info-box">Brak klas.</div>');
}

export function spClassAdd() {
  if (!appState.classes) appState.classes = [];
  appState.classes.push({name: '', abbr: '', group: 'cała klasa', baseClass: ''});
  persistAll();
  _renderSettingsTab('classes');
  setTimeout(() => {
    const firstRow = document.querySelector('#settingsBody .sp-row');
    if (firstRow) {
      firstRow.scrollIntoView({behavior: 'smooth', block: 'nearest'});
      firstRow.querySelector('.sp-inp')?.focus();
    }
  }, 50);
}

export function spClassSetName(i, val) {
  if (!appState.classes[i]) return;
  appState.classes[i].name = normalizeClassName(val);
  persistAll();
  _renderSettingsTab('classes');
}

export function spClassSetAbbr(i, newAbbr) {
  const cls = appState.classes[i];
  if (!cls) return;
  const oldAbbr = cls.abbr || cls.name;
  newAbbr = newAbbr.trim().toUpperCase();
  if (!newAbbr || newAbbr === oldAbbr) return;
  if (appState.classes.some((c, j) => j !== i && (c.abbr || c.name) === newAbbr)) {
    notify('⚠ Skrót „' + newAbbr + '\" jest już używany przez inną klasę — zmiana zablokowana', true);
    _renderSettingsTab('classes');
    return;
  }
  // Kaskadowa zmiana w schedData
  const yk = appState.yearKey;
  let changed = 0;
  Object.values(schedData[yk] || {}).forEach(day =>
    Object.values(day).forEach(hour =>
      Object.values(hour).forEach(entry => {
        if (entry.classes) {
          const idx = entry.classes.indexOf(oldAbbr);
          if (idx >= 0) { entry.classes[idx] = newAbbr; changed++; }
        }
        if (entry.className === oldAbbr) { entry.className = newAbbr; changed++; }
      })
    )
  );
  cls.abbr = newAbbr;
  persistAll();
  if (changed) notify(`✓ Skrót zmieniony. Zaktualizowano ${changed} wpisów w planie.`);
  _renderSettingsTab('classes');
}

export function spClassSetGroup(i, val) {
  if (!appState.classes[i]) return;
  appState.classes[i].group = val;
  persistAll();
  _renderSettingsTab('classes');
}

export function spClassSetBase(i, val) {
  if (!appState.classes[i]) return;
  appState.classes[i].baseClass = val;
  persistAll();
}

export function spClassDelete(i) {
  const cls = appState.classes[i];
  if (!cls) return;
  const abbr = cls.abbr || cls.name;
  const used = _spUsedClasses().has(abbr);
  const doDelete = () => {
    appState.classes.splice(i, 1);
    persistAll();
    renderSchedule();
    _renderSettingsTab('classes');
    notify('🗑 Klasa usunięta');
  };
  if (used) {
    showConfirm({
      messageText:  `Klasa „${abbr}" jest używana w planie. Usunięcie nie wyczyści istniejących wpisów — pojawią się jako nieznane. Kontynuować?`,
      confirmLabel: '🗑 Usuń mimo to',
      danger:       true,
      onConfirm:    doDelete,
    });
  } else {
    doDelete();
  }
}

// ================================================================
//  ZAKŁADKA: NAUCZYCIELE
// ================================================================

function _spBuildTeachers() {
  const usedAbbrs = _spUsedTeachers();
  const all       = appState.teachers || [];

  const sorted = all
    .map((t, i) => ({t, i}))
    .sort((a, b) =>
      (a.t.last || '').localeCompare(b.t.last || '', 'pl', {sensitivity: 'base'}) ||
      (a.t.first || '').localeCompare(b.t.first || '', 'pl', {sensitivity: 'base'})
    );

  const rows = sorted.map(({t, i}) => {
    const inUse = usedAbbrs.has(t.abbr);
    return `<div class="sp-row">
      <input class="sp-inp" value="${esc(t.last || '')}" placeholder="Nazwisko"
        title="Nazwisko" onchange="spTeacherSet(${i},'last',this.value)">
      <input class="sp-inp" value="${esc(t.first || '')}" placeholder="Imię" style="max-width:80px"
        title="Imię" onchange="spTeacherSet(${i},'first',this.value)">
      <input class="sp-inp-mono" value="${esc(t.abbr || '')}" maxlength="6" placeholder="SKR"
        title="Skrót (unikalny)"
        onchange="spTeacherSetAbbr(${i},this.value)">
      ${inUse ? '<span class="sp-badge-used" title="Nauczyciel ma zajęcia w planie">w planie</span>' : ''}
      <button class="icon-btn danger" title="${inUse ? 'Uwaga: ma zajęcia w planie!' : 'Usuń'}"
        onclick="spTeacherDelete(${i})" style="${inUse ? 'opacity:0.5' : ''}">✕</button>
    </div>`;
  }).join('');

  return '<div class="sp-section-title">Nauczyciele</div>' +
    '<button class="btn btn-sm sp-add-btn" onclick="spTeacherAdd()" style="margin-bottom:6px">＋ Dodaj nauczyciela</button>' +
    (rows || '<div class="sp-info-box">Brak nauczycieli.</div>');
}

export function spTeacherAdd() {
  if (!appState.teachers) appState.teachers = [];
  appState.teachers.push({last: '', first: '', abbr: ''});
  persistAll();
  _renderSettingsTab('teachers');
  setTimeout(() => {
    const firstRow = document.querySelector('#settingsBody .sp-row');
    if (firstRow) {
      firstRow.scrollIntoView({behavior: 'smooth', block: 'nearest'});
      firstRow.querySelector('.sp-inp')?.focus();
    }
  }, 50);
}

export function spTeacherSet(i, field, val) {
  if (!appState.teachers[i]) return;
  appState.teachers[i][field] = val.trim();
  persistAll();
}

export function spTeacherSetAbbr(i, newAbbr) {
  const t = appState.teachers[i];
  if (!t) return;
  const oldAbbr = t.abbr;
  newAbbr = newAbbr.trim().toUpperCase();
  if (!newAbbr || newAbbr === oldAbbr) return;
  if (appState.teachers.some((x, j) => j !== i && x.abbr === newAbbr)) {
    notify('⚠ Skrót „' + newAbbr + '\" jest już używany przez innego nauczyciela — zmiana zablokowana', true);
    _renderSettingsTab('teachers');
    return;
  }
  // Kaskadowa zmiana w schedData
  const yk = appState.yearKey;
  let changed = 0;
  Object.values(schedData[yk] || {}).forEach(day =>
    Object.values(day).forEach(hour =>
      Object.values(hour).forEach(entry => {
        if (entry.teacherAbbr === oldAbbr) { entry.teacherAbbr = newAbbr; changed++; }
      })
    )
  );
  t.abbr = newAbbr;
  persistAll();
  if (changed) notify(`✓ Skrót zmieniony. Zaktualizowano ${changed} wpisów w planie.`);
  _renderSettingsTab('teachers');
}

export function spTeacherDelete(i) {
  const t = appState.teachers[i];
  if (!t) return;
  const used = _spUsedTeachers().has(t.abbr);
  const doDelete = () => {
    appState.teachers.splice(i, 1);
    persistAll();
    renderSchedule();
    _renderSettingsTab('teachers');
    notify('🗑 Nauczyciel usunięty');
  };
  if (used) {
    showConfirm({
      messageText:  `Nauczyciel „${t.abbr}" ma zajęcia w planie. Wpisy pozostaną, ale nauczyciel nie będzie rozpoznawany. Kontynuować?`,
      confirmLabel: '🗑 Usuń mimo to',
      danger:       true,
      onConfirm:    doDelete,
    });
  } else {
    doDelete();
  }
}

// ================================================================
//  ZAKŁADKA: PRZEDMIOTY
// ================================================================

function _spBuildSubjects() {
  const usedNames = _spUsedSubjects();
  const all       = appState.subjects || [];

  const sortedSubj = all
    .map((s, i) => ({s, i}))
    .sort((a, b) => (a.s.name || '').localeCompare(b.s.name || '', 'pl', {sensitivity: 'base'}));

  const rows = sortedSubj.map(({s, i}) => {
    const inUse = usedNames.has(s.name);
    return `<div class="sp-row">
      <input class="sp-inp" value="${esc(s.name || '')}" placeholder="Nazwa przedmiotu"
        onchange="spSubjectSet(${i},'name',this.value)">
      ${inUse ? `<span class="sp-badge-used">w planie</span>` : ''}
      <button class="icon-btn danger" onclick="spSubjectDelete(${i})"
        title="${inUse ? 'Uwaga: używany w planie!' : 'Usuń'}"
        style="${inUse ? 'opacity:0.5' : ''}">✕</button>
    </div>`;
  }).join('');

  return '<div class="sp-section-title">Przedmioty</div>' +
    '<button class="btn btn-sm sp-add-btn" onclick="spSubjectAdd()" style="margin-bottom:6px">＋ Dodaj przedmiot</button>' +
    (rows || '<div class="sp-info-box">Brak przedmiotów.</div>');
}

export function spSubjectAdd() {
  if (!appState.subjects) appState.subjects = [];
  appState.subjects.push({name: ''});
  persistAll();
  _renderSettingsTab('subjects');
  setTimeout(() => {
    const firstRow = document.querySelector('#settingsBody .sp-row');
    if (firstRow) {
      firstRow.scrollIntoView({behavior: 'smooth', block: 'nearest'});
      firstRow.querySelector('.sp-inp')?.focus();
    }
  }, 50);
}

export function spSubjectSet(i, field, val) {
  if (!appState.subjects[i]) return;
  appState.subjects[i][field] = val.trim();
  persistAll();
}

export function spSubjectDelete(i) {
  const s = appState.subjects[i];
  if (!s) return;
  const used = _spUsedSubjects().has(s.name);
  const doDelete = () => {
    appState.subjects.splice(i, 1);
    persistAll();
    _renderSettingsTab('subjects');
    notify('🗑 Przedmiot usunięty');
  };
  if (used) {
    showConfirm({
      messageText:  `Przedmiot „${s.name}" jest używany w planie. Wpisy pozostaną, ale przedmiot zniknie z podpowiedzi. Kontynuować?`,
      confirmLabel: '🗑 Usuń mimo to',
      danger:       true,
      onConfirm:    doDelete,
    });
  } else {
    doDelete();
  }
}

// ================================================================
//  ZAKŁADKA: GODZINY
// ================================================================

function _spBuildHours() {
  const hours     = appState.hours || [];
  const timeslots = appState.timeslots || [];
  const getTs     = h => timeslots.find(t => String(t.label) === String(h)) || {label: h, start: '', end: ''};

  const rows = hours.map((h, i) => {
    const ts = getTs(h);
    const usedInPlan = Object.values(schedData[appState.yearKey] || {}).some(day =>
      Object.values(day[h] || {}).some(entry =>
        entry.teacherAbbr || entry.subject || (entry.classes || []).length
      )
    );
    return `<div class="sp-hour-row">
      <span class="sp-hour-num">${esc(String(h))}</span>
      <input class="sp-time-inp" type="time" value="${esc(ts.start || '')}" title="Godzina rozpoczęcia"
        data-hour-idx="${i}" data-hour-field="start" onchange="spHourMarkDirty(this)">
      <input class="sp-time-inp" type="time" value="${esc(ts.end || '')}" title="Godzina zakończenia"
        data-hour-idx="${i}" data-hour-field="end" onchange="spHourMarkDirty(this)">
      <input class="sp-time-inp" value="${esc(ts.label !== h ? String(ts.label) : '')}"
        placeholder="etykieta (opcja)" title="Opcjonalna etykieta zastępująca numer"
        style="font-size:0.72rem" data-hour-idx="${i}" data-hour-field="label" onchange="spHourMarkDirty(this)">
      <button class="icon-btn danger" onclick="spHourDelete(${i})"
        title="${usedInPlan ? 'Uwaga: ma zajęcia!' : 'Usuń godzinę'}"
        style="${usedInPlan ? 'opacity:0.5' : ''}">✕</button>
    </div>`;
  }).join('');

  const header = `<div class="sp-hour-row" style="background:none;border-color:transparent;padding-bottom:0">
    <span class="sp-label" style="text-align:center">Nr</span>
    <span class="sp-label">Początek</span>
    <span class="sp-label">Koniec</span>
    <span class="sp-label">Etykieta</span>
    <span></span>
  </div>`;

  return `<div class="sp-section-title">Godziny lekcyjne</div>
    ${header}${rows || '<div class="sp-info-box">Brak godzin.</div>'}
    <button class="btn btn-sm sp-add-btn" onclick="spHourAdd()">＋ Dodaj godzinę</button>
    <button class="btn btn-sm" id="spHoursSaveBtn" onclick="spHoursSave()" style="margin-left:8px;display:none">💾 Zapisz</button>`;
}

// Flaga wskazująca czy są nie zapisane zmiany
let _spHoursDirty = false;

window.spHourMarkDirty = function(el) {
  _spHoursDirty = true;
  const btn = document.getElementById('spHoursSaveBtn');
  if (btn) btn.style.display = 'inline-block';
};

export function spHoursSave() {
  if (!_spHoursDirty) return;
  const hours = appState.hours || [];
  if (!appState.timeslots) appState.timeslots = [];

  // Zbierz nowe wartości z DOM
  const pending = {};
  document.querySelectorAll('[data-hour-idx]').forEach(inp => {
    const i = parseInt(inp.dataset.hourIdx, 10);
    const field = inp.dataset.hourField;
    const h = hours[i];
    if (h === undefined) return;
    if (!pending[h]) pending[h] = {};
    pending[h][field] = inp.value;
  });

  // Zbuduj tymczasowe timesloty do walidacji
  const draft = hours.map(h => {
    const existing = appState.timeslots.find(t => String(t.label) === String(h)) || { label: h, start: '', end: '' };
    const p = pending[h] || {};
    return {
      label: p.label !== undefined ? (p.label.trim() || h) : existing.label,
      start: p.start !== undefined ? p.start : existing.start,
      end:   p.end   !== undefined ? p.end   : existing.end,
    };
  });

  // Walidacja — zatrzymaj zapis jeśli są błędy
  const errors = _validateTimeslots(draft);
  if (errors.length) {
    notify(`⚠️ Popraw błędy przed zapisem:\n${errors.join('\n')}`, true);
    return;
  }

  // Zastosuj zatwierdzone wartości
  draft.forEach(d => {
    let ts = appState.timeslots.find(t => String(t.label) === String(d.label) ||
             String(t.label) === String(hours[hours.indexOf(d.label)]));
    // dopasuj po oryginalnym kluczu godziny
    const origH = hours.find(h => {
      const existing = appState.timeslots.find(t => String(t.label) === String(h));
      return existing ? existing.label === d.label : String(h) === String(d.label);
    });
    ts = origH !== undefined
      ? appState.timeslots.find(t => String(t.label) === String(origH)) || null
      : null;
    if (!ts) { ts = { label: d.label, start: d.start, end: d.end }; appState.timeslots.push(ts); }
    else { ts.label = d.label; ts.start = d.start; ts.end = d.end; }
  });

  _spHoursDirty = false;
  const btn = document.getElementById('spHoursSaveBtn');
  if (btn) btn.style.display = 'none';
  persistAll();
  renderSchedule();
  notify('💾 Zapisano godziny');
}

export function spHourAdd() {
  const hours = appState.hours || [];
  const last  = hours.length ? Math.max(...hours.map(Number).filter(n => !isNaN(n))) : 0;
  const next  = last + 1;
  appState.hours = [...hours, next];
  const yk = appState.yearKey;
  Object.keys(schedData[yk] || {}).forEach(di => {
    if (!schedData[yk][di][next]) schedData[yk][di][next] = {};
  });
  _spHoursDirty = false;
  persistAll();
  renderSchedule();
  _renderSettingsTab('hours');
}

// ================================================================
//  WALIDACJA TIMESLOTÓW
// ================================================================

/** Sprawdza czy wartość ma format HH:MM i jest poprawną godziną */
function _isValidTime(val) {
  if (!val || !/^\d{2}:\d{2}$/.test(val)) return false;
  const [h, m] = val.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/**
 * Waliduje cały zestaw timeslotów — zwraca tablicę komunikatów błędów.
 * Sprawdza: poprawność formatu, start < end, brak nakładania sąsiednich.
 */
function _validateTimeslots(timeslots) {
  const errors = [];
  timeslots.forEach((ts, i) => {
    const label = `Godz. ${ts.label}`;
    if (ts.start && !_isValidTime(ts.start))
      errors.push(`${label}: nieprawidłowy format początku (${ts.start}), oczekiwano HH:MM`);
    if (ts.end && !_isValidTime(ts.end))
      errors.push(`${label}: nieprawidłowy format końca (${ts.end}), oczekiwano HH:MM`);
    if (ts.start && ts.end && _isValidTime(ts.start) && _isValidTime(ts.end) && ts.start >= ts.end)
      errors.push(`${label}: początek (${ts.start}) musi być wcześniej niż koniec (${ts.end})`);
    if (i > 0) {
      const prev = timeslots[i - 1];
      if (prev.end && ts.start && _isValidTime(prev.end) && _isValidTime(ts.start) && prev.end > ts.start)
        errors.push(`Godz. ${prev.label} (koniec ${prev.end}) nakłada się na godz. ${ts.label} (początek ${ts.start})`);
    }
  });
  return errors;
}

export function spHourSetTime(i, field, val) {
  const h = (appState.hours || [])[i];
  if (h === undefined) return;
  // Walidacja formatu — puste pole jest dozwolone (brak timeslotu)
  if (val && !_isValidTime(val)) {
    notify(`⚠️ Nieprawidłowy format czasu „${val}" — oczekiwano HH:MM (np. 08:00)`, true);
    return;
  }
  if (!appState.timeslots) appState.timeslots = [];
  let ts = appState.timeslots.find(t => String(t.label) === String(h));
  if (!ts) { ts = {label: h, start: '', end: ''}; appState.timeslots.push(ts); }
  // Walidacja start < end po wpisaniu obu wartości
  const newTs = { ...ts, [field]: val };
  if (newTs.start && newTs.end && _isValidTime(newTs.start) && _isValidTime(newTs.end) && newTs.start >= newTs.end) {
    notify(`⚠️ Godz. ${h}: początek (${newTs.start}) musi być wcześniej niż koniec (${newTs.end})`, true);
    return;
  }
  ts[field] = val;
  persistAll();
}

export function spHourSetLabel(i, val) {
  const h = (appState.hours || [])[i];
  if (h === undefined) return;
  if (!appState.timeslots) appState.timeslots = [];
  let ts = appState.timeslots.find(t => String(t.label) === String(h) || t.label === h);
  if (!ts) { ts = {label: h, start: '', end: ''}; appState.timeslots.push(ts); }
  ts.label = val.trim() || h;
  persistAll();
}

export function spHourDelete(i) {
  const hours = appState.hours || [];
  const h     = hours[i];
  if (h === undefined) return;
  const yk = appState.yearKey;
  const usedInPlan = Object.values(schedData[yk] || {}).some(day =>
    Object.values(day[h] || {}).some(e => e.teacherAbbr || e.subject || (e.classes || []).length)
  );
  const doDelete = () => {
    appState.hours     = hours.filter((_, j) => j !== i);
    appState.timeslots = (appState.timeslots || []).filter(t => String(t.label) !== String(h));
    Object.keys(schedData[yk] || {}).forEach(di => { delete schedData[yk][di][h]; });
    persistAll();
    renderSchedule();
    _renderSettingsTab('hours');
    notify('🗑 Godzina ' + h + ' usunięta');
  };
  if (usedInPlan) {
    showConfirm({
      messageText:  `Godzina ${h} ma zajęcia w planie — zostaną trwale usunięte. Kontynuować?`,
      confirmLabel: '🗑 Usuń z danymi',
      danger:       true,
      onConfirm:    doDelete,
    });
  } else {
    doDelete();
  }
}

// ================================================================
//  ZAKŁADKA: SALE (widok tylko do odczytu)
// ================================================================

function _spBuildRooms() {
  const floors = appState.floors || [];
  const buildings = appState.buildings || [];
  let tree = '';
  floors.forEach((floor) => {
    tree += `<div class="sp-room-floor">📐 ${esc(floor.name)}</div>`;
    (floor.segments || []).forEach(seg => {
      tree += `<div class="sp-room-seg">└ ${esc(seg.name)}</div>`;
      (seg.rooms || []).forEach(room => {
        tree += `<div class="sp-room-num">• Sala ${esc(room.num)}${room.sub ? ' — ' + esc(room.sub) : ''}</div>`;
      });
    });
  });
  const totalRooms = flattenColumns(floors).length;

  // Budynki z flagą multi
  let bldRows = '';
  buildings.forEach((b, bi) => {
    bldRows += `<div class="sp-building-row">
      <label class="building-multi-label">
        <input type="checkbox" ${b.multi ? 'checked' : ''} onchange="spSetBuildingMulti(${bi},this.checked)">
        🏃 <strong>${esc(b.name || ('Budynek ' + (bi+1)))}</strong>
        <span class="building-multi-hint"> — obiekt sportowy/wieloosobowy</span>
      </label>
    </div>`;
  });

  return `<div class="sp-section-title">Obiekty sportowe / wieloosobowe</div>
    <div class="sp-info-box">
      Zaznacz budynki, w których wiele grup może przebywać jednocześnie (hala, basen, boisko).<br>
      Dla takich budynków kolizje nie są wykrywane i dostępny jest widok 🏃 WF.
    </div>
    <div style="margin-bottom:16px">${bldRows || '<div class="sp-info-box">Brak budynków.</div>'}</div>
    <div class="sp-section-title">Struktura sal</div>
    <div class="sp-info-box">
      <strong>${totalRooms} sal</strong> w ${floors.length} piętrach/obszarach.<br>
      Aby zmienić strukturę pięter, segmentów i sal, użyj kreatora roku szkolnego.
    </div>
    <div class="sp-info-box sp-room-tree" style="max-height:280px;overflow-y:auto">${tree || 'Brak danych.'}</div>
    <button class="btn btn-sm sp-add-btn" onclick="openEditWizard();closeSettingsPanel()">✏️ Edytuj w kreatorze</button>`;
}

export function spSetBuildingMulti(bi, val) {
  if (!appState.buildings) appState.buildings = [];
  if (appState.buildings[bi]) appState.buildings[bi].multi = val;
  persistAll();
  renderSchedule();          // odśwież toolbar (pokaż/ukryj przycisk WF)
  _renderSettingsTab('rooms'); // odśwież zakładkę (checkboxy)
}
