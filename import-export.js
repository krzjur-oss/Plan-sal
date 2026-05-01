// ================================================================
//  IMPORT-EXPORT.JS — migracja danych, eksport/import JSON,
//                     bezpieczny zapis localStorage, persistAll,
//                     dane demo, migracja nazw klas
//  Zależy od: state.js, storage.js (DRAFT_KEY)
//  Eksportuje: normalizeAppState, migrateImportData, migrateClassNames,
//              normalizeClassName, exportJSON, handleImportFile,
//              openImportModal, closeImportModal, confirmImport,
//              initImportDragDrop, storageUsageBytes, formatBytes,
//              safeSetItem, persistAll, saveData, loadDemoData,
//              FILE_VERSION
// ================================================================

import {
  DAYS_DEFAULT,
  appState,       setAppState,
  schedData,      setSchedData,
  validFromDates, setValidFromDates,
  archive,        setArchive,
  currentDay,
} from './state.js';

import { DRAFT_KEY } from './storage.js';
import { flattenColumns, colKey, notify, esc, sbSet } from './helpers.js';

// mountApp i isDemoMode są w modułach wyżej w łańcuchu — używamy window
function _notify(msg, err) { notify(msg, err); }
function _mountApp()       { window.mountApp?.(); }
function _sbSet(msg)       { sbSet(msg); }
function _isDemoMode()     { return window.isDemoMode?.() || false; }


// ================================================================
//  WERSJA PLIKU I MIGRACJE
// ================================================================
export const FILE_VERSION = 2;

const _FILE_MIGRATIONS = {
  // v1 → v2: wprowadzono pole homerooms w appState
  1: function(data) {
    if (data.appState && !data.appState.homerooms) {
      data.appState.homerooms = {};
    }
    data._version = 2;
    return data;
  },
};

export function migrateImportData(data) {
  let v = data._version || 1;
  if (v > FILE_VERSION) {
    console.warn(
      '[PlanLekcji] Plik pochodzi z nowszej wersji aplikacji (' +
      v + ' > ' + FILE_VERSION + '). Niektóre dane mogą być zignorowane.'
    );
    return data;
  }
  while (v < FILE_VERSION) {
    const fn = _FILE_MIGRATIONS[v];
    if (!fn) { v++; continue; }
    console.log('[PlanLekcji] Migracja pliku v' + v + ' → v' + (v + 1));
    data = fn(data);
    v++;
  }
  return data;
}


// ================================================================
//  NORMALIZACJA APPSTATE
// ================================================================
export function normalizeAppState(state) {
  if (!state) return state;
  if (!state.homerooms)   state.homerooms   = {};
  if (!state.teachers)    state.teachers    = [];
  if (!state.classes)     state.classes     = [];
  if (!state.buildings)   state.buildings   = [];
  if (!state.assignments) state.assignments = {};
  if (!state.days)        state.days        = DAYS_DEFAULT;
  if (!state.school)      state.school      = {};
  if (!state.subjects)    state.subjects    = [];
  if (!state.timeslots)   state.timeslots   = [];
  if (!state.hours)       state.hours       = ['0','1','2','3','4','5','6','7','8'];
  // hours — stringi posortowane numerycznie (BUG-B fix)
  state.hours = state.hours
    .map(h => String(h).trim())
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));
  // floors — każde piętro musi mieć buildingIdx
  if (state.floors) {
    state.floors.forEach(f => {
      if (f.buildingIdx === undefined || f.buildingIdx === null) f.buildingIdx = 0;
    });
  }
  return state;
}

/**
 * Głębokie scalenie validFromDates: { yearKey: { dayIdx: isoDate } }.
 * Object.assign jest płytki — nadpisuje cały obiekt roku zamiast
 * scalać poszczególne dni. Ta funkcja scala poziom dni osobno.
 */
function _mergeValidFromDates(target, source) {
  if (!source || typeof source !== 'object') return;
  Object.keys(source).forEach(yk => {
    if (!target[yk] || typeof target[yk] !== 'object') {
      target[yk] = { ...source[yk] };
    } else {
      Object.keys(source[yk]).forEach(di => {
        // Nadpisujemy tylko jeśli źródło ma wartość a cel jej nie ma
        if (source[yk][di] && !target[yk][di]) {
          target[yk][di] = source[yk][di];
        }
      });
    }
  });
}

/**
 * Scala dwa archiwum lat szkolnych (tablice obiektów z yearKey).
 * Zwraca nową tablicę bez duplikatów — local ma pierwszeństwo.
 */
function _mergeArchives(local, imported) {
  if (!imported?.length) return local || [];
  if (!local?.length)    return imported;
  const seen = new Set((local).map(a => a.yearKey).filter(Boolean));
  const merged = [...local];
  imported.forEach(entry => {
    if (entry?.yearKey && !seen.has(entry.yearKey)) {
      seen.add(entry.yearKey);
      merged.push(entry);
    }
  });
  return merged;
}

/**
 * Scala pola appState (konfigurację szkoły) z importowanego pliku
 * do istniejącego lokalnego stanu. Nie nadpisuje pól już istniejących
 * — dodaje tylko to czego brakuje (nowi nauczyciele, klasy, itp.).
 */
function _mergeAppState(local, imported) {
  if (!imported) return;
  if (!local)    { setAppState(imported); return; }

  // Pola skalarne — uzupełniaj tylko jeśli brakuje
  if (!local.school?.name && imported.school?.name) {
    local.school = { ...local.school, ...imported.school };
  }
  if (!local.yearLabel && imported.yearLabel) local.yearLabel = imported.yearLabel;

  // Listy — dodaj brakujące wpisy wg unikalnego klucza
  local.teachers    = _mergeByKey(local.teachers    || [], imported.teachers    || [], t => t.abbr);
  local.classes     = _mergeByKey(local.classes     || [], imported.classes     || [], c => c.abbr);
  local.subjects    = _mergeByKey(local.subjects    || [], imported.subjects    || [], s => s.name || s.abbr);
  local.buildings   = _mergeByKey(local.buildings   || [], imported.buildings   || [], b => b.name);

  // homerooms — scalaj per klucz sali (local ma pierwszeństwo)
  if (imported.homerooms) {
    Object.keys(imported.homerooms).forEach(k => {
      if (!local.homerooms?.[k]) {
        if (!local.homerooms) local.homerooms = {};
        local.homerooms[k] = imported.homerooms[k];
      }
    });
  }

  // timeslots — scalaj wg label
  if (imported.timeslots?.length) {
    local.timeslots = _mergeByKey(local.timeslots || [], imported.timeslots, t => t.label);
  }
}

/** Scala dwie tablice deduplikując wg klucza — local ma pierwszeństwo. */
function _mergeByKey(local, imported, keyFn) {
  const seen = new Set(local.map(keyFn).filter(Boolean));
  const extras = imported.filter(item => {
    const k = keyFn(item);
    return k && !seen.has(k);
  });
  return extras.length ? [...local, ...extras] : local;
}


// ================================================================
//  MIGRACJA NAZW KLAS
// ================================================================
export function normalizeClassName(name) {
  if (!name) return '';
  return name.trim().replace(/^\w/, c => c.toUpperCase());
}

export function migrateClassNames(state) {
  if (!state || !Array.isArray(state.classes)) return;
  state.classes = state.classes.map(cl => ({
    ...cl,
    name:      normalizeClassName(cl.name || ''),
    abbr:      (cl.abbr || '').toUpperCase(),
    baseClass: cl.baseClass ?? '',
  }));
}


// ================================================================
//  EKSPORT JSON
// ================================================================
export function exportJSON() {
  const data = {
    _version:  FILE_VERSION,
    _exported: new Date().toISOString(),
    appState,
    schedData,
    validFromDates,
    archive,
  };
  const blob   = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  const date   = new Date().toISOString().slice(0, 10);
  const school = (appState?.school?.short || appState?.school?.name || 'SalePlan')
    .replace(/\s+/g, '_');
  a.href     = url;
  a.download = `${school}_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  _notify('✓ Wyeksportowano plan do pliku JSON');
}


// ================================================================
//  IMPORT JSON — modal porównania i scalania
// ================================================================
let _importData = null;

export function handleImportFile(file) {
  if (!file || !file.name.endsWith('.json')) {
    _notify('⚠ Wybierz plik .json', true); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      let data = JSON.parse(e.target.result);
      if (!data.schedData && !data.appState) {
        _notify('⚠ Nieprawidłowy format pliku', true); return;
      }
      data = migrateImportData(data);
      openImportModal(data);
    } catch(ex) {
      _notify('⚠ Błąd odczytu pliku: ' + ex.message, true);
    }
  };
  reader.onerror = () => _notify('⚠ Błąd odczytu pliku', true);
  reader.readAsText(file);
}

export function openImportModal(data) {
  _importData = data;
  const modal = document.getElementById('importModal');
  if (!modal) return;

  const impSched = data.schedData || {};
  const yk       = appState?.yearKey;
  let added = 0, conflicts = 0, same = 0;
  const impYear  = impSched[yk] || {};
  const curYear  = (schedData || {})[yk] || {};

  Object.keys(impYear).forEach(dayIdx => {
    const impDay = impYear[dayIdx] || {};
    const curDay = curYear[dayIdx] || {};
    Object.keys(impDay).forEach(hr => {
      const impHr = impDay[hr] || {};
      const curHr = curDay[hr] || {};
      Object.keys(impHr).forEach(key => {
        const ic = impHr[key], cc = curHr[key];
        const iF = !!(ic?.teacherAbbr || (ic?.classes||[]).length || ic?.className);
        const cF = !!(cc?.teacherAbbr || (cc?.classes||[]).length || cc?.className);
        if (!iF) return;
        if (!cF)                                          added++;
        else if (JSON.stringify(ic) === JSON.stringify(cc)) same++;
        else                                              conflicts++;
      });
    });
  });

  const hasConfig  = !!(data.appState);
  const hasArchive = !!(data.archive && data.archive.length);

  // Ostrzeżenie o potencjalnej desynchronizacji kluczy sal (colKey).
  // Klucze mają postać "f{fi}_s{si}_{num}" — zależą od kolejności pięter
  // i segmentów w appState.floors. Jeśli struktura sal w pliku różni się
  // od lokalnej, wpisy planu mogą trafić do złych sal.
  const impFloors = data.appState?.floors;
  const locFloors = appState?.floors;
  let structWarning = '';
  if (impFloors && locFloors) {
    const impSig = JSON.stringify(impFloors.map(f => ({
      n: f.name, bi: f.buildingIdx,
      segs: (f.segments||[]).map(s => ({ n: s.name, rc: (s.rooms||[]).length })),
    })));
    const locSig = JSON.stringify(locFloors.map(f => ({
      n: f.name, bi: f.buildingIdx,
      segs: (f.segments||[]).map(s => ({ n: s.name, rc: (s.rooms||[]).length })),
    })));
    if (impSig !== locSig) {
      structWarning = `<div class="import-stat conflict" style="margin-top:6px">` +
        `⚠ Struktura sal w pliku różni się od lokalnej — ` +
        `wpisy mogą trafić do innych sal. Zalecane: tryb <strong>Zastąp</strong>.` +
        `</div>`;
    }
  }

  document.getElementById('importInfo').innerHTML =
    `<div class="import-stat added">＋ ${added} nowych wpisów (zostaną dodane)</div>` +
    `<div class="import-stat conflict">${conflicts > 0 ? '⚠' : '✓'} ${conflicts} konfliktów</div>` +
    `<div class="import-stat same">= ${same} identycznych wpisów</div>` +
    `<div class="import-stat same">${hasConfig  ? '✓ Zawiera konfigurację szkoły'  : '⚠ Brak konfiguracji'}</div>` +
    `<div class="import-stat same">${hasArchive ? '✓ Archiwum (' + data.archive.length + ' lat)' : '— Brak archiwum'}</div>` +
    structWarning;

  document.getElementById('importModeOverwrite').checked = false;
  document.getElementById('importModeMerge').checked     = true;
  modal.classList.add('show');
  { const _fi = modal.querySelector('button:not([disabled]),input:not([disabled])'); if (_fi) setTimeout(() => _fi.focus({ preventScroll: true }), 50); }
}

export function closeImportModal() {
  document.getElementById('importModal')?.classList.remove('show');
  _importData = null;
}

export function confirmImport() {
  if (!_importData) return;
  const merge    = document.getElementById('importModeMerge').checked;
  const impSched = _importData.schedData || {};

  if (merge) {
    // ── 1. Scal wpisy planu (tylko puste komórki) ──────────────
    Object.keys(impSched).forEach(yk2 => {
      if (!schedData[yk2]) schedData[yk2] = {};
      Object.keys(impSched[yk2]).forEach(di => {
        if (!schedData[yk2][di]) schedData[yk2][di] = {};
        Object.keys(impSched[yk2][di]).forEach(hr => {
          if (!schedData[yk2][di][hr]) schedData[yk2][di][hr] = {};
          Object.keys(impSched[yk2][di][hr]).forEach(key => {
            const ic = impSched[yk2][di][hr][key];
            const cc = schedData[yk2][di][hr][key];
            const iF = !!(ic?.teacherAbbr || (ic?.classes||[]).length || ic?.className);
            const cF = !!(cc?.teacherAbbr || (cc?.classes||[]).length || cc?.className);
            if (iF && !cF) schedData[yk2][di][hr][key] = ic;
          });
        });
      });
    });

    // ── 2. Scal konfigurację szkoły (appState) ─────────────────
    // NAPRAWA: poprzednio scalano tylko gdy !appState — cały importowany
    // obiekt był ignorowany gdy lokalny już istniał. Teraz dołączamy
    // brakujące wpisy (nauczyciele, klasy, sale itd.) do istniejącego.
    _mergeAppState(appState, _importData.appState);
    normalizeAppState(appState);
    migrateClassNames(appState);

    // ── 3. Scal daty ważności (validFromDates) ─────────────────
    // NAPRAWA: Object.assign był płytki — nadpisywał cały obiekt roku
    // zamiast scalać poszczególne dni. _mergeValidFromDates scala głęboko.
    if (_importData.validFromDates) {
      _mergeValidFromDates(validFromDates, _importData.validFromDates);
    }

    // ── 4. Scal archiwum lat szkolnych ─────────────────────────
    // NAPRAWA: poprzednio importowano tylko gdy lokalne było puste (length===0).
    // Teraz scala obie listy wg yearKey — lokalne wpisy mają pierwszeństwo.
    setArchive(_mergeArchives(archive, _importData.archive));

    persistAll();
    closeImportModal();
    if (appState) _mountApp();
    _notify('✓ Scalono — dodano brakujące wpisy i konfigurację');

  } else {
    // Tryb nadpisania — bez zmian w logice
    setSchedData(impSched);
    if (_importData.validFromDates) setValidFromDates(_importData.validFromDates);
    if (_importData.appState)       setAppState(_importData.appState);
    normalizeAppState(appState);
    if (_importData.archive)        setArchive(_importData.archive);
    migrateClassNames(appState);
    persistAll();
    closeImportModal();
    if (appState) _mountApp();
    _notify('✓ Plan zastąpiony danymi z pliku');
  }
}

// Flaga ustawiana przez schedule.js przy starcie wewnętrznego DnD komórki
// — niezawodna metoda rozróżnienia przeciągania komórki od pliku z dysku
// na wszystkich przeglądarkach (w tym Safari/Chrome na tabletach)
let _internalDndActive = false;
export function setInternalDndActive(val) { _internalDndActive = val; }

export function initImportDragDrop() {
  let _dragOver = false;

  document.body.addEventListener('dragover', e => {
    if (_internalDndActive) return; // wewnętrzny DnD komórki — ignoruj
    // Sprawdź czy to plik z zewnątrz (dodatkowe zabezpieczenie)
    const types = Array.from(e.dataTransfer?.types || []);
    if (!types.includes('Files')) return;
    e.preventDefault();
    if (!_dragOver) {
      _dragOver = true;
      document.getElementById('dropOverlay')?.classList.add('show');
    }
  });
  document.body.addEventListener('dragleave', e => {
    if (!_dragOver) return;
    if (e.relatedTarget === null || !document.body.contains(e.relatedTarget)) {
      _dragOver = false;
      document.getElementById('dropOverlay')?.classList.remove('show');
    }
  });
  document.body.addEventListener('drop', e => {
    if (_internalDndActive) return;
    const types = Array.from(e.dataTransfer?.types || []);
    if (!types.includes('Files')) return;
    e.preventDefault();
    _dragOver = false;
    document.getElementById('dropOverlay')?.classList.remove('show');
    const file = e.dataTransfer.files[0];
    if (file) handleImportFile(file);
  });
}


// ================================================================
//  BEZPIECZNY ZAPIS localStorage
// ================================================================
export function storageUsageBytes() {
  let total = 0;
  try {
    for (const key of Object.keys(localStorage)) {
      total += (localStorage.getItem(key) || '').length * 2;
    }
  } catch(e) {}
  return total;
}

export function formatBytes(bytes) {
  if (bytes < 1024)         return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch(e) {
    if (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        (e.code && (e.code === 22 || e.code === 1014))) return false;
    throw e;
  }
}

let _pendingSaveValues = {};

function _showStorageFullModal() {
  let modal = document.getElementById('storageFullModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'storageFullModal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '9999';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:420px">
        <div class="modal-header">
          <span style="color:var(--red);font-size:1.1rem">⚠ Pamięć przeglądarki pełna</span>
        </div>
        <div class="modal-body" style="font-size:0.85rem;line-height:1.6">
          <p>Przeglądarka nie może zapisać danych — <code>localStorage</code> jest przepełniony.</p>
          <p style="margin-top:10px">Użycie teraz: <strong id="storageUsageInfo">—</strong></p>
          <p style="margin-top:10px;color:var(--yellow)"><strong>Co zrobić?</strong></p>
          <ol style="padding-left:1.2em;margin-top:6px;display:flex;flex-direction:column;gap:6px">
            <li>Kliknij <strong>Eksportuj JSON</strong> — zapisz kopię na dysku.</li>
            <li>Oczyść dane innych stron w ustawieniach przeglądarki.</li>
            <li>Możesz wczytać plan z pliku w dowolnym momencie.</li>
          </ol>
        </div>
        <div class="modal-footer" style="gap:8px">
          <button class="btn btn-green"
            onclick="exportJSON();document.getElementById('storageFullModal').classList.remove('show')">
            💾 Eksportuj JSON
          </button>
          <button class="btn btn-ghost"
            onclick="document.getElementById('storageFullModal').classList.remove('show')">
            Zamknij
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
  }
  const usageEl = document.getElementById('storageUsageInfo');
  if (usageEl) usageEl.textContent = formatBytes(storageUsageBytes()) + ' / ~5 MB';
  modal.classList.add('show');
  { const _fi = modal.querySelector('button:not([disabled]),input:not([disabled])'); if (_fi) setTimeout(() => _fi.focus({ preventScroll: true }), 50); }
}

function _handleQuotaExceeded(failedKey) {
  console.warn('[PlanLekcji] QuotaExceededError:', failedKey,
    '| Użycie:', formatBytes(storageUsageBytes()));
  if (localStorage.getItem(DRAFT_KEY)) {
    localStorage.removeItem(DRAFT_KEY);
    _notify('⚠ Brak miejsca — usunięto szkic kreatora', true);
    if (safeSetItem(failedKey, _pendingSaveValues[failedKey] || '')) return true;
  }
  if (archive && archive.length > 0) {
    localStorage.removeItem('sp_archive');
    setArchive([]);
    _notify('⚠ Brak miejsca — usunięto archiwum lat szkolnych', true);
    if (safeSetItem(failedKey, _pendingSaveValues[failedKey] || '')) return true;
  }
  _showStorageFullModal();
  return false;
}

export function persistAll() {
  if (_isDemoMode()) return;
  const schedJson   = JSON.stringify(schedData);
  const vfdJson     = JSON.stringify(validFromDates);
  const archiveJson = JSON.stringify(archive);
  const stateJson   = appState ? JSON.stringify(appState) : null;

  _pendingSaveValues = {
    'sp_sched':   schedJson,
    'sp_vfdates': vfdJson,
    'sp_archive': archiveJson,
    ...(stateJson ? { 'sp_active': stateJson } : {}),
  };
  const keys = [
    ['sp_sched',   schedJson],
    ['sp_vfdates', vfdJson],
    ['sp_archive', archiveJson],
    ...(stateJson ? [['sp_active', stateJson]] : []),
  ];
  for (const [key, value] of keys) {
    if (!safeSetItem(key, value)) {
      const recovered = _handleQuotaExceeded(key);
      if (recovered) for (const [k2, v2] of keys) safeSetItem(k2, v2);
      _pendingSaveValues = {};
      return;
    }
  }
  if (!stateJson) localStorage.removeItem('sp_active');
  _pendingSaveValues = {};
}

export function saveData() {
  if (!appState) return;
  if (_isDemoMode()) { _notify('⚠ Tryb demo — dane nie są zapisywane', true); return; }
  if (!validFromDates[appState.yearKey]) validFromDates[appState.yearKey] = {};
  validFromDates[appState.yearKey][currentDay] =
    document.getElementById('validFrom')?.value || '';
  persistAll();
  _notify('✓ Zapisano');
  _sbSet('Dane zapisane lokalnie');
}


// ================================================================
//  DANE DEMONSTRACYJNE
// ================================================================
export function loadDemoData() {
  const buildings = [
    { name: 'Budynek Główny', address: 'ul. Szkolna 1' },
    { name: 'Skrzydło B',     address: 'ul. Szkolna 1' },
  ];
  const floors = [
    { name: 'Parter',   color: '#f59e0b', buildingIdx: 0, segments: [
      { name: 'Skrzydło A', rooms: [{num:'1',sub:''},{num:'2',sub:''},{num:'3',sub:''}] },
      { name: 'Skrzydło B', rooms: [{num:'4',sub:''},{num:'5',sub:''}] },
    ]},
    { name: 'Piętro 1', color: '#3b82f6', buildingIdx: 0, segments: [
      { name: 'Lewe',  rooms: [{num:'11',sub:''},{num:'12',sub:''}] },
      { name: 'Prawe', rooms: [{num:'13',sub:''},{num:'14',sub:''}] },
    ]},
    { name: 'Parter',   color: '#10b981', buildingIdx: 1, segments: [
      { name: 'Główny', rooms: [{num:'B1',sub:''},{num:'B2',sub:''},{num:'B3',sub:''}] },
    ]},
  ];
  const classes = [
    {name:'1A',abbr:'1A',group:'cała klasa'},{name:'1B',abbr:'1B',group:'cała klasa'},
    {name:'2A',abbr:'2A',group:'cała klasa'},{name:'2B',abbr:'2B',group:'cała klasa'},
    {name:'3A',abbr:'3A',group:'cała klasa'},
    {name:'1A',abbr:'1A gr.1',group:'gr. 1'},{name:'1A',abbr:'1A gr.2',group:'gr. 2'},
    {name:'2A',abbr:'2A gr.1',group:'gr. 1'},
  ];
  const teachers = [
    {first:'Anna',     last:'Kowalska',    abbr:'AKOW'},
    {first:'Piotr',    last:'Nowak',       abbr:'PNOW'},
    {first:'Maria',    last:'Wiśniewska',  abbr:'MWIS'},
    {first:'Tomasz',   last:'Zając',       abbr:'TZAJ'},
    {first:'Katarzyna',last:'Lewandowska', abbr:'KLEW'},
    {first:'Marek',    last:'Wójcik',      abbr:'MWOJ'},
  ];
  const hours   = ['1','2','3','4','5','6','7','8'];
  const yearKey = 'y_demo_2024_2025';

  function demoColKey(fi, si, ri) {
    const room = floors[fi].segments[si].rooms[ri];
    return `f${fi}_s${si}_${room.num || 'r' + ri}`;
  }
  const sched = {};
  DAYS_DEFAULT.forEach((_, di) => {
    sched[di] = {};
    hours.forEach(h => { sched[di][h] = {}; });
  });
  [
    [0,'1',demoColKey(0,0,0),{teacherAbbr:'AKOW',classes:['1A'],  className:'1A',  subject:'Matematyka',note:''}],
    [0,'2',demoColKey(0,0,1),{teacherAbbr:'PNOW',classes:['2A'],  className:'2A',  subject:'Fizyka',    note:''}],
    [0,'3',demoColKey(0,1,0),{teacherAbbr:'MWIS',classes:['1B'],  className:'1B',  subject:'Biologia',  note:''}],
    [0,'1',demoColKey(1,0,0),{teacherAbbr:'TZAJ',classes:['3A'],  className:'3A',  subject:'Historia',  note:''}],
    [0,'2',demoColKey(1,1,0),{teacherAbbr:'KLEW',classes:['2B'],  className:'2B',  subject:'Chemia',    note:''}],
    [0,'2',demoColKey(0,0,2),{teacherAbbr:'AKOW',classes:['2A'],  className:'2A',  subject:'Matematyka',note:''}],
    [0,'1',demoColKey(2,0,0),{teacherAbbr:'PNOW',classes:['1B'],  className:'1B',  subject:'Informatyka',note:'pracownia'}],
    [0,'2',demoColKey(2,0,1),{teacherAbbr:'MWIS',classes:['2B'],  className:'2B',  subject:'Biologia',  note:''}],
    [1,'1',demoColKey(0,0,0),{teacherAbbr:'PNOW',classes:['1A'],  className:'1A',  subject:'Fizyka',    note:''}],
    [1,'3',demoColKey(0,1,1),{teacherAbbr:'AKOW',classes:['3A'],  className:'3A',  subject:'Matematyka',note:''}],
    [1,'2',demoColKey(1,0,1),{teacherAbbr:'TZAJ',classes:['2A'],  className:'2A',  subject:'Historia',  note:''}],
    // Kolizja demonstracyjna
    [0,'4',demoColKey(0,0,0),{teacherAbbr:'AKOW',classes:['1B'],     className:'1B',     subject:'Algebra',note:''}],
    [0,'4',demoColKey(0,0,1),{teacherAbbr:'AKOW',classes:['2A gr.1'],className:'2A gr.1',subject:'Algebra',note:''}],
  ].forEach(([di, h, key, entry]) => {
    if (sched[di]?.[h] !== undefined) sched[di][h][key] = entry;
  });

  const homerooms = {};
  homerooms[demoColKey(0,0,0)] = { className:'1A', teacherAbbr:'AKOW' };
  homerooms[demoColKey(0,0,1)] = { className:'2A', teacherAbbr:'PNOW' };
  homerooms[demoColKey(0,1,0)] = { className:'1B', teacherAbbr:'MWIS' };

  setAppState({
    yearKey, yearLabel: '2024/2025 (DEMO)',
    hours, floors, buildings, classes, teachers,
    assignments: {}, days: DAYS_DEFAULT,
    school: { name: 'Szkoła Podstawowa nr 1 (DEMO)', short: 'SP1',
              phone: '12 345 67 89', web: 'www.sp1.demo.pl' },
    homerooms,
  });
  setSchedData({ [yearKey]: sched });
  setValidFromDates({});
}

// ================================================================
//  EKSPORT CSV
// ================================================================

function csvCell(val) {
  const s = String(val == null ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

function downloadCSV(filename, rows) {
  const bom  = '\uFEFF';
  const text = bom + rows.join('\r\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvFilename(suffix) {
  const date   = new Date().toISOString().slice(0, 10);
  const school = (appState?.school?.short || appState?.school?.name || 'SalePlan').replace(/\s+/g, '_');
  const year   = (appState?.yearLabel || appState?.yearKey || '').replace(/[\/\\]/g, '-');
  return `${school}_${year}_${suffix}_${date}.csv`;
}

export function exportCSVDay() {
  if (!appState) return;
  const cols    = flattenColumns(appState.floors);
  const hours   = appState.hours;
  const dayData = schedData[appState.yearKey]?.[currentDay] || {};
  const dayName = appState.days[currentDay] || String(currentDay);
  const rows = [];
  rows.push(csvRow(['Plan dzienny', dayName, appState.yearLabel || '']));
  rows.push(csvRow(['Godz.', 'Czas', ...cols.map(col => col.room.num || col.room.sub || '?')]));
  hours.forEach(h => {
    const ts = appState.timeslots?.find(t => t.label === String(h)) || null;
    const timeStr = (ts && ts.start && ts.end) ? `${ts.start}\u2013${ts.end}` : '';
    const cells = [String(h), timeStr];
    cols.forEach(col => {
      const entry = dayData[h]?.[colKey(col)] || {};
      const cls   = (entry.classes || []).length ? entry.classes.join('+') : (entry.className || '');
      cells.push([cls, entry.subject || '', entry.teacherAbbr || '', entry.note || ''].filter(Boolean).join(' | '));
    });
    rows.push(csvRow(cells));
  });
  downloadCSV(csvFilename(dayName), rows);
  _notify('✓ Wyeksportowano plan dnia do CSV');
  closeCSVModal();
}

export function exportCSVWeekBySala() {
  if (!appState) return;
  const cols  = flattenColumns(appState.floors);
  const hours = appState.hours;
  const days  = appState.days;
  const yk    = appState.yearKey;
  const rows  = [];
  rows.push(csvRow(['Plan tygodniowy \u2014 zestawienie per sala', appState.yearLabel || '']));
  rows.push([]);
  cols.forEach(col => {
    const key       = colKey(col);
    const roomLabel = col.room.num ? `Sala ${col.room.num}` : (col.room.sub || '?');
    rows.push(csvRow([roomLabel]));
    rows.push(csvRow(['Godz.', 'Czas', ...days]));
    hours.forEach(h => {
      const ts      = appState.timeslots?.find(t => t.label === String(h)) || null;
      const timeStr = (ts && ts.start && ts.end) ? `${ts.start}\u2013${ts.end}` : '';
      const cells   = [String(h), timeStr];
      days.forEach((_, di) => {
        const entry = schedData[yk]?.[di]?.[h]?.[key] || {};
        const cls   = (entry.classes || []).length ? entry.classes.join('+') : (entry.className || '');
        cells.push([cls, entry.subject || '', entry.teacherAbbr || '', entry.note || ''].filter(Boolean).join(' | '));
      });
      rows.push(csvRow(cells));
    });
    rows.push([]);
  });
  downloadCSV(csvFilename('tygodniowy_sale'), rows);
  _notify('✓ Wyeksportowano plan tygodniowy (sale) do CSV');
  closeCSVModal();
}

export function exportCSVFlat() {
  if (!appState) return;
  const cols  = flattenColumns(appState.floors);
  const hours = appState.hours;
  const days  = appState.days;
  const yk    = appState.yearKey;
  const rows  = [];
  rows.push(csvRow(['Rok szkolny','Dzie\u0144','Nr godz.','Czas','Pi\u0119tro','Segment','Sala',
    'Klasy','Przedmiot','Nauczyciel (skr\u00f3t)','Nauczyciel (imi\u0119 nazwisko)','Uwaga']));
  days.forEach((dayName, di) => {
    hours.forEach(h => {
      const ts      = appState.timeslots?.find(t => t.label === String(h)) || null;
      const timeStr = (ts && ts.start && ts.end) ? `${ts.start}\u2013${ts.end}` : '';
      cols.forEach(col => {
        const entry  = schedData[yk]?.[di]?.[h]?.[colKey(col)] || {};
        const filled = entry.teacherAbbr || entry.subject || entry.className || (entry.classes||[]).length;
        if (!filled) return;
        const cls      = (entry.classes || []).length ? entry.classes.join('+') : (entry.className || '');
        const teacher  = entry.teacherAbbr ? (appState.teachers||[]).find(t => t.abbr === entry.teacherAbbr) : null;
        const fullName = teacher ? `${teacher.last || ''} ${teacher.first || ''}`.trim() : '';
        rows.push(csvRow([
          appState.yearLabel || yk, dayName, String(h), timeStr,
          col.floor?.name || '', col.seg?.name || '', col.room.num || col.room.sub || '',
          cls, entry.subject || '', entry.teacherAbbr || '', fullName, entry.note || '',
        ]));
      });
    });
  });
  downloadCSV(csvFilename('zestawienie'), rows);
  _notify(`\u2713 Wyeksportowano ${rows.length - 1} wpis\u00f3w do CSV`);
  closeCSVModal();
}

export function openCSVModal() {
  if (!appState) { _notify('\u26a0 Brak aktywnego planu', true); return; }
  let modal = document.getElementById('csvExportModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'csvExportModal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '9998';
    modal.innerHTML = `
      <div class="modal csv-modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">\ud83d\udcca Eksport do CSV</div>
            <div class="modal-sub">Wybierz format eksportu</div>
          </div>
          <button class="modal-close" onclick="closeCSVModal()">\u2715</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:10px">
          <button class="btn csv-export-btn" onclick="exportCSVDay()">
            <span class="csv-btn-icon">\ud83d\udcc5</span>
            <span class="csv-btn-text"><strong>Plan dzienny</strong><span>Aktywny dzie\u0144 \u2014 kolumny: sale, wiersze: godziny</span></span>
          </button>
          <button class="btn csv-export-btn" onclick="exportCSVWeekBySala()">
            <span class="csv-btn-icon">\ud83d\uddd3</span>
            <span class="csv-btn-text"><strong>Plan tygodniowy</strong><span>Wszystkie sale \u00d7 wszystkie dni tygodnia</span></span>
          </button>
          <button class="btn csv-export-btn" onclick="exportCSVFlat()">
            <span class="csv-btn-icon">\ud83d\udccb</span>
            <span class="csv-btn-text"><strong>Zestawienie wpis\u00f3w</strong><span>Ka\u017cdy wpis jako wiersz \u2014 do analizy w Excelu / Google Sheets</span></span>
          </button>
          <div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px;line-height:1.5">
            Pliki CSV maj\u0105 kodowanie UTF-8 z BOM \u2014 Excel otwiera je poprawnie bez konwersji.
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeCSVModal(); });
  }
  modal.classList.add('show');
  { const _fi = modal.querySelector('button:not([disabled]),input:not([disabled])'); if (_fi) setTimeout(() => _fi.focus({ preventScroll: true }), 50); }
}

export function closeCSVModal() {
  document.getElementById('csvExportModal')?.classList.remove('show');
}
