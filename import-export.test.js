/**
 * tests/import-export.test.js
 * Testy jednostkowe dla logiki migracji, normalizacji i narzędzi
 * Uruchom: node --test tests/import-export.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Reimplementacja funkcji bez efektów ubocznych DOM ────────────

const FILE_VERSION = 3;
const DAYS_DEFAULT = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];

// Migracja v1 → v2
function _migrate1to2(data) {
  if (data.appState && !data.appState.homerooms) data.appState.homerooms = {};
  data._version = 2;
  return data;
}

// Migracja v2 → v3
function _migrate2to3(data) {
  const buildings = (data.appState && data.appState.buildings) || [];
  const multiIdxs = new Set(
    buildings.map((b, bi) => b.multi ? bi : null).filter(bi => bi !== null)
  );
  if (multiIdxs.size > 0 && data.schedData) {
    Object.keys(data.schedData).forEach(yk => {
      const ykData = data.schedData[yk];
      Object.keys(ykData).forEach(day => {
        Object.keys(ykData[day]).forEach(hour => {
          Object.keys(ykData[day][hour]).forEach(key => {
            const val = ykData[day][hour][key];
            if (val && !Array.isArray(val) &&
                (val.teacherAbbr || val.subject || (val.classes && val.classes.length))) {
              const floors = (data.appState && data.appState.floors) || [];
              let isMigMulti = false;
              floors.forEach(floor => {
                if (multiIdxs.has(floor.buildingIdx)) {
                  (floor.segments || []).forEach((seg, si) => {
                    (seg.rooms || []).forEach((room, ri) => {
                      const fi = floors.indexOf(floor);
                      if (`${fi}|${si}|${ri}` === key) isMigMulti = true;
                    });
                  });
                }
              });
              if (isMigMulti) ykData[day][hour][key] = [val];
            }
          });
        });
      });
    });
  }
  data._version = 3;
  return data;
}

const _FILE_MIGRATIONS = { 1: _migrate1to2, 2: _migrate2to3 };

function migrateImportData(data) {
  let v = data._version || 1;
  if (v > FILE_VERSION) return data;
  while (v < FILE_VERSION) {
    const fn = _FILE_MIGRATIONS[v];
    if (!fn) { v++; continue; }
    data = fn(data);
    v++;
  }
  return data;
}

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
  state.hours = state.hours
    .map(h => String(h).trim())
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));
  if (state.floors) {
    state.floors.forEach(f => {
      if (f.buildingIdx === undefined || f.buildingIdx === null) f.buildingIdx = 0;
    });
  }
  return state;
}

function normalizeClassName(name) {
  return (name || '').trim().toUpperCase();
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function safeSetItem(key, value, _localStorage) {
  try {
    _localStorage.setItem(key, value);
    return true;
  } catch(e) {
    if (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        (e.code && (e.code === 22 || e.code === 1014))) return false;
    throw e;
  }
}

// ================================================================
//  migrateImportData() — migracja v1 → v2
// ================================================================
describe('migrateImportData() — migracja v1 → v2', () => {
  it('dodaje homerooms do appState gdy go brakuje', () => {
    const data = { _version: 1, appState: { yearKey: '2024-25' } };
    const result = migrateImportData(data);
    assert.ok(result.appState.homerooms !== undefined, 'homerooms nie zostało dodane');
    assert.deepEqual(result.appState.homerooms, {});
  });

  it('nie nadpisuje istniejącego homerooms', () => {
    const data = { _version: 1, appState: { homerooms: { '0': 'JAN' } } };
    const result = migrateImportData(JSON.parse(JSON.stringify(data)));
    assert.deepEqual(result.appState.homerooms, { '0': 'JAN' });
  });

  it('ustawia _version na 3 po migracji v1', () => {
    const data = { _version: 1, appState: {} };
    const result = migrateImportData(data);
    assert.equal(result._version, 3);
  });

  it('nie modyfikuje danych nowszych niż FILE_VERSION', () => {
    const data = { _version: 99, appState: { special: true } };
    const result = migrateImportData(data);
    assert.equal(result._version, 99);
    assert.equal(result.appState.special, true);
  });

  it('traktuje brak _version jako v1', () => {
    const data = { appState: { yearKey: '2024-25' } };
    const result = migrateImportData(data);
    assert.equal(result._version, 3);
  });
});

// ================================================================
//  migrateImportData() — migracja v2 → v3 (sale multi)
// ================================================================
describe('migrateImportData() — migracja v2 → v3 (sale multi)', () => {
  it('opakowuje slot sali multi w tablicę', () => {
    const data = {
      _version: 2,
      appState: {
        buildings: [{ name: 'Hala', multi: true }],
        floors: [{ buildingIdx: 0, segments: [{ rooms: [{ num: 'Gym' }] }] }],
      },
      schedData: {
        '2024-25': {
          '0': { '1': { '0|0|0': { teacherAbbr: 'JAN', subject: 'WF' } } },
        },
      },
    };
    const result = migrateImportData(data);
    const val = result.schedData['2024-25']['0']['1']['0|0|0'];
    assert.ok(Array.isArray(val), 'Slot sali multi powinien być tablicą');
    assert.equal(val[0].subject, 'WF');
  });

  it('nie dotyka sal zwykłych (nie-multi)', () => {
    const data = {
      _version: 2,
      appState: {
        buildings: [{ name: 'Budynek A', multi: false }],
        floors: [{ buildingIdx: 0, segments: [{ rooms: [{ num: '101' }] }] }],
      },
      schedData: {
        '2024-25': {
          '0': { '1': { '0|0|0': { teacherAbbr: 'JAN', subject: 'Mat' } } },
        },
      },
    };
    const result = migrateImportData(data);
    const val = result.schedData['2024-25']['0']['1']['0|0|0'];
    assert.ok(!Array.isArray(val), 'Zwykła sala nie powinna być tablicą');
  });

  it('nie dotyka pustych komórek', () => {
    const data = {
      _version: 2,
      appState: { buildings: [{ multi: true }], floors: [] },
      schedData: { '2024-25': { '0': { '1': { '0|0|0': {} } } } },
    };
    const result = migrateImportData(data);
    const val = result.schedData['2024-25']['0']['1']['0|0|0'];
    assert.ok(!Array.isArray(val), 'Pusta komórka nie powinna być tablicą');
  });
});

// ================================================================
//  normalizeAppState()
// ================================================================
describe('normalizeAppState()', () => {
  it('dodaje brakujące pola do pustego obiektu', () => {
    const state = normalizeAppState({});
    assert.deepEqual(state.homerooms,   {});
    assert.deepEqual(state.teachers,    []);
    assert.deepEqual(state.classes,     []);
    assert.deepEqual(state.buildings,   []);
    assert.deepEqual(state.assignments, {});
    assert.deepEqual(state.school,      {});
    assert.deepEqual(state.subjects,    []);
    assert.deepEqual(state.timeslots,   []);
  });

  it('nie nadpisuje istniejących pól', () => {
    const state = normalizeAppState({ teachers: [{ abbr: 'JAN' }] });
    assert.equal(state.teachers.length, 1);
    assert.equal(state.teachers[0].abbr, 'JAN');
  });

  it('sortuje hours numerycznie', () => {
    const state = normalizeAppState({ hours: ['10', '2', '1', '8'] });
    assert.deepEqual(state.hours, ['1', '2', '8', '10']);
  });

  it('filtruje puste godziny i konwertuje na stringi', () => {
    const state = normalizeAppState({ hours: [1, '', 2, '  ', 3] });
    assert.deepEqual(state.hours, ['1', '2', '3']);
  });

  it('ustawia domyślne 5 dni tygodnia', () => {
    const state = normalizeAppState({});
    assert.equal(state.days.length, 5);
  });

  it('ustawia buildingIdx=0 dla pięter bez budynku', () => {
    const state = normalizeAppState({
      floors: [{ segments: [] }, { buildingIdx: 2, segments: [] }]
    });
    assert.equal(state.floors[0].buildingIdx, 0);
    assert.equal(state.floors[1].buildingIdx, 2);
  });

  it('zwraca null gdy dostanie null', () => {
    assert.equal(normalizeAppState(null), null);
  });
});

// ================================================================
//  normalizeClassName()
// ================================================================
describe('normalizeClassName()', () => {
  it('zamienia na wielkie litery', () => {
    assert.equal(normalizeClassName('3a'), '3A');
  });

  it('usuwa białe znaki', () => {
    assert.equal(normalizeClassName('  3A  '), '3A');
  });

  it('obsługuje null i undefined', () => {
    assert.equal(normalizeClassName(null), '');
    assert.equal(normalizeClassName(undefined), '');
  });

  it('przepuszcza już znormalizowaną klasę', () => {
    assert.equal(normalizeClassName('3A'), '3A');
  });
});

// ================================================================
//  formatBytes()
// ================================================================
describe('formatBytes()', () => {
  it('wyświetla bajty dla < 1024', () => {
    assert.equal(formatBytes(512), '512 B');
  });

  it('wyświetla KB dla >= 1024', () => {
    assert.equal(formatBytes(1024), '1.0 KB');
  });

  it('wyświetla MB dla >= 1MB', () => {
    assert.ok(formatBytes(1024 * 1024).endsWith('MB'));
  });

  it('zaokrągla KB do 1 miejsca', () => {
    assert.equal(formatBytes(1536), '1.5 KB');
  });
});

// ================================================================
//  safeSetItem()
// ================================================================
describe('safeSetItem()', () => {
  it('zwraca true gdy zapis się powiedzie', () => {
    const store = {};
    const mockLS = { setItem(k, v) { store[k] = v; } };
    assert.equal(safeSetItem('key', 'val', mockLS), true);
    assert.equal(store.key, 'val');
  });

  it('zwraca false przy QuotaExceededError', () => {
    const mockLS = { setItem() { const e = new Error('Quota'); e.name = 'QuotaExceededError'; throw e; } };
    assert.equal(safeSetItem('key', 'val', mockLS), false);
  });

  it('zwraca false przy NS_ERROR_DOM_QUOTA_REACHED', () => {
    const mockLS = { setItem() { const e = new Error('Quota'); e.name = 'NS_ERROR_DOM_QUOTA_REACHED'; throw e; } };
    assert.equal(safeSetItem('key', 'val', mockLS), false);
  });

  it('zwraca false przy error.code === 22', () => {
    const mockLS = { setItem() { const e = new Error('Quota'); e.code = 22; throw e; } };
    assert.equal(safeSetItem('key', 'val', mockLS), false);
  });

  it('rzuca dalej nieznane błędy', () => {
    const mockLS = { setItem() { throw new Error('Inny błąd'); } };
    assert.throws(() => safeSetItem('key', 'val', mockLS), { message: 'Inny błąd' });
  });
});
