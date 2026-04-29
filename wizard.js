// ================================================================
//  WIZARD.JS — nawigacja kroków i finalizacja kreatora
//
//  Zawiera: openWizardNewYear, wizardNext, wizardBack,
//           updateWizardStep, finishWizard,
//           renderAssignmentsStep, switchAssignDay,
//           renderAssignTable, setAssign, getAssignmentsFromDOM.
//
//  NIE duplikuje: openEditWizard, wizardSaveDraft/Clear/Check,
//                 draftResume/Discard, startWizardAutosave,
//                 autoClassAbbr — te są już w storage.js.
// ================================================================

import {
  DAYS_DEFAULT, TOTAL_STEPS,
  BUILDING_COLORS,
  appState,     setAppState,
  schedData,
  archive,      setArchive,
  setCurrentDay,
  wBuildings,   setWBuildings,
  wFloors,      setWFloors,
  wClasses,     setWClasses,
  wTeachers,
  wAssignments, setWAssignments,
  wSubjects,    setWSubjects,
  wTimeslots,   setWTimeslots,
  wStep,        setWStep,
} from './state.js';

import { esc, notify }                                        from './helpers.js';
import { flattenColumns, colKey, invalidateColumnCache }       from './helpers.js';
import { persistAll }                                          from './import-export.js';

import {
  migrateScheduleKeys,
  _roomLabel, _highlightDuplicateRooms,
  renderBuildingList, renderFloorList,
  syncBuildingsFromDOM, updateFloorBuildingSelects,
  getClassesFromDOM, renderClassGrid,
  syncTeachersFromDOM, renderTeacherList,
} from './wizard-data.js';

// Funkcje żyjące jeszcze w app.js (zostaną przeniesione w kolejnych etapach):
/* globals initTimeslotEditor, renderSubjectList, buildTimeslotsFromHours,
           mountApp, showWelcomeScreen, closeSettingsPanel, wpUpdate,
           wizardSaveDraft, startWizardAutosave, stopWizardAutosave,
           wizardCheckDraft, wizardClearDraft */

// ── Lokalny stan kroków przypisań ────────────────────────────────
let _currentAssignDay = 0;

// ================================================================
//  OTWIERANIE KREATORA — NOWY ROK
// ================================================================
export function openWizardNewYear() {
  setWStep(0);
  setWAssignments({});

  // setWBuildings, setWFloors itp. są importowane na górze modułu

  // Wypełnij dane z appState lub pustymi wartościami
  _initWizardFields();

  renderBuildingList();
  renderFloorList();
  renderClassGrid();
  renderTeacherList();
  updateWizardStep();

  if (wizardCheckDraft()) {
    startWizardAutosave();
    return;
  }
  document.getElementById('wizardOverlay').classList.add('show');
  startWizardAutosave();
}

// ================================================================
//  NAWIGACJA KROKÓW
// ================================================================
export function wizardNext() {
  // ── Walidacja bieżącego kroku ──────────────────────────────
  if (wStep === 0) {
    const name = document.getElementById('wSchoolName').value.trim();
    if (!name)               { notify('⚠ Podaj nazwę szkoły', true); return; }
    if (wBuildings.length === 0) { notify('⚠ Dodaj przynajmniej jeden budynek', true); return; }
    syncBuildingsFromDOM();
  }

  if (wStep === 1) {
    const yr = document.getElementById('wYear').value.trim();
    if (!yr) { notify('⚠ Podaj rok szkolny', true); return; }
    document.getElementById('wTitleYear').textContent = yr;
  }

  if (wStep === 2) {
    if (wFloors.length === 0) { notify('⚠ Dodaj przynajmniej jedno piętro', true); return; }
    const seenKeys = new Map();
    let dupKeys = [], emptyFound = false;
    wFloors.forEach((fl, fi) => fl.segments.forEach((sg, si) => sg.rooms.forEach(r => {
      const n = (r.num || '').trim();
      if (!n) { emptyFound = true; return; }
      const key      = `f${fi}_s${si}_${n}`;
      const label    = _roomLabel(fi, si, n);
      const location = `${fl.name || ('Piętro ' + fi)} › ${sg.name || ('Segment ' + si)} › Sala ${n} (skrót: ${label})`;
      if (seenKeys.has(key)) dupKeys.push({ key, loc1: seenKeys.get(key), loc2: location });
      else seenKeys.set(key, location);
    })));
    if (emptyFound) { notify('⚠ Każda sala musi mieć numer', true); return; }
    if (dupKeys.length) {
      const first = dupKeys[0];
      notify(`⚠ Skrót sali powtarza się:\n  • ${first.loc1}\n  • ${first.loc2}\nW tym samym segmencie numer sali musi być unikalny.`, true);
      _highlightDuplicateRooms(dupKeys.map(d => d.key));
      return;
    }
  }

  if (wStep === 3) {
    setWClasses(getClassesFromDOM());
    if (wClasses.filter(c => c.name).length === 0) { notify('⚠ Dodaj przynajmniej jedną klasę', true); return; }
  }

  if (wStep === 4) {
    // BUG-08 fix: bez redundantnego init-timeslot
    renderSubjectList();
  }

  if (wStep === 5) {
    syncTeachersFromDOM();
    // Nauczyciele opcjonalni — bez walidacji
  }

  if (wStep === 6) { finishWizard(); return; }

  setWStep(wStep + 1);
  if (wStep === 2) initTimeslotEditor();
  if (wStep === 4) renderSubjectList();
  if (wStep === 5) renderTeacherList();   // BUG-A fix
  if (wStep === 6) renderAssignmentsStep();
  updateWizardStep();
  wpUpdate(wStep);
  wizardSaveDraft();
}

export function wizardBack() {
  if (wStep > 0) {
    setWStep(wStep - 1);
    updateWizardStep();
    wpUpdate(wStep);
    wizardSaveDraft();
  }
}

export function updateWizardStep() {
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const stepEl = document.getElementById(`wStep${i}`);
    if (stepEl) stepEl.classList.toggle('active', i === wStep);
    const ws = document.getElementById(`ws${i}`);
    if (!ws) continue;
    ws.className = 'wstep' + (i === wStep ? ' active' : '') + (i < wStep ? ' done' : '');
    const numEl = ws.querySelector('.wstep-num');
    if (numEl) numEl.textContent = i < wStep ? '✓' : i + 1;
    if (i < TOTAL_STEPS - 1) {
      const wl = document.getElementById(`wl${i}`);
      if (wl) wl.className = 'wstep-line' + (i < wStep ? ' done' : '');
    }
  }
  document.getElementById('wFooterInfo').textContent = `Krok ${wStep + 1} z ${TOTAL_STEPS}`;
  document.getElementById('wBtnBack').style.display  = wStep > 0 ? 'flex' : 'none';
  // _wizardEditMode z storage.js — sprawdzamy globalnie
  const isEdit = typeof isWizardEditMode === 'function' ? isWizardEditMode() : false;
  document.getElementById('wBtnNext').textContent =
    wStep === TOTAL_STEPS - 1
      ? (isEdit ? '✓ Zapisz zmiany' : '✓ Zakończ i przejdź do planu')
      : 'Dalej →';
}

// ================================================================
//  FINALIZACJA
// ================================================================
export function finishWizard() {
  syncBuildingsFromDOM();
  syncTeachersFromDOM();

  const yearLabel = document.getElementById('wYear').value.trim();
  const hours     = document.getElementById('wHours').value
    .split(',').map(h => h.trim()).filter(Boolean)
    .sort((a, b) => Number(a) - Number(b)); // BUG-B fix

  const classes  = getClassesFromDOM();
  const yearKey  = 'y_' + yearLabel.replace(/\//g, '_');
  const school   = {
    name:  document.getElementById('wSchoolName').value.trim(),
    short: document.getElementById('wSchoolShort').value.trim(),
    phone: document.getElementById('wSchoolPhone').value.trim(),
    web:   document.getElementById('wSchoolWeb').value.trim(),
  };
  const teachers    = wTeachers.filter(t => t.first || t.last);
  const assignments = getAssignmentsFromDOM();

  // Archiwizuj poprzedni rok jeśli to nowy rok (nie edycja)
  const isEdit = typeof isWizardEditMode === 'function' ? isWizardEditMode() : false;
  if (appState && !isEdit) {
    const existing = archive.find(a => a.yearKey === appState.yearKey);
    if (!existing && appState.yearKey !== yearKey) {
      archive.push({ yearKey: appState.yearKey, label: appState.yearLabel, savedAt: new Date().toISOString(), config: structuredClone(appState) });
      setArchive(archive);
    }
  }

  const prevHomerooms = appState?.homerooms || {};
  const prevFloors    = isEdit ? structuredClone(appState?.floors || []) : [];
  const subjects      = wSubjects.filter(s => s.name && s.name.trim());
  const timeslots     = wTimeslots.filter(t => t.label).map(t => ({ label: t.label, start: t.start || '', end: t.end || '' }));

  setAppState({ yearKey, yearLabel, hours, floors: wFloors, buildings: wBuildings, classes, teachers, assignments, subjects, timeslots, days: DAYS_DEFAULT, school, homerooms: prevHomerooms });

  // BUG-03 fix: zapamiętaj tryb edycji przed resetem
  const wasEditMode = isEdit;
  if (typeof setWizardEditMode === 'function') setWizardEditMode(false);

  // Uzupełnij brakujące sloty w schedData
  if (!schedData[yearKey]) schedData[yearKey] = {};
  DAYS_DEFAULT.forEach((_, i) => {
    if (!schedData[yearKey][i]) schedData[yearKey][i] = {};
    hours.forEach(h => { if (!schedData[yearKey][i][h]) schedData[yearKey][i][h] = {}; });
  });

  // Migracja kluczy sal po zmianie struktury pięter
  if (wasEditMode && prevFloors.length) {
    const migrated = migrateScheduleKeys(prevFloors, wFloors, yearKey, schedData);
    if (migrated > 0) notify(`✓ Przeniesiono ${migrated} wpisów planu do zaktualizowanej struktury sal`);
  }

  invalidateColumnCache(); // OPT-02
  persistAll();
  wizardClearDraft();
  stopWizardAutosave();
  document.getElementById('wizardOverlay').classList.remove('show');

  if (!wasEditMode) setCurrentDay(0); // BUG-03 fix

  mountApp();

  const msg = wasEditMode
    ? '✓ Zmiany zapisane dla roku ' + yearLabel
    : '🎉 Rok szkolny ' + yearLabel + ' utworzony!';
  notify(msg);

  // Przywróć nagłówek kreatora
  const titleEl = document.getElementById('wizardTitle');
  if (titleEl) titleEl.innerHTML = 'Nowy rok szkolny<br><span id="wTitleYear">' + esc(yearLabel) + '</span>';
  const subEl = document.getElementById('wizardSubtitle');
  if (subEl) subEl.textContent = 'Skonfiguruj szkołę, budynki, nauczycieli i klasy — zajmie to tylko chwilę.';
}

// ================================================================
//  PRZYPISANIA KLAS DO SAL (krok 6)
// ================================================================
export function renderAssignmentsStep() {
  _currentAssignDay = 0;
  setWClasses(getClassesFromDOM().filter(c => c.name));
  const tabsEl = document.getElementById('assignmentsTabs');
  const days   = appState?.days || DAYS_DEFAULT;
  tabsEl.innerHTML = days.map((d, i) =>
    `<button class="btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}" style="padding:5px 12px;font-size:0.75rem"
      onclick="switchAssignDay(${i})">${esc(d)}</button>`
  ).join('');
  renderAssignTable();
}

export function switchAssignDay(idx) {
  _currentAssignDay = idx;
  document.querySelectorAll('#assignmentsTabs button').forEach((b, i) => {
    b.className = `btn ${i === idx ? 'btn-primary' : 'btn-ghost'}`;
    b.style.cssText = 'padding:5px 12px;font-size:0.75rem';
  });
  renderAssignTable();
}

export function renderAssignTable() {
  const tbl  = document.getElementById('assignmentsTable');
  const cols = flattenColumns(wFloors);

  // BUG-06 fix: buduj opcje per-sala z poprawnym `selected`
  const classEntries = [{ val: '', label: '—' }];
  const seen = new Set(['']);
  wClasses.filter(c => c.name).forEach(c => {
    const val   = c.abbr || c.name;
    const label = c.group && c.group !== c.name ? `${c.name} — ${c.group}` : c.name;
    if (!seen.has(val)) { seen.add(val); classEntries.push({ val, label }); }
  });

  const buildClassOptions = savedVal =>
    classEntries.map(e =>
      `<option value="${esc(e.val)}"${e.val === savedVal ? ' selected' : ''}>${esc(e.label)}</option>`
    ).join('');

  if (!cols.length) {
    tbl.innerHTML = '<tr><td style="padding:20px;color:var(--text-muted)">Brak sal</td></tr>';
    return;
  }

  tbl.innerHTML = '<tr><th>Budynek</th><th>Piętro</th><th>Segment</th><th>Sala</th><th>Klasa</th></tr>' +
    cols.map(col => {
      const key      = colKey(col);
      const saved    = (wAssignments[_currentAssignDay] || {})[key] || '';
      const bld      = wBuildings[col.floor.buildingIdx || 0];
      const bldColor = BUILDING_COLORS[(col.floor.buildingIdx || 0) % BUILDING_COLORS.length];
      return `<tr>
        <td style="font-size:0.68rem;font-weight:700;color:${bldColor};padding:5px 8px">${esc(bld?.name || '—')}</td>
        <td style="font-size:0.68rem;color:${col.floor.color};font-weight:700;padding:5px 8px">${esc(col.floor.name)}</td>
        <td style="font-size:0.68rem;color:var(--text-muted);padding:5px 8px">${esc(col.seg.name)}</td>
        <td style="font-family:var(--mono);font-size:0.72rem;color:var(--accent);padding:5px 8px">Sala ${esc(col.room.num)}</td>
        <td><select class="assign-select" onchange="setAssign(${_currentAssignDay},'${key}',this.value)">${buildClassOptions(saved)}</select></td>
      </tr>`;
    }).join('');
}

export function setAssign(dayIdx, key, val) {
  if (!wAssignments[dayIdx]) wAssignments[dayIdx] = {};
  wAssignments[dayIdx][key] = val;
}

export function getAssignmentsFromDOM() { return wAssignments; }

// ================================================================
//  PRYWATNE POMOCNICZE
// ================================================================
function _initWizardFields() {
  // Wypełnia pola formularza i zmienne tymczasowe z appState lub wartościami domyślnymi.
  // Wywołana tylko z openWizardNewYear — openEditWizard jest w storage.js.
  const { setWBuildings, setWFloors, setWClasses, setWTeachers, setWSubjects, setWTimeslots } =
    // Re-import setterów — używamy dynamicznego aby uniknąć circular dep.
    // W praktyce settery są już zaimportowane na górze przez state.js.
    // Ten blok serve jako dokumentacja przepływu.
    {};

  if (appState) {
    import('./state.js').then(s => {
      s.setWBuildings(structuredClone(appState.buildings || [{ name: '', address: '' }]));
      s.setWFloors(structuredClone(appState.floors    || []));
      s.setWClasses(structuredClone(appState.classes  || []));
      s.setWTeachers(structuredClone(appState.teachers || []));
      s.setWSubjects(structuredClone(appState.subjects || []));
      s.setWTimeslots(structuredClone(
        appState.timeslots?.length ? appState.timeslots : buildTimeslotsFromHours(appState.hours || [], [])
      ));
    }).catch(e => { console.warn('Nie udało się załadować state.js:', e); });
    document.getElementById('wSchoolName').value  = appState.school?.name  || '';
    document.getElementById('wSchoolShort').value = appState.school?.short || '';
    document.getElementById('wSchoolPhone').value = appState.school?.phone || '';
    document.getElementById('wSchoolWeb').value   = appState.school?.web   || '';
  } else {
    import('./state.js').then(s => {
      s.setWBuildings([{ name: '', address: '' }]);
      s.setWFloors([]);
      s.setWClasses([]);
      s.setWTeachers([]);
    }).catch(e => { console.warn('Nie udało się załadować state.js:', e); });
  }

  const now = new Date();
  const y   = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  document.getElementById('wYear').value            = `${y}/${y + 1}`;
  document.getElementById('wTitleYear').textContent = `${y}/${y + 1}`;
  document.getElementById('wHours').value           = appState?.hours?.join(',') || '0,1,2,3,4,5,6,7,8,9,10';
}
