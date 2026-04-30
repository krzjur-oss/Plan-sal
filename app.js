// ================================================================
//  app.js — Etap 8: cienka warstwa inicjalizacyjna
//  Importuje wszystkie moduły i eksponuje funkcje na window
//  tak, by inline handlery w index.html nadal działały.
// ================================================================

import {
  initCookieBanner, acceptCookies, showCookieDetail, closeCookieDetail,
  toggleAppHelp, closeAppHelp,
  wpUpdate,
  undoAction, redoAction,
} from './utils.js';

import { scrollToFirstCollision } from './collisions.js';

import { setAppState } from './state.js';

import {
  exportJSON, handleImportFile,
  openImportModal, closeImportModal, confirmImport,
  saveData,
  openCSVModal, closeCSVModal,
  exportCSVDay, exportCSVWeekBySala, exportCSVFlat,
  persistAll,
} from './import-export.js';

import {
  loadAll,
  showWelcomeScreen, hideWelcomeScreen,
  welcomeStartNew, welcomeCopyYear, welcomeImportClick,
  welcomeHandleFile, wlImportCancel, wlImportConfirm,
  welcomeDemo, exitDemo,
  openEditWizard,
  draftResume, draftDiscard,
  wizardSaveDraft, wizardClearDraft, wizardCheckDraft,
  startWizardAutosave, stopWizardAutosave,
  isWizardEditMode, setWizardEditMode,
} from './storage.js';

import {
  addBuilding, addClass, addTeacher,
  clearAllClasses, clearAllTeachers,
  handleClassImportDrop, handleClassImportFile,
  handleImportDrop,
  readTxtFile,
  renderBuildingList, removeBuilding,
  addFloor, addFloorForBuilding, removeFloor,
  addSegment, removeSeg, addRoom, removeRoom,
  renderClassGrid, wClassAutoAbbr, removeClassAt,
  renderTeacherList, removeTeacher, autoAbbr,
  syncBuildingsFromDOM, syncTeachersFromDOM,
  getClassesFromDOM, migrateScheduleKeys, renderFloorList,
} from './wizard-data.js';

import {
  openWizardNewYear,
  wizardNext, wizardBack,
  finishWizard,
  renderAssignmentsStep, switchAssignDay, renderAssignTable, setAssign,
} from './wizard.js';

import {
  mountApp, switchDay,
  dndStart, dndEnd, dndOver, dndLeave, dndDrop,
  setViewMode, onViewFilterChange,
  renderSchedule,
  openEditModal, closeEditModal,
  saveCellData, clearCellData,
  initTimeslotEditor, fillTimeslotsDefault, clearTimeslots,
  addSubject, removeSubject, loadSubjectPreset,
  scheduleSubjectAbbrUpdate,
  pickSubject, initSubjectAutocomplete,
  mcAddClass, mcRemoveClass,
  renderSubjectList, buildTimeslotsFromHours,
} from './schedule.js';

import {
  showArchive, hideArchive, closeArchive,
  restoreYear, deleteArchive,
  clearDay, exportPDF,
  toggleMobileMenu,
  applyTheme, toggleTheme,
  openHomeroomModal, closeHomeroomModal, saveHomeroom,
  hrToggleSecond, clearHomeroom,
  handleFloorImportDrop, handleFloorImportFile,
  toggleQuickAdd, qaAutoAbbr, qaAutoClassAbbr, qaAddTeacher, qaAddClass,
  swUpdateReload, swUpdateDismiss,
  pwaInstall, pwaDismiss,
  initTermsBanner, acceptTerms,
  showTermsModal, closeTermsModal, showTermsModalFromBanner,
  showAboutModal, closeAboutModal, aboutSwitchTab, aboutToggleOlderChangelog,
  focusFirstIn,
} from './ui.js';

import {
  openSettingsPanel, closeSettingsPanel, switchSettingsTab,
  spClassAdd, spClassSetName, spClassSetAbbr, spClassSetGroup, spClassSetBase, spClassDelete,
  spTeacherAdd, spTeacherSet, spTeacherSetAbbr, spTeacherDelete,
  spSubjectAdd, spSubjectSet, spSubjectDelete,
  spHourAdd, spHourSetTime, spHourSetLabel, spHourDelete, spHoursSave,
  spSetBuildingMulti,
} from './settings.js';

// ================================================================
//  EKSPONOWANIE NA window (dla inline onclick= w index.html)
// ================================================================

Object.assign(window, {
  initCookieBanner, acceptCookies, showCookieDetail, closeCookieDetail,
  toggleAppHelp, closeAppHelp,
  wpUpdate,
  undoAction, redoAction,

  scrollToFirstCollision,
  setAppState,

  exportJSON, handleImportFile,
  openImportModal, closeImportModal, confirmImport,
  saveData,
  openCSVModal, closeCSVModal,
  exportCSVDay, exportCSVWeekBySala, exportCSVFlat,
  persistAll,

  loadAll,
  showWelcomeScreen, hideWelcomeScreen,
  welcomeStartNew, welcomeCopyYear, welcomeImportClick,
  welcomeHandleFile, wlImportCancel, wlImportConfirm,
  welcomeDemo, exitDemo,
  openEditWizard,
  draftResume, draftDiscard,
  wizardSaveDraft, wizardClearDraft, wizardCheckDraft,
  startWizardAutosave, stopWizardAutosave,
  isWizardEditMode, setWizardEditMode,

  addBuilding, addClass, addTeacher,
  clearAllClasses, clearAllTeachers,
  handleClassImportDrop, handleClassImportFile,
  handleImportDrop,
  readTxtFile,
  renderBuildingList, removeBuilding,
  addFloor, addFloorForBuilding, removeFloor,
  addSegment, removeSeg, addRoom, removeRoom,
  renderClassGrid, wClassAutoAbbr, removeClassAt,
  renderTeacherList, removeTeacher, autoAbbr,
  syncBuildingsFromDOM, syncTeachersFromDOM,
  getClassesFromDOM, migrateScheduleKeys, renderFloorList,

  openWizardNewYear,
  wizardNext, wizardBack,
  finishWizard,
  renderAssignmentsStep, switchAssignDay, renderAssignTable, setAssign,

  mountApp, switchDay,
  dndStart, dndEnd, dndOver, dndLeave, dndDrop,
  setViewMode, onViewFilterChange,
  renderSchedule,
  openEditModal, closeEditModal,
  saveCellData, clearCellData,
  initTimeslotEditor, fillTimeslotsDefault, clearTimeslots,
  addSubject, removeSubject, loadSubjectPreset,
  scheduleSubjectAbbrUpdate,
  pickSubject, initSubjectAutocomplete,
  mcAddClass, mcRemoveClass,
  renderSubjectList, buildTimeslotsFromHours,

  showArchive, hideArchive, closeArchive,
  restoreYear, deleteArchive,
  clearDay, exportPDF,
  toggleMobileMenu,
  applyTheme, toggleTheme,
  openHomeroomModal, closeHomeroomModal, saveHomeroom,
  hrToggleSecond, clearHomeroom,
  handleFloorImportDrop, handleFloorImportFile,
  toggleQuickAdd, qaAutoAbbr, qaAutoClassAbbr, qaAddTeacher, qaAddClass,
  swUpdateReload, swUpdateDismiss,
  pwaInstall, pwaDismiss,
  initTermsBanner, acceptTerms,
  showTermsModal, closeTermsModal, showTermsModalFromBanner,
  showAboutModal, closeAboutModal, aboutSwitchTab, aboutToggleOlderChangelog,
  focusFirstIn,

  openSettingsPanel, closeSettingsPanel, switchSettingsTab,
  spClassAdd, spClassSetName, spClassSetAbbr, spClassSetGroup, spClassSetBase, spClassDelete,
  spTeacherAdd, spTeacherSet, spTeacherSetAbbr, spTeacherDelete,
  spSubjectAdd, spSubjectSet, spSubjectDelete,
  spHourAdd, spHourSetTime, spHourSetLabel, spHourDelete, spHoursSave,
  spSetBuildingMulti,
});
