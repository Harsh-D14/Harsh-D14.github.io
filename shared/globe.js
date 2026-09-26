/* Shared Earth renderer: the WebGL globe, the real sun position and the atmosphere.
   Used by the World view (world.js) and the Summary view background (summary-globe.js). No dependencies. */
(function () {
  var DEG = Math.PI / 180;
  var FOV = 30 * DEG;

  // Subsolar point for a moment in time (low precision solar position, good to a fraction of a degree).
  function subsolar(ms) {
    var d = ms / 86400000 + 2440587.5 - 2451545.0;
    var g = (357.529 + 0.98560028 * d) * DEG;
    var q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;
    var e = (23.439 - 0.00000036 * d) * DEG;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    var dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
    var lon = ra - gmst * 15 * DEG;
    lon = Math.atan2(Math.sin(lon), Math.cos(lon));
    return { lat: dec, lon: lon };
  }
  function vec(lat, lon) { return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]; }

  /* 3x3 row major rotations for the model */
  function mul3(a, b) {
    var r = [];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }
  function rx(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
  function ry(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
  function rz(a) { var c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
  function apply(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
  // Spin theta about the Earth's axis, tilt the axis by roll, then pitch the camera above or below the equator.
  function model(theta, pitch, roll) { return mul3(rx(pitch), mul3(rz(roll), ry(theta))); }

  var VS = [
    'attribute vec3 aPos; attribute vec2 aUV;',
    'uniform mat4 uMVP; uniform mat3 uModel;',
    'varying vec2 vUV; varying vec3 vN; varying vec3 vNView;',
    'void main() { vUV = aUV; vN = aPos; vNView = uModel * aPos; gl_Position = uMVP * vec4(aPos, 1.0); }'
  ].join('\n');
  var FS = [
    'precision highp float;',
    'uniform sampler2D uDay; uniform sampler2D uNight;',
    'uniform vec3 uSun; uniform vec3 uSunView; uniform vec3 uStudio; uniform float uSunMix;',
    'varying vec2 vUV; varying vec3 vN; varying vec3 vNView;',
    'void main() {',
    '  vec3 n = normalize(vN); vec3 nv = normalize(vNView);',
    '  vec3 day = texture2D(uDay, vUV).rgb;',
    '  vec3 night = texture2D(uNight, vUV).rgb;',
    '  // soft studio light for the plain spinning globe',
    '  vec3 studio = day * (0.62 + 0.5 * max(dot(nv, uStudio), 0.0));',
    '  // real sunlight: lit side, twilight band, city lights on the night side',
    '  float mu = dot(n, uSun);',
    '  float lit = smoothstep(-0.06, 0.1, mu);',
    '  vec3 sunlit = day * (0.18 + 1.0 * pow(max(mu, 0.0), 0.7));',
    '  float dusk = smoothstep(-0.1, 0.0, mu) * (1.0 - smoothstep(0.0, 0.18, mu));',
    '  vec3 lights = pow(night, vec3(1.4)) * vec3(1.5, 1.2, 0.8) * 1.5;',
    '  vec3 sun = mix(lights + day * 0.04, sunlit, lit) + vec3(1.0, 0.45, 0.15) * dusk * 0.1;',
    '  float water = smoothstep(0.03, 0.12, day.b - max(day.r, day.g));',
    '  vec3 h = normalize(uSunView + vec3(0.0, 0.0, 1.0));',
    '  sun += vec3(1.0, 0.95, 0.85) * pow(max(dot(nv, h), 0.0), 160.0) * water * lit * 0.35;',
    '  vec3 col = mix(studio, sun, uSunMix);',
    '  // blue haze towards the limb',
    '  float rim = pow(1.0 - max(nv.z, 0.0), 3.0);',
    '  float glow = mix(1.0, 0.15 + 0.85 * smoothstep(-0.25, 0.3, dot(nv, uSunView)), uSunMix);',
    '  col = mix(col, vec3(0.38, 0.62, 1.0) * glow, rim * 0.5);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function sphere(lat, lon) {
    var pos = [], uv = [], idx = [];
    for (var i = 0; i <= lat; i++) {
      var la = (90 - 180 * i / lat) * DEG;
      for (var j = 0; j <= lon; j++) {
        var lo = (-180 + 360 * j / lon) * DEG, p = vec(la, lo);
        pos.push(p[0], p[1], p[2]); uv.push(j / lon, i / lat);
      }
    }
    for (var a = 0; a < lat; a++) for (var b = 0; b < lon; b++) {
      var k = a * (lon + 1) + b;
      idx.push(k, k + lon + 1, k + 1, k + 1, k + lon + 1, k + lon + 2);
    }
    return { pos: new Float32Array(pos), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
  }

  function loadImage(src) {
    return new Promise(function (ok, fail) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = fail; i.src = src; });
  }

  /* create(canvas, { day, night }) returns a globe you lay out, load and draw.
     g.ok is false when the browser has no WebGL. */
  function create(canvas, opts) {
    var g = { ok: false, ready: false, W: 0, H: 0, dpr: 1, R: 0, CX: 0, CY: 0, dist: 4 };
    var gl = canvas.getContext('webgl', { antialias: true, alpha: true });
    if (!gl) return g;
    g.ok = true;

    function shader(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog = gl.createProgram(), loc = {};
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    ['uMVP', 'uModel', 'uDay', 'uNight', 'uSun', 'uSunView', 'uStudio', 'uSunMix'].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
    var s = sphere(64, 128), count = s.idx.length;
    [['aPos', s.pos, 3], ['aUV', s.uv, 2]].forEach(function (a) {
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a[1], gl.STATIC_DRAW);
      var l = gl.getAttribLocation(prog, a[0]); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, a[2], gl.FLOAT, false, 0, 0);
    });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, s.idx, gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);                 // the depth test hides the far side, no face culling needed
    gl.clearColor(0, 0, 0, 0);
    var st = [-0.5, 0.45, 0.74], sl = Math.hypot(st[0], st[1], st[2]);
    gl.uniform3f(loc.uStudio, st[0] / sl, st[1] / sl, st[2] / sl);

    function texture(img) {
      var max = gl.getParameter(gl.MAX_TEXTURE_SIZE), src = img;
      if (img.width > max) {
        var c = document.createElement('canvas'); c.width = max; c.height = max / 2;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); src = c;
      }
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var an = gl.getExtension('EXT_texture_filter_anisotropic');
      if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      return t;
    }

    var loading = null;
    g.load = function () {
      if (!loading) loading = Promise.all([loadImage(opts.day), loadImage(opts.night)]).then(function (imgs) {
        gl.activeTexture(gl.TEXTURE0); texture(imgs[0]);
        gl.activeTexture(gl.TEXTURE1); texture(imgs[1]);
        gl.uniform1i(loc.uDay, 0); gl.uniform1i(loc.uNight, 1);
        g.ready = true;
      });
      return loading;
    };

    // Size the canvas and place a globe of radius R pixels with its centre at CX, CY (CSS pixels).
    g.layout = function (W, H, dpr, R, CX, CY) {
      g.W = W; g.H = H; g.dpr = dpr; g.R = R; g.CX = CX; g.CY = CY;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      var t = R / ((1 / Math.tan(FOV / 2)) * (H / 2));
      g.dist = 1 / Math.sin(Math.atan(t));      // camera distance that gives an on-screen radius of R
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    // Where a point on the sphere lands on screen, and how much it faces the viewer (above 0 is the near side).
    g.project = function (m, p) {
      var v = apply(m, p), z = g.dist - v[2], f = 1 / Math.tan(FOV / 2);
      return { x: g.CX + (f * v[0] / z) * (g.H / 2), y: g.CY - (f * v[1] / z) * (g.H / 2), facing: v[2] - 1 / g.dist };
    };

    function mvp(m) {
      var f = 1 / Math.tan(FOV / 2), a = g.W / g.H, n = 0.1, fa = 100;
      var P = [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0];
      var MV = [m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, -g.dist, 1];
      var out = new Float32Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
        var sum = 0; for (var k = 0; k < 4; k++) sum += P[k * 4 + r] * MV[c * 4 + k]; out[c * 4 + r] = sum;
      }
      // shift in clip space so the globe centre sits at CX, CY rather than the middle of the canvas
      var ox = (g.CX - g.W / 2) / (g.W / 2), oy = -(g.CY - g.H / 2) / (g.H / 2);
      for (var c2 = 0; c2 < 4; c2++) { out[c2 * 4] += ox * out[c2 * 4 + 3]; out[c2 * 4 + 1] += oy * out[c2 * 4 + 3]; }
      return out;
    }

    // m: model rotation. sunEF: sun direction in Earth coordinates. sunMix: 0 studio light, 1 real sunlight.
    g.draw = function (m, sunEF, sunMix) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!g.ready) return;
      var sv = apply(m, sunEF);
      gl.uniformMatrix4fv(loc.uMVP, false, mvp(m));
      gl.uniformMatrix3fv(loc.uModel, false, new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]));
      gl.uniform3f(loc.uSun, sunEF[0], sunEF[1], sunEF[2]);
      gl.uniform3f(loc.uSunView, sv[0], sv[1], sv[2]);
      gl.uniform1f(loc.uSunMix, sunMix);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    };
    return g;
  }

  // Stars for a 2D backdrop canvas. density: stars per 1000 square CSS pixels. brightness scales the alpha.
  function stars(w, h, dpr, density, brightness) {
    var c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    var x = c.getContext('2d'), n = Math.round(w * h / 1000 * density);
    for (var i = 0; i < n; i++) {
      var b = Math.random(), sz = b > 0.93 ? 2 * dpr : dpr;
      x.fillStyle = 'rgba(220,230,255,' + (0.15 + b * b * 0.75) * brightness + ')';
      x.fillRect(Math.random() * c.width, Math.random() * c.height, sz, sz);
    }
    return c;
  }

  // Atmosphere around the globe on a 2D context in CSS pixels, brighter on the day side when sunlit.
  function halo(ctx, g, sunView, sunMix, strength) {
    var k = strength == null ? 1 : strength, CX = g.CX, CY = g.CY, R = g.R;
    var a = (0.34 * (1 - sunMix) + 0.12 * sunMix) * k;
    var g1 = ctx.createRadialGradient(CX, CY, R * 0.98, CX, CY, R * 1.16);
    g1.addColorStop(0, 'rgba(110,165,255,' + a + ')'); g1.addColorStop(1, 'rgba(110,165,255,0)');
    ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(CX, CY, R * 1.16, 0, Math.PI * 2); ctx.fill();
    if (sunMix > 0) {
      var sx = CX + sunView[0] * R * 0.06, sy = CY - sunView[1] * R * 0.06;
      var g2 = ctx.createRadialGradient(sx, sy, R * 0.99, sx, sy, R * 1.08);
      g2.addColorStop(0, 'rgba(140,190,255,' + 0.38 * sunMix * k + ')'); g2.addColorStop(1, 'rgba(140,190,255,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(sx, sy, R * 1.08, 0, Math.PI * 2); ctx.fill();
    }
  }

  window.HSMGlobe = { DEG: DEG, subsolar: subsolar, vec: vec, apply: apply, model: model, create: create, stars: stars, halo: halo };
})();
