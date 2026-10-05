$('loadingLine').style.display = 'block';
lessonGrid.innerHTML = '';

(async function boot() {
  G.routes = await loadLessons();
  $('loadingLine').style.display = 'none';
  refreshHome();
  showScreen(homeScreen);
  G.lastTime = performance.now();
  requestAnimationFrame(frame);
})();

// js/boot.js

// (Your existing boot code...)

// Register the service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}
