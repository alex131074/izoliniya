/* Изолиния: 3D-рельеф с горизонталями и лазерным сканированием. Чистый WebGL, без библиотек, открывается двойным кликом. */
(function () {
  var cv = document.getElementById('gl3d'); if (!cv) return;
  var gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
  var ext = gl && gl.getExtension('OES_standard_derivatives');
  if (!gl || !ext) { document.documentElement.classList.add('no-gl'); return; }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- рельеф: сумма холмов и мелкий шум, высота 0..1 ---------- */
  var N = 150, AMP = 0.42;
  function hash(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  var HILLS = [[.35, -.25, .32, 1], [-.45, .2, .38, .75], [.1, .45, .25, .55], [-.1, -.55, .3, .5], [.62, .35, .22, .45]];
  function height(x, z) {
    var s = 0, k;
    for (k = 0; k < HILLS.length; k++) { var q = HILLS[k], dx = x - q[0], dz = z - q[1]; s += q[3] * Math.exp(-(dx * dx + dz * dz) / (2 * q[2] * q[2])); }
    s += (noise(x * 3 + 7, z * 3 + 3) - .5) * .22 + (noise(x * 7 + 1, z * 7 + 9) - .5) * .08;
    return Math.max(0, Math.min(1, s * .66 + .08));
  }
  var V = (N + 1) * (N + 1), pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), hh = new Float32Array(V), i, j, p = 0;
  var Hg = [];
  for (j = 0; j <= N; j++) { Hg[j] = []; for (i = 0; i <= N; i++) Hg[j][i] = height(i / N * 2 - 1, j / N * 2 - 1); }
  for (j = 0; j <= N; j++) for (i = 0; i <= N; i++) {
    var x = i / N * 2 - 1, z = j / N * 2 - 1, h = Hg[j][i];
    pos[p * 3] = x; pos[p * 3 + 1] = h * AMP; pos[p * 3 + 2] = z; hh[p] = h;
    var hl = Hg[j][Math.max(0, i - 1)], hr = Hg[j][Math.min(N, i + 1)], hd = Hg[Math.max(0, j - 1)][i], hu = Hg[Math.min(N, j + 1)][i];
    var nx = (hl - hr) * AMP, ny = 4 / N, nz = (hd - hu) * AMP, l = Math.hypot(nx, ny, nz);
    nor[p * 3] = nx / l; nor[p * 3 + 1] = ny / l; nor[p * 3 + 2] = nz / l; p++;
  }
  var idx = new Uint16Array(N * N * 6), q = 0;
  for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
    var a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }

  /* ---------- шейдеры ---------- */
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute float aH;uniform mat4 uVP;varying vec3 vP;varying vec3 vN;varying float vH;' +
    'void main(){vP=aP;vN=aN;vH=aH;gl_Position=uVP*vec4(aP,1.);}';
  var FS = '#extension GL_OES_standard_derivatives : enable\nprecision highp float;varying vec3 vP;varying vec3 vN;varying float vH;' +
    'uniform float uScan;uniform float uOn;uniform vec3 uEye;' +
    'void main(){vec3 N=normalize(vN);float dif=max(dot(N,normalize(vec3(-.45,.8,.35))),0.);' +
    'vec3 base=mix(vec3(.05,.10,.16),vec3(.10,.21,.31),vH)*(.5+.65*dif);' +
    'float c=vH*24.;float w=fwidth(c);float ln=1.-smoothstep(0.,w*1.3,abs(fract(c-.5)-.5));' +
    'float c5=c/5.;float w5=fwidth(c5);float mj=1.-smoothstep(0.,w5*1.6,abs(fract(c5-.5)-.5));' +
    'vec3 cy=vec3(.353,.82,.902);vec3 col=base+cy*(ln*.32+mj*.7);' +
    'float sx=(vP.x+1.)*.5;float d=sx-uScan;float band=exp(-d*d*1400.)*uOn;float done=step(sx,uScan)*uOn;' +
    'vec2 g=vP.xz*28.;vec2 gw=fwidth(g);vec2 gg=1.-smoothstep(vec2(0.),gw*1.3,abs(fract(g-.5)-.5));float grid=max(gg.x,gg.y);' +
    'col+=vec3(1.,.48,.24)*band*1.5+cy*grid*done*.4;' +
    'float fog=smoothstep(1.5,3.7,length(vP-uEye));col=mix(col,vec3(.043,.086,.133),fog*.85);' +
    'float e=smoothstep(1.,.72,max(abs(vP.x),abs(vP.z)));gl_FragColor=vec4(col*e,e);}';
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o; }
  var pr;
  try { pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw 0; }
  catch (e) { document.documentElement.classList.add('no-gl'); return; }
  gl.useProgram(pr);
  function buf(data, name, size) {
    var bo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  buf(pos, 'aP', 3); buf(nor, 'aN', 3); buf(hh, 'aH', 1);
  var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  var U = { vp: gl.getUniformLocation(pr, 'uVP'), scan: gl.getUniformLocation(pr, 'uScan'), on: gl.getUniformLocation(pr, 'uOn'), eye: gl.getUniformLocation(pr, 'uEye') };
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  /* ---------- математика камеры ---------- */
  function persp(f, a, n, fa) { var t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; }
  function look(e, c) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz); xx /= l; xz /= l;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  }
  function mul(a, b) { var o = new Array(16), r, c; for (c = 0; c < 4; c++) for (r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }

  /* ---------- состояние ---------- */
  var W = 1, H = 1, live = true, raf = 0, last = 0, t = 0, scrollK = 0, mx = 0, my = 0, smx = 0, smy = 0;
  var scanOn = false, scanP = 0, onK = 0, hCb = null, hT = 0;
  function size() {
    var r = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    W = Math.max(1, Math.round(w * r)); H = Math.max(1, Math.round(h * r));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
  }
  function frame(now) {
    raf = 0;
    var dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (!reduce) t += dt;
    var k = 1 - Math.exp(-dt * 4); smx += (mx - smx) * k; smy += (my - smy) * k;
    if (scanOn) { scanP += dt / 3.6; if (scanP > 1.25) scanP = 0; }
    onK += ((scanOn ? 1 : 0) - onK) * (reduce ? 1 : 1 - Math.exp(-dt * 3));
    size();
    var asp = W / H, wide = asp > 1.15;
    var ang = (reduce ? 0 : Math.sin(t * .12) * .22) + smx * .25 - .35;
    var dist = wide ? 2.35 : 2.9, ey = 1.25 + scrollK * .6 - smy * .15;
    var eye = [Math.sin(ang) * dist, ey, Math.cos(ang) * dist];
    var P = persp(wide ? .72 : .95, asp, .1, 20);
    if (wide) P[8] = -.42; /* рельеф правее текста */
    var M = mul(P, look(eye, [0, .12, 0]));
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.vp, false, new Float32Array(M));
    gl.uniform1f(U.scan, reduce && scanOn ? 1.3 : scanP); gl.uniform1f(U.on, onK); gl.uniform3f(U.eye, eye[0], eye[1], eye[2]);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    if (hCb && now - hT > 180) { hT = now; var sx = scanOn ? scanP : (smx * .5 + .5), gi = Math.round(Math.max(0, Math.min(1, sx)) * N); hCb(8 + Hg[N >> 1][gi] * 52); }
    if (live && !reduce || (Math.abs(onK - (scanOn ? 1 : 0)) > .01)) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  addEventListener('resize', kick);
  if (matchMedia('(hover:hover)').matches) addEventListener('pointermove', function (e) { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; kick(); }, { passive: true });

  window.G3 = {
    live: function (v) { if (v === live) return; live = v; last = 0; if (v) kick(); },
    scroll: function (v) { scrollK = v; if (reduce) kick(); },
    set: function (name, v) { if (name === 'scan') { scanOn = v; if (v) scanP = 0; kick(); } },
    onHeight: function (cb) { hCb = cb; }
  };
  kick();
})();
