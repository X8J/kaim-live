(function () {
  'use strict';

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
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

  /* Cache device class — re-evaluated on resize instead of every frame */
  var liteMotion = checkLiteMotion();
  window.addEventListener('resize', function () {
    liteMotion = checkLiteMotion();
  }, { passive: true });

  function checkLiteMotion() {
    return window.innerWidth < 768 ||
      window.matchMedia('(pointer: coarse)').matches;
  }

  function startIntro() {
    if (hero) void hero.offsetHeight;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (hero) hero.classList.add('hero-intro-ready');
        setTimeout(function () { introComplete = true; }, 2200);
      });
    });
  }

  startIntro();

  /* Duplicate carousel items for seamless CSS loop */
  document.querySelectorAll('[data-carousel-loop] .carousel-track').forEach(function (track) {
    var items = Array.prototype.slice.call(track.children);
    for (var j = 0; j < items.length; j++) {
      var c = items[j].cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    }
  });

  /* Scroll-triggered reveal */
  var revealObserver = new IntersectionObserver(
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        entries[i].target.classList.toggle('is-visible', entries[i].isIntersecting);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
  );
  document.querySelectorAll('.scroll-reveal').forEach(function (el) {
    revealObserver.observe(el);
  });

  /* Parallax layers */
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
    if (!liteMotion) updateLayerParallax();
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  function updateHeroParallax() {
    if (!hero) return;
    var vh = window.innerHeight;
    if (lastScrollY > vh * 1.3) return;

    var imgS  = liteMotion ? 1.12 : 1.15;
    var imgTy = liteMotion ? 0.025 : 0.06;

    if (heroImg) {
      var s = imgS + lastScrollY * (liteMotion ? 0.00003 : 0.00008);
      heroImg.style.transform = 'scale(' + s + ') translate3d(0,' + (lastScrollY * imgTy) + 'px,0)';
    }
  }

  function updateLayerParallax() {
    var vh = window.innerHeight;
    for (var i = 0; i < parallaxLayers.length; i++) {
      var layer = parallaxLayers[i];
      var rect = layer.el.getBoundingClientRect();
      if (rect.top >= vh + 80 || rect.bottom <= -80) continue;
      var center = rect.top + rect.height * 0.5 - vh * 0.5;
      layer.el.style.transform = 'translate3d(0,' + (center / vh * layer.speed * 52) + 'px,0)';
    }
  }

  /* 3D tilt on channel cards (pointer devices only) */
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
            'rotateY(' + (x * 14) + 'deg) rotateX(' + (-y * 14) + 'deg) scale3d(1.03,1.03,1.03)';
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

  /* Role cards accordion */
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

  /* Apply → scroll to contact + pulse */
  document.querySelectorAll('[data-apply]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!contactPanel) return;
      contactPanel.scrollIntoView({ behavior: 'smooth' });
      contactPanel.classList.remove('pulse-gold');
      void contactPanel.offsetWidth;
      contactPanel.classList.add('pulse-gold');
      contactPanel.addEventListener('animationend', function () {
        contactPanel.classList.remove('pulse-gold');
      }, { once: true });
    });
  });

  onScroll();
})();
