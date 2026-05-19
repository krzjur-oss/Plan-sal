// ================================================================
//  HELPERS.JS — funkcje pomocnicze UI i struktury danych
//
//  Zawiera:
//   • esc, notify, sbSet               — UI micro-utilities
//   • showConfirm, _dismissConfirm,
//     _confirmKeydown                  — modal potwierdzenia
//   • colKey, flattenColumns,
//     invalidateColumnCache            — struktura sal (kolumny)
//   • getTeacherByAbbr,
//     teacherDisplayName,
//     resolveClassName,
//     buildTeacherSelectOptions,
//     buildClassSelectOptions          — lookup nauczyciel/klasa
//   • mergeClassNames                  — scalanie skrótów klas
//
//  Zależy od: state.js (appState)
//  NIE zależy od: wizard*.js, schedule.js, settings.js
// ================================================================

import { appState } from './state.js';

// ================================================================
//  MICRO UI
// ================================================================

/** Bezpieczne HTML-escape ciągu znaków */
export function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tymczasowy komunikat w stopce statusu (2,5 s) */
let _sbTimer = null;
export function sbSet(msg) {
  document.getElementById('sbText').textContent = msg;
  clearTimeout(_sbTimer);
  _sbTimer = setTimeout(() => document.getElementById('sbText').textContent = 'Gotowy', 2500);
}

// ── Kolejka toastów — zapobiega nakładaniu się powiadomień ────────
const _TOAST_DURATION  = 2900;  // ms — jak długo toast jest widoczny
const _TOAST_HEIGHT    = 50;    // px — szacowana wysokość tosta (padding + linia tekstu)
const _TOAST_GAP       = 8;     // px — odstęp między toastami
const _TOAST_BASE      = 42;    // px — bottom dla pierwszego tosta (nad statusbarem)
const _MAX_TOASTS      = 4;     // maksymalna liczba jednoczesnych toastów
let   _activeToasts    = [];    // [ { el, timer } ]

/** Przelicza pozycję bottom dla każdego aktywnego tosta */
function _repositionToasts() {
  _activeToasts.forEach((t, i) => {
    t.el.style.bottom = (_TOAST_BASE + i * (_TOAST_HEIGHT + _TOAST_GAP)) + 'px';
  });
}

/** Toast powiadomienie (2,9 s); warn=true → żółta ramka */
export function notify(msg, warn) {
  // Ogranicz liczbę jednoczesnych toastów — usuń najstarszy jeśli przekroczono limit
  if (_activeToasts.length >= _MAX_TOASTS) {
    const oldest = _activeToasts[0];
    clearTimeout(oldest.timer);
    oldest.el.remove();
    _activeToasts.shift();
  }

  const el = document.createElement('div');
  el.className = 'notif';
  el.style.borderColor = warn ? 'rgba(245,158,11,0.4)' : 'var(--border2)';
  el.textContent = msg;
  document.body.appendChild(el);

  const entry = { el, timer: null };
  _activeToasts.push(entry);
  _repositionToasts();

  entry.timer = setTimeout(() => {
    el.remove();
    _activeToasts = _activeToasts.filter(t => t !== entry);
    _repositionToasts();
  }, _TOAST_DURATION);
}

// ================================================================
//  MODAL POTWIERDZENIA
// ================================================================

let _lastFocusConfirm = null; // element fokusowany przed otwarciem confirmModal

/**
 * Wyświetla modal z przyciskami Potwierdź / Anuluj.
 * @param {{
 *   message?:      string  — HTML wstawiany przez innerHTML (musi być HTML-escaped!)
 *   messageText?:  string  — czysty tekst, automatycznie escapowany — preferowane dla danych użytkownika
 *   confirmLabel?: string
 *   cancelLabel?:  string
 *   danger?:       boolean
 *   onConfirm?:    Function
 *   onCancel?:     Function
 * }} opts
 */
export function showConfirm({ message, messageText, confirmLabel = 'Tak', cancelLabel = 'Anuluj', danger = false, onConfirm, onCancel }) {
  let modal = document.getElementById('confirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id        = 'confirmModal';
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

  _lastFocusConfirm = document.activeElement; // zapamiętaj fokus przed otwarciem

  const msgEl = document.getElementById('confirmMsg');
  if (messageText !== undefined) {
    // Bezpieczna ścieżka — dane użytkownika trafiają przez textContent
    msgEl.textContent = messageText;
  } else {
    // Ścieżka HTML — wywołujący odpowiada za poprawny HTML-escape
    msgEl.innerHTML = message || '';
  }
  const okBtn     = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');

  okBtn.textContent     = confirmLabel;
  okBtn.className       = 'btn ' + (danger ? 'btn-red' : 'btn-primary');
  cancelBtn.textContent = cancelLabel;
  okBtn.onclick         = null;
  cancelBtn.onclick     = null;

  okBtn.onclick     = () => { _dismissConfirm(); if (onConfirm) onConfirm(); };
  cancelBtn.onclick = () => { _dismissConfirm(); if (onCancel)  onCancel();  };

  modal.classList.add('show');
  cancelBtn.focus();
}

function _dismissConfirm() {
  document.getElementById('confirmModal')?.classList.remove('show');
  // Przywróć fokus do elementu który otworzył modal
  _lastFocusConfirm?.focus({ preventScroll: true });
  _lastFocusConfirm = null;
}

function _confirmKeydown(e) {
  const modal = document.getElementById('confirmModal');
  if (!modal?.classList.contains('show')) return;
  if (e.key === 'Escape') { e.preventDefault(); _dismissConfirm(); }
  if (e.key === 'Enter')  { e.preventDefault(); document.getElementById('confirmOkBtn')?.click(); }
}

// ================================================================
//  KOLUMNY SAL — colKey / flattenColumns / invalidateColumnCache
// ================================================================

/**
 * Buduje unikalny klucz kolumny sali.
 * Format: "f{fi}_s{si}_{num}" lub "f{fi}_s{si}_r{ri}" gdy brak numeru.
 */
export function colKey(col) {
  const n = (col.room.num || '').trim();
  return n
    ? `f${col.floorIdx}_s${col.segIdx}_${n}`
    : `f${col.floorIdx}_s${col.segIdx}_r${col.roomIdx}`;
}

// OPT-02: Memoizowany flattenColumns — cache kasowany po zmianach pięter
let _flatColsCache    = null;
let _flatColsFloorRef = null;

/**
 * Spłaszcza strukturę pięter do listy kolumn.
 * Wynik jest memoizowany — zmiana referencji floors kasuje cache.
 */
export function flattenColumns(floors) {
  if (_flatColsCache && _flatColsFloorRef === floors) return _flatColsCache;
  const cols = [];
  floors.forEach((floor, fi) =>
    floor.segments.forEach((seg, si) =>
      seg.rooms.forEach((room, ri) =>
        cols.push({ floorIdx: fi, segIdx: si, roomIdx: ri, floor, seg, room })
      )
    )
  );
  _flatColsCache    = cols;
  _flatColsFloorRef = floors;
  return cols;
}

/** Wywołaj po każdej zmianie struktury sal (kreator, mountApp) */
export function invalidateColumnCache() {
  _flatColsCache    = null;
  _flatColsFloorRef = null;
}

// ================================================================
//  LOOKUP — NAUCZYCIELE
// ================================================================

/** Zwraca obiekt nauczyciela po skrócie lub null */
export function getTeacherByAbbr(abbr) {
  return (appState?.teachers || []).find(t => t.abbr === abbr) || null;
}

/** Imię + Nazwisko nauczyciela lub pusty string */
export function teacherDisplayName(t) {
  if (!t) return '';
  return [t.first, t.last].filter(Boolean).join(' ');
}

/**
 * Rozwiązuje skrót klasy na "Nazwa — Grupa" (do tooltipów).
 * Jeśli klasa nie istnieje w appState, zwraca oryginalny skrót.
 */
export function resolveClassName(abbr) {
  const found = (appState?.classes || []).find(c => (c.abbr || c.name) === abbr);
  if (!found) return abbr;
  return found.group && found.group.toLowerCase() !== 'cała klasa'
    ? `${found.name} — ${found.group}`
    : found.name;
}

/**
 * Buduje opcje <select> dla wyboru nauczyciela.
 * Nauczyciele posortowani: Nazwisko, Imię.
 */
export function buildTeacherSelectOptions(selectedAbbr) {
  const teachers = (appState?.teachers || [])
    .slice()
    .sort((a, b) =>
      (a.last  || '').localeCompare(b.last  || '', 'pl', { sensitivity: 'base' }) ||
      (a.first || '').localeCompare(b.first || '', 'pl', { sensitivity: 'base' })
    );

  let opts = '<option value="">— brak —</option>';
  teachers.forEach(t => {
    const name = teacherDisplayName(t);
    const sel  = t.abbr === selectedAbbr ? ' selected' : '';
    opts += `<option value="${esc(t.abbr)}"${sel}>${esc(t.abbr)} — ${esc(name)}</option>`;
  });
  return opts;
}

/**
 * Buduje opcje <select> dla wyboru klasy.
 * Klasy pogrupowane (<optgroup>) gdy klasa ma wiele grup;
 * posortowane naturalnie (1A < 1B < 2A).
 */
export function buildClassSelectOptions(selectedVal) {
  const classes = appState?.classes || [];
  let opts = '<option value="">— brak —</option>';

  // Grupuj po nazwie klasy
  const byClass = {};
  classes.filter(c => c.name).forEach(c => {
    if (!byClass[c.name]) byClass[c.name] = [];
    byClass[c.name].push(c);
  });

  const sortedNames = Object.keys(byClass)
    .sort((a, b) => a.localeCompare(b, 'pl', { numeric: true, sensitivity: 'base' }));

  sortedNames.forEach(clsName => {
    const entries = byClass[clsName];
    entries.sort((a, b) => (a.group || '').localeCompare(b.group || '', 'pl', { sensitivity: 'base' }));

    if (entries.length === 1) {
      const c     = entries[0];
      const val   = c.abbr || c.name;
      const label = c.group && c.group.toLowerCase() !== 'cała klasa'
        ? `${c.name} — ${c.group}` : c.name;
      opts += `<option value="${esc(val)}"${val === selectedVal ? ' selected' : ''}>${esc(label)}</option>`;
    } else {
      opts += `<optgroup label="${esc(clsName)}">`;
      entries.forEach(c => {
        const val   = c.abbr || c.name;
        const label = c.group || c.name;
        opts += `<option value="${esc(val)}"${val === selectedVal ? ' selected' : ''}>${esc(c.name)} — ${esc(label)}</option>`;
      });
      opts += '</optgroup>';
    }
  });

  return opts;
}

// ================================================================
//  MERGE CLASS NAMES
// ================================================================

/**
 * Scala listę skrótów klas w zwięzłą formę.
 * Przykład: ["4A MN","4B MN","4C MN"] → ["4ABC MN"]
 *
 * Algorytm:
 *  1. Parsuj każdy skrót na {poziom, litera, grupa}
 *  2. Grupuj po (poziom + grupa)
 *  3. Sklejaj litery wewnątrz grupy
 */
export function mergeClassNames(classes) {
  if (!classes || classes.length <= 1) return classes || [];

  const parsed = classes.map(cls => {
    const m = String(cls).trim().match(/^(\d+)([A-Za-z])(?:\s+(.+))?$/);
    if (m) return { level: m[1], letter: m[2].toUpperCase(), group: (m[3] || '').trim(), orig: cls };
    return { level: null, letter: null, group: null, orig: cls };
  });

  const buckets  = new Map();
  const unparsed = [];

  for (const p of parsed) {
    if (p.level === null) { unparsed.push(p.orig); continue; }
    const key = p.level + '|' + p.group;
    if (!buckets.has(key)) buckets.set(key, { level: p.level, group: p.group, letters: [] });
    const b = buckets.get(key);
    if (!b.letters.includes(p.letter)) b.letters.push(p.letter);
  }

  const merged = [];
  for (const [, b] of buckets) {
    b.letters.sort();
    merged.push(b.level + b.letters.join('') + (b.group ? ' ' + b.group : ''));
  }

  return [...merged, ...unparsed];
}

// ================================================================
//  SKRÓT SALI — format "0B4" (piętro + segment + numer)
// ================================================================
export function roomLabelShort(fi, si, num) {
  const segLetter = String.fromCharCode(65 + si); // A, B, C…
  return `${fi}${segLetter}${num}`;
}
