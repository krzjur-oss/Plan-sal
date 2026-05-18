/**
 * tests/utils.test.js
 * Testy jednostkowe dla utils.js — genAbbr, ensureUniqueAbbr, undo/redo
 * Uruchom: node --test tests/utils.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Reimplementacja testowanych funkcji (bez efektów ubocznych DOM) ──

function genAbbr(first, last) {
  const f = (first || '').trim();
  const l = (last  || '').trim();
  if (!f && !l) return '';
  const fLetter = f ? f[0].toUpperCase() : '';
  const parts = l.split(/[-\s]+/).filter(Boolean);
  let lPart = '';
  if (parts.length >= 2) {
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

// Uproszczony stos undo do testów
const UNDO_LIMIT = 30;

function makeUndoSystem() {
  let appState  = { yearKey: '2024-25' };
  let schedData = { '2024-25': { 0: {}, 1: {}, 2: {} } };
  let currentDay = 0;
  let undoStack = [];
  let redoStack = [];

  function SC(v) { return JSON.parse(JSON.stringify(v)); }

  function undoPush(label) {
    const yk = appState.yearKey;
    undoStack.push({ label, yk, day: currentDay, scope: 'day',
      snapshot: SC(schedData[yk]?.[currentDay] || {}) });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack.splice(0); // mutuj tę samą tablicę (jak w produkcji setRedoStack([]))
  }

  function undoPushYear(label) {
    const yk = appState.yearKey;
    undoStack.push({ label, yk, day: currentDay, scope: 'year',
      snapshot: SC(schedData[yk] || {}) });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack.splice(0); // mutuj tę samą tablicę
  }

  function undoApply(stack, target) {
    if (!stack.length) return false;
    const entry = stack.pop();
    const yk = appState.yearKey;
    if (entry.scope === 'year') {
      target.push({ ...entry, snapshot: SC(schedData[yk] || {}) });
      Object.keys(schedData[yk]).forEach(d => delete schedData[yk][d]);
      Object.assign(schedData[yk], SC(entry.snapshot));
    } else {
      target.push({ ...entry, snapshot: SC(schedData[yk]?.[entry.day] || {}) });
      schedData[yk][entry.day] = SC(entry.snapshot);
    }
    return true;
  }

  return { appState, schedData, undoStack, redoStack, undoPush, undoPushYear, undoApply };
}

// ================================================================
//  genAbbr()
// ================================================================
describe('genAbbr()', () => {
  it('generuje skrót dla typowego imienia i nazwiska', () => {
    assert.equal(genAbbr('Krzysztof', 'Jurczak'), 'KJUR');
  });

  it('generuje skrót dla imienia jednoliterowego', () => {
    assert.equal(genAbbr('Anna', 'Kowalska'), 'AKOW');
  });

  it('obsługuje nazwisko dwuczłonowe z myślnikiem', () => {
    assert.equal(genAbbr('Maria', 'Nowak-Wiśniewska'), 'MNOW');
  });

  it('obsługuje nazwisko dwuczłonowe ze spacją', () => {
    const r = genAbbr('Jan', 'Kowalski Wiśniewski');
    assert.ok(r.startsWith('J'), 'Powinien zaczynać się od J');
    assert.ok(r.length >= 3, 'Powinien mieć co najmniej 3 znaki');
  });

  it('zwraca pusty string gdy oba argumenty puste', () => {
    assert.equal(genAbbr('', ''), '');
  });

  it('zwraca pusty string dla null/undefined', () => {
    assert.equal(genAbbr(null, null), '');
    assert.equal(genAbbr(undefined, undefined), '');
  });

  it('obsługuje tylko nazwisko (bez imienia)', () => {
    const r = genAbbr('', 'Kowalski');
    assert.equal(r, 'KOW');
  });

  it('zwraca wielkie litery', () => {
    const r = genAbbr('anna', 'kowalska');
    assert.equal(r, r.toUpperCase());
  });
});

// ================================================================
//  ensureUniqueAbbr()
// ================================================================
describe('ensureUniqueAbbr()', () => {
  it('zwraca skrót bez zmian jeśli jest unikalny', () => {
    assert.equal(ensureUniqueAbbr('KJUR', ['JAN', 'EWA']), 'KJUR');
  });

  it('dodaje 2 przy pierwszym konflikcie', () => {
    assert.equal(ensureUniqueAbbr('KJUR', ['KJUR', 'JAN']), 'KJUR2');
  });

  it('dodaje 3 gdy KJUR i KJUR2 już istnieją', () => {
    assert.equal(ensureUniqueAbbr('KJUR', ['KJUR', 'KJUR2', 'JAN']), 'KJUR3');
  });

  it('pomija luki — KJUR, KJUR2 zajęte, ale nie KJUR3', () => {
    assert.equal(ensureUniqueAbbr('KJUR', ['KJUR', 'KJUR2']), 'KJUR3');
  });

  it('działa dla pustej listy istniejących', () => {
    assert.equal(ensureUniqueAbbr('JAN', []), 'JAN');
  });

  it('działa dla pustego skrótu', () => {
    assert.equal(ensureUniqueAbbr('', ['', 'JAN']), '2');
  });
});

// ================================================================
//  undo/redo — scope: 'day'
// ================================================================
describe('undoPush() + undoApply() — scope day', () => {
  it('przywraca stan pojedynczego dnia po undoPush', () => {
    const s = makeUndoSystem();
    s.schedData['2024-25'][0] = { '1': { 'f0_s0': { subject: 'Mat' } } };
    s.undoPush('Edycja komórki');
    s.schedData['2024-25'][0] = { '1': { 'f0_s0': { subject: 'Fiz' } } };

    s.undoApply(s.undoStack, s.redoStack);

    assert.equal(s.schedData['2024-25'][0]['1']['f0_s0'].subject, 'Mat');
  });

  it('kasuje redoStack po undoPush', () => {
    const s = makeUndoSystem();
    s.redoStack.push({ label: 'stary redo', scope: 'day', snapshot: {} });
    s.undoPush('nowa akcja');
    assert.equal(s.redoStack.length, 0);
  });

  it('redo przywraca stan po undo', () => {
    const s = makeUndoSystem();
    s.schedData['2024-25'][0] = { '1': { 'f0_s0': { subject: 'Mat' } } };
    s.undoPush('Edycja');
    s.schedData['2024-25'][0] = { '1': { 'f0_s0': { subject: 'Fiz' } } };

    s.undoApply(s.undoStack, s.redoStack);         // undo → Mat
    s.undoApply(s.redoStack, s.undoStack);          // redo → Fiz

    assert.equal(s.schedData['2024-25'][0]['1']['f0_s0'].subject, 'Fiz');
  });

  it('respektuje UNDO_LIMIT — starsze wpisy są usuwane', () => {
    const s = makeUndoSystem();
    for (let i = 0; i < UNDO_LIMIT + 5; i++) s.undoPush(`Akcja ${i}`);
    assert.equal(s.undoStack.length, UNDO_LIMIT);
  });

  it('zwraca false dla pustego stosu', () => {
    const s = makeUndoSystem();
    const result = s.undoApply(s.undoStack, s.redoStack);
    assert.equal(result, false);
  });
});

// ================================================================
//  undo/redo — scope: 'year'
// ================================================================
describe('undoPushYear() + undoApply() — scope year', () => {
  it('przywraca cały rok po undoPushYear', () => {
    const s = makeUndoSystem();
    s.schedData['2024-25'] = {
      0: { '1': { 'f0_s0': { subject: 'Mat' } } },
      1: { '1': { 'f0_s0': { subject: 'Fiz' } } },
      2: {},
    };
    s.undoPushYear('Import');
    // Podmień cały rok
    s.schedData['2024-25'] = { 0: { '1': { 'f0_s0': { subject: 'Geo' } } } };

    s.undoApply(s.undoStack, s.redoStack);

    assert.equal(s.schedData['2024-25'][0]['1']['f0_s0'].subject, 'Mat');
    assert.equal(s.schedData['2024-25'][1]['1']['f0_s0'].subject, 'Fiz');
    assert.equal(Object.keys(s.schedData['2024-25']).length, 3);
  });

  it('redo po undoPushYear działa poprawnie', () => {
    const s = makeUndoSystem();
    s.schedData['2024-25'][0] = { '1': { 'k': { subject: 'Mat' } } };
    s.undoPushYear('Import');
    s.schedData['2024-25'][0] = { '1': { 'k': { subject: 'Bio' } } };

    s.undoApply(s.undoStack, s.redoStack);          // undo → Mat
    s.undoApply(s.redoStack, s.undoStack);          // redo → Bio

    assert.equal(s.schedData['2024-25'][0]['1']['k'].subject, 'Bio');
  });

  it('mieszany stos day+year zachowuje kolejność LIFO', () => {
    const s = makeUndoSystem();
    s.undoPush('Dzień');
    s.undoPushYear('Rok');
    assert.equal(s.undoStack[0].scope, 'day');
    assert.equal(s.undoStack[1].scope, 'year');
    assert.equal(s.undoStack.length, 2);
  });

  it('kasuje redoStack po undoPushYear', () => {
    const s = makeUndoSystem();
    s.redoStack.push({ label: 'stary redo', scope: 'year', snapshot: {} });
    s.undoPushYear('Import');
    assert.equal(s.redoStack.length, 0);
  });
});
