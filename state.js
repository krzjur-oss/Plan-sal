// ================================================================
//  STATE.JS — stałe i globalny stan aplikacji
//  Importowany przez wszystkie pozostałe moduły.
//  Nie zawiera żadnej logiki — tylko deklaracje.
// ================================================================

// ── Ciasteczka / RODO ──────────────────────────────────────────
export const COOKIE_KEY = 'sp_cookies_accepted';

// ── Dane aplikacji ─────────────────────────────────────────────
export const DAYS_DEFAULT     = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek'];
export const FLOOR_COLORS     = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
export const BUILDING_COLORS  = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
export const BUILDING_LETTERS = ['A','B','C','D','E','F','G','H'];
export const TOTAL_STEPS      = 7;

// ── Stan główny aplikacji ──────────────────────────────────────
export let appState       = null;
export let schedData      = {};
export let validFromDates = {};
export let archive        = [];
export let currentDay     = 0;
export let currentAssignDay = 0;

// ── Settery stanu głównego (używane z innych modułów) ──────────
export function setAppState(v)        { appState       = v; }
export function setSchedData(v)       { schedData      = v; }
export function setValidFromDates(v)  { validFromDates = v; }
export function setArchive(v)         { archive        = v; }
export function setCurrentDay(v)      { currentDay     = v; }
export function setCurrentAssignDay(v){ currentAssignDay = v; }

// ── Stan kreatora (wizard) ─────────────────────────────────────
export let wBuildings   = [];
export let wFloors      = [];
export let wClasses     = [];
export let wTeachers    = []; // [{first, last, abbr}]
export let wAssignments = {};
export let wSubjects    = []; // [{name, abbr}]
export let wTimeslots   = []; // [{label, start, end}]
export let wStep        = 0;

export function setWBuildings(v)   { wBuildings   = v; }
export function setWFloors(v)      { wFloors      = v; }
export function setWClasses(v)     { wClasses     = v; }
export function setWTeachers(v)    { wTeachers    = v; }
export function setWAssignments(v) { wAssignments = v; }
export function setWSubjects(v)    { wSubjects    = v; }
export function setWTimeslots(v)   { wTimeslots   = v; }
export function setWStep(v)        { wStep        = v; }

// ── Stan edycji modalnej ───────────────────────────────────────
export let _mDay  = undefined;
export let _mHour = undefined;
export let _mKey  = undefined;
export let _selectedClasses = [];

export function setMDay(v)             { _mDay            = v; }
export function setMHour(v)           { _mHour           = v; }
export function setMKey(v)            { _mKey            = v; }
export function setSelectedClasses(v) { _selectedClasses = v; }

// ── Stan widoku (Sale / Nauczyciel / Klasa) ────────────────────
export let _viewMode   = 'rooms'; // 'rooms' | 'teacher' | 'class'
export let _viewFilter = '';      // skrót nauczyciela lub klasy

export function setViewMode(v)   { _viewMode   = v; }
export function setViewFilter(v) { _viewFilter = v; }

// ── Stos undo / redo ──────────────────────────────────────────
export const UNDO_LIMIT = 30;
export let _undoStack = []; // [{snapshot, label, yearKey, day}]
export let _redoStack = []; // [{snapshot, label, yearKey, day}]

export function setUndoStack(v) { _undoStack = v; }
export function setRedoStack(v) { _redoStack = v; }
