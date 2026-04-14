(function () {
  'use strict';

  /* ── Always start at top on reload ── */
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) window.scrollTo(0, 0);
  });

  var scrollIndicator = document.getElementById('scrollIndicator');
  var hero            = document.getElementById('hero');
  var heroImg         = document.getElementById('heroImg');
  var contactPanel    = document.getElementById('contactPanel');
  var ticking = false;
  var lastScrollY = 0;
  var introComplete = false;

  function isLiteMotion() {
    return window.innerWidth < 768 ||
      window.matchMedia('(pointer: coarse)').matches;
  }

  /*
    Intro: CSS transitions on #hero (filter + transform + opacity).
    Avoid animating filter from JS every frame — that repaints the full
    banner each frame and feels laggy on phones.
  */
  function startIntro() {
    if (hero) void hero.offsetHeight;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (hero) hero.classList.add('hero-intro-ready');
        setTimeout(function () {
          introComplete = true;
        }, 2200);
      });
    });
  }

  startIntro();

  /* Duplicate KaiM carousel items once for seamless CSS loop (smaller HTML) */
  document.querySelectorAll('[data-carousel-loop] .carousel-track').forEach(function (track) {
    var items = Array.prototype.slice.call(track.children);
    for (var j = 0; j < items.length; j++) {
      var c = items[j].cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    }
  });

  /* ═══════════════════════════════════════════════════════════
     PARALLAX SCROLL
     ═══════════════════════════════════════════════════════════ */
  var parallaxLayers = [];
  document.querySelectorAll('[data-parallax]').forEach(function (el) {
    parallaxLayers.push({
      el: el,
      speed: parseFloat(el.getAttribute('data-parallax')) || 0.1
    });
  });

  function onScroll() {
    lastScrollY = window.scrollY;
    if (!ticking) {
      requestAnimationFrame(tick);
      ticking = true;
    }
  }

  function tick() {
    ticking = false;

    if (scrollIndicator && introComplete) {
      scrollIndicator.style.opacity = String(Math.max(0, 1 - lastScrollY / 250));
    }

    updateHeroParallax();
    updateLayerParallax();
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  function updateHeroParallax() {
    if (!hero) return;
    var vh = window.innerHeight;
    var y = lastScrollY;
    if (y > vh * 1.3) return;

    var lite = isLiteMotion();
    var imgS = lite ? 1.12 : 1.15;
    var imgTy = lite ? 0.025 : 0.06;

    if (heroImg) {
      var s = imgS + y * (lite ? 0.00003 : 0.00008);
      heroImg.style.transform = 'scale(' + s + ') translate3d(0,' + (y * imgTy) + 'px,0)';
    }
  }

  function updateLayerParallax() {
    if (isLiteMotion()) return;
    var vh = window.innerHeight;
    for (var i = 0; i < parallaxLayers.length; i++) {
      var layer = parallaxLayers[i];
      var rect = layer.el.getBoundingClientRect();
      if (rect.top >= vh + 80 || rect.bottom <= -80) continue;
      var center = rect.top + rect.height * 0.5 - vh * 0.5;
      var norm = center / Math.max(vh, 1);
      layer.el.style.transform = 'translate3d(0,' + (norm * layer.speed * 52) + 'px,0)';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     3D TILT + SHIMMER ON CHANNEL CARDS
     ═══════════════════════════════════════════════════════════ */
  if (window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 640) {
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      var raf = null;

      card.addEventListener('mousemove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          var r = card.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width  - 0.5;
          var y = (e.clientY - r.top)  / r.height - 0.5;
          card.style.transform =
            'rotateY(' + (x * 14) + 'deg) ' +
            'rotateX(' + (-y * 14) + 'deg) ' +
            'scale3d(1.03, 1.03, 1.03)';
          raf = null;
        });
      });

      card.addEventListener('mouseleave', function () {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        card.style.transition = 'transform 0.4s ease';
        card.style.transform = '';
        setTimeout(function () { card.style.transition = ''; }, 400);
      });

      card.addEventListener('mouseenter', function () {
        card.style.transition = '';
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     ACCORDION
     ═══════════════════════════════════════════════════════════ */
  document.querySelectorAll('[data-role]').forEach(function (card) {
    var header = card.querySelector('.role-header');
    var drawer = card.querySelector('.role-drawer');
    if (!header || !drawer) return;

    function toggle() {
      var open = card.classList.contains('expanded');

      document.querySelectorAll('[data-role].expanded').forEach(function (o) {
        o.classList.remove('expanded');
        o.querySelector('.role-header').setAttribute('aria-expanded', 'false');
        o.querySelector('.role-drawer').style.maxHeight = '0';
      });

      if (!open) {
        card.classList.add('expanded');
        header.setAttribute('aria-expanded', 'true');
        drawer.style.maxHeight = drawer.scrollHeight + 'px';
      }
    }

    header.addEventListener('click', toggle);
    header.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  /* ═══════════════════════════════════════════════════════════
     APPLY → SCROLL TO CONTACT + GOLD PULSE
     ═══════════════════════════════════════════════════════════ */
  document.querySelectorAll('[data-apply]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!contactPanel) return;
      contactPanel.scrollIntoView({ behavior: 'smooth' });
      contactPanel.classList.remove('pulse-gold');
      void contactPanel.offsetWidth;
      contactPanel.classList.add('pulse-gold');
      contactPanel.addEventListener('animationend', function h() {
        contactPanel.classList.remove('pulse-gold');
        contactPanel.removeEventListener('animationend', h);
      });
    });
  });

  /* ── Initial scroll tick ── */
  onScroll();
})();
