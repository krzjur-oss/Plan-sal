// ================================================================
//  STORAGE.JS — ładowanie danych, strona powitalna, szkic kreatora,
//               autoskrót klasy
//  Zależy od: state.js
//  Eksportuje: loadAll, showWelcomeScreen, hideWelcomeScreen,
//              welcome*, wlImport*, draftResume, draftDiscard,
//              wizardSaveDraft, wizardClearDraft, wizardCheckDraft,
//              wizardCollectDraft, startWizardAutosave,
//              stopWizardAutosave, openEditWizard, exitDemo,
//              autoClassAbbr, CLASS_ABBR_IGNORE, DRAFT_KEY
// ================================================================

import {
  DAYS_DEFAULT, TOTAL_STEPS,
  appState,      setAppState,
  schedData,     setSchedData,
  validFromDates,setValidFromDates,
  archive,       setArchive,
  wBuildings, setWBuildings,
  wFloors,    setWFloors,
  wClasses,   setWClasses,
  wTeachers,  setWTeachers,
  wSubjects,  setWSubjects,
  wTimeslots, setWTimeslots,
  wAssignments, setWAssignments,
  wStep,      setWStep,
} from './state.js';

import {
  normalizeAppState, migrateClassNames, migrateImportData,
  persistAll, openImportModal, confirmImport, loadDemoData,
} from './import-export.js';

import { esc, notify, sbSet } from './helpers.js';

// ── Wrappery dla funkcji z modułów wyżej w łańcuchu (unikamy cykli) ──
// mountApp, openWizardNewYear, renderX itp. są w schedule/wizard/ui
// które importują storage.js — nie możemy ich tu importować (cykl)
// Używamy window.* bo app.js eksponuje je na window
function _mountApp()             { window.mountApp?.(); }
function _openWizardNewYear()    { window.openWizardNewYear?.(); }
function _openImportModal(d)     { window.openImportModal?.(d); }
function _confirmImport()        { window.confirmImport?.(); }
function _closeSettingsPanel()   { window.closeSettingsPanel?.(); }
function _renderBuildingList()   { window.renderBuildingList?.(); }
function _renderFloorList()      { window.renderFloorList?.(); }
function _renderClassGrid()      { window.renderClassGrid?.(); }
function _renderTeacherList()    { window.renderTeacherList?.(); }
function _renderSubjectList()    { window.renderSubjectList?.(); }
function _renderAssignmentsStep(){ window.renderAssignmentsStep?.(); }
function _updateWizardStep()     { window.updateWizardStep?.(); }
function _wpUpdate(s)            { window.wpUpdate?.(s); }
function _initTimeslotEditor()   { window.initTimeslotEditor?.(); }
function _notify(msg, err)       { notify(msg, err); }
function _esc(s)                 { return esc(s); }
function _normalizeAppState(s)   { return normalizeAppState(s); }
function _migrateClassNames(s)   { migrateClassNames(s); }
function _migrateImportData(d)   { return migrateImportData(d); }
function _persistAll()           { persistAll(); }
function _loadDemoData()         { loadDemoData(); }
function _buildTimeslotsFromHours(h,t){ if (typeof buildTimeslotsFromHours === 'function') return buildTimeslotsFromHours(h,t); return []; }
function _syncBuildingsFromDOM(){ if (typeof syncBuildingsFromDOM === 'function') syncBuildingsFromDOM(); }
function _syncTeachersFromDOM() { if (typeof syncTeachersFromDOM  === 'function') syncTeachersFromDOM(); }
function _getClassesFromDOM()   { if (typeof getClassesFromDOM    === 'function') return getClassesFromDOM(); return []; }


// ================================================================
//  ŁADOWANIE DANYCH Z localStorage
// ================================================================
export function loadAll() {
  let sd = {}, vfd = {}, arc = [], as = null;

  try { sd  = JSON.parse(localStorage.getItem('sp_sched')   || '{}'); } catch(e) { sd = {}; }
  try { vfd = JSON.parse(localStorage.getItem('sp_vfdates') || '{}'); } catch(e) { vfd = {}; }
  try { arc = JSON.parse(localStorage.getItem('sp_archive') || '[]'); } catch(e) { arc = []; }
  try { as  = JSON.parse(localStorage.getItem('sp_active')  || 'null'); } catch(e) { as = null; }

  setSchedData(sd);
  setValidFromDates(vfd);
  setArchive(arc);
  setAppState(as);

  _normalizeAppState(appState);
  if (appState) _migrateClassNames(appState);
}


// ================================================================
//  STRONA POWITALNA
// ================================================================
let _demoMode = false;

export function isDemoMode() { return _demoMode; }

export function showWelcomeScreen() {
  const cardCopy = document.getElementById('wlCardCopy');
  const descCopy = document.getElementById('wlCardCopyDesc');
  if (cardCopy) {
    if (appState) {
      cardCopy.classList.remove('disabled');
      cardCopy.style.cursor = 'pointer';
      if (descCopy) descCopy.textContent = 'Skopiuj konfigurację szkoły, sale, nauczycieli i klasy z bieżącego roku.';
    } else {
      cardCopy.classList.add('disabled');
      cardCopy.style.cursor = 'not-allowed';
      if (descCopy) descCopy.textContent = 'Niedostępne — najpierw utwórz plan lub wczytaj go z pliku.';
    }
  }
  // Pokaż przycisk „Aktualny plan" tylko jeśli plan istnieje
  const planBtn = document.getElementById('wlCurrentPlanBtn');
  if (planBtn) planBtn.style.display = appState ? '' : 'none';

  _closeSettingsPanel();
  document.getElementById('welcomeScreen').classList.add('show');
}

export function hideWelcomeScreen() {
  document.getElementById('welcomeScreen').classList.remove('show');
  if (appState) _mountApp();
}

// ── Nowy plan od zera ──
export function welcomeStartNew() {
  _demoMode = false;
  hideWelcomeScreen();
  _openWizardNewYear();
}

// ── Nowy rok na bazie istniejącego ──
export function welcomeCopyYear() {
  if (!appState) { _notify('⚠ Brak planu do skopiowania — najpierw utwórz nowy plan', true); return; }
  _demoMode = false;
  hideWelcomeScreen();
  _openWizardNewYear();
}

// ── Import z pliku — kliknięcie karty ──
export function welcomeImportClick() {
  document.getElementById('wlFileInput').click();
}

// Dane wczytanego pliku — czekają na wybór trybu
let _wlPendingImport = null;

export function welcomeHandleFile(file) {
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
      data = _migrateImportData(data);
      _wlPendingImport = data;

      const fnEl = document.getElementById('wlIcFileName');
      if (fnEl) fnEl.textContent = '📄 ' + file.name;

      const mergeBtn = document.getElementById('wlIcMergeBtn');
      const freshBtn = document.getElementById('wlIcFreshBtn');
      if (mergeBtn) mergeBtn.classList.toggle('disabled', !appState);
      if (freshBtn) freshBtn.style.display = appState ? 'none' : 'block';

      document.getElementById('wlImportPanel').classList.add('show');
    } catch(ex) {
      _notify('⚠ Błąd odczytu pliku: ' + ex.message, true);
    }
  };
  reader.onerror = () => _notify('⚠ Błąd odczytu pliku', true);
  reader.readAsText(file);
}

export function wlImportCancel() {
  _wlPendingImport = null;
  document.getElementById('wlImportPanel').classList.remove('show');
}

export function wlImportConfirm(mode) {
  const data = _wlPendingImport;
  if (!data) return;
  _demoMode = false;
  document.getElementById('wlImportPanel').classList.remove('show');

  if (mode === 'fresh' || (mode === 'replace' && !appState)) {
    // Wczytaj jako świeży plan
    setAppState(data.appState || null);
    setSchedData(data.schedData || {});
    setValidFromDates(data.validFromDates || {});
    setArchive(data.archive || []);
    _normalizeAppState(appState);
    _migrateClassNames(appState);
    _persistAll();
    hideWelcomeScreen();

    if (appState) {
      const yk = appState.yearKey;
      if (!schedData[yk]) schedData[yk] = {};
      (appState.days || DAYS_DEFAULT).forEach((_, i) => {
        if (!schedData[yk][i]) schedData[yk][i] = {};
        (appState.hours || []).forEach(h => { if (!schedData[yk][i][h]) schedData[yk][i][h] = {}; });
      });
      _mountApp();
    } else {
      showWelcomeScreen();
    }
    _notify('✓ Plan wczytany z pliku');

  } else if (mode === 'replace' && appState) {
    // Zastąp — użyj confirmImport z trybem overwrite
    hideWelcomeScreen();
    if (typeof _importData !== 'undefined') window._importData = data;
    document.getElementById('importModeOverwrite').checked = true;
    document.getElementById('importModeMerge').checked     = false;
    _confirmImport();

  } else if (mode === 'merge' && appState) {
    // Scal — otwórz modal podglądu diff
    hideWelcomeScreen();
    _openImportModal(data);
  }
  _wlPendingImport = null;
}

// ── Drag & drop na stronę powitalną ──
(function() {
  let _wlDrag = false;
  document.addEventListener('dragover', e => {
    const ws = document.getElementById('welcomeScreen');
    if (!ws || !ws.classList.contains('show')) return;
    e.preventDefault();
    if (!_wlDrag) { _wlDrag = true; ws.style.background = '#dbeafe'; }
  });
  document.addEventListener('dragleave', e => {
    if (e.relatedTarget === null) {
      _wlDrag = false;
      const ws = document.getElementById('welcomeScreen');
      if (ws) ws.style.background = '';
    }
  });
  document.addEventListener('drop', e => {
    _wlDrag = false;
    const ws = document.getElementById('welcomeScreen');
    if (ws && ws.classList.contains('show')) {
      e.preventDefault();
      ws.style.background = '';
      const file = e.dataTransfer.files[0];
      if (file) welcomeHandleFile(file);
    }
  });
})();

// ── DEMO ──
export function welcomeDemo() {
  _demoMode = true;
  hideWelcomeScreen();
  _loadDemoData();
  const yk = appState.yearKey;
  (appState.days || DAYS_DEFAULT).forEach((_, i) => {
    if (!schedData[yk][i]) schedData[yk][i] = {};
    (appState.hours || []).forEach(h => { if (!schedData[yk][i][h]) schedData[yk][i][h] = {}; });
  });
  _mountApp();
  setTimeout(() => {
    _notify('🎬 Tryb demo — dane nie są zapisywane');
    const bar = document.getElementById('demoBanner');
    if (bar) bar.style.display = 'flex';
  }, 400);
}

export function exitDemo() {
  _demoMode = false;
  const bar = document.getElementById('demoBanner');
  if (bar) bar.style.display = 'none';
  setAppState(null);
  setSchedData({});
  loadAll();
  if (!appState) {
    document.getElementById('appOverlay').style.display = 'none';
    showWelcomeScreen();
  } else {
    const yk = appState.yearKey;
    if (!schedData[yk]) schedData[yk] = {};
    (appState.days || DAYS_DEFAULT).forEach((_, i) => {
      if (!schedData[yk][i]) schedData[yk][i] = {};
      (appState.hours || []).forEach(h => { if (!schedData[yk][i][h]) schedData[yk][i][h] = {}; });
    });
    _mountApp();
  }
}


// ================================================================
//  KREATOR — TRYB EDYCJI BIEŻĄCEGO ROKU
// ================================================================
let _wizardEditMode = false;

export function isWizardEditMode() { return _wizardEditMode; }
export function setWizardEditMode(v) { _wizardEditMode = v; }

export function openEditWizard() {
  if (!appState) return;
  _wizardEditMode = true;
  setWStep(0);
  setWAssignments(appState.assignments ? structuredClone(appState.assignments) : {});
  setWBuildings(structuredClone(appState.buildings || [{ name: '', address: '' }]));
  setWFloors(structuredClone(appState.floors       || []));
  setWClasses(structuredClone(appState.classes     || []));
  setWTeachers(structuredClone(appState.teachers   || []));
  setWSubjects(structuredClone(appState.subjects   || []));
  setWTimeslots(structuredClone(
    appState.timeslots?.length
      ? appState.timeslots
      : _buildTimeslotsFromHours(appState.hours || [], [])
  ));

  const fields = {
    wSchoolName:  appState.school?.name  || '',
    wSchoolShort: appState.school?.short || '',
    wSchoolPhone: appState.school?.phone || '',
    wSchoolWeb:   appState.school?.web   || '',
    wYear:        appState.yearLabel     || '',
    wHours:       (appState.hours || []).join(','),
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  const titleYear = document.getElementById('wTitleYear');
  if (titleYear) titleYear.textContent = appState.yearLabel || '';

  _renderBuildingList();
  _renderFloorList();
  _renderClassGrid();
  _renderTeacherList();
  _updateWizardStep();
  _wpUpdate(0);

  const titleEl = document.getElementById('wizardTitle');
  if (titleEl) titleEl.innerHTML =
    '✏️ Edycja roku szkolnego<br><span id="wTitleYear">' + _esc(appState.yearLabel || '') + '</span>';
  const subEl = document.getElementById('wizardSubtitle');
  if (subEl) subEl.textContent =
    'Zmień sale, klasy, nauczycieli lub godziny lekcyjne. Istniejący plan zostanie zachowany.';

  _closeSettingsPanel();
  document.getElementById('wizardOverlay').classList.add('show');
  startWizardAutosave();
}


// ================================================================
//  KREATOR — AUTOSAVE SZKICU
// ================================================================
export const DRAFT_KEY = 'sp_wiz_draft';
let _draftTimer       = null;
let _autosaveInterval = null;

export function wizardCollectDraft() {
  try { _syncBuildingsFromDOM(); } catch(e) {}
  try { _syncTeachersFromDOM();  } catch(e) {}
  try { setWClasses(_getClassesFromDOM()); } catch(e) {}

  return {
    savedAt:     new Date().toISOString(),
    step:        wStep,
    school: {
      name:  (document.getElementById('wSchoolName')?.value  || '').trim(),
      short: (document.getElementById('wSchoolShort')?.value || '').trim(),
      phone: (document.getElementById('wSchoolPhone')?.value || '').trim(),
      web:   (document.getElementById('wSchoolWeb')?.value   || '').trim(),
    },
    year:        (document.getElementById('wYear')?.value  || '').trim(),
    hours:       (document.getElementById('wHours')?.value || '').trim(),
    buildings:   structuredClone(wBuildings   || []),
    floors:      structuredClone(wFloors      || []),
    classes:     structuredClone(wClasses     || []),
    teachers:    structuredClone(wTeachers    || []),
    assignments: structuredClone(wAssignments || {}),
    subjects:    structuredClone(wSubjects    || []),
    timeslots:   structuredClone(wTimeslots   || []),
  };
}

export function wizardSaveDraft() {
  const statusEl = document.getElementById('wizardDraftStatus');
  const dotEl    = statusEl?.querySelector('.ds-dot');
  const textEl   = document.getElementById('dsDraftText');

  if (dotEl)    dotEl.classList.add('saving');
  if (statusEl) statusEl.classList.add('visible');
  if (textEl)   textEl.textContent = 'Zapisuję szkic…';

  try {
    const draft = wizardCollectDraft();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    const t  = new Date(draft.savedAt);
    const ts = t.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (dotEl)  dotEl.classList.remove('saving');
    if (textEl) textEl.textContent = `Szkic zapisany ${ts}`;

    clearTimeout(_draftTimer);
    _draftTimer = setTimeout(() => {
      if (statusEl) statusEl.classList.remove('visible');
    }, 4000);
  } catch(e) {
    if (dotEl) dotEl.classList.remove('saving');
    const isQuota = e.name === 'QuotaExceededError' ||
                    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                    (e.code && (e.code === 22 || e.code === 1014));
    if (isQuota) {
      if (textEl) textEl.textContent = '⚠ Brak miejsca — szkic nie zapisany';
      _notify('⚠ Brak miejsca w przeglądarce — szkic kreatora nie został zapisany', true);
    } else {
      if (textEl) textEl.textContent = 'Błąd zapisu szkicu';
      console.warn('wizardSaveDraft error:', e);
    }
  }
}

export function wizardClearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  const statusEl = document.getElementById('wizardDraftStatus');
  if (statusEl) statusEl.classList.remove('visible');
}

export function wizardCheckDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (!draft || !draft.savedAt) return false;

    const t      = new Date(draft.savedAt);
    const ts     = t.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
    const step   = (draft.step || 0) + 1;
    const school = draft.school?.name || '(bez nazwy)';
    const year   = draft.year || '(bez roku)';
    const metaEl = document.getElementById('draftResumeMeta');
    if (metaEl) metaEl.innerHTML =
      `Ostatni zapis: <strong>${_esc(ts)}</strong><br>` +
      `Szkoła: <strong>${_esc(school)}</strong>, rok: <strong>${_esc(year)}</strong><br>` +
      `Zapisano na kroku <strong>${_esc(String(step))} z ${TOTAL_STEPS}</strong>` +
      ` — klucz: <code>sp_wiz_draft</code>`;

    document.getElementById('draftResumeModal').classList.add('show');
    return true;
  } catch(e) {
    localStorage.removeItem(DRAFT_KEY);
    return false;
  }
}

export function draftResume() {
  document.getElementById('draftResumeModal').classList.remove('show');
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (!draft) return;

    setWStep(draft.step || 0);
    setWBuildings(draft.buildings    || [{ name: '', address: '' }]);
    setWFloors(draft.floors          || []);
    setWClasses(draft.classes        || []);
    setWTeachers(draft.teachers      || []);
    setWSubjects(draft.subjects      || []);
    setWTimeslots(draft.timeslots    || []);
    setWAssignments(draft.assignments || {});

    const fieldMap = {
      wSchoolName:  draft.school?.name  || '',
      wSchoolShort: draft.school?.short || '',
      wSchoolPhone: draft.school?.phone || '',
      wSchoolWeb:   draft.school?.web   || '',
      wYear:        draft.year          || '',
      wHours:       draft.hours         || '',
    };
    Object.entries(fieldMap).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
    const ty = document.getElementById('wTitleYear');
    if (ty) ty.textContent = draft.year || '';

    _renderBuildingList();
    _renderFloorList();
    _renderClassGrid();
    _renderSubjectList();
    _renderTeacherList();
    if (wStep === 1 || wStep === 2) _initTimeslotEditor();
    if (wStep === 4) _renderSubjectList();
    if (wStep === 5) _renderTeacherList();   // BUG-A fix
    if (wStep === 6) _renderAssignmentsStep();
    _updateWizardStep();
    _wpUpdate(wStep);

    document.getElementById('wizardOverlay').classList.add('show');

    const t      = new Date(draft.savedAt);
    const ts     = t.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const statusEl = document.getElementById('wizardDraftStatus');
    const textEl   = document.getElementById('dsDraftText');
    if (textEl)   textEl.textContent = `Wznowiono (szkic z ${ts})`;
    if (statusEl) statusEl.classList.add('visible');

    _notify('↩ Wznowiono kreator z zapisanego szkicu');
  } catch(e) {
    _notify('⚠ Błąd wczytywania szkicu', true);
    wizardClearDraft();
  }
}

export function draftDiscard() {
  document.getElementById('draftResumeModal').classList.remove('show');
  wizardClearDraft();
  document.getElementById('wizardOverlay').classList.add('show');
}

export function startWizardAutosave() {
  stopWizardAutosave();
  _autosaveInterval = setInterval(() => {
    if (document.getElementById('wizardOverlay')?.classList.contains('show')) {
      wizardSaveDraft();
    }
  }, 30000);
}

export function stopWizardAutosave() {
  if (_autosaveInterval) { clearInterval(_autosaveInterval); _autosaveInterval = null; }
}


// ================================================================
//  AUTOMATYCZNY SKRÓT KLASY
// ================================================================
export const CLASS_ABBR_IGNORE = new Set([
  'i','w','z','na','dla','ze','lub','a','of','and','the','or','im'
]);

/**
 * Generuje skrót klasy z nazwy i grupy.
 * Przykład: ('1A', 'gr. 1') → '1A Gr1'
 *           ('2B', 'cała klasa') → '2B'
 */
export function autoClassAbbr(className, groupName) {
  const cls = (className  || '').trim().toUpperCase();
  const grp = (groupName  || '').trim().toLowerCase();

  if (!grp || grp === 'cała klasa' || grp === 'cala klasa') {
    return cls;
  }

  const words      = grp.split(/\s+/).filter(w => w.length > 0);
  const meaningful = words.filter(w => !CLASS_ABBR_IGNORE.has(w.toLowerCase()));

  let grpAbbr;
  if (meaningful.length === 0) {
    grpAbbr = words[0].slice(0, 3);
  } else if (meaningful.length === 1) {
    const w = meaningful[0];
    grpAbbr = w[0].toUpperCase() + w.slice(1, 3).toLowerCase();
  } else {
    grpAbbr = meaningful
      .map(w => w[0].toUpperCase() + (
        w.length > 1 && w[1] === w[1].toUpperCase() && w[1] !== w[1].toLowerCase()
          ? w[1] : ''
      ))
      .join('');
    if (grpAbbr.length < 2) grpAbbr = meaningful[0].slice(0, 3);
  }

  return (cls + ' ' + grpAbbr.toUpperCase()).slice(0, 12);
}
