// ================================================================
//  INFORMACJA O LOKALNYM PRZECHOWYWANIU DANYCH
// ================================================================
const COOKIE_KEY = 'sp_cookies_accepted';

function initCookieBanner() {
  if (!localStorage.getItem(COOKIE_KEY)) {
    setTimeout(() => {
      document.getElementById('cookieBanner').classList.add('show');
    }, 1500);
  }
}

function acceptCookies() {
  localStorage.setItem(COOKIE_KEY, '1');
  document.getElementById('cookieBanner').classList.remove('show');
  document.getElementById('cookieDetailModal').classList.remove('show');
}

function showCookieDetail() {
  document.getElementById('cookieDetailModal').classList.add('show');
}

function closeCookieDetail() {
  document.getElementById('cookieDetailModal').classList.remove('show');
}


// ================================================================
//  WALIDACJA KOLIZJI
// ================================================================
function detectCollisions(dayData, hours, cols) {
  const result = {};  // 'h|key' -> [string, ...]

  hours.forEach(function(h) {
    const row = dayData[h] || {};
    // Zbierz wszystkie wpisy tej godziny
    const entries = [];
    cols.forEach(function(col) {
      const key   = colKey(col);
      const entry = row[key] || {};
      if (entry.teacherAbbr || entry.className || (entry.classes && entry.classes.length)) {
        entries.push({ key, entry, col });
      }
    });

    // Sprawdź kolizje nauczyciela
    const byTeacher = {};
    entries.forEach(function(e) {
      if (!e.entry.teacherAbbr) return;
      const abbr = e.entry.teacherAbbr;
      if (!byTeacher[abbr]) byTeacher[abbr] = [];
      byTeacher[abbr].push(e);
    });
    Object.keys(byTeacher).forEach(function(abbr) {
      if (byTeacher[abbr].length < 2) return;
      byTeacher[abbr].forEach(function(e) {
        const cellId = h + '|' + e.key;
        if (!result[cellId]) result[cellId] = [];
        const others = byTeacher[abbr].filter(x => x.key !== e.key)
          .map(x => x.col.room.num || x.key).join(', ');
        result[cellId].push('Nauczyciel ' + abbr + ' jednocześnie w: ' + others);
      });
    });

    // Sprawdź kolizje klasy/grupy (obsługa entry.classes i entry.className)
    const byClass = {};
    entries.forEach(function(e) {
      const clsList = (e.entry.classes && e.entry.classes.length) ? e.entry.classes
        : (e.entry.className ? [e.entry.className] : []);
      clsList.forEach(function(cls) {
        if (!byClass[cls]) byClass[cls] = [];
        byClass[cls].push(e);
      });
    });
    Object.keys(byClass).forEach(function(cls) {
      if (byClass[cls].length < 2) return;
      byClass[cls].forEach(function(e) {
        const cellId = h + '|' + e.key;
        if (!result[cellId]) result[cellId] = [];
        const others = byClass[cls].filter(x => x.key !== e.key)
          .map(x => x.col.room.num || x.key).join(', ');
        result[cellId].push('Klasa ' + cls + ' jednocześnie w: ' + others);
      });
    });
  });

  return result;
}

function scrollToFirstCollision() {
  const first = document.querySelector('.cell-inner.collision');
  if (first) first.closest('td').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ================================================================
//  PANEL POMOCY APLIKACJI
// ================================================================
function toggleAppHelp() {
  var panel = document.getElementById('appHelpPanel');
  var btn   = document.getElementById('tutTriggerBtn');
  if (!panel) return;
  var isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  if (btn) btn.classList.toggle('active', !isOpen);
}
function closeAppHelp() {
  var panel = document.getElementById('appHelpPanel');
  var btn   = document.getElementById('tutTriggerBtn');
  if (panel) panel.classList.remove('open');
  if (btn)   btn.classList.remove('active');
}

// ================================================================
//  PANEL INSTRUKCJI KREATORA
// ================================================================
function wpUpdate(step) {
  for (var i = 0; i < 7; i++) {
    var el = document.getElementById('wp' + i);
    if (el) el.classList.toggle('active', i === step);
  }
}

// ================================================================
//  CONSTANTS & STATE
// ================================================================
const DAYS_DEFAULT = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek'];
const FLOOR_COLORS = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
const BUILDING_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
const BUILDING_LETTERS = ['A','B','C','D','E','F','G','H'];
const TOTAL_STEPS = 7;

let appState = null;
let schedData = {};
let validFromDates = {};
let archive = [];
let currentDay = 0;
let currentAssignDay = 0;

// wizard temp
let wBuildings = [];
let wFloors = [];
let wClasses = [];
let wTeachers = []; // [{first, last, abbr}]
let wAssignments = {};
let wSubjects = []; // [{name, abbr}] — słownik przedmiotów
let wTimeslots = []; // [{label, start, end}] — przedziały czasowe lekcji
let wStep = 0;

let _mDay, _mHour, _mKey;
let _selectedClasses = [];

// ================================================================
//  UNDO / REDO
// ================================================================
const UNDO_LIMIT = 30; // max głębokość stosu
let _undoStack = [];   // [{snapshot, label}]
let _redoStack = [];   // [{snapshot, label}]

// Tryb widoku: 'rooms' | 'teacher' | 'class'
let _viewMode   = 'rooms';
let _viewFilter = ''; // skrót nauczyciela lub skrót klasy

// Zapisuje snapshot schedData przed operacją mutującą komórkę/dzień
function undoPush(label) {
  const yk = appState?.yearKey;
  if (!yk) return;
  _undoStack.push({
    label,
    yearKey: yk,
    day: currentDay,
    snapshot: structuredClone(schedData[yk]?.[currentDay] || {}),
  });
  if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
  _redoStack = []; // nowa operacja kasuje redo
  _undoUpdateUI();
}

function undoApply(stack, targetStack, action) {
  if (!stack.length || !appState) return;
  const entry = stack.pop();
  const yk = appState.yearKey;

  // Zapisz aktualny stan na docelowy stos
  targetStack.push({
    label: entry.label,
    yearKey: yk,
    day: entry.day,
    snapshot: structuredClone(schedData[yk]?.[entry.day] || {}),
  });

  // Przywróć
  if (!schedData[yk]) schedData[yk] = {};
  schedData[yk][entry.day] = structuredClone(entry.snapshot);
  persistAll();

  // Przełącz na właściwy dzień jeśli inny
  if (entry.day !== currentDay) {
    switchDay(entry.day);
  }
  renderSchedule();
  updateStatusBar();
  sbSet(`${action}: ${entry.label}`);
  _undoUpdateUI();
}

function undoAction()  { undoApply(_undoStack, _redoStack, '↩ Cofnięto'); }
function redoAction()  { undoApply(_redoStack, _undoStack, '↪ Przywrócono'); }

function _undoUpdateUI() {
  const canUndo = _undoStack.length > 0;
  const canRedo = _redoStack.length > 0;

  const btnU = document.getElementById('btnUndo');
  const btnR = document.getElementById('btnRedo');
  if (btnU) {
    btnU.disabled = !canUndo;
    btnU.title = canUndo
      ? `Cofnij: ${_undoStack[_undoStack.length-1].label} (Ctrl+Z)`
      : 'Brak operacji do cofnięcia';
  }
  if (btnR) {
    btnR.disabled = !canRedo;
    btnR.title = canRedo
      ? `Przywróć: ${_redoStack[_redoStack.length-1].label} (Ctrl+Y)`
      : 'Brak operacji do przywrócenia';
  }

  // Menu hamburger
  const hmU = document.getElementById('hmenuUndo');
  const hmR = document.getElementById('hmenuRedo');
  if (hmU) { hmU.disabled = !canUndo; hmU.style.opacity = canUndo ? '1' : '0.4'; }
  if (hmR) { hmR.disabled = !canRedo; hmR.style.opacity = canRedo ? '1' : '0.4'; }
}

// ================================================================
//  ABBREVIATION GENERATOR
// ================================================================
function genAbbr(first, last) {
  const f = (first || '').trim();
  const l = (last || '').trim();
  if (!f && !l) return '';
  const fLetter = f ? f[0].toUpperCase() : '';
  // detect double-barreled surname: hyphen or space
  const parts = l.split(/[-\s]+/).filter(Boolean);
  let lPart = '';
  if (parts.length >= 2) {
    // two-part: 2 letters of first part + 1 letter of second
    lPart = (parts[0].slice(0, 2) + parts[1][0]).toUpperCase();
  } else if (parts.length === 1) {
    lPart = parts[0].slice(0, 3).toUpperCase();
  }
  return fLetter + lPart;
}

function ensureUniqueAbbr(abbr, existingAbbrs) {
  if (!existingAbbrs.includes(abbr)) return abbr;
  let i = 2;
  while (existingAbbrs.includes(abbr + i)) i++;
  return abbr + i;
}

// ================================================================
//  STORAGE
// ================================================================
function loadAll() {
  try { schedData = JSON.parse(localStorage.getItem('sp_sched') || '{}'); } catch(e) { schedData = {}; }
  try { validFromDates = JSON.parse(localStorage.getItem('sp_vfdates') || '{}'); } catch(e) {}
  try { archive = JSON.parse(localStorage.getItem('sp_archive') || '[]'); } catch(e) { archive = []; }
  try { appState = JSON.parse(localStorage.getItem('sp_active') || 'null'); } catch(e) { appState = null; }
  // ensure optional fields exist
  normalizeAppState(appState);
  // Migracja nazw klas
  if (appState) migrateClassNames(appState);

}

// ================================================================
//  STRONA POWITALNA
// ================================================================
let _demoMode = false;

function showWelcomeScreen() {
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
  // Pokaż przycisk "Aktualny plan" jeśli plan istnieje
  const planBtn = document.getElementById('wlCurrentPlanBtn');
  if (planBtn) planBtn.style.display = appState ? '' : 'none';

  closeSettingsPanel();
  document.getElementById('welcomeScreen').classList.add('show');
}

function hideWelcomeScreen() {
  document.getElementById('welcomeScreen').classList.remove('show');
  // Jeśli mamy plan, upewnij się że appOverlay jest widoczny
  if (appState) mountApp();
}

// ── Nowy plan od zera ──
function welcomeStartNew() {
  _demoMode = false;
  hideWelcomeScreen();
  openWizardNewYear();
}

// ── Nowy rok na bazie istniejącego ──
function welcomeCopyYear() {
  if (!appState) { notify('⚠ Brak planu do skopiowania — najpierw utwórz nowy plan', true); return; }
  _demoMode = false;
  hideWelcomeScreen();
  openWizardNewYear();
}

// ── Import z pliku — kliknięcie karty ──
function welcomeImportClick() {
  document.getElementById('wlFileInput').click();
}

// Dane wczytanego pliku — czekają na wybór trybu
let _wlPendingImport = null;

function welcomeHandleFile(file) {
  if (!file || !file.name.endsWith('.json')) {
    notify('⚠ Wybierz plik .json', true); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      let data = JSON.parse(e.target.result);
      if (!data.schedData && !data.appState) {
        notify('⚠ Nieprawidłowy format pliku', true); return;
      }
      data = migrateImportData(data);
      _wlPendingImport = data;
      // Pokaż panel wyboru trybu
      const fnEl = document.getElementById('wlIcFileName');
      if (fnEl) fnEl.textContent = '📄 ' + file.name;
      // Opcja "scal" i "zastąp" tylko gdy jest bieżący plan
      const mergeBtn = document.getElementById('wlIcMergeBtn');
      const freshBtn = document.getElementById('wlIcFreshBtn');
      if (mergeBtn) mergeBtn.classList.toggle('disabled', !appState);
      if (freshBtn) freshBtn.style.display = appState ? 'none' : 'block';
      // "zastąp" dostępna zawsze gdy jest appState
      document.getElementById('wlImportPanel').classList.add('show');
    } catch(ex) {
      notify('⚠ Błąd odczytu pliku: ' + ex.message, true);
    }
  };
  reader.onerror = () => notify('⚠ Błąd odczytu pliku', true);
  reader.readAsText(file);
}

function wlImportCancel() {
  _wlPendingImport = null;
  document.getElementById('wlImportPanel').classList.remove('show');
}

function wlImportConfirm(mode) {
  const data = _wlPendingImport;
  if (!data) return;
  _demoMode = false;
  document.getElementById('wlImportPanel').classList.remove('show');

  if (mode === 'fresh' || (mode === 'replace' && !appState)) {
    // Wczytaj jako świeży plan (brak bieżącego lub wybrano fresh)
    appState       = data.appState       || null;
    schedData      = data.schedData      || {};
    validFromDates = data.validFromDates  || {};
    archive        = data.archive         || [];
    normalizeAppState(appState);
    migrateClassNames(appState);
    persistAll();
    hideWelcomeScreen();
    if (appState) {
      const yk = appState.yearKey;
      if (!schedData[yk]) schedData[yk] = {};
      (appState.days||DAYS_DEFAULT).forEach((_,i) => {
        if (!schedData[yk][i]) schedData[yk][i] = {};
        (appState.hours||[]).forEach(h => { if(!schedData[yk][i][h]) schedData[yk][i][h]={}; });
      });
      mountApp();
    } else {
      showWelcomeScreen();
    }
    notify('✓ Plan wczytany z pliku');

  } else if (mode === 'replace' && appState) {
    // Zastąp — archiwizuj bieżący, wczytaj nowy
    hideWelcomeScreen();
    _importData = data;
    document.getElementById('importModeOverwrite').checked = true;
    document.getElementById('importModeMerge').checked = false;
    confirmImport();

  } else if (mode === 'merge' && appState) {
    // Scal — użyj istniejącego modal z podglądem diff
    hideWelcomeScreen();
    openImportModal(data);
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
    if (!_wlDrag) {
      _wlDrag = true;
      ws.style.background = '#dbeafe';
    }
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
function welcomeDemo() {
  _demoMode = true;
  hideWelcomeScreen();
  loadDemoData();
  const yk = appState.yearKey;
  (appState.days||DAYS_DEFAULT).forEach((_,i) => {
    if (!schedData[yk][i]) schedData[yk][i] = {};
    (appState.hours||[]).forEach(h => { if(!schedData[yk][i][h]) schedData[yk][i][h]={}; });
  });
  mountApp();
  // Pokaż banner demo
  setTimeout(() => {
    notify('🎬 Tryb demo — dane nie są zapisywane');
    const bar = document.getElementById('demoBanner');
    if (bar) bar.style.display = 'flex';
  }, 400);
}

function loadDemoData() {
  const buildings = [{ name: 'Budynek Główny', address: 'ul. Szkolna 1' }, { name: 'Skrzydło B', address: 'ul. Szkolna 1' }];
  const floors = [
    { name: 'Parter',    color: '#f59e0b', buildingIdx: 0, segments: [
      { name: 'Skrzydło A', rooms: [{num:'1',sub:''},{num:'2',sub:''},{num:'3',sub:''}] },
      { name: 'Skrzydło B', rooms: [{num:'4',sub:''},{num:'5',sub:''}] },
    ]},
    { name: 'Piętro 1',  color: '#3b82f6', buildingIdx: 0, segments: [
      { name: 'Lewe',    rooms: [{num:'11',sub:''},{num:'12',sub:''}] },
      { name: 'Prawe',   rooms: [{num:'13',sub:''},{num:'14',sub:''}] },
    ]},
    { name: 'Parter',    color: '#10b981', buildingIdx: 1, segments: [
      { name: 'Główny',  rooms: [{num:'B1',sub:''},{num:'B2',sub:''},{num:'B3',sub:''}] },
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
    {first:'Anna',    last:'Kowalska',  abbr:'AKOW'},
    {first:'Piotr',   last:'Nowak',     abbr:'PNOW'},
    {first:'Maria',   last:'Wiśniewska',abbr:'MWIS'},
    {first:'Tomasz',  last:'Zając',     abbr:'TZAJ'},
    {first:'Katarzyna',last:'Lewandowska',abbr:'KLEW'},
    {first:'Marek',   last:'Wójcik',    abbr:'MWOJ'},
  ];
  const hours = ['1','2','3','4','5','6','7','8'];
  const yearKey = 'y_demo_2024_2025';

  // Kolumny
  function demoColKey(fi, si, ri) {
    const room = floors[fi].segments[si].rooms[ri];
    return `f${fi}_s${si}_${room.num || 'r'+ri}`;
  }

  const sched = {};
  DAYS_DEFAULT.forEach((_,di) => {
    sched[di] = {};
    hours.forEach(h => { sched[di][h] = {}; });
  });

  // Kilka przykładowych wpisów
  const entries = [
    [0,0,'1',demoColKey(0,0,0), {teacherAbbr:'AKOW',classes:['1A'],className:'1A',subject:'Matematyka',note:''}],
    [0,0,'2',demoColKey(0,0,1), {teacherAbbr:'PNOW',classes:['2A'],className:'2A',subject:'Fizyka',note:''}],
    [0,0,'3',demoColKey(0,1,0), {teacherAbbr:'MWIS',classes:['1B'],className:'1B',subject:'Biologia',note:''}],
    [0,0,'1',demoColKey(1,0,0), {teacherAbbr:'TZAJ',classes:['3A'],className:'3A',subject:'Historia',note:''}],
    [0,0,'2',demoColKey(1,1,0), {teacherAbbr:'KLEW',classes:['2B'],className:'2B',subject:'Chemia',note:''}],
    [0,1,'1',demoColKey(0,0,0), {teacherAbbr:'MWOJ',classes:['1A gr.1','1A gr.2'],className:'1A gr.1',subject:'WF',note:'zajęcia łączone'}],
    [0,1,'2',demoColKey(0,0,2), {teacherAbbr:'AKOW',classes:['2A'],className:'2A',subject:'Matematyka',note:''}],
    [0,2,'1',demoColKey(2,0,0), {teacherAbbr:'PNOW',classes:['1B'],className:'1B',subject:'Informatyka',note:'pracownia'}],
    [0,2,'2',demoColKey(2,0,1), {teacherAbbr:'MWIS',classes:['2B'],className:'2B',subject:'Biologia',note:''}],
    // Wtorek
    [1,0,'1',demoColKey(0,0,0), {teacherAbbr:'PNOW',classes:['1A'],className:'1A',subject:'Fizyka',note:''}],
    [1,0,'3',demoColKey(0,1,1), {teacherAbbr:'AKOW',classes:['3A'],className:'3A',subject:'Matematyka',note:''}],
    [1,1,'2',demoColKey(1,0,1), {teacherAbbr:'TZAJ',classes:['2A'],className:'2A',subject:'Historia',note:''}],
    // Kolizja demonstracyjna — ten sam nauczyciel w 2 salach
    [0,0,'4',demoColKey(0,0,0), {teacherAbbr:'AKOW',classes:['1B'],className:'1B',subject:'Algebra',note:''}],
    [0,0,'4',demoColKey(0,0,1), {teacherAbbr:'AKOW',classes:['2A gr.1'],className:'2A gr.1',subject:'Algebra',note:''}],
  ];

  entries.forEach(([di, fi_unused, h, key, entry]) => {
    if (sched[di] && sched[di][h] !== undefined) {
      sched[di][h][key] = entry;
    }
  });

  const homerooms = {};
  homerooms[demoColKey(0,0,0)] = {className:'1A',teacherAbbr:'AKOW'};
  homerooms[demoColKey(0,0,1)] = {className:'2A',teacherAbbr:'PNOW'};
  homerooms[demoColKey(0,1,0)] = {className:'1B',teacherAbbr:'MWIS'};

  appState = {
    yearKey, yearLabel: '2024/2025 (DEMO)',
    hours, floors, buildings, classes, teachers,
    assignments: {}, days: DAYS_DEFAULT,
    school: { name: 'Szkoła Podstawowa nr 1 (DEMO)', short: 'SP1', phone: '12 345 67 89', web: 'www.sp1.demo.pl' },
    homerooms,
  };
  schedData = { [yearKey]: sched };
  validFromDates = {};
}

function exitDemo() {
  _demoMode = false;
  const bar = document.getElementById('demoBanner');
  if (bar) bar.style.display = 'none';
  appState   = null;
  schedData  = {};
  loadAll();
  if (!appState) {
    document.getElementById('appOverlay').style.display = 'none';
    showWelcomeScreen();
  } else {
    const yk = appState.yearKey;
    if (!schedData[yk]) schedData[yk] = {};
    (appState.days||DAYS_DEFAULT).forEach((_,i) => {
      if (!schedData[yk][i]) schedData[yk][i] = {};
      (appState.hours||[]).forEach(h => { if(!schedData[yk][i][h]) schedData[yk][i][h]={}; });
    });
    mountApp();
  }
}

// ================================================================
//  KREATOR — TRYB EDYCJI BIEŻĄCEGO ROKU
// ================================================================
let _wizardEditMode = false; // true = edytujemy istniejący rok (nie nowy)

function openEditWizard() {
  if (!appState) return;
  _wizardEditMode = true;
  wStep = 0;
  wAssignments = appState.assignments ? structuredClone(appState.assignments) : {};
  wBuildings = structuredClone(appState.buildings || [{ name:'', address:'' }]);
  wFloors    = structuredClone(appState.floors    || []);
  wClasses   = structuredClone(appState.classes   || []);
  wTeachers  = structuredClone(appState.teachers  || []);
  wSubjects  = structuredClone(appState.subjects  || []);
  wTimeslots = structuredClone(
    appState.timeslots?.length
      ? appState.timeslots
      : buildTimeslotsFromHours(appState.hours || [], [])
  );

  document.getElementById('wSchoolName').value  = appState.school?.name  || '';
  document.getElementById('wSchoolShort').value = appState.school?.short || '';
  document.getElementById('wSchoolPhone').value = appState.school?.phone || '';
  document.getElementById('wSchoolWeb').value   = appState.school?.web   || '';
  document.getElementById('wYear').value        = appState.yearLabel || '';
  document.getElementById('wTitleYear').textContent = appState.yearLabel || '';
  document.getElementById('wHours').value       = (appState.hours || []).join(',');

  renderBuildingList();
  renderFloorList();
  renderClassGrid();
  renderTeacherList();
  updateWizardStep();
  wpUpdate(0);

  // Zmień nagłówek kreatora na "Edycja roku"
  const titleEl = document.getElementById('wizardTitle');
  if (titleEl) titleEl.innerHTML = '✏️ Edycja roku szkolnego<br><span id="wTitleYear">' + esc(appState.yearLabel||'') + '</span>';
  const subEl = document.getElementById('wizardSubtitle');
  if (subEl) subEl.textContent = 'Zmień sale, klasy, nauczycieli lub godziny lekcyjne. Istniejący plan zostanie zachowany.';

  closeSettingsPanel();
  document.getElementById('wizardOverlay').classList.add('show');
  startWizardAutosave();
}

// ================================================================
//  KREATOR — AUTOSAVE SZKICU
//  localStorage key: sp_wiz_draft
//  Format: { savedAt, step, school, year, hours, buildings,
//            floors, classes, teachers, assignments }
// ================================================================
const DRAFT_KEY = 'sp_wiz_draft';
let _draftTimer = null;

// ── Zbierz aktualny stan kreatora do obiektu ──
function wizardCollectDraft() {
  // Synchronizuj DOM → zmienne zanim zbierzemy
  try { syncBuildingsFromDOM(); } catch(e) {}
  try { syncTeachersFromDOM();  } catch(e) {}
  try { wClasses = getClassesFromDOM(); } catch(e) {}

  return {
    savedAt:   new Date().toISOString(),
    step:      wStep,
    school: {
      name:  (document.getElementById('wSchoolName')?.value  || '').trim(),
      short: (document.getElementById('wSchoolShort')?.value || '').trim(),
      phone: (document.getElementById('wSchoolPhone')?.value || '').trim(),
      web:   (document.getElementById('wSchoolWeb')?.value   || '').trim(),
    },
    year:      (document.getElementById('wYear')?.value  || '').trim(),
    hours:     (document.getElementById('wHours')?.value || '').trim(),
    buildings: structuredClone(wBuildings  || []),
    floors:    structuredClone(wFloors     || []),
    classes:   structuredClone(wClasses    || []),
    teachers:  structuredClone(wTeachers   || []),
    assignments: structuredClone(wAssignments || {}),
    subjects:  structuredClone(wSubjects   || []),
    timeslots: structuredClone(wTimeslots  || []),
  };
}

// ── Zapisz szkic do localStorage ──
function wizardSaveDraft() {
  const statusEl = document.getElementById('wizardDraftStatus');
  const dotEl    = statusEl?.querySelector('.ds-dot');
  const textEl   = document.getElementById('dsDraftText');

  // Pokaż animację "zapisuję..."
  if (dotEl)  dotEl.classList.add('saving');
  if (statusEl) statusEl.classList.add('visible');
  if (textEl) textEl.textContent = 'Zapisuję szkic…';

  try {
    const draft = wizardCollectDraft();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    // Zaktualizuj status
    const t = new Date(draft.savedAt);
    const ts = t.toLocaleTimeString('pl-PL', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    if (dotEl)  dotEl.classList.remove('saving');
    if (textEl) textEl.textContent = `Szkic zapisany ${ts}`;

    // Ukryj po 4 sekundach
    clearTimeout(_draftTimer);
    _draftTimer = setTimeout(() => {
      if (statusEl) statusEl.classList.remove('visible');
    }, 4000);
  } catch(e) {
    if (dotEl)  dotEl.classList.remove('saving');
    const isQuota = e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                    (e.code && (e.code === 22 || e.code === 1014));
    if (isQuota) {
      if (textEl) textEl.textContent = '⚠ Brak miejsca — szkic nie zapisany';
      notify('⚠ Brak miejsca w przeglądarce — szkic kreatora nie został zapisany', true);
    } else {
      if (textEl) textEl.textContent = 'Błąd zapisu szkicu';
      console.warn('wizardSaveDraft error:', e);
    }
  }
}

// ── Usuń szkic (po zakończeniu lub odrzuceniu) ──
function wizardClearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  const statusEl = document.getElementById('wizardDraftStatus');
  if (statusEl) statusEl.classList.remove('visible');
}

// ── Sprawdź czy istnieje szkic i pokaż modal ──
function wizardCheckDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (!draft || !draft.savedAt) return false;

    // Uzupełnij info w modalu
    const t   = new Date(draft.savedAt);
    const ts  = t.toLocaleString('pl-PL', {dateStyle:'short', timeStyle:'short'});
    const step = (draft.step || 0) + 1;
    const school = draft.school?.name || '(bez nazwy)';
    const year   = draft.year || '(bez roku)';
    const metaEl = document.getElementById('draftResumeMeta');
    if (metaEl) metaEl.innerHTML =
      `Ostatni zapis: <strong>${esc(ts)}</strong><br>` +
      `Szkoła: <strong>${esc(school)}</strong>, rok: <strong>${esc(year)}</strong><br>` +
      `Zapisano na kroku <strong>${esc(String(step))} z ${TOTAL_STEPS}</strong> — klucz: <code>sp_wiz_draft</code>`;

    document.getElementById('draftResumeModal').classList.add('show');
    return true;
  } catch(e) {
    localStorage.removeItem(DRAFT_KEY);
    return false;
  }
}

// ── Wznów szkic ──
function draftResume() {
  document.getElementById('draftResumeModal').classList.remove('show');
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (!draft) return;

    // Przywróć zmienne
    wStep        = draft.step || 0;
    wBuildings   = draft.buildings  || [{ name:'', address:'' }];
    wFloors      = draft.floors     || [];
    wClasses     = draft.classes    || [];
    wTeachers    = draft.teachers   || [];
    wSubjects    = draft.subjects   || [];
    wTimeslots   = draft.timeslots  || [];
    wAssignments = draft.assignments || {};

    // Przywróć pola formularza
    if (document.getElementById('wSchoolName'))  document.getElementById('wSchoolName').value  = draft.school?.name  || '';
    if (document.getElementById('wSchoolShort')) document.getElementById('wSchoolShort').value = draft.school?.short || '';
    if (document.getElementById('wSchoolPhone')) document.getElementById('wSchoolPhone').value = draft.school?.phone || '';
    if (document.getElementById('wSchoolWeb'))   document.getElementById('wSchoolWeb').value   = draft.school?.web   || '';
    if (document.getElementById('wYear'))        document.getElementById('wYear').value         = draft.year  || '';
    if (document.getElementById('wHours'))       document.getElementById('wHours').value        = draft.hours || '';
    if (document.getElementById('wTitleYear'))   document.getElementById('wTitleYear').textContent = draft.year || '';

    renderBuildingList();
    renderFloorList();
    renderClassGrid();
    renderSubjectList();
    renderTeacherList();
    if (wStep === 1 || wStep === 2) initTimeslotEditor();
    if (wStep === 4) renderSubjectList();
    if (wStep === 6) renderAssignmentsStep();
    updateWizardStep();
    wpUpdate(wStep);

    document.getElementById('wizardOverlay').classList.add('show');

    // Pokaż status
    const t = new Date(draft.savedAt);
    const ts = t.toLocaleTimeString('pl-PL', {hour:'2-digit',minute:'2-digit'});
    const statusEl = document.getElementById('wizardDraftStatus');
    const textEl   = document.getElementById('dsDraftText');
    if (textEl)   textEl.textContent = `Wznowiono (szkic z ${ts})`;
    if (statusEl) statusEl.classList.add('visible');

    notify('↩ Wznowiono kreator z zapisanego szkicu');
  } catch(e) {
    notify('⚠ Błąd wczytywania szkicu', true);
    wizardClearDraft();
  }
}

// ── Odrzuć szkic i zacznij od nowa ──
function draftDiscard() {
  document.getElementById('draftResumeModal').classList.remove('show');
  wizardClearDraft();
  // openWizardNewYear już jest wywołane przed checkDraft — kontynuuj normalnie
  document.getElementById('wizardOverlay').classList.add('show');
}

// ── Podpięcie autosave — co 30 sekund gdy kreator jest otwarty ──
let _autosaveInterval = null;
function startWizardAutosave() {
  stopWizardAutosave();
  _autosaveInterval = setInterval(() => {
    if (document.getElementById('wizardOverlay')?.classList.contains('show')) {
      wizardSaveDraft();
    }
  }, 30000);
}
function stopWizardAutosave() {
  if (_autosaveInterval) { clearInterval(_autosaveInterval); _autosaveInterval = null; }
}


// ================================================================
//  AUTOMATYCZNY SKRÓT KLASY
// ================================================================
const CLASS_ABBR_IGNORE = new Set(['i','w','z','na','dla','ze','lub','a','of','and','the','or','im']);

function autoClassAbbr(className, groupName) {
  const cls   = (className  || '').trim().toUpperCase();
  const grp   = (groupName  || '').trim().toLowerCase();

  // Brak grupy lub "cała klasa" → sam skrót klasy
  if (!grp || grp === 'cała klasa' || grp === 'cala klasa') {
    return cls;
  }

  // Podziel grupę na słowa, filtruj spójniki
  const words = grp.split(/\s+/).filter(w => w.length > 0);
  const meaningful = words.filter(w => !CLASS_ABBR_IGNORE.has(w.toLowerCase()));

  let grpAbbr;
  if (meaningful.length === 0) {
    // same spójniki — użyj całości skróconej do 3 znaków
    grpAbbr = words[0].slice(0,3);
  } else if (meaningful.length === 1) {
    // jeden wyraz: pierwsze 3 litery z wielką, reszta mała
    const w = meaningful[0];
    grpAbbr = w[0].toUpperCase() + w.slice(1, 3).toLowerCase();
  } else {
    // wiele wyrazów: inicjały
    // Pierwsza litera każdego znaczącego słowa
    // Jeśli słowo zaczyna się małą → inicjał wielki
    // Jeśli słowo zaczyna się wielką (skrót) → zostaw
    grpAbbr = meaningful.map(w => {
      // Wykryj skrót np. "HiKN" — zachowaj pierwszą literę
      return w[0].toUpperCase() + (w.length > 1 && w[1] === w[1].toUpperCase() && w[1] !== w[1].toLowerCase()
        ? w[1]  // np. "HiKN" → "HK" — ale lepiej inicjał z każdego słowa
        : '');
    }).join('');

    // Jeśli wyszło za krótko (tylko 1 char) — daj 3 pierwsze litery pierwszego słowa
    if (grpAbbr.length < 2) grpAbbr = meaningful[0].slice(0,3);
  }

  const full = cls + ' ' + grpAbbr.toUpperCase();
  return full.slice(0, 12);  // max 12 znaków
}

// ================================================================
//  EKSPORT / IMPORT / SCALANIE (współpraca)
// ================================================================

// ================================================================
//  MIGRACJA WERSJI PLIKU IMPORTU
// ================================================================
const FILE_VERSION = 2;

// Tabela migracji: v_source → funkcja migrująca do v_source+1
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

// Normalizuje opcjonalne pola appState — stosowana zarówno przy starcie
// jak i po każdym imporcie, żeby stare pliki (bez buildings, subjects itp.)
// nie crashowały aplikacji.
function normalizeAppState(state) {
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
  // Normalizacja: hours muszą być stringami i posortowane numerycznie
  state.hours = state.hours
    .map(h => String(h).trim())
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));
  // Normalizacja: każde piętro musi mieć buildingIdx
  if (state.floors) {
    state.floors.forEach(f => {
      if (f.buildingIdx === undefined || f.buildingIdx === null) f.buildingIdx = 0;
    });
  }
  return state;
}

// Przeprowadź migracje szeregowo aż do FILE_VERSION
function migrateImportData(data) {
  let v = data._version || 1;
  if (v > FILE_VERSION) {
    // Plik nowszy niż aplikacja — ostrzeż, ale nie blokuj
    console.warn('[PlanLekcji] Plik pochodzi z nowszej wersji aplikacji (' + v + ' > ' + FILE_VERSION + '). Niektóre dane mogą być zignorowane.');
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

// ── Eksport do pliku JSON ──
function exportJSON() {
  const data = {
    _version: FILE_VERSION,
    _exported: new Date().toISOString(),
    appState,
    schedData,
    validFromDates,
    archive,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  const school = (appState?.school?.short || appState?.school?.name || 'SalePlan').replace(/\s+/g,'_');
  a.href     = url;
  a.download = `${school}_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  notify('✓ Wyeksportowano plan do pliku JSON');
}


// ================================================================
//  EKSPORT CSV
// ================================================================

// Escapuje wartość do formatu CSV (RFC 4180)
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
  // BOM UTF-8 — Excel na Windows otwiera poprawnie polskie znaki
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

// ── Wariant 1: Plan dzienny ──────────────────────────────────────
// Wiersze: godziny lekcyjne; Kolumny: sale
function exportCSVDay() {
  if (!appState) return;
  const cols    = flattenColumns(appState.floors);
  const hours   = appState.hours;
  const dayData = schedData[appState.yearKey]?.[currentDay] || {};
  const dayName = appState.days[currentDay] || String(currentDay);

  const rows = [];

  // Nagłówek — 1. wiersz: dzień, 2. wiersz: nazwy sal
  rows.push(csvRow(['Plan dzienny', dayName, appState.yearLabel || '']));
  rows.push(csvRow(['Godz.', 'Czas', ...cols.map(col => col.room.num || col.room.sub || '?')]));

  hours.forEach(h => {
    const ts = getTimeslot(h);
    const timeStr = (ts && ts.start && ts.end) ? `${ts.start}–${ts.end}` : '';
    const cells = [String(h), timeStr];
    cols.forEach(col => {
      const entry = dayData[h]?.[colKey(col)] || {};
      const cls   = (entry.classes || []).length ? entry.classes.join('+') : (entry.className || '');
      const parts = [cls, entry.subject || '', entry.teacherAbbr || '', entry.note || ''];
      cells.push(parts.filter(Boolean).join(' | '));
    });
    rows.push(csvRow(cells));
  });

  downloadCSV(csvFilename(`${dayName}`), rows);
  notify('✓ Wyeksportowano plan dnia do CSV');
  closeCSVModal();
}

// ── Wariant 2: Plan tygodniowy (jedna sala) ──────────────────────
// Wiersze: godziny; Kolumny: dni tygodnia
function exportCSVWeekBySala() {
  if (!appState) return;
  const cols  = flattenColumns(appState.floors);
  const hours = appState.hours;
  const days  = appState.days;
  const yk    = appState.yearKey;

  const rows = [];
  rows.push(csvRow(['Plan tygodniowy — zestawienie per sala', appState.yearLabel || '']));
  rows.push([]);

  cols.forEach(col => {
    const key       = colKey(col);
    const roomLabel = col.room.num ? `Sala ${col.room.num}` : (col.room.sub || '?');
    rows.push(csvRow([roomLabel]));
    rows.push(csvRow(['Godz.', 'Czas', ...days]));

    hours.forEach(h => {
      const ts = getTimeslot(h);
      const timeStr = (ts && ts.start && ts.end) ? `${ts.start}–${ts.end}` : '';
      const cells = [String(h), timeStr];
      days.forEach((_, di) => {
        const entry = schedData[yk]?.[di]?.[h]?.[key] || {};
        const cls   = (entry.classes || []).length ? entry.classes.join('+') : (entry.className || '');
        const parts = [cls, entry.subject || '', entry.teacherAbbr || '', entry.note || ''];
        cells.push(parts.filter(Boolean).join(' | '));
      });
      rows.push(csvRow(cells));
    });
    rows.push([]); // pusty wiersz między salami
  });

  downloadCSV(csvFilename('tygodniowy_sale'), rows);
  notify('✓ Wyeksportowano plan tygodniowy (sale) do CSV');
  closeCSVModal();
}

// ── Wariant 3: Zestawienie — każdy wpis jako wiersz ─────────────
// Format płaski: Dzień, Godz., Czas, Sala, Klasy, Przedmiot, Nauczyciel, Uwaga
function exportCSVFlat() {
  if (!appState) return;
  const cols  = flattenColumns(appState.floors);
  const hours = appState.hours;
  const days  = appState.days;
  const yk    = appState.yearKey;

  const rows = [];
  rows.push(csvRow([
    'Rok szkolny', 'Dzień', 'Nr godz.', 'Czas', 'Piętro', 'Segment', 'Sala',
    'Klasy', 'Przedmiot', 'Nauczyciel (skrót)', 'Nauczyciel (imię nazwisko)', 'Uwaga'
  ]));

  days.forEach((dayName, di) => {
    hours.forEach(h => {
      const ts      = getTimeslot(h);
      const timeStr = (ts && ts.start && ts.end) ? `${ts.start}–${ts.end}` : '';
      cols.forEach(col => {
        const entry = schedData[yk]?.[di]?.[h]?.[colKey(col)] || {};
        const filled = entry.teacherAbbr || entry.subject || entry.className || (entry.classes||[]).length;
        if (!filled) return; // pomiń puste
        const cls      = (entry.classes || []).length ? entry.classes.join('+') : (entry.className || '');
        const teacher  = entry.teacherAbbr ? getTeacherByAbbr(entry.teacherAbbr) : null;
        const fullName = teacher ? `${teacher.last || ''} ${teacher.first || ''}`.trim() : '';
        const floor    = col.floor?.name || '';
        const seg      = col.segment?.name || '';
        const sala     = col.room.num || col.room.sub || '';
        rows.push(csvRow([
          appState.yearLabel || yk,
          dayName,
          String(h),
          timeStr,
          floor,
          seg,
          sala,
          cls,
          entry.subject || '',
          entry.teacherAbbr || '',
          fullName,
          entry.note || '',
        ]));
      });
    });
  });

  downloadCSV(csvFilename('zestawienie'), rows);
  notify(`✓ Wyeksportowano ${rows.length - 1} wpisów do CSV`);
  closeCSVModal();
}

// ── Modal wyboru wariantu CSV ────────────────────────────────────
function openCSVModal() {
  if (!appState) { notify('⚠ Brak aktywnego planu', true); return; }
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
            <div class="modal-title">📊 Eksport do CSV</div>
            <div class="modal-sub">Wybierz format eksportu</div>
          </div>
          <button class="modal-close" onclick="closeCSVModal()">✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:10px">
          <button class="btn csv-export-btn" onclick="exportCSVDay()">
            <span class="csv-btn-icon">📅</span>
            <span class="csv-btn-text">
              <strong>Plan dzienny</strong>
              <span>Aktywny dzień — kolumny: sale, wiersze: godziny</span>
            </span>
          </button>
          <button class="btn csv-export-btn" onclick="exportCSVWeekBySala()">
            <span class="csv-btn-icon">🗓</span>
            <span class="csv-btn-text">
              <strong>Plan tygodniowy</strong>
              <span>Wszystkie sale × wszystkie dni tygodnia</span>
            </span>
          </button>
          <button class="btn csv-export-btn" onclick="exportCSVFlat()">
            <span class="csv-btn-icon">📋</span>
            <span class="csv-btn-text">
              <strong>Zestawienie wpisów</strong>
              <span>Każdy wpis jako wiersz — do analizy w Excelu / Google Sheets</span>
            </span>
          </button>
          <div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px;line-height:1.5">
            Pliki CSV mają kodowanie UTF-8 z BOM — Excel otwiera je poprawnie bez konwersji.
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeCSVModal(); });
  }
  modal.classList.add('show');
}

function closeCSVModal() {
  document.getElementById('csvExportModal')?.classList.remove('show');
}

// ── Wczytaj JSON z pliku (obsługa pliku) ──
function handleImportFile(file) {
  if (!file || !file.name.endsWith('.json')) {
    notify('⚠ Wybierz plik .json', true); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      let data = JSON.parse(e.target.result);
      if (!data.schedData && !data.appState) { notify('⚠ Nieprawidłowy format pliku', true); return; } // BUG-11 fix: spójne z welcomeHandleFile
      data = migrateImportData(data);
      openImportModal(data);
    } catch(ex) {
      notify('⚠ Błąd odczytu pliku: ' + ex.message, true);
    }
  };
  reader.onerror = () => notify('⚠ Błąd odczytu pliku', true);
  reader.readAsText(file);
}

// ── Otwórz modal porównania/importu ──
let _importData = null;
function openImportModal(data) {
  _importData = data;
  const modal = document.getElementById('importModal');
  if (!modal) return;

  const impSched  = data.schedData  || {};
  const curSched  = schedData       || {};
  const yk        = appState?.yearKey;

  // Licz różnice
  let added = 0, conflicts = 0, same = 0;
  const impYear = impSched[yk] || {};
  const curYear = curSched[yk] || {};

  Object.keys(impYear).forEach(dayIdx => {
    const impDay = impYear[dayIdx] || {};
    const curDay = curYear[dayIdx] || {};
    Object.keys(impDay).forEach(hr => {
      const impHr = impDay[hr] || {};
      const curHr = curDay[hr] || {};
      Object.keys(impHr).forEach(key => {
        const impCell = impHr[key];
        const curCell = curHr[key];
        const impFilled = !!(impCell?.teacherAbbr || (impCell?.classes||[]).length || impCell?.className);
        const curFilled = !!(curCell?.teacherAbbr || (curCell?.classes||[]).length || curCell?.className);
        if (!impFilled) return;
        if (!curFilled) added++;
        else if (JSON.stringify(impCell) === JSON.stringify(curCell)) same++;
        else conflicts++;
      });
    });
  });

  // Wypełnij info w modalu
  const hasConfig = !!(data.appState);
  const hasArchive = !!(data.archive && data.archive.length);
  document.getElementById('importInfo').innerHTML =
    `<div class="import-stat added">＋ ${added} nowych wpisów (zostaną dodane)</div>` +
    `<div class="import-stat conflict">${conflicts > 0 ? '⚠' : '✓'} ${conflicts} konfliktów (istniejące wpisy)</div>` +
    `<div class="import-stat same">= ${same} identycznych wpisów</div>` +
    `<div class="import-stat same">${hasConfig ? '✓ Zawiera konfigurację szkoły' : '⚠ Brak konfiguracji szkoły'}</div>` +
    `<div class="import-stat same">${hasArchive ? '✓ Zawiera archiwum (' + data.archive.length + ' lat)' : '— Brak archiwum'}</div>`;

  document.getElementById('importModeOverwrite').checked = false;
  document.getElementById('importModeMerge').checked     = true;

  modal.classList.add('show');
}
function closeImportModal() {
  document.getElementById('importModal').classList.remove('show');
  _importData = null;
}
function confirmImport() {
  if (!_importData) return;
  const merge = document.getElementById('importModeMerge').checked;
  const impSched = _importData.schedData || {};

  if (merge) {
    // Scalanie: tylko puste komórki
    Object.keys(impSched).forEach(yk2 => {
      if (!schedData[yk2]) schedData[yk2] = {};
      Object.keys(impSched[yk2]).forEach(dayIdx => {
        if (!schedData[yk2][dayIdx]) schedData[yk2][dayIdx] = {};
        Object.keys(impSched[yk2][dayIdx]).forEach(hr => {
          if (!schedData[yk2][dayIdx][hr]) schedData[yk2][dayIdx][hr] = {};
          Object.keys(impSched[yk2][dayIdx][hr]).forEach(key => {
            const impCell = impSched[yk2][dayIdx][hr][key];
            const curCell = schedData[yk2][dayIdx][hr][key];
            const impFilled = !!(impCell?.teacherAbbr || (impCell?.classes||[]).length || impCell?.className);
            const curFilled = !!(curCell?.teacherAbbr || (curCell?.classes||[]).length || curCell?.className);
            if (impFilled && !curFilled) {
              schedData[yk2][dayIdx][hr][key] = impCell;
            }
          });
        });
      });
    });
    // Przywróć konfigurację i archiwum jeśli lokalnie brak
    if (!appState && _importData.appState) {
      appState = _importData.appState;
    }
    normalizeAppState(appState);
    if (_importData.validFromDates) {
      Object.assign(validFromDates, _importData.validFromDates);
    }
    if (_importData.archive && _importData.archive.length) {
      if (!archive || !archive.length) archive = _importData.archive;
    }
    migrateClassNames(appState);
    persistAll();
    closeImportModal();
    if (appState) {
      mountApp();
    }
    notify('✓ Scalono — dodano brakujące wpisy');
  } else {
    // Nadpisz całkowicie
    schedData = impSched;
    if (_importData.validFromDates) validFromDates = _importData.validFromDates;
    if (_importData.appState) {
      appState = _importData.appState;
    }
    normalizeAppState(appState);
    if (_importData.archive) archive = _importData.archive;
    migrateClassNames(appState);
    persistAll();
    closeImportModal();
    if (appState) {
      mountApp();
    }
    notify('✓ Plan zastąpiony danymi z pliku');
  }
}

// ── Drag & drop na całą aplikację ──
function initImportDragDrop() {
  // drag target: całe body
  let _dragOver = false;

  document.body.addEventListener('dragover', e => {
    e.preventDefault();
    if (!_dragOver) {
      _dragOver = true;
      document.getElementById('dropOverlay').classList.add('show');
    }
  });
  document.body.addEventListener('dragleave', e => {
    if (e.relatedTarget === null || !document.body.contains(e.relatedTarget)) {
      _dragOver = false;
      document.getElementById('dropOverlay').classList.remove('show');
    }
  });
  document.body.addEventListener('drop', e => {
    e.preventDefault();
    _dragOver = false;
    document.getElementById('dropOverlay').classList.remove('show');
    const file = e.dataTransfer.files[0];
    if (file) handleImportFile(file);
  });
}
// ================================================================
//  STORAGE — BEZPIECZNY ZAPIS (QuotaExceededError)
// ================================================================

// Szacuje rozmiar danych w localStorage (bajty)
function storageUsageBytes() {
  let total = 0;
  try {
    for (const key of Object.keys(localStorage)) {
      total += (localStorage.getItem(key) || '').length * 2; // UTF-16
    }
  } catch(e) {}
  return total;
}

// Formatuje bajty na czytelny string
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Bezpieczny setItem — zwraca true/false, bez rzucania wyjątku
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        (e.code && (e.code === 22 || e.code === 1014))) {
      return false;
    }
    throw e; // inny błąd — propaguj
  }
}

// Strategia ratunkowa przy przepełnieniu:
// 1. Usuń szkic kreatora (mały, zbędny po zamknięciu)
// 2. Usuń archiwum lat (może być duże)
// 3. Jeśli nadal brak miejsca — pokaż modal awaryjny
function _handleQuotaExceeded(failedKey) {
  console.warn('[PlanLekcji] QuotaExceededError przy zapisie klucza:', failedKey,
    '| Użycie localStorage:', formatBytes(storageUsageBytes()));

  // Krok 1: usuń szkic kreatora
  const hadDraft = !!localStorage.getItem(DRAFT_KEY);
  if (hadDraft) {
    localStorage.removeItem(DRAFT_KEY);
    notify('⚠ Brak miejsca — usunięto szkic kreatora, by zwolnić pamięć', true);
    // Spróbuj ponownie
    if (safeSetItem(failedKey, _pendingSaveValues[failedKey] || '')) return true;
  }

  // Krok 2: usuń archiwum
  if (archive && archive.length > 0) {
    localStorage.removeItem('sp_archive');
    archive = [];
    notify('⚠ Brak miejsca — usunięto archiwum lat szkolnych, by zwolnić pamięć', true);
    if (safeSetItem(failedKey, _pendingSaveValues[failedKey] || '')) return true;
  }

  // Krok 3: pokaż modal awaryjny
  _showStorageFullModal();
  return false;
}

// Tymczasowy bufor wartości do zapisu (używany przez strategię ratunkową)
let _pendingSaveValues = {};

function _showStorageFullModal() {
  // Stwórz modal awaryjny jeśli nie istnieje
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
          <p>Przeglądarka nie może zapisać danych — magazyn lokalny (<code>localStorage</code>) jest przepełniony.</p>
          <p style="margin-top:10px">Użycie teraz: <strong id="storageUsageInfo">—</strong></p>
          <p style="margin-top:10px;color:var(--yellow)"><strong>Co zrobić?</strong></p>
          <ol style="padding-left:1.2em;margin-top:6px;display:flex;flex-direction:column;gap:6px">
            <li>Kliknij <strong>Eksportuj JSON</strong> poniżej — zapisz kopię zapasową planu na dysku.</li>
            <li>Oczyść dane innych stron w ustawieniach przeglądarki lub przełącz się na inną przeglądarkę.</li>
            <li>Po eksporcie możesz wczytać plan z pliku w dowolnym momencie.</li>
          </ol>
          <p style="margin-top:12px;font-size:0.75rem;color:var(--text-muted)">
            Limit localStorage wynosi zwykle 5–10 MB na domenę.
          </p>
        </div>
        <div class="modal-footer" style="gap:8px">
          <button class="btn btn-green" onclick="exportJSON();document.getElementById('storageFullModal').classList.remove('show')">
            💾 Eksportuj JSON
          </button>
          <button class="btn btn-ghost" onclick="document.getElementById('storageFullModal').classList.remove('show')">
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
}

function persistAll() {
  if (_demoMode) return; // tryb demo — nie zapisuj do localStorage

  // Serializuj wszystkie dane z góry (raz, nie kilka razy przy retry)
  const schedJson   = JSON.stringify(schedData);
  const vfdJson     = JSON.stringify(validFromDates);
  const archiveJson = JSON.stringify(archive);
  const stateJson   = appState ? JSON.stringify(appState) : null;

  // Bufor dla strategii ratunkowej
  _pendingSaveValues = {
    'sp_sched':   schedJson,
    'sp_vfdates': vfdJson,
    'sp_archive': archiveJson,
  };
  if (stateJson) _pendingSaveValues['sp_active'] = stateJson;

  // Zapis z obsługą błędów przepełnienia
  const keys = [
    ['sp_sched',   schedJson],
    ['sp_vfdates', vfdJson],
    ['sp_archive', archiveJson],
    ...(stateJson ? [['sp_active', stateJson]] : []),
  ];

  for (const [key, value] of keys) {
    if (!safeSetItem(key, value)) {
      // Quota — spróbuj ratunkowej strategii
      const recovered = _handleQuotaExceeded(key);
      if (recovered) {
        // Ponów zapis pozostałych kluczy
        for (const [k2, v2] of keys) {
          safeSetItem(k2, v2); // błędy ignorujemy — już obsłużone
        }
      }
      _pendingSaveValues = {};
      return; // zakończ — błąd zgłoszony przez modal
    }
  }

  if (!stateJson) localStorage.removeItem('sp_active');
  _pendingSaveValues = {};
}

function saveData() {
  if (!appState) return;
  if (_demoMode) { notify('⚠ Tryb demo — dane nie są zapisywane', true); return; }
  validFromDates[appState.yearKey] = validFromDates[appState.yearKey] || {};
  validFromDates[appState.yearKey][currentDay] = document.getElementById('validFrom').value;
  persistAll();
  notify('✓ Zapisano');
  sbSet('Dane zapisane lokalnie');
}

// ================================================================
//  SAMPLE DATA
// ================================================================

function openWizardNewYear() { // BUG-09 fix: usunięto nieużywany parametr preload
  wStep = 0;
  wAssignments = {};
  wSubjects = structuredClone(appState?.subjects || []);
  wTimeslots = structuredClone(
    appState?.timeslots?.length
      ? appState.timeslots
      : buildTimeslotsFromHours(appState?.hours || [], [])
  );

  if (appState) {
    // Nowy rok — przepisz dane z bieżącego roku (budynki, klasy, nauczyciele)
    wBuildings = structuredClone(appState.buildings || [{ name: '', address: '' }]);
    wFloors = structuredClone(appState.floors || []);
    wClasses = structuredClone(appState.classes || []);
    wTeachers = structuredClone(appState.teachers || []);
    wSubjects = structuredClone(appState.subjects || []);
    wTimeslots = structuredClone(appState.timeslots || []);
    document.getElementById('wSchoolName').value = appState.school?.name || '';
    document.getElementById('wSchoolShort').value = appState.school?.short || '';
    document.getElementById('wSchoolPhone').value = appState.school?.phone || '';
    document.getElementById('wSchoolWeb').value = appState.school?.web || '';
  } else {
    // Pierwsze uruchomienie — puste pola
    wBuildings = [{ name: '', address: '' }];
    wFloors = [];
    wClasses = [];
    wTeachers = [];
  }

  const now = new Date();
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear()-1;
  document.getElementById('wYear').value = `${y}/${y+1}`;
  document.getElementById('wTitleYear').textContent = `${y}/${y+1}`;
  document.getElementById('wHours').value = appState?.hours?.join(',') || '0,1,2,3,4,5,6,7,8,9,10';

  renderBuildingList();
  renderFloorList();
  renderClassGrid();
  renderTeacherList();
  updateWizardStep();
  // Sprawdź czy istnieje szkic — jeśli tak pokaż modal zamiast od razu otwierać
  if (wizardCheckDraft()) {
    // Modal przejął kontrolę — nie otwieraj overlaya jeszcze
    startWizardAutosave();
    return;
  }
  document.getElementById('wizardOverlay').classList.add('show');
  startWizardAutosave();
}

function openWizardFirst() { showWelcomeScreen(); }

function wizardNext() {
  if (wStep === 0) {
    const name = document.getElementById('wSchoolName').value.trim();
    if (!name) { notify('⚠ Podaj nazwę szkoły', true); return; }
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
    // Duplikat = ten sam colKey (fFI_sSI_NR) — ta sama sala w tym samym seg i piętrze
    // Sala 1 w Seg A i Sala 1 w Seg B to RÓŻNE sale (różne klucze) — dozwolone
    const seenKeys = new Map(); // colKey → etykieta czytelna
    let dupKeys = [], emptyFound = false;
    wFloors.forEach((fl, fi) => fl.segments.forEach((sg, si) => sg.rooms.forEach((r, ri) => {
      const n = (r.num || '').trim();
      if (!n) { emptyFound = true; return; }
      const key      = `f${fi}_s${si}_${n}`;
      const label    = _roomLabel(fi, si, n);
      const location = `${fl.name || ('Piętro ' + fi)} › ${sg.name || ('Segment ' + si)} › Sala ${n} (skrót: ${label})`;
      if (seenKeys.has(key)) {
        dupKeys.push({ key, loc1: seenKeys.get(key), loc2: location });
      } else {
        seenKeys.set(key, location);
      }
    })));
    if (emptyFound) { notify('⚠ Każda sala musi mieć numer', true); return; }
    if (dupKeys.length) {
      const first = dupKeys[0];
      notify(
        `⚠ Skrót sali powtarza się:
` +
        `  • ${first.loc1}
  • ${first.loc2}
` +
        `W tym samym segmencie numer sali musi być unikalny.`,
        true
      );
      _highlightDuplicateRooms(dupKeys.map(d => d.key));
      return;
    }
  }
  if (wStep === 3) {
    wClasses = getClassesFromDOM();
    if (wClasses.filter(c=>c.name).length === 0) { notify('⚠ Dodaj przynajmniej jedną klasę', true); return; }
  }
  if (wStep === 4) {  // BUG-08 fix: usunięto redundantne wołanie init-timeslot (zostaje tylko post-increment poniżej)
    // Przedmioty — opcjonalne, bez walidacji; tylko odśwież listę
    renderSubjectList();
  }
  if (wStep === 5) {
    syncTeachersFromDOM();
    // teachers optional — no validation required
  }
  if (wStep === 6) { finishWizard(); return; }
  wStep++;
  if (wStep === 2) initTimeslotEditor(); // inicjuj timesloty gdy wchodzisz na krok budynków (po godzinach)
  if (wStep === 4) renderSubjectList();  // wyrenderuj listę przy wejściu na krok przedmiotów
  if (wStep === 5) renderTeacherList();  // BUG-A fix: wyrenderuj listę przy wejściu na krok nauczycieli
  if (wStep === 6) renderAssignmentsStep();
  updateWizardStep();
  wpUpdate(wStep);
  wizardSaveDraft(); // autosave przy każdym kroku
}

function wizardBack() { if (wStep > 0) { wStep--; updateWizardStep(); wpUpdate(wStep); wizardSaveDraft(); } }

function updateWizardStep() {
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const stepEl = document.getElementById(`wStep${i}`);
    if (stepEl) stepEl.classList.toggle('active', i === wStep);
    const ws = document.getElementById(`ws${i}`);
    if (!ws) continue;
    ws.className = 'wstep' + (i === wStep ? ' active' : '') + (i < wStep ? ' done' : '');
    const numEl = ws.querySelector('.wstep-num');
    if (numEl) numEl.textContent = i < wStep ? '✓' : i+1;
    if (i < TOTAL_STEPS-1) {
      const wl = document.getElementById(`wl${i}`);
      if (wl) wl.className = 'wstep-line' + (i < wStep ? ' done' : '');
    }
  }
  document.getElementById('wFooterInfo').textContent = `Krok ${wStep+1} z ${TOTAL_STEPS}`;
  document.getElementById('wBtnBack').style.display = wStep > 0 ? 'flex' : 'none';
  document.getElementById('wBtnNext').textContent = wStep === TOTAL_STEPS-1 ? (_wizardEditMode ? '✓ Zapisz zmiany' : '✓ Zakończ i przejdź do planu') : 'Dalej →';
}

// ── Migracja kluczy schedData po zmianie struktury pięter ────────────────────
// Wywoływana z finishWizard gdy user edytuje rok i mogła zmienić kolejność pięter.
// Buduje mapę oldKey → newKey na podstawie numeru sali (unikalny identyfikator sali).
// Jeśli sala o danym numerze istnieje w nowej strukturze pod innym indeksem piętra/segmentu,
// jej klucz jest automatycznie zaktualizowany w schedData — dane nie giną.
function migrateScheduleKeys(oldFloors, newFloors, yearKey) {
  // Zbuduj mapę: numer sali → nowy klucz
  const newKeyByRoomNum = {};
  newFloors.forEach((floor, fi) =>
    floor.segments.forEach((seg, si) =>
      seg.rooms.forEach((room, ri) => {
        const n = (room.num || '').trim();
        const key = n ? `f${fi}_s${si}_${n}` : `f${fi}_s${si}_r${ri}`;
        if (n) newKeyByRoomNum[n] = key; // numer sali → nowy klucz
      })
    )
  );

  // Zbuduj mapę: stary klucz → nowy klucz
  const keyMap = {}; // oldKey → newKey
  let remapped = 0;
  oldFloors.forEach((floor, fi) =>
    floor.segments.forEach((seg, si) =>
      seg.rooms.forEach((room, ri) => {
        const n = (room.num || '').trim();
        const oldKey = n ? `f${fi}_s${si}_${n}` : `f${fi}_s${si}_r${ri}`;
        const newKey = newKeyByRoomNum[n] || oldKey; // jeśli numer istnieje → nowy klucz
        if (oldKey !== newKey) { keyMap[oldKey] = newKey; remapped++; }
      })
    )
  );

  if (!remapped || !schedData[yearKey]) return 0;

  // Zastosuj mapę kluczy w całym schedData dla danego roku
  let updated = 0;
  Object.keys(schedData[yearKey]).forEach(di => {
    Object.keys(schedData[yearKey][di] || {}).forEach(h => {
      const hour = schedData[yearKey][di][h];
      const toRename = Object.keys(hour).filter(k => keyMap[k]);
      toRename.forEach(oldK => {
        const newK = keyMap[oldK];
        if (!hour[newK]) { // nie nadpisuj jeśli nowy klucz już zajęty
          hour[newK] = hour[oldK];
          updated++;
        }
        delete hour[oldK];
      });
    });
  });

  console.log(`[migrateScheduleKeys] ${remapped} kluczy do zmiany → ${updated} wpisów zaktualizowanych`);
  return updated;
}


function finishWizard() {
  syncBuildingsFromDOM();
  syncTeachersFromDOM();
  const yearLabel = document.getElementById('wYear').value.trim();
  const hours = document.getElementById('wHours').value.split(',').map(h=>h.trim()).filter(Boolean).sort((a,b)=>Number(a)-Number(b)); // BUG-B fix: sort numerically
  const classes = getClassesFromDOM(); // already filtered by getClassesFromDOM
  const yearKey = 'y_' + yearLabel.replace(/\//g,'_');
  const school = {
    name: document.getElementById('wSchoolName').value.trim(),
    short: document.getElementById('wSchoolShort').value.trim(),
    phone: document.getElementById('wSchoolPhone').value.trim(),
    web: document.getElementById('wSchoolWeb').value.trim(),
  };
  const teachers = wTeachers.filter(t => t.first || t.last);
  const assignments = getAssignmentsFromDOM();

  if (appState && !_wizardEditMode) {
    // Nowy rok — archiwizuj poprzedni tylko jeśli to nie edycja
    const existing = archive.find(a => a.yearKey === appState.yearKey);
    if (!existing && appState.yearKey !== yearKey) {
      archive.push({ yearKey: appState.yearKey, label: appState.yearLabel, savedAt: new Date().toISOString(), config: structuredClone(appState) });
    }
  }

  const prevHomerooms = appState?.homerooms || {};
  // Zapisz stare piętra PRZED nadpisaniem appState — potrzebne do migracji kluczy
  const prevFloors = _wizardEditMode ? structuredClone(appState?.floors || []) : [];
  const subjects = wSubjects.filter(s => s.name && s.name.trim());
  const timeslots = wTimeslots.filter(t => t.label).map(t => ({label:t.label,start:t.start||'',end:t.end||''}));
  appState = { yearKey, yearLabel, hours, floors: wFloors, buildings: wBuildings, classes, teachers, assignments, subjects, timeslots, days: DAYS_DEFAULT, school, homerooms: prevHomerooms };
  const wasEditMode = _wizardEditMode; // zapamiętaj przed resetem (BUG-03 fix)
  _wizardEditMode = false;

  // Zawsze uzupełnij brakujące godziny i dni (bez kasowania istniejących wpisów)
  if (!schedData[yearKey]) schedData[yearKey] = {};
  DAYS_DEFAULT.forEach((d,i) => {
    if (!schedData[yearKey][i]) schedData[yearKey][i] = {};
    hours.forEach(h => {
      if (!schedData[yearKey][i][h]) schedData[yearKey][i][h] = {};
    });
  });

  // Migracja kluczy schedData gdy edytujemy rok i zmieniono strukturę/kolejność pięter
  if (wasEditMode && prevFloors.length) {
    const migrated = migrateScheduleKeys(prevFloors, wFloors, yearKey);
    if (migrated > 0) notify(`✓ Przeniesiono ${migrated} wpisów planu do zaktualizowanej struktury sal`);
  }
  invalidateColumnCache(); // OPT-02: piętra mogły się zmienić w kreatorze
  persistAll();
  wizardClearDraft();
  stopWizardAutosave();
  document.getElementById('wizardOverlay').classList.remove('show');
  if (!wasEditMode) currentDay = 0; // edycja zachowuje bieżący dzień (BUG-03 fix)
  mountApp();
  const msg = (appState.yearKey === yearKey && document.getElementById('wizardTitle')?.textContent?.includes('Edycja'))
    ? '✓ Zmiany zapisane dla roku ' + yearLabel
    : '🎉 Rok szkolny ' + yearLabel + ' utworzony!';
  notify(msg);
  // Przywróć nagłówek i podtytuł kreatora
  const titleEl2 = document.getElementById('wizardTitle');
  if (titleEl2) titleEl2.innerHTML = 'Nowy rok szkolny<br><span id="wTitleYear">' + esc(yearLabel) + '</span>';
  const subEl2 = document.getElementById('wizardSubtitle');
  if (subEl2) subEl2.textContent = 'Skonfiguruj szkołę, budynki, nauczycieli i klasy — zajmie to tylko chwilę.';
}

// ── Building builder ──
function renderBuildingList() {
  const container = document.getElementById('buildingList');
  container.innerHTML = '';
  wBuildings.forEach((b, bi) => container.appendChild(buildBuildingEl(b, bi)));
}

function buildBuildingEl(b, bi) {
  const div = document.createElement('div');
  div.className = 'building-card';
  const color = BUILDING_COLORS[bi % BUILDING_COLORS.length];
  const letter = BUILDING_LETTERS[bi] || String(bi+1);
  const floorsInBuilding = wFloors.filter(f => f.buildingIdx === bi).length;
  div.innerHTML = `
    <div class="building-card-header">
      <div class="building-letter" style="background:${color}22;color:${color};border:1px solid ${color}55">${letter}</div>
      <div style="display:flex;flex:1;gap:8px;flex-wrap:wrap">
        <input class="building-name-inp" data-bi="${bi}" value="${esc(b.name)}" placeholder="Nazwa budynku"
          oninput="wBuildings[${bi}].name=this.value; updateFloorBuildingSelects()">
        <input class="building-addr-inp" data-bi="${bi}" value="${esc(b.address||'')}" placeholder="Adres budynku"
          oninput="wBuildings[${bi}].address=this.value">
      </div>
      ${wBuildings.length > 1 ? `<button class="icon-btn danger" onclick="removeBuilding(${bi})">🗑</button>` : ''}
    </div>
    <div class="building-floor-count">Przypisane piętra/strefy: <strong style="color:${color}">${floorsInBuilding}</strong></div>`;
  return div;
}

function addBuilding() {
  wBuildings.push({ name: '', address: '' });
  renderBuildingList(); updateFloorBuildingSelects();
}
function removeBuilding(bi) {
  if (wBuildings.length <= 1) { notify('⚠ Musi pozostać przynajmniej jeden budynek', true); return; }
  wFloors.forEach(f => { if (f.buildingIdx === bi) f.buildingIdx = 0; else if (f.buildingIdx > bi) f.buildingIdx--; });
  wBuildings.splice(bi, 1);
  renderBuildingList(); renderFloorList();
}
function syncBuildingsFromDOM() {
  document.querySelectorAll('.building-name-inp').forEach(el => { const bi=+el.dataset.bi; if(wBuildings[bi]) wBuildings[bi].name=el.value; });
  document.querySelectorAll('.building-addr-inp').forEach(el => { const bi=+el.dataset.bi; if(wBuildings[bi]) wBuildings[bi].address=el.value; });
}
function updateFloorBuildingSelects() {
  // Dropdown budynku przy piętrach usunięty — piętra są teraz pogrupowane w sekcje budynków
  // Funkcja zachowana dla kompatybilności, teraz tylko odświeża nazwy w nagłówkach sekcji
  renderFloorList();
}

// ── Floor builder — piętra pogrupowane pod budynkami ──
function renderFloorList() {
  const container = document.getElementById('floorList');
  container.innerHTML = '';

  if (wBuildings.length === 0) return;

  wBuildings.forEach((bld, bi) => {
    const bldFloors = wFloors
      .map((f, fi) => ({ f, fi }))
      .filter(({ f }) => (f.buildingIdx || 0) === bi);

    const bldSection = document.createElement('div');
    bldSection.className = 'floor-building-section';

    // Nagłówek sekcji budynku
    const bldColor = BUILDING_COLORS[bi % BUILDING_COLORS.length];
    const bldLetter = BUILDING_LETTERS[bi] || String(bi + 1);
    bldSection.innerHTML = `<div class="floor-bld-header">
      <span class="floor-bld-badge" style="background:${bldColor}">${bldLetter}</span>
      <span class="floor-bld-name">${esc(bld.name || 'Budynek ' + (bi + 1))}</span>
      <button class="add-floor-btn" onclick="addFloorForBuilding(${bi})" style="margin-left:auto">＋ Dodaj piętro</button>
    </div>`;

    if (bldFloors.length === 0) {
      // Pusty stan — wyraźna informacja
      const empty = document.createElement('div');
      empty.className = 'floor-bld-empty';
      empty.innerHTML = `<span>Brak pięter / stref — kliknij „＋ Dodaj piętro" aby zacząć</span>`;
      bldSection.appendChild(empty);
    } else {
      bldFloors.forEach(({ f, fi }) => {
        bldSection.appendChild(buildFloorEl(f, fi));
      });
    }

    container.appendChild(bldSection);
  });
}

function buildFloorEl(floor, fi) {
  const div = document.createElement('div');
  div.className = 'floor-item';
  const segsHtml = floor.segments.map((seg,si) => `
    <div class="segment-item">
      <div class="segment-header">
        <span style="font-size:0.65rem;color:var(--text-dim);font-family:var(--mono);flex-shrink:0">SEG</span>
        <input class="seg-name-input" value="${esc(seg.name)}" placeholder="Nazwa segmentu (opcjonalnie)" onchange="wFloors[${fi}].segments[${si}].name=this.value">
        <button class="icon-btn danger" onclick="removeSeg(${fi},${si})">✕</button>
      </div>
      <div class="rooms-row">
        ${seg.rooms.map((r,ri) => buildRoomChip(fi,si,ri,r)).join('')}
        <button class="add-room-btn" onclick="addRoom(${fi},${si})">＋ sala</button>
      </div>
    </div>`).join('');
  div.innerHTML = `
    <div class="floor-item-header">
      <div class="floor-color-dot" style="background:${floor.color}"></div>
      <input class="floor-name-input" value="${esc(floor.name)}" placeholder="Nazwa piętra / strefy" onchange="wFloors[${fi}].name=this.value">
      <div class="floor-actions"><button class="icon-btn danger" onclick="removeFloor(${fi})" title="Usuń piętro">🗑</button></div>
    </div>
    <div class="segments-area">
      <div class="segments-label">Segmenty</div>
      <div class="segment-list">${segsHtml}</div>
      <button class="add-segment-btn" onclick="addSegment(${fi})">＋ Dodaj segment</button>
    </div>`;
  return div;
}
function buildRoomChip(fi,si,ri,r) {
  const label = _roomLabel(fi, si, r.num || '');
  return `<div class="room-chip" data-room-num="${esc(r.num)}">Sala <input class="room-chip-name"
    value="${esc(r.num)}" placeholder="nr"
    data-fi="${fi}" data-si="${si}" data-ri="${ri}"
    onchange="wFloors[${fi}].segments[${si}].rooms[${ri}].num=this.value.trim(); _validateRoomNums()"
    oninput="wFloors[${fi}].segments[${si}].rooms[${ri}].num=this.value; _validateRoomNums()"
    title="Skrót: ${label} — numer musi być unikalny w obrębie piętro+segment"
  ><input class="room-chip-sub" value="${esc(r.sub||'')}" placeholder="opis…" onchange="wFloors[${fi}].segments[${si}].rooms[${ri}].sub=this.value"><button class="chip-del" onclick="removeRoom(${fi},${si},${ri})">✕</button></div>`;
}
// Walidacja sal w czasie rzeczywistym — duplikat to ta sama kombinacja piętro+segment+nr
// (colKey = fFI_sSI_NR), więc Sala 1 w Seg A i Sala 1 w Seg B są różnymi salami — OK
function _validateRoomNums() {
  const seenKeys = new Map(); // colKey → input element
  const dupKeys  = new Set();

  wFloors.forEach((floor, fi) => {
    floor.segments.forEach((seg, si) => {
      seg.rooms.forEach((room, ri) => {
        const n   = (room.num || '').trim();
        if (!n) return;
        const key = `f${fi}_s${si}_${n}`;
        if (seenKeys.has(key)) {
          dupKeys.add(key);
          seenKeys.get(key).classList.add('room-dup');
        } else {
          // Znajdź input odpowiadający temu room
          const inp = document.querySelector(
            `.room-chip-name[data-fi="${fi}"][data-si="${si}"][data-ri="${ri}"]`
          );
          if (inp) seenKeys.set(key, inp);
        }
      });
    });
  });

  document.querySelectorAll('.room-chip-name').forEach(inp => {
    const fi = +inp.dataset.fi, si = +inp.dataset.si, ri = +inp.dataset.ri;
    const n  = (inp.value || '').trim();
    const key = `f${fi}_s${si}_${n}`;
    if (dupKeys.has(key)) {
      inp.classList.add('room-dup');
      inp.title = `Skrót sali „${_roomLabel(fi,si,n)}" już istnieje w tym samym segmencie!`;
    } else {
      inp.classList.remove('room-dup');
      inp.title = `Skrót: ${_roomLabel(fi,si,n)} — unikalny w obrębie piętro+segment`;
    }
  });
  return dupKeys.size === 0;
}

// Podświetl duplikaty colKey (po kliknięciu Dalej)
function _highlightDuplicateRooms(dupKeys) {
  const dupSet = new Set(dupKeys);
  wFloors.forEach((floor, fi) => {
    floor.segments.forEach((seg, si) => {
      seg.rooms.forEach((room, ri) => {
        const n = (room.num || '').trim();
        if (dupSet.has(`f${fi}_s${si}_${n}`)) {
          const inp = document.querySelector(
            `.room-chip-name[data-fi="${fi}"][data-si="${si}"][data-ri="${ri}"]`
          );
          if (inp) {
            inp.classList.add('room-dup');
            inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });
  });
}

// Zwraca czytelną etykietę sali np. "0A1", "1B3"
function _roomLabel(fi, si, num) {
  const floorNum  = fi;
  const segLetter = String.fromCharCode(65 + si); // A, B, C…
  return `${floorNum}${segLetter}${num}`;
}


function addFloor() {
  // Jeśli jest tylko jeden budynek — dodaj do niego
  addFloorForBuilding(0);
}
function addFloorForBuilding(bi) {
  const ci = wFloors.length % FLOOR_COLORS.length;
  const floorsInBld = wFloors.filter(f => (f.buildingIdx || 0) === bi).length;
  const bldName = wBuildings[bi]?.name || ('Budynek ' + (bi + 1));
  wFloors.push({
    name: `${bldName} — piętro ${floorsInBld}`,
    color: FLOOR_COLORS[ci],
    buildingIdx: bi,
    segments: [{ name: 'Segment A', rooms: [{ num: '1', sub: '' }] }]
  });
  renderFloorList();
  // Scroll do nowego piętra
  setTimeout(() => {
    const sections = document.querySelectorAll('.floor-building-section');
    if (sections[bi]) {
      const items = sections[bi].querySelectorAll('.floor-item');
      const last = items[items.length - 1];
      if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 80);
}
function removeFloor(fi) { wFloors.splice(fi,1); renderFloorList(); renderBuildingList(); }
function addSegment(fi) { wFloors[fi].segments.push({name:'',rooms:[{num:'1',sub:''}]}); renderFloorList(); }
function removeSeg(fi,si) { wFloors[fi].segments.splice(si,1); renderFloorList(); }
function addRoom(fi,si) {
  // Per-segment auto-increment: numer unikalny w obrębie tego segmentu
  // (Sala 1 w Seg A i Sala 1 w Seg B są dozwolone — różne colKey)
  const existing = wFloors[fi].segments[si].rooms;
  const nums = existing.map(r => parseInt(r.num)).filter(n => n > 0);
  const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
  wFloors[fi].segments[si].rooms.push({ num: String(nextNum), sub: '' });
  renderFloorList();
}
function removeRoom(fi,si,ri) { wFloors[fi].segments[si].rooms.splice(ri,1); renderFloorList(); }

// ── Classes ──

// Buduje opcje selecta "klasa bazowa" dla wiersza i w renderClassGrid
function _baseClassOptions(currentBaseClass, selfName) {
  // Wszystkie unikalne nazwy klas INNE niż bieżąca (bez duplikatów)
  const names = [...new Set(wClasses.map(c => c.name).filter(n => n && n !== selfName))];
  names.sort((a,b) => a.localeCompare(b,'pl',{sensitivity:'base'}));
  const opts = names.map(n =>
    `<option value="${esc(n)}"${n === currentBaseClass ? ' selected' : ''}>${esc(n)}</option>`
  ).join('');
  return `<option value=""${!currentBaseClass ? ' selected' : ''}>— (samodzielna)</option>${opts}`;
}

function renderClassGrid() {
  document.getElementById('classGrid').innerHTML = wClasses.map((c,i) => {
    const isSubgroup = c.group && c.group.trim().toLowerCase() !== 'cała klasa' && c.group.trim() !== '';
    return `
    <div class="class-item${isSubgroup ? ' class-item-subgroup' : ''}">
      <input class="class-input" value="${esc(c.name)}" placeholder="np. 1A"
        oninput="wClasses[${i}].name=normalizeClassName(this.value);this.value=wClasses[${i}].name;this.setSelectionRange(this.value.length,this.value.length); wClassAutoAbbr(${i});renderClassGrid()">
      <input class="class-abbr-inp" id="wca${i}" value="${esc(c.abbr)}" placeholder="skrót (auto)" maxlength="12"
        oninput="wClasses[${i}].abbr=this.value.toUpperCase();this.value=this.value.toUpperCase()"
        title="Edytuj ręcznie aby nadpisać auto-skrót">
      <input class="class-group-inp" value="${esc(c.group)}" placeholder="np. gr1 lub cała klasa"
        oninput="wClasses[${i}].group=this.value; wClassAutoAbbr(${i}); renderClassGrid()">
      ${isSubgroup
        ? `<select class="class-base-sel" title="Klasa bazowa — plan widoku Klasa agreguje po tym polu"
              onchange="wClasses[${i}].baseClass=this.value">
            ${_baseClassOptions(c.baseClass||'', c.name)}
          </select>`
        : `<div class="class-base-placeholder" title="Klasa samodzielna — nie należy do żadnej grupy nadrzędnej"></div>`
      }
      <button class="icon-btn danger" onclick="removeClassAt(${i})">✕</button>
    </div>`;
  }).join('');
  updateClassCountBadge();
}

function wClassAutoAbbr(i) {
  const cls = wClasses[i];
  if (!cls) return;
  const generated = autoClassAbbr(cls.name, cls.group);
  cls.abbr = generated;
  // Zaktualizuj input jeśli istnieje
  const inp = document.getElementById('wca' + i);
  if (inp) { inp.value = generated; }
}
function addClass() {
  wClasses.push({name:'', abbr:'', group:'cała klasa', baseClass:''});
  renderClassGrid();
  document.querySelectorAll('.class-input')[wClasses.length-1]?.focus();
}
function removeClassAt(i) { wClasses.splice(i,1); renderClassGrid(); }
function normalizeClassName(name) {
  name = (name || '').trim();
  // "1a" → "1A", "1abc" → "1ABC", "ang" → "Ang"
  const m = name.match(/^(\d+)([a-zA-Z\u00C0-\u017E]*)(.*)$/);
  if (m) return m[1] + m[2].toUpperCase() + m[3];
  return name ? name[0].toUpperCase() + name.slice(1) : name;
}

function migrateClassNames(state) {
  if (!state || !Array.isArray(state.classes)) return;
  state.classes = state.classes.map(cl => ({
    ...cl,
    name: normalizeClassName(cl.name || ''),
    abbr: (cl.abbr || '').toUpperCase(),
    baseClass: cl.baseClass ?? '' // migracja: stare dane nie mają pola baseClass
  }));
}

function getClassesFromDOM() {
  // sync from DOM before returning
  document.querySelectorAll('.class-item').forEach((row,i) => {
    if (!wClasses[i]) return;
    const inps = row.querySelectorAll('input');
    wClasses[i].name      = normalizeClassName(inps[0].value);
    wClasses[i].abbr      = inps[1].value.trim().toUpperCase();
    wClasses[i].group     = inps[2].value.trim();
    const bcSel = row.querySelector('.class-base-sel');
    wClasses[i].baseClass = bcSel ? bcSel.value : '';
  });
  return wClasses.filter(c => c.name);
}
function clearAllClasses() {
  if (wClasses.length === 0) return;
  showConfirm({
    message: 'Usunąć wszystkie klasy z listy?',
    confirmLabel: '🗑 Usuń wszystkie',
    danger: true,
    onConfirm: () => { wClasses = []; renderClassGrid(); notify('🗑 Lista klas wyczyszczona'); }
  });
}
function updateClassCountBadge() {
  const b = document.getElementById('classCountBadge');
  if (b) b.textContent = wClasses.filter(c=>c.name).length + ' wpisów';
}

// ── Class/group import from TXT ──
function handleClassImportFile(input) {
  const file = input.files[0]; if (!file) return;
  readClassTxtFile(file); input.value='';
}
function handleClassImportDrop(e) {
  e.preventDefault();
  document.getElementById('classImportDropZone').classList.remove('drag-over');
  const file = [...e.dataTransfer.files].find(f=>f.name.endsWith('.txt')||f.type==='text/plain');
  if (!file) { notify('⚠ Wybierz plik .txt', true); return; }
  readClassTxtFile(file);
}
function readClassTxtFile(file) {
  const reader = new FileReader();
  reader.onload = e => importClassesFromText(e.target.result);
  reader.onerror = () => notify('⚠ Błąd odczytu pliku', true);
  reader.readAsText(file, 'UTF-8');
}
function importClassesFromText(text) {
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let added=0, skipped=0, errors=[];

  lines.forEach((line, idx) => {
    if (/^[-=_#*]+$/.test(line)) { skipped++; return; }
    // support both ; and , as separator
    const sep = line.includes(';') ? ';' : ',';
    const parts = line.split(sep).map(p=>p.trim());

    if (parts.length < 2) {
      errors.push(`Linia ${idx+1}: "${line}" — za mało pól (wymagane: klasa;skrót;grupa)`);
      skipped++; return;
    }

    const name  = parts[0] || '';
    const abbr  = (parts[1] || name).toUpperCase();
    const group = parts[2] || 'cała klasa';

    if (!name) { skipped++; return; }

    // check duplicate (same name + group)
    const exists = wClasses.some(c =>
      c.name.toLowerCase()===name.toLowerCase() &&
      c.group.toLowerCase()===group.toLowerCase()
    );
    if (exists) { skipped++; return; }

    wClasses.push({name, abbr, group});
    added++;
  });

  renderClassGrid();
  updateClassCountBadge();

  const preview = document.getElementById('classImportPreview');
  let html = `<strong>+${added}</strong> wpisów zaimportowano`;
  if (skipped) html += ` · ${skipped} pominięto`;
  if (errors.length) html += `<div class="import-err" style="margin-top:6px">${errors.slice(0,3).map(e=>'⚠ '+esc(e)).join('<br>')}</div>`;
  preview.innerHTML = html;
  preview.classList.add('show');
  setTimeout(()=>preview.classList.remove('show'), 6000);

  if (added>0) notify('✓ Zaimportowano '+added+' wpisów klas');
  else notify('⚠ Brak nowych wpisów do dodania', true);
}

// ── Teachers ──
function renderTeacherList() {
  const container = document.getElementById('teacherList');
  container.innerHTML = wTeachers.map((t,i) => `
    <div class="teacher-row" id="trow_${i}">
      <input class="teacher-inp" placeholder="Imię" value="${esc(t.first)}"
        oninput="wTeachers[${i}].first=this.value; autoAbbr(${i})">
      <input class="teacher-inp" placeholder="Nazwisko (lub Nazwisko-Człon2)" value="${esc(t.last)}"
        oninput="wTeachers[${i}].last=this.value; autoAbbr(${i})">
      <input class="teacher-abbr-inp" placeholder="Skrót" value="${esc(t.abbr)}" maxlength="6"
        oninput="wTeachers[${i}].abbr=this.value.toUpperCase(); this.value=this.value.toUpperCase()"
        title="Generowany automatycznie, możesz edytować ręcznie">
      <button class="icon-btn danger" onclick="removeTeacher(${i})">🗑</button>
    </div>`).join('');
  updateTeacherCountBadge();
}

function addTeacher() {
  wTeachers.push({ first: '', last: '', abbr: '' });
  renderTeacherList();
  // focus first input of new row
  const rows = document.querySelectorAll('.teacher-row');
  rows[rows.length-1]?.querySelector('.teacher-inp')?.focus();
  updateTeacherCountBadge();
}

function removeTeacher(i) {
  wTeachers.splice(i, 1);
  renderTeacherList();
}

// ── Teacher import from TXT ──


function handleImportDrop(e) {
  e.preventDefault();
  document.getElementById('importDropZone').classList.remove('drag-over');
  const file = [...e.dataTransfer.files].find(f => f.name.endsWith('.txt') || f.type === 'text/plain');
  if (!file) { notify('⚠ Wybierz plik .txt', true); return; }
  readTxtFile(file);
}

function readTxtFile(file) {
  const reader = new FileReader();
  reader.onload = e => importTeachersFromText(e.target.result);
  reader.onerror = () => notify('⚠ Błąd odczytu pliku', true);
  reader.readAsText(file, 'UTF-8');
}

function importTeachersFromText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let added = 0, skipped = 0, errors = [];

  lines.forEach((line, idx) => {
    // skip lines that look like headers or separators
    if (/^[-=_#*]+$/.test(line)) { skipped++; return; }

    const parts = line.split(/\s+/);
    if (parts.length < 2) {
      errors.push(`Linia ${idx+1}: "${line}" — brak imienia lub nazwiska`);
      skipped++;
      return;
    }

    const first = parts[0];
    // everything after first word = surname (handles double-barreled surnames with space)
    const last = parts.slice(1).join(' ');

    // check duplicate (same first+last)
    const exists = wTeachers.some(t =>
      t.first.toLowerCase() === first.toLowerCase() &&
      t.last.toLowerCase() === last.toLowerCase()
    );
    if (exists) { skipped++; return; }

    const existingAbbrs = wTeachers.map(t => t.abbr).filter(Boolean);
    const abbr = ensureUniqueAbbr(genAbbr(first, last), existingAbbrs);
    wTeachers.push({ first, last, abbr });
    added++;
  });

  renderTeacherList();
  updateTeacherCountBadge();

  // Show preview summary
  const preview = document.getElementById('importPreview');
  let html = `<strong>+${added}</strong> nauczycieli zaimportowano`;
  if (skipped) html += ` · ${skipped} pominięto (duplikaty/błędy)`;
  if (errors.length) {
    html += `<div class="import-err" style="margin-top:6px">${errors.slice(0,3).map(e => '⚠ '+esc(e)).join('<br>')}</div>`;
    if (errors.length > 3) html += `<div class="import-err">…i ${errors.length-3} więcej błędów</div>`;
  }
  preview.innerHTML = html;
  preview.classList.add('show');
  setTimeout(() => preview.classList.remove('show'), 6000);

  if (added > 0) notify(`✓ Zaimportowano ${added} nauczycieli`);
  else notify('⚠ Brak nowych nauczycieli do dodania', true);
}

function clearAllTeachers() {
  if (wTeachers.length === 0) return;
  showConfirm({
    message: `Usunąć wszystkich <strong>${wTeachers.length}</strong> nauczycieli z listy?`,
    confirmLabel: '🗑 Usuń wszystkich',
    danger: true,
    onConfirm: () => {
      wTeachers = [];
      renderTeacherList();
      updateTeacherCountBadge();
      notify('🗑 Lista nauczycieli wyczyszczona');
    }
  });
}

function updateTeacherCountBadge() {
  const badge = document.getElementById('teacherCountBadge');
  if (badge) badge.textContent = `${wTeachers.length} nauczyciel${wTeachers.length === 1 ? '' : wTeachers.length < 5 ? 'i' : 'i'}`;
}

function autoAbbr(i) {
  const t = wTeachers[i];
  // only auto-generate if abbr is still "pristine" (matches previous auto or is empty)
  const currentAuto = genAbbr(t.first, t.last);
  const otherAbbrs = wTeachers.filter((_,j)=>j!==i).map(x=>x.abbr).filter(Boolean);
  const unique = ensureUniqueAbbr(currentAuto, otherAbbrs);
  wTeachers[i].abbr = unique;
  const row = document.getElementById(`trow_${i}`);
  if (row) row.querySelectorAll('.teacher-abbr-inp')[0].value = unique;
}

function syncTeachersFromDOM() {
  document.querySelectorAll('.teacher-row').forEach((row, i) => {
    const inputs = row.querySelectorAll('input');
    if (wTeachers[i]) {
      wTeachers[i].first = inputs[0].value.trim();
      wTeachers[i].last = inputs[1].value.trim();
      wTeachers[i].abbr = inputs[2].value.trim().toUpperCase();
    }
  });
  wTeachers = wTeachers.filter(t => t.first || t.last);
}

// ── Assignments ──
function renderAssignmentsStep() {
  currentAssignDay = 0;
  wClasses = getClassesFromDOM().filter(c=>c.name);
  const tabsEl = document.getElementById('assignmentsTabs');
  const days = appState?.days || DAYS_DEFAULT;
  tabsEl.innerHTML = days.map((d,i) =>
    `<button class="btn ${i===0?'btn-primary':'btn-ghost'}" style="padding:5px 12px;font-size:0.75rem" onclick="switchAssignDay(${i})">${esc(d)}</button>`).join('');
  renderAssignTable();
}
function switchAssignDay(idx) {
  currentAssignDay = idx;
  document.querySelectorAll('#assignmentsTabs button').forEach((b,i) => {
    b.className = `btn ${i===idx?'btn-primary':'btn-ghost'}`;
    b.style.cssText = 'padding:5px 12px;font-size:0.75rem';
  });
  renderAssignTable();
}
function renderAssignTable() {
  const tbl = document.getElementById('assignmentsTable');
  const cols = flattenColumns(wFloors);
  // Build options grouped by class name
  // BUG-06 fix: buduj opcje per-sala z poprawnym `selected`, nie przez fragile String.replace()
  const classEntries = [{ val: '', label: '—' }];
  const seen = new Set(['']);
  wClasses.filter(c=>c.name).forEach(c => {
    const val = c.abbr || c.name;
    const label = c.group && c.group !== c.name ? `${c.name} — ${c.group}` : c.name;
    if (!seen.has(val)) { seen.add(val); classEntries.push({ val, label }); }
  });

  function buildClassOptions(savedVal) {
    return classEntries.map(e =>
      `<option value="${esc(e.val)}"${e.val === savedVal ? ' selected' : ''}>${esc(e.label)}</option>`
    ).join('');
  }

  if (!cols.length) { tbl.innerHTML='<tr><td style="padding:20px;color:var(--text-muted)">Brak sal</td></tr>'; return; }
  tbl.innerHTML = '<tr><th>Budynek</th><th>Piętro</th><th>Segment</th><th>Sala</th><th>Klasa</th></tr>' +
    cols.map(col => {
      const key = colKey(col);
      const saved = (wAssignments[currentAssignDay]||{})[key]||'';
      const bld = wBuildings[col.floor.buildingIdx||0];
      const bldColor = BUILDING_COLORS[(col.floor.buildingIdx||0) % BUILDING_COLORS.length];
      return `<tr>
        <td style="font-size:0.68rem;font-weight:700;color:${bldColor};padding:5px 8px">${esc(bld?.name||'—')}</td>
        <td style="font-size:0.68rem;color:${col.floor.color};font-weight:700;padding:5px 8px">${esc(col.floor.name)}</td>
        <td style="font-size:0.68rem;color:var(--text-muted);padding:5px 8px">${esc(col.seg.name)}</td>
        <td style="font-family:var(--mono);font-size:0.72rem;color:var(--accent);padding:5px 8px">Sala ${esc(col.room.num)}</td>
        <td><select class="assign-select" onchange="setAssign(${currentAssignDay},'${key}',this.value)">${buildClassOptions(saved)}</select></td>
      </tr>`;
    }).join('');
}
function setAssign(dayIdx, key, val) { if (!wAssignments[dayIdx]) wAssignments[dayIdx]={}; wAssignments[dayIdx][key]=val; }
function getAssignmentsFromDOM() { return wAssignments; }

// ================================================================
//  COLUMN UTILS
// ================================================================
function colKey(col) { const n = (col.room.num||'').trim(); return n ? `f${col.floorIdx}_s${col.segIdx}_${n}` : `f${col.floorIdx}_s${col.segIdx}_r${col.roomIdx}`; }

// OPT-02: Memoizowany flattenColumns — cache kasowany po zmianach pięter
let _flatColsCache = null;
let _flatColsFloorRef = null; // referencja do tablicy floors przy ostatnim przeliczeniu

function flattenColumns(floors) {
  // Invaliduj jeśli zmienił się obiekt floors (nowa referencja = edycja kreatora lub mount)
  if (_flatColsCache && _flatColsFloorRef === floors) return _flatColsCache;
  const cols = [];
  floors.forEach((floor,fi) => floor.segments.forEach((seg,si) => seg.rooms.forEach((room,ri) => cols.push({floorIdx:fi,segIdx:si,roomIdx:ri,floor,seg,room}))));
  _flatColsCache    = cols;
  _flatColsFloorRef = floors;
  return cols;
}

// Wywołaj po każdej zmianie struktury sal (kreator, mountApp)
function invalidateColumnCache() {
  _flatColsCache    = null;
  _flatColsFloorRef = null;
}

// ================================================================
//  TEACHER HELPERS
// ================================================================
function getTeacherByAbbr(abbr) {
  return (appState?.teachers||[]).find(t => t.abbr === abbr) || null;
}
function teacherDisplayName(t) {
  if (!t) return '';
  return [t.first, t.last].filter(Boolean).join(' ');
}
function resolveClassName(abbr) {
  // Returns "KlasaName — Grupa" for tooltip
  const found = (appState?.classes||[]).find(c => (c.abbr||c.name) === abbr);
  if (!found) return abbr;
  return found.group && found.group.toLowerCase() !== 'cała klasa'
    ? `${found.name} — ${found.group}`
    : found.name;
}

function buildTeacherSelectOptions(selectedAbbr) {
  const teachers = (appState?.teachers || [])
    .slice()
    .sort((a,b) => (a.last||'').localeCompare(b.last||'', 'pl', {sensitivity:'base'})
                || (a.first||'').localeCompare(b.first||'', 'pl', {sensitivity:'base'}));
  let opts = '<option value="">— brak —</option>';
  teachers.forEach(t => {
    const name = teacherDisplayName(t);
    const sel = t.abbr === selectedAbbr ? ' selected' : '';
    opts += `<option value="${esc(t.abbr)}"${sel}>${esc(t.abbr)} — ${esc(name)}</option>`;
  });
  return opts;
}

function buildClassSelectOptions(selectedVal) {
  const classes = appState?.classes || [];
  let opts = '<option value="">— brak —</option>';
  // Grupuj po nazwie klasy, posortowane alfabetycznie
  const byClass = {};
  classes.filter(c=>c.name).forEach(c => {
    if (!byClass[c.name]) byClass[c.name] = [];
    byClass[c.name].push(c);
  });
  // Sortuj nazwy klas alfabetycznie (naturalny porządek: 1A < 1B < 2A)
  const sortedNames = Object.keys(byClass).sort((a,b) =>
    a.localeCompare(b, 'pl', {numeric: true, sensitivity: 'base'}));
  sortedNames.forEach(clsName => {
    const entries = byClass[clsName];
    // Sortuj grupy w klasie
    entries.sort((a,b) => (a.group||'').localeCompare(b.group||'', 'pl', {sensitivity:'base'}));
    if (entries.length === 1) {
      const c = entries[0];
      const val = c.abbr || c.name;
      const label = c.group && c.group.toLowerCase() !== 'cała klasa' ? `${c.name} — ${c.group}` : c.name;
      opts += `<option value="${esc(val)}"${val===selectedVal?' selected':''}>${esc(label)}</option>`;
    } else {
      opts += `<optgroup label="${esc(clsName)}">`;
      entries.forEach(c => {
        const val = c.abbr || c.name;
        const label = c.group || c.name;
        opts += `<option value="${esc(val)}"${val===selectedVal?' selected':''}>${esc(c.name)} — ${esc(label)}</option>`;
      });
      opts += '</optgroup>';
    }
  });
  return opts;
}

// ================================================================
//  MAIN APP
// ================================================================
function mountApp() {
  if (!appState) return;
  invalidateColumnCache(); // OPT-02: przeładowanie aplikacji = nowe piętra
  document.getElementById('appOverlay').classList.add('show');
  document.getElementById('currentYearLabel').textContent = appState.yearLabel;
  document.getElementById('sbYear').textContent = appState.yearLabel;
  const schoolName = appState.school?.name || appState.school?.short || '';
  const snEl = document.getElementById('hmenuSchoolName');
  if (snEl) snEl.textContent = schoolName;
  document.title = `SalePlan — ${schoolName || 'Plan Sal'}`;

  const tabsEl = document.getElementById('dayTabs');
  tabsEl.innerHTML = appState.days.map((d,i) =>
    `<button class="day-btn ${i===0?'active':''}" onclick="switchDay(${i})">${esc(d)}</button>`).join('');

  const vfDates = validFromDates[appState.yearKey] || {};
  document.getElementById('validFrom').value = vfDates[currentDay] || '';

  const yk = appState.yearKey;
  if (!schedData[yk]) schedData[yk]={};
  appState.days.forEach((_,i) => {
    if (!schedData[yk][i]) schedData[yk][i]={};
    appState.hours.forEach(h => { if(!schedData[yk][i][h]) schedData[yk][i][h]={}; });
  });

  renderSchedule();

  // Pokaż przyciski Undo/Redo i zresetuj stos przy każdym montowaniu
  const undoBar = document.getElementById('undoRedoBtns');
  if (undoBar) undoBar.style.display = 'flex';
  _undoStack = [];
  _redoStack = [];
  _undoUpdateUI();

  // Resetuj tryb widoku i wyrenderuj toolbar
  _viewMode   = 'rooms';
  _viewFilter = '';
  _updateViewToolbar(); // pokaże dayTabs, schowa viewModeBtnsTopbar

  // Ustaw wysokość .main po tym jak DOM jest gotowy (rAF gwarantuje że topbar jest widoczny)
  requestAnimationFrame(() => {
    function setMainHeight() {
      const topbar = document.querySelector('.topbar');
      const mainEl = document.querySelector('.main');
      const statusbar = document.querySelector('.statusbar');
      if (topbar && mainEl) {
        const tbH = topbar.offsetHeight || 110;
        const sbH = statusbar?.offsetHeight || 32;
        mainEl.style.height = `calc(100vh - ${tbH}px - ${sbH}px)`;
        mainEl.style.maxHeight = mainEl.style.height;
      }
    }
    setMainHeight();
    if (window._topbarResizeObs) window._topbarResizeObs.disconnect();
    const topbarEl = document.querySelector('.topbar');
    if (topbarEl && typeof ResizeObserver !== 'undefined') {
      window._topbarResizeObs = new ResizeObserver(setMainHeight);
      window._topbarResizeObs.observe(topbarEl);
    }
  });
}

function switchDay(idx) {
  currentDay = idx;
  document.querySelectorAll('.day-btn').forEach((b,i) => b.classList.toggle('active', i===idx));
  const vfDates = validFromDates[appState.yearKey]||{};
  document.getElementById('validFrom').value = vfDates[currentDay]||'';
  renderSchedule();
}



// ================================================================
//  DRAG & DROP KOMÓREK PLANU
// ================================================================
let _dndSrcDay, _dndSrcHour, _dndSrcKey;  // źródło przeciągania

function dndStart(e, day, hour, key) {
  _dndSrcDay  = day;
  _dndSrcHour = hour;
  _dndSrcKey  = key;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', day + '|' + hour + '|' + key);

  // Własny ghost element z podglądem zawartości
  const entry = schedData[appState.yearKey]?.[day]?.[hour]?.[key] || {};
  const clsLabel = (entry.classes && entry.classes.length ? entry.classes : entry.className ? [entry.className] : []).join(', ');
  const ghost = document.createElement('div');
  ghost.className = 'dnd-ghost';
  ghost.id = '_dndGhost';
  ghost.innerHTML = (clsLabel ? `<b>${esc(clsLabel)}</b><br>` : '') +
                    (entry.subject ? esc(subjectAbbr(entry.subject)) + '<br>' : '') +
                    (entry.teacherAbbr ? esc(entry.teacherAbbr) : '');
  ghost.style.left = '-999px';
  ghost.style.top  = '-999px';
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 60, 20);

  // Oznacz źródło
  setTimeout(() => e.target.classList.add('dnd-dragging'), 0);
}

function dndEnd(e) {
  e.target.classList.remove('dnd-dragging');
  const ghost = document.getElementById('_dndGhost');
  if (ghost) ghost.remove();
  // Usuń wszystkie klasy hover
  document.querySelectorAll('.dnd-over, .dnd-over-filled').forEach(el => {
    el.classList.remove('dnd-over', 'dnd-over-filled');
  });
}

function dndOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  const el = e.currentTarget;
  const isFilled = el.classList.contains('filled');
  el.classList.toggle('dnd-over', !isFilled);
  el.classList.toggle('dnd-over-filled', isFilled);
}

function dndLeave(e) {
  e.currentTarget.classList.remove('dnd-over', 'dnd-over-filled');
}

function dndDrop(e, day, hour, key) {
  e.preventDefault();
  e.currentTarget.classList.remove('dnd-over', 'dnd-over-filled');

  // Nie rób nic jeśli upuszczono na siebie
  if (_dndSrcDay === day && _dndSrcHour === hour && _dndSrcKey === key) return;

  const yk = appState.yearKey;
  const srcEntry = schedData[yk]?.[_dndSrcDay]?.[_dndSrcHour]?.[_dndSrcKey];
  if (!srcEntry || (!srcEntry.teacherAbbr && !(srcEntry.classes||[]).length && !srcEntry.className)) return;

  const dstEntry = schedData[yk]?.[day]?.[hour]?.[key];
  const dstFilled = dstEntry && (dstEntry.teacherAbbr || (dstEntry.classes||[]).length || dstEntry.className);

  // Jeśli cel jest wypełniony — zapytaj; inaczej skopiuj od razu
  function _doDrop() {
    undoPush(`DnD → ${key}, godz. ${hour}, ${appState.days[day]}`); // BUG-04 fix
    if (!schedData[yk][day]) schedData[yk][day] = {};
    if (!schedData[yk][day][hour]) schedData[yk][day][hour] = {};
    schedData[yk][day][hour][key] = structuredClone(srcEntry);
    persistAll();
    renderSchedule();
    sbSet('✓ Skopiowano zajęcia');
  }

  if (dstFilled) {
    showConfirm({
      message: 'Komórka docelowa jest zajęta.<br>Nadpisać jej zawartość?',
      confirmLabel: 'Nadpisz',
      danger: true,
      onConfirm: _doDrop,
    });
  } else {
    _doDrop();
  }
}


// Skrót nazwy przedmiotu: wielowyrazowe → inicjały, jednowyrazowe → 3 litery
function subjectAbbr(subject) {
  if (!subject) return '';
  const s = subject.trim();
  if (s.length <= 4) return s; // już krótki (WF, PE, EW...)
  const IGNORE = new Set(['i','w','z','na','dla','ze','lub','a','o','do','po','od','as']);
  const words = s.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1) {
    // Jedno słowo → pierwsze 3 litery z wielką literą
    return s.charAt(0).toUpperCase() + s.slice(1, 3).toLowerCase();
  }
  // Wielowyrazowe → inicjały znaczących słów
  const initials = words
    .filter(w => !IGNORE.has(w.toLowerCase()))
    .map(w => w.charAt(0).toUpperCase());
  return initials.join('');
}

// ================================================================
//  WIDOK NAUCZYCIELA / KLASY
// ================================================================

function setViewMode(mode, filter) {
  _viewMode   = mode   || 'rooms';
  _viewFilter = filter || '';
  _updateViewToolbar();
  renderSchedule();
}

function _updateViewToolbar() {
  const isRooms = _viewMode === 'rooms';

  // Przyciski aktywne
  ['viewBtnRooms','viewBtnTeacher','viewBtnClass'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const mode = id === 'viewBtnRooms' ? 'rooms' : id === 'viewBtnTeacher' ? 'teacher' : 'class';
    el.classList.toggle('active', mode === _viewMode);
  });

  // Select filtra — widoczny tylko gdy tryb ≠ rooms
  const sel = document.getElementById('viewFilterSelect');
  if (sel) {
    sel.style.display = isRooms ? 'none' : '';
    if (!isRooms) _populateViewFilter(sel);
  }

  // Zakładki dni w topbarze — widoczne tylko w trybie sal
  const dayTabsEl = document.getElementById('dayTabs');
  if (dayTabsEl) dayTabsEl.style.display = isRooms ? 'flex' : 'none';

  // Pasek Sale/Nauczyciel/Klasa — zawsze widoczny po załadowaniu planu
  const vmBar = document.getElementById('viewModeBar');
  if (vmBar) vmBar.style.display = 'flex';
}

function _populateViewFilter(sel) {
  const prev = sel.value;
  sel.innerHTML = '';
  if (_viewMode === 'teacher') {
    const teachers = (appState?.teachers || [])
      .slice().sort((a,b) => (a.last||'').localeCompare(b.last||'','pl',{sensitivity:'base'}));
    teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.abbr;
      opt.textContent = `${t.last||''} ${t.first||''} (${t.abbr})`.trim();
      sel.appendChild(opt);
    });
  } else {
    // Widok agregowany — dropdown pokazuje klasy bazowe:
    // • klasy samodzielne (baseClass === '' lub 'cała klasa')
    // • klasy będące baseClass innych wpisów
    const allClasses = (appState?.classes || []);
    // Zbierz nazwy wszystkich klas bazowych
    const basesFromChildren = new Set(
      allClasses.filter(c => c.baseClass).map(c => c.baseClass)
    );
    // Zbierz nazwy klas samodzielnych (bez zdefiniowanej klasy bazowej)
    const selfBases = new Set(
      allClasses.filter(c => !c.baseClass).map(c => c.name)
    );
    // Unia — unikalne, posortowane
    const allBases = [...new Set([...selfBases, ...basesFromChildren])]
      .sort((a,b) => a.localeCompare(b,'pl',{sensitivity:'base'}));

    allBases.forEach(baseName => {
      // Policz podgrupy podpięte pod tę klasę bazową
      const childCount = allClasses.filter(c => c.baseClass === baseName).length;
      const opt = document.createElement('option');
      opt.value = baseName;
      opt.textContent = baseName + (childCount > 0 ? ` (+${childCount} gr.)` : '');
      sel.appendChild(opt);
    });
  }
  // Przywróć poprzedni wybór jeśli nadal istnieje, inaczej ustaw pierwszy
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  else if (sel.options.length) sel.value = sel.options[0].value;
  _viewFilter = sel.value;
}

function onViewFilterChange(val) {
  _viewFilter = val;
  renderSchedule();
}

// Buduje tabelę plan nauczyciela lub plan klasy
function renderViewTable(mode, filter) {
  const yk     = appState.yearKey;
  const hours  = appState.hours;
  const days   = appState.days;
  const cols   = flattenColumns(appState.floors);

  // Zbierz wszystkie wpisy pasujące do filtra we wszystkich dniach
  // Struktura: result[dayIdx][hourIdx] = [{col, entry}]
  // Dla trybu klasy: zbierz abbry WSZYSTKICH wpisów należących do klasy bazowej `filter`
  // Wpis należy jeśli: jego baseClass === filter LUB (brak baseClass i c.name === filter)
  const classAbbrSet = new Set();
  if (mode === 'class') {
    (appState.classes||[]).forEach(c => {
      const isBase  = !c.baseClass && c.name === filter;
      const isChild = c.baseClass === filter;
      if (isBase || isChild) classAbbrSet.add(c.abbr || c.name);
    });
    // Fallback: stare dane bez baseClass — dopasuj po nazwie
    if (!classAbbrSet.size) classAbbrSet.add(filter);
  }

  const byDayHour = {};
  days.forEach((_,di) => {
    byDayHour[di] = {};
    const dayData = schedData[yk]?.[di] || {};
    hours.forEach(h => {
      byDayHour[di][h] = [];
      cols.forEach(col => {
        const key   = colKey(col);
        const entry = dayData[h]?.[key] || {};
        const filled = !!(entry.teacherAbbr || entry.subject || entry.className || (entry.classes||[]).length);
        if (!filled) return;
        let match;
        if (mode === 'teacher') {
          match = entry.teacherAbbr === filter;
        } else {
          // Dopasuj jeśli którakolwiek klasa/podgrupa należy do wybranej klasy bazowej
          const entryCls = (entry.classes||[]).length ? entry.classes : (entry.className ? [entry.className] : []);
          match = entryCls.some(cls => classAbbrSet.has(cls));
        }
        if (match) byDayHour[di][h].push({ col, key, entry });
      });
    });
  });

  // Nagłówek — dni tygodnia
  const filterLabel = mode === 'teacher'
    ? (() => { const t = getTeacherByAbbr(filter); return t ? teacherDisplayName(t) : filter; })()
    : (() => {
        if (mode !== 'class') return filter;
        const childCount = (appState.classes||[]).filter(c => c.baseClass === filter).length;
        return filter + (childCount > 0 ? ` (+${childCount} gr.)` : '');
      })();
  const modeLabel = mode === 'teacher' ? '👤 Nauczyciel' : '🏫 Klasa';

  let thead = `<thead><tr>
    <th class="time-th" style="background:var(--surface)">Godz.</th>
    ${days.map((d,di) => `<th class="th-view-day${di===currentDay?' th-view-day-active':''}"
        onclick="switchDay(${di});renderSchedule()" style="cursor:pointer;min-width:120px">
      ${esc(d)}</th>`).join('')}
  </tr></thead>`;

  // Ciało — godziny × dni
  let tbody = '<tbody>';
  hours.forEach(h => {
    tbody += `<tr><td class="time-cell">${formatTimeCell(h)}</td>`;
    days.forEach((_,di) => {
      const entries = byDayHour[di][h] || [];
      if (!entries.length) {
        // BUG-05 fix: pusta komórka w widoku nauczyciela/klasy — brak konkretnej sali,
        // więc zamiast otwierać zepsuty modal z kluczem '' pokazujemy tooltip
        tbody += `<td><div class="cell-inner cell-inner-view-empty" title="Brak zajęć — przełącz na widok sal aby edytować"
          style="cursor:default"><div class="cell-plus" style="opacity:0.25">—</div></div></td>`;
      } else {
        tbody += `<td style="padding:2px;vertical-align:top">`;
        entries.forEach(({ col, key, entry }) => {
          const roomLabel = col.room.num ? `Sala ${esc(col.room.num)}` : esc(col.room.sub||'?');
          const clsList   = (entry.classes||[]).length ? entry.classes : (entry.className ? [entry.className] : []);
          tbody += `<div class="cell-inner filled view-cell"
              onclick="switchDay(${di});openEditModal(${di},'${esc(String(h))}','${esc(key)}')"
              style="cursor:pointer;margin-bottom:2px">
            <div class="cell-row-cls">${clsList.map(c=>`<span class="cell-abbr cell-abbr-cls" title="${esc(resolveClassName(c))}">${esc(c)}</span>`).join('')}</div>
            ${entry.subject ? `<div class="cell-row-subject" title="${esc(entry.subject)}">${esc(subjectAbbr(entry.subject))}</div>` : ''}
            <div class="cell-row-teacher" style="font-size:0.6rem;color:var(--text-muted)">${esc(roomLabel)}</div>
          </div>`;
        });
        tbody += '</td>';
      }
    });
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  // Podsumowanie — liczba zajętych godzin
  let totalLessons = 0;
  days.forEach((_,di) => hours.forEach(h => { if ((byDayHour[di][h]||[]).length) totalLessons++; }));

  return { thead, tbody, totalLessons, filterLabel, modeLabel };
}

function renderSchedule() {
  if (!appState) return;

  // ── Widok nauczyciela / klasy ──
  if (_viewMode !== 'rooms') {
    const { thead, tbody, totalLessons, filterLabel, modeLabel } = renderViewTable(_viewMode, _viewFilter);
    document.getElementById('scheduleWrap').innerHTML =
      `<div class="view-mode-banner">${modeLabel}: <strong>${esc(filterLabel)}</strong>
        <span style="font-size:0.72rem;color:var(--text-muted);margin-left:10px">${totalLessons} godz. tygodniowo</span></div>
       <table class="schedule-table view-mode-table">${thead}${tbody}</table>`;
    updateStatusBar();
    return;
  }

  const cols       = flattenColumns(appState.floors);
  const hours      = appState.hours;
  const dayData    = schedData[appState.yearKey]?.[currentDay]||{};
  const assignments= appState.assignments[currentDay]||{};
  const buildings  = appState.buildings||[];
  const homerooms  = appState.homerooms||{};  // colKey -> {className, teacherAbbr}

  // ── Detect if multi-building / multi-floor / multi-segment ──
  const uniqueBuildings = [...new Set((appState.floors||[]).map(f=>f.buildingIdx||0))];
  // Show building row only when >1 buildings
  const showBuilding = uniqueBuildings.length > 1;
  // Show floor row when any floor has a non-empty name
  const showFloor = (appState.floors||[]).some(f => (f.name||'').trim() !== '');
  // Show segment row when any segment has a non-empty name
  const showSeg = (appState.floors||[]).some(f =>
    (f.segments||[]).some(s => (s.name||'').trim() !== '')
  );


  // ── Build merged header rows ──
  // Row 1 (optional): Buildings — merged across all cols of same building
  // Row 2 (optional): Floors — merged across all cols of same floor
  // Row 3 (optional): Segments — merged across all cols of same segment
  // Row 4: Room numbers (always)
  // Row 5: Homeroom class + teacher (always)

  // helper: build merged cells for a given key extractor
  function buildMergedRow(keyFn, labelFn, stylesFn, extraClass='', timeCell='', topPx=57) {
    const topStyle = `--th-top:${topPx}px;`;
    let row = `<tr><th class="time-th" rowspan="1" style="background:var(--surface);${topStyle}">${timeCell}</th>`;
    let i = 0;
    while (i < cols.length) {
      const key = keyFn(cols[i]);
      let span = 1;
      while (i+span < cols.length && keyFn(cols[i+span]) === key) span++;
      const styles = stylesFn ? stylesFn(cols[i]) : '';
      row += `<th colspan="${span}" class="${extraClass}" style="${topStyle}${styles}">${labelFn(cols[i])}</th>`;
      i += span;
    }
    return row + '</tr>';
  }

  // Row heights (approximate, will be refined after render)
  // th sticky top:0 względem scrollowalnego .main (nie viewport)
  const ROW_H = 26;
  let _rowTop = 0;

  let thead = '<thead>';

  // Row: Buildings
  if (showBuilding) {
    thead += buildMergedRow(
      c => c.floor.buildingIdx||0,
      c => { const bld = buildings[c.floor.buildingIdx||0]; return esc(bld?.name||'—'); },
      c => { const color = BUILDING_COLORS[(c.floor.buildingIdx||0) % BUILDING_COLORS.length]; return `color:${color};border-top:3px solid ${color};border-bottom:2px solid ${color}`; },
      'th-building', 'Budynek', _rowTop
    );
    _rowTop += ROW_H;
  }

  // Row: Floors
  if (showFloor) {
    thead += buildMergedRow(
      c => c.floorIdx,
      c => esc(c.floor.name),
      c => `color:${c.floor.color};border-bottom:1px solid ${c.floor.color}40`,
      'th-floor', 'Piętro', _rowTop
    );
    _rowTop += ROW_H;
  }

  // Row: Segments
  if (showSeg) {
    thead += buildMergedRow(
      c => c.floorIdx+'-'+c.segIdx,
      c => esc(c.seg.name||'—'),
      c => `border-top:2px solid ${c.floor.color}60`,
      'th-seg-row', 'Segment', _rowTop
    );
    _rowTop += ROW_H;
  }

  // Row: Room numbers (always, not merged)
  {
    const topStyle = `--th-top:${_rowTop}px;`;
    let row = `<tr><th class="time-th" style="background:var(--surface);${topStyle}">Godz.</th>`;
    cols.forEach(col => {
      const label = col.room.sub
        ? `Sala ${esc(col.room.num)}<br><span style="font-size:0.55rem;color:var(--text-dim)">${esc(col.room.sub)}</span>`
        : `Sala ${esc(col.room.num)}`;
      const floorColor = col.floor.color;
      const topBorder = !showBuilding && !showFloor && !showSeg
        ? `border-top:3px solid ${floorColor}` : '';
      row += `<th class="th-room-row" style="${topStyle}${topBorder}">${label}</th>`;
    });
    thead += row + '</tr>';
    _rowTop += ROW_H;
  }

  // Row: Homeroom (class + teacher wychowawca)
  {
    const topStyle = `--th-top:${_rowTop}px;`;
    let row = `<tr><th class="time-th" style="background:var(--surface);font-size:0.55rem;color:var(--text-dim);${topStyle}">Gospod.</th>`;
    cols.forEach(col => {
      const key = colKey(col);
      const hr  = homerooms[key]||{};
      const assignedCls = assignments[key]||'';
      const displayCls  = hr.className || assignedCls || '';
      const hrTeacher   = hr.teacherAbbr ? getTeacherByAbbr(hr.teacherAbbr) : null;
      const hrTeacher2  = hr.teacherAbbr2 ? getTeacherByAbbr(hr.teacherAbbr2) : null;
      const displayCls2 = hr.className2 || '';
      const hasTwo = !!(displayCls2 || hrTeacher2);
      row += `<th class="th-homeroom${hasTwo?' hr-two':''}" onclick="openHomeroomModal('${esc(key)}')" style="cursor:pointer;${topStyle}" title="Kliknij aby ustawić gospodarza">
        ${displayCls || hasTwo
          ? `<div class="hr-pair"><div class="hr-class">${esc(displayCls||'?')}</div>${hrTeacher ? `<div class="hr-teacher">${esc(hrTeacher.abbr)}</div>` : ''}</div>`
          : '<div style="color:var(--text-dim);font-size:0.55rem">—</div>'}
        ${hasTwo ? `<div class="hr-sep"></div><div class="hr-pair"><div class="hr-class hr-class-2">${esc(displayCls2)}</div>${hrTeacher2 ? `<div class="hr-teacher">${esc(hrTeacher2.abbr)}</div>` : ''}</div>` : ''}
      </th>`;
    });
    thead += row + '</tr>';
  }

  thead += '</thead>';

  // ── Body ──
  // ── Kolizje ──
  const collisions = detectCollisions(dayData, hours, cols);

  let tbody = '<tbody>';
  hours.forEach(h => {
    tbody += `<tr><td class="time-cell">${formatTimeCell(h)}</td>`;
    cols.forEach(col => {
      const key   = colKey(col);
      const entry = dayData[h]?.[key]||{};
      const filled = !!(entry.teacherAbbr || entry.subject || entry.className || (entry.classes && entry.classes.length));
      const teacher = entry.teacherAbbr ? getTeacherByAbbr(entry.teacherAbbr) : null;
      const cellId   = h + '|' + key;
      const cellErrs = collisions[cellId] || [];
      const hasErr   = cellErrs.length > 0;
      const errTip   = cellErrs.join('\n');
      tbody += `<td><div class="cell-inner ${filled?'filled':''} ${hasErr?'collision':''}"
            onclick="openEditModal(${currentDay},'${esc(h)}','${esc(key)}')"
            ${filled?`draggable="true"
            ondragstart="dndStart(event,${currentDay},'${esc(h)}','${esc(key)}')"
            ondragend="dndEnd(event)"`:''}
            ondragover="dndOver(event)"
            ondragleave="dndLeave(event)"
            ondrop="dndDrop(event,${currentDay},'${esc(h)}','${esc(key)}')"
            ${hasErr?`data-collision-tip="${esc(errTip)}"`:''}
            >${hasErr?'<span class="cell-collision-icon">⚠</span>':''}${
        filled
          ? `<div class="cell-row-cls">${
               mergeClassNames(
                 entry.classes && entry.classes.length
                   ? entry.classes
                   : entry.className ? [entry.className] : []
               ).map(cls => `<span class="cell-abbr cell-abbr-cls" title="${esc(resolveClassName(cls))}">${esc(cls)}</span>`).join('')
             }</div>
             ${entry.subject ? `<div class="cell-row-subject" title="${esc(entry.subject)}">${esc(subjectAbbr(entry.subject))}</div>` : ''}
             ${entry.teacherAbbr ? `<div class="cell-row-teacher"><span class="cell-abbr">${esc(entry.teacherAbbr)}</span></div>` : ''}`
          : '<div class="cell-plus">＋</div>'
      }</div></td>`;
    });
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  // Licznik kolizji w statusbarze
  const totalCollisions = Object.keys(collisions).length;
  const ccEl  = document.getElementById('collisionCount');
  const sepEl = document.getElementById('collisionSep');
  if (ccEl) {
    if (totalCollisions > 0) {
      const suf = totalCollisions === 1 ? 'a' : totalCollisions < 5 ? 'e' : 'i';
      ccEl.textContent = '⚠ ' + totalCollisions + ' kolizj' + suf;
      ccEl.classList.remove('none');
      if (sepEl) sepEl.style.display = '';
    } else {
      ccEl.classList.add('none');
      if (sepEl) sepEl.style.display = 'none';
    }
  }

  document.getElementById('scheduleWrap').innerHTML =
    `<table class="schedule-table">${thead}${tbody}</table>`;

  updateStatusBar();
}

function updateStatusBar() {
  const dayData = schedData[appState.yearKey]?.[currentDay]||{};
  let count=0;
  flattenColumns(appState.floors).forEach(col => {
    appState.hours.forEach(h => {
      const e = dayData[h]?.[colKey(col)];
      if (e&&(e.teacherAbbr||e.subject||e.className||(e.classes&&e.classes.length))) count++; // BUG-F fix: uwzględnij classes[]
    });
  });
  document.getElementById('sbCount').textContent = `${count} wpisów w tym dniu`;

  // Wskaźnik użycia localStorage
  const storageEl = document.getElementById('sbStorage');
  if (storageEl) {
    const used = storageUsageBytes();
    const LIMIT = 5 * 1024 * 1024; // 5 MB typowy limit
    const pct = Math.min(100, Math.round(used / LIMIT * 100));
    const color = pct > 85 ? 'var(--red)' : pct > 65 ? 'var(--yellow)' : 'var(--text-muted)';
    storageEl.innerHTML =
      `<span style="color:${color}" title="Użycie pamięci lokalnej przeglądarki">` +
      `💾 ${formatBytes(used)} (${pct}%)</span>`;
  }
}



// ================================================================
//  PRZEDZIAŁY CZASOWE LEKCJI (timeslots)
// ================================================================

// Domyślny plan lekcji (7:00 start, 45 min lekcja, 10 min przerwa)
const TIMESLOTS_DEFAULT_45 = [
  {label:'0',start:'07:00',end:'07:45'},
  {label:'1',start:'07:55',end:'08:40'},
  {label:'2',start:'08:50',end:'09:35'},
  {label:'3',start:'09:45',end:'10:30'},
  {label:'4',start:'10:45',end:'11:30'},
  {label:'5',start:'11:45',end:'12:30'},
  {label:'6',start:'12:40',end:'13:25'},
  {label:'7',start:'13:35',end:'14:20'},
  {label:'8',start:'14:30',end:'15:15'},
  {label:'9',start:'15:25',end:'16:10'},
  {label:'10',start:'16:20',end:'17:05'},
];

// Zwraca przedział dla danego klucza godziny; fallback gdy brak timeslots
function getTimeslot(hourKey) {
  const ts = appState?.timeslots;
  if (!ts || !ts.length) return null;
  return ts.find(t => t.label === String(hourKey)) || null;
}

// Formatuje komórkę czasu: numer + przedziały lub sam numer
function formatTimeCell(hourKey) {
  const ts = getTimeslot(hourKey);
  if (!ts || (!ts.start && !ts.end)) return `<span class="time-num">${esc(String(hourKey))}</span>`;
  return `<span class="time-num">${esc(ts.label||String(hourKey))}</span>
          <span class="time-range">${esc(ts.start||'')}–${esc(ts.end||'')}</span>`;
}

// Buduje timeslots z tablicy hours i opcjonalnego poprzedniego appState
function buildTimeslotsFromHours(hours, prevTimeslots) {
  return hours.map(h => {
    const existing = (prevTimeslots||[]).find(t => t.label === String(h));
    return existing || { label: String(h), start: '', end: '' };
  });
}

// ── Kreator: render edytora timeslotów ──

function initTimeslotEditor() {
  const hoursVal = document.getElementById('wHours')?.value || '';
  const hours = hoursVal.split(',').map(h=>h.trim()).filter(Boolean).sort((a,b)=>Number(a)-Number(b)); // BUG-B fix
  // Zachowaj istniejące wpisy, uzupełnij nowymi
  wTimeslots = hours.map(h => {
    const ex = wTimeslots.find(t => t.label === h);
    if (ex) return ex;
    const def = TIMESLOTS_DEFAULT_45.find(t => t.label === h);
    return def ? {...def} : { label: h, start: '', end: '' };
  });
  renderTimeslotEditor();
}

function renderTimeslotEditor() {
  const container = document.getElementById('wTimeslotList');
  if (!container) return;
  if (!wTimeslots.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:0.8rem;padding:6px 0">Brak godzin — wróć do poprzedniego kroku i wpisz numery lekcji.</div>';
    return;
  }
  container.innerHTML = wTimeslots.map((ts, i) => `
    <div class="timeslot-row">
      <span class="timeslot-lnum">Godz. ${esc(ts.label)}</span>
      <input class="timeslot-inp" type="time" value="${esc(ts.start||'')}"
        oninput="wTimeslots[${i}].start=this.value" placeholder="--:--"
        title="Początek lekcji">
      <span class="timeslot-sep">–</span>
      <input class="timeslot-inp" type="time" value="${esc(ts.end||'')}"
        oninput="wTimeslots[${i}].end=this.value" placeholder="--:--"
        title="Koniec lekcji">
    </div>`).join('');
}

function fillTimeslotsDefault() {
  const hoursVal = document.getElementById('wHours')?.value || '';
  const hours = hoursVal.split(',').map(h=>h.trim()).filter(Boolean).sort((a,b)=>Number(a)-Number(b)); // BUG-B fix
  wTimeslots = hours.map(h => {
    const def = TIMESLOTS_DEFAULT_45.find(t => t.label === h);
    return def ? {...def} : { label: h, start: '', end: '' };
  });
  renderTimeslotEditor();
}

function clearTimeslots() {
  wTimeslots = wTimeslots.map(t => ({ label: t.label, start: '', end: '' }));
  renderTimeslotEditor();
}

// ================================================================
//  SŁOWNIK PRZEDMIOTÓW
// ================================================================

const SUBJECTS_PRESET = [
  {name:'Język polski',        abbr:'J.pol'},
  {name:'Język angielski',     abbr:'J.ang'},
  {name:'Język niemiecki',     abbr:'J.niem'},
  {name:'Język rosyjski',      abbr:'J.ros'},
  {name:'Język francuski',     abbr:'J.fr'},
  {name:'Matematyka',          abbr:'Mat'},
  {name:'Fizyka',              abbr:'Fiz'},
  {name:'Chemia',              abbr:'Chem'},
  {name:'Biologia',            abbr:'Bio'},
  {name:'Geografia',           abbr:'Geo'},
  {name:'Historia',            abbr:'Hist'},
  {name:'Wiedza o społeczeństwie', abbr:'WOS'},
  {name:'Informatyka',         abbr:'Inf'},
  {name:'Technika',            abbr:'Tech'},
  {name:'Plastyka',            abbr:'Plas'},
  {name:'Muzyka',              abbr:'Muz'},
  {name:'Wychowanie fizyczne', abbr:'WF'},
  {name:'Religia',             abbr:'Rel'},
  {name:'Etyka',               abbr:'Etyka'},
  {name:'Wychowanie do życia w rodzinie', abbr:'WDŻ'},
  {name:'Edukacja dla bezpieczeństwa',    abbr:'EDB'},
  {name:'Podstawy przedsiębiorczości',    abbr:'PP'},
  {name:'Godzina wychowawcza',            abbr:'GW'},
];

// Renderuje listę przedmiotów w kreatorze
function renderSubjectList() {
  const container = document.getElementById('wSubjectList');
  if (!container) return;
  if (!wSubjects.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:0.8rem;padding:6px 0">Brak przedmiotów — dodaj poniżej lub wczytaj predefiniowane.</div>';
    return;
  }
  container.innerHTML = wSubjects.map((s, i) => `
    <div class="subject-item" id="subjectItem${i}">
      <input class="subject-name-inp" value="${esc(s.name)}" placeholder="Nazwa przedmiotu"
        oninput="wSubjects[${i}].name=this.value;scheduleSubjectAbbrUpdate(${i})">
      <input class="subject-abbr-inp" value="${esc(s.abbr||'')}" placeholder="Skrót" maxlength="8"
        oninput="wSubjects[${i}].abbr=this.value">
      <button class="icon-btn danger" onclick="removeSubject(${i})" title="Usuń">🗑</button>
    </div>`).join('');
}

function scheduleSubjectAbbrUpdate(i) {
  // Autogeneruj skrót jeśli pole jest puste
  clearTimeout(wSubjects[i]?._abbrTimer);
  if (wSubjects[i]) {
    wSubjects[i]._abbrTimer = setTimeout(() => {
      const abbrInp = document.querySelector(`#subjectItem${i} .subject-abbr-inp`);
      if (abbrInp && !abbrInp.value.trim()) {
        const auto = autoSubjectAbbr(wSubjects[i].name);
        wSubjects[i].abbr = auto;
        abbrInp.value = auto;
      }
    }, 600);
  }
}

function autoSubjectAbbr(name) {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0,4);
  // Inicjały pierwszych 3 znaczących słów
  const SKIP = new Set(['do','w','z','i','o','na','dla','ze','lub','a','po','od']);
  return words.filter(w => !SKIP.has(w.toLowerCase())).slice(0,3).map(w=>w[0].toUpperCase()).join('');
}

function addSubject() {
  wSubjects.push({ name: '', abbr: '' });
  renderSubjectList();
  wizardSaveDraft();
  // Fokus na nowym polu
  setTimeout(() => {
    const items = document.querySelectorAll('.subject-name-inp');
    if (items.length) items[items.length-1].focus();
  }, 50);
}

function removeSubject(i) {
  wSubjects.splice(i, 1);
  renderSubjectList();
  wizardSaveDraft();
}

function loadSubjectPreset() {
  function _doLoad() {
    wSubjects = structuredClone(SUBJECTS_PRESET);
    renderSubjectList();
    wizardSaveDraft();
  }
  if (wSubjects.length > 0) {
    showConfirm({
      message: 'Zastąpić bieżącą listę przedmiotów listą predefiniowaną?<br><span style="font-size:0.78rem;color:var(--text-muted)">Bieżące wpisy zostaną utracone.</span>',
      confirmLabel: '📋 Zastąp',
      danger: false,
      onConfirm: _doLoad,
    });
  } else {
    _doLoad();
  }
}

// ── Autocomplete w modalu edycji komórki ──

// Zwraca posortowaną listę unikalnych przedmiotów ze słownika + z istniejących wpisów w planie
function getSubjectSuggestions() {
  const fromDict = (appState?.subjects || []).map(s => ({ name: s.name, abbr: s.abbr }));
  // Zbierz też wpisane ręcznie przedmioty z planu (uniq)
  const yk = appState?.yearKey;
  const seen = new Set(fromDict.map(s => s.name.toLowerCase()));
  if (yk && schedData[yk]) {
    Object.values(schedData[yk]).forEach(dayData => {
      Object.values(dayData).forEach(hourData => {
        Object.values(hourData).forEach(entry => {
          if (entry.subject && !seen.has(entry.subject.toLowerCase())) {
            seen.add(entry.subject.toLowerCase());
            fromDict.push({ name: entry.subject, abbr: '' });
          }
        });
      });
    });
  }
  return fromDict.sort((a,b) => a.name.localeCompare(b.name, 'pl', {sensitivity:'base'}));
}

let _subjectDropdownVisible = false;

function initSubjectAutocomplete() {
  const inp = document.getElementById('inpSubject');
  if (!inp) return;
  inp.setAttribute('autocomplete','off');
  inp.addEventListener('input', _onSubjectInput);
  inp.addEventListener('focus', _onSubjectInput);
  inp.addEventListener('keydown', _onSubjectKeydown);
  inp.addEventListener('blur', () => setTimeout(_hideSubjectDropdown, 150));
}

function _onSubjectInput() {
  const inp = document.getElementById('inpSubject');
  const q = (inp?.value || '').trim().toLowerCase();
  const suggestions = getSubjectSuggestions();
  const filtered = q
    ? suggestions.filter(s => s.name.toLowerCase().includes(q) || (s.abbr||'').toLowerCase().includes(q))
    : suggestions;
  if (!filtered.length) { _hideSubjectDropdown(); return; }
  _showSubjectDropdown(filtered, inp);
}

function _showSubjectDropdown(items, inp) {
  let dd = document.getElementById('subjectDropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'subjectDropdown';
    dd.className = 'subject-dropdown';
    document.body.appendChild(dd);
  }
  const rect = inp.getBoundingClientRect();
  dd.style.cssText = `position:fixed;z-index:9999;left:${rect.left}px;top:${rect.bottom+2}px;width:${rect.width}px`;
  dd.innerHTML = items.slice(0,12).map((s,i) =>
    `<div class="subject-dd-item" data-idx="${i}" onmousedown="pickSubject(${JSON.stringify(s.name)})">
      <span class="subject-dd-name">${esc(s.name)}</span>
      ${s.abbr ? `<span class="subject-dd-abbr">${esc(s.abbr)}</span>` : ''}
    </div>`).join('');
  dd.style.display = 'block';
  _subjectDropdownVisible = true;
  _subjectDropdownItems = items.slice(0,12);
  _subjectDropdownIdx = -1;
}

let _subjectDropdownItems = [];
let _subjectDropdownIdx = -1;

function _onSubjectKeydown(e) {
  if (!_subjectDropdownVisible) return;
  const dd = document.getElementById('subjectDropdown');
  const items = dd?.querySelectorAll('.subject-dd-item');
  if (!items?.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _subjectDropdownIdx = Math.min(_subjectDropdownIdx+1, items.length-1);
    items.forEach((el,i) => el.classList.toggle('active', i===_subjectDropdownIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _subjectDropdownIdx = Math.max(_subjectDropdownIdx-1, 0);
    items.forEach((el,i) => el.classList.toggle('active', i===_subjectDropdownIdx));
  } else if (e.key === 'Enter' && _subjectDropdownIdx >= 0) {
    e.preventDefault();
    e.stopPropagation();
    pickSubject(_subjectDropdownItems[_subjectDropdownIdx].name);
  } else if (e.key === 'Escape') {
    _hideSubjectDropdown();
  }
}

function pickSubject(name) {
  const inp = document.getElementById('inpSubject');
  if (inp) inp.value = name;
  _hideSubjectDropdown();
}

function _hideSubjectDropdown() {
  const dd = document.getElementById('subjectDropdown');
  if (dd) dd.style.display = 'none';
  _subjectDropdownVisible = false;
  _subjectDropdownIdx = -1;
}

// ================================================================
//  EDIT MODAL
// ================================================================
function openEditModal(day, hour, key) {
  _mDay=day; _mHour=hour; _mKey=key;
  const cols = flattenColumns(appState.floors);
  const col = cols.find(c=>colKey(c)===key);
  const entry = schedData[appState.yearKey]?.[day]?.[hour]?.[key]||{};
  const defaultCls = (appState.assignments[day]||{})[key]||'';
  const bld = (appState.buildings||[])[col?.floor?.buildingIdx||0];

  document.getElementById('modalTitle').textContent = `Sala ${col?.room.num||'?'} — Godz. ${hour}`;
  document.getElementById('modalSub').textContent =
    `${bld?bld.name+' · ':''}${col?.floor.name||''} › ${col?.seg.name||''} · ${appState.days[day]}`;

  // Teacher select
  const selT = document.getElementById('inpTeacher');
  selT.innerHTML = buildTeacherSelectOptions(entry.teacherAbbr||'');

  // Klasy/grupy — multi
  _selectedClasses = [];
  const _initClasses = entry.classes && entry.classes.length
    ? entry.classes
    : (entry.className || defaultCls) ? [entry.className || defaultCls] : [];
  renderMultiClassList(_initClasses);
  document.getElementById('inpClass').value = '';

  document.getElementById('inpSubject').value = entry.subject||'';
  document.getElementById('inpNote').value = entry.note||'';
  renderMcSelect();
  document.getElementById('editModal').classList.add('show');
  initSubjectAutocomplete();
  selT.focus();
}
function closeEditModal() {
  document.getElementById('editModal').classList.remove('show');
  // reset quick-add panels
  ['qaPanelTeacher','qaPanelClass'].forEach(id => {
    const p = document.getElementById(id);
    if (p) p.classList.remove('open');
  });
  document.getElementById('qaToggleTeacher').querySelector('.qa-icon').textContent = '＋';
  document.getElementById('qaToggleClass').querySelector('.qa-icon').textContent = '＋';
  document.getElementById('qaToggleTeacher').style.color = '';
  document.getElementById('qaToggleClass').style.color = '';
}

// ================================================================
//  ZAJĘCIA MIĘDZYODDZIAŁOWE — wielokrotny wybór klas
// ================================================================
function renderMcSelect() {
  const wrap = document.getElementById('mcSelectWrap');
  if (!wrap) return;
  const classes = appState?.classes || [];
  if (!classes.length) { wrap.innerHTML = ''; return; }
  const sortedClasses = classes.slice().sort((a,b) =>
    (a.name||'').localeCompare(b.name||'', 'pl', {numeric:true, sensitivity:'base'}));
  const opts = sortedClasses.map(cl => {
    const val   = cl.abbr || cl.name;
    const label = (cl.group && cl.group.toLowerCase() !== 'cała klasa')
      ? cl.name + ' — ' + cl.group : cl.name;
    return `<option value="${esc(val)}">${esc(label)}</option>`;
  }).join('');
  wrap.innerHTML =
    `<select id="mcAddSelect" class="teacher-select mc-add-select">${opts}</select>
     <button class="btn btn-green mc-add-btn" onclick="mcAddClass()">＋ Dodaj</button>`;
}

function renderMultiClassList(selected) {
  _selectedClasses = Array.isArray(selected) ? selected.slice() : [];
  const container = document.getElementById('multiClassList');
  if (!container) return;
  const classes = appState?.classes || [];
  if (classes.length === 0) {
    container.innerHTML = '<span style="color:orange;font-size:0.8rem">⚠ Brak klas — dodaj w kreatorze (✏️ Edytuj rok)</span>';
    return;
  }
  function labelFor(val) {
    const found = classes.find(cl => (cl.abbr || cl.name) === val);
    if (!found) return val;
    return (found.group && found.group.toLowerCase() !== 'cała klasa')
      ? found.name + ' ' + found.group : found.name;
  }
  const chips = _selectedClasses.map((val, i) =>
    `<span class="mc-chip">
       <span class="mc-chip-val">${esc(labelFor(val))}</span>
       <button class="mc-chip-del" onclick="mcRemoveClass(${i})" title="Usuń">✕</button>
     </span>`
  ).join('');
  container.innerHTML = chips || '<span style="font-size:0.75rem;color:var(--text-dim)">Brak wybranych klas</span>';
}
function mcAddClass() {
  const sel = document.getElementById('mcAddSelect');
  if (!sel) return;
  const val = sel.value;
  if (!val) return;
  if (_selectedClasses.includes(val)) {
    notify('⚠ Ta klasa jest już na liście', true);
    return;
  }
  _selectedClasses.push(val);
  renderMultiClassList(_selectedClasses);
  renderMcSelect();
}


function mcRemoveClass(idx) {
  _selectedClasses.splice(idx, 1);
  renderMultiClassList(_selectedClasses);
}function saveCellData() {
  const yk = appState.yearKey;
  undoPush(`Zapis ${_mKey}, godz. ${_mHour}, ${appState.days[_mDay]}`); // BUG-04 fix: _mHour jest stringiem
  if (!schedData[yk]) schedData[yk]={};
  if (!schedData[yk][_mDay]) schedData[yk][_mDay]={};
  if (!schedData[yk][_mDay][_mHour]) schedData[yk][_mDay][_mHour]={};
  // Zbierz klasy z listy międzyoddziałowej (z globalnego stanu)
  const _clsList = (_selectedClasses || []).filter(Boolean);
  schedData[yk][_mDay][_mHour][_mKey]={
    teacherAbbr: document.getElementById('inpTeacher').value,
    classes:     _clsList,
    className:   _clsList[0] || '',   // kompatybilność wsteczna
    subject:     document.getElementById('inpSubject').value.trim(),
    note:        document.getElementById('inpNote').value.trim(),
  };
  persistAll(); closeEditModal(); renderSchedule(); sbSet('Wpis zaktualizowany');
}
function clearCellData() {
  undoPush(`Wyczyszczenie ${_mKey}, godz. ${_mHour}, ${appState.days[_mDay]}`); // BUG-04 fix
  if (schedData[appState.yearKey]?.[_mDay]?.[_mHour]) schedData[appState.yearKey][_mDay][_mHour][_mKey]={};
  persistAll(); closeEditModal(); renderSchedule(); sbSet('Wpis wyczyszczony');
}
(function(){var _em=document.getElementById('editModal');if(_em)_em.addEventListener('click',e=>{if(e.target===_em)closeEditModal();});})();
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeEditModal();}
  if(e.key==='Enter'&&e.ctrlKey&&document.getElementById('editModal').classList.contains('show'))saveCellData();
  // Undo / Redo — tylko gdy modal edycji jest zamknięty i nie piszemy w input
  const tag = (e.target.tagName||'').toLowerCase();
  const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';
  const modalOpen = document.getElementById('editModal')?.classList.contains('show');
  if (!inInput && !modalOpen) {
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); undoAction(); }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redoAction(); }
  }
});


// ================================================================
//  MODAL POTWIERDZENIA — zastępuje window.confirm()
// ================================================================

// Użycie:
//   showConfirm({ message, confirmLabel, danger, onConfirm, onCancel })
// onConfirm i onCancel to funkcje wywoływane po wyborze.

function showConfirm({ message, confirmLabel = 'Tak', cancelLabel = 'Anuluj', danger = false, onConfirm, onCancel }) {
  let modal = document.getElementById('confirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
      <div class="modal confirm-box" style="max-width:360px">
        <div class="confirm-msg" id="confirmMsg"></div>
        <div class="modal-footer" style="gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" id="confirmCancelBtn"></button>
          <button class="btn"          id="confirmOkBtn"></button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) _dismissConfirm(); });
    document.addEventListener('keydown', _confirmKeydown);
  }

  document.getElementById('confirmMsg').innerHTML = message;
  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  okBtn.textContent = confirmLabel;
  okBtn.className = 'btn ' + (danger ? 'btn-red' : 'btn-primary');
  cancelBtn.textContent = cancelLabel;

  // Odepnij stare handlery
  okBtn.onclick = null;
  cancelBtn.onclick = null;

  okBtn.onclick = () => { _dismissConfirm(); if (onConfirm) onConfirm(); };
  cancelBtn.onclick = () => { _dismissConfirm(); if (onCancel) onCancel(); };

  modal.classList.add('show');
  cancelBtn.focus();
}

function _dismissConfirm() {
  document.getElementById('confirmModal')?.classList.remove('show');
}

function _confirmKeydown(e) {
  const modal = document.getElementById('confirmModal');
  if (!modal?.classList.contains('show')) return;
  if (e.key === 'Escape') { e.preventDefault(); _dismissConfirm(); }
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('confirmOkBtn')?.click();
  }
}

// ================================================================
//  ARCHIVE
// ================================================================
function showArchive() { renderArchiveBody(); document.getElementById('archivePanel').classList.add('show'); }

function hideArchive() {
  document.getElementById('archivePanel').classList.remove('show');
}

function closeArchive() { document.getElementById('archivePanel').classList.remove('show'); }
function renderArchiveBody() {
  const body = document.getElementById('archiveBody');
  let html = '';
  if (appState) {
    const bldInfo = (appState.buildings||[]).map(b=>b.name).filter(Boolean).join(', ');
    html += `<div class="archive-year-card" style="border-color:var(--accent);background:rgba(59,130,246,0.06)">
      <div class="archive-year-info">
        <h3>📌 ${esc(appState.yearLabel)} <span style="font-size:0.68rem;color:var(--green);font-weight:600">aktywny</span></h3>
        <p>${appState.school?.name?esc(appState.school.name)+' · ':''}${flattenColumns(appState.floors).length} sal · ${appState.classes.length} klas · ${(appState.teachers||[]).length} nauczycieli</p>
        ${bldInfo?`<p style="margin-top:2px;color:var(--text-dim)">🏢 ${esc(bldInfo)}</p>`:''}
      </div>
      <div class="archive-year-actions"><button class="btn btn-ghost" onclick="closeArchive()">Otwórz</button></div>
    </div>`;
  }
  archive.slice().reverse().forEach(item => {
    const saved = item.savedAt ? new Date(item.savedAt).toLocaleDateString('pl-PL'):'';
    html += `<div class="archive-year-card">
      <div class="archive-year-info">
        <h3>📁 ${esc(item.label)}</h3>
        <p>${item.config?.school?.name?esc(item.config.school.name)+' · ':''}Zarchiwizowany${saved?': '+saved:''}</p>
      </div>
      <div class="archive-year-actions">
        <button class="btn btn-yellow" onclick="restoreYear('${esc(item.yearKey)}')">Przywróć</button>
        <button class="btn btn-red" onclick="deleteArchive('${esc(item.yearKey)}')">Usuń</button>
      </div>
    </div>`;
  });
  if (!html) html = '<div class="archive-empty">Brak zarchiwizowanych planów.</div>';
  body.innerHTML = html;
}
function restoreYear(yearKey) {
  const item = archive.find(a=>a.yearKey===yearKey);
  if (!item?.config) { notify('⚠ Brak danych konfiguracji — utwórz rok ponownie przez kreator.', true); return; }
  showConfirm({
    message: `Przywrócić rok <strong>${esc(item.label)}</strong>?<br><span style="font-size:0.78rem;color:var(--text-muted)">Bieżący rok zostanie zarchiwizowany.</span>`,
    confirmLabel: '📁 Przywróć',
    danger: false,
    onConfirm: () => {
      if (appState) {
        const ex = archive.find(a=>a.yearKey===appState.yearKey);
        if (!ex) archive.push({yearKey:appState.yearKey,label:appState.yearLabel,savedAt:new Date().toISOString(),config:structuredClone(appState)}); // BUG-E fix: deep copy
      }
      appState={homerooms: item.config?.homerooms || {}, ...item.config}; archive=archive.filter(a=>a.yearKey!==yearKey);
      persistAll(); closeArchive(); currentDay=0; mountApp();
      notify('📁 Przywrócono rok '+item.label);
    }
  });
}
function deleteArchive(yearKey) {
  const item = archive.find(a=>a.yearKey===yearKey);
  showConfirm({
    message: `Trwale usunąć archiwum:<br><strong>${esc(item?.label||yearKey)}</strong>?<br><span style="font-size:0.78rem;color:var(--text-muted)">Tej operacji nie można cofnąć.</span>`,
    confirmLabel: '🗑 Usuń na zawsze',
    danger: true,
    onConfirm: () => {
      archive=archive.filter(a=>a.yearKey!==yearKey); delete schedData[yearKey];
      persistAll(); renderArchiveBody(); notify('🗑 Usunięto archiwum');
    }
  });
}
(function(){var _ap=document.getElementById('archivePanel');if(_ap)_ap.addEventListener('click',e=>{if(e.target===_ap)closeArchive();});})();

// ================================================================
//  OTHER ACTIONS
// ================================================================
function clearDay() {
  const dayName = appState.days[currentDay];
  showConfirm({
    message: `Wyczyścić wszystkie wpisy dla:<br><strong>${esc(dayName)}</strong>?<br><span style="font-size:0.78rem;color:var(--text-muted)">Możesz cofnąć tę operację przez Ctrl+Z.</span>`,
    confirmLabel: '🗑 Wyczyść dzień',
    danger: true,
    onConfirm: () => {
      undoPush(`Wyczyszczenie dnia: ${dayName}`);
      const yk=appState.yearKey;
      schedData[yk][currentDay]={};
      appState.hours.forEach(h=>{schedData[yk][currentDay][h]={};});
      persistAll(); renderSchedule(); notify('🗑 Dzień wyczyszczony');
    }
  });
}
function exportPDF() {
  const vf = document.getElementById('validFrom').value;
  if (!validFromDates[appState.yearKey]) validFromDates[appState.yearKey] = {};
  validFromDates[appState.yearKey][currentDay] = vf;

  // Wypełnij nagłówek PDF
  const schoolFull = appState.school?.name || appState.school?.short || '';
  const schoolShort = appState.school?.short || '';
  const schoolLabel = schoolFull && schoolShort && schoolFull !== schoolShort
    ? `${schoolFull} (${schoolShort})`
    : schoolFull || schoolShort || 'SalePlan';
  const yearLabel  = appState.yearLabel || appState.yearKey || '';
  const dayLabel   = (appState.days || [])[currentDay] || '';
  const vfFormatted = vf
    ? new Date(vf).toLocaleDateString('pl-PL', {day:'2-digit', month:'long', year:'numeric'})
    : 'nie podano';

  const hdr = document.getElementById('pdfHeader');
  hdr.querySelector('.pdf-school').textContent = schoolLabel;
  hdr.querySelector('.pdf-year').textContent   = `Rok szkolny ${yearLabel}`;
  hdr.querySelector('.pdf-day').textContent    = `· ${dayLabel}`;
  hdr.querySelector('.pdf-from').textContent   = vfFormatted;

  // Build filename — skrót_dnia_rok_szkolny_v
  const DAY_ABBR = ['PN','WT','SR','CZW','PT'];
  const dayAbbr  = DAY_ABBR[currentDay] || String(currentDay+1);
  const yearShort = yearLabel.replace(/20(\d{2})\/20(\d{2})/, '$1-$2')
                             .replace(/\//g, '-');
  const vfDate   = vf ? vf.replace(/-/g, '').slice(2) : '';
  document.title = `${dayAbbr}_${yearShort}_v`;

  window.print();
  document.title = 'SalePlan — Plan Sal Zajęciowych';
}
(function(){const _vf=document.getElementById('validFrom');if(_vf)_vf.addEventListener('change',()=>{
  if(!appState)return;
  if(!validFromDates[appState.yearKey])validFromDates[appState.yearKey]={};
  validFromDates[appState.yearKey][currentDay]=_vf.value;
});})();

// ================================================================
//  HELPERS
// ================================================================
// ================================================================
//  MERGE CLASS NAMES — łączy np. ['4A MN','4B MN','4C MN'] → ['4ABC MN']
// ================================================================
function mergeClassNames(classes) {
  if (!classes || classes.length <= 1) return classes || [];

  // Parsuj każdą klasę na {level, letter, group}
  // Format: "4A MN" → {level:'4', letter:'A', group:'MN', orig:'4A MN'}
  // Format: "4A"    → {level:'4', letter:'A', group:'',   orig:'4A'}
  const parsed = classes.map(cls => {
    const m = String(cls).trim().match(/^(\d+)([A-Za-z])(?:\s+(.+))?$/);
    if (m) return { level: m[1], letter: m[2].toUpperCase(), group: (m[3]||'').trim(), orig: cls };
    return { level: null, letter: null, group: null, orig: cls };
  });

  // Grupuj po (level + group)
  const buckets = new Map();
  const unparsed = [];
  for (const p of parsed) {
    if (p.level === null) { unparsed.push(p.orig); continue; }
    const key = p.level + '|' + p.group;
    if (!buckets.has(key)) buckets.set(key, { level: p.level, group: p.group, letters: [] });
    const b = buckets.get(key);
    if (!b.letters.includes(p.letter)) b.letters.push(p.letter);
  }

  // Złóż wyniki: posortuj litery, sklej
  const merged = [];
  for (const [, b] of buckets) {
    b.letters.sort();
    const cls = b.level + b.letters.join('') + (b.group ? ' ' + b.group : '');
    merged.push(cls);
  }

  return [...merged, ...unparsed];
}

// ── Hamburger menu ──────────────────────────────────────────
function toggleMobileMenu() {
  const menu    = document.getElementById('mobileMenu');
  const overlay = document.getElementById('hmenuOverlay');
  const btn     = document.getElementById('hamburgerBtn');
  if (!menu) return;
  const opening = !menu.classList.contains('open');
  menu.classList.toggle('open', opening);
  menu.setAttribute('aria-hidden', String(!opening));
  if (overlay) overlay.classList.toggle('open', opening);
  if (btn)     btn.classList.toggle('open', opening);
}

// Zamknij menu klawiszem Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const menu = document.getElementById('mobileMenu');
    if (menu && menu.classList.contains('open')) toggleMobileMenu();
  }
});

function esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function sbSet(msg){document.getElementById('sbText').textContent=msg;setTimeout(()=>document.getElementById('sbText').textContent='Gotowy',2500);}
function notify(msg,warn){
  const el=document.createElement('div'); el.className='notif';
  el.style.borderColor=warn?'rgba(245,158,11,0.4)':'var(--border2)';
  el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),2900);
}

// ================================================================
//  THEME
// ================================================================
function applyTheme(theme) {
  const isLight = theme === 'light';
  document.body.classList.toggle('light', isLight);
  const icon = isLight ? '☀️' : '🌙';
  // sync all theme toggle buttons (topbar + wizard)
  ['themeToggle','themeToggleWizard'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.textContent = icon;
  });
  // update PWA theme-color meta
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isLight ? '#f0f4fa' : '#080c12';
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light');
  const next = isLight ? 'dark' : 'light';
  localStorage.setItem('sp_theme', next);
  applyTheme(next);
}

// ================================================================
//  INIT
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
  loadAll();
  initCookieBanner();
  initTermsBanner();
  initImportDragDrop();
  // Autosave szkicu przy zmianie pól kreatora (krok 0 i 1)
  ['wSchoolName','wSchoolShort','wSchoolPhone','wSchoolWeb','wYear','wHours'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      clearTimeout(_draftTimer);
      _draftTimer = setTimeout(wizardSaveDraft, 3000);
    });
  });
  applyTheme(localStorage.getItem('sp_theme') || 'dark');
  if (!appState) {
    openWizardFirst();
  } else {
    const yk=appState.yearKey;
    if (!schedData[yk]) schedData[yk]={};
    (appState.days||DAYS_DEFAULT).forEach((_,i)=>{
      if (!schedData[yk][i]) schedData[yk][i]={};
      (appState.hours||[]).forEach(h=>{if(!schedData[yk][i][h])schedData[yk][i][h]={};});
    });
    mountApp();
  }
});

// ================================================================
//  HOMEROOM (gospodarz sali)
// ================================================================
let _hrKey = null;

function openHomeroomModal(key) {
  _hrKey = key;
  const cols = flattenColumns(appState.floors);
  const col  = cols.find(c => colKey(c) === key);
  const bld  = (appState.buildings||[])[col?.floor?.buildingIdx||0];
  const hr   = (appState.homerooms||{})[key]||{};

  document.getElementById('hrModalSub').textContent =
    `${bld ? bld.name+' · ' : ''}${col?.floor.name||''} › Sala ${col?.room.num||'?'}`;

  // Build class options — only "cała klasa" or whole-class entries
  const classes = (appState.classes||[])
    .slice()
    .sort((a,b) => a.name.localeCompare(b.name,'pl',{numeric:true,sensitivity:'base'})
                || (a.group||'').localeCompare(b.group||'','pl',{sensitivity:'base'}));
  let clsOpts = '<option value="">— brak —</option>';
  const seen = new Set();
  classes.filter(c=>c.name).forEach(c => {
    const val = c.abbr||c.name;
    if (!seen.has(val)) {
      seen.add(val);
      const lbl = c.group && c.group.toLowerCase() !== 'cała klasa'
        ? `${c.name} — ${c.group}` : c.name;
      clsOpts += `<option value="${esc(val)}"${val===(hr.className||'')?  ' selected':''}>${esc(lbl)}</option>`;
    }
  });
  document.getElementById('hrClass').innerHTML = clsOpts;
  document.getElementById('hrTeacher').innerHTML = buildTeacherSelectOptions(hr.teacherAbbr||'');

  // Drugi gospodarz — niezależna lista opcji
  let clsOpts2 = '<option value="">— brak —</option>';
  const seen2 = new Set();
  classes.filter(cl=>cl.name).forEach(cl => {
    const val = cl.abbr||cl.name;
    if (!seen2.has(val)) {
      seen2.add(val);
      const lbl = cl.group && cl.group.toLowerCase() !== 'cala klasa' && cl.group.toLowerCase() !== 'ca\u0142a klasa'
        ? cl.name + ' — ' + cl.group : cl.name;
      const sel2 = val === (hr.className2||'') ? ' selected' : '';
      clsOpts2 += '<option value="' + esc(val) + '"' + sel2 + '>' + esc(lbl) + '</option>';
    }
  });
  document.getElementById('hrClass2').innerHTML  = clsOpts2;
  document.getElementById('hrTeacher2').innerHTML = buildTeacherSelectOptions(hr.teacherAbbr2||'');
  document.getElementById('hrClass2').value   = hr.className2   || '';
  document.getElementById('hrTeacher2').value = hr.teacherAbbr2 || '';

  // Pokaż/ukryj sekcję drugiego
  const hasSecond = !!(hr.className2 || hr.teacherAbbr2);
  document.getElementById('hrSecondSection').style.display = hasSecond ? '' : 'none';
  document.getElementById('hrToggle2Btn').textContent = hasSecond ? '− Usuń drugiego gospodarza' : '＋ Dodaj drugiego gospodarza';

  document.getElementById('homeroomModal').classList.add('show');
  document.getElementById('hrClass').focus();
}

function closeHomeroomModal() {
  document.getElementById('homeroomModal').classList.remove('show');
  _hrKey = null;
}

function saveHomeroom() {
  if (!_hrKey) return;
  if (!appState.homerooms) appState.homerooms = {};
  const cls2  = document.getElementById('hrClass2').value;
  const tch2  = document.getElementById('hrTeacher2').value;
  appState.homerooms[_hrKey] = {
    className:    document.getElementById('hrClass').value,
    teacherAbbr:  document.getElementById('hrTeacher').value,
    className2:   cls2  || '',
    teacherAbbr2: tch2  || '',
  };
  persistAll();
  closeHomeroomModal();
  renderSchedule();
  notify('✓ Gospodarz sali zapisany');
}

function hrToggleSecond() {
  const sec = document.getElementById('hrSecondSection');
  const btn = document.getElementById('hrToggle2Btn');
  const visible = sec.style.display !== 'none';
  if (visible) {
    // Ukryj i wyczyść dane drugiego
    sec.style.display = 'none';
    btn.textContent = '＋ Dodaj drugiego gospodarza';
    document.getElementById('hrClass2').value   = '';
    document.getElementById('hrTeacher2').value = '';
  } else {
    sec.style.display = '';
    btn.textContent = '− Usuń drugiego gospodarza';
  }
}

function clearHomeroom() {
  if (!_hrKey) return;
  if (appState.homerooms) delete appState.homerooms[_hrKey];
  persistAll();
  closeHomeroomModal();
  renderSchedule();
  notify('🗑 Gospodarz sali usunięty');
}

(function(){var _cd=document.getElementById('cookieDetailModal');if(_cd)_cd.addEventListener('click',e=>{if(e.target===_cd)closeCookieDetail();});})();
(function(){var _am=document.getElementById('aboutModal');if(_am)_am.addEventListener('click',e=>{if(e.target===_am)closeAboutModal();});})();
(function(){var _hm=document.getElementById('homeroomModal');if(_hm)_hm.addEventListener('click',e=>{if(e.target===_hm)closeHomeroomModal();});})();

// ================================================================
//  FLOOR / ROOM IMPORT (step 3)
// ================================================================
function handleFloorImportDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer?.files?.[0];
  if (file) readFloorTxtFile(file);
}
function handleFloorImportFile(input) {
  if (input.files?.[0]) readFloorTxtFile(input.files[0]);
}
function readFloorTxtFile(file) {
  const reader = new FileReader();
  reader.onload = e => importFloorsFromText(e.target.result);
  reader.onerror = () => notify('⚠ Błąd odczytu pliku', true);
  reader.readAsText(file, 'utf-8');
}

function importFloorsFromText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const multiBuilding = wBuildings.length > 1;
  let added = 0, skipped = 0;

  lines.forEach(line => {
    // split on ; or ,
    const parts = line.split(/[;,]/).map(p => p.trim());

    let buildingName, floorName, segName, roomNum, roomSub;

    if (multiBuilding) {
      // format: budynek;piętro;segment;sala;opis
      [buildingName, floorName, segName, roomNum, roomSub] = parts;
    } else {
      // format: piętro;segment;sala;opis
      [floorName, segName, roomNum, roomSub] = parts;
      buildingName = wBuildings[0]?.name || '';
    }

    if (!roomNum) { skipped++; return; }

    // Find or create the building index
    let buildingIdx = 0;
    if (multiBuilding && buildingName) {
      const bi = wBuildings.findIndex(b =>
        b.name.trim().toLowerCase() === buildingName.trim().toLowerCase()
      );
      if (bi >= 0) buildingIdx = bi;
    }

    // Find or create floor matching name + buildingIdx
    const fName = (floorName || 'Parter').trim();
    let floor = wFloors.find(f =>
      f.name.trim() === fName && (f.buildingIdx||0) === buildingIdx
    );
    if (!floor) {
      const color = FLOOR_COLORS[wFloors.length % FLOOR_COLORS.length];
      floor = { name: fName, color, buildingIdx, segments: [] };
      wFloors.push(floor);
    }

    // Find or create segment
    const sName = (segName || '').trim();
    let seg = floor.segments.find(s => s.name.trim() === sName);
    if (!seg) {
      seg = { name: sName, rooms: [] };
      floor.segments.push(seg);
    }

    // Check duplicate room number in this segment
    if (seg.rooms.some(r => r.num.trim() === roomNum.trim())) {
      skipped++; return;
    }

    seg.rooms.push({ num: roomNum.trim(), sub: (roomSub||'').trim() });
    added++;
  });

  renderFloorList();

  const prev = document.getElementById('floorImportPreview');
  if (prev) {
    prev.textContent = `✓ Dodano ${added} sal${added===1?'ę':added<5?'e':''}${skipped ? ` · ${skipped} pominięto (duplikaty / błędy)` : ''}`;
    prev.style.color = added > 0 ? 'var(--green)' : 'var(--red)';
  }
  if (added > 0) notify(`✓ Zaimportowano ${added} sal z pliku`);
}

// ================================================================
//  QUICK-ADD (from edit modal)
// ================================================================
function toggleQuickAdd(type) {
  const panel = document.getElementById(type === 'teacher' ? 'qaPanelTeacher' : 'qaPanelClass');
  const btn   = document.getElementById(type === 'teacher' ? 'qaToggleTeacher' : 'qaToggleClass');
  const isOpen = panel.classList.toggle('open');
  btn.querySelector('.qa-icon').textContent = isOpen ? '✕' : '＋';
  btn.style.color = isOpen ? 'var(--red)' : '';
  if (isOpen) {
    if (type === 'teacher') {
      document.getElementById('qaTeacherFirst').value = '';
      document.getElementById('qaTeacherLast').value  = '';
      document.getElementById('qaTeacherAbbr').value  = '';
      document.getElementById('qaTeacherFirst').focus();
    } else {
      document.getElementById('qaClassName').value  = '';
      document.getElementById('qaClassAbbr').value  = '';
      document.getElementById('qaClassGroup').value = '';
      document.getElementById('qaClassName').focus();
    }
  }
}

function qaAutoAbbr() {
  const first = document.getElementById('qaTeacherFirst').value;
  const last  = document.getElementById('qaTeacherLast').value;
  const existing = (appState?.teachers||[]).map(t=>t.abbr);
  document.getElementById('qaTeacherAbbr').value = ensureUniqueAbbr(genAbbr(first, last), existing);
}

function qaAutoClassAbbr() {
  const name    = document.getElementById('qaClassName').value.trim();
  const group   = document.getElementById('qaClassGroup')?.value.trim() || '';
  const abbrInp = document.getElementById('qaClassAbbr');
  // Autouzupełnij jeśli pole jest puste lub poprzednio auto-wygenerowane
  if (!abbrInp.value || abbrInp.dataset.auto === '1') {
    const generated = autoClassAbbr(name, group);
    abbrInp.value       = generated;
    abbrInp.dataset.auto = '1';
  }
}

function qaAddTeacher() {
  const first = document.getElementById('qaTeacherFirst').value.trim();
  const last  = document.getElementById('qaTeacherLast').value.trim();
  let   abbr  = document.getElementById('qaTeacherAbbr').value.trim().toUpperCase();

  if (!first && !last) { notify('⚠ Wpisz imię lub nazwisko', true); return; }
  if (!abbr) abbr = ensureUniqueAbbr(genAbbr(first, last), (appState?.teachers||[]).map(t=>t.abbr));

  // Check duplicate abbr
  if ((appState.teachers||[]).some(t => t.abbr === abbr)) {
    notify('⚠ Skrót "' + abbr + '" już istnieje — zmień go', true); return;
  }

  const teacher = { first, last, abbr };
  if (!appState.teachers) appState.teachers = [];
  appState.teachers.push(teacher);
  persistAll();

  // Refresh select and pick the new teacher
  document.getElementById('inpTeacher').innerHTML = buildTeacherSelectOptions(abbr);
  toggleQuickAdd('teacher');
  notify('✓ Dodano nauczyciela: ' + abbr + ' — ' + [first,last].filter(Boolean).join(' '));
}

function qaAddClass() {
  const name  = normalizeClassName(document.getElementById('qaClassName').value);
  let   abbr  = document.getElementById('qaClassAbbr').value.trim().toUpperCase();
  const group = document.getElementById('qaClassGroup').value.trim() || 'cała klasa';

  if (!name) { notify('⚠ Wpisz nazwę klasy', true); return; }
  if (!abbr) abbr = autoClassAbbr(name, group);

  // Check duplicate (same name + group)
  if ((appState.classes||[]).some(c => c.name.toLowerCase()===name.toLowerCase() && c.group.toLowerCase()===group.toLowerCase())) {
    notify('⚠ Taka klasa/grupa już istnieje', true); return;
  }

  const entry = { name, abbr, group };
  if (!appState.classes) appState.classes = [];
  appState.classes.push(entry);
  persistAll();

  // Po dodaniu — dodaj też do multiClassList (zajęcia międzyoddziałowe)
  if (!_selectedClasses.includes(abbr)) {
    _selectedClasses.push(abbr);
    renderMultiClassList(_selectedClasses);
  }
  toggleQuickAdd('class');
  notify('✓ Dodano: ' + name + ' — ' + group);
}

// ================================================================
//  PWA — SERVICE WORKER & INSTALL PROMPT
// ================================================================
let _pwaPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        // Sprawdź aktualizację co 60 sekund
        setInterval(() => reg.update(), 60000);

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            // SW zainstalowany i gotowy — pokaż banner
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              _showSwUpdateBanner();
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed:', err));

    // ── Listener na wiadomości z Service Workera ──────────────────
    // SW wysyła { type: 'SW_UPDATED' } w activate() po przejęciu klientów.
    // To jest główna ścieżka powiadomień w Chrome/Edge/Firefox.
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SW_UPDATED') {
        _showSwUpdateBanner();
      }
    });

    // ── Fallback: controllerchange ────────────────────────────────
    // Nowy SW przejął kontrolę — oznacza że aktualizacja jest aktywna.
    // Działa np. w Safari gdzie postMessage z SW może nie dotrzeć.
    let _firstController = navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Ignoruj pierwsze przypisanie kontrolera (cold start)
      if (!_firstController) {
        _firstController = navigator.serviceWorker.controller;
        return;
      }
      _showSwUpdateBanner();
    });
  });
}

// ── Banner aktualizacji ───────────────────────────────────────────

let _swUpdateBannerShown = false; // zapobiega wielokrotnemu pokazaniu

function _showSwUpdateBanner() {
  if (_swUpdateBannerShown) return;
  _swUpdateBannerShown = true;
  const banner = document.getElementById('swUpdateBanner');
  if (banner) {
    banner.classList.add('show');
  } else {
    // Fallback — notify jeśli DOM nie jest gotowy
    notify('🔄 Dostępna nowa wersja — odśwież stronę');
  }
}

function swUpdateReload() {
  // Przeładuj stronę — nowy SW przejmie kontrolę i zaserwuje świeżą wersję
  window.location.reload();
}

function swUpdateDismiss() {
  const banner = document.getElementById('swUpdateBanner');
  if (banner) banner.classList.remove('show');
  // Nie kasujemy _swUpdateBannerShown — baner nie pojawi się ponownie w tej sesji
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;
  // Show banner after a short delay so app has time to load
  setTimeout(() => {
    if (!localStorage.getItem('sp_pwa_dismissed')) {
      document.getElementById('pwaInstallBanner').classList.add('show');
    }
  }, 3000);
});

window.addEventListener('appinstalled', () => {
  document.getElementById('pwaInstallBanner').classList.remove('show');
  notify('✓ SalePlan zainstalowany na urządzeniu!');
});


// ================================================================
//  PWA — INSTALL
// ================================================================

function pwaInstall() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice
    .then(result => {
      if (result.outcome === 'accepted') notify('✓ SalePlan zainstalowany!');
      _pwaPrompt = null;
    })
    .catch(() => { _pwaPrompt = null; }); // BUG-C fix: obsłuż odrzucenie promise
}

function pwaDismiss() {
  document.getElementById('pwaInstallBanner').classList.remove('show');
  localStorage.setItem('sp_pwa_dismissed', '1');
}


// ================================================================
//  REGULAMIN
// ================================================================
const TERMS_KEY = 'sp_terms_accepted';

// ══════════════════════════════════════════════════════════════════
//  PANEL USTAWIEŃ SZKOŁY
// ══════════════════════════════════════════════════════════════════

let _settingsTab = 'classes';

function openSettingsPanel(tab) {
  if (!appState) return;
  _settingsTab = tab || _settingsTab || 'classes';
  document.getElementById('settingsPanelOverlay').classList.add('show');
  document.getElementById('settingsPanel').classList.add('open');
  _renderSettingsTab(_settingsTab);
}
function closeSettingsPanel() {
  document.getElementById('settingsPanelOverlay').classList.remove('show');
  document.getElementById('settingsPanel').classList.remove('open');
}
function switchSettingsTab(tab) {
  _settingsTab = tab;
  document.querySelectorAll('.settings-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  _renderSettingsTab(tab);
}
function _renderSettingsTab(tab) {
  const body = document.getElementById('settingsBody');
  if (!body) return;
  switch(tab) {
    case 'classes':   body.innerHTML = _spBuildClasses();   break;
    case 'teachers':  body.innerHTML = _spBuildTeachers();  break;
    case 'subjects':  body.innerHTML = _spBuildSubjects();  break;
    case 'hours':     body.innerHTML = _spBuildHours();     break;
    case 'rooms':     body.innerHTML = _spBuildRooms();     break;
    default:          body.innerHTML = '';
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/** Zwraca Set abbr klas/nauczycieli/przedmiotów używanych w planie */
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

// ── Zakładka KLASY ────────────────────────────────────────────────

function _spBuildClasses() {
  const usedAbbrs = _spUsedClasses();
  const all = appState.classes || [];
  // Opcje klas bazowych dla dropdownów
  const baseNames = [...new Set(all.filter(c => !c.baseClass).map(c => c.name))].sort();

  // Sortuj po nazwie klasy, a przy równej nazwie po grupie — zachowując oryginalny indeks
  const sortedCls = all
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.name || '').localeCompare(b.c.name || '', 'pl', { sensitivity: 'base' })
                 || (a.c.group || '').localeCompare(b.c.group || '', 'pl', { sensitivity: 'base' }));

  const rows = sortedCls.map(({ c, i }) => {
    const abbr    = c.abbr || c.name;
    const inUse   = usedAbbrs.has(abbr);
    const isSubgroup = c.group && c.group.trim().toLowerCase() !== 'cała klasa' && c.group.trim() !== '';
    const baseOpts = baseNames
      .filter(n => n !== c.name)
      .map(n => `<option value="${esc(n)}"${n === (c.baseClass||'') ? ' selected' : ''}>${esc(n)}</option>`)
      .join('');

    return `<div class="sp-row${inUse ? '' : ''}">
      <input class="sp-inp" style="max-width:72px;font-family:var(--mono);font-weight:700" value="${esc(c.name)}"
        placeholder="np. 1A" title="Nazwa klasy"
        onchange="spClassSetName(${i},this.value)">
      <input class="sp-inp-mono" value="${esc(abbr)}" maxlength="12" placeholder="skrót" title="Skrót (unikalny identyfikator)"
        onchange="spClassSetAbbr(${i},this.value)">
      <input class="sp-inp" value="${esc(c.group||'')}" placeholder="cała klasa / gr.1 / religia…" title="Nazwa grupy"
        onchange="spClassSetGroup(${i},this.value)">
      ${isSubgroup
        ? `<select class="class-base-sel" style="font-size:0.72rem;width:80px;flex-shrink:0" title="Klasa bazowa"
              onchange="spClassSetBase(${i},this.value)">
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

function spClassAdd() {
  if (!appState.classes) appState.classes = [];
  appState.classes.push({ name: '', abbr: '', group: 'cała klasa', baseClass: '' });
  persistAll();
  _renderSettingsTab('classes');
  // Pusty string sortuje się na górę — focusuj pierwszy wiersz
  setTimeout(() => {
    const firstRow = document.querySelector('#settingsBody .sp-row');
    if (firstRow) {
      firstRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      firstRow.querySelector('.sp-inp')?.focus();
    }
  }, 50);
}
function spClassSetName(i, val) {
  if (!appState.classes[i]) return;
  appState.classes[i].name = normalizeClassName(val);
  persistAll();
  _renderSettingsTab('classes');
}
function spClassSetAbbr(i, newAbbr) {
  const cls = appState.classes[i];
  if (!cls) return;
  const oldAbbr = cls.abbr || cls.name;
  newAbbr = newAbbr.trim().toUpperCase();
  if (!newAbbr || newAbbr === oldAbbr) return;
  // Sprawdź unikalność
  if (appState.classes.some((c, j) => j !== i && (c.abbr || c.name) === newAbbr)) {
    notify('⚠ Skrót „' + newAbbr + '" jest już używany przez inną klasę', true);
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
function spClassSetGroup(i, val) {
  if (!appState.classes[i]) return;
  appState.classes[i].group = val;
  persistAll();
  _renderSettingsTab('classes');
}
function spClassSetBase(i, val) {
  if (!appState.classes[i]) return;
  appState.classes[i].baseClass = val;
  persistAll();
}
function spClassDelete(i) {
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
      message: `Klasa „${abbr}" jest używana w planie. Usunięcie nie wyczyści istniejących wpisów — pojawią się jako nieznane. Kontynuować?`,
      confirmLabel: '🗑 Usuń mimo to',
      danger: true,
      onConfirm: doDelete
    });
  } else {
    doDelete();
  }
}


// ── Zakładka NAUCZYCIELE ─────────────────────────────────────────

function _spBuildTeachers() {
  const usedAbbrs = _spUsedTeachers();
  const all = appState.teachers || [];

  // Sortuj alfabetycznie po nazwisku, zachowując oryginalny indeks dla onchange/onclick
  const sorted = all
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.last || '').localeCompare(b.t.last || '', 'pl', { sensitivity: 'base' })
                 || (a.t.first || '').localeCompare(b.t.first || '', 'pl', { sensitivity: 'base' }));

  const rows = sorted.map(({ t, i }) => {
    const inUse = usedAbbrs.has(t.abbr);
    return `<div class="sp-row">
      <input class="sp-inp" value="${esc(t.last||'')}" placeholder="Nazwisko"
        title="Nazwisko" onchange="spTeacherSet(${i},'last',this.value)">
      <input class="sp-inp" value="${esc(t.first||'')}" placeholder="Imię" style="max-width:80px"
        title="Imię" onchange="spTeacherSet(${i},'first',this.value)">
      <input class="sp-inp-mono" value="${esc(t.abbr||'')}" maxlength="6" placeholder="SKR"
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

function spTeacherAdd() {
  if (!appState.teachers) appState.teachers = [];
  appState.teachers.push({ last: '', first: '', abbr: '' });
  persistAll();
  _renderSettingsTab('teachers');
  // Pusty string sortuje się na górę listy — focusuj pierwszy input (Nazwisko nowego wiersza)
  setTimeout(() => {
    const firstRow = document.querySelector('#settingsBody .sp-row');
    if (firstRow) {
      firstRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      firstRow.querySelector('.sp-inp')?.focus();
    }
  }, 50);
}
function spTeacherSet(i, field, val) {
  if (!appState.teachers[i]) return;
  appState.teachers[i][field] = val.trim();
  persistAll();
}
function spTeacherSetAbbr(i, newAbbr) {
  const t = appState.teachers[i];
  if (!t) return;
  const oldAbbr = t.abbr;
  newAbbr = newAbbr.trim().toUpperCase();
  if (!newAbbr || newAbbr === oldAbbr) return;
  if (appState.teachers.some((x, j) => j !== i && x.abbr === newAbbr)) {
    notify('⚠ Skrót „' + newAbbr + '" jest już używany przez innego nauczyciela', true);
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
function spTeacherDelete(i) {
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
      message: `Nauczyciel „${t.abbr}" ma zajęcia w planie. Wpisy pozostaną, ale nauczyciel nie będzie rozpoznawany. Kontynuować?`,
      confirmLabel: '🗑 Usuń mimo to', danger: true, onConfirm: doDelete
    });
  } else doDelete();
}

// ── Zakładka PRZEDMIOTY ───────────────────────────────────────────

function _spBuildSubjects() {
  const usedNames = _spUsedSubjects();
  const all = appState.subjects || [];

  // Sortuj alfabetycznie po nazwie — zachowując oryginalny indeks
  const sortedSubj = all
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.name || '').localeCompare(b.s.name || '', 'pl', { sensitivity: 'base' }));

  const rows = sortedSubj.map(({ s, i }) => {
    const inUse = usedNames.has(s.name);
    return `<div class="sp-row">
      <input class="sp-inp" value="${esc(s.name||'')}" placeholder="Nazwa przedmiotu"
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

function spSubjectAdd() {
  if (!appState.subjects) appState.subjects = [];
  appState.subjects.push({ name: '' });
  persistAll();
  _renderSettingsTab('subjects');
  // Pusty string sortuje się na górę — focusuj pierwszy wiersz
  setTimeout(() => {
    const firstRow = document.querySelector('#settingsBody .sp-row');
    if (firstRow) {
      firstRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      firstRow.querySelector('.sp-inp')?.focus();
    }
  }, 50);
}
function spSubjectSet(i, field, val) {
  if (!appState.subjects[i]) return;
  appState.subjects[i][field] = val.trim();
  persistAll();
}
function spSubjectDelete(i) {
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
      message: `Przedmiot „${s.name}" jest używany w planie. Wpisy pozostaną, ale przedmiot zniknie z podpowiedzi. Kontynuować?`,
      confirmLabel: '🗑 Usuń mimo to', danger: true, onConfirm: doDelete
    });
  } else doDelete();
}

// ── Zakładka GODZINY ─────────────────────────────────────────────

function _spBuildHours() {
  const hours     = appState.hours || [];
  const timeslots = appState.timeslots || [];

  const getTs = h => timeslots.find(t => String(t.label) === String(h)) || { label: h, start: '', end: '' };

  const rows = hours.map((h, i) => {
    const ts = getTs(h);
    const usedInPlan = Object.values(schedData[appState.yearKey] || {}).some(day =>
      Object.values(day[h] || {}).some(entry =>
        entry.teacherAbbr || entry.subject || (entry.classes||[]).length
      )
    );
    return `<div class="sp-hour-row">
      <span class="sp-hour-num">${esc(String(h))}</span>
      <input class="sp-time-inp" type="time" value="${esc(ts.start||'')}" title="Godzina rozpoczęcia"
        onchange="spHourSetTime(${i},'start',this.value)">
      <input class="sp-time-inp" type="time" value="${esc(ts.end||'')}" title="Godzina zakończenia"
        onchange="spHourSetTime(${i},'end',this.value)">
      <input class="sp-time-inp" value="${esc(ts.label !== h ? String(ts.label) : '')}" placeholder="etykieta (opcja)"
        title="Opcjonalna etykieta zastępująca numer" style="font-size:0.72rem"
        onchange="spHourSetLabel(${i},this.value)">
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
    <button class="btn btn-sm sp-add-btn" onclick="spHourAdd()">＋ Dodaj godzinę</button>`;
}

function spHourAdd() {
  const hours = appState.hours || [];
  const last  = hours.length ? Math.max(...hours.map(Number).filter(n => !isNaN(n))) : 0;
  const next  = last + 1;
  appState.hours = [...hours, next];
  const yk = appState.yearKey;
  // Dodaj pusty slot w schedData
  Object.keys(schedData[yk] || {}).forEach(di => {
    if (!schedData[yk][di][next]) schedData[yk][di][next] = {};
  });
  persistAll();
  renderSchedule();
  _renderSettingsTab('hours');
}
function spHourSetTime(i, field, val) {
  const h = (appState.hours || [])[i];
  if (h === undefined) return;
  if (!appState.timeslots) appState.timeslots = [];
  let ts = appState.timeslots.find(t => String(t.label) === String(h));
  if (!ts) { ts = { label: h, start: '', end: '' }; appState.timeslots.push(ts); }
  ts[field] = val;
  persistAll();
}
function spHourSetLabel(i, val) {
  const h = (appState.hours || [])[i];
  if (h === undefined) return;
  if (!appState.timeslots) appState.timeslots = [];
  let ts = appState.timeslots.find(t => String(t.label) === String(h) || t.label === h);
  if (!ts) { ts = { label: h, start: '', end: '' }; appState.timeslots.push(ts); }
  ts.label = val.trim() || h;
  persistAll();
}
function spHourDelete(i) {
  const hours = appState.hours || [];
  const h = hours[i];
  if (h === undefined) return;
  const yk = appState.yearKey;
  const usedInPlan = Object.values(schedData[yk] || {}).some(day =>
    Object.values(day[h] || {}).some(e => e.teacherAbbr || e.subject || (e.classes||[]).length)
  );
  const doDelete = () => {
    appState.hours = hours.filter((_, j) => j !== i);
    appState.timeslots = (appState.timeslots||[]).filter(t => String(t.label) !== String(h));
    // Usuń dane z schedData
    Object.keys(schedData[yk] || {}).forEach(di => { delete schedData[yk][di][h]; });
    persistAll();
    renderSchedule();
    _renderSettingsTab('hours');
    notify('🗑 Godzina ' + h + ' usunięta');
  };
  if (usedInPlan) {
    showConfirm({
      message: `Godzina ${h} ma zajęcia w planie — zostaną trwale usunięte. Kontynuować?`,
      confirmLabel: '🗑 Usuń z danymi', danger: true, onConfirm: doDelete
    });
  } else doDelete();
}

// ── Zakładka SALE ────────────────────────────────────────────────

function _spBuildRooms() {
  const floors = appState.floors || [];
  let tree = '';
  floors.forEach((floor, fi) => {
    tree += `<div class="sp-room-floor">📐 ${esc(floor.name)}</div>`;
    (floor.segments || []).forEach((seg, si) => {
      tree += `<div class="sp-room-seg">└ ${esc(seg.name)}</div>`;
      (seg.rooms || []).forEach(room => {
        tree += `<div class="sp-room-num">• Sala ${esc(room.num)}${room.sub ? ' — ' + esc(room.sub) : ''}</div>`;
      });
    });
  });
  const totalRooms = flattenColumns(floors).length;
  return `<div class="sp-section-title">Struktura sal</div>
    <div class="sp-info-box">
      <strong>${totalRooms} sal</strong> w ${floors.length} piętrach/obszarach.<br>
      Aby zmienić strukturę pięter, segmentów i sal, użyj kreatora roku szkolnego.
    </div>
    <div class="sp-info-box sp-room-tree" style="max-height:340px;overflow-y:auto">${tree || 'Brak danych.'}</div>
    <button class="btn btn-sm sp-add-btn" onclick="openEditWizard();closeSettingsPanel()">✏️ Edytuj w kreatorze</button>`;
}

function initTermsBanner() {
  if (!localStorage.getItem(TERMS_KEY)) {
    document.getElementById('termsBanner').classList.add('show');
  }
}

function acceptTerms() {
  localStorage.setItem(TERMS_KEY, '1');
  document.getElementById('termsBanner').classList.remove('show');
}

function showTermsModal() {
  document.getElementById('termsModal').classList.add('show');
}

function closeTermsModal() {
  document.getElementById('termsModal').classList.remove('show');
}

// Otwiera pełny regulamin z baneru (baner pozostaje w tle)
function showTermsModalFromBanner() {
  document.getElementById('termsModal').classList.add('show');
}

// Zamknij regulamin klawiszem Escape (nie zamyka baneru — wymaga akceptacji)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('termsModal').classList.contains('show')) {
      closeTermsModal();
    }
  }
});
// Klik w tło zamyka modal regulaminu (nie baner)
(function(){
  var m = document.getElementById('termsModal');
  if (m) m.addEventListener('click', e => { if (e.target === m) closeTermsModal(); });
})();


// ================================================================
//  O PROGRAMIE
// ================================================================
const APP_VERSION = '2.5.5';
const APP_LAST_UPDATE = '2026-04-23';

function showAboutModal() {
  const vEl = document.getElementById('aboutVersionText');
  if (vEl) vEl.textContent = APP_VERSION;
  const dEl = document.getElementById('aboutUpdateDate');
  if (dEl) {
    try {
      dEl.textContent = new Date(APP_LAST_UPDATE).toLocaleDateString('pl-PL', {day:'numeric',month:'long',year:'numeric'});
    } catch(e) {
      dEl.textContent = APP_LAST_UPDATE;
    }
  }
  document.getElementById('aboutModal').classList.add('show');
}

function closeAboutModal() {
  document.getElementById('aboutModal').classList.remove('show');
}


