/*! E-Drug Planet Pharmacy — Motion layer · edp-motion.js · v1.0
 *  Vanilla JS, no dependencies (~7 KB unminified). Load with `defer` AFTER the site's own script.
 *  Never touches the theme toggle, links or business content; it only adds classes / CSS variables.
 *
 *  Modes (set on <html> as class edp-mode-*):
 *    full – everything        lite – Save-Data / low-memory devices (no loops, no tilt)
 *    off  – prefers-reduced-motion, or <html data-edp-motion="off">
 *  Public API: window.EDPMotion.refresh()  (call after injecting new .reveal / .product nodes)
 */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  var conn = navigator.connection || {};
  var LOW = !!(conn.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
               (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2));
  var cleanups = [], rafId = 0;

  function qs(s, r) { return (r || doc).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function on(t, type, fn, opt) { t.addEventListener(type, fn, opt); cleanups.push(function () { t.removeEventListener(type, fn, opt); }); }
  function safe(fn) { try { fn(); } catch (e) { if (window.console) console.warn('[EDPMotion]', e); } }
  function getMode() {
    var f = root.getAttribute('data-edp-motion');
    if (f === 'off' || mqReduce.matches) return 'off';
    if (f === 'lite' || LOW) return 'lite';
    return 'full';
  }

  /* ---------- Reveal: IntersectionObserver, stagger is set once as a CSS var ---------- */
  function reveal(mode) {
    var els = qsa('.reveal:not(.visible)');
    qsa('.reveal').forEach(function (el) {            // stagger by position inside its grid row
      var p = el.parentNode, sibs = qsa(':scope > .reveal', p), cols = 1;
      var tpl = getComputedStyle(p).gridTemplateColumns;
      if (tpl && tpl !== 'none') cols = tpl.split(' ').length;
      el.style.setProperty('--edp-d', ((sibs.indexOf(el) % cols) * 70) + 'ms');
    });
    if (mode === 'off' || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
    cleanups.push(function () { io.disconnect(); });
    var t = setTimeout(function () {                   // failsafe: anything on screen is shown
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) el.classList.add('visible');
      });
    }, 3000);
    cleanups.push(function () { clearTimeout(t); });
  }

  /* ---------- Hero: headline lines, emblem layers, pause when off-screen ---------- */
  function hero(mode) {
    var h1 = qs('.hero-copy h1');
    if (h1 && mode !== 'off' && !h1.classList.contains('edp-split')) {
      var lines = [[]];
      Array.prototype.slice.call(h1.childNodes).forEach(function (n) {
        if (n.nodeName === 'BR') lines.push([]); else lines[lines.length - 1].push(n);
      });
      var frag = doc.createDocumentFragment();
      lines.forEach(function (nodes, i) {
        var o = doc.createElement('span'), inner = doc.createElement('span');
        o.className = 'edp-line'; inner.style.setProperty('--l', i);
        nodes.forEach(function (n) { inner.appendChild(n); });
        o.appendChild(inner); frag.appendChild(o);
      });
      while (h1.firstChild) h1.removeChild(h1.firstChild);   // drop the now-redundant <br> nodes
      h1.appendChild(frag); h1.classList.add('edp-split');
    }
    var art = qs('.hero-art');
    if (!art) return;
    qsa('.orb,.cross', art).forEach(function (el) { el.setAttribute('aria-hidden', 'true'); }); // decorative glyphs
    if (!qs('.edp-orbit', art)) {
      var orbit = doc.createElement('span');
      orbit.className = 'edp-orbit'; orbit.setAttribute('aria-hidden', 'true');
      orbit.appendChild(doc.createElement('i'));
      art.appendChild(orbit);
    }
    if ('IntersectionObserver' in window) {            // no animation work while the hero is off-screen
      var io = new IntersectionObserver(function (es) {
        art.classList.toggle('is-paused', !es[0].isIntersecting);
      });
      io.observe(art); cleanups.push(function () { io.disconnect(); });
    }
  }

  /* ---------- Pointer (mouse/pen) tilt + touch press feedback, delegated ---------- */
  var FX = [
    { sel: '.hero-art', type: 'stage' },
    { sel: '.product', type: 'tilt' },
    { sel: '.category, .branch', type: 'spot' }
  ];
  function find(target) {
    if (!target || !target.closest) return null;
    for (var i = 0; i < FX.length; i++) {
      var el = target.closest(FX[i].sel);
      if (el) return { el: el, type: FX[i].type };
    }
    return null;
  }
  function pointer(mode) {
    var cur = null, last = null, pressed = null;
    function paint() {
      rafId = 0;
      if (!cur || !last) return;
      var r = cur.el.getBoundingClientRect(), x = last.clientX - r.left, y = last.clientY - r.top;
      var nx = x / r.width, ny = y / r.height, s = cur.el.style;
      if (cur.type === 'tilt') {
        s.setProperty('--ry', ((nx - 0.5) * 10).toFixed(2) + 'deg');
        s.setProperty('--rx', ((0.5 - ny) * 8).toFixed(2) + 'deg');
      } else if (cur.type === 'stage') {
        s.setProperty('--px', ((nx - 0.5) * 2).toFixed(3));
        s.setProperty('--py', ((ny - 0.5) * 2).toFixed(3));
      }
      s.setProperty('--mx', x.toFixed(0) + 'px');
      s.setProperty('--my', y.toFixed(0) + 'px');
    }
    function leave(c) {
      if (!c) return;
      c.el.classList.remove('is-tilting', 'is-pressed');
      ['--rx', '--ry', '--px', '--py'].forEach(function (p) { c.el.style.removeProperty(p); });
    }
    if (mode === 'full') {
      on(doc, 'pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var t = find(e.target);
        if (!cur || !t || t.el !== cur.el) { leave(cur); cur = t; if (cur) cur.el.classList.add('is-tilting'); }
        if (!cur) return;
        last = e; if (!rafId) rafId = requestAnimationFrame(paint);
      }, { passive: true });
      on(root, 'mouseleave', function () { leave(cur); cur = null; });
    }
    // Touch: a short "pressed" state with the light under the finger. Never blocks scrolling.
    on(doc, 'pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      var t = find(e.target); if (!t) return;
      var r = t.el.getBoundingClientRect();
      t.el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      t.el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
      if (t.type === 'stage') {
        t.el.style.setProperty('--px', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
        t.el.style.setProperty('--py', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
      }
      pressed = t; t.el.classList.add('is-pressed');
    }, { passive: true });
    function release() {
      var p = pressed; pressed = null;
      if (p) setTimeout(function () { leave(p); }, 160);
    }
    on(doc, 'pointerup', release, { passive: true });
    on(doc, 'pointercancel', release, { passive: true });   // fires when the user starts scrolling
  }

  /* ---------- Button ripple (delegated, no per-button listeners) ---------- */
  function buttons() {
    on(doc, 'pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('.btn');
      if (!b) return;
      var r = b.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      var d = Math.max(Math.hypot(x, y), Math.hypot(r.width - x, y), Math.hypot(x, r.height - y), Math.hypot(r.width - x, r.height - y));
      var s = doc.createElement('span');
      s.className = 'edp-ripple'; s.setAttribute('aria-hidden', 'true');
      s.style.cssText = 'width:' + d * 2 + 'px;height:' + d * 2 + 'px;left:' + (x - d) + 'px;top:' + (y - d) + 'px';
      s.addEventListener('animationend', function () { s.remove(); });
      b.appendChild(s);
    }, { passive: true });
  }

  /* ---------- Navigation: scrollspy, header state, menu accessibility ---------- */
  function nav(mode) {
    var header = qs('header'), links = qsa('#navlinks a[href^="#"]');
    if (header) {
      var tick = false;
      var onScroll = function () {
        if (tick) return; tick = true;
        requestAnimationFrame(function () { header.classList.toggle('is-scrolled', scrollY > 8); tick = false; });
      };
      on(window, 'scroll', onScroll, { passive: true }); onScroll();
    }
    if ('IntersectionObserver' in window && links.length) {
      var map = {}, live = {};
      links.forEach(function (a) { var t = qs(a.getAttribute('href')); if (t) map[a.getAttribute('href')] = { a: a, t: t }; });
      var keys = links.map(function (a) { return a.getAttribute('href'); }).filter(function (k) { return map[k]; });
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { live['#' + e.target.id] = e.isIntersecting; });
        var win = null; keys.forEach(function (k) { if (live[k]) win = k; });
        links.forEach(function (a) {
          var on_ = a.getAttribute('href') === win;
          a.classList.toggle('is-active', on_);
          if (on_) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      keys.forEach(function (k) { io.observe(map[k].t); });
      cleanups.push(function () { io.disconnect(); });
    }
    var menu = qs('#menuToggle'), list = qs('#navlinks');
    if (menu && list) {
      menu.setAttribute('aria-controls', 'navlinks');
      var sync = function () { menu.setAttribute('aria-expanded', list.classList.contains('open') ? 'true' : 'false'); };
      sync();
      var mo = new MutationObserver(sync); mo.observe(list, { attributes: true, attributeFilter: ['class'] });
      cleanups.push(function () { mo.disconnect(); });
      on(doc, 'keydown', function (e) {
        if (e.key === 'Escape' && list.classList.contains('open')) { list.classList.remove('open'); menu.focus(); }
      });
    }
  }

  /* ---------- Theme: observe only. The site's own toggle stays in charge. ---------- */
  function theme(mode) {
    var btn = qs('#themeToggle'); if (!btn || mode === 'off') return;
    var prev = root.dataset.theme;
    var mo = new MutationObserver(function () {
      if (root.dataset.theme === prev) return;
      prev = root.dataset.theme;
      btn.classList.add('is-spinning');
      btn.addEventListener('animationend', function f() { btn.classList.remove('is-spinning'); btn.removeEventListener('animationend', f); });
      var r = btn.getBoundingClientRect(), w = doc.createElement('div');
      w.className = 'edp-wash'; w.setAttribute('aria-hidden', 'true');
      w.style.setProperty('--x', (r.left + r.width / 2) + 'px'); w.style.setProperty('--y', (r.top + r.height / 2) + 'px');
      w.addEventListener('animationend', function () { w.remove(); });
      doc.body.appendChild(w);
    });
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    cleanups.push(function () { mo.disconnect(); });
  }

  /* ---------- Boot ---------- */
  function start() {
    var mode = getMode();
    root.classList.add('edp-js');
    root.classList.remove('edp-mode-full', 'edp-mode-lite', 'edp-mode-off');
    root.classList.add('edp-mode-' + mode);
    safe(function () { reveal(mode); });
    safe(function () { hero(mode); });
    if (mode !== 'off') {
      safe(function () { pointer(mode); });
      safe(buttons);
      safe(function () { theme(mode); });
    }
    safe(function () { nav(mode); });
  }
  function stop() {
    cleanups.forEach(function (fn) { safe(fn); }); cleanups = [];
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }
  function init() {
    start();
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', function () { stop(); start(); });
  }
  window.EDPMotion = { refresh: function () { stop(); start(); }, mode: getMode };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
