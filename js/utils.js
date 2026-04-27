// ================================================================
//  UTILS.JS — funkcje pomocnicze bez zależności zewnętrznych
//  Zależy od: state.js
//  Eksportuje: funkcje cookie, pomoc, kreator-sidebar, undo/redo,
//              generator skrótów
// ================================================================

import {
  COOKIE_KEY,
  UNDO_LIMIT,
  _undoStack, setUndoStack,
  _redoStack, setRedoStack,
  appState, schedData,
  currentDay,
} from './state.js';

// ── Zewnętrzne funkcje (z innych modułów — zostaną podmienione
//    przez app.js po pełnym załadowaniu wszystkich modułów) ─────
// Używamy globalnych referencji żeby uniknąć cyklicznych importów
// na etapie refaktoryzacji. Po zakończeniu wszystkich etapów
// zastąpione właściwymi importami.
function _persistAll()      { if (typeof persistAll      === 'function') persistAll(); }
function _switchDay(d)      { if (typeof switchDay       === 'function') switchDay(d); }
function _renderSchedule()  { if (typeof renderSchedule  === 'function') renderSchedule(); }
function _updateStatusBar() { if (typeof updateStatusBar === 'function') updateStatusBar(); }
function _sbSet(msg)        { if (typeof sbSet           === 'function') sbSet(msg); }


// ================================================================
//  CIASTECZKA / RODO
// ================================================================
export function initCookieBanner() {
  if (!localStorage.getItem(COOKIE_KEY)) {
    setTimeout(() => {
      document.getElementById('cookieBanner')?.classList.add('show');
    }, 1500);
  }
}

export function acceptCookies() {
  localStorage.setItem(COOKIE_KEY, '1');
  document.getElementById('cookieBanner')?.classList.remove('show');
  document.getElementById('cookieDetailModal')?.classList.remove('show');
}

export function showCookieDetail() {
  document.getElementById('cookieDetailModal')?.classList.add('show');
}

export function closeCookieDetail() {
  document.getElementById('cookieDetailModal')?.classList.remove('show');
}


// ================================================================
//  PANEL POMOCY APLIKACJI
// ================================================================
export function toggleAppHelp() {
  const panel = document.getElementById('appHelpPanel');
  const btn   = document.getElementById('tutTriggerBtn');
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  if (btn) btn.classList.toggle('active', !isOpen);
}

export function closeAppHelp() {
  const panel = document.getElementById('appHelpPanel');
  const btn   = document.getElementById('tutTriggerBtn');
  if (panel) panel.classList.remove('open');
  if (btn)   btn.classList.remove('active');
}


// ================================================================
//  PANEL INSTRUKCJI KREATORA (pasek boczny wp0..wp6)
// ================================================================
export function wpUpdate(step) {
  for (let i = 0; i < 7; i++) {
    const el = document.getElementById('wp' + i);
    if (el) el.classList.toggle('active', i === step);
  }
}


// ================================================================
//  UNDO / REDO
// ================================================================
export function undoPush(label) {
  const yk = appState?.yearKey;
  if (!yk) return;

  _undoStack.push({
    label,
    yearKey: yk,
    day:      currentDay,
    snapshot: structuredClone(schedData[yk]?.[currentDay] || {}),
  });
  if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
  setRedoStack([]); // nowa operacja kasuje redo
  _undoUpdateUI();
}

export function undoApply(stack, targetStack, action) {
  if (!stack.length || !appState) return;
  const entry = stack.pop();
  const yk    = appState.yearKey;

  // Zapisz aktualny stan na docelowy stos
  targetStack.push({
    label:    entry.label,
    yearKey:  yk,
    day:      entry.day,
    snapshot: structuredClone(schedData[yk]?.[entry.day] || {}),
  });

  // Przywróć snapshot
  if (!schedData[yk]) schedData[yk] = {};
  schedData[yk][entry.day] = structuredClone(entry.snapshot);
  _persistAll();

  // Przełącz na właściwy dzień jeśli potrzeba
  if (entry.day !== currentDay) _switchDay(entry.day);

  _renderSchedule();
  _updateStatusBar();
  _sbSet(`${action}: ${entry.label}`);
  _undoUpdateUI();
}

export function undoAction() {
  undoApply(_undoStack, _redoStack, '↩ Cofnięto');
}

export function redoAction() {
  undoApply(_redoStack, _undoStack, '↪ Przywrócono');
}

export function _undoUpdateUI() {
  const canUndo = _undoStack.length > 0;
  const canRedo = _redoStack.length > 0;

  const btnU = document.getElementById('btnUndo');
  const btnR = document.getElementById('btnRedo');
  if (btnU) {
    btnU.disabled = !canUndo;
    btnU.title    = canUndo
      ? `Cofnij: ${_undoStack[_undoStack.length - 1].label} (Ctrl+Z)`
      : 'Brak operacji do cofnięcia';
  }
  if (btnR) {
    btnR.disabled = !canRedo;
    btnR.title    = canRedo
      ? `Przywróć: ${_redoStack[_redoStack.length - 1].label} (Ctrl+Y)`
      : 'Brak operacji do przywrócenia';
  }

  // Przyciski w menu hamburger
  const hmU = document.getElementById('hmenuUndo');
  const hmR = document.getElementById('hmenuRedo');
  if (hmU) { hmU.disabled = !canUndo; hmU.style.opacity = canUndo ? '1' : '0.4'; }
  if (hmR) { hmR.disabled = !canRedo; hmR.style.opacity = canRedo ? '1' : '0.4'; }
}


// ================================================================
//  GENERATOR SKRÓTÓW NAUCZYCIELA
// ================================================================

/**
 * Generuje skrót z imienia i nazwiska.
 * Przykład: Krzysztof Jureczek → KJUR
 *           Jan Kowalski-Nowak → JKOWN (2+1 z członu)
 */
export function genAbbr(first, last) {
  const f = (first || '').trim();
  const l = (last  || '').trim();
  if (!f && !l) return '';

  const fLetter = f ? f[0].toUpperCase() : '';
  // Obsługa nazwisk dwuczłonowych (myślnik lub spacja)
  const parts = l.split(/[-\s]+/).filter(Boolean);
  let lPart = '';
  if (parts.length >= 2) {
    lPart = (parts[0].slice(0, 2) + parts[1][0]).toUpperCase();
  } else if (parts.length === 1) {
    lPart = parts[0].slice(0, 3).toUpperCase();
  }
  return fLetter + lPart;
}

/**
 * Zapewnia unikalność skrótu — dodaje cyfry jeśli potrzeba.
 * Przykład: KJUR → KJUR2 → KJUR3 …
 */
export function ensureUniqueAbbr(abbr, existingAbbrs) {
  if (!existingAbbrs.includes(abbr)) return abbr;
  let i = 2;
  while (existingAbbrs.includes(abbr + i)) i++;
  return abbr + i;
}
