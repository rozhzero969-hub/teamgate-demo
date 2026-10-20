'use strict';

/* ---------------------------------------------------------------
   Browser-storage persistence.
   mode: 'local'      saved in localStorage
         'memory'     storage unavailable; changes vanish on close
         'unreadable' saved data couldn't be read; offer a reset
   --------------------------------------------------------------- */
const store = { state: null, mode: 'local' };

function storageWorks() {
  try {
    const key = '__teamgate_probe__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function isQuotaError(err) {
  return !!err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014);
}

function loadState() {
  if (!storageWorks()) {
    store.mode = 'memory';
    store.state = createSeedState();
    return;
  }
  let saved = null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    store.mode = 'memory';
    store.state = createSeedState();
    return;
  }
  if (saved === null) {
    store.mode = 'local';
    store.state = createSeedState();
    writeState(store.state);
    return;
  }
  let parsed = null;
  try {
    parsed = validateState(JSON.parse(saved));
  } catch {
    parsed = null;
  }
  if (parsed) {
    store.mode = 'local';
    store.state = parsed;
  } else {
    // Don't overwrite the unreadable data until the person chooses to reset.
    store.mode = 'unreadable';
    store.state = createSeedState();
  }
}

function writeState(state) {
  if (store.mode !== 'local') return { ok: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: isQuotaError(err) ? 'quota' : 'unavailable' };
  }
}

/* Apply a change to a copy of the state, save it, and only then make it
   current. If storage is full the last saved version is kept. */
function commit(mutate) {
  const draft = clone(store.state);
  mutate(draft);
  const result = writeState(draft);
  if (result.ok) {
    store.state = draft;
    return { ok: true };
  }
  if (result.reason === 'unavailable') {
    store.mode = 'memory';
    store.state = draft;
    return { ok: true, switchedToMemory: true };
  }
  return result;
}

function resetDemo() {
  store.state = createSeedState();
  store.mode = storageWorks() ? 'local' : 'memory';
  const result = writeState(store.state);
  if (!result.ok) store.mode = 'memory';
}
