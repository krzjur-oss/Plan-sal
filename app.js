// ================================================================
//  app.js — Etap 8: cienka warstwa inicjalizacyjna
//  Importuje wszystkie moduły i eksponuje funkcje na window
//  tak, by inline handlery w index.html nadal działały.
// ================================================================

import {
  initCookieBanner, acceptCookies, showCookieDetail, closeCookieDetail,
  toggleAppHelp, closeAppHelp,
  undoAction, redoAction,
} from './utils.js';

import { scrollToFirstCollision } from './collisions.js';

import {
  exportJSON, handleImportFile,
  openImportModal, closeImportModal, confirmImport,
  saveData,
  openCSVModal, closeCSVModal,
  exportCSVDay, exportCSVWeekBySala, exportCSVFlat,
} from './import-export.js';

import {
  loadAll,
  showWelcomeScreen, hideWelcomeScreen,
  welcomeStartNew, welcomeCopyYear, welcomeImportClick,
  welcomeHandleFile, wlImportCancel, wlImportConfirm,
  welcomeDemo, exitDemo,
  openEditWizard,
  draftResume, draftDiscard,
} from './storage.js';

import {
  addBuilding, addClass, addTeacher,
  clearAllClasses, clearAllTeachers,
  handleClassImportDrop, handleClassImportFile,
  handleImportDrop,
  readTxtFile,
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
  touchStart, touchMove, touchEnd,
  setViewMode, onViewFilterChange,
  renderSchedule,
  openEditModal, closeEditModal,
  saveCellData, clearCellData,
  initTimeslotEditor, fillTimeslotsDefault, clearTimeslots,
  addSubject, removeSubject, loadSubjectPreset,
  scheduleSubjectAbbrUpdate,
  pickSubject, initSubjectAutocomplete,
  mcAddClass, mcRemoveClass,
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
  showAboutModal, closeAboutModal,
} from './ui.js';

import {
  openSettingsPanel, closeSettingsPanel, switchSettingsTab,
  spClassAdd, spClassSetName, spClassSetAbbr, spClassSetGroup, spClassSetBase, spClassDelete,
  spTeacherAdd, spTeacherSet, spTeacherSetAbbr, spTeacherDelete,
  spSubjectAdd, spSubjectSet, spSubjectDelete,
  spHourAdd, spHourSetTime, spHourSetLabel, spHourDelete,
} from './settings.js';

// ================================================================
//  EKSPONOWANIE NA window (dla inline onclick= w index.html)
// ================================================================

Object.assign(window, {
  initCookieBanner, acceptCookies, showCookieDetail, closeCookieDetail,
  toggleAppHelp, closeAppHelp,
  undoAction, redoAction,

  scrollToFirstCollision,

  exportJSON, handleImportFile,
  openImportModal, closeImportModal, confirmImport,
  saveData,
  openCSVModal, closeCSVModal,
  exportCSVDay, exportCSVWeekBySala, exportCSVFlat,

  loadAll,
  showWelcomeScreen, hideWelcomeScreen,
  welcomeStartNew, welcomeCopyYear, welcomeImportClick,
  welcomeHandleFile, wlImportCancel, wlImportConfirm,
  welcomeDemo, exitDemo,
  openEditWizard,
  draftResume, draftDiscard,

  addBuilding, addClass, addTeacher,
  clearAllClasses, clearAllTeachers,
  handleClassImportDrop, handleClassImportFile,
  handleImportDrop,
  readTxtFile,

  openWizardNewYear,
  wizardNext, wizardBack,
  finishWizard,
  renderAssignmentsStep, switchAssignDay, renderAssignTable, setAssign,

  mountApp, switchDay,
  dndStart, dndEnd, dndOver, dndLeave, dndDrop,
  touchStart, touchMove, touchEnd,
  setViewMode, onViewFilterChange,
  renderSchedule,
  openEditModal, closeEditModal,
  saveCellData, clearCellData,
  initTimeslotEditor, fillTimeslotsDefault, clearTimeslots,
  addSubject, removeSubject, loadSubjectPreset,
  scheduleSubjectAbbrUpdate,
  pickSubject, initSubjectAutocomplete,
  mcAddClass, mcRemoveClass,

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
  showAboutModal, closeAboutModal,

  openSettingsPanel, closeSettingsPanel, switchSettingsTab,
  spClassAdd, spClassSetName, spClassSetAbbr, spClassSetGroup, spClassSetBase, spClassDelete,
  spTeacherAdd, spTeacherSet, spTeacherSetAbbr, spTeacherDelete,
  spSubjectAdd, spSubjectSet, spSubjectDelete,
  spHourAdd, spHourSetTime, spHourSetLabel, spHourDelete,
});
