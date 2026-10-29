/*! E-Drug Planet Pharmacy — Premium layer · edp-premium.js · v1.0
 *  Vanilla JS, no dependencies. Load with `defer` AFTER js/edp-motion.js.
 *  Modules: toast · heroSlider · spline (optional) · catalogue (search, details dialog,
 *  enquiry list, optional live products from Supabase, read-only).
 *  Nothing here takes payment or creates orders. The enquiry list ends in a WhatsApp message.
 */
(function () {
  'use strict';
  var doc = document, WA = '2348034637488';
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function mode() { return window.EDPMotion && window.EDPMotion.mode ? window.EDPMotion.mode() : 'full'; }
  function safe(fn) { try { fn(); } catch (e) { if (window.console) console.warn('[EDPPremium]', e); } }
  function wa(text) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text); }

  /* ---------------- Toast ---------------- */
  var region;
  function toast(msg, action) {
    region = region || $('#toasts'); if (!region) return;
    var t = doc.createElement('div'); t.className = 'toast';
    var s = doc.createElement('span'); s.textContent = msg; t.appendChild(s);
    if (action) {
      var b = doc.createElement('button'); b.type = 'button'; b.textContent = action.label;
      b.addEventListener('click', function () { action.run(); close(); }); t.appendChild(b);
    }
    function close() { t.classList.add('is-leaving'); setTimeout(function () { t.remove(); }, 260); }
    while (region.children.length > 2) region.firstChild.remove();
    region.appendChild(t); setTimeout(close, 4200);
  }

  /* ---------------- Hero slider ---------------- */
  function heroSlider() {
    var art = $('#heroStage'); if (!art) return;
    var slides = $$('.hero-slide', art), dots = $$('.hero-dot', art), pauseBtn = $('.hero-pause', art);
    if (slides.length < 2) return;
    var idx = 0, timer = 0, userPaused = false, hover = false, visible = true;
    function go(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) {
        var on = n === idx; s.classList.toggle('is-active', on);
        if (s.classList.contains('hero-slide--emblem')) s.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      dots.forEach(function (d, n) { d.setAttribute('aria-current', n === idx ? 'true' : 'false'); });
      art.setAttribute('data-slide', idx);
    }
    function canPlay() { return mode() !== 'off' && !userPaused && !hover && visible && !doc.hidden; }
    function schedule() { clearTimeout(timer); if (canPlay()) timer = setTimeout(function () { go(idx + 1); schedule(); }, 6500); }
    dots.forEach(function (d, n) { d.addEventListener('click', function () { go(n); schedule(); }); });
    if (pauseBtn) pauseBtn.addEventListener('click', function () {
      userPaused = !userPaused;
      pauseBtn.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
      pauseBtn.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
      pauseBtn.textContent = userPaused ? '▶' : '❚❚'; schedule();
    });
    art.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hover = true; schedule(); } });
    art.addEventListener('pointerleave', function () { hover = false; schedule(); });
    art.addEventListener('focusin', function () { hover = true; schedule(); });
    art.addEventListener('focusout', function () { hover = false; schedule(); });
    doc.addEventListener('visibilitychange', schedule);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; schedule(); }).observe(art);
    // Swipe (vertical scrolling is untouched: the stage uses touch-action: pan-y)
    var sx = null, sy = null;
    art.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') { sx = e.clientX; sy = e.clientY; } }, { passive: true });
    art.addEventListener('pointerup', function (e) {
      if (sx === null) return; var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) { go(idx + (dx < 0 ? 1 : -1)); schedule(); }
    }, { passive: true });
    art.addEventListener('pointercancel', function () { sx = null; }, { passive: true });
    var mq = matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.addEventListener) mq.addEventListener('change', schedule);
    go(0); schedule();
  }

  /* ---------------- Optional Spline scene ----------------
     Set data-spline-url="https://prod.spline.design/XXXX/scene.splinecode" on #heroStage.
     Loads only on full-motion, ≥900px wide screens; otherwise the CSS capsule stays. */
  function spline() {
    var art = $('#heroStage'); if (!art) return;
    var url = (art.getAttribute('data-spline-url') || '').trim();
    if (!url || mode() !== 'full' || !matchMedia('(min-width:900px)').matches) return;
    if (!/^https:\/\//.test(url)) return;
    var src = art.getAttribute('data-spline-script') || 'https://unpkg.com/@splinetool/viewer/build/spline-viewer.js';
    var s = doc.createElement('script'); s.type = 'module'; s.src = src;
    s.onload = function () {
      var host = doc.createElement('div'); host.className = 'hero-spline'; host.setAttribute('aria-hidden', 'true');
      var v = doc.createElement('spline-viewer'); v.setAttribute('url', url); v.setAttribute('loading-anim-type', 'none');
      host.appendChild(v); art.appendChild(host); art.classList.add('has-spline');
    };
    s.onerror = function () { /* keep the CSS capsule */ };
    doc.head.appendChild(s);
  }

  /* ---------------- Catalogue ---------------- */
  var CAT = { 'OTC Medicines': ['otc', '💊', 'OTC'], 'Vitamins & Supplements': ['wellness', '🌿', 'Wellness'], 'Skincare': ['skincare', '🧴', 'Personal care'],
              'Baby Care': ['baby', '🍼', 'Family'], 'First Aid': ['firstaid', '🩹', 'Preparedness'], 'Medical Devices': ['devices', '🩺', 'Home health'], 'Hygiene Products': ['hygiene', '🧼', 'Daily care'] };
  var items = [];
  try { items = JSON.parse(sessionStorage.getItem('edp-enquiry') || '[]').filter(function (x) { return typeof x === 'string'; }).slice(0, 40); } catch (e) { items = []; }

  function persist() { try { sessionStorage.setItem('edp-enquiry', JSON.stringify(items)); } catch (e) {} }
  function setMsg(text, err) { var m = $('#cartMessage'); if (!m) return; m.textContent = text || ''; m.classList.toggle('is-error', !!err); }
  function syncButtons() {
    $$('.add-enquiry').forEach(function (b) {
      var on = items.indexOf(b.dataset.item) > -1;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? 'In your list ✓' : 'Add to enquiry list +';
    });
  }
  function renderCart(bump) {
    var count = $('#cartCount'), box = $('#cartItems'), clear = $('#clearCart');
    if (count) {
      count.textContent = items.length + ' item' + (items.length === 1 ? '' : 's');
      if (bump) { count.classList.remove('is-bump'); void count.offsetWidth; count.classList.add('is-bump'); }
    }
    if (clear) clear.hidden = !items.length;
    if (box) {
      box.textContent = '';
      if (!items.length) { box.textContent = 'No items added yet. Use “Add to enquiry list” on any card.'; }
      else {
        var ul = doc.createElement('ul'); ul.className = 'cart-list'; ul.setAttribute('aria-label', 'Items in your enquiry list');
        items.forEach(function (name) {
          var li = doc.createElement('li'), sp = doc.createElement('span'), b = doc.createElement('button');
          sp.textContent = name; b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', 'Remove ' + name + ' from your list');
          b.addEventListener('click', function () { removeItem(name); });
          li.appendChild(sp); li.appendChild(b); ul.appendChild(li);
        });
        box.appendChild(ul);
      }
    }
    syncButtons();
  }
  function addItem(name) {
    if (items.indexOf(name) > -1) return;
    items.push(name); persist(); setMsg(''); renderCart(true);
    toast(name + ' added · ' + items.length + ' in your list', { label: 'View list', run: function () { var p = $('.cart-panel'); if (p) p.scrollIntoView({ behavior: mode() === 'off' ? 'auto' : 'smooth', block: 'center' }); } });
  }
  function removeItem(name) {
    items = items.filter(function (x) { return x !== name; }); persist(); renderCart(true);
    toast(name + ' removed');
  }
  function toggleItem(name) { if (items.indexOf(name) > -1) removeItem(name); else addItem(name); }

  function filterCatalog() {
    var grid = $('#catalogGrid'); if (!grid) return;
    var q = (($('#productSearch') || {}).value || '').trim().toLowerCase(), c = ($('#categoryFilter') || {}).value || 'all', shown = 0, total = 0;
    $$('.product', grid).forEach(function (card) {
      total++;
      var text = ((card.dataset.search || '') + ' ' + card.textContent).toLowerCase();
      var ok = text.indexOf(q) > -1 && (c === 'all' || card.dataset.category === c);
      card.hidden = !ok; if (ok) shown++;
    });
    var empty = $('#catalogEmpty'), status = $('#catalogStatus');
    if (empty) empty.hidden = shown !== 0 || !total;
    if (status) status.textContent = (q || c !== 'all') ? (shown ? shown + ' of ' + total + ' shown' : 'No matches') : '';
  }
  function resetFilters() { var s = $('#productSearch'), c = $('#categoryFilter'); if (s) s.value = ''; if (c) c.value = 'all'; filterCatalog(); if (s) s.focus(); }

  function sendList() {
    if (!items.length) { setMsg('Your list is empty. Add at least one item first.', true); toast('Add an item to your list first'); return; }
    var msg = 'Hello E-Drug Planet Pharmacy, please confirm availability and current prices for: ' + items.join(', ') + '. Please also advise delivery or pickup options and the approved payment process.';
    window.open(wa(msg), '_blank', 'noopener'); setMsg('WhatsApp opened with your list. Nothing is ordered or paid until the pharmacy confirms with you.');
  }

  /* details dialog */
  function openDetails(card) {
    var d = $('#productDialog'); if (!d || typeof d.showModal !== 'function') return;
    var name = ($('h3', card) || {}).textContent || '', desc = ($('p', card) || {}).textContent || '', note = ($('.price-note', card) || {}).textContent || '';
    var tag = ($('.tag', card) || {}).textContent || '', vis = $('.product-visual', card), btn = $('.add-enquiry', card);
    $('#pdTag').textContent = tag; $('#pdTitle').textContent = name; $('#pdDesc').textContent = desc; $('#pdNote').textContent = note;
    var v = $('#pdVisual'); v.textContent = '';
    var img = vis && $('img', vis); if (img) { var c = img.cloneNode(); v.appendChild(c); } else { v.textContent = vis ? vis.lastChild.textContent.trim() : '✚'; }
    var add = $('#pdAdd'), ask = $('#pdAsk'), rx = card.dataset.rx === '1';
    add.hidden = !btn; if (btn) { add.dataset.item = btn.dataset.item; }
    add.textContent = btn && items.indexOf(btn.dataset.item) > -1 ? 'Remove from list' : 'Add to enquiry list +';
    ask.href = wa('Hello E-Drug Planet Pharmacy, I would like to ask about: ' + name + '.');
    $('#pdRx').hidden = !rx && card.dataset.category !== 'otc';
    d.showModal();
  }

  /* live products (read-only), only when Supabase is configured */
  function liveProducts() {
    var url = window.EDP_SUPABASE_URL, key = window.EDP_SUPABASE_ANON_KEY, grid = $('#catalogGrid');
    if (!grid || !url || !key || /PASTE_/.test(url + key) || !/^https:\/\//.test(url)) return;
    var staticCards = $$('.product', grid);
    var skel = doc.createDocumentFragment();
    for (var i = 0; i < 4; i++) { var sk = doc.createElement('div'); sk.className = 'skeleton'; sk.setAttribute('data-skel', ''); skel.appendChild(sk); }
    grid.setAttribute('aria-busy', 'true'); staticCards.forEach(function (c) { c.hidden = true; }); grid.appendChild(skel);
    function restore() { $$('[data-skel]', grid).forEach(function (n) { n.remove(); }); staticCards.forEach(function (c) { c.hidden = false; }); grid.removeAttribute('aria-busy'); filterCatalog(); }
    var q = url.replace(/\/$/, '') + '/rest/v1/products?select=id,name,description,category,price_ngn,requires_prescription,image_url&order=name.asc&limit=200';
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 8000);
    fetch(q, { headers: { apikey: key, Authorization: 'Bearer ' + key }, signal: ctl.signal })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (rows) {
        clearTimeout(to);
        if (!Array.isArray(rows) || !rows.length) { restore(); return; }          // nothing published yet: keep category cards
        $$('[data-skel]', grid).forEach(function (n) { n.remove(); });
        staticCards.forEach(function (c) { c.remove(); });
        rows.forEach(function (p) { grid.appendChild(liveCard(p)); });
        grid.removeAttribute('aria-busy'); bindCards(); renderCart(); filterCatalog();
        if (window.EDPMotion) window.EDPMotion.refresh();
      })
      .catch(function () { clearTimeout(to); restore(); toast('Showing our category list. Live products are unavailable right now.'); });
  }
  function liveCard(p) {
    var m = CAT[p.category] || ['otc', '✚', 'Product'], a = doc.createElement('article');
    a.className = 'product reveal'; a.dataset.category = m[0]; a.dataset.search = [p.name, p.description, p.category].join(' ').toLowerCase();
    if (p.requires_prescription) a.dataset.rx = '1';
    var vis = doc.createElement('div'); vis.className = 'product-visual';
    var tag = doc.createElement('span'); tag.className = 'tag'; tag.textContent = m[2]; vis.appendChild(tag);
    if (typeof p.image_url === 'string' && /^https:\/\//.test(p.image_url)) {
      var im = doc.createElement('img'); im.src = p.image_url; im.alt = p.name; im.loading = 'lazy'; im.decoding = 'async'; im.referrerPolicy = 'no-referrer'; vis.appendChild(im);
    } else vis.appendChild(doc.createTextNode(m[1]));
    var h = doc.createElement('h3'); h.textContent = p.name;
    var d = doc.createElement('p'); d.textContent = p.description || 'Ask our team for details.';
    a.appendChild(vis); a.appendChild(h); a.appendChild(d);
    if (Number.isInteger(p.price_ngn)) { var pr = doc.createElement('p'); pr.className = 'price-live'; pr.textContent = '₦' + p.price_ngn.toLocaleString('en-NG'); a.appendChild(pr); }
    if (p.requires_prescription) { var rx = doc.createElement('span'); rx.className = 'rx-flag'; rx.textContent = 'Prescription required: pharmacist review'; a.appendChild(rx); }
    var db = doc.createElement('button'); db.type = 'button'; db.className = 'details-btn'; db.textContent = 'Details'; a.appendChild(db);
    var act = doc.createElement('div'); act.className = 'product-actions';
    if (p.requires_prescription) {
      var l = doc.createElement('a'); l.className = 'btn btn-soft'; l.target = '_blank'; l.rel = 'noopener';
      l.href = wa('Hello, I need the approved way to submit a prescription for: ' + p.name + '.'); l.textContent = 'Ask pharmacist ↗'; act.appendChild(l);
    } else {
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'btn btn-primary add-enquiry'; b.dataset.item = p.name; b.textContent = 'Add to enquiry list +'; act.appendChild(b);
    }
    a.appendChild(act);
    var n = doc.createElement('div'); n.className = 'price-note'; n.textContent = 'Availability and current price are confirmed by the pharmacy before any order.'; a.appendChild(n);
    return a;
  }

  function bindCards() {
    var grid = $('#catalogGrid'); if (!grid) return;
    $$('.product', grid).forEach(function (card) {
      if (card.dataset.bound) return; card.dataset.bound = '1';
      if (!$('.details-btn', card)) {                       // static cards get a Details button too
        var db = doc.createElement('button'); db.type = 'button'; db.className = 'details-btn'; db.textContent = 'Details';
        var acts = $('.product-actions', card); if (acts) card.insertBefore(db, acts); else card.appendChild(db);
      }
      $('.details-btn', card).addEventListener('click', function () { openDetails(card); });
      var add = $('.add-enquiry', card); if (add) add.addEventListener('click', function () { toggleItem(add.dataset.item); });
    });
  }

  function catalogue() {
    var s = $('#productSearch'), c = $('#categoryFilter');
    if (s) s.addEventListener('input', filterCatalog); if (c) c.addEventListener('change', filterCatalog);
    var rb = $('#resetFilters'); if (rb) rb.addEventListener('click', resetFilters);
    var send = $('#sendCart'); if (send) send.addEventListener('click', sendList);
    var clr = $('#clearCart'); if (clr) clr.addEventListener('click', function () { items = []; persist(); setMsg(''); renderCart(true); toast('Enquiry list cleared'); });
    var d = $('#productDialog');
    if (d) {
      $('#pdClose').addEventListener('click', function () { d.close(); });
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
      $('#pdAdd').addEventListener('click', function () { if (this.dataset.item) { toggleItem(this.dataset.item); d.close(); } });
    }
    bindCards(); renderCart(); filterCatalog(); liveProducts();
  }

  function boot() { safe(heroSlider); safe(spline); safe(catalogue); }
  window.EDPPremium = { toast: toast };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
