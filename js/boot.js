$('loadingLine').style.display = 'block';
lessonGrid.innerHTML = '';

(async function boot() {
  const [, routes] = await Promise.all([SRS.init(), loadLessons()]);
  G.routes = routes;
  $('loadingLine').style.display = 'none';
  refreshHome();
  showScreen(homeScreen);
  G.lastTime = performance.now();
  requestAnimationFrame(frame);

  // --- Sync / backup / review wiring ---
  if (typeof bootSyncAndBackup === 'function') {
    bootSyncAndBackup();
  } else {
    console.warn('bootSyncAndBackup missing — flow.js did not load?');
  }
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  });
}
