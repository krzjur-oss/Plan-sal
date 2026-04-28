// ================================================================
//  schedule.js — Etap 5 refaktoryzacji PlanLekcji
//  Zawiera: mountApp, switchDay, DnD, renderSchedule, updateStatusBar,
//           setViewMode/renderViewTable, timesloty, przedmioty,
//           modal edycji komórki (openEditModal/closeEditModal/...)
// ================================================================

import {
  appState, schedData, validFromDates,
  currentDay, setCurrentDay,
  _viewMode, _viewFilter, setViewMode as _setViewMode, setViewFilter,
  _mDay, _mHour, _mKey, setMDay, setMHour, setMKey,
  _selectedClasses, setSelectedClasses,
  _undoStack, _redoStack, setUndoStack, setRedoStack,
  wSubjects, setWSubjects,
  wTimeslots, setWTimeslots,
  BUILDING_COLORS,
} from './state.js';

import { undoPush, _undoUpdateUI, undoAction, redoAction } from './utils.js';

import {
  esc, sbSet, notify, showConfirm,
  colKey, flattenColumns, invalidateColumnCache,
  getTeacherByAbbr, teacherDisplayName, resolveClassName,
  buildTeacherSelectOptions, mergeClassNames,
} from './helpers.js';

import { detectCollisions } from './collisions.js';

import { persistAll, storageUsageBytes, formatBytes } from './import-export.js';

import { wizardSaveDraft } from './storage.js';

// ================================================================
//  STAŁE LOKALNE
// ================================================================

const TIMESLOTS_DEFAULT_45 = [
  {label:'0', start:'07:00', end:'07:45'},
  {label:'1', start:'07:55', end:'08:40'},
  {label:'2', start:'08:50', end:'09:35'},
  {label:'3', start:'09:45', end:'10:30'},
  {label:'4', start:'10:45', end:'11:30'},
  {label:'5', start:'11:45', end:'12:30'},
  {label:'6', start:'12:40', end:'13:25'},
  {label:'7', start:'13:35', end:'14:20'},
  {label:'8', start:'14:30', end:'15:15'},
  {label:'9', start:'15:25', end:'16:10'},
  {label:'10',start:'16:20', end:'17:05'},
];

const SUBJECTS_PRESET = [
  {name:'Język polski',                   abbr:'J.pol'},
  {name:'Język angielski',                abbr:'J.ang'},
  {name:'Język niemiecki',                abbr:'J.niem'},
  {name:'Język rosyjski',                 abbr:'J.ros'},
  {name:'Język francuski',                abbr:'J.fr'},
  {name:'Matematyka',                     abbr:'Mat'},
  {name:'Fizyka',                         abbr:'Fiz'},
  {name:'Chemia',                         abbr:'Chem'},
  {name:'Biologia',                       abbr:'Bio'},
  {name:'Geografia',                      abbr:'Geo'},
  {name:'Historia',                       abbr:'Hist'},
  {name:'Wiedza o społeczeństwie',        abbr:'WOS'},
  {name:'Informatyka',                    abbr:'Inf'},
  {name:'Technika',                       abbr:'Tech'},
  {name:'Plastyka',                       abbr:'Plas'},
  {name:'Muzyka',                         abbr:'Muz'},
  {name:'Wychowanie fizyczne',            abbr:'WF'},
  {name:'Religia',                        abbr:'Rel'},
  {name:'Etyka',                          abbr:'Etyka'},
  {name:'Wychowanie do życia w rodzinie', abbr:'WDŻ'},
  {name:'Edukacja dla bezpieczeństwa',    abbr:'EDB'},
  {name:'Podstawy przedsiębiorczości',    abbr:'PP'},
  {name:'Godzina wychowawcza',            abbr:'GW'},
];

// ================================================================
//  HELPERS LOKALNE
// ================================================================

function _roomLabel(fi, si, num) {
  const segLetter = String.fromCharCode(65 + si); // A, B, C…
  return `${fi}${segLetter}${num}`;
}

// Skrót nazwy przedmiotu
export function subjectAbbr(subject) {
  if (!subject) return '';
  const s = subject.trim();
  if (s.length <= 4) return s;
  const IGNORE = new Set(['i','w','z','na','dla','ze','lub','a','o','do','po','od','as']);
  const words = s.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1) {
    return s.charAt(0).toUpperCase() + s.slice(1, 3).toLowerCase();
  }
  const initials = words
    .filter(w => !IGNORE.has(w.toLowerCase()))
    .map(w => w.charAt(0).toUpperCase());
  return initials.join('');
}

// ================================================================
//  TIMESLOTY — pomocnicze
// ================================================================

export function getTimeslot(hourKey) {
  const ts = appState?.timeslots;
  if (!ts || !ts.length) return null;
  return ts.find(t => t.label === String(hourKey)) || null;
}

export function formatTimeCell(hourKey) {
  const ts = getTimeslot(hourKey);
  if (!ts || (!ts.start && !ts.end)) return `<span class="time-num">${esc(String(hourKey))}</span>`;
  return `<span class="time-num">${esc(ts.label || String(hourKey))}</span>
          <span class="time-range">${esc(ts.start || '')}–${esc(ts.end || '')}</span>`;
}

// ================================================================
//  MAIN APP — mountApp / switchDay
// ================================================================

export function mountApp() {
  if (!appState) return;
  invalidateColumnCache();
  const _ao = document.getElementById('appOverlay');
  _ao.style.display = '';
  _ao.classList.add('show');
  document.getElementById('currentYearLabel').textContent = appState.yearLabel;
  document.getElementById('sbYear').textContent = appState.yearLabel;
  const schoolName = appState.school?.name || appState.school?.short || '';
  const snEl = document.getElementById('hmenuSchoolName');
  if (snEl) snEl.textContent = schoolName;
  document.title = `SalePlan — ${schoolName || 'Plan Sal'}`;

  const tabsEl = document.getElementById('dayTabs');
  tabsEl.innerHTML = appState.days.map((d, i) =>
    `<button class="day-btn ${i === 0 ? 'active' : ''}" onclick="switchDay(${i})">${esc(d)}</button>`
  ).join('');

  const vfDates = validFromDates[appState.yearKey] || {};
  document.getElementById('validFrom').value = vfDates[currentDay] || '';

  const yk = appState.yearKey;
  if (!schedData[yk]) schedData[yk] = {};
  appState.days.forEach((_, i) => {
    if (!schedData[yk][i]) schedData[yk][i] = {};
    appState.hours.forEach(h => { if (!schedData[yk][i][h]) schedData[yk][i][h] = {}; });
  });

  renderSchedule();

  const undoBar = document.getElementById('undoRedoBtns');
  if (undoBar) undoBar.style.display = 'flex';
  setUndoStack([]);
  setRedoStack([]);
  _undoUpdateUI();

  _setViewMode('rooms');
  setViewFilter('');
  _updateViewToolbar();

  requestAnimationFrame(() => {
    function setMainHeight() {
      const topbar    = document.querySelector('.topbar');
      const mainEl    = document.querySelector('.main');
      const statusbar = document.querySelector('.statusbar');
      if (topbar && mainEl) {
        const tbH = topbar.offsetHeight || 110;
        const sbH = statusbar?.offsetHeight || 32;
        mainEl.style.height    = `calc(100vh - ${tbH}px - ${sbH}px)`;
        mainEl.style.maxHeight = mainEl.style.height;
      }
    }
    setMainHeight();
    if (window._topbarResizeObs) window._topbarResizeObs.disconnect();
    const topbarEl = document.querySelector('.topbar');
    if (topbarEl && typeof ResizeObserver !== 'undefined') {
      window._topbarResizeObs = new ResizeObserver(setMainHeight);
      window._topbarResizeObs.observe(topbarEl);
    }
  });
}

export function switchDay(idx) {
  setCurrentDay(idx);
  document.querySelectorAll('.day-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
  const vfDates = validFromDates[appState.yearKey] || {};
  document.getElementById('validFrom').value = vfDates[currentDay] || '';
  renderSchedule();
}

// ================================================================
//  DRAG & DROP
// ================================================================

let _dndSrcDay, _dndSrcHour, _dndSrcKey;

export function dndStart(e, day, hour, key) {
  _dndSrcDay  = day;
  _dndSrcHour = hour;
  _dndSrcKey  = key;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', day + '|' + hour + '|' + key);

  const entry    = schedData[appState.yearKey]?.[day]?.[hour]?.[key] || {};
  const clsLabel = (entry.classes && entry.classes.length
    ? entry.classes
    : entry.className ? [entry.className] : []).join(', ');
  const ghost = document.createElement('div');
  ghost.className = 'dnd-ghost';
  ghost.id = '_dndGhost';
  ghost.innerHTML = (clsLabel ? `<b>${esc(clsLabel)}</b><br>` : '') +
                    (entry.subject ? esc(subjectAbbr(entry.subject)) + '<br>' : '') +
                    (entry.teacherAbbr ? esc(entry.teacherAbbr) : '');
  ghost.style.left = '-999px';
  ghost.style.top  = '-999px';
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 60, 20);

  setTimeout(() => e.target.classList.add('dnd-dragging'), 0);
}

export function dndEnd(e) {
  e.target.classList.remove('dnd-dragging');
  const ghost = document.getElementById('_dndGhost');
  if (ghost) ghost.remove();
  document.querySelectorAll('.dnd-over, .dnd-over-filled').forEach(el => {
    el.classList.remove('dnd-over', 'dnd-over-filled');
  });
}

export function dndOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget;
  const isFilled = el.classList.contains('filled');
  el.classList.toggle('dnd-over', !isFilled);
  el.classList.toggle('dnd-over-filled', isFilled);
}

export function dndLeave(e) {
  e.currentTarget.classList.remove('dnd-over', 'dnd-over-filled');
}

export function dndDrop(e, day, hour, key) {
  e.preventDefault();
  e.currentTarget.classList.remove('dnd-over', 'dnd-over-filled');

  if (_dndSrcDay === day && _dndSrcHour === hour && _dndSrcKey === key) return;

  const yk       = appState.yearKey;
  const srcEntry = schedData[yk]?.[_dndSrcDay]?.[_dndSrcHour]?.[_dndSrcKey];
  if (!srcEntry || (!srcEntry.teacherAbbr && !(srcEntry.classes || []).length && !srcEntry.className)) return;

  const dstEntry  = schedData[yk]?.[day]?.[hour]?.[key];
  const dstFilled = dstEntry && (dstEntry.teacherAbbr || (dstEntry.classes || []).length || dstEntry.className);

  function _doDrop() {
    undoPush(`DnD → ${key}, godz. ${hour}, ${appState.days[day]}`);
    if (!schedData[yk][day])        schedData[yk][day] = {};
    if (!schedData[yk][day][hour])  schedData[yk][day][hour] = {};
    // Skopiuj do celu
    schedData[yk][day][hour][key] = structuredClone(srcEntry);
    // Wyczyść źródło (przeniesienie, nie kopiowanie)
    if (schedData[yk][_dndSrcDay]?.[_dndSrcHour]) {
      schedData[yk][_dndSrcDay][_dndSrcHour][_dndSrcKey] = {};
    }
    persistAll();
    renderSchedule();
    sbSet('✓ Przeniesiono zajęcia');
  }

  if (dstFilled) {
    showConfirm({
      message:      'Komórka docelowa jest zajęta.<br>Nadpisać jej zawartość?',
      confirmLabel: 'Nadpisz',
      danger:       true,
      onConfirm:    _doDrop,
    });
  } else {
    _doDrop();
  }
}

// ================================================================
//  WIDOK NAUCZYCIELA / KLASY
// ================================================================

export function setViewMode(mode, filter) {
  _setViewMode(mode || 'rooms');
  setViewFilter(filter || '');
  _updateViewToolbar();
  renderSchedule();
}

function _updateViewToolbar() {
  const isRooms = _viewMode === 'rooms';

  ['viewBtnRooms', 'viewBtnTeacher', 'viewBtnClass'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const mode = id === 'viewBtnRooms' ? 'rooms' : id === 'viewBtnTeacher' ? 'teacher' : 'class';
    el.classList.toggle('active', mode === _viewMode);
  });

  const sel = document.getElementById('viewFilterSelect');
  if (sel) {
    sel.style.display = isRooms ? 'none' : '';
    if (!isRooms) _populateViewFilter(sel);
  }

  const dayTabsEl = document.getElementById('dayTabs');
  if (dayTabsEl) dayTabsEl.style.display = isRooms ? 'flex' : 'none';

  const vmBar = document.getElementById('viewModeBar');
  if (vmBar) vmBar.style.display = 'flex';
}

function _populateViewFilter(sel) {
  const prev = sel.value;
  sel.innerHTML = '';
  if (_viewMode === 'teacher') {
    const teachers = (appState?.teachers || [])
      .slice()
      .sort((a, b) => (a.last || '').localeCompare(b.last || '', 'pl', {sensitivity: 'base'}));
    teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.abbr;
      opt.textContent = `${t.last || ''} ${t.first || ''} (${t.abbr})`.trim();
      sel.appendChild(opt);
    });
  } else {
    const allClasses = (appState?.classes || []);
    const basesFromChildren = new Set(allClasses.filter(c => c.baseClass).map(c => c.baseClass));
    const selfBases = new Set(allClasses.filter(c => !c.baseClass).map(c => c.name));
    const allBases  = [...new Set([...selfBases, ...basesFromChildren])]
      .sort((a, b) => a.localeCompare(b, 'pl', {sensitivity: 'base'}));

    allBases.forEach(baseName => {
      const childCount = allClasses.filter(c => c.baseClass === baseName).length;
      const opt = document.createElement('option');
      opt.value = baseName;
      opt.textContent = baseName + (childCount > 0 ? ` (+${childCount} gr.)` : '');
      sel.appendChild(opt);
    });
  }
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  else if (sel.options.length) sel.value = sel.options[0].value;
  setViewFilter(sel.value);
}

export function onViewFilterChange(val) {
  setViewFilter(val);
  renderSchedule();
}

export function renderViewTable(mode, filter) {
  const yk    = appState.yearKey;
  const hours = appState.hours;
  const days  = appState.days;
  const cols  = flattenColumns(appState.floors);

  const classAbbrSet = new Set();
  if (mode === 'class') {
    (appState.classes || []).forEach(c => {
      const isBase  = !c.baseClass && c.name === filter;
      const isChild = c.baseClass === filter;
      if (isBase || isChild) classAbbrSet.add(c.abbr || c.name);
    });
    if (!classAbbrSet.size) classAbbrSet.add(filter);
  }

  const byDayHour = {};
  days.forEach((_, di) => {
    byDayHour[di] = {};
    const dayData = schedData[yk]?.[di] || {};
    hours.forEach(h => {
      byDayHour[di][h] = [];
      cols.forEach(col => {
        const key   = colKey(col);
        const entry = dayData[h]?.[key] || {};
        const filled = !!(entry.teacherAbbr || entry.subject || entry.className || (entry.classes || []).length);
        if (!filled) return;
        let match;
        if (mode === 'teacher') {
          match = entry.teacherAbbr === filter;
        } else {
          const entryCls = (entry.classes || []).length
            ? entry.classes
            : (entry.className ? [entry.className] : []);
          match = entryCls.some(cls => classAbbrSet.has(cls));
        }
        if (match) byDayHour[di][h].push({col, key, entry});
      });
    });
  });

  const filterLabel = mode === 'teacher'
    ? (() => { const t = getTeacherByAbbr(filter); return t ? teacherDisplayName(t) : filter; })()
    : (() => {
        if (mode !== 'class') return filter;
        const childCount = (appState.classes || []).filter(c => c.baseClass === filter).length;
        return filter + (childCount > 0 ? ` (+${childCount} gr.)` : '');
      })();
  const modeLabel = mode === 'teacher' ? '👤 Nauczyciel' : '🏫 Klasa';

  let thead = `<thead><tr>
    <th class="time-th" style="background:var(--surface)">Godz.</th>
    ${days.map((d, di) =>
      `<th class="th-view-day${di === currentDay ? ' th-view-day-active' : ''}"
          onclick="switchDay(${di});renderSchedule()" style="cursor:pointer;min-width:120px">
        ${esc(d)}</th>`
    ).join('')}
  </tr></thead>`;

  let tbody = '<tbody>';
  hours.forEach(h => {
    tbody += `<tr><td class="time-cell">${formatTimeCell(h)}</td>`;
    days.forEach((_, di) => {
      const entries = byDayHour[di][h] || [];
      if (!entries.length) {
        tbody += `<td><div class="cell-inner cell-inner-view-empty"
          title="Brak zajęć — przełącz na widok sal aby edytować"
          style="cursor:default"><div class="cell-plus" style="opacity:0.25">—</div></div></td>`;
      } else {
        tbody += `<td style="padding:2px;vertical-align:top">`;
        entries.forEach(({col, key, entry}) => {
          const roomLabel = _roomLabel(col.floorIdx, col.segIdx, col.room.num || col.room.sub || '?');
          const clsList   = (entry.classes || []).length ? entry.classes : (entry.className ? [entry.className] : []);
          tbody += `<div class="cell-inner filled view-cell"
              onclick="switchDay(${di});openEditModal(${di},'${esc(String(h))}','${esc(key)}')"
              style="cursor:pointer;margin-bottom:2px">
            <div class="cell-row-cls">${clsList.map(c =>
              `<span class="cell-abbr cell-abbr-cls" title="${esc(resolveClassName(c))}">${esc(c)}</span>`
            ).join('')}</div>
            ${entry.subject ? `<div class="cell-row-subject" title="${esc(entry.subject)}">${esc(subjectAbbr(entry.subject))}</div>` : ''}
            <div class="cell-row-teacher" style="font-size:0.6rem;color:var(--text-muted)">${esc(roomLabel)}</div>
          </div>`;
        });
        tbody += '</td>';
      }
    });
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  let totalLessons = 0;
  days.forEach((_, di) => hours.forEach(h => { if ((byDayHour[di][h] || []).length) totalLessons++; }));

  return {thead, tbody, totalLessons, filterLabel, modeLabel};
}

// ================================================================
//  RENDER SCHEDULE
// ================================================================

export function renderSchedule() {
  if (!appState) return;

  // ── Widok nauczyciela / klasy ──
  if (_viewMode !== 'rooms') {
    const {thead, tbody, totalLessons, filterLabel, modeLabel} = renderViewTable(_viewMode, _viewFilter);
    document.getElementById('scheduleWrap').innerHTML =
      `<div class="view-mode-banner">${modeLabel}: <strong>${esc(filterLabel)}</strong>
        <span style="font-size:0.72rem;color:var(--text-muted);margin-left:10px">${totalLessons} godz. tygodniowo</span></div>
       <table class="schedule-table view-mode-table">${thead}${tbody}</table>`;
    updateStatusBar();
    return;
  }

  const cols       = flattenColumns(appState.floors);
  const hours      = appState.hours;
  const dayData    = schedData[appState.yearKey]?.[currentDay] || {};
  const assignments = appState.assignments[currentDay] || {};
  const buildings  = appState.buildings || [];
  const homerooms  = appState.homerooms || {};

  const uniqueBuildings = [...new Set((appState.floors || []).map(f => f.buildingIdx || 0))];
  const showBuilding = uniqueBuildings.length > 1;
  const showFloor    = (appState.floors || []).some(f => (f.name || '').trim() !== '');
  const showSeg      = (appState.floors || []).some(f =>
    (f.segments || []).some(s => (s.name || '').trim() !== '')
  );

  function buildMergedRow(keyFn, labelFn, stylesFn, extraClass = '', timeCell = '', topPx = 57) {
    const topStyle = `--th-top:${topPx}px;`;
    let row = `<tr><th class="time-th" rowspan="1" style="background:var(--surface);${topStyle}">${timeCell}</th>`;
    let i = 0;
    while (i < cols.length) {
      const key = keyFn(cols[i]);
      let span = 1;
      while (i + span < cols.length && keyFn(cols[i + span]) === key) span++;
      const styles = stylesFn ? stylesFn(cols[i]) : '';
      row += `<th colspan="${span}" class="${extraClass}" style="${topStyle}${styles}">${labelFn(cols[i])}</th>`;
      i += span;
    }
    return row + '</tr>';
  }

  const ROW_H = 26;
  let _rowTop = 0;
  let thead = '<thead>';

  if (showBuilding) {
    thead += buildMergedRow(
      c => c.floor.buildingIdx || 0,
      c => { const bld = buildings[c.floor.buildingIdx || 0]; return esc(bld?.name || '—'); },
      c => { const color = BUILDING_COLORS[(c.floor.buildingIdx || 0) % BUILDING_COLORS.length]; return `color:${color};border-top:3px solid ${color};border-bottom:2px solid ${color}`; },
      'th-building', 'Budynek', _rowTop
    );
    _rowTop += ROW_H;
  }

  if (showFloor) {
    thead += buildMergedRow(
      c => c.floorIdx,
      c => esc(c.floor.name),
      c => `color:${c.floor.color};border-bottom:1px solid ${c.floor.color}40`,
      'th-floor', 'Piętro', _rowTop
    );
    _rowTop += ROW_H;
  }

  if (showSeg) {
    thead += buildMergedRow(
      c => c.floorIdx + '-' + c.segIdx,
      c => esc(c.seg.name || '—'),
      c => `border-top:2px solid ${c.floor.color}60`,
      'th-seg-row', 'Segment', _rowTop
    );
    _rowTop += ROW_H;
  }

  // Rząd: numery sal
  {
    const topStyle = `--th-top:${_rowTop}px;`;
    let row = `<tr><th class="time-th" style="background:var(--surface);${topStyle}">Godz.</th>`;
    cols.forEach(col => {
      const label = col.room.sub
        ? `Sala ${esc(col.room.num)}<br><span style="font-size:0.55rem;color:var(--text-dim)">${esc(col.room.sub)}</span>`
        : `Sala ${esc(col.room.num)}`;
      const floorColor = col.floor.color;
      const topBorder  = !showBuilding && !showFloor && !showSeg
        ? `border-top:3px solid ${floorColor}` : '';
      row += `<th class="th-room-row" style="${topStyle}${topBorder}">${label}</th>`;
    });
    thead += row + '</tr>';
    _rowTop += ROW_H;
  }

  // Rząd: gospod. (wychowawca)
  {
    const topStyle = `--th-top:${_rowTop}px;`;
    let row = `<tr><th class="time-th" style="background:var(--surface);font-size:0.55rem;color:var(--text-dim);${topStyle}">Gospod.</th>`;
    cols.forEach(col => {
      const key        = colKey(col);
      const hr         = homerooms[key] || {};
      const assignedCls  = assignments[key] || '';
      const displayCls   = hr.className || assignedCls || '';
      const hrTeacher    = hr.teacherAbbr  ? getTeacherByAbbr(hr.teacherAbbr)  : null;
      const hrTeacher2   = hr.teacherAbbr2 ? getTeacherByAbbr(hr.teacherAbbr2) : null;
      const displayCls2  = hr.className2 || '';
      const hasTwo = !!(displayCls2 || hrTeacher2);
      row += `<th class="th-homeroom${hasTwo ? ' hr-two' : ''}" onclick="openHomeroomModal('${esc(key)}')" style="cursor:pointer;${topStyle}" title="Kliknij aby ustawić gospodarza">
        ${displayCls || hasTwo
          ? `<div class="hr-pair"><div class="hr-class">${esc(displayCls || '?')}</div>${hrTeacher ? `<div class="hr-teacher">${esc(hrTeacher.abbr)}</div>` : ''}</div>`
          : '<div style="color:var(--text-dim);font-size:0.55rem">—</div>'}
        ${hasTwo ? `<div class="hr-sep"></div><div class="hr-pair"><div class="hr-class hr-class-2">${esc(displayCls2)}</div>${hrTeacher2 ? `<div class="hr-teacher">${esc(hrTeacher2.abbr)}</div>` : ''}</div>` : ''}
      </th>`;
    });
    thead += row + '</tr>';
  }

  thead += '</thead>';

  // ── Body ──
  const collisions = detectCollisions(dayData, hours, cols);

  let tbody = '<tbody>';
  hours.forEach(h => {
    tbody += `<tr><td class="time-cell">${formatTimeCell(h)}</td>`;
    cols.forEach(col => {
      const key    = colKey(col);
      const entry  = dayData[h]?.[key] || {};
      const filled = !!(entry.teacherAbbr || entry.subject || entry.className || (entry.classes && entry.classes.length));
      const cellId   = h + '|' + key;
      const cellErrs = collisions[cellId] || [];
      const hasErr   = cellErrs.length > 0;
      const errTip   = cellErrs.join('\n');
      tbody += `<td><div class="cell-inner ${filled ? 'filled' : ''} ${hasErr ? 'collision' : ''}"
            onclick="openEditModal(${currentDay},'${esc(h)}','${esc(key)}')"
            ${filled
              ? `draggable="true"
            ondragstart="dndStart(event,${currentDay},'${esc(h)}','${esc(key)}')"
            ondragend="dndEnd(event)"`
              : ''}
            ondragover="dndOver(event)"
            ondragleave="dndLeave(event)"
            ondrop="dndDrop(event,${currentDay},'${esc(h)}','${esc(key)}')"
            ${hasErr ? `data-collision-tip="${esc(errTip)}"` : ''}
            >${hasErr ? '<span class="cell-collision-icon">⚠</span>' : ''}${
        filled
          ? `<div class="cell-row-cls">${
               mergeClassNames(
                 entry.classes && entry.classes.length
                   ? entry.classes
                   : entry.className ? [entry.className] : []
               ).map(cls =>
                 `<span class="cell-abbr cell-abbr-cls" title="${esc(resolveClassName(cls))}">${esc(cls)}</span>`
               ).join('')
             }</div>
             ${entry.subject ? `<div class="cell-row-subject" title="${esc(entry.subject)}">${esc(subjectAbbr(entry.subject))}</div>` : ''}
             ${entry.teacherAbbr ? `<div class="cell-row-teacher"><span class="cell-abbr">${esc(entry.teacherAbbr)}</span></div>` : ''}`
          : '<div class="cell-plus">＋</div>'
      }</div></td>`;
    });
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  // Kolizje w statusbarze
  const totalCollisions = Object.keys(collisions).length;
  const ccEl  = document.getElementById('collisionCount');
  const sepEl = document.getElementById('collisionSep');
  if (ccEl) {
    if (totalCollisions > 0) {
      const suf = totalCollisions === 1 ? 'a' : totalCollisions < 5 ? 'e' : 'i';
      ccEl.textContent = '⚠ ' + totalCollisions + ' kolizj' + suf;
      ccEl.classList.remove('none');
      if (sepEl) sepEl.style.display = '';
    } else {
      ccEl.classList.add('none');
      if (sepEl) sepEl.style.display = 'none';
    }
  }

  document.getElementById('scheduleWrap').innerHTML =
    `<table class="schedule-table">${thead}${tbody}</table>`;

  updateStatusBar();
}

export function updateStatusBar() {
  const dayData = schedData[appState.yearKey]?.[currentDay] || {};
  let count = 0;
  flattenColumns(appState.floors).forEach(col => {
    appState.hours.forEach(h => {
      const e = dayData[h]?.[colKey(col)];
      if (e && (e.teacherAbbr || e.subject || e.className || (e.classes && e.classes.length))) count++;
    });
  });
  document.getElementById('sbCount').textContent = `${count} wpisów w tym dniu`;

  const storageEl = document.getElementById('sbStorage');
  if (storageEl) {
    const used  = storageUsageBytes();
    const LIMIT = 5 * 1024 * 1024;
    const pct   = Math.min(100, Math.round(used / LIMIT * 100));
    const color = pct > 85 ? 'var(--red)' : pct > 65 ? 'var(--yellow)' : 'var(--text-muted)';
    storageEl.innerHTML =
      `<span style="color:${color}" title="Użycie pamięci lokalnej przeglądarki">` +
      `💾 ${formatBytes(used)} (${pct}%)</span>`;
  }
}

// ================================================================
//  TIMESLOTY
// ================================================================

export function buildTimeslotsFromHours(hours, prevTimeslots) {
  return hours.map(h => {
    const existing = (prevTimeslots || []).find(t => t.label === String(h));
    return existing || {label: String(h), start: '', end: ''};
  });
}

export function initTimeslotEditor() {
  const hoursVal = document.getElementById('wHours')?.value || '';
  const hours = hoursVal.split(',').map(h => h.trim()).filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));
  const ts = wTimeslots;
  setWTimeslots(hours.map(h => {
    const ex  = ts.find(t => t.label === h);
    if (ex) return ex;
    const def = TIMESLOTS_DEFAULT_45.find(t => t.label === h);
    return def ? {...def} : {label: h, start: '', end: ''};
  }));
  renderTimeslotEditor();
}

export function renderTimeslotEditor() {
  const container = document.getElementById('wTimeslotList');
  if (!container) return;
  if (!wTimeslots.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:0.8rem;padding:6px 0">Brak godzin — wróć do poprzedniego kroku i wpisz numery lekcji.</div>';
    return;
  }
  container.innerHTML = wTimeslots.map((ts, i) => `
    <div class="timeslot-row">
      <span class="timeslot-lnum">Godz. ${esc(ts.label)}</span>
      <input class="timeslot-inp" type="time" value="${esc(ts.start || '')}"
        oninput="wTimeslots[${i}].start=this.value" placeholder="--:--"
        title="Początek lekcji">
      <span class="timeslot-sep">–</span>
      <input class="timeslot-inp" type="time" value="${esc(ts.end || '')}"
        oninput="wTimeslots[${i}].end=this.value" placeholder="--:--"
        title="Koniec lekcji">
    </div>`).join('');
}

export function fillTimeslotsDefault() {
  const hoursVal = document.getElementById('wHours')?.value || '';
  const hours = hoursVal.split(',').map(h => h.trim()).filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));
  setWTimeslots(hours.map(h => {
    const def = TIMESLOTS_DEFAULT_45.find(t => t.label === h);
    return def ? {...def} : {label: h, start: '', end: ''};
  }));
  renderTimeslotEditor();
}

export function clearTimeslots() {
  setWTimeslots(wTimeslots.map(t => ({label: t.label, start: '', end: ''})));
  renderTimeslotEditor();
}

// ================================================================
//  SŁOWNIK PRZEDMIOTÓW (kreator)
// ================================================================

export function renderSubjectList() {
  const container = document.getElementById('wSubjectList');
  if (!container) return;
  if (!wSubjects.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:0.8rem;padding:6px 0">Brak przedmiotów — dodaj poniżej lub wczytaj predefiniowane.</div>';
    return;
  }
  container.innerHTML = wSubjects.map((s, i) => `
    <div class="subject-item" id="subjectItem${i}">
      <input class="subject-name-inp" value="${esc(s.name)}" placeholder="Nazwa przedmiotu"
        oninput="wSubjects[${i}].name=this.value;scheduleSubjectAbbrUpdate(${i})">
      <input class="subject-abbr-inp" value="${esc(s.abbr || '')}" placeholder="Skrót" maxlength="8"
        oninput="wSubjects[${i}].abbr=this.value">
      <button class="icon-btn danger" onclick="removeSubject(${i})" title="Usuń">🗑</button>
    </div>`).join('');
}

export function scheduleSubjectAbbrUpdate(i) {
  clearTimeout(wSubjects[i]?._abbrTimer);
  if (wSubjects[i]) {
    wSubjects[i]._abbrTimer = setTimeout(() => {
      const abbrInp = document.querySelector(`#subjectItem${i} .subject-abbr-inp`);
      if (abbrInp && !abbrInp.value.trim()) {
        const auto = autoSubjectAbbr(wSubjects[i].name);
        wSubjects[i].abbr = auto;
        abbrInp.value = auto;
      }
    }, 600);
  }
}

export function autoSubjectAbbr(name) {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 4);
  const SKIP = new Set(['do', 'w', 'z', 'i', 'o', 'na', 'dla', 'ze', 'lub', 'a', 'po', 'od']);
  return words.filter(w => !SKIP.has(w.toLowerCase())).slice(0, 3).map(w => w[0].toUpperCase()).join('');
}

export function addSubject() {
  const s = wSubjects.slice();
  s.push({name: '', abbr: ''});
  setWSubjects(s);
  renderSubjectList();
  wizardSaveDraft();
  setTimeout(() => {
    const items = document.querySelectorAll('.subject-name-inp');
    if (items.length) items[items.length - 1].focus();
  }, 50);
}

export function removeSubject(i) {
  const s = wSubjects.slice();
  s.splice(i, 1);
  setWSubjects(s);
  renderSubjectList();
  wizardSaveDraft();
}

export function loadSubjectPreset() {
  function _doLoad() {
    setWSubjects(structuredClone(SUBJECTS_PRESET));
    renderSubjectList();
    wizardSaveDraft();
  }
  if (wSubjects.length > 0) {
    showConfirm({
      message:      'Zastąpić bieżącą listę przedmiotów listą predefiniowaną?<br><span style="font-size:0.78rem;color:var(--text-muted)">Bieżące wpisy zostaną utracone.</span>',
      confirmLabel: '📋 Zastąp',
      danger:       false,
      onConfirm:    _doLoad,
    });
  } else {
    _doLoad();
  }
}

// ================================================================
//  AUTOCOMPLETE PRZEDMIOTÓW
// ================================================================

export function getSubjectSuggestions() {
  const fromDict = (appState?.subjects || []).map(s => ({name: s.name, abbr: s.abbr}));
  const yk   = appState?.yearKey;
  const seen = new Set(fromDict.map(s => s.name.toLowerCase()));
  if (yk && schedData[yk]) {
    Object.values(schedData[yk]).forEach(dayData => {
      Object.values(dayData).forEach(hourData => {
        Object.values(hourData).forEach(entry => {
          if (entry.subject && !seen.has(entry.subject.toLowerCase())) {
            seen.add(entry.subject.toLowerCase());
            fromDict.push({name: entry.subject, abbr: ''});
          }
        });
      });
    });
  }
  return fromDict.sort((a, b) => a.name.localeCompare(b.name, 'pl', {sensitivity: 'base'}));
}

let _subjectDropdownVisible = false;
let _subjectDropdownItems   = [];
let _subjectDropdownIdx     = -1;

export function initSubjectAutocomplete() {
  const inp = document.getElementById('inpSubject');
  if (!inp) return;
  inp.setAttribute('autocomplete', 'off');
  inp.addEventListener('input', _onSubjectInput);
  inp.addEventListener('focus', _onSubjectInput);
  inp.addEventListener('keydown', _onSubjectKeydown);
  inp.addEventListener('blur', () => setTimeout(_hideSubjectDropdown, 150));
}

function _onSubjectInput() {
  const inp = document.getElementById('inpSubject');
  const q   = (inp?.value || '').trim().toLowerCase();
  const suggestions = getSubjectSuggestions();
  const filtered = q
    ? suggestions.filter(s => s.name.toLowerCase().includes(q) || (s.abbr || '').toLowerCase().includes(q))
    : suggestions;
  if (!filtered.length) { _hideSubjectDropdown(); return; }
  _showSubjectDropdown(filtered, inp);
}

function _showSubjectDropdown(items, inp) {
  let dd = document.getElementById('subjectDropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'subjectDropdown';
    dd.className = 'subject-dropdown';
    document.body.appendChild(dd);
  }
  const rect = inp.getBoundingClientRect();
  dd.style.cssText = `position:fixed;z-index:9999;left:${rect.left}px;top:${rect.bottom + 2}px;width:${rect.width}px`;
  dd.innerHTML = items.slice(0, 12).map((s, i) =>
    `<div class="subject-dd-item" data-idx="${i}" onmousedown="pickSubject(${JSON.stringify(s.name)})">
      <span class="subject-dd-name">${esc(s.name)}</span>
      ${s.abbr ? `<span class="subject-dd-abbr">${esc(s.abbr)}</span>` : ''}
    </div>`
  ).join('');
  dd.style.display = 'block';
  _subjectDropdownVisible = true;
  _subjectDropdownItems   = items.slice(0, 12);
  _subjectDropdownIdx     = -1;
}

function _onSubjectKeydown(e) {
  if (!_subjectDropdownVisible) return;
  const dd    = document.getElementById('subjectDropdown');
  const items = dd?.querySelectorAll('.subject-dd-item');
  if (!items?.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _subjectDropdownIdx = Math.min(_subjectDropdownIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === _subjectDropdownIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _subjectDropdownIdx = Math.max(_subjectDropdownIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('active', i === _subjectDropdownIdx));
  } else if (e.key === 'Enter' && _subjectDropdownIdx >= 0) {
    e.preventDefault();
    e.stopPropagation();
    pickSubject(_subjectDropdownItems[_subjectDropdownIdx].name);
  } else if (e.key === 'Escape') {
    _hideSubjectDropdown();
  }
}

export function pickSubject(name) {
  const inp = document.getElementById('inpSubject');
  if (inp) inp.value = name;
  _hideSubjectDropdown();
}

function _hideSubjectDropdown() {
  const dd = document.getElementById('subjectDropdown');
  if (dd) dd.style.display = 'none';
  _subjectDropdownVisible = false;
  _subjectDropdownIdx     = -1;
}

// ================================================================
//  EDIT MODAL
// ================================================================

export function openEditModal(day, hour, key) {
  setMDay(day); setMHour(hour); setMKey(key);
  const cols  = flattenColumns(appState.floors);
  const col   = cols.find(c => colKey(c) === key);
  const entry = schedData[appState.yearKey]?.[day]?.[hour]?.[key] || {};
  const defaultCls = (appState.assignments[day] || {})[key] || '';
  const bld = (appState.buildings || [])[col?.floor?.buildingIdx || 0];

  document.getElementById('modalTitle').textContent = `Sala ${col?.room.num || '?'} — Godz. ${hour}`;
  document.getElementById('modalSub').textContent =
    `${bld ? bld.name + ' · ' : ''}${col?.floor.name || ''} › ${col?.seg.name || ''} · ${appState.days[day]}`;

  const selT = document.getElementById('inpTeacher');
  selT.innerHTML = buildTeacherSelectOptions(entry.teacherAbbr || '');

  const _initClasses = entry.classes && entry.classes.length
    ? entry.classes
    : (entry.className || defaultCls) ? [entry.className || defaultCls] : [];
  renderMultiClassList(_initClasses);
  document.getElementById('inpClass').value = '';

  document.getElementById('inpSubject').value = entry.subject || '';
  document.getElementById('inpNote').value    = entry.note    || '';
  renderMcSelect();
  document.getElementById('editModal').classList.add('show');
  initSubjectAutocomplete();
  selT.focus();
}

export function closeEditModal() {
  document.getElementById('editModal').classList.remove('show');
  ['qaPanelTeacher', 'qaPanelClass'].forEach(id => {
    const p = document.getElementById(id);
    if (p) p.classList.remove('open');
  });
  document.getElementById('qaToggleTeacher').querySelector('.qa-icon').textContent = '＋';
  document.getElementById('qaToggleClass').querySelector('.qa-icon').textContent = '＋';
  document.getElementById('qaToggleTeacher').style.color = '';
  document.getElementById('qaToggleClass').style.color   = '';
}

// ================================================================
//  ZAJĘCIA MIĘDZYODDZIAŁOWE
// ================================================================

export function renderMcSelect() {
  const wrap = document.getElementById('mcSelectWrap');
  if (!wrap) return;
  const classes = appState?.classes || [];
  if (!classes.length) { wrap.innerHTML = ''; return; }
  const sortedClasses = classes.slice().sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'pl', {numeric: true, sensitivity: 'base'})
  );
  const opts = sortedClasses.map(cl => {
    const val   = cl.abbr || cl.name;
    const label = (cl.group && cl.group.toLowerCase() !== 'cała klasa')
      ? cl.name + ' — ' + cl.group : cl.name;
    return `<option value="${esc(val)}">${esc(label)}</option>`;
  }).join('');
  wrap.innerHTML =
    `<select id="mcAddSelect" class="teacher-select mc-add-select">${opts}</select>
     <button class="btn btn-green mc-add-btn" onclick="mcAddClass()">＋ Dodaj</button>`;
}

export function renderMultiClassList(selected) {
  setSelectedClasses(Array.isArray(selected) ? selected.slice() : []);
  const container = document.getElementById('multiClassList');
  if (!container) return;
  const classes = appState?.classes || [];
  if (classes.length === 0) {
    container.innerHTML = '<span style="color:orange;font-size:0.8rem">⚠ Brak klas — dodaj w kreatorze (✏️ Edytuj rok)</span>';
    return;
  }
  function labelFor(val) {
    const found = classes.find(cl => (cl.abbr || cl.name) === val);
    if (!found) return val;
    return (found.group && found.group.toLowerCase() !== 'cała klasa')
      ? found.name + ' ' + found.group : found.name;
  }
  const chips = _selectedClasses.map((val, i) =>
    `<span class="mc-chip">
       <span class="mc-chip-val">${esc(labelFor(val))}</span>
       <button class="mc-chip-del" onclick="mcRemoveClass(${i})" title="Usuń">✕</button>
     </span>`
  ).join('');
  container.innerHTML = chips || '<span style="font-size:0.75rem;color:var(--text-dim)">Brak wybranych klas</span>';
}

export function mcAddClass() {
  const sel = document.getElementById('mcAddSelect');
  if (!sel) return;
  const val = sel.value;
  if (!val) return;
  if (_selectedClasses.includes(val)) {
    notify('⚠ Ta klasa jest już na liście', true);
    return;
  }
  setSelectedClasses([..._selectedClasses, val]);
  renderMultiClassList(_selectedClasses);
  renderMcSelect();
}

export function mcRemoveClass(idx) {
  const s = _selectedClasses.slice();
  s.splice(idx, 1);
  setSelectedClasses(s);
  renderMultiClassList(_selectedClasses);
}

// ================================================================
//  ZAPIS / CZYSZCZENIE KOMÓRKI
// ================================================================

export function saveCellData() {
  const yk = appState.yearKey;
  undoPush(`Zapis ${_mKey}, godz. ${_mHour}, ${appState.days[_mDay]}`);
  if (!schedData[yk])           schedData[yk] = {};
  if (!schedData[yk][_mDay])    schedData[yk][_mDay] = {};
  if (!schedData[yk][_mDay][_mHour]) schedData[yk][_mDay][_mHour] = {};
  const _clsList = (_selectedClasses || []).filter(Boolean);
  schedData[yk][_mDay][_mHour][_mKey] = {
    teacherAbbr: document.getElementById('inpTeacher').value,
    classes:     _clsList,
    className:   _clsList[0] || '',
    subject:     document.getElementById('inpSubject').value.trim(),
    note:        document.getElementById('inpNote').value.trim(),
  };
  persistAll();
  closeEditModal();
  renderSchedule();
  sbSet('Wpis zaktualizowany');
}

export function clearCellData() {
  undoPush(`Wyczyszczenie ${_mKey}, godz. ${_mHour}, ${appState.days[_mDay]}`);
  if (schedData[appState.yearKey]?.[_mDay]?.[_mHour]) {
    schedData[appState.yearKey][_mDay][_mHour][_mKey] = {};
  }
  persistAll();
  closeEditModal();
  renderSchedule();
  sbSet('Wpis wyczyszczony');
}

// ================================================================
//  INICJALIZACJA NASŁUCHIWACZY KLAWIATURY I MODALA
// ================================================================

(function () {
  const _em = document.getElementById('editModal');
  if (_em) _em.addEventListener('click', e => { if (e.target === _em) closeEditModal(); });
})();

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeEditModal(); }
  if (e.key === 'Enter' && e.ctrlKey && document.getElementById('editModal').classList.contains('show')) {
    saveCellData();
  }
  const tag    = (e.target.tagName || '').toLowerCase();
  const inInput  = tag === 'input' || tag === 'textarea' || tag === 'select';
  const modalOpen = document.getElementById('editModal')?.classList.contains('show');
  if (!inInput && !modalOpen) {
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); undoAction(); }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redoAction(); }
  }
});
