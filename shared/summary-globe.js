/* Summary view background, dark theme only: the World view's sunlit Earth turning slowly behind the page.
   The Earth turns through the real sun as a slow time-lapse, starting from the last time Australia came round.
   Stops completely in the light theme, loads its imagery only after the page has loaded. */
(function () {
  var E = window.HSMGlobe;
  var cv = document.getElementById('bg-globe'), space = document.getElementById('bg-space');
  if (!E || !cv || !space) return;

  var DAY_SECONDS = 180;           // one simulated day, slower than the World view so it stays calm
  var SUN_AZIMUTH = -2.0;          // sun behind and to the left: mostly night side with city lights, a thin sunlit crescent
  var PITCH = 0.32, ROLL = -0.409; // a little above the equator, axis tilted like a desk globe
  var FRAME_MS = 33;               // about 30 frames a second is plenty for a background
  // Australia gets the spotlight: as it comes round, the camera eases down towards the southern hemisphere
  // and the time-lapse slows so it lingers in the sunlit band, then both ease back. The sun stays true.
  var AU_LON = 134 * E.DEG;        // centre of the continent
  var AU_SPREAD = 45 * E.DEG;      // how far either side of the spot the tilt reaches
  var AU_SLOW = 0.75;              // the time-lapse runs at a quarter speed with Australia in the spot
  var spot = { phi: 0, pitch: 0 }; // where Australia should sit, set in layout() for wide or narrow screens

  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sctx = space.getContext('2d');
  var globe = E.create(cv, { day: 'shared/img/world/earth-day-2k.jpg', night: 'shared/img/world/earth-night-2k.jpg' });
  if (!globe.ok) return;

  var simT = Date.now(), last = 0, raf = 0, running = false, stars = null, lastSpace = 0, pageLoaded = document.readyState === 'complete';
  var rate = 1, spacePitch = 0;

  function dark() { return root.getAttribute('data-theme') !== 'light'; }

  function layout() {
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var narrow = W < 768;
    // a large Earth low on the right, clear of the hero text on the left
    var R = narrow ? W * 0.85 : Math.min(H * 0.62, W * 0.42);
    var CX = narrow ? W * 0.5 : W * 0.76, CY = narrow ? H * 0.98 : H * 0.8;
    // wide: in the gap between the hero text and the profile card. narrow: top middle. Both on the dusk line.
    spot = narrow ? { phi: -20 * E.DEG, pitch: -0.9 } : { phi: -30 * E.DEG, pitch: -0.45 };
    globe.layout(W, H, dpr, R, CX, CY);
    space.width = Math.round(W * dpr); space.height = Math.round(H * dpr);
    stars = E.stars(W, H, dpr, 0.12, 0.55);
    lastSpace = 0;
  }

  // The most recent moment, within the last day, when Australia sat `off` spreads from its spot.
  // Starting the time-lapse there means every visit opens on Australia, not up to a day's turn away.
  function australiaMoment(off) {
    var now = Date.now(), lon = AU_LON + SUN_AZIMUTH - spot.phi - off * AU_SPREAD;   // the sun longitude that puts it there
    var back = ((lon - E.subsolar(now).lon) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    return now - back / (2 * Math.PI) * 86400000;
  }

  function drawSpace(m, sunEF) {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, space.width, space.height);
    sctx.drawImage(stars, 0, 0);
    sctx.setTransform(globe.dpr, 0, 0, globe.dpr, 0, 0);
    E.halo(sctx, globe, E.apply(m, sunEF), 1, 0.8);
  }

  function draw(now) {
    var sp = E.subsolar(simT), sunEF = E.vec(sp.lat, sp.lon), theta = SUN_AZIMUTH - sp.lon;
    var off = AU_LON + theta - spot.phi;                                     // how far Australia is from its spot
    off = Math.atan2(Math.sin(off), Math.cos(off)) / AU_SPREAD;
    var w = Math.exp(-off * off), pitch = PITCH + (spot.pitch - PITCH) * w;
    rate = 1 - AU_SLOW * w * w;
    var m = E.model(theta, pitch, ROLL);
    if (now - lastSpace > 5000 || Math.abs(pitch - spacePitch) > 0.02) {   // the halo barely moves, redraw it rarely
      drawSpace(m, sunEF); lastSpace = now; spacePitch = pitch;
    }
    globe.draw(m, sunEF, 1);
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    var dt = Math.min(now - last, 100); last = now;
    simT += dt * (86400 / DAY_SECONDS) * rate;
    draw(now);
  }

  function start() {
    if (running || !globe.ready) return;
    running = true;
    root.classList.add('has-globe');
    if (reduce) {                                  // one still frame, with Australia in its spot
      simT = australiaMoment(0); draw(performance.now());
      running = false;
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
  simT = australiaMoment(-0.8);                    // open with Australia already rising into view
  window.addEventListener('resize', function () { layout(); if (globe.ready && dark()) draw(performance.now()); });
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  if (pageLoaded) sync();
  else window.addEventListener('load', function () { pageLoaded = true; sync(); });
})();
