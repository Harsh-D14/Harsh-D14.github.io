/* Summary view background, dark theme only: the World view's sunlit Earth turning slowly behind the page.
   The sun sits where it really is and the Earth turns through it as a slow time-lapse.
   Stops completely in the light theme, loads its imagery only after the page has loaded. */
(function () {
  var E = window.HSMGlobe;
  var cv = document.getElementById('bg-globe'), space = document.getElementById('bg-space');
  if (!E || !cv || !space) return;

  var DAY_SECONDS = 180;           // one simulated day, slower than the World view so it stays calm
  var SUN_AZIMUTH = -2.0;          // sun behind and to the left: mostly night side with city lights, a thin sunlit crescent
  var PITCH = 0.32, ROLL = -0.409; // a little above the equator, axis tilted like a desk globe
  var FRAME_MS = 33;               // about 30 frames a second is plenty for a background

  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sctx = space.getContext('2d');
  var globe = E.create(cv, { day: 'shared/img/world/earth-day-2k.jpg', night: 'shared/img/world/earth-night-2k.jpg' });
  if (!globe.ok) return;

  var simT = Date.now(), last = 0, raf = 0, running = false, stars = null, lastSpace = 0, pageLoaded = document.readyState === 'complete';

  function dark() { return root.getAttribute('data-theme') !== 'light'; }

  function layout() {
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var narrow = W < 768;
    // a large Earth low on the right, clear of the hero text on the left
    var R = narrow ? W * 0.85 : Math.min(H * 0.62, W * 0.42);
    var CX = narrow ? W * 0.5 : W * 0.76, CY = narrow ? H * 0.98 : H * 0.8;
    globe.layout(W, H, dpr, R, CX, CY);
    space.width = Math.round(W * dpr); space.height = Math.round(H * dpr);
    stars = E.stars(W, H, dpr, 0.12, 0.55);
    lastSpace = 0;
  }

  function drawSpace(m, sunEF) {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, space.width, space.height);
    sctx.drawImage(stars, 0, 0);
    sctx.setTransform(globe.dpr, 0, 0, globe.dpr, 0, 0);
    E.halo(sctx, globe, E.apply(m, sunEF), 1, 0.8);
  }

  function draw(now) {
    var sp = E.subsolar(simT), sunEF = E.vec(sp.lat, sp.lon);
    var m = E.model(SUN_AZIMUTH - sp.lon, PITCH, ROLL);
    if (now - lastSpace > 5000) { drawSpace(m, sunEF); lastSpace = now; }   // the halo barely moves, redraw it rarely
    globe.draw(m, sunEF, 1);
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    var dt = Math.min(now - last, 100); last = now;
    simT += dt * (86400 / DAY_SECONDS);
    draw(now);
  }

  function start() {
    if (running || !globe.ready) return;
    running = true;
    root.classList.add('has-globe');
    if (reduce) {                                  // one still frame of the real sunlight, refreshed each minute
      simT = Date.now(); draw(performance.now());
      running = false;
      clearTimeout(start.t); start.t = setTimeout(function () { if (dark()) { start(); } }, 60000);
      return;
    }
    last = performance.now(); raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf); clearTimeout(start.t);
    root.classList.remove('has-globe');
  }

  function sync() {
    if (!dark()) { stop(); return; }
    if (!pageLoaded) return;
    if (globe.ready) start();
    else globe.load().then(function () { if (dark()) start(); }, function () {});
  }

  layout();
  window.addEventListener('resize', function () { layout(); if (globe.ready && dark()) draw(performance.now()); });
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  if (pageLoaded) sync();
  else window.addEventListener('load', function () { pageLoaded = true; sync(); });
})();
