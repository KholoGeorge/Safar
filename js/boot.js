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
