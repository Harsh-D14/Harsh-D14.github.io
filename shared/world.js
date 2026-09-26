/* World view: a textured Earth in WebGL with live local times pinned on cities.
   The globe always spins slowly and can be dragged. Sunlight switches the lighting from soft, even
   light to the real sun for the current time: day, night and city lights where they actually are now.
   Tilt switches the 23.44 degree axial tilt on and off.
   The globe itself is drawn by globe.js, which the Summary view background shares. */
(function () {
  var E = window.HSMGlobe;
  if (!E) return;
  // Places to pin. Edit this list to change the timezones on the globe.
  // mine: highlighted in the accent colour. side: 'left' puts the label on the left of the pin.
  var PLACES = [
    { name: 'Sydney', tz: 'Australia/Sydney', lat: -33.87, lon: 151.21, mine: true },
    { name: 'Bengaluru', tz: 'Asia/Kolkata', lat: 12.97, lon: 77.59, mine: true },
    { name: 'Zurich', tz: 'Europe/Zurich', lat: 47.37, lon: 8.54, mine: true },
    { name: 'London', tz: 'Europe/London', lat: 51.51, lon: -0.13, side: 'left' },
    { name: 'Muscat', tz: 'Asia/Muscat', lat: 23.59, lon: 58.41, mine: true, side: 'left' },
    { name: 'Singapore', tz: 'Asia/Singapore', lat: 1.35, lon: 103.82 },
    { name: 'Tokyo', tz: 'Asia/Tokyo', lat: 35.68, lon: 139.69 },
    { name: 'New York', tz: 'America/New_York', lat: 40.71, lon: -74.01 },
    { name: 'San Francisco', tz: 'America/Los_Angeles', lat: 37.77, lon: -122.42, side: 'left' }
  ];

  var SPIN_SECONDS = 90;          // one turn of the slow auto spin
  var PITCH = 0.2, ROLL = -0.409; // camera slightly above the equator, axis tilted 23.44 degrees like a desk globe
  var PITCH_LIMIT = 1.1;          // how far a drag can tilt the globe towards either pole
  var DEG = E.DEG;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = document.getElementById('globe'), space = document.getElementById('space');
  var sctx = space.getContext('2d');
  var pinsEl = document.getElementById('pins'), timesEl = document.getElementById('times');
  var sunBtn = document.getElementById('sun'), tiltBtn = document.getElementById('tilt'), pauseBtn = document.getElementById('pause');
  var clockEl = document.getElementById('clock'), loadingEl = document.getElementById('loading');

  var W = 0, H = 0, dpr = 1, R = 0, CX = 0, CY = 0;
  var theta = 0.6, sunMode = false, sunMix = 0, paused = reduce;
  var tilted = true, roll = ROLL; // roll eases towards ROLL or 0 when Tilt is switched
  var pitch = PITCH, vel = 0;     // drag tilt, and fling speed in radians per second
  var drag = null;                // { x, y, t } while the pointer holds the globe
  var last = performance.now(), stars = null;

  /* ---------------- time and the sun ---------------- */
  var fmt = {};
  PLACES.forEach(function (p) {
    fmt[p.tz] = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: p.tz });
    fmt[p.tz + 'd'] = new Intl.DateTimeFormat('en-AU', { weekday: 'short', timeZone: p.tz });
  });
  function clock(ms, tz) { return fmt[tz].format(ms).replace(/\s/g, ' ').replace(/(am|pm)$/i, function (m) { return m.toUpperCase(); }); }

  var subsolar = E.subsolar, vec = E.vec, apply = E.apply;
  function model() { return E.model(theta, pitch, roll); }

  /* ---------------- the globe (drawn by globe.js) ---------------- */
  var globe = E.create(cv, { day: '../shared/img/world/earth-day.jpg', night: '../shared/img/world/earth-night.jpg' });
  if (!globe.ok) {
    loadingEl.hidden = true;
    document.getElementById('fallback').hidden = false;
    document.getElementById('times').classList.remove('visually-hidden');
    pinsEl.hidden = true;
  }

  /* ---------------- space and atmosphere (2D, behind the globe) ---------------- */
  function drawSpace(sunView) {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.fillStyle = '#04060B'; sctx.fillRect(0, 0, space.width, space.height);
    sctx.drawImage(stars, 0, 0);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    E.halo(sctx, globe, sunView, sunMix);
  }

  /* ---------------- pins ---------------- */
  var pinEls = PLACES.map(function (p) {
    var el = document.createElement('div');
    el.className = 'pin' + (p.mine ? ' mine' : '') + (p.side === 'left' ? ' left' : '');
    el.innerHTML = '<span class="dot"></span><span class="lbl"><b></b><time></time></span>';
    el.querySelector('b').textContent = p.name;
    pinsEl.appendChild(el);
    var li = document.createElement('li'); timesEl.appendChild(li);
    return { el: el, time: el.querySelector('time'), li: li, v: vec(p.lat * DEG, p.lon * DEG), p: p, last: '', w: 0 };
  });

  function updatePins(m, ms) {
    var fade = 0.18;
    pinEls.forEach(function (q) {
      var s = globe.project(m, q.v), o = Math.max(0, Math.min(1, s.facing / fade));
      q.el.style.opacity = o.toFixed(2);
      q.el.style.visibility = o > 0 ? 'visible' : 'hidden';
      q.el.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px)';
      var t = clock(ms, q.p.tz);
      if (t !== q.last) {
        q.last = t; q.time.textContent = t;
        q.li.textContent = q.p.name + ', ' + fmt[q.p.tz + 'd'].format(ms) + ' ' + t;
        q.w = q.el.querySelector('.lbl').offsetWidth;
      }
      var left = q.p.side === 'left';
      if (left && s.x - 10 - q.w < 8) left = false;
      else if (!left && s.x + 10 + q.w > W - 8) left = true;
      q.el.classList.toggle('left', left);
    });
  }

  /* ---------------- layout and loop ---------------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    space.width = Math.round(W * dpr); space.height = Math.round(H * dpr);
    var narrow = W < 640;
    R = narrow ? Math.min(W * 0.45, H * 0.3) : Math.min(W * 0.3, H * 0.36);
    CX = W / 2; CY = narrow ? H * 0.44 : H * 0.49;
    if (globe.ok) globe.layout(W, H, dpr, R, CX, CY); else { globe.CX = CX; globe.CY = CY; globe.R = R; }
    stars = E.stars(W, H, dpr, 1000 / 2600, 1);
  }


  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.1); last = now;
    // ease the lighting in and out
    sunMix += ((sunMode ? 1 : 0) - sunMix) * Math.min(1, dt * 4);
    if (Math.abs(sunMix - (sunMode ? 1 : 0)) < 0.002) sunMix = sunMode ? 1 : 0;

    // ease the axial tilt in and out
    var target = tilted ? ROLL : 0;
    roll += (target - roll) * Math.min(1, dt * 4);
    if (Math.abs(target - roll) < 0.0005) roll = target;

    if (!drag) {                                           // auto spin plus any fling left over from a drag
      theta += dt * ((paused ? 0 : 2 * Math.PI / SPIN_SECONDS) + vel);
      vel *= Math.exp(-dt * 2.2);
      if (Math.abs(vel) < 0.002) vel = 0;
    }
    var ms = Date.now();

    // the sun for this moment, in Earth coordinates, so it lights the right places whatever the spin or tilt
    var m = model();
    var sp = subsolar(ms), sunEF = vec(sp.lat, sp.lon), sunView = apply(m, sunEF);
    drawSpace(sunView);
    if (globe.ok) globe.draw(m, sunEF, sunMix);
    updatePins(m, ms);
    requestAnimationFrame(frame);
  }

  /* ---------------- controls ---------------- */
  sunBtn.addEventListener('click', function () {
    sunMode = !sunMode;
    sunBtn.setAttribute('aria-pressed', String(sunMode));
    clockEl.textContent = sunMode ? 'Real sunlight now · drag to spin' : 'Local times, live · drag to spin';
  });
  tiltBtn.addEventListener('click', function () {
    tilted = !tilted;
    tiltBtn.setAttribute('aria-pressed', String(tilted));
  });
  pauseBtn.addEventListener('click', function () {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = paused ? 'Play' : 'Pause';
  });
  if (reduce) { pauseBtn.hidden = true; }

  /* ---------------- grab and spin ---------------- */
  function onGlobe(e) { var dx = e.clientX - CX, dy = e.clientY - CY; return dx * dx + dy * dy <= R * R * 1.02; }
  function clampPitch(p) { return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p)); }
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', function (e) {
    if (!onGlobe(e)) return;
    drag = { x: e.clientX, y: e.clientY, t: performance.now() };
    vel = 0;
    cv.setPointerCapture(e.pointerId);
    cv.style.cursor = 'grabbing';
    e.preventDefault();
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) { cv.style.cursor = onGlobe(e) ? 'grab' : ''; return; }
    var now = performance.now(), d = (e.clientX - drag.x) / R, dtm = Math.max(now - drag.t, 1) / 1000;
    theta += d;                                         // the surface under the pointer follows it
    pitch = clampPitch(pitch + (e.clientY - drag.y) / R);
    vel = vel * 0.6 + (d / dtm) * 0.4;                  // smoothed speed, used for the fling
    drag = { x: e.clientX, y: e.clientY, t: now };
  });
  function release(e) {
    if (!drag) return;
    if (performance.now() - drag.t > 90) vel = 0;       // held still before letting go, so no fling
    vel = Math.max(-6, Math.min(6, vel));
    drag = null;
    if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
    cv.style.cursor = onGlobe(e) ? 'grab' : '';
  }
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('keydown', function (e) {
    var k = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
    if (!k) return;
    theta += k[0]; pitch = clampPitch(pitch + k[1]); vel = 0;
    e.preventDefault();
  });

  window.addEventListener('resize', resize);
  resize();
  if (globe.ok) {
    globe.load().then(function () { loadingEl.hidden = true; }, function () { loadingEl.textContent = 'The globe imagery did not load'; });
  }
  requestAnimationFrame(frame);
})();
