// ================================================================
//  COLLISIONS.JS — wykrywanie kolizji nauczycieli i klas
//  Zależy od: state.js
//  Eksportuje: detectCollisions, scrollToFirstCollision
// ================================================================

import { appState, schedData, currentDay } from './state.js';

// Zewnętrzne funkcje (podłączone przez app.js po załadowaniu)
function _colKey(col)         { if (typeof colKey      === 'function') return colKey(col);      return ''; }
function _roomLabel(fi,si,n)  { if (typeof _roomLabel_ === 'function') return _roomLabel_(fi,si,n); return String(n); }


// ================================================================
//  WYKRYWANIE KOLIZJI
// ================================================================

/**
 * Wykrywa kolizje nauczycieli i klas w danym dniu.
 *
 * @param {Object} dayData  - schedData[yk][day]
 * @param {Array}  hours    - tablica etykiet godzin ['0','1',...]
 * @param {Array}  cols     - tablica kolumn z flattenColumns()
 * @returns {Object}        - mapa 'h|colKey' → [string opisy kolizji]
 */
export function detectCollisions(dayData, hours, cols) {
  const result = {}; // 'h|key' → [string, ...]

  hours.forEach(function(h) {
    const row = dayData[h] || {};

    // Zbierz wszystkie niepuste wpisy tej godziny
    const entries = [];
    cols.forEach(function(col) {
      const key   = _colKey(col);
      const entry = row[key] || {};
      // BUG-4 fix: uwzględnij wpisy z classes[] bez className
      if (entry.teacherAbbr || entry.className || (entry.classes && entry.classes.length)) {
        entries.push({ key, entry, col });
      }
    });

    // ── Kolizje nauczyciela ──────────────────────────────────────
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
        const others = byTeacher[abbr]
          .filter(x => x.key !== e.key)
          .map(x => {
            const label = typeof _roomLabel === 'function'
              ? _roomLabel(x.col.floorIdx, x.col.segIdx, x.col.room.num || x.key)
              : (x.col.room.num || x.key);
            return label;
          })
          .join(', ');
        result[cellId].push('Nauczyciel ' + abbr + ' jednocześnie w: ' + others);
      });
    });

    // ── Kolizje klasy / grupy ────────────────────────────────────
    const byClass = {};
    entries.forEach(function(e) {
      // BUG-4 fix: obsłuż oba formaty — classes[] i className
      const clsList = (e.entry.classes && e.entry.classes.length)
        ? e.entry.classes
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
        const others = byClass[cls]
          .filter(x => x.key !== e.key)
          .map(x => {
            const label = typeof _roomLabel === 'function'
              ? _roomLabel(x.col.floorIdx, x.col.segIdx, x.col.room.num || x.key)
              : (x.col.room.num || x.key);
            return label;
          })
          .join(', ');
        result[cellId].push('Klasa ' + cls + ' jednocześnie w: ' + others);
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
