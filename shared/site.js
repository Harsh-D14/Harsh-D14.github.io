/* Theme toggle, project filters and gallery. No dependencies. */
(function () {
  var root = document.documentElement;
  var KEY = 'hsm-theme';

  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  function current() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function label() {
    var next = current() === 'dark' ? 'light' : 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      var t = b.querySelector('.theme-toggle-text');
      if (t) t.textContent = next === 'dark' ? 'Dark' : 'Light';
    });
  }

  var forced = /(^|#)(light|dark)$/.exec(location.hash);
  var saved = read();
  if (forced) root.setAttribute('data-theme', forced[2]);
  else if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

  document.addEventListener('DOMContentLoaded', function () {
    label();
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.addEventListener('click', function () {
        var next = current() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        store(next);
        label();
      });
    });
    new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    /* Filters */
    var filterBtns = document.querySelectorAll('[data-filter]');
    var cards = document.querySelectorAll('[data-cat]');
    var status = document.getElementById('filter-status');
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.getAttribute('data-filter');
        var shown = 0;
        filterBtns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        cards.forEach(function (c) {
          var on = f === 'all' || c.getAttribute('data-cat') === f;
          c.hidden = !on;
          if (on) shown++;
        });
        if (status) status.textContent = 'Showing ' + shown + ' of ' + cards.length + ' projects';
      });
    });

    /* Gallery */
    var dlg = document.getElementById('gallery');
    if (!dlg) return;
    var img = dlg.querySelector('.gallery-img');
    var cap = dlg.querySelector('.gallery-caption');
    var count = dlg.querySelector('.gallery-count');
    var title = dlg.querySelector('.gallery-title');
    var thumbs = dlg.querySelector('.gallery-thumbs');
    var items = [], idx = 0, opener = null;

    function show(i) {
      idx = (i + items.length) % items.length;
      var it = items[idx];
      img.src = it.src;
      img.alt = it.caption;
      img.setAttribute('data-fit', it.fit);
      cap.textContent = it.caption;
      count.textContent = (idx + 1) + ' of ' + items.length;
      thumbs.querySelectorAll('button').forEach(function (b, j) {
        b.setAttribute('aria-current', j === idx ? 'true' : 'false');
      });
      dlg.querySelectorAll('.gallery-nav').forEach(function (b) { b.hidden = items.length < 2; });
    }

    document.querySelectorAll('[data-gallery]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        items = JSON.parse(btn.getAttribute('data-gallery'));
        title.textContent = btn.getAttribute('data-title');
        thumbs.innerHTML = '';
        items.forEach(function (it, j) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', 'Photo ' + (j + 1) + ': ' + it.caption);
          var t = document.createElement('img');
          t.src = it.src; t.alt = ''; t.loading = 'lazy';
          b.appendChild(t);
          b.addEventListener('click', function () { show(j); });
          thumbs.appendChild(b);
        });
        thumbs.hidden = items.length < 2;
        opener = btn;
        show(0);
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      });
    });

    dlg.querySelector('[data-prev]').addEventListener('click', function () { show(idx - 1); });
    dlg.querySelector('[data-next]').addEventListener('click', function () { show(idx + 1); });
    dlg.querySelector('[data-close]').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    dlg.addEventListener('close', function () { if (opener) opener.focus(); });
  });
})();
