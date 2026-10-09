const STAT_KEY     = 'safar_stats_v3';
const DAILY_KEY    = 'safar_daily_v1';
const SETTINGS_KEY = 'safar_settings_v1';

function loadStats() { try { return JSON.parse(localStorage.getItem(STAT_KEY) || '{}'); } catch (_) { return {}; } }
function saveStats(s) { localStorage.setItem(STAT_KEY, JSON.stringify(s)); }

function loadDaily() { try { return JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); } catch (_) { return {}; } }
function saveDaily(d) { try { localStorage.setItem(DAILY_KEY, JSON.stringify(d)); } catch (_) {} }

function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (_) { return {}; } }
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_) {} }

function defaults() {
  return {
    "ABY 1-1": [
      { ar: "السَّلَامُ عَلَيْكُمْ", en: "Peace be upon you" },
      { ar: "كَيْفَ حَالُكَ", en: "How are you?" },
      { ar: "أَنَا بِخَيْرٍ", en: "I am fine" },
      { ar: "مَا اسْمُكَ", en: "What is your name?" },
      { ar: "اِسْمِي مُحَمَّد", en: "My name is Muhammad" },
    ]
  };
}
