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
  var parallaxTitle   = document.getElementById('parallaxTitle');
  var parallaxGhost   = document.getElementById('parallaxGhost');
  var hero            = document.getElementById('hero');
  var heroImg         = document.getElementById('heroImg');
  var contactPanel    = document.getElementById('contactPanel');
  var ticking = false;
  var lastScrollY = 0;
  var introComplete = false;

  /* ═══════════════════════════════════════════════════════════
     INTRO ANIMATION — JS-driven rAF loop, no CSS transitions
     Total duration: 2 seconds
     ═══════════════════════════════════════════════════════════ */
  var INTRO_DURATION = 2000;

  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function runIntro() {
    var start = null;

    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / INTRO_DURATION);

      /* — Banner: blur 0→6, brightness 0.82→0.4 — */
      if (heroImg) {
        var bp = easeOutCubic(p);
        heroImg.style.filter =
          'blur(' + (bp * 6).toFixed(2) + 'px) brightness(' + (0.82 - bp * 0.42).toFixed(3) + ')';
      }

      /* — Title: whole word scales + fades as one unit — */
      if (parallaxTitle) {
        var tp = Math.max(0, Math.min(1, (p - 0.05) / 0.6));
        var te = easeOutQuart(tp);
        parallaxTitle.style.opacity = String(te);
        parallaxTitle.style.transform =
          'scale(' + (0.55 + te * 0.45).toFixed(4) + ') translateY(' + (24 * (1 - te)).toFixed(2) + 'px)';
      }

      /* — Ghost outline — */
      if (parallaxGhost) {
        var gp = Math.max(0, Math.min(1, (p - 0.15) / 0.55));
        parallaxGhost.style.opacity = String(easeOutCubic(gp));
      }

      /* — Scroll indicator — */
      if (scrollIndicator) {
        var sp = Math.max(0, Math.min(1, (p - 0.7) / 0.3));
        scrollIndicator.style.opacity = String(easeOutCubic(sp));
      }

      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        introComplete = true;
      }
    }

    requestAnimationFrame(frame);
  }

  runIntro();

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

    if (heroImg) {
      var s = 1.15 + y * 0.00008;
      heroImg.style.transform = 'scale(' + s + ') translate3d(0,' + (y * 0.06) + 'px,0)';
    }

    var heroContent = hero.querySelector('.hero-content');
    if (heroContent) {
      heroContent.style.transform = 'translate3d(0,' + (y * 0.28) + 'px,0)';
    }
    if (parallaxGhost) {
      parallaxGhost.style.transform =
        'translate(-50%,-50%) translate3d(0,' + (y * 0.12) + 'px,0)';
    }
  }

  function updateLayerParallax() {
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
