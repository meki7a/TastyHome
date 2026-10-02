(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var onFavChange = null;

  /* ---------- тема ---------- */
  var tb = $('#theme');
  function isDark() { return root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
  function label() { tb.textContent = isDark() ? 'Светлая тема' : 'Тёмная тема'; }
  tb.addEventListener('click', function () {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('th', root.dataset.theme); } catch (e) {}
    label();
  });
  label();

  /* ---------- избранное ---------- */
  function getFav() { try { return JSON.parse(localStorage.getItem('fav') || '[]'); } catch (e) { return []; } }
  function setFav(a) { try { localStorage.setItem('fav', JSON.stringify(a)); } catch (e) {} }
  function paintFav() {
    var f = getFav();
    $$('.fav,.favbtn').forEach(function (b) {
      var on = f.indexOf(b.dataset.id) > -1;
      b.setAttribute('aria-pressed', on);
      if (b.classList.contains('favbtn')) b.querySelector('span').textContent = on ? 'В избранном' : 'В избранное';
    });
    var c = $('#favcnt'); if (c) c.textContent = f.length || '';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.fav,.favbtn');
    if (!b) return;
    var f = getFav(), i = f.indexOf(b.dataset.id);
    if (i > -1) f.splice(i, 1); else f.push(b.dataset.id);
    setFav(f); paintFav();
    b.classList.remove('beat'); void b.offsetWidth; b.classList.add('beat');
    if (onFavChange) onFavChange();
  });
  paintFav();

  /* ---------- плавное появление, прогресс, «наверх» ---------- */
  var rev = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el); el.classList.add('in');
        setTimeout(function () { el.classList.remove('reveal', 'in'); }, 1100);
      });
    }, { threshold: 0.12 });
    rev.forEach(function (el) { io.observe(el); });
  } else rev.forEach(function (el) { el.classList.remove('reveal'); });
  var bar = $('#progress'), up = $('#totop'), ticking = false;
  var onScroll = function () {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
    up.classList.toggle('show', window.scrollY > 600); ticking = false;
  };
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  up.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---------- главная: фильтр и поиск по ингредиентам ---------- */
  var grid = $('#grid');
  if (grid) {
    var cards = $$('.card', grid), sortSel = $('#sort'), firstRun = true, q = '', cat = 'Все', inp = $('#q'), chips = $$('.chip');
    var stem = function (w) {
      if (/^картошк/.test(w)) return 'картофел';
      return w.length > 5 ? w.slice(0, w.length - 2) : w.length > 3 ? w.slice(0, w.length - 1) : w;
    };
    var apply = function () {
      var fav = getFav(), shown = 0, scored = [];
      var terms = q.toLowerCase().split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      var multi = terms.length > 1;
      cards.forEach(function (c) {
        var ok = true, hits = 0, title = c.dataset.title.toLowerCase(), ing = c.dataset.ing;
        if (cat === 'Избранное') ok = fav.indexOf(c.dataset.id) > -1;
        else if (cat !== 'Все') ok = c.dataset.cat === cat;
        if (ok && terms.length) {
          terms.forEach(function (t) { var s = stem(t); if (title.indexOf(s) > -1 || ing.indexOf(s) > -1) hits++; });
          ok = hits > 0;
        }
        c._h = hits;
        var wasHidden = c.hidden; c.hidden = !ok;
        if (ok && wasHidden && !firstRun) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
        var m = $('.match', c);
        if (m) { m.hidden = !(ok && multi); if (ok && multi) m.textContent = 'Совпало ' + hits + ' из ' + terms.length; }
        if (ok) { shown++; scored.push([c, hits]); }
      });
      var order = cards.slice();
      if (sortSel.value === 'fast') order.sort(function (a, b) { return a.dataset.min - b.dataset.min; });
      else if (sortSel.value === 'az') order.sort(function (a, b) { return a.dataset.title.localeCompare(b.dataset.title, 'ru'); });
      if (multi) order = order.filter(function (c) { return !c.hidden; }).sort(function (a, b) { return b._h - a._h; }).concat(order.filter(function (c) { return c.hidden; }));
      order.forEach(function (c) { grid.appendChild(c); });
      firstRun = false;
      var em = $('#empty');
      em.hidden = shown > 0;
      em.textContent = cat === 'Избранное' && !terms.length
        ? 'Пока пусто. Нажмите сердечко на карточке рецепта, чтобы сохранить его здесь.'
        : 'Ничего не найдено. Измените запрос или выберите другую категорию.';
    };
    var setCat = function (c) {
      cat = c;
      chips.forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.c === cat); });
      apply();
    };
    chips.forEach(function (b) { b.addEventListener('click', function () { setCat(b.dataset.c); }); });
    sortSel.addEventListener('change', apply);
    inp.addEventListener('input', function () { q = inp.value; apply(); });
    onFavChange = function () { if (cat === 'Избранное') apply(); };
    window.addEventListener('hashchange', function () { if (location.hash === '#fav') setCat('Избранное'); });
    if (location.hash === '#fav') setCat('Избранное'); else apply();
  }

  /* ---------- страница рецепта ---------- */
  var rp = $('#recipe');
  if (rp) {
    var base = +rp.dataset.base, n = base, nEl = $('#n');
    var fmt = function (x, u) {
      var v = (u === 'г' || u === 'мл') && x >= 20 ? Math.round(x) : Math.round(x * 10) / 10;
      return String(v).replace('.', ',');
    };
    var plural = function (k, a, b, c) { var m = k % 100, d = k % 10; return m > 10 && m < 20 ? c : d === 1 ? a : d > 1 && d < 5 ? b : c; };
    var firstDraw = true;
    var draw = function () {
      nEl.textContent = n + ' ' + plural(n, 'порция', 'порции', 'порций');
      var k = n / base;
      $$('.q', rp).forEach(function (el) {
        var s = fmt(+el.dataset.a * k, el.dataset.u);
        if (el.dataset.b) s += '–' + fmt(+el.dataset.b * k, el.dataset.u);
        el.textContent = s;
        if (!firstDraw) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      });
    };
    $('#less').addEventListener('click', function () { if (n > 1) { n--; draw(); } });
    $('#more').addEventListener('click', function () { if (n < 24) { n++; draw(); } });
    draw(); firstDraw = false;
    $$('#ing li, .steps li', rp).forEach(function (li) {
      li.addEventListener('click', function (e) { if (!e.target.closest('.tm')) li.classList.toggle('done'); });
    });

    $('#print').addEventListener('click', function () { window.print(); });

    $('#copy').addEventListener('click', function () {
      var btn = this, span = $('span', btn), old = span.textContent;
      var lines = $$('#ing li').map(function (li) {
        return li.children[0].textContent + ' — ' + li.children[1].textContent.replace(/\s+/g, ' ').trim();
      });
      var text = $('h1').textContent + ' (' + nEl.textContent + ')\n' + lines.join('\n');
      var done = function () { span.textContent = 'Скопировано'; setTimeout(function () { span.textContent = old; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else fallback();
      function fallback() {
        var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        t.remove();
      }
    });

    /* таймеры */
    var tbox = $('#timers'), ctx = null;
    var beep = function () {
      try {
        if (ctx) {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.15;
          o.start(); setTimeout(function () { o.stop(); }, 700);
        }
      } catch (e) {}
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    };
    $$('.tm').forEach(function (b) {
      b.addEventListener('click', function () {
        try { var C = window.AudioContext || window.webkitAudioContext; if (!ctx && C) ctx = new C(); if (ctx && ctx.resume) ctx.resume(); } catch (e) {}
        var sec = +b.dataset.sec, name = b.dataset.label, end = Date.now() + sec * 1000;
        var el = document.createElement('div');
        el.className = 'timer';
        el.innerHTML = '<span></span><button type="button" aria-label="Закрыть таймер">×</button>';
        tbox.appendChild(el);
        var span = el.firstChild, iv;
        var tick = function () {
          var left = Math.max(0, Math.round((end - Date.now()) / 1000));
          span.textContent = name + ': ' + (left ? Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2) : 'готово!');
          if (!left && !el.classList.contains('done')) { el.classList.add('done'); clearInterval(iv); beep(); }
        };
        iv = setInterval(tick, 250); tick();
        el.lastChild.addEventListener('click', function () { clearInterval(iv); el.remove(); });
      });
    });
  }
})();
