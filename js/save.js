// localStorage persistence: chapter unlocks, best scores, settings.

import { SETTINGS_DEFAULTS } from './config.js';

const KEY = 'breakthrough.v1';

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        unlocked: Math.max(1, data.unlocked | 0),
        best: data.best && typeof data.best === 'object' ? data.best : {},
        settings: { ...SETTINGS_DEFAULTS, ...(data.settings || {}) },
      };
    }
  } catch (e) {
    console.warn('save load failed', e);
  }
  return { unlocked: 1, best: {}, settings: { ...SETTINGS_DEFAULTS } };
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('save failed', e);
  }
}
