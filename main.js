(function () {
  'use strict';

  /* ── Always start at top (disable browser scroll restoration on reload) ── */
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  function forceScrollTop() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
  forceScrollTop();
  requestAnimationFrame(function () {
    forceScrollTop();
    requestAnimationFrame(forceScrollTop);
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) forceScrollTop();
  });

  var scrollIndicator = document.getElementById('scrollIndicator');
  var parallaxTitle   = document.getElementById('parallaxTitle');
  var parallaxGhost   = document.getElementById('parallaxGhost');
  var hero            = document.getElementById('hero');
  var heroImg         = document.getElementById('heroImg');
  var heroOverlay     = document.querySelector('.hero-overlay');
  var contactPanel    = document.getElementById('contactPanel');
  var reducedMotion   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ticking = false;
  var lastScrollY = 0;

  /* ── Collect parallax layers ── */
  var parallaxLayers = [];
  document.querySelectorAll('[data-parallax]').forEach(function (el) {
    parallaxLayers.push({
      el: el,
      speed: parseFloat(el.getAttribute('data-parallax')) || 0.1
    });
  });

  /* ── RAF-throttled scroll handler ── */
  function onScroll() {
    lastScrollY = window.scrollY;
    if (!ticking) {
      requestAnimationFrame(tick);
      ticking = true;
    }
  }

  function tick() {
    ticking = false;

    if (scrollIndicator) {
      scrollIndicator.style.opacity = Math.max(0, 1 - lastScrollY / 200);
    }

    if (!reducedMotion) {
      updateTitleParallax();
      updateLayerParallax();
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Hero parallax: background, overlay, title & ghost at different depths ── */
  function updateTitleParallax() {
    if (!hero) return;
    var vh = window.innerHeight;
    var y = lastScrollY;
    var yCap = Math.min(y, vh * 1.15);
    var t = Math.min(1, yCap / Math.max(1, vh * 0.85));
    var ease = 1 - Math.pow(1 - t, 2.4);

    if (heroImg && heroImg.getAttribute('src')) {
      var imgY = yCap * 0.46;
      var scale = 1.05 + ease * 0.055;
      heroImg.style.transform = 'translate3d(0,' + imgY + 'px,0) scale(' + scale + ')';
    }

    if (heroOverlay) {
      heroOverlay.style.transform = 'translate3d(0,' + (yCap * 0.12) + 'px,0)';
    }

    if (y > vh * 1.25) return;

    if (parallaxTitle) {
      parallaxTitle.style.transform = 'translate3d(0,' + (y * 0.22) + 'px,0)';
    }
    if (parallaxGhost) {
      parallaxGhost.style.transform =
        'translate(-50%,-50%) translate3d(0,' + (y * 0.1) + 'px,0)';
    }
  }

  /* ── Section layers: viewport-centered offset for a floating feel ── */
  function updateLayerParallax() {
    var vh = window.innerHeight;
    for (var i = 0; i < parallaxLayers.length; i++) {
      var layer = parallaxLayers[i];
      var rect = layer.el.getBoundingClientRect();
      if (rect.top >= vh + 80 || rect.bottom <= -80) continue;
      var center = rect.top + rect.height * 0.5 - vh * 0.5;
      var norm = center / Math.max(vh, 1);
      var offset = norm * layer.speed * 52;
      layer.el.style.transform = 'translate3d(0,' + offset + 'px,0)';
    }
  }


  /* ── 3D tilt + shimmer on channel cards ── */
  if (!reducedMotion) {
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

  /* ── Accordion ── */
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

  /* ── Apply → scroll to contact + gold pulse ── */
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

  /* ── Initial tick ── */
  onScroll();
})();
