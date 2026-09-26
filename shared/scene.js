/* Creative view: looking out of a gate window at a Boeing 737-800 parked nose in at a modern glass jet bridge
   (teal glazing braced with white diagonals, two telescoping sections). Light theme is sunset, dark is night. Beacons, strobes and nav lights blink while a belt loader carries bags into the
   forward hold, and now and then a distant aircraft takes off or lands on the runway along the horizon.
   Layers: far (sky, apron, runway), then traffic, then near (aircraft, crew, bridge, window frame). */
(function () {
  var cv = document.getElementById('scene');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var bg = document.createElement('canvas');
  var bctx = bg.getContext('2d');
  var fg = document.createElement('canvas');   // near layer, drawn over the runway traffic
  var fctx = fg.getContext('2d');
  var status = document.getElementById('load-status');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, dpr = 1, P = null, C = {};
  var bags = [], loaded = 0, pageReady = false, lastSpawn = 0, last = 0;
  var traffic = null, nextTraffic = 0, movements = 0;   // one distant take off or landing at a time
  var BAG = ['#2C3440', '#4A2F2A', '#2F3D34', '#3B3F4A', '#5A4630', '#23262C'];
  var G = 8.5;                                    // wheel contact line, in wingspan percent units below the fuselage centre (737-800: 1 unit = 0.358 m)

  function v(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function colours() {
    ['sky-top', 'sky-mid', 'sky-low', 'ground', 'ground-far', 'terminal', 'terminal-win', 'plane', 'plane-hi', 'plane-shade',
     'plane-belly', 'window', 'fin', 'taxi', 'stand', 'vehicle', 'haze', 'bridge', 'bridge-win', 'mullion', 'far-light']
      .forEach(function (k) { C[k] = v('--scene-' + k); });
    C.night = v('--scene-mode') === 'night';
  }

  function layout() {
    var narrow = W < 760;
    var s = narrow ? Math.min(W * 0.0125, H * 0.009) * 1.3 : Math.min(W * 0.0064, H * 0.0115) * 1.45;   // parked close to the glass
    var gy = narrow ? H * 0.9 : H * 0.8;
    var oy = gy - G * s;
    return { narrow: narrow, s: s, ox: narrow ? W * 0.5 : W * 0.665, oy: oy, gy: gy, hy: oy - 1.2 * s };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    [cv, bg, fg].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    colours(); P = layout(); drawStatic(); frame(performance.now(), true);
  }

  function rnd(seed) { var x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------------- static layer ---------------- */
  function drawStatic() {
    var c = bctx, s = P.s, cx = P.ox;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    var sky = c.createLinearGradient(0, 0, 0, P.hy);
    sky.addColorStop(0, C['sky-top']); sky.addColorStop(0.65, C['sky-mid']); sky.addColorStop(1, C['sky-low']);
    c.fillStyle = sky; c.fillRect(0, 0, W, P.hy + 1);
    if (!C.night) {                                  // sunset: the sun just below the horizon, glowing through the haze
      var sun = c.createRadialGradient(W * 0.22, P.hy, 0, W * 0.22, P.hy, W * 0.55);
      sun.addColorStop(0, 'rgba(255, 196, 120, 0.75)'); sun.addColorStop(0.35, 'rgba(255, 150, 90, 0.25)'); sun.addColorStop(1, 'rgba(255, 150, 90, 0)');
      c.fillStyle = sun; c.fillRect(0, 0, W, P.hy + 1);
    }
    if (C.night) {
      for (var i = 0; i < 90; i++) {
        c.fillStyle = 'rgba(255,255,255,' + (0.15 + rnd(i) * 0.45) + ')';
        c.fillRect(rnd(i + 1) * W, rnd(i + 2) * P.hy * 0.6, 1, 1);
      }
    }

    // distant skyline and far apron lights along the horizon
    for (var b = 0; b < 60; b++) {
      var bx = rnd(b + 11) * W, bw = 8 + rnd(b + 12) * 40, bh = 3 + rnd(b + 13) * 14;
      c.fillStyle = C.terminal; c.fillRect(bx, P.hy - bh, bw, bh);
    }
    c.fillStyle = C.terminal; c.fillRect(0, P.hy - 4, W, 5);
    if (C.night) {
      for (var l = 0; l < 160; l++) {
        c.fillStyle = l % 7 === 0 ? 'rgba(120,170,255,0.9)' : C['far-light'];
        c.fillRect(rnd(l + 40) * W, P.hy - 1 - rnd(l + 41) * 12, 1.4, 1.4);
      }
      var haze = c.createLinearGradient(0, P.hy - H * 0.12, 0, P.hy + 4);
      haze.addColorStop(0, 'rgba(0,0,0,0)'); haze.addColorStop(1, C.haze);
      c.fillStyle = haze; c.fillRect(0, P.hy - H * 0.12, W, H * 0.12 + 4);
    }
    // tails of other aircraft on distant stands
    [[0.08, 1], [0.2, 0.8], [0.42, 0.7], [0.93, 0.9]].forEach(function (t, i) {
      var x = W * t[0], h = s * 3.4 * t[1];
      if (P.narrow && i === 2) return;
      c.fillStyle = C.terminal;
      c.beginPath(); c.moveTo(x - h * 0.28, P.hy - 2); c.lineTo(x - h * 0.05, P.hy - h); c.lineTo(x + h * 0.12, P.hy - h); c.lineTo(x + h * 0.26, P.hy - 2); c.closePath(); c.fill();
    });

    // apron in perspective
    var ground = c.createLinearGradient(0, P.hy, 0, H);
    ground.addColorStop(0, C['ground-far']); ground.addColorStop(1, C.ground);
    c.fillStyle = ground; c.fillRect(0, P.hy, W, H - P.hy);
    // the runway just below the horizon, with edge lights at night
    var ry = runwayY(), rh = Math.max(2, s * 0.3);
    c.fillStyle = C.night ? 'rgba(10, 12, 16, 0.75)' : 'rgba(60, 66, 74, 0.45)'; c.fillRect(0, ry - rh / 2, W, rh);
    if (C.night) {
      c.fillStyle = 'rgba(255, 236, 200, 0.85)';
      for (var e = 0; e < W; e += Math.max(10, s * 1.4)) { c.fillRect(e, ry - rh / 2 - 1, 1.3, 1.3); c.fillRect(e + 3, ry + rh / 2, 1.3, 1.3); }
    }
    c.strokeStyle = C.stand; c.lineWidth = 1;
    c.globalAlpha = 0.12;
    for (var j = -14; j <= 14; j++) { c.beginPath(); c.moveTo(cx + j * s * 0.6, P.hy); c.lineTo(cx + j * W * 0.16, H); c.stroke(); }
    for (var k = 1; k < 12; k++) { var yy = P.hy + (H - P.hy) * Math.pow(k / 12, 2.2); c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); }
    c.globalAlpha = 1;
    if (C.night) {                                   // floodlit pool around the stand
      c.save(); c.translate(cx, P.gy); c.scale(1, 0.16);
      var pool = c.createRadialGradient(0, 0, 0, 0, 0, W * 0.55);
      pool.addColorStop(0, 'rgba(255, 196, 120, 0.22)'); pool.addColorStop(1, 'rgba(255, 196, 120, 0)');
      c.fillStyle = pool; c.beginPath(); c.arc(0, 0, W * 0.55, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    // lead in line and stop bar
    c.fillStyle = C.taxi;
    c.beginPath(); c.moveTo(cx - 0.4, P.hy); c.lineTo(cx + 0.4, P.hy); c.lineTo(cx + s * 0.9, H); c.lineTo(cx - s * 0.9, H); c.closePath(); c.fill();
    c.fillRect(cx - s * 1.6, P.gy - s * 0.12, s * 3.2, Math.max(2, s * 0.22));
    // equipment restraint line
    c.strokeStyle = 'rgba(200, 40, 40, 0.75)'; c.lineWidth = Math.max(1.5, s * 0.16); c.setLineDash([s * 1.2, s * 0.8]);
    c.beginPath(); c.moveTo(0, P.gy + s * 3.2); c.lineTo(W, P.gy + s * 3.2); c.stroke(); c.setLineDash([]);

    // floodlight masts
    [0.04, 0.985].forEach(function (f) {
      var x = W * f, top = P.hy - H * 0.3, base = P.gy - s * 1.5;
      c.fillStyle = C.terminal; c.fillRect(x - 1.5, top, 3, base - top);
      c.fillRect(x - 12, top - 4, 24, 5);
      if (C.night) {
        var g = c.createRadialGradient(x, top, 0, x, top, 26);
        g.addColorStop(0, 'rgba(255, 220, 170, 0.55)'); g.addColorStop(1, 'rgba(255, 220, 170, 0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, top, 26, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#FFE7C2'; c.fillRect(x - 10, top - 2, 20, 2);
      }
    });

    // shadow under the aircraft
    c.save(); c.translate(cx, P.gy); c.scale(1, 0.09);
    var sh = c.createRadialGradient(0, 0, 0, 0, 0, s * 30);
    sh.addColorStop(0, C.night ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.32)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh; c.beginPath(); c.arc(0, 0, s * 30, 0, Math.PI * 2); c.fill();
    c.restore();

    var n = fctx;
    n.setTransform(dpr, 0, 0, dpr, 0, 0);
    n.clearRect(0, 0, W, H);
    n.save(); n.translate(P.ox, P.oy); n.scale(s, s);
    drawAircraft(n);
    drawGroundCrew(n);
    n.restore();
    drawBridge(n);
    drawWindowFrame(n);
  }

  function runwayY() { return P.hy + Math.max(3, P.s * 0.45); }

  function metal(c, x0, y0, x1, y1, a, b, d) {
    var g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, a); g.addColorStop(0.45, b); g.addColorStop(1, d); return g;
  }

  function drawAircraft(c) {
    // Boeing 737-800 in front view. 1 unit = 0.358 m (35.8 m span over 100 units).
    // horizontal stabilisers (14.4 m span, 7 degree dihedral) and fin (12.5 m to the tip), behind the fuselage
    c.fillStyle = C['plane-shade'];
    [-1, 1].forEach(function (d) {
      c.beginPath(); c.moveTo(d * 3.2, -1.9); c.lineTo(d * 20, -4.0); c.lineTo(d * 20.1, -3.6); c.lineTo(d * 3.2, -1.25); c.closePath(); c.fill();
    });
    c.fillStyle = metal(c, -0.7, 0, 0.7, 0, C.fin, C.fin, C['plane-shade']);
    c.beginPath(); c.moveTo(-0.65, -4.6); c.lineTo(-0.26, -25.2); c.lineTo(0.26, -25.2); c.lineTo(0.65, -4.6); c.closePath(); c.fill();

    // low wings with 6 degree dihedral and blended winglets
    [-1, 1].forEach(function (d) {
      c.fillStyle = metal(c, 0, -2.6, 0, 4.9, C['plane-hi'], C.plane, C['plane-shade']);
      c.beginPath();
      c.moveTo(d * 3.4, 2.6); c.lineTo(d * 49.2, -2.2); c.lineTo(d * 49.2, -1.6); c.lineTo(d * 3.4, 4.9); c.closePath(); c.fill();
      c.strokeStyle = C['plane-hi']; c.lineWidth = 0.1;
      c.beginPath(); c.moveTo(d * 3.4, 2.6); c.lineTo(d * 49.2, -2.2); c.stroke();
      // blended winglet: a smooth curve up from the tip, 2.4 m tall, canted slightly outboard
      c.fillStyle = C.plane;
      c.beginPath();
      c.moveTo(d * 47.6, -2.05);
      c.quadraticCurveTo(d * 49.9, -2.5, d * 50.35, -9.0);
      c.lineTo(d * 50.0, -9.05);
      c.quadraticCurveTo(d * 49.5, -3.3, d * 47.6, -1.55);
      c.closePath(); c.fill();
      // flap track fairings
      c.fillStyle = C['plane-shade'];
      [9.5, 22, 31, 39].forEach(function (x) { var y = lerp(4.9, -1.6, (x - 3.4) / 45.8); c.beginPath(); c.ellipse(d * x, y + 0.25, 0.28, 0.55, 0, 0, Math.PI * 2); c.fill(); });
      // CFM56 engine hung forward and tight under the wing, with the flattened lower lip of the 737 nacelle
      var ex = d * 13.7, ey = 4.6;
      function pouch(r, f) {
        var t = Math.asin(Math.min(f / r, 1));
        c.beginPath(); c.arc(ex, ey, r, Math.PI - t, t + Math.PI * 2); c.closePath();
      }
      c.fillStyle = C.plane; c.fillRect(ex - 0.5, 1.3, 1.0, 0.8);
      var n = c.createRadialGradient(ex - 1, ey - 1.2, 0.3, ex, ey, 3.1);
      n.addColorStop(0, C['plane-hi']); n.addColorStop(0.7, C.plane); n.addColorStop(1, C['plane-shade']);
      c.fillStyle = n; pouch(2.95, 2.3); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.14; pouch(2.52, 1.95); c.stroke();
      var inl = c.createRadialGradient(ex, ey, 0.2, ex, ey, 2.4);
      inl.addColorStop(0, '#3A4049'); inl.addColorStop(0.55, '#1A1E24'); inl.addColorStop(1, '#0B0D10');
      c.fillStyle = inl; pouch(2.36, 1.8); c.fill();
      c.save(); pouch(2.36, 1.8); c.clip();
      c.strokeStyle = 'rgba(160,170,185,0.16)'; c.lineWidth = 0.06;
      for (var a = 0; a < 24; a++) { var t = a / 24 * Math.PI * 2; c.beginPath(); c.moveTo(ex + Math.cos(t) * 0.7, ey + Math.sin(t) * 0.7); c.lineTo(ex + Math.cos(t + 0.25) * 2.2, ey + Math.sin(t + 0.25) * 2.2); c.stroke(); }
      c.restore();
      c.fillStyle = '#C9CED6'; c.beginPath(); c.arc(ex, ey, 0.55, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2A2F36'; c.lineWidth = 0.1; c.beginPath(); c.arc(ex, ey, 0.32, 0.3, 2.6); c.stroke();
    });

    // main gear, 5.7 m track, short struts
    [-1, 1].forEach(function (d) {
      c.fillStyle = '#50565F'; c.fillRect(d * 8 - 0.2, 4.1, 0.4, G - 5.7);
      c.fillStyle = '#16181C';
      c.beginPath(); c.roundRect(d * 8 - 1.55, G - 3.2, 1.2, 3.2, 0.45); c.fill();
      c.beginPath(); c.roundRect(d * 8 + 0.35, G - 3.2, 1.2, 3.2, 0.45); c.fill();
      c.fillStyle = '#6A7079'; c.fillRect(d * 8 - 0.45, G - 1.8, 0.9, 0.4);
    });

    // fuselage, slightly taller than wide (3.76 m by 4.01 m)
    var f = c.createRadialGradient(-1.6, -2.2, 0.4, 0, 0, 6.3);
    f.addColorStop(0, C['plane-hi']); f.addColorStop(0.62, C.plane); f.addColorStop(1, C['plane-shade']);
    c.fillStyle = f; c.beginPath(); c.ellipse(0, 0, 5.25, 5.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = C['plane-belly']; c.globalAlpha = 0.5; c.beginPath(); c.ellipse(0, 0, 5.25, 5.6, 0, 0.25 * Math.PI, 0.75 * Math.PI); c.closePath(); c.fill(); c.globalAlpha = 1;
    // nose, after Harsh's drawing: a round radome with a faint seam ring, and the tip bulging towards the viewer
    c.strokeStyle = 'rgba(80,90,105,0.22)'; c.lineWidth = 0.07;
    c.beginPath(); c.ellipse(0, 1.1, 2.45, 2.35, 0, 0, Math.PI * 2); c.stroke();
    var tip = c.createRadialGradient(-0.3, 0.95, 0.1, 0, 1.3, 1.2);
    tip.addColorStop(0, C.night ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)');
    tip.addColorStop(0.55, 'rgba(255,255,255,0.12)');
    tip.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = tip; c.beginPath(); c.arc(0, 1.3, 1.2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(80,90,105,0.16)'; c.lineWidth = 0.05;
    c.beginPath(); c.arc(0, 1.3, 1.05, 0, Math.PI * 2); c.stroke();
    // cockpit, after Harsh's drawing: a slim visor of six panes in a dark surround. Top and bottom edges run
    // straight across the two big windshields, then both angle down at the ends, so the side windows are
    // parallelograms leaning outward at the bottom, with the posts between them slanted the same way.
    c.fillStyle = '#0E1116';
    c.beginPath();
    c.moveTo(-3.7, -1.2); c.lineTo(-3.78, -1.32); c.lineTo(-3.25, -2.86); c.lineTo(3.25, -2.86); c.lineTo(3.78, -1.32); c.lineTo(3.7, -1.2);
    c.quadraticCurveTo(3.15, -1.55, 2.35, -1.93); c.lineTo(-2.35, -1.93); c.quadraticCurveTo(-3.15, -1.55, -3.7, -1.2);
    c.closePath(); c.fill();
    c.fillStyle = C.window;
    [-1, 1].forEach(function (d) {
      c.beginPath(); c.moveTo(d * 0.07, -2.78); c.lineTo(d * 1.95, -2.78); c.lineTo(d * 1.95, -2.0); c.lineTo(d * 0.07, -2.0); c.closePath(); c.fill();   // No. 1 windshield
      c.beginPath(); c.moveTo(d * 2.05, -2.78); c.lineTo(d * 2.6, -2.78); c.lineTo(d * 2.88, -1.8); c.lineTo(d * 2.05, -2.0); c.closePath(); c.fill();   // No. 2, outer post slanted
      c.beginPath(); c.moveTo(d * 2.72, -2.78); c.lineTo(d * 3.18, -2.78); c.lineTo(d * 3.68, -1.35); c.lineTo(d * 3.6, -1.3); c.quadraticCurveTo(d * 3.3, -1.5, d * 3.0, -1.68); c.closePath(); c.fill();   // No. 3, tall and leaning outward
    });
    // a thin glint across each windshield so the band still reads as glass
    c.fillStyle = C.night ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.16)';
    [-1, 1].forEach(function (d) {
      c.beginPath(); c.moveTo(d * 0.5, -2.78); c.lineTo(d * 0.8, -2.78); c.lineTo(d * 0.58, -2.0); c.lineTo(d * 0.3, -2.0); c.closePath(); c.fill();
    });
    // forward cargo door open on the right side of the aircraft, sill about 1.3 m above the apron
    c.fillStyle = C.night ? '#E8B774' : '#3A342B';
    c.beginPath(); c.moveTo(-4.72, 2.5); c.lineTo(-4.2, 2.4); c.lineTo(-3.9, 4.75); c.lineTo(-4.4, 4.9); c.closePath(); c.fill();
    // nose gear
    c.fillStyle = '#50565F'; c.fillRect(-0.16, 5.3, 0.32, G - 6.25);
    c.fillStyle = '#16181C';
    c.beginPath(); c.roundRect(-1.05, G - 1.9, 0.85, 1.9, 0.3); c.fill();
    c.beginPath(); c.roundRect(0.2, G - 1.9, 0.85, 1.9, 0.3); c.fill();
    // chocks and cones
    c.fillStyle = '#E8C23A'; c.fillRect(-1.2, G - 0.35, 2.4, 0.35);
    [[-49.4, 0.4], [49.4, 0.4], [-13.7, 1.4], [13.7, 1.4]].forEach(function (p) {
      var x = p[0], y = G + p[1];
      c.fillStyle = '#E8651F'; c.beginPath(); c.moveTo(x - 0.35, y); c.lineTo(x, y - 1.1); c.lineTo(x + 0.35, y); c.closePath(); c.fill();
      c.fillStyle = '#F2F2F2'; c.fillRect(x - 0.16, y - 0.62, 0.32, 0.16);
    });
  }

  function drawGroundCrew(c) {
    // belt loader on the aircraft's right side, conveyor up to the forward hold
    var y = G;
    c.fillStyle = C.vehicle;
    c.beginPath(); c.roundRect(-16.8, y - 1.5, 7.0, 1.1, 0.25); c.fill();
    c.fillRect(-16.7, y - 3.1, 1.7, 1.7);
    c.fillStyle = 'rgba(160, 200, 230, 0.5)'; c.fillRect(-16.5, y - 2.9, 1.3, 0.8);
    c.fillStyle = '#16181C';
    [-15.7, -10.6].forEach(function (x) { c.beginPath(); c.roundRect(x - 0.45, y - 0.9, 0.9, 0.9, 0.2); c.fill(); });
    c.strokeStyle = '#2B3038'; c.lineWidth = 0.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-13.8, y - 1.7); c.lineTo(-4.6, 4.4); c.stroke();
    c.strokeStyle = C.vehicle; c.lineWidth = 0.12;
    c.beginPath(); c.moveTo(-13.8, y - 2.2); c.lineTo(-4.6, 3.9); c.stroke();
    c.beginPath(); c.moveTo(-11.2, y - 1.5); c.lineTo(-11.2, 5.85); c.stroke();
    // baggage carts and tug under the left wing
    [-22.5, -27.2].forEach(function (x) {
      c.fillStyle = C.vehicle; c.fillRect(x - 2, y - 1.05, 4, 0.35);
      c.fillRect(x - 2, y - 3.2, 0.14, 2.2); c.fillRect(x + 1.86, y - 3.2, 0.14, 2.2); c.fillRect(x - 2, y - 3.25, 4, 0.14);
      c.fillStyle = '#16181C'; [-1.5, 1.5].forEach(function (o) { c.fillRect(x + o - 0.3, y - 0.7, 0.6, 0.7); });
    });
    c.fillStyle = C.vehicle; c.beginPath(); c.roundRect(-33, y - 1.8, 3.2, 1.3, 0.3); c.fill();
    c.fillRect(-32.6, y - 2.8, 1.4, 1.1);
    c.fillStyle = '#16181C'; [-32.4, -30.4].forEach(function (x) { c.fillRect(x - 0.35, y - 0.8, 0.7, 0.8); });
  }

  function drawBridge(c) {
    // A modern glass jet bridge: teal glazing between a white roof and floor, braced with white diagonals,
    // in two telescoping sections (the outer one slightly larger), a white cab and a grey folded canopy
    // that closes onto the fuselage at the forward left door, and an upright drive column on a wheel bogie.
    var s = P.s, dx = P.ox + 4.7 * s, cabL = P.ox + 5.3 * s, cabR = cabL + 1.9 * s;
    var cT = P.oy - 5.4 * s, cB = P.oy + 1.5 * s;
    var fx = cabR, fT = P.oy - 4.8 * s, fB = P.oy + 1.2 * s;
    var nx = W + 20, nT = P.hy - H * 0.2, nB = P.hy + H * 0.13;
    if (P.narrow) { nT = P.hy - H * 0.12; nB = P.hy + H * 0.08; }
    var frame = C.night ? '#8B949E' : '#F1ECEA', frameShade = C.night ? '#5E6670' : '#C8BDBE';
    function X(u) { return lerp(fx, nx, u); }
    function edges(u, grow) {                        // roof and floor at u, the outer section grown about its middle
      var t = lerp(fT, nT, u), b = lerp(fB, nB, u), m = (t + b) / 2, h = (b - t) / 2 * grow;
      return [m - h, m + h];
    }
    function section(u0, u1, grow, bays) {
      var e0 = edges(u0, grow), e1 = edges(u1, grow), x0 = X(u0), x1 = X(u1);
      function at(u, k) { var e = edges(u, grow); return lerp(e[0], e[1], k); }
      // glass wall
      var glass = c.createLinearGradient(0, Math.min(e0[0], e1[0]), 0, Math.max(e0[1], e1[1]));
      if (C.night) { glass.addColorStop(0, 'rgba(40, 70, 80, 0.92)'); glass.addColorStop(0.5, 'rgba(255, 205, 150, 0.45)'); glass.addColorStop(1, 'rgba(30, 55, 65, 0.95)'); }
      else { glass.addColorStop(0, 'rgba(120, 205, 210, 0.9)'); glass.addColorStop(1, 'rgba(45, 125, 140, 0.92)'); }
      c.fillStyle = glass;
      c.beginPath(); c.moveTo(x0, e0[0]); c.lineTo(x1, e1[0]); c.lineTo(x1, e1[1]); c.lineTo(x0, e0[1]); c.closePath(); c.fill();
      // a soft reflection band across the glass
      c.fillStyle = C.night ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.14)';
      c.beginPath(); c.moveTo(x0, at(u0, 0.25)); c.lineTo(x1, at(u1, 0.12)); c.lineTo(x1, at(u1, 0.3)); c.lineTo(x0, at(u0, 0.45)); c.closePath(); c.fill();
      // roof and floor bands
      [[0, 0.16, frame], [0.84, 1, frameShade]].forEach(function (band) {
        c.fillStyle = band[2];
        c.beginPath(); c.moveTo(x0, at(u0, band[0])); c.lineTo(x1, at(u1, band[0])); c.lineTo(x1, at(u1, band[1])); c.lineTo(x0, at(u0, band[1])); c.closePath(); c.fill();
      });
      // posts and alternating diagonal braces, spaced to follow the perspective
      c.strokeStyle = frame; c.lineCap = 'butt';
      for (var i = 0; i <= bays; i++) {
        var ua = lerp(u0, u1, Math.pow(i / bays, 1.25)), xa = X(ua), lw = Math.max(1.2, (at(ua, 1) - at(ua, 0)) * 0.035);
        c.lineWidth = lw * 1.3; c.beginPath(); c.moveTo(xa, at(ua, 0.16)); c.lineTo(xa, at(ua, 0.84)); c.stroke();
        if (i < bays) {
          var ub = lerp(u0, u1, Math.pow((i + 1) / bays, 1.25)), xb = X(ub);
          c.lineWidth = lw;
          c.beginPath();
          if (i % 2) { c.moveTo(xa, at(ua, 0.16)); c.lineTo(xb, at(ub, 0.84)); }
          else { c.moveTo(xa, at(ua, 0.84)); c.lineTo(xb, at(ub, 0.16)); }
          c.stroke();
        }
      }
      // end frame of the section
      c.fillStyle = frameShade; c.fillRect(x0 - Math.max(1, s * 0.12), e0[0], Math.max(2, s * 0.24), e0[1] - e0[0]);
    }
    // drive column: an upright post from the inner section down to a two wheel bogie
    var cu = 0.3, cx = X(cu), cb = edges(cu, 1)[1], cg = lerp(P.gy, H * 1.15, cu * 0.9);
    c.fillStyle = frameShade; c.fillRect(cx - s * 0.35, cb, s * 0.7, cg - cb - s * 1.0);
    c.fillStyle = frame; c.fillRect(cx - s * 0.18, cb, s * 0.12, cg - cb - s * 1.0);
    c.fillStyle = C.night ? '#2A2F36' : '#6B6670'; c.fillRect(cx - s * 1.6, cg - s * 1.2, s * 3.2, s * 0.35);
    c.fillStyle = '#16181C';
    [-1, 1].forEach(function (d) { c.beginPath(); c.roundRect(cx + d * s * 1.0 - s * 0.55, cg - s * 1.05, s * 1.1, s * 1.05, s * 0.3); c.fill(); });
    // the outer section is drawn last so the inner one appears to slide into it
    section(0, 0.46, 1, 5);
    section(0.43, 1, 1.09, 7);
    // cab: white box, a slightly taller end frame and a small window
    c.fillStyle = metal(c, cabL, 0, cabR, 0, frame, frame, frameShade);
    c.fillRect(cabL, cT, cabR - cabL, cB - cT);
    c.fillStyle = C.night ? 'rgba(255, 205, 150, 0.6)' : 'rgba(70, 150, 165, 0.85)'; c.fillRect(cabL + s * 0.5, cT + s * 1.2, s * 0.9, s * 1.4);
    c.fillStyle = frameShade; c.fillRect(cabL, cB - s * 0.5, cabR - cabL, s * 0.5);
    // folded grey canopy closing onto the fuselage side, over the door
    var ct = cT + s * 0.35, cbt = cB - s * 0.25, folds = 6;
    for (var k = 0; k < folds; k++) {
      var fx0 = lerp(dx, cabL, k / folds), fx1 = lerp(dx, cabL, (k + 1) / folds);
      c.fillStyle = k % 2 ? (C.night ? '#4A5059' : '#8E9097') : (C.night ? '#2A2F36' : '#6E7178');
      c.fillRect(fx0, ct, fx1 - fx0 + 0.5, cbt - ct);
    }
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(dx - s * 0.08, ct, s * 0.12, cbt - ct);   // seal against the skin
  }

  function drawWindowFrame(c) {
    // the gate glazing: two mullions and a sill, with a faint reflection
    var xs = P.narrow ? [W * 0.03, W * 0.97] : [W * 0.36, W * 0.995];
    xs.forEach(function (x) {
      var g = c.createLinearGradient(x - 5, 0, x + 5, 0);
      g.addColorStop(0, C.mullion); g.addColorStop(0.5, 'rgba(120,130,145,0.55)'); g.addColorStop(1, C.mullion);
      c.fillStyle = g; c.fillRect(x - 4, 0, 8, H);
    });
    var sill = H * 0.965;
    c.fillStyle = C.mullion; c.fillRect(0, sill, W, H - sill);
    c.fillStyle = 'rgba(160,170,185,0.35)'; c.fillRect(0, sill, W, 1.5);
    var r = c.createLinearGradient(0, 0, W, H);
    r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.48, 'rgba(255,255,255,0)');
    r.addColorStop(0.5, C.night ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)');
    r.addColorStop(0.56, 'rgba(255,255,255,0)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = r; c.fillRect(0, 0, W, sill);
  }

  /* ---------------- distant traffic ---------------- */
  // Where a movement is at progress u (0 to 1): f is the fraction of the way across the screen and alt the
  // height above the runway in pixels. Speeds change smoothly, the climb and descent leave and meet the
  // runway tangentially, and pitch follows the flight path. The first screen hides most of the horizon behind
  // the boarding pass and the parked 737, so take offs climb out over the bridge and landings descend from
  // the upper right, where there is open sky.
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function path(m, u) {
    if (m.kind === 'takeoff') {
      var f = u < 0.5 ? 0.42 * Math.pow(u / 0.5, 2) : 0.42 + 1.68 * (u - 0.5);           // accelerate, then steady climb speed
      var k = Math.max(0, (f - 0.42) / 0.58);
      return { f: f, alt: H * 0.46 * Math.pow(k, 1.7), ground: f < 0.42 };
    }
    var g = u < 0.62 ? 0.97 * u : 0.6 + 0.97 * (u - 0.62) - 1.1 * Math.pow(u - 0.62, 2);     // steady approach, then brake
    var x = Math.max(0, (0.6 - g) / 0.6);
    return { f: g, alt: H * 0.24 * Math.pow(x, 1.35), ground: g >= 0.6 };                   // shallow glide, flaring to touchdown
  }
  function movement(m, u) {
    var p = path(m, u), q = path(m, Math.min(1, u + 0.004));
    var dx = Math.abs(q.f - p.f) * W, dy = q.alt - p.alt;
    var along = dx > 0.01 ? Math.atan2(dy, dx) : 0;                                         // flight path angle, climbing positive
    var pitch;
    if (m.kind === 'takeoff') pitch = p.ground ? 0.1 * smooth((p.f - 0.36) / 0.06) : along + 0.04;   // rotate just before lift off
    else pitch = p.ground ? 0.06 * (1 - smooth((p.f - 0.6) / 0.05)) : along + 0.07;                    // nose up on approach, lowered after touchdown
    return { f: p.f, alt: p.alt, pitch: pitch, gear: m.kind === 'landing' || p.alt < H * 0.08 };
  }

  function drawTraffic(now) {
    if (reduce) return;
    if (!traffic) {
      if (!nextTraffic) nextTraffic = now + 4000;
      if (now < nextTraffic) return;
      var kind = movements % 2 ? 'landing' : 'takeoff';
      traffic = { kind: kind, dir: kind === 'takeoff' ? 1 : -1, t0: now, dur: kind === 'takeoff' ? 26000 : 28000 };
      movements++;
    }
    var u = (now - traffic.t0) / traffic.dur;
    var m = movement(traffic, Math.min(u, 1));
    if (u >= 1 || m.f > 1.08 || m.alt > H) { traffic = null; nextTraffic = now + 9000 + Math.random() * 12000; return; }
    var L = Math.max(16, P.s * 3.4), h = L * 0.11, d = traffic.dir;
    var xa = d > 0 ? -L : W + L, x = xa + d * (W + 2 * L) * m.f, y = runwayY() - h * (m.gear ? 0.9 : 0.5) - m.alt;
    var a = Math.min(1, u / 0.05, traffic.kind === 'landing' ? (1 - u) / 0.1 : 1);
    if (x < -L * 2 || x > W + L * 2) return;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(x, y); ctx.scale(d, 1); ctx.rotate(-m.pitch);
    var body = C.night ? '#3A4350' : '#8E99A6', dark = C.night ? '#232A34' : '#6C7784';
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-L * 0.5, -h * 0.5); ctx.lineTo(L * 0.4, -h * 0.5); ctx.quadraticCurveTo(L * 0.52, -h * 0.4, L * 0.52, 0);
    ctx.quadraticCurveTo(L * 0.5, h * 0.5, L * 0.4, h * 0.5); ctx.lineTo(-L * 0.42, h * 0.5); ctx.lineTo(-L * 0.5, -h * 0.1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-L * 0.36, -h * 0.5); ctx.lineTo(-L * 0.47, -h * 2.9); ctx.lineTo(-L * 0.52, -h * 2.9); ctx.lineTo(-L * 0.5, -h * 0.5); ctx.closePath(); ctx.fill();   // fin
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(L * 0.08, h * 0.1); ctx.lineTo(-L * 0.14, h * 0.75); ctx.lineTo(-L * 0.2, h * 0.75); ctx.lineTo(-L * 0.04, h * 0.1); ctx.closePath(); ctx.fill();          // wing
    ctx.beginPath(); ctx.ellipse(L * 0.07, h * 0.72, L * 0.07, h * 0.32, 0, 0, Math.PI * 2); ctx.fill();                                                                          // engine
    ctx.beginPath(); ctx.moveTo(-L * 0.44, -h * 0.3); ctx.lineTo(-L * 0.53, -h * 0.9); ctx.lineTo(-L * 0.56, -h * 0.9); ctx.lineTo(-L * 0.5, -h * 0.1); ctx.closePath(); ctx.fill();   // tailplane
    if (m.gear) { ctx.fillRect(L * 0.3, h * 0.5, Math.max(1, h * 0.12), h * 0.4); ctx.fillRect(-L * 0.08, h * 0.5, Math.max(1, h * 0.14), h * 0.4); }
    ctx.restore();
    // lights, in screen space so they stay round
    var cos = Math.cos(m.pitch), sin = Math.sin(m.pitch);
    function pt(px, py) { return [x + d * (px * cos + py * sin), y + (-px * sin + py * cos)]; }
    var nose = pt(L * 0.5, h * 0.1), top = pt(-L * 0.05, -h * 0.55), tip = pt(-L * 0.1, h * 0.7), fin = pt(-L * 0.5, -h * 2.8);
    var on = (m.alt < H * 0.25) || traffic.kind === 'landing';
    ctx.globalAlpha = Math.max(0, a);
    if (on) light(nose[0], nose[1], 1.2, 'rgb(255, 250, 235)', true, C.night ? 16 : 7);                         // landing lights
    light(top[0], top[1], 0.9, 'rgb(255, 50, 40)', (now % 1250) < 130, 7);                                      // beacon
    light(tip[0], tip[1], 0.8, 'rgb(255, 255, 255)', (now % 1500) < 55 || ((now % 1500) > 170 && (now % 1500) < 225), 8);   // strobe
    light(fin[0], fin[1], 0.7, 'rgb(255, 255, 255)', C.night, 4);                                              // logo light on the tail
    ctx.globalAlpha = 1;
  }

  /* ---------------- animated layer ---------------- */
  function light(x, y, r, col, on, halo) {
    if (!on) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, halo);
    g.addColorStop(0, col); g.addColorStop(0.25, col.replace(')', ', 0.35)').replace('rgb', 'rgba')); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = C.night ? 0.95 : 0.6;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, halo, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }

  function frame(now, force) {
    if (!force && now - last < 33) return;
    var dt = Math.min(now - last, 100); last = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTraffic(now);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var s = P.s;

    if (!reduce) {
      if (now - lastSpawn > (pageReady ? 1700 : 800)) { bags.push({ t: 0, c: BAG[(loaded + bags.length) % BAG.length] }); lastSpawn = now; }
      bags.forEach(function (b) { b.t += dt / 3000; });
      while (bags.length && bags[0].t >= 1) { bags.shift(); loaded++; updateStatus(); }
    }
    ctx.save(); ctx.translate(P.ox, P.oy); ctx.scale(s, s);
    (reduce ? [{ t: 0.3, c: BAG[0] }, { t: 0.7, c: BAG[2] }] : bags).forEach(function (b) {
      var x = lerp(-13.6, -4.9, b.t), y = lerp(G - 2.3, 3.8, b.t);
      ctx.fillStyle = b.c; ctx.beginPath(); ctx.roundRect(x - 0.45, y - 0.55, 0.9, 0.6, 0.12); ctx.fill();
    });
    var waiting = reduce ? 4 : 6 - (loaded % 7);
    for (var i = 0; i < waiting; i++) {
      var bx = (i < 3 ? -24.1 : -28.8) + (i % 3) * 1.1;
      ctx.fillStyle = BAG[(i + 3) % BAG.length]; ctx.beginPath(); ctx.roundRect(bx, G - 1.75, 0.9, 0.7, 0.12); ctx.fill();
    }
    ctx.restore();

    function at(x, y) { return [P.ox + x * s, P.oy + y * s]; }
    var k = reduce ? 0 : now % 1250, st = reduce ? 0 : now % 1500;
    var beacon = reduce || k < 130, strobe = !reduce && (st < 55 || (st > 170 && st < 225));
    var r = Math.max(1.4, s * 0.22), halo = Math.max(9, s * 2.4);
    var L = at(-49.3, -2.05), R = at(49.3, -2.05), top = at(0, -5.85), bot = at(0, 5.8), lb = at(-15.9, G - 3.35);
    light(L[0], L[1], r, 'rgb(40, 235, 130)', true, halo);      // starboard, green, on the viewer's left
    light(R[0], R[1], r, 'rgb(255, 50, 40)', true, halo);       // port, red, on the viewer's right
    light(L[0] - r, L[1] + r * 0.3, r * 0.9, 'rgb(255, 255, 255)', strobe, halo * 1.6);
    light(R[0] + r, R[1] + r * 0.3, r * 0.9, 'rgb(255, 255, 255)', strobe, halo * 1.6);
    light(top[0], top[1], r, 'rgb(255, 40, 30)', beacon, halo * 1.3);
    light(bot[0], bot[1], r, 'rgb(255, 40, 30)', beacon, halo * 1.3);
    light(lb[0], lb[1], r * 0.8, 'rgb(255, 170, 30)', reduce || (now % 1000) < 500, halo * 0.8);
    // beacons on the distant tails, slower and out of phase
    [[0.08, 1], [0.2, 0.8], [0.93, 0.9]].forEach(function (t, i) {
      var on = reduce || ((now + i * 400) % 1800) < 110;
      light(W * t[0], P.hy - s * 3.4 * t[1] * 0.55, 1.2, 'rgb(255, 60, 50)', on, 6);
    });
  }

  function updateStatus() {
    if (!status) return;
    var n = loaded + (loaded === 1 ? ' bag' : ' bags');
    status.textContent = pageReady && loaded >= 3 ? 'Ready for boarding · ' + n + ' loaded' : 'Loading · ' + n + ' on board';
  }

  function loop(now) { frame(now); requestAnimationFrame(loop); }
  window.addEventListener('resize', resize);
  new MutationObserver(function () { colours(); drawStatic(); frame(performance.now(), true); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { colours(); drawStatic(); frame(performance.now(), true); });
  window.addEventListener('load', function () { setTimeout(function () { pageReady = true; updateStatus(); }, 2500); });
  resize(); updateStatus();
  if (!reduce) requestAnimationFrame(loop);
})();
