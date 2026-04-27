// ================================================================
//  WIZARD-DATA.JS — renderowanie i edycja danych kreatora
//  (budynki, piętra, sale, klasy, nauczyciele)
//
//  Zależy od: state.js, utils.js
//  NIE duplikuje: autoClassAbbr, DRAFT_KEY, normalizeClassName,
//                 migrateClassNames (są w storage.js / import-export.js)
// ================================================================

import {
  FLOOR_COLORS, BUILDING_COLORS, BUILDING_LETTERS,
  wBuildings, setWBuildings,
  wFloors,    setWFloors,
  wClasses,   setWClasses,
  wTeachers,  setWTeachers,
} from './state.js';

import { esc, notify, showConfirm }  from './helpers.js';
import { genAbbr, ensureUniqueAbbr } from './utils.js';

// normalizeClassName globalnie dostępna z import-export.js / app.js;
// lokalna kopia na potrzeby getClassesFromDOM bez tworzenia cyklu importów
function _normalizeCls(name) {
  name = (name || '').trim();
  const m = name.match(/^(\d+)([a-zA-Z\u00C0-\u017E]*)(.*)$/);
  if (m) return m[1] + m[2].toUpperCase() + m[3];
  return name ? name[0].toUpperCase() + name.slice(1) : name;
}

// ================================================================
//  MIGRACJA KLUCZY schedData po zmianie struktury pięter
// ================================================================
export function migrateScheduleKeys(oldFloors, newFloors, yearKey, schedData) {
  const newKeyByRoomNum = {};
  newFloors.forEach((floor, fi) =>
    floor.segments.forEach((seg, si) =>
      seg.rooms.forEach((room, ri) => {
        const n = (room.num || '').trim();
        if (n) newKeyByRoomNum[n] = `f${fi}_s${si}_${n}`;
      })
    )
  );

  const keyMap = {};
  let remapped = 0;
  oldFloors.forEach((floor, fi) =>
    floor.segments.forEach((seg, si) =>
      seg.rooms.forEach((room, ri) => {
        const n      = (room.num || '').trim();
        const oldKey = n ? `f${fi}_s${si}_${n}` : `f${fi}_s${si}_r${ri}`;
        const newKey = newKeyByRoomNum[n] || oldKey;
        if (oldKey !== newKey) { keyMap[oldKey] = newKey; remapped++; }
      })
    )
  );

  if (!remapped || !schedData[yearKey]) return 0;

  let updated = 0;
  Object.keys(schedData[yearKey]).forEach(di => {
    Object.keys(schedData[yearKey][di] || {}).forEach(h => {
      const hour = schedData[yearKey][di][h];
      Object.keys(hour).filter(k => keyMap[k]).forEach(oldK => {
        const newK = keyMap[oldK];
        if (!hour[newK]) { hour[newK] = hour[oldK]; updated++; }
        delete hour[oldK];
      });
    });
  });

  console.log(`[migrateScheduleKeys] ${remapped} kluczy → ${updated} wpisów zaktualizowanych`);
  return updated;
}

// ================================================================
//  ETYKIETA SALI
// ================================================================
export function _roomLabel(fi, si, num) {
  return `${fi}${String.fromCharCode(65 + si)}${num}`;
}

// ================================================================
//  BUDYNKI
// ================================================================
export function renderBuildingList() {
  const container = document.getElementById('buildingList');
  container.innerHTML = '';
  wBuildings.forEach((b, bi) => container.appendChild(_buildBuildingEl(b, bi)));
}

function _buildBuildingEl(b, bi) {
  const div    = document.createElement('div');
  div.className = 'building-card';
  const color  = BUILDING_COLORS[bi % BUILDING_COLORS.length];
  const letter = BUILDING_LETTERS[bi] || String(bi + 1);
  const floorsInBuilding = wFloors.filter(f => f.buildingIdx === bi).length;
  div.innerHTML = `
    <div class="building-card-header">
      <div class="building-letter" style="background:${color}22;color:${color};border:1px solid ${color}55">${letter}</div>
      <div style="display:flex;flex:1;gap:8px;flex-wrap:wrap">
        <input class="building-name-inp" data-bi="${bi}" value="${esc(b.name)}" placeholder="Nazwa budynku"
          oninput="wBuildings[${bi}].name=this.value; updateFloorBuildingSelects()">
        <input class="building-addr-inp" data-bi="${bi}" value="${esc(b.address||'')}" placeholder="Adres budynku"
          oninput="wBuildings[${bi}].address=this.value">
      </div>
      ${wBuildings.length > 1 ? `<button class="icon-btn danger" onclick="removeBuilding(${bi})">🗑</button>` : ''}
    </div>
    <div class="building-floor-count">Przypisane piętra/strefy: <strong style="color:${color}">${floorsInBuilding}</strong></div>`;
  return div;
}

export function addBuilding() {
  wBuildings.push({ name: '', address: '' });
  renderBuildingList();
  updateFloorBuildingSelects();
}

export function removeBuilding(bi) {
  if (wBuildings.length <= 1) { notify('⚠ Musi pozostać przynajmniej jeden budynek', true); return; }
  wFloors.forEach(f => {
    if (f.buildingIdx === bi) f.buildingIdx = 0;
    else if (f.buildingIdx > bi) f.buildingIdx--;
  });
  wBuildings.splice(bi, 1);
  renderBuildingList();
  renderFloorList();
}

export function syncBuildingsFromDOM() {
  document.querySelectorAll('.building-name-inp').forEach(el => {
    const bi = +el.dataset.bi; if (wBuildings[bi]) wBuildings[bi].name = el.value;
  });
  document.querySelectorAll('.building-addr-inp').forEach(el => {
    const bi = +el.dataset.bi; if (wBuildings[bi]) wBuildings[bi].address = el.value;
  });
}

export function updateFloorBuildingSelects() {
  // Dropdown budynku usunięty — funkcja zachowana dla kompatybilności
  renderFloorList();
}

// ================================================================
//  PIĘTRA (pogrupowane pod budynkami)
// ================================================================
export function renderFloorList() {
  const container = document.getElementById('floorList');
  container.innerHTML = '';
  if (wBuildings.length === 0) return;

  wBuildings.forEach((bld, bi) => {
    const bldFloors = wFloors.map((f, fi) => ({ f, fi })).filter(({ f }) => (f.buildingIdx || 0) === bi);
    const bldSection = document.createElement('div');
    bldSection.className = 'floor-building-section';
    const bldColor  = BUILDING_COLORS[bi % BUILDING_COLORS.length];
    const bldLetter = BUILDING_LETTERS[bi] || String(bi + 1);
    bldSection.innerHTML = `<div class="floor-bld-header">
      <span class="floor-bld-badge" style="background:${bldColor}">${bldLetter}</span>
      <span class="floor-bld-name">${esc(bld.name || 'Budynek ' + (bi + 1))}</span>
      <button class="add-floor-btn" onclick="addFloorForBuilding(${bi})" style="margin-left:auto">＋ Dodaj piętro</button>
    </div>`;
    if (bldFloors.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'floor-bld-empty';
      empty.innerHTML = `<span>Brak pięter / stref — kliknij „＋ Dodaj piętro" aby zacząć</span>`;
      bldSection.appendChild(empty);
    } else {
      bldFloors.forEach(({ f, fi }) => bldSection.appendChild(_buildFloorEl(f, fi)));
    }
    container.appendChild(bldSection);
  });
}

function _buildFloorEl(floor, fi) {
  const div = document.createElement('div');
  div.className = 'floor-item';
  const segsHtml = floor.segments.map((seg, si) => `
    <div class="segment-item">
      <div class="segment-header">
        <span style="font-size:0.65rem;color:var(--text-dim);font-family:var(--mono);flex-shrink:0">SEG</span>
        <input class="seg-name-input" value="${esc(seg.name)}" placeholder="Nazwa segmentu (opcjonalnie)"
          onchange="wFloors[${fi}].segments[${si}].name=this.value">
        <button class="icon-btn danger" onclick="removeSeg(${fi},${si})">✕</button>
      </div>
      <div class="rooms-row">
        ${seg.rooms.map((r, ri) => _buildRoomChip(fi, si, ri, r)).join('')}
        <button class="add-room-btn" onclick="addRoom(${fi},${si})">＋ sala</button>
      </div>
    </div>`).join('');
  div.innerHTML = `
    <div class="floor-item-header">
      <div class="floor-color-dot" style="background:${floor.color}"></div>
      <input class="floor-name-input" value="${esc(floor.name)}" placeholder="Nazwa piętra / strefy"
        onchange="wFloors[${fi}].name=this.value">
      <div class="floor-actions"><button class="icon-btn danger" onclick="removeFloor(${fi})" title="Usuń piętro">🗑</button></div>
    </div>
    <div class="segments-area">
      <div class="segments-label">Segmenty</div>
      <div class="segment-list">${segsHtml}</div>
      <button class="add-segment-btn" onclick="addSegment(${fi})">＋ Dodaj segment</button>
    </div>`;
  return div;
}

function _buildRoomChip(fi, si, ri, r) {
  const label = _roomLabel(fi, si, r.num || '');
  return `<div class="room-chip" data-room-num="${esc(r.num)}">Sala <input class="room-chip-name"
    value="${esc(r.num)}" placeholder="nr"
    data-fi="${fi}" data-si="${si}" data-ri="${ri}"
    onchange="wFloors[${fi}].segments[${si}].rooms[${ri}].num=this.value.trim(); _validateRoomNums()"
    oninput="wFloors[${fi}].segments[${si}].rooms[${ri}].num=this.value; _validateRoomNums()"
    title="Skrót: ${label} — numer musi być unikalny w obrębie piętro+segment"
  ><input class="room-chip-sub" value="${esc(r.sub||'')}" placeholder="opis…"
    onchange="wFloors[${fi}].segments[${si}].rooms[${ri}].sub=this.value"
  ><button class="chip-del" onclick="removeRoom(${fi},${si},${ri})">✕</button></div>`;
}

export function _validateRoomNums() {
  const seenKeys = new Map();
  const dupKeys  = new Set();
  wFloors.forEach((floor, fi) => {
    floor.segments.forEach((seg, si) => {
      seg.rooms.forEach((room, ri) => {
        const n = (room.num || '').trim();
        if (!n) return;
        const key = `f${fi}_s${si}_${n}`;
        if (seenKeys.has(key)) {
          dupKeys.add(key);
          seenKeys.get(key).classList.add('room-dup');
        } else {
          const inp = document.querySelector(`.room-chip-name[data-fi="${fi}"][data-si="${si}"][data-ri="${ri}"]`);
          if (inp) seenKeys.set(key, inp);
        }
      });
    });
  });
  document.querySelectorAll('.room-chip-name').forEach(inp => {
    const fi = +inp.dataset.fi, si = +inp.dataset.si, ri = +inp.dataset.ri;
    const n  = (inp.value || '').trim();
    const key = `f${fi}_s${si}_${n}`;
    if (dupKeys.has(key)) {
      inp.classList.add('room-dup');
      inp.title = `Skrót sali „${_roomLabel(fi, si, n)}" już istnieje w tym samym segmencie!`;
    } else {
      inp.classList.remove('room-dup');
      inp.title = `Skrót: ${_roomLabel(fi, si, n)} — unikalny w obrębie piętro+segment`;
    }
  });
  return dupKeys.size === 0;
}

export function _highlightDuplicateRooms(dupKeys) {
  const dupSet = new Set(dupKeys);
  wFloors.forEach((floor, fi) => {
    floor.segments.forEach((seg, si) => {
      seg.rooms.forEach((room, ri) => {
        const n = (room.num || '').trim();
        if (dupSet.has(`f${fi}_s${si}_${n}`)) {
          const inp = document.querySelector(`.room-chip-name[data-fi="${fi}"][data-si="${si}"][data-ri="${ri}"]`);
          if (inp) { inp.classList.add('room-dup'); inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
      });
    });
  });
}

export function addFloor() { addFloorForBuilding(0); }
export function addFloorForBuilding(bi) {
  const ci = wFloors.length % FLOOR_COLORS.length;
  const floorsInBld = wFloors.filter(f => (f.buildingIdx || 0) === bi).length;
  const bldName = wBuildings[bi]?.name || ('Budynek ' + (bi + 1));
  wFloors.push({ name: `${bldName} — piętro ${floorsInBld}`, color: FLOOR_COLORS[ci], buildingIdx: bi, segments: [{ name: 'Segment A', rooms: [{ num: '1', sub: '' }] }] });
  renderFloorList();
  setTimeout(() => {
    const sections = document.querySelectorAll('.floor-building-section');
    if (sections[bi]) {
      const items = sections[bi].querySelectorAll('.floor-item');
      const last = items[items.length - 1];
      if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 80);
}

export function removeFloor(fi)   { wFloors.splice(fi, 1); renderFloorList(); renderBuildingList(); }
export function addSegment(fi)    { wFloors[fi].segments.push({ name: '', rooms: [{ num: '1', sub: '' }] }); renderFloorList(); }
export function removeSeg(fi, si) { wFloors[fi].segments.splice(si, 1); renderFloorList(); }
export function addRoom(fi, si) {
  const existing = wFloors[fi].segments[si].rooms;
  const nums = existing.map(r => parseInt(r.num)).filter(n => n > 0);
  const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
  wFloors[fi].segments[si].rooms.push({ num: String(nextNum), sub: '' });
  renderFloorList();
}
export function removeRoom(fi, si, ri) { wFloors[fi].segments[si].rooms.splice(ri, 1); renderFloorList(); }

// ================================================================
//  KLASY — renderowanie i edycja
// ================================================================
function _baseClassOptions(currentBaseClass, selfName) {
  const names = [...new Set(wClasses.map(c => c.name).filter(n => n && n !== selfName))];
  names.sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
  const opts = names.map(n =>
    `<option value="${esc(n)}"${n === currentBaseClass ? ' selected' : ''}>${esc(n)}</option>`
  ).join('');
  return `<option value=""${!currentBaseClass ? ' selected' : ''}>— (samodzielna)</option>${opts}`;
}

export function renderClassGrid() {
  document.getElementById('classGrid').innerHTML = wClasses.map((c, i) => {
    const isSubgroup = c.group && c.group.trim().toLowerCase() !== 'cała klasa' && c.group.trim() !== '';
    return `
    <div class="class-item${isSubgroup ? ' class-item-subgroup' : ''}">
      <input class="class-input" value="${esc(c.name)}" placeholder="np. 1A"
        oninput="wClasses[${i}].name=normalizeClassName(this.value);this.value=wClasses[${i}].name;this.setSelectionRange(this.value.length,this.value.length); wClassAutoAbbr(${i});renderClassGrid()">
      <input class="class-abbr-inp" id="wca${i}" value="${esc(c.abbr)}" placeholder="skrót (auto)" maxlength="12"
        oninput="wClasses[${i}].abbr=this.value.toUpperCase();this.value=this.value.toUpperCase()"
        title="Edytuj ręcznie aby nadpisać auto-skrót">
      <input class="class-group-inp" value="${esc(c.group)}" placeholder="np. gr1 lub cała klasa"
        oninput="wClasses[${i}].group=this.value; wClassAutoAbbr(${i}); renderClassGrid()">
      ${isSubgroup
        ? `<select class="class-base-sel" title="Klasa bazowa — plan widoku Klasa agreguje po tym polu"
              onchange="wClasses[${i}].baseClass=this.value">
            ${_baseClassOptions(c.baseClass || '', c.name)}
          </select>`
        : `<div class="class-base-placeholder" title="Klasa samodzielna — nie należy do żadnej grupy nadrzędnej"></div>`
      }
      <button class="icon-btn danger" onclick="removeClassAt(${i})">✕</button>
    </div>`;
  }).join('');
  updateClassCountBadge();
}

export function wClassAutoAbbr(i) {
  const cls = wClasses[i];
  if (!cls) return;
  // autoClassAbbr dostępna globalnie z storage.js / app.js
  const generated = typeof autoClassAbbr === 'function' ? autoClassAbbr(cls.name, cls.group) : cls.name.toUpperCase();
  cls.abbr = generated;
  const inp = document.getElementById('wca' + i);
  if (inp) inp.value = generated;
}

export function addClass() {
  wClasses.push({ name: '', abbr: '', group: 'cała klasa', baseClass: '' });
  renderClassGrid();
  document.querySelectorAll('.class-input')[wClasses.length - 1]?.focus();
}

export function removeClassAt(i) { wClasses.splice(i, 1); renderClassGrid(); }

export function getClassesFromDOM() {
  document.querySelectorAll('.class-item').forEach((row, i) => {
    if (!wClasses[i]) return;
    const inps = row.querySelectorAll('input');
    wClasses[i].name      = _normalizeCls(inps[0].value);
    wClasses[i].abbr      = inps[1].value.trim().toUpperCase();
    wClasses[i].group     = inps[2].value.trim();
    const bcSel = row.querySelector('.class-base-sel');
    wClasses[i].baseClass = bcSel ? bcSel.value : '';
  });
  return wClasses.filter(c => c.name);
}

export function clearAllClasses() {
  if (wClasses.length === 0) return;
  showConfirm({
    message: 'Usunąć wszystkie klasy z listy?', confirmLabel: '🗑 Usuń wszystkie', danger: true,
    onConfirm: () => { setWClasses([]); renderClassGrid(); notify('🗑 Lista klas wyczyszczona'); },
  });
}

export function updateClassCountBadge() {
  const b = document.getElementById('classCountBadge');
  if (b) b.textContent = wClasses.filter(c => c.name).length + ' wpisów';
}

export function handleClassImportFile(input) {
  const file = input.files[0]; if (!file) return;
  _readClassTxtFile(file); input.value = '';
}

export function handleClassImportDrop(e) {
  e.preventDefault();
  document.getElementById('classImportDropZone').classList.remove('drag-over');
  const file = [...e.dataTransfer.files].find(f => f.name.endsWith('.txt') || f.type === 'text/plain');
  if (!file) { notify('⚠ Wybierz plik .txt', true); return; }
  _readClassTxtFile(file);
}

function _readClassTxtFile(file) {
  const reader = new FileReader();
  reader.onload = e => _importClassesFromText(e.target.result);
  reader.onerror = () => notify('⚠ Błąd odczytu pliku', true);
  reader.readAsText(file, 'UTF-8');
}

function _importClassesFromText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let added = 0, skipped = 0, errors = [];
  lines.forEach((line, idx) => {
    if (/^[-=_#*]+$/.test(line)) { skipped++; return; }
    const sep = line.includes(';') ? ';' : ',';
    const parts = line.split(sep).map(p => p.trim());
    if (parts.length < 2) { errors.push(`Linia ${idx + 1}: "${line}" — za mało pól`); skipped++; return; }
    const name = parts[0] || '', abbr = (parts[1] || name).toUpperCase(), group = parts[2] || 'cała klasa';
    if (!name) { skipped++; return; }
    if (wClasses.some(c => c.name.toLowerCase() === name.toLowerCase() && c.group.toLowerCase() === group.toLowerCase())) { skipped++; return; }
    wClasses.push({ name, abbr, group }); added++;
  });
  renderClassGrid(); updateClassCountBadge();
  const preview = document.getElementById('classImportPreview');
  let html = `<strong>+${added}</strong> wpisów zaimportowano`;
  if (skipped) html += ` · ${skipped} pominięto`;
  if (errors.length) html += `<div class="import-err" style="margin-top:6px">${errors.slice(0,3).map(e=>'⚠ '+esc(e)).join('<br>')}</div>`;
  preview.innerHTML = html; preview.classList.add('show');
  setTimeout(() => preview.classList.remove('show'), 6000);
  if (added > 0) notify('✓ Zaimportowano ' + added + ' wpisów klas');
  else notify('⚠ Brak nowych wpisów do dodania', true);
}

// ================================================================
//  NAUCZYCIELE — renderowanie i edycja
// ================================================================
export function renderTeacherList() {
  const container = document.getElementById('teacherList');
  container.innerHTML = wTeachers.map((t, i) => `
    <div class="teacher-row" id="trow_${i}">
      <input class="teacher-inp" placeholder="Imię" value="${esc(t.first)}"
        oninput="wTeachers[${i}].first=this.value; autoAbbr(${i})">
      <input class="teacher-inp" placeholder="Nazwisko (lub Nazwisko-Człon2)" value="${esc(t.last)}"
        oninput="wTeachers[${i}].last=this.value; autoAbbr(${i})">
      <input class="teacher-abbr-inp" placeholder="Skrót" value="${esc(t.abbr)}" maxlength="6"
        oninput="wTeachers[${i}].abbr=this.value.toUpperCase(); this.value=this.value.toUpperCase()"
        title="Generowany automatycznie, możesz edytować ręcznie">
      <button class="icon-btn danger" onclick="removeTeacher(${i})">🗑</button>
    </div>`).join('');
  updateTeacherCountBadge();
}

export function addTeacher() {
  wTeachers.push({ first: '', last: '', abbr: '' });
  renderTeacherList();
  document.querySelectorAll('.teacher-row')[wTeachers.length - 1]?.querySelector('.teacher-inp')?.focus();
  updateTeacherCountBadge();
}

export function removeTeacher(i) { wTeachers.splice(i, 1); renderTeacherList(); }

export function autoAbbr(i) {
  const t = wTeachers[i];
  const otherAbbrs = wTeachers.filter((_, j) => j !== i).map(x => x.abbr).filter(Boolean);
  const unique = ensureUniqueAbbr(genAbbr(t.first, t.last), otherAbbrs);
  wTeachers[i].abbr = unique;
  const row = document.getElementById(`trow_${i}`);
  if (row) row.querySelectorAll('.teacher-abbr-inp')[0].value = unique;
}

export function syncTeachersFromDOM() {
  document.querySelectorAll('.teacher-row').forEach((row, i) => {
    const inputs = row.querySelectorAll('input');
    if (wTeachers[i]) {
      wTeachers[i].first = inputs[0].value.trim();
      wTeachers[i].last  = inputs[1].value.trim();
      wTeachers[i].abbr  = inputs[2].value.trim().toUpperCase();
    }
  });
  setWTeachers(wTeachers.filter(t => t.first || t.last));
}

export function clearAllTeachers() {
  if (wTeachers.length === 0) return;
  showConfirm({
    message: `Usunąć wszystkich <strong>${wTeachers.length}</strong> nauczycieli z listy?`,
    confirmLabel: '🗑 Usuń wszystkich', danger: true,
    onConfirm: () => { setWTeachers([]); renderTeacherList(); updateTeacherCountBadge(); notify('🗑 Lista nauczycieli wyczyszczona'); },
  });
}

export function updateTeacherCountBadge() {
  const badge = document.getElementById('teacherCountBadge');
  if (badge) badge.textContent = `${wTeachers.length} nauczyciel${wTeachers.length === 1 ? '' : wTeachers.length < 5 ? 'i' : 'i'}`;
}

export function handleImportDrop(e) {
  e.preventDefault();
  document.getElementById('importDropZone').classList.remove('drag-over');
  const file = [...e.dataTransfer.files].find(f => f.name.endsWith('.txt') || f.type === 'text/plain');
  if (!file) { notify('⚠ Wybierz plik .txt', true); return; }
  _readTxtFile(file);
}

function _readTxtFile(file) {
  const reader = new FileReader();
  reader.onload = e => _importTeachersFromText(e.target.result);
  reader.onerror = () => notify('⚠ Błąd odczytu pliku', true);
  reader.readAsText(file, 'UTF-8');
}

function _importTeachersFromText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let added = 0, skipped = 0, errors = [];
  lines.forEach((line, idx) => {
    if (/^[-=_#*]+$/.test(line)) { skipped++; return; }
    const parts = line.split(/\s+/);
    if (parts.length < 2) { errors.push(`Linia ${idx + 1}: "${line}" — brak imienia lub nazwiska`); skipped++; return; }
    const first = parts[0], last = parts.slice(1).join(' ');
    if (wTeachers.some(t => t.first.toLowerCase() === first.toLowerCase() && t.last.toLowerCase() === last.toLowerCase())) { skipped++; return; }
    const abbr = ensureUniqueAbbr(genAbbr(first, last), wTeachers.map(t => t.abbr).filter(Boolean));
    wTeachers.push({ first, last, abbr }); added++;
  });
  renderTeacherList(); updateTeacherCountBadge();
  const preview = document.getElementById('importPreview');
  let html = `<strong>+${added}</strong> nauczycieli zaimportowano`;
  if (skipped) html += ` · ${skipped} pominięto (duplikaty/błędy)`;
  if (errors.length) {
    html += `<div class="import-err" style="margin-top:6px">${errors.slice(0,3).map(e=>'⚠ '+esc(e)).join('<br>')}</div>`;
    if (errors.length > 3) html += `<div class="import-err">…i ${errors.length - 3} więcej błędów</div>`;
  }
  preview.innerHTML = html; preview.classList.add('show');
  setTimeout(() => preview.classList.remove('show'), 6000);
  if (added > 0) notify(`✓ Zaimportowano ${added} nauczycieli`);
  else notify('⚠ Brak nowych nauczycieli do dodania', true);
}

// Alias publiczny dla handlera pliku TXT nauczycieli (wywoływany z index.html)
export function readTxtFile(file) { _readTxtFile(file); }
