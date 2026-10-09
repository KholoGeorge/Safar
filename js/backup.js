// ============================================================
//  backup.js — export / import the full review log + app state.
//  This is the "independent backup" that sync should never replace.
// ============================================================

const BACKUP_VERSION = 1;

async function exportBackup() {
  const data = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId: SRS.deviceId(),
    reviews: SRS.entries(),
    stats: loadStats(),
    daily: loadDaily(),
    settings: loadSettings(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `safar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus?.('Exported', '', 'ok', 1500);
}

async function importBackupFile(file) {
  if (!file) return;
  let data;
  try {
    const text = await file.text();
    data = JSON.parse(text);
  } catch (e) {
    alert('Could not read that file: ' + e.message);
    return;
  }
  if (!data || typeof data !== 'object') { alert('Not a Safar backup.'); return; }

  // 1. Union review entries by UUID.
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const added = await SRS.importEntries(reviews);

  // 2. Merge profile data (max best scores, latest settings).
  if (data.stats) {
    const local = loadStats();
    const remote = data.stats;
    for (const k of Object.keys(remote)) {
      const a = local[k] || {};
      const b = remote[k] || {};
      local[k] = {
        bestRooms: Math.max(a.bestRooms || 0, b.bestRooms || 0),
        bestScore: Math.max(a.bestScore || 0, b.bestScore || 0),
        plays: Math.max(a.plays || 0, b.plays || 0),
        lastPlayed: Math.max(a.lastPlayed || 0, b.lastPlayed || 0),
      };
    }
    saveStats(local);
  }
  if (data.daily) {
    const local = loadDaily();
    const remote = data.daily;
    const merged = {
      lastDay: Math.max(local.lastDay || 0, remote.lastDay || 0),
      streak: Math.max(local.streak || 0, remote.streak || 0),
      todayDay: Math.max(local.todayDay || 0, remote.todayDay || 0),
      todayBest: Math.max(local.todayBest || 0, remote.todayBest || 0),
    };
    saveDaily(merged);
  }
  if (data.settings) {
    const local = loadSettings();
    saveSettings(Object.assign({}, data.settings, local));
  }

  // 3. Rebuild from the unioned log.
  SRS.rebuild();

  alert(`Imported. ${added} new review${added === 1 ? '' : 's'} merged.`);
  refreshHome?.();
}

function wireBackupButtons() {
  const exp = $('exportBackupBtn');
  if (exp) exp.onclick = exportBackup;

  const impBtn = $('importBackupBtn');
  const impInput = $('importBackupInput');
  if (impBtn && impInput) {
    impBtn.onclick = () => impInput.click();
    impInput.onchange = () => {
      const f = impInput.files && impInput.files[0];
      impInput.value = '';
      if (f) importBackupFile(f);
    };
  }
}
