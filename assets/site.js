/* Изолиния: меню, вкладки, счётчики, карты проектов, появление блоков, форма, кнопка сканирования. Без библиотек. */
(function () {
  var FORM_ENDPOINT = ''; /* адрес приёма заявок – не подключён */
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* меню на телефоне */
  var burger = $('burger'), mnav = $('mnav');
  function menu(open) { burger.setAttribute('aria-expanded', open ? 'true' : 'false'); mnav.hidden = !open; }
  burger.addEventListener('click', function () { menu(mnav.hidden); });
  all('a', mnav).forEach(function (a) { a.addEventListener('click', function () { menu(false); }); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && !mnav.hidden) { menu(false); burger.focus(); } });

  /* вкладки «Вы – кто?»: мышь и стрелки */
  var tabs = all('.tabs [role=tab]');
  function pick(t, focus) {
    tabs.forEach(function (x) {
      var on = x === t; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
      $(x.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) t.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { pick(t); });
    t.addEventListener('keydown', function (e) {
      var k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); pick(tabs[(i + k + tabs.length) % tabs.length], true); }
    });
  });

  /* карты проектов: горизонтали рельефа, у каждого проекта свой рельеф */
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
  all('svg.map').forEach(function (svg) {
    var r = rnd(+svg.getAttribute('data-seed') * 7919 + 13), hills = [], k, NS = 'http://www.w3.org/2000/svg', g = '';
    for (k = 0; k < 4; k++) hills.push([40 + r() * 240, 30 + r() * 140, 30 + r() * 60, .5 + r() * .8]);
    function h(x, y) { var s = 0; hills.forEach(function (q) { var dx = x - q[0], dy = y - q[1]; s += q[3] * Math.exp(-(dx * dx + dy * dy) / (2 * q[2] * q[2])); }); return s; }
    /* marching squares по сетке 64×40 */
    var W = 64, H = 40, sx = 320 / W, sy = 200 / H, v = [], i, j, L;
    for (j = 0; j <= H; j++) { v[j] = []; for (i = 0; i <= W; i++) v[j][i] = h(i * sx, j * sy); }
    var lv, pts;
    var cut = function (p, q, x1, y1, x2, y2) { if ((p < lv) !== (q < lv)) { var t = (lv - p) / (q - p); pts.push([(x1 + (x2 - x1) * t) * sx, (y1 + (y2 - y1) * t) * sy]); } };
    for (L = 1; L <= 12; L++) {
      var d = ''; lv = L * 0.1;
      for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
        var a = v[j][i], b = v[j][i + 1], c = v[j + 1][i + 1], e = v[j + 1][i]; pts = [];
        cut(a, b, i, j, i + 1, j); cut(b, c, i + 1, j, i + 1, j + 1); cut(e, c, i, j + 1, i + 1, j + 1); cut(a, e, i, j, i, j + 1);
        if (pts.length >= 2) d += 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1) + 'L' + pts[1][0].toFixed(1) + ' ' + pts[1][1].toFixed(1);
        if (pts.length === 4) d += 'M' + pts[2][0].toFixed(1) + ' ' + pts[2][1].toFixed(1) + 'L' + pts[3][0].toFixed(1) + ' ' + pts[3][1].toFixed(1);
      }
      g += '<path d="' + d + '" stroke="' + (L % 5 ? 'rgba(90,209,230,.45)' : '#5ad1e6') + '" stroke-width="' + (L % 5 ? 1 : 1.6) + '" fill="none"/>';
    }
    /* граница участка и точки скважин */
    var px = 70 + r() * 60, py = 40 + r() * 40, pw = 120 + r() * 60, ph = 80 + r() * 30;
    g += '<rect x="' + px.toFixed(0) + '" y="' + py.toFixed(0) + '" width="' + pw.toFixed(0) + '" height="' + ph.toFixed(0) + '" fill="rgba(255,122,61,.08)" stroke="#ff7a3d" stroke-width="1.5" stroke-dasharray="6 4"/>';
    for (k = 0; k < 7; k++) g += '<circle cx="' + (px + 12 + r() * (pw - 24)).toFixed(0) + '" cy="' + (py + 12 + r() * (ph - 24)).toFixed(0) + '" r="3" fill="#ff7a3d"/>';
    svg.innerHTML = g;
  });

  /* появление блоков */
  if (!reduce && 'IntersectionObserver' in window) {
    var rise = all('.about figure,.facts li,.sec h2,.sec .sub,.eyebrow,.bento li,.panels,.tabs,.steps li,.case,.acc,.form,.con-l,.proof-g div');
    rise.forEach(function (el) { el.classList.add('rise'); });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    rise.forEach(function (el, n) { el.style.transitionDelay = (n % 4) * 60 + 'ms'; io.observe(el); });
  }

  /* счётчики в цифрах */
  var nums = all('[data-n]');
  function fmt(x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  if (!reduce && 'IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; co.unobserve(e.target);
        var el = e.target, to = +el.getAttribute('data-n'), suf = el.getAttribute('data-s') || '', t0 = performance.now();
        (function step(t) { var p = Math.min(1, (t - t0) / 1100), v = Math.round(to * (1 - Math.pow(1 - p, 3))); el.textContent = fmt(v) + suf; if (p < 1) requestAnimationFrame(step); })(t0);
      });
    }, { threshold: .6 });
    nums.forEach(function (el) { co.observe(el); });
  }

  /* 3D: живёт только на первом экране; кнопка сканирования */
  var hero = $('hero'), bar = $('bar'), contacts = $('contacts');
  function update() {
    var H = innerHeight, hr = hero.getBoundingClientRect(), cr = contacts.getBoundingClientRect();
    if (window.G3) { G3.live(hr.bottom > 0); G3.scroll(Math.max(0, Math.min(1, -hr.top / Math.max(1, hr.height)))); }
    bar.classList.toggle('on', hr.bottom < H * .3 && cr.top > H * .6);
  }
  var ticking = false;
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }, { passive: true });
  addEventListener('resize', update); update();

  var sb = $('scanBtn'), st = $('scanT'), ss = $('scanS'), on = false;
  if (!window.G3 || !G3.set) { sb.parentNode.hidden = true; }
  else sb.addEventListener('click', function () {
    on = !on; G3.set('scan', on); sb.setAttribute('aria-pressed', on ? 'true' : 'false');
    st.textContent = on ? 'Остановить сканирование' : 'Запустить сканирование';
    ss.textContent = on ? 'Сканер строит облако точек…' : 'Рельеф по горизонталям через 1 м';
  });
  if (window.G3 && G3.onHeight) G3.onHeight(function (h) { $('coord').textContent = '59.9386° N · 30.3141° E · H ' + h.toFixed(1).replace('.', ',') + ' м'; });

  /* форма: честно говорим, что заявки пока не принимаются */
  var form = $('form'), fm = $('formMsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ph = form.elements.phone, nm = form.elements.name, ag = form.elements.agree, okP = ph.value.replace(/\D/g, '').length >= 10;
    nm.classList.toggle('invalid', !nm.value.trim()); ph.classList.toggle('invalid', !okP); ag.parentNode.classList.toggle('invalid', !ag.checked);
    if (!nm.value.trim()) { fm.textContent = 'Укажите, как к вам обращаться.'; nm.focus(); return; }
    if (!okP) { fm.textContent = 'Укажите телефон, чтобы инженер мог перезвонить.'; ph.focus(); return; }
    if (!ag.checked) { fm.textContent = 'Нужно согласие на обработку данных.'; ag.focus(); return; }
    if (!FORM_ENDPOINT) { fm.innerHTML = 'Это концепт-сайт: заявки никуда не отправляются.'; return; }
    fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form) })
      .then(function (r) { if (!r.ok) throw 0; fm.textContent = 'Заявка принята. Инженер свяжется с вами в течение рабочего дня.'; form.reset(); })
      .catch(function () { fm.textContent = 'Заявка не отправилась, позвоните нам.'; });
  });
})();
