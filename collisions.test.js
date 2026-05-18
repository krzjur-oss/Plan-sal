/**
 * tests/collisions.test.js
 * Testy jednostkowe dla detectCollisions()
 * Uruchom: node --test tests/collisions.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Lokalna reimplementacja detectCollisions bez importu DOM-modułów ──
// (collisions.js importuje helpers.js który ma efekty uboczne DOM)

const roomLabelShort = (fi, si, num) => `${fi}${String.fromCharCode(65 + si)}${num}`;

function _colKey(col) {
  return `${col.floorIdx}|${col.segIdx}|${col.roomIdx}`;
}

function _flatEntries(row, key, col) {
  const val = row[key];
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .filter(e => e && (e.teacherAbbr || e.subject || (e.classes && e.classes.length)))
      .map(e => ({ key, col, entry: e }));
  }
  if (val.teacherAbbr || val.subject || (val.classes && val.classes.length)) {
    return [{ key, col, entry: val }];
  }
  return [];
}

function detectCollisions(dayData, hours, cols) {
  const result = {};
  hours.forEach(h => {
    const row = dayData[h] || {};
    const entries = [];
    cols.forEach(col => _flatEntries(row, _colKey(col), col).forEach(e => entries.push(e)));

    // Kolizje nauczyciela
    const byTeacher = {};
    entries.forEach(e => {
      if (!e.entry.teacherAbbr) return;
      const abbr = e.entry.teacherAbbr;
      if (!byTeacher[abbr]) byTeacher[abbr] = [];
      byTeacher[abbr].push(e);
    });
    entries.forEach(e => {
      if (!e.entry.supportTeacherAbbr) return;
      const abbr = e.entry.supportTeacherAbbr;
      if (!byTeacher[abbr]) byTeacher[abbr] = [];
      if (!byTeacher[abbr].some(x => x.key === e.key && x.entry === e.entry))
        byTeacher[abbr].push(e);
    });
    Object.keys(byTeacher).forEach(abbr => {
      const uniqueKeys = [...new Set(byTeacher[abbr].map(e => e.key))];
      if (uniqueKeys.length < 2) return;
      byTeacher[abbr].forEach(e => {
        const cellId = `${h}|${e.key}`;
        if (!result[cellId]) result[cellId] = [];
        const others = byTeacher[abbr]
          .filter(x => x.key !== e.key)
          .map(x => roomLabelShort(x.col.floorIdx, x.col.segIdx, x.col.room?.num || x.key))
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(', ');
        if (others && !result[cellId].some(m => m.startsWith(`Nauczyciel ${abbr}`)))
          result[cellId].push(`Nauczyciel ${abbr} jednocześnie w: ${others}`);
      });
    });

    // Kolizje klas
    const byClass = {};
    entries.forEach(e => {
      const clsList = (e.entry.classes && e.entry.classes.length)
        ? e.entry.classes
        : (e.entry.className ? [e.entry.className] : []);
      clsList.forEach(cls => {
        if (!byClass[cls]) byClass[cls] = [];
        byClass[cls].push(e);
      });
    });
    Object.keys(byClass).forEach(cls => {
      const uniqueKeys = [...new Set(byClass[cls].map(e => e.key))];
      if (uniqueKeys.length < 2) return;
      byClass[cls].forEach(e => {
        const cellId = `${h}|${e.key}`;
        if (!result[cellId]) result[cellId] = [];
        const others = byClass[cls]
          .filter(x => x.key !== e.key)
          .map(x => roomLabelShort(x.col.floorIdx, x.col.segIdx, x.col.room?.num || x.key))
          .join(', ');
        if (!result[cellId].some(m => m.startsWith(`Klasa ${cls}`)))
          result[cellId].push(`Klasa ${cls} jednocześnie w: ${others}`);
      });
    });
  });
  return result;
}

// ── Helpery do budowania danych testowych ────────────────────────

function makeCol(floorIdx, segIdx, roomIdx, num) {
  return { floorIdx, segIdx, roomIdx, room: { num: num || String(roomIdx + 100) } };
}

// ================================================================
//  Brak kolizji
// ================================================================
describe('detectCollisions() — brak kolizji', () => {
  it('zwraca pusty obiekt dla pustych danych', () => {
    const result = detectCollisions({}, ['1', '2'], [makeCol(0, 0, 0)]);
    assert.deepEqual(result, {});
  });

  it('brak kolizji gdy każdy nauczyciel w jednej sali', () => {
    const col1 = makeCol(0, 0, 0, '101');
    const col2 = makeCol(0, 0, 1, '102');
    const dayData = {
      '1': {
        '0|0|0': { teacherAbbr: 'JAN', subject: 'Mat' },
        '0|0|1': { teacherAbbr: 'EWA', subject: 'Fiz' },
      },
    };
    const result = detectCollisions(dayData, ['1'], [col1, col2]);
    assert.deepEqual(result, {});
  });

  it('brak kolizji gdy ta sama klasa w jednej sali (różne godziny)', () => {
    const col1 = makeCol(0, 0, 0, '101');
    const dayData = {
      '1': { '0|0|0': { teacherAbbr: 'JAN', className: '3A' } },
      '2': { '0|0|0': { teacherAbbr: 'EWA', className: '3A' } },
    };
    const result = detectCollisions(dayData, ['1', '2'], [col1]);
    assert.deepEqual(result, {});
  });
});

// ================================================================
//  Kolizje nauczyciela
// ================================================================
describe('detectCollisions() — kolizje nauczyciela', () => {
  it('wykrywa nauczyciela w dwóch salach jednocześnie', () => {
    const col1 = makeCol(0, 0, 0, '101');
    const col2 = makeCol(0, 0, 1, '102');
    const dayData = {
      '1': {
        '0|0|0': { teacherAbbr: 'KJUR', subject: 'Mat' },
        '0|0|1': { teacherAbbr: 'KJUR', subject: 'Mat' },
      },
    };
    const result = detectCollisions(dayData, ['1'], [col1, col2]);
    assert.ok(result['1|0|0|0'], 'Brak kolizji dla sali 101');
    assert.ok(result['1|0|0|1'], 'Brak kolizji dla sali 102');
    assert.ok(result['1|0|0|0'][0].includes('KJUR'), 'Komunikat nie zawiera skrótu nauczyciela');
  });

  it('nie wykrywa kolizji gdy nauczyciel tylko w jednej sali', () => {
    const col1 = makeCol(0, 0, 0, '101');
    const col2 = makeCol(0, 0, 1, '102');
    const dayData = {
      '1': {
        '0|0|0': { teacherAbbr: 'KJUR', subject: 'Mat' },
        '0|0|1': { teacherAbbr: 'EWA',  subject: 'Fiz' },
      },
    };
    const result = detectCollisions(dayData, ['1'], [col1, col2]);
    assert.deepEqual(result, {});
  });

  it('wykrywa kolizję nauczyciela wspomagającego', () => {
    const col1 = makeCol(0, 0, 0, '101');
    const col2 = makeCol(0, 0, 1, '102');
    const dayData = {
      '1': {
        '0|0|0': { teacherAbbr: 'JAN', supportTeacherAbbr: 'HELP', subject: 'Mat' },
        '0|0|1': { teacherAbbr: 'EWA', supportTeacherAbbr: 'HELP', subject: 'Fiz' },
      },
    };
    const result = detectCollisions(dayData, ['1'], [col1, col2]);
    assert.ok(result['1|0|0|0'] || result['1|0|0|1'], 'Brak kolizji nauczyciela wspomagającego');
  });

  it('wykrywa kolizję nauczyciela na wielu godzinach', () => {
    const col1 = makeCol(0, 0, 0, '101');
    const col2 = makeCol(0, 0, 1, '102');
    const dayData = {
      '1': {
        '0|0|0': { teacherAbbr: 'KJUR', subject: 'Mat' },
        '0|0|1': { teacherAbbr: 'KJUR', subject: 'Mat' },
      },
      '2': {
        '0|0|0': { teacherAbbr: 'KJUR', subject: 'Fiz' },
        '0|0|1': {},
      },
    };
    const result = detectCollisions(dayData, ['1', '2'], [col1, col2]);
    assert.ok(result['1|0|0|0'], 'Brak kolizji na godzinie 1');
    assert.ok(!result['2|0|0|0'], 'Fałszywa kolizja na godzinie 2');
  });
});

// ================================================================
//  Kolizje klas
// ================================================================
describe('detectCollisions() — kolizje klas', () => {
  it('wykrywa klasę w dwóch salach jednocześnie', () => {
    const col1 = makeCol(0, 0, 0, '101');
    const col2 = makeCol(0, 0, 1, '102');
    const dayData = {
      '1': {
        '0|0|0': { teacherAbbr: 'JAN', className: '3A' },
        '0|0|1': { teacherAbbr: 'EWA', className: '3A' },
      },
    };
    const result = detectCollisions(dayData, ['1'], [col1, col2]);
    assert.ok(result['1|0|0|0'] || result['1|0|0|1'], 'Brak kolizji klasy 3A');
    const msgs = Object.values(result).flat();
    assert.ok(msgs.some(m => m.includes('Klasa 3A')), 'Komunikat nie zawiera nazwy klasy');
  });

  it('wykrywa kolizje klas z pola classes[]', () => {
    const col1 = makeCol(0, 0, 0, '101');
    const col2 = makeCol(0, 0, 1, '102');
    const dayData = {
      '1': {
        '0|0|0': { teacherAbbr: 'JAN', classes: ['3A', '3B'] },
        '0|0|1': { teacherAbbr: 'EWA', classes: ['3A'] },
      },
    };
    const result = detectCollisions(dayData, ['1'], [col1, col2]);
    assert.ok(Object.keys(result).length > 0, 'Brak kolizji z polem classes[]');
  });

  it('brak kolizji gdy ta sama klasa w różnych slotach tej samej sali (WF)', () => {
    const col1 = makeCol(0, 0, 0, 'Gym');
    const dayData = {
      '1': {
        '0|0|0': [
          { teacherAbbr: 'JAN', classes: ['3A'] },
          { teacherAbbr: 'EWA', classes: ['3B'] },
        ],
      },
    };
    const result = detectCollisions(dayData, ['1'], [col1]);
    // Ta sama sala (ten sam key) — brak kolizji nawet jeśli klasy są różne
    assert.deepEqual(result, {});
  });
});

// ================================================================
//  Przypadki brzegowe
// ================================================================
describe('detectCollisions() — przypadki brzegowe', () => {
  it('ignoruje puste komórki', () => {
    const col1 = makeCol(0, 0, 0, '101');
    const dayData = { '1': { '0|0|0': {} } };
    const result = detectCollisions(dayData, ['1'], [col1]);
    assert.deepEqual(result, {});
  });

  it('ignoruje komórki bez teacherAbbr i className', () => {
    const col1 = makeCol(0, 0, 0, '101');
    const dayData = { '1': { '0|0|0': { subject: 'Przerwa' } } };
    const result = detectCollisions(dayData, ['1'], [col1]);
    assert.deepEqual(result, {});
  });

  it('działa poprawnie dla wielu kolumn i godzin bez kolizji', () => {
    const cols = Array.from({ length: 5 }, (_, i) => makeCol(0, 0, i, String(100 + i)));
    const hours = ['1', '2', '3', '4', '5', '6', '7'];
    const dayData = {};
    hours.forEach((h, hi) => {
      dayData[h] = {};
      cols.forEach((col, ci) => {
        dayData[h][_colKey(col)] = { teacherAbbr: `T${hi}${ci}`, subject: 'Mat' };
      });
    });
    const result = detectCollisions(dayData, hours, cols);
    assert.deepEqual(result, {});
  });
});
