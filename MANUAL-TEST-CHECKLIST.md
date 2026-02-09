# Manual Test Checklist - Project Management Features

## Feature 1: Custom Dialogs

### Test 1.1: Project Rename Dialog
- [ ] Open project list (if projects exist)
- [ ] Click rename button on a project
- [ ] Verify custom dialog appears (not browser prompt)
- [ ] Verify current project name is pre-filled
- [ ] Test empty name → confirm button should be disabled
- [ ] Test name with 101+ chars → should be truncated at 100
- [ ] Type new name → confirm button enabled
- [ ] Press Enter → should confirm and update name
- [ ] Rename again, press Escape → should cancel
- [ ] Rename with special chars (Unicode) → should work

### Test 1.2: Project Delete Dialog
- [ ] Click delete button on a project
- [ ] Verify custom confirm dialog with warning icon
- [ ] Verify project name appears in message
- [ ] Click "Abbrechen" → project not deleted
- [ ] Click delete again, click "Löschen" → project deleted
- [ ] Verify card removed from list

### Test 1.3: Settings - Project Delete
- [ ] Open Settings dialog
- [ ] Click "Projekt loeschen" button
- [ ] Verify custom confirm dialog (not browser confirm)
- [ ] Click cancel → nothing happens
- [ ] Click delete → project deleted, page reloads

### Test 1.4: Settings - API Keys Delete
- [ ] Open Settings dialog
- [ ] Click "Gespeicherte API-Keys loeschen"
- [ ] Verify custom confirm dialog
- [ ] Test cancel and confirm behaviors

### Test 1.5: Settings - Reset to Defaults
- [ ] Open Settings dialog
- [ ] Click "Reset to Defaults"
- [ ] Verify custom confirm dialog with question icon
- [ ] Test cancel and confirm behaviors

---

## Feature 2: New Project Button

### Test 2.1: Create New Project from Empty State
- [ ] Clear all projects (browser DevTools → Application → IndexedDB → delete database)
- [ ] Reload page
- [ ] Should not show project list
- [ ] Upload a document
- [ ] Click header project name → should show project list
- [ ] Click "Neues Projekt"
- [ ] Verify prompt dialog appears
- [ ] Default value should be "Neues Projekt"
- [ ] Type project name → "Test Project"
- [ ] Click "Erstellen"
- [ ] Verify toast: "Projekt 'Test Project' erstellt"
- [ ] Verify header shows "Test Project"

### Test 2.2: Create New Project from Existing List
- [ ] Have 2+ projects
- [ ] Open project list
- [ ] Click "Neues Projekt"
- [ ] Enter name "Second Project"
- [ ] Press Enter (keyboard)
- [ ] Verify project created
- [ ] Project list should show new project

### Test 2.3: Cancel New Project
- [ ] Open project list
- [ ] Click "Neues Projekt"
- [ ] Press Escape or click "Abbrechen"
- [ ] Verify no project created
- [ ] Verify no error/toast

### Test 2.4: Validation
- [ ] Click "Neues Projekt"
- [ ] Leave input empty → "Erstellen" button disabled
- [ ] Type 1 char → button enabled
- [ ] Delete all → button disabled again
- [ ] Type 101 chars → only first 100 accepted

---

## Feature 3: Storage Quota Display

### Test 3.1: Initial Display
- [ ] Open Settings dialog
- [ ] Scroll to "Speicherplatz" section
- [ ] Verify quota bar appears
- [ ] Verify text shows: "X.XX MB von Y.YY MB verwendet (Z%)"
- [ ] Verify "Aktualisieren" button present
- [ ] Verify hint text: "Bilder und Transkriptionen..."

### Test 3.2: Quota Bar Colors
- [ ] With <70% usage → bar should be blue (accent-primary)
- [ ] Add large images to reach 70-90% → bar should be yellow
- [ ] Add more to reach >90% → bar should be red
- [ ] Delete projects to reduce → bar should return to blue

### Test 3.3: Refresh Button
- [ ] Note current quota percentage
- [ ] Add/delete a project (with images)
- [ ] Click "Aktualisieren" button
- [ ] Verify quota updates immediately
- [ ] Verify bar width changes

### Test 3.4: Auto-Update on Open
- [ ] Close settings
- [ ] Add a large image document
- [ ] Re-open settings
- [ ] Verify quota shows updated value (auto-loaded)

### Test 3.5: Browser Compatibility
**Chrome/Edge:**
- [ ] Quota display works
- [ ] Values are accurate

**Firefox:**
- [ ] Quota display works
- [ ] Values are accurate

**Safari (if available):**
- [ ] Quota display works or shows "Nicht verfügbar"

---

## Integration Tests

### Test 4.1: Full Workflow
- [ ] Create new project via button
- [ ] Upload multi-page document (10+ pages)
- [ ] Transcribe all pages
- [ ] Check quota → should show significant usage
- [ ] Rename project via custom dialog
- [ ] Delete project via custom dialog
- [ ] Check quota → should decrease

### Test 4.2: Keyboard Navigation
- [ ] Create project → use Tab to navigate, Enter to confirm
- [ ] Rename project → use Escape to cancel
- [ ] Delete project → use Tab + Enter to confirm

### Test 4.3: Long Project Names
- [ ] Create project with 100-char name
- [ ] Verify it displays correctly in:
  - [ ] Project list cards
  - [ ] Header
  - [ ] Delete confirmation dialog
  - [ ] Rename dialog

### Test 4.4: Special Characters
- [ ] Create project with name: "Test öäü 中文 🚀"
- [ ] Verify no encoding errors
- [ ] Rename to: "Neues Projekt «»"
- [ ] Verify escaping works (no XSS)

---

## Error Cases

### Test 5.1: Storage Full
- [ ] Fill quota to >95%
- [ ] Try to create new project
- [ ] Verify quota bar shows critical (red)
- [ ] Try to upload large document
- [ ] Should still work (10MB safety margin)

### Test 5.2: Concurrent Modifications
- [ ] Open app in two tabs
- [ ] Delete project in Tab 1
- [ ] Try to rename same project in Tab 2
- [ ] Verify graceful error handling

---

## Regression Tests

### Test 6.1: Existing Features Still Work
- [ ] Upload image → works
- [ ] Transcribe → works
- [ ] Validate → works
- [ ] Export → works
- [ ] Multi-page navigation → works
- [ ] Undo/Redo → works
- [ ] Settings save → works
- [ ] API key persistence → works

### Test 6.2: All Tests Pass
```bash
cd docs && npm run lint
# Should show: 0 errors, 0 warnings

cd docs && npx vitest run
# Should show: 302 tests passing
```

---

## Sign-Off

**Tester:** ___________________
**Date:** ___________________
**Browser:** ___________________
**OS:** ___________________

**Overall Status:** [ ] PASS [ ] FAIL

**Notes:**
