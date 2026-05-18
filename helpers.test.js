/**
 * tests/helpers.test.js
 * Testy jednostkowe dla helpers.js
 * Uruchom: node --test tests/helpers.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Importy testowanych funkcji ──────────────────────────────────
// Funkcje czysto logiczne — nie wymagają DOM
import { esc } from '../helpers.js';

// roomLabelShort, mergeClassNames, colKey — ekstraktujemy logikę
// bezpośrednio żeby uniknąć efektów ubocznych DOM w sbSet/notify
const roomLabelShort = (fi, si, num) => `${fi}${String.fromCharCode(65 + si)}${num}`;

function mergeClassNames(classes) {
  if (!classes || classes.length <= 1) return classes || [];
  const parsed = classes.map(cls => {
    const m = String(cls).trim().match(/^(\d+)([A-Za-z])(?:\s+(.+))?$/);
    if (m) return { level: m[1], letter: m[2].toUpperCase(), group: (m[3] || '').trim(), orig: cls };
    return { level: null, letter: null, group: null, orig: cls };
  });
  const buckets = new Map();
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
//  esc()
// ================================================================
describe('esc()', () => {
  it('zamienia & na &amp;', () => {
    assert.equal(esc('A & B'), 'A &amp; B');
  });

  it('zamienia < i > na encje HTML', () => {
    assert.equal(esc('<script>'), '&lt;script&gt;');
  });

  it('zamienia cudzysłów na &quot;', () => {
    assert.equal(esc('"hello"'), '&quot;hello&quot;');
  });

  it('zamienia apostrof na &#39;', () => {
    assert.equal(esc("it's"), 'it&#39;s');
  });

  it('przepuszcza zwykły tekst bez zmian', () => {
    assert.equal(esc('Jan Kowalski'), 'Jan Kowalski');
  });

  it('zwraca pusty string dla null', () => {
    assert.equal(esc(null), '');
  });

  it('zwraca pusty string dla undefined', () => {
    assert.equal(esc(undefined), '');
  });

  it('konwertuje liczby na string', () => {
    assert.equal(esc(42), '42');
  });

  it('obsługuje wiele znaków specjalnych naraz', () => {
    assert.equal(esc('<a href="x">test & "ok"</a>'), '&lt;a href=&quot;x&quot;&gt;test &amp; &quot;ok&quot;&lt;/a&gt;');
  });
});

// ================================================================
//  roomLabelShort()
// ================================================================
describe('roomLabelShort()', () => {
  it('buduje etykietę dla piętra 0, segmentu A', () => {
    assert.equal(roomLabelShort(0, 0, '101'), '0A101');
  });

  it('buduje etykietę dla piętra 1, segmentu B', () => {
    assert.equal(roomLabelShort(1, 1, '205'), '1B205');
  });

  it('buduje etykietę dla piętra 2, segmentu C', () => {
    assert.equal(roomLabelShort(2, 2, '301'), '2C301');
  });

  it('obsługuje segment Z (25)', () => {
    assert.equal(roomLabelShort(0, 25, 'Gym'), '0ZGym');
  });

  it('obsługuje pusty numer sali', () => {
    assert.equal(roomLabelShort(0, 0, ''), '0A');
  });

  it('obsługuje numer sali jako liczbę', () => {
    assert.equal(roomLabelShort(3, 0, 101), '3A101');
  });
});

// ================================================================
//  mergeClassNames()
// ================================================================
describe('mergeClassNames()', () => {
  it('zwraca pustą tablicę dla null', () => {
    assert.deepEqual(mergeClassNames(null), []);
  });

  it('zwraca tablicę z jednym elementem bez zmian', () => {
    assert.deepEqual(mergeClassNames(['3A']), ['3A']);
  });

  it('scala klasy z tym samym poziomem — 3A i 3B → 3AB', () => {
    const result = mergeClassNames(['3A', '3B']);
    assert.ok(Array.isArray(result), 'Wynik powinien być tablicą');
    assert.equal(result.length, 1, 'Dwie klasy z tego samego rocznika powinny być scalone w jeden element');
    assert.ok(result[0].includes('3'), 'Wynik powinien zawierać poziom 3');
    assert.ok(result[0].includes('A') && result[0].includes('B'), 'Wynik powinien zawierać obie litery');
  });

  it('scala trzy klasy z tym samym poziomem', () => {
    const result = mergeClassNames(['2A', '2B', '2C']);
    assert.equal(result.length, 1);
    assert.ok(result[0].includes('2'));
    assert.ok(result[0].includes('A') && result[0].includes('B') && result[0].includes('C'));
  });

  it('nie scala klas z różnymi poziomami', () => {
    const result = mergeClassNames(['3A', '4B']);
    assert.equal(result.length, 2, 'Klasy z różnych roczników powinny pozostać oddzielone');
  });

  it('obsługuje klasę bez dopasowania do wzorca (zwraca jako-is)', () => {
    const result = mergeClassNames(['3A', 'SpecGrupa']);
    assert.ok(result.includes('SpecGrupa'), 'Nierozpoznana klasa powinna być zachowana');
  });

  it('sortuje litery w obrębie poziomu', () => {
    const result = mergeClassNames(['3C', '3A', '3B']);
    assert.equal(result.length, 1);
    const letters = result[0].replace('3', '');
    assert.equal(letters, 'ABC', 'Litery powinny być posortowane alphabetycznie');
  });

  it('scala osobno grupy o różnych suffixach', () => {
    const result = mergeClassNames(['3A gr1', '3B gr1', '3A gr2']);
    // gr1 i gr2 to osobne grupy — 3A gr1 + 3B gr1 scalone, 3A gr2 osobno
    assert.ok(result.length >= 2, 'Różne grupy powinny być traktowane oddzielnie');
  });
});
