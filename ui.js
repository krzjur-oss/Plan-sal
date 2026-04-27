// ================================================================
//  ui.js — Etap 6 refaktoryzacji PlanLekcji
//  Zawiera: archiwum, clearDay, exportPDF, toggleMobileMenu, motyw,
//           homeroom, importFloors, quickAdd, PWA/SW, terms, about,
//           inicjalizacja DOMContentLoaded
// ================================================================

import {
  appState, schedData, validFromDates, archive, currentDay,
  setCurrentDay, setArchive,
  _viewMode, _viewFilter,
  _selectedClasses, setSelectedClasses,
  DAYS_DEFAULT, FLOOR_COLORS,
  wBuildings, wFloors,
} from './state.js';

import { undoPush, genAbbr, ensureUniqueAbbr } from './utils.js';

import {
  esc, sbSet, notify, showConfirm,
  colKey, flattenColumns,
  getTeacherByAbbr, teacherDisplayName,
  buildTeacherSelectOptions,
} from './helpers.js';

import { persistAll, normalizeClassName, initImportDragDrop } from './import-export.js';

import {
  loadAll, showWelcomeScreen, wizardSaveDraft,
  autoClassAbbr,
} from './storage.js';

import { renderFloorList } from './wizard-data.js';

import {
  mountApp, renderSchedule,
  renderMultiClassList, renderMcSelect,
} from './schedule.js';

// ================================================================
//  ARCHIWUM
// ================================================================

export function showArchive() {
  renderArchiveBody();
  document.getElementById('archivePanel').classList.add('show');
}

export function hideArchive() {
  document.getElementById('archivePanel').classList.remove('show');
}

export function closeArchive() {
  document.getElementById('archivePanel').classList.remove('show');
}

export function renderArchiveBody() {
  const body = document.getElementById('archiveBody');
  let html = '';
  if (appState) {
    const bldInfo = (appState.buildings || []).map(b => b.name).filter(Boolean).join(', ');
    html += `<div class="archive-year-card" style="border-color:var(--accent);background:rgba(59,130,246,0.06)">
      <div class="archive-year-info">
        <h3>📌 ${esc(appState.yearLabel)} <span style="font-size:0.68rem;color:var(--green);font-weight:600">aktywny</span></h3>
        <p>${appState.school?.name ? esc(appState.school.name) + ' · ' : ''}${flattenColumns(appState.floors).length} sal · ${appState.classes.length} klas · ${(appState.teachers || []).length} nauczycieli</p>
        ${bldInfo ? `<p style="margin-top:2px;color:var(--text-dim)">🏢 ${esc(bldInfo)}</p>` : ''}
      </div>
      <div class="archive-year-actions"><button class="btn btn-ghost" onclick="closeArchive()">Otwórz</button></div>
    </div>`;
  }
  archive.slice().reverse().forEach(item => {
    const saved = item.savedAt ? new Date(item.savedAt).toLocaleDateString('pl-PL') : '';
    html += `<div class="archive-year-card">
      <div class="archive-year-info">
        <h3>📁 ${esc(item.label)}</h3>
        <p>${item.config?.school?.name ? esc(item.config.school.name) + ' · ' : ''}Zarchiwizowany${saved ? ': ' + saved : ''}</p>
      </div>
      <div class="archive-year-actions">
        <button class="btn btn-yellow" onclick="restoreYear('${esc(item.yearKey)}')">Przywróć</button>
        <button class="btn btn-red"    onclick="deleteArchive('${esc(item.yearKey)}')">Usuń</button>
      </div>
    </div>`;
  });
  if (!html) html = '<div class="archive-empty">Brak zarchiwizowanych planów.</div>';
  body.innerHTML = html;
}

export function restoreYear(yearKey) {
  const item = archive.find(a => a.yearKey === yearKey);
  if (!item?.config) {
    notify('⚠ Brak danych konfiguracji — utwórz rok ponownie przez kreator.', true);
    return;
  }
  showConfirm({
    message:      `Przywrócić rok <strong>${esc(item.label)}</strong>?<br><span style="font-size:0.78rem;color:var(--text-muted)">Bieżący rok zostanie zarchiwizowany.</span>`,
    confirmLabel: '📁 Przywróć',
    danger:       false,
    onConfirm: () => {
      if (appState) {
        const ex = archive.find(a => a.yearKey === appState.yearKey);
        if (!ex) {
          archive.push({
            yearKey:  appState.yearKey,
            label:    appState.yearLabel,
            savedAt:  new Date().toISOString(),
            config:   structuredClone(appState),
          });
        }
      }
      // Mutuj przez referencję (appState jest exportowanym let z state.js)
      Object.assign(appState, {homerooms: item.config?.homerooms || {}, ...item.config});
      setArchive(archive.filter(a => a.yearKey !== yearKey));
      persistAll();
      closeArchive();
      setCurrentDay(0);
      mountApp();
      notify('📁 Przywrócono rok ' + item.label);
    },
  });
}

export function deleteArchive(yearKey) {
  const item = archive.find(a => a.yearKey === yearKey);
  showConfirm({
    message:      `Trwale usunąć archiwum:<br><strong>${esc(item?.label || yearKey)}</strong>?<br><span style="font-size:0.78rem;color:var(--text-muted)">Tej operacji nie można cofnąć.</span>`,
    confirmLabel: '🗑 Usuń na zawsze',
    danger:       true,
    onConfirm: () => {
      setArchive(archive.filter(a => a.yearKey !== yearKey));
      delete schedData[yearKey];
      persistAll();
      renderArchiveBody();
      notify('🗑 Usunięto archiwum');
    },
  });
}

(function () {
  const _ap = document.getElementById('archivePanel');
  if (_ap) _ap.addEventListener('click', e => { if (e.target === _ap) closeArchive(); });
})();

// ================================================================
//  INNE AKCJE
// ================================================================

export function clearDay() {
  const dayName = appState.days[currentDay];
  showConfirm({
    message:      `Wyczyścić wszystkie wpisy dla:<br><strong>${esc(dayName)}</strong>?<br><span style="font-size:0.78rem;color:var(--text-muted)">Możesz cofnąć tę operację przez Ctrl+Z.</span>`,
    confirmLabel: '🗑 Wyczyść dzień',
    danger:       true,
    onConfirm: () => {
      undoPush(`Wyczyszczenie dnia: ${dayName}`);
      const yk = appState.yearKey;
      schedData[yk][currentDay] = {};
      appState.hours.forEach(h => { schedData[yk][currentDay][h] = {}; });
      persistAll();
      renderSchedule();
      notify('🗑 Dzień wyczyszczony');
    },
  });
}

export function exportPDF() {
  const vf = document.getElementById('validFrom').value;
  if (!validFromDates[appState.yearKey]) validFromDates[appState.yearKey] = {};
  validFromDates[appState.yearKey][currentDay] = vf;

  const schoolFull  = appState.school?.name  || appState.school?.short || '';
  const schoolShort = appState.school?.short || '';
  const schoolLabel = schoolFull && schoolShort && schoolFull !== schoolShort
    ? `${schoolFull} (${schoolShort})`
    : schoolFull || schoolShort || 'SalePlan';
  const yearLabel   = appState.yearLabel || appState.yearKey || '';
  const dayLabel    = (appState.days || [])[currentDay] || '';
  const vfFormatted = vf
    ? new Date(vf).toLocaleDateString('pl-PL', {day: '2-digit', month: 'long', year: 'numeric'})
    : 'nie podano';

  const hdr = document.getElementById('pdfHeader');
  hdr.querySelector('.pdf-school').textContent = schoolLabel;
  hdr.querySelector('.pdf-year').textContent   = `Rok szkolny ${yearLabel}`;

  const filterEl  = hdr.querySelector('.pdf-filter');
  const DAY_ABBR  = ['PN', 'WT', 'SR', 'CZW', 'PT'];
  const dayAbbr   = DAY_ABBR[currentDay] || String(currentDay + 1);
  const yearShort = yearLabel.replace(/20(\d{2})\/20(\d{2})/, '$1-$2').replace(/\//g, '-');
  const vfDate    = vf ? vf.replace(/-/g, '').slice(2) : '';

  if (_viewMode === 'rooms') {
    hdr.querySelector('.pdf-day').textContent  = `· ${dayLabel}`;
    hdr.querySelector('.pdf-from').textContent = vfFormatted;
    filterEl.style.display = 'none';
    filterEl.textContent   = '';
    document.title = `${dayAbbr}_${yearShort}${vfDate ? '_v' + vfDate : ''}`;
  } else if (_viewMode === 'teacher') {
    const teacher = getTeacherByAbbr(_viewFilter);
    const tName   = teacher ? teacherDisplayName(teacher) : _viewFilter;
    const tAbbr   = _viewFilter || '';
    hdr.querySelector('.pdf-day').textContent  = '';
    hdr.querySelector('.pdf-from').textContent = '';
    filterEl.style.display = 'inline';
    filterEl.textContent   = `👤 ${tName}${tAbbr && tAbbr !== tName ? ' (' + tAbbr + ')' : ''}  —  plan tygodniowy`;
    document.title = `nauczyciel_${tAbbr}_${yearShort}`;
  } else if (_viewMode === 'class') {
    const classObj   = (appState.classes || []).find(c => (c.abbr || c.name) === _viewFilter);
    const className  = classObj ? classObj.name : _viewFilter;
    const childCount = (appState.classes || []).filter(c => c.baseClass === _viewFilter).length;
    const classLabel = childCount > 0 ? `${className} (+${childCount} gr.)` : className;
    hdr.querySelector('.pdf-day').textContent  = '';
    hdr.querySelector('.pdf-from').textContent = '';
    filterEl.style.display = 'inline';
    filterEl.textContent   = `🏫 Klasa ${classLabel}  —  plan tygodniowy`;
    document.title = `klasa_${_viewFilter}_${yearShort}`;
  }

  window.print();

  document.title         = 'SalePlan — Plan Sal Zajęciowych';
  filterEl.style.display = 'none';
  filterEl.textContent   = '';
}

// Aktualizuj validFrom przy zmianie inputa
(function () {
  const _vf = document.getElementById('validFrom');
  if (_vf) _vf.addEventListener('change', () => {
    if (!appState) return;
    if (!validFromDates[appState.yearKey]) validFromDates[appState.yearKey] = {};
    validFromDates[appState.yearKey][currentDay] = _vf.value;
  });
})();

// ================================================================
//  HAMBURGER MENU
// ================================================================

export function toggleMobileMenu() {
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

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const menu = document.getElementById('mobileMenu');
    if (menu && menu.classList.contains('open')) toggleMobileMenu();
  }
});

// ================================================================
//  MOTYW (theme)
// ================================================================

export function applyTheme(theme) {
  const isLight = theme === 'light';
  document.body.classList.toggle('light', isLight);
  const icon = isLight ? '☀️' : '🌙';
  ['themeToggle', 'themeToggleWizard'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.textContent = icon;
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isLight ? '#f0f4fa' : '#080c12';
}

export function toggleTheme() {
  const isLight = document.body.classList.contains('light');
  const next = isLight ? 'dark' : 'light';
  localStorage.setItem('sp_theme', next);
  applyTheme(next);
}

// ================================================================
//  HOMEROOM (gospodarz sali)
// ================================================================

let _hrKey = null;

export function openHomeroomModal(key) {
  _hrKey = key;
  const cols = flattenColumns(appState.floors);
  const col  = cols.find(c => colKey(c) === key);
  const bld  = (appState.buildings || [])[col?.floor?.buildingIdx || 0];
  const hr   = (appState.homerooms || {})[key] || {};

  document.getElementById('hrModalSub').textContent =
    `${bld ? bld.name + ' · ' : ''}${col?.floor.name || ''} › Sala ${col?.room.num || '?'}`;

  const classes = (appState.classes || [])
    .slice()
    .sort((a, b) =>
      a.name.localeCompare(b.name, 'pl', {numeric: true, sensitivity: 'base'}) ||
      (a.group || '').localeCompare(b.group || '', 'pl', {sensitivity: 'base'})
    );

  // Opcje pierwszego gospodarza
  let clsOpts = '<option value="">— brak —</option>';
  const seen = new Set();
  classes.filter(c => c.name).forEach(c => {
    const val = c.abbr || c.name;
    if (!seen.has(val)) {
      seen.add(val);
      const lbl = c.group && c.group.toLowerCase() !== 'cała klasa'
        ? `${c.name} — ${c.group}` : c.name;
      clsOpts += `<option value="${esc(val)}"${val === (hr.className || '') ? ' selected' : ''}>${esc(lbl)}</option>`;
    }
  });
  document.getElementById('hrClass').innerHTML   = clsOpts;
  document.getElementById('hrTeacher').innerHTML = buildTeacherSelectOptions(hr.teacherAbbr || '');

  // Opcje drugiego gospodarza
  let clsOpts2 = '<option value="">— brak —</option>';
  const seen2 = new Set();
  classes.filter(cl => cl.name).forEach(cl => {
    const val = cl.abbr || cl.name;
    if (!seen2.has(val)) {
      seen2.add(val);
      const lbl = cl.group && cl.group.toLowerCase() !== 'cała klasa'
        ? cl.name + ' — ' + cl.group : cl.name;
      clsOpts2 += `<option value="${esc(val)}"${val === (hr.className2 || '') ? ' selected' : ''}>${esc(lbl)}</option>`;
    }
  });
  document.getElementById('hrClass2').innerHTML   = clsOpts2;
  document.getElementById('hrTeacher2').innerHTML = buildTeacherSelectOptions(hr.teacherAbbr2 || '');
  document.getElementById('hrClass2').value   = hr.className2   || '';
  document.getElementById('hrTeacher2').value = hr.teacherAbbr2 || '';

  const hasSecond = !!(hr.className2 || hr.teacherAbbr2);
  document.getElementById('hrSecondSection').style.display = hasSecond ? '' : 'none';
  document.getElementById('hrToggle2Btn').textContent = hasSecond
    ? '− Usuń drugiego gospodarza' : '＋ Dodaj drugiego gospodarza';

  document.getElementById('homeroomModal').classList.add('show');
  document.getElementById('hrClass').focus();
}

export function closeHomeroomModal() {
  document.getElementById('homeroomModal').classList.remove('show');
  _hrKey = null;
}

export function saveHomeroom() {
  if (!_hrKey) return;
  if (!appState.homerooms) appState.homerooms = {};
  const cls2 = document.getElementById('hrClass2').value;
  const tch2 = document.getElementById('hrTeacher2').value;
  appState.homerooms[_hrKey] = {
    className:    document.getElementById('hrClass').value,
    teacherAbbr:  document.getElementById('hrTeacher').value,
    className2:   cls2 || '',
    teacherAbbr2: tch2 || '',
  };
  persistAll();
  closeHomeroomModal();
  renderSchedule();
  notify('✓ Gospodarz sali zapisany');
}

export function hrToggleSecond() {
  const sec = document.getElementById('hrSecondSection');
  const btn = document.getElementById('hrToggle2Btn');
  const visible = sec.style.display !== 'none';
  if (visible) {
    sec.style.display = 'none';
    btn.textContent = '＋ Dodaj drugiego gospodarza';
    document.getElementById('hrClass2').value   = '';
    document.getElementById('hrTeacher2').value = '';
  } else {
    sec.style.display = '';
    btn.textContent = '− Usuń drugiego gospodarza';
  }
}

export function clearHomeroom() {
  if (!_hrKey) return;
  if (appState.homerooms) delete appState.homerooms[_hrKey];
  persistAll();
  closeHomeroomModal();
  renderSchedule();
  notify('🗑 Gospodarz sali usunięty');
}

// Nasłuchiwacze modali
(function () {
  const _cd = document.getElementById('cookieDetailModal');
  if (_cd) _cd.addEventListener('click', e => { if (e.target === _cd) { /* closeCookieDetail from utils */ } });
  const _am = document.getElementById('aboutModal');
  if (_am) _am.addEventListener('click', e => { if (e.target === _am) closeAboutModal(); });
  const _hm = document.getElementById('homeroomModal');
  if (_hm) _hm.addEventListener('click', e => { if (e.target === _hm) closeHomeroomModal(); });
})();

// ================================================================
//  IMPORT PIĘTER Z PLIKU TXT (kreator)
// ================================================================

export function handleFloorImportDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer?.files?.[0];
  if (file) readFloorTxtFile(file);
}

export function handleFloorImportFile(input) {
  if (input.files?.[0]) readFloorTxtFile(input.files[0]);
}

function readFloorTxtFile(file) {
  const reader = new FileReader();
  reader.onload  = e => importFloorsFromText(e.target.result);
  reader.onerror = () => notify('⚠ Błąd odczytu pliku', true);
  reader.readAsText(file, 'utf-8');
}

export function importFloorsFromText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const multiBuilding = wBuildings.length > 1;
  let added = 0, skipped = 0;

  lines.forEach(line => {
    const parts = line.split(/[;,]/).map(p => p.trim());
    let buildingName, floorName, segName, roomNum, roomSub;

    if (multiBuilding) {
      [buildingName, floorName, segName, roomNum, roomSub] = parts;
    } else {
      [floorName, segName, roomNum, roomSub] = parts;
      buildingName = wBuildings[0]?.name || '';
    }

    if (!roomNum) { skipped++; return; }

    let buildingIdx = 0;
    if (multiBuilding && buildingName) {
      const bi = wBuildings.findIndex(b =>
        b.name.trim().toLowerCase() === buildingName.trim().toLowerCase()
      );
      if (bi >= 0) buildingIdx = bi;
    }

    const fName = (floorName || 'Parter').trim();
    let floor = wFloors.find(f =>
      f.name.trim() === fName && (f.buildingIdx || 0) === buildingIdx
    );
    if (!floor) {
      const color = FLOOR_COLORS[wFloors.length % FLOOR_COLORS.length];
      floor = {name: fName, color, buildingIdx, segments: []};
      wFloors.push(floor);
    }

    const sName = (segName || '').trim();
    let seg = floor.segments.find(s => s.name.trim() === sName);
    if (!seg) {
      seg = {name: sName, rooms: []};
      floor.segments.push(seg);
    }

    if (seg.rooms.some(r => r.num.trim() === roomNum.trim())) { skipped++; return; }
    seg.rooms.push({num: roomNum.trim(), sub: (roomSub || '').trim()});
    added++;
  });

  renderFloorList();

  const prev = document.getElementById('floorImportPreview');
  if (prev) {
    prev.textContent = `✓ Dodano ${added} sal${added === 1 ? 'ę' : added < 5 ? 'e' : ''}${skipped ? ` · ${skipped} pominięto (duplikaty / błędy)` : ''}`;
    prev.style.color = added > 0 ? 'var(--green)' : 'var(--red)';
  }
  if (added > 0) notify(`✓ Zaimportowano ${added} sal z pliku`);
}

// ================================================================
//  QUICK-ADD (z modalu edycji komórki)
// ================================================================

export function toggleQuickAdd(type) {
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

export function qaAutoAbbr() {
  const first    = document.getElementById('qaTeacherFirst').value;
  const last     = document.getElementById('qaTeacherLast').value;
  const existing = (appState?.teachers || []).map(t => t.abbr);
  document.getElementById('qaTeacherAbbr').value = ensureUniqueAbbr(genAbbr(first, last), existing);
}

export function qaAutoClassAbbr() {
  const name    = document.getElementById('qaClassName').value.trim();
  const group   = document.getElementById('qaClassGroup')?.value.trim() || '';
  const abbrInp = document.getElementById('qaClassAbbr');
  if (!abbrInp.value || abbrInp.dataset.auto === '1') {
    const generated        = autoClassAbbr(name, group);
    abbrInp.value          = generated;
    abbrInp.dataset.auto   = '1';
  }
}

export function qaAddTeacher() {
  const first = document.getElementById('qaTeacherFirst').value.trim();
  const last  = document.getElementById('qaTeacherLast').value.trim();
  let   abbr  = document.getElementById('qaTeacherAbbr').value.trim().toUpperCase();

  if (!first && !last) { notify('⚠ Wpisz imię lub nazwisko', true); return; }
  if (!abbr) abbr = ensureUniqueAbbr(genAbbr(first, last), (appState?.teachers || []).map(t => t.abbr));

  if ((appState.teachers || []).some(t => t.abbr === abbr)) {
    notify('⚠ Skrót "' + abbr + '" już istnieje — zmień go', true);
    return;
  }

  if (!appState.teachers) appState.teachers = [];
  appState.teachers.push({first, last, abbr});
  persistAll();

  document.getElementById('inpTeacher').innerHTML = buildTeacherSelectOptions(abbr);
  toggleQuickAdd('teacher');
  notify('✓ Dodano nauczyciela: ' + abbr + ' — ' + [first, last].filter(Boolean).join(' '));
}

export function qaAddClass() {
  const name  = normalizeClassName(document.getElementById('qaClassName').value);
  let   abbr  = document.getElementById('qaClassAbbr').value.trim().toUpperCase();
  const group = document.getElementById('qaClassGroup').value.trim() || 'cała klasa';

  if (!name) { notify('⚠ Wpisz nazwę klasy', true); return; }
  if (!abbr) abbr = autoClassAbbr(name, group);

  if ((appState.classes || []).some(c =>
    c.name.toLowerCase() === name.toLowerCase() && c.group.toLowerCase() === group.toLowerCase()
  )) {
    notify('⚠ Taka klasa/grupa już istnieje', true);
    return;
  }

  if (!appState.classes) appState.classes = [];
  appState.classes.push({name, abbr, group});
  persistAll();

  if (!_selectedClasses.includes(abbr)) {
    setSelectedClasses([..._selectedClasses, abbr]);
    renderMultiClassList(_selectedClasses);
  }
  toggleQuickAdd('class');
  notify('✓ Dodano: ' + name + ' — ' + group);
}

// ================================================================
//  PWA — SERVICE WORKER & INSTALL PROMPT
// ================================================================

let _pwaPrompt = null;
let _swUpdateBannerShown = false;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        setInterval(() => reg.update(), 60000);

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              _showSwUpdateBanner();
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed:', err));

    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SW_UPDATED') _showSwUpdateBanner();
    });

    let _firstController = navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!_firstController) { _firstController = navigator.serviceWorker.controller; return; }
      _showSwUpdateBanner();
    });
  });
}

function _showSwUpdateBanner() {
  if (_swUpdateBannerShown) return;
  _swUpdateBannerShown = true;
  const banner = document.getElementById('swUpdateBanner');
  if (banner) {
    banner.classList.add('show');
  } else {
    notify('🔄 Dostępna nowa wersja — odśwież stronę');
  }
}

export function swUpdateReload() {
  window.location.reload();
}

export function swUpdateDismiss() {
  const banner = document.getElementById('swUpdateBanner');
  if (banner) banner.classList.remove('show');
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;
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

export function pwaInstall() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice
    .then(result => {
      if (result.outcome === 'accepted') notify('✓ SalePlan zainstalowany!');
      _pwaPrompt = null;
    })
    .catch(() => { _pwaPrompt = null; });
}

export function pwaDismiss() {
  document.getElementById('pwaInstallBanner').classList.remove('show');
  localStorage.setItem('sp_pwa_dismissed', '1');
}

// ================================================================
//  REGULAMIN (terms)
// ================================================================

export const TERMS_KEY = 'sp_terms_accepted';

export function initTermsBanner() {
  if (!localStorage.getItem(TERMS_KEY)) {
    document.getElementById('termsBanner').classList.add('show');
  }
}

export function acceptTerms() {
  localStorage.setItem(TERMS_KEY, '1');
  document.getElementById('termsBanner').classList.remove('show');
}

export function showTermsModal() {
  document.getElementById('termsModal').classList.add('show');
}

export function closeTermsModal() {
  document.getElementById('termsModal').classList.remove('show');
}

export function showTermsModalFromBanner() {
  document.getElementById('termsModal').classList.add('show');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('termsModal')?.classList.contains('show')) {
      closeTermsModal();
    }
  }
});

(function () {
  const m = document.getElementById('termsModal');
  if (m) m.addEventListener('click', e => { if (e.target === m) closeTermsModal(); });
})();

// ================================================================
//  O PROGRAMIE
// ================================================================

export const APP_VERSION     = '2.5.7';
export const APP_LAST_UPDATE = '2026-04-25';

export function showAboutModal() {
  const vEl = document.getElementById('aboutVersionText');
  if (vEl) vEl.textContent = APP_VERSION;
  const dEl = document.getElementById('aboutUpdateDate');
  if (dEl) {
    try {
      dEl.textContent = new Date(APP_LAST_UPDATE).toLocaleDateString('pl-PL', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch (e) {
      dEl.textContent = APP_LAST_UPDATE;
    }
  }
  document.getElementById('aboutModal').classList.add('show');
}

export function closeAboutModal() {
  document.getElementById('aboutModal').classList.remove('show');
}

// ================================================================
//  INICJALIZACJA — DOMContentLoaded
// ================================================================

let _uiDraftTimer = null;

document.addEventListener('DOMContentLoaded', function () {
  loadAll();
  initTermsBanner();
  initImportDragDrop();

  // Autosave szkicu przy zmianie pól kreatora (krok 0 i 1)
  ['wSchoolName', 'wSchoolShort', 'wSchoolPhone', 'wSchoolWeb', 'wYear', 'wHours'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      clearTimeout(_uiDraftTimer);
      _uiDraftTimer = setTimeout(wizardSaveDraft, 3000);
    });
  });

  applyTheme(localStorage.getItem('sp_theme') || 'dark');

  if (!appState) {
    showWelcomeScreen();
  } else {
    const yk = appState.yearKey;
    if (!schedData[yk]) schedData[yk] = {};
    (appState.days || DAYS_DEFAULT).forEach((_, i) => {
      if (!schedData[yk][i]) schedData[yk][i] = {};
      (appState.hours || []).forEach(h => {
        if (!schedData[yk][i][h]) schedData[yk][i][h] = {};
      });
    });
    mountApp();
  }
});
