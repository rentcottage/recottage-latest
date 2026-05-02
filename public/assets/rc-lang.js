(function () {
  var LANGS = [
    { code: 'en', name: 'English' },
    { code: 'ka', name: 'ქართული' },
    { code: 'ru', name: 'Русский' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' }
  ];

  function setCookie(name, value, expires) {
    var base = name + '=' + value + '; path=/';
    if (expires) base += '; expires=' + expires;
    document.cookie = base;
    var host = location.hostname;
    if (host && host.indexOf('.') !== -1) {
      document.cookie = base + '; domain=.' + host;
    }
  }

  function setLang(code) {
    try { localStorage.setItem('rc_lang_chosen', '1'); } catch (e) {}
    if (code === 'en') {
      setCookie('googtrans', '', 'Thu, 01 Jan 1970 00:00:00 GMT');
    } else {
      setCookie('googtrans', '/en/' + code);
    }
    location.reload();
  }

  function buildButton() {
    var btn = document.createElement('button');
    btn.setAttribute('data-rc-mobile-lang', '');
    btn.setAttribute('aria-label', 'Select language');
    btn.className = 'w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer transition-colors';
    btn.innerHTML = '<i class="ri-global-line text-gray-700 text-xl"></i>';
    return btn;
  }

  function buildMenu() {
    var menu = document.createElement('div');
    menu.setAttribute('data-rc-mobile-lang-menu', '');
    menu.style.cssText = [
      'position:fixed',
      'right:1rem',
      'top:3.5rem',
      'background:white',
      'border:1px solid #e5e7eb',
      'border-radius:0.75rem',
      'box-shadow:0 10px 15px -3px rgba(0,0,0,0.15)',
      'padding:0.5rem 0',
      'z-index:9999',
      'display:none',
      'min-width:160px'
    ].join(';');
    LANGS.forEach(function (l) {
      var item = document.createElement('button');
      item.style.cssText = [
        'background:none',
        'border:none',
        'cursor:pointer',
        'width:100%',
        'text-align:left',
        'padding:0.625rem 1rem',
        'font-size:14px',
        'color:#374151',
        'font-family:inherit'
      ].join(';');
      item.textContent = l.name;
      item.addEventListener('mouseenter', function () { item.style.background = '#f3f4f6'; });
      item.addEventListener('mouseleave', function () { item.style.background = 'none'; });
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        setLang(l.code);
      });
      menu.appendChild(item);
    });
    return menu;
  }

  function inject() {
    var mobileNav = document.querySelector('.md\\:hidden.flex.items-center.gap-2');
    if (!mobileNav) return false;
    if (mobileNav.querySelector('[data-rc-mobile-lang]')) return true;

    var btn = buildButton();
    var menu = document.querySelector('[data-rc-mobile-lang-menu]') || buildMenu();
    if (!menu.parentNode) document.body.appendChild(menu);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', function () {
      menu.style.display = 'none';
    });

    mobileNav.insertBefore(btn, mobileNav.firstChild);
    return true;
  }

  function start() {
    inject();
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      inject();
      if (attempts > 40) clearInterval(iv);
    }, 250);

    var observer = new MutationObserver(function () { inject(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // ---- Georgian-only override: Check-in / In -> შესვლა, Check-out / Out -> გასვლა ----
  var CHECKIN_KA = 'შესვლა';
  var CHECKOUT_KA = 'გასვლა';

  function isKa() {
    return /googtrans=\/en\/ka/.test(document.cookie);
  }

  function applyOverride(el, fallbackOrig, kaText) {
    if (!el || el.nodeType !== 1) return;
    el.setAttribute('translate', 'no');
    if (el.classList && !el.classList.contains('notranslate')) {
      el.classList.add('notranslate');
    }
    if (!el.getAttribute('data-rc-orig') && fallbackOrig) {
      el.setAttribute('data-rc-orig', fallbackOrig);
    }
    var orig = el.getAttribute('data-rc-orig') || fallbackOrig;
    var want = isKa() ? kaText : orig;
    if (want && el.textContent !== want) {
      el.textContent = want;
    }
  }

  function fixDateLabels() {
    // Desktop labels: <div class="text-xs font-semibold text-gray-900 mb-1">…</div>
    // immediately followed by <input type="date">. First = Check-in, second = Check-out.
    var desktopLabels = [];
    var divs = document.querySelectorAll('div.text-xs.font-semibold.text-gray-900.mb-1');
    for (var i = 0; i < divs.length; i++) {
      var n = divs[i].nextElementSibling;
      if (n && n.tagName === 'INPUT' && n.type === 'date') {
        desktopLabels.push(divs[i]);
      }
    }
    if (desktopLabels[0]) applyOverride(desktopLabels[0], 'Check-in', CHECKIN_KA);
    if (desktopLabels[1]) applyOverride(desktopLabels[1], 'Check-out', CHECKOUT_KA);

    // Mobile labels: span.text-xs.font-bold.shrink-0 (not w-16) inside a
    // .flex.items-center.gap-2 container that also holds an input[type=date].
    // First = In, second = Out.
    var mobileLabels = [];
    var spans = document.querySelectorAll('span.text-xs.font-bold.text-gray-800.whitespace-nowrap.shrink-0');
    for (var j = 0; j < spans.length; j++) {
      if (spans[j].classList && spans[j].classList.contains('w-16')) continue;
      var c = spans[j].closest('.flex.items-center.gap-2');
      if (c && c.querySelector('input[type="date"]')) {
        mobileLabels.push(spans[j]);
      }
    }
    if (mobileLabels[0]) applyOverride(mobileLabels[0], 'In', CHECKIN_KA);
    if (mobileLabels[1]) applyOverride(mobileLabels[1], 'Out', CHECKOUT_KA);
  }

  function startCheckinOverride() {
    fixDateLabels();
    var obs = new MutationObserver(function () {
      fixDateLabels();
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startCheckinOverride);
  } else {
    startCheckinOverride();
  }
})();
