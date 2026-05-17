// ================================================================
//  COLLISIONS.JS — wykrywanie kolizji nauczycieli i klas
//  Zależy od: state.js
//  Eksportuje: detectCollisions, scrollToFirstCollision
// ================================================================

import { appState, schedData, currentDay } from './state.js';
import { colKey, roomLabelShort } from './helpers.js';

// Zwraca true jeśli kolumna należy do budynku sportowego/wieloosobowego
function _isMultiCol(col) {
  const buildings = appState.buildings || [];
  const bi = col.floor?.buildingIdx ?? 0;
  return !!(buildings[bi]?.multi);
}

function _colKey(col)        { return colKey(col); }
function _roomLabel(fi,si,n) { return roomLabelShort(fi, si, n); }

// Spłaszcza wpisy dla danej godziny i kolumny:
// - zwykła sala: zwraca [entry]
// - sala multi (tablica): zwraca wszystkie niepuste sloty
function _flatEntries(row, key, col) {
  const raw = row[key];
  if (Array.isArray(raw)) {
    return raw
      .filter(s => s && (s.teacherAbbr || s.className || (s.classes && s.classes.length)))
      .map(s => ({ key, entry: s, col }));
  }
  if (raw && (raw.teacherAbbr || raw.className || (raw.classes && raw.classes.length))) {
    return [{ key, entry: raw, col }];
  }
  return [];
}

// ================================================================
//  WYKRYWANIE KOLIZJI
// ================================================================

/**
 * Wykrywa kolizje nauczycieli i klas w danym dniu.
 * Dla sal multi — każdy slot traktowany jako osobny wpis.
 * Kolizja nauczyciela = ten sam skrót w różnych salach jednocześnie.
 * Kolizja klasy = ta sama klasa w różnych salach jednocześnie.
 *
 * @param {Object} dayData  - schedData[yk][day]
 * @param {Array}  hours    - tablica etykiet godzin
 * @param {Array}  cols     - tablica kolumn z flattenColumns()
 * @returns {Object}        - mapa 'h|colKey' → [string opisy kolizji]
 */
export function detectCollisions(dayData, hours, cols) {
  const result = {};

  hours.forEach(function(h) {
    const row = dayData[h] || {};

    // Zbierz wszystkie niepuste wpisy tej godziny (zwykłe + sloty multi)
    const entries = [];
    cols.forEach(function(col) {
      _flatEntries(row, _colKey(col), col).forEach(e => entries.push(e));
    });

    // ── Kolizje nauczyciela prowadzącego ────────────────────────
    const byTeacher = {};
    entries.forEach(function(e) {
      if (!e.entry.teacherAbbr) return;
      const abbr = e.entry.teacherAbbr;
      if (!byTeacher[abbr]) byTeacher[abbr] = [];
      byTeacher[abbr].push(e);
    });

    // ── Kolizje nauczyciela wspomagającego ───────────────────────
    entries.forEach(function(e) {
      if (!e.entry.supportTeacherAbbr) return;
      const abbr = e.entry.supportTeacherAbbr;
      if (!byTeacher[abbr]) byTeacher[abbr] = [];
      if (!byTeacher[abbr].some(function(x) { return x.key === e.key && x.entry === e.entry; })) {
        byTeacher[abbr].push(e);
      }
    });

    Object.keys(byTeacher).forEach(function(abbr) {
      // Kolizja tylko gdy ten sam nauczyciel w RÓŻNYCH kolumnach (salach)
      const uniqueKeys = [...new Set(byTeacher[abbr].map(function(e) { return e.key; }))];
      if (uniqueKeys.length < 2) return;
      byTeacher[abbr].forEach(function(e) {
        const cellId = h + '|' + e.key;
        if (!result[cellId]) result[cellId] = [];
        const others = byTeacher[abbr]
          .filter(function(x) { return x.key !== e.key; })
          .map(function(x) { return _roomLabel(x.col.floorIdx, x.col.segIdx, x.col.room.num || x.key); })
          .filter(function(v, i, a) { return a.indexOf(v) === i; }) // deduplikacja etykiet
          .join(', ');
        if (others && !result[cellId].some(function(m) { return m.startsWith('Nauczyciel ' + abbr); })) {
          result[cellId].push('Nauczyciel ' + abbr + ' jednocześnie w: ' + others);
        }
      });
    });

    // ── Kolizje klasy / grupy ────────────────────────────────────
    // Dla sal multi: ta sama klasa w RÓŻNYCH salach = kolizja.
    // Ta sama klasa w różnych slotach TEJ SAMEJ sali = brak kolizji (może się zdarzyć np. podział grupy).
    const byClass = {};
    entries.forEach(function(e) {
      const clsList = (e.entry.classes && e.entry.classes.length)
        ? e.entry.classes
        : (e.entry.className ? [e.entry.className] : []);
      clsList.forEach(function(cls) {
        if (!byClass[cls]) byClass[cls] = [];
        byClass[cls].push(e);
      });
    });

    Object.keys(byClass).forEach(function(cls) {
      // Filtruj: kolizja tylko gdy ta sama klasa w RÓŻNYCH kluczach kolumn
      const uniqueKeys = [...new Set(byClass[cls].map(e => e.key))];
      if (uniqueKeys.length < 2) return;
      byClass[cls].forEach(function(e) {
        const cellId = h + '|' + e.key;
        if (!result[cellId]) result[cellId] = [];
        const others = byClass[cls]
          .filter(x => x.key !== e.key)
          .map(x => _roomLabel(x.col.floorIdx, x.col.segIdx, x.col.room.num || x.key))
          .join(', ');
        if (!result[cellId].some(m => m.startsWith('Klasa ' + cls))) {
          result[cellId].push('Klasa ' + cls + ' jednocześnie w: ' + others);
        }
      });
    });
  });

  return result;
}


/**
 * Przewija widok do pierwszej kolizji w tabeli.
 */
export function scrollToFirstCollision() {
  const first = document.querySelector('.cell-inner.collision');
  if (first) first.closest('td').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
