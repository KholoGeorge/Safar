// ============================================================
//  sync.js — optional Supabase sync.
//
//  Fails silently. Retries on next opportunity. Never blocks the game.
//
//  Setup: fill in CFG.url and CFG.anonKey below, apply supabase/schema.sql,
//  and make sure supabase-js is available on window.supabase (it's listed
//  in sw.js's cache list so it boots offline).
// ============================================================

const Sync = (() => {
  const CFG = {
    url:     'https://lvtpsafqgnfsgbpwfvkw.supabase.co',   // <-- your project URL
    anonKey: 'sb_publishable_c1ZvvKyM89e7RXGLvP-TEw_B79odly7',   // <-- your anon key
    pullLimit: 500,
  };

  const USER_KEY   = 'safar_srs_user_v1';
  const CURSOR_KEY = 'safar_sync_cursor_v1';

  let client = null;
  let session = null;
  let busy = false;
  let listeners = [];

  function isConfigured() { return !!(CFG.url && CFG.anonKey); }

  function initClient() {
    if (client) return client;
    if (!isConfigured()) return null;
    if (!window.supabase || !window.supabase.createClient) {
      console.warn('Sync: supabase-js not loaded');
      return null;
    }
    client = window.supabase.createClient(CFG.url, CFG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    return client;
  }

  async function bootstrap() {
    const c = initClient();
    if (!c) return null;
    try {
      const { data } = await c.auth.getSession();
      session = data?.session || null;
    } catch (_) { session = null; }

    c.auth.onAuthStateChange((_ev, s) => {
      session = s;
      if (s && s.user) localStorage.setItem(USER_KEY, s.user.id);
      notify();
    });

    // If we're signed in and the local data was tagged under a different
    // user, refuse to merge into it (safety rule from Step 6).
    if (session && session.user) {
      const prev = localStorage.getItem(USER_KEY);
      if (prev && prev !== session.user.id) {
        console.warn('Sync: local data belongs to', prev, '— signing out instead of merging.');
        await c.auth.signOut();
        session = null;
      }
    }
    notify();
    return session;
  }

  async function signIn(email, password) {
    const c = initClient();
    if (!c) throw new Error('Sync not configured');
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
    if (session && session.user) localStorage.setItem(USER_KEY, session.user.id);
    notify();
    await syncNow();
    return session;
  }

  async function signUp(email, password) {
    const c = initClient();
    if (!c) throw new Error('Sync not configured');
    const { data, error } = await c.auth.signUp({ email, password });
    if (error) throw error;
    // If Supabase has "Confirm email" turned on, data.session is null and
    // the user must click a link in the confirmation email before they
    // can sign in. Turn "Confirm email" OFF to skip that.
    if (data.session) {
      session = data.session;
      if (session && session.user) localStorage.setItem(USER_KEY, session.user.id);
      notify();
      await syncNow();
    }
    return data;
  }

  async function syncNow() {
    if (busy) return { skipped: true, reason: 'busy' };
    const c = initClient();
    if (!c || !session || !session.user) return { skipped: true, reason: 'signed-out' };
    busy = true; notify();
    try {
      const userId = session.user.id;

            // 1. PULL anything newer than our cursor.
      // Cursor is an ISO timestamp (or '' on first sync). Postgres rejects
      // a numeric 0 for a timestamptz column, so we only add the .gt()
      // filter when we actually have a cursor.
      const cursor = localStorage.getItem(CURSOR_KEY) || '';
      let pullQuery = c
        .from('reviews')
        .select('*')
        .order('received_at', { ascending: true })
        .limit(CFG.pullLimit);
      if (cursor) pullQuery = pullQuery.gt('received_at', cursor);
      const { data: remote, error: pullErr } = await pullQuery;
      if (pullErr) throw pullErr;

      if (remote && remote.length) {
        const mapped = remote.map(r => ({
          id: r.id,
          cardKey: r.card_key,
          rating: r.rating,
          reviewedAt: new Date(r.reviewed_at).getTime(),
          source: r.source || 'game',
          deviceId: r.device_id || '',
          telemetry: r.telemetry || {},
          synced: 1,
        }));
        await SRS.importEntries(mapped);
        const newest = remote[remote.length - 1].received_at;
        if (newest) localStorage.setItem(CURSOR_KEY, String(newest));
      }

      // 2. PUSH local unsynced entries.
      const unsynced = SRS.entries().filter(e => !e.synced);
      if (unsynced.length) {
        const rows = unsynced.map(e => ({
          id: e.id,
          user_id: userId,
          card_key: e.cardKey,
          rating: e.rating,
          reviewed_at: new Date(e.reviewedAt).toISOString(),
          source: e.source || 'game',
          device_id: e.deviceId || '',
          telemetry: e.telemetry || {},
        }));
        const { error: pushErr } = await c.from('reviews').upsert(rows, { onConflict: 'id' });
        if (pushErr) throw pushErr;
        await SRS.markSynced(unsynced.map(e => e.id));
      }

      // 3. Merge profile (max best scores, latest settings).
      const localProfile = {
        stats: loadStats(),
        daily: loadDaily(),
        settings: loadSettings(),
      };
      const { data: row } = await c
        .from('profile')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      const remoteProfile = (row && row.data) || {};
      const merged = mergeProfile(localProfile, remoteProfile);
      const { error: profErr } = await c
        .from('profile')
        .upsert({ user_id: userId, data: merged, updated_at: new Date().toISOString() });
      if (profErr) throw profErr;
      saveStats(merged.stats || {});
      saveDaily(merged.daily || {});
      saveSettings(merged.settings || {});

      // 4. Rebuild from the unioned log.
      SRS.rebuild();

      notify({ lastSync: Date.now(), ok: true });
      return { ok: true, pulled: remote?.length || 0, pushed: unsynced.length };
          } catch (e) {
      console.warn('Sync failed (will retry):', e.message);

      // If the server rejects us because our user no longer exists, the
      // session is dead — drop it so the UI can prompt for sign-in again.
      const msg = String(e && e.message || '');
      const code = e && e.code;
      if (code === '23503' ||                        // FK violation
          /foreign key constraint/i.test(msg) ||
          /user.*not.*found/i.test(msg)) {
        console.warn('Sync: session refers to a deleted user — signing out.');
        try { await c.auth.signOut(); } catch (_) {}
        session = null;
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(CURSOR_KEY);
        notify();
        return { ok: false, error: 'session-invalid' };
      }

      notify({ error: msg });
      return { ok: false, error: msg };
    } finally {
      busy = false; notify();
    }
  }

  async function signOut() {
    const c = initClient();
    // Sign-out keeps local data by default (Step 6 safety rule).
    if (c) { try { await c.auth.signOut(); } catch (_) {} }
    session = null;
    notify();
  }

  function mergeProfile(local, remote) {
    const out = {
      stats:    mergeStats(local.stats || {}, remote.stats || {}),
      daily:    mergeDaily(local.daily || {}, remote.daily || {}),
      settings: Object.assign({}, remote.settings || {}, local.settings || {}),
    };
    return out;
  }
  function mergeStats(a, b) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[k] || {}; const y = b[k] || {};
      out[k] = {
        bestRooms:  Math.max(x.bestRooms  || 0, y.bestRooms  || 0),
        bestScore:  Math.max(x.bestScore  || 0, y.bestScore  || 0),
        plays:      Math.max(x.plays      || 0, y.plays      || 0),
        lastPlayed: Math.max(x.lastPlayed || 0, y.lastPlayed || 0),
      };
    }
    return out;
  }
  function mergeDaily(a, b) {
    return {
      lastDay:   Math.max(a.lastDay   || 0, b.lastDay   || 0),
      streak:    Math.max(a.streak    || 0, b.streak    || 0),
      todayDay:  Math.max(a.todayDay  || 0, b.todayDay  || 0),
      todayBest: Math.max(a.todayBest || 0, b.todayBest || 0),
    };
  }

  function notify(extra) {
    for (const fn of listeners) { try { fn(Object.assign({ session, busy }, extra || {})); } catch (_) {} }
  }

  function onState(fn) { listeners.push(fn); return () => { listeners = listeners.filter(f => f !== fn); }; }

  // Debounced trigger — safe to call from visibilitychange, online, etc.
  let triggerTimer = null;
  function triggerSoon(delay = 800) {
    if (triggerTimer) clearTimeout(triggerTimer);
    triggerTimer = setTimeout(() => { triggerTimer = null; syncNow(); }, delay);
  }

  function wireLifecycle() {
    window.addEventListener('online', () => triggerSoon(200));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') triggerSoon(100);
    });
  }

    return {
    CFG,
    isConfigured,
    bootstrap,
    signIn,
    signUp,
    signOut,
    syncNow,
    triggerSoon,
    wireLifecycle,
    onState,
    getSession: () => session,
    isBusy: () => busy,
  };
})();
