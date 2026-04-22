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
  var contactInterested = document.getElementById('contactInterested');
  var applyDrawer     = document.getElementById('applyDrawer');
  var applyToggle     = document.getElementById('applyToggle');
  var applyForm       = document.getElementById('applyForm');
  var applyFormStatus = document.getElementById('applyFormStatus');
  var applyRoleSelect = document.getElementById('applyRole');
  var applyMessage    = document.getElementById('applyMessage');
  var applyWordCount  = document.getElementById('applyWordCount');
  var APPLY_MESSAGE_MIN_WORDS = 25;
  var APPLY_MESSAGE_MAX_WORDS = 250;
  var applySubmitArmed = false;
  var applyArmedSnapshot = null;
  var ticking = false;
  var lastScrollY = 0;
  var introComplete = false;

  /* Cache device class — re-evaluated on resize instead of every frame */
  var liteMotion = checkLiteMotion();
  window.addEventListener('resize', function () {
    liteMotion = checkLiteMotion();
  }, { passive: true });

  /* prefers-reduced-motion: read once + on change (avoid matchMedia in every scroll tick) */
  var prefersReducedMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var prefersReducedMotion = prefersReducedMQ ? prefersReducedMQ.matches : false;
  function onPrefersReducedChange() {
    prefersReducedMotion = prefersReducedMQ ? prefersReducedMQ.matches : false;
  }
  if (prefersReducedMQ && prefersReducedMQ.addEventListener) {
    prefersReducedMQ.addEventListener('change', onPrefersReducedChange);
  } else if (prefersReducedMQ && prefersReducedMQ.addListener) {
    prefersReducedMQ.addListener(onPrefersReducedChange);
  }

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

  /* Side-scroll marquee: clone row, then rAF + inline translateX (WAAPI/CSS keyframes were not moving on some builds). */
  function initVideoMarquee(root) {
    if (!root || root.getAttribute('data-video-marquee-ready') === '1') return;
    var track = root.querySelector('.video-marquee__track');
    var set = root.querySelector('.video-marquee__set');
    if (!track || !set) return;
    root.setAttribute('data-video-marquee-ready', '1');

    var dup = set.cloneNode(true);
    dup.setAttribute('aria-hidden', 'true');
    var dupLinks = dup.querySelectorAll('a');
    for (var d = 0; d < dupLinks.length; d++) dupLinks[d].setAttribute('tabindex', '-1');
    track.appendChild(dup);

    var imgs = track.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) imgs[i].loading = 'eager';

    var loopW = 0;
    var accumPx = 0;
    var lastNow = 0;
    var paused = false;
    /* Slightly slower when “reduce motion” is on — still scrolls, just gentler */
    var pxPerSec = prefersReducedMotion ? 26 : 44;

    function readLoopWidth() {
      void track.offsetWidth;
      void set.offsetWidth;
      var candidates = [];
      try {
        var r0 = set.getBoundingClientRect();
        var r1 = dup.getBoundingClientRect();
        var gap = r1.left - r0.left;
        if (gap >= 24 && isFinite(gap)) candidates.push(gap);
      } catch (e) { /* ignore */ }
      var wSet = set.scrollWidth;
      var wHalf = track.scrollWidth >= 48 ? track.scrollWidth / 2 : 0;
      if (wSet >= 24) candidates.push(wSet);
      if (wHalf >= 24) candidates.push(wHalf);
      if (!candidates.length) {
        var ow = set.offsetWidth;
        if (ow >= 24) candidates.push(ow);
      }
      if (!candidates.length) return 0;
      /* Floor + min: never use a loop length larger than the real repeat distance (avoids
       * translating past the first clone into empty track / black on mobile). */
      var w = Math.floor(Math.min.apply(null, candidates));
      return w >= 24 ? w : 0;
    }

    var marqueeRaf = null;
    function marqueeFrame(now) {
      marqueeRaf = null;
      if (document.hidden || !root.isConnected) return;

      if (!loopW) {
        loopW = readLoopWidth();
        lastNow = now;
        if (!loopW) {
          marqueeRaf = requestAnimationFrame(marqueeFrame);
          return;
        }
      }

      if (!paused) {
        accumPx += ((now - lastNow) / 1000) * pxPerSec;
      }
      lastNow = now;
      if (loopW > 0) {
        /* Wrap only when crossing a loop (avoid per-frame % jitter); clamp huge values for float safety. */
        if (accumPx >= loopW || accumPx > loopW * 20) {
          accumPx = ((accumPx % loopW) + loopW) % loopW;
        }
      }
      var x = loopW > 0 ? accumPx : 0;
      track.style.transform = 'translate3d(' + (-x) + 'px, 0, 0)';
      marqueeRaf = requestAnimationFrame(marqueeFrame);
    }

    function scheduleMarqueeFrame() {
      if (document.hidden || !root.isConnected) return;
      if (marqueeRaf != null) return;
      marqueeRaf = requestAnimationFrame(marqueeFrame);
    }

    /* Defer first measurement so mobile layout + eager images have settled before loopW locks. */
    var startDelayMs = liteMotion ? 400 : 200;
    requestAnimationFrame(function () {
      setTimeout(function () {
        scheduleMarqueeFrame();
      }, startDelayMs);
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && root.isConnected) scheduleMarqueeFrame();
    });

    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
      root.addEventListener('mouseenter', function () { paused = true; });
      root.addEventListener('mouseleave', function () { paused = false; });
    }

    var roTimer = null;
    function invalidateWidth() {
      loopW = 0;
      /* On mobile/coarse pointer, remeasure can lag card width; reset scroll offset so % loopW
       * cannot drift into dead space. Desktop keeps accumPx to avoid a visible hitch during
       * staggered card entrance (ResizeObserver churn during opacity/transform). */
      if (liteMotion) accumPx = 0;
    }
    if (window.ResizeObserver) {
      /* Observe track only: observing the inner set fires during card opacity/transform stagger
       * and thrashes loopW, which caused visible flicker on the rail. */
      new ResizeObserver(function () {
        if (roTimer) clearTimeout(roTimer);
        roTimer = setTimeout(function () {
          roTimer = null;
          invalidateWidth();
        }, 180);
      }).observe(track);
    }
    window.addEventListener('load', invalidateWidth, { once: true });
  }

  const YT_DATA_URL = '/public/yt-data.json';

  /** Live sync values never show trailing +; strip any trailing + from JSON or prior state. */
  function normalizeLiveViewLabel(s) {
    if (s == null) return '';
    return String(s).replace(/\++$/, '').trim();
  }

  /** When fetch fails: keep existing DOM counts and mark them with + (at least this high since last sync). */
  function markStaleViewLabelsWithPlus() {
    document
      .querySelectorAll('[data-kaim-total-views], [data-kaiaim-total-views], [data-video-views]')
      .forEach(function (el) {
        var t = (el.textContent || '').trim();
        if (!t) return;
        if (/\+$/.test(t)) return;
        el.textContent = t + '+';
      });
  }

  /** KaiAim: 1 tile = solo (no horizontal strip); 2–6 = scrollable row. No marquee. */
  function renderKaiaimRail(videos) {
    var rail = document.querySelector('[data-kaiaim-video-rail]');
    if (!rail) return;
    if (!Array.isArray(videos)) return;

    var rows = [];
    for (var j = 0; j < videos.length; j++) {
      var v = videos[j];
      if (v && v.videoId) rows.push(v);
    }
    if (rows.length === 0) return;

    rail.classList.toggle('video-static--multi', rows.length > 1);
    while (rail.firstChild) rail.removeChild(rail.firstChild);

    var solo = rows.length === 1;
    for (var i = 0; i < rows.length; i++) {
      var video = rows[i];
      var a = document.createElement('a');
      a.className = solo ? 'video-card video-card--solo' : 'video-card';
      a.href = 'https://www.youtube.com/watch?v=' + video.videoId;
      a.target = '_blank';
      a.rel = 'noopener';
      var rank = typeof video.rank === 'number' ? video.rank : i + 1;
      a.setAttribute('data-video-rank', String(rank));

      var badge = document.createElement('span');
      badge.className = 'video-card__views';
      badge.setAttribute('data-video-views', '');
      if (video.viewCountFormatted != null) {
        badge.textContent = normalizeLiveViewLabel(video.viewCountFormatted);
      }

      var img = document.createElement('img');
      img.setAttribute('data-video-thumb', '');
      if (video.thumbnail) img.src = video.thumbnail;
      img.alt = video.title != null ? video.title : '';
      img.decoding = 'async';
      img.loading = solo && i === 0 ? 'eager' : 'lazy';

      var overlay = document.createElement('div');
      overlay.className = 'video-card__overlay';
      var titleEl = document.createElement('span');
      titleEl.className = 'video-card__title';
      titleEl.setAttribute('data-video-title', '');
      if (video.title != null) titleEl.textContent = video.title;
      overlay.appendChild(titleEl);

      a.appendChild(badge);
      a.appendChild(img);
      a.appendChild(overlay);
      rail.appendChild(a);
    }
  }

  function renderChannels(data) {
    if (!data?.channels) return;

    var kaimViews = data.channels.kaim && data.channels.kaim.totalViewsFormatted;
    var kaiaimViews = data.channels.kaiaim && data.channels.kaiaim.totalViewsFormatted;
    if (kaimViews) {
      var kClean = normalizeLiveViewLabel(kaimViews);
      document.querySelectorAll('[data-kaim-total-views]').forEach(function (el) {
        el.textContent = kClean;
      });
    }
    if (kaiaimViews) {
      var kaClean = normalizeLiveViewLabel(kaiaimViews);
      document.querySelectorAll('[data-kaiaim-total-views]').forEach(function (el) {
        el.textContent = kaClean;
      });
    }

    var videos = data.topVideos;
    if (Array.isArray(videos) && videos.length >= 6) {
      var marquee = document.querySelector('[data-video-marquee]');
      if (marquee) {
        for (var i = 0; i < videos.length; i++) {
          var video = videos[i];
          if (!video || !video.videoId) continue;
          var card = marquee.querySelector('[data-video-rank="' + video.rank + '"]');
          if (!card) continue;

          var thumb = card.querySelector('[data-video-thumb]');
          var badge = card.querySelector('[data-video-views]');
          var title = card.querySelector('[data-video-title]');

          if (thumb) {
            if (video.thumbnail) thumb.src = video.thumbnail;
            thumb.alt = video.title != null ? video.title : '';
          }
          if (badge && video.viewCountFormatted != null) {
            badge.textContent = normalizeLiveViewLabel(video.viewCountFormatted);
          }
          if (title && video.title != null) {
            title.textContent = video.title;
          }

          card.setAttribute('href', 'https://www.youtube.com/watch?v=' + video.videoId);
        }
      }
    }

    renderKaiaimRail(data.kaiaimTopVideos);
  }

  async function hydrateChannels() {
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, 10000);
    try {
      var res = await fetch(YT_DATA_URL, { signal: controller.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      renderChannels(data);
    } catch {
      console.warn('[kaim.live] YouTube data unavailable, using static fallback');
      markStaleViewLabelsWithPlus();
    } finally {
      clearTimeout(timeoutId);
      document.querySelectorAll('[data-video-marquee]').forEach(initVideoMarquee);
    }
  }

  hydrateChannels();

  /* Scroll-triggered reveal: hysteresis on intersection ratio so edge scroll does not
   * flip is-visible rapidly (channel + video card flicker). */
  var revealObserver = new IntersectionObserver(
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var el = entry.target;
        var ratio = typeof entry.intersectionRatio === 'number' ? entry.intersectionRatio : (entry.isIntersecting ? 1 : 0);
        var latched = el.getAttribute('data-reveal-latched') === '1';
        var next = latched;
        if (latched && ratio < 0.03) next = false;
        else if (!latched && entry.isIntersecting && ratio >= 0.1) next = true;
        if (next !== latched) {
          el.setAttribute('data-reveal-latched', next ? '1' : '0');
          el.classList.toggle('is-visible', next);
        }
      }
    },
    {
      rootMargin: '0px 0px -5% 0px',
      threshold: [0, 0.02, 0.04, 0.06, 0.1, 0.15, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
    }
  );
  document.querySelectorAll('.scroll-reveal').forEach(function (el) {
    revealObserver.observe(el);
  });

  /* Parallax layers — IntersectionObserver skips layout when off-screen */
  var parallaxLayers = [];
  var parallaxByEl = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  document.querySelectorAll('[data-parallax]').forEach(function (el) {
    var layer = {
      el: el,
      speed: parseFloat(el.getAttribute('data-parallax')) || 0.1
    };
    parallaxLayers.push(layer);
    if (parallaxByEl) parallaxByEl.set(el, layer);
  });
  if (window.IntersectionObserver && parallaxByEl && parallaxLayers.length) {
    var parallaxIO = new IntersectionObserver(
      function (entries) {
        var needParallaxTick = false;
        for (var e = 0; e < entries.length; e++) {
          var ent = entries[e];
          var L = parallaxByEl.get(ent.target);
          if (L) {
            L.visible = ent.isIntersecting;
            if (ent.isIntersecting) needParallaxTick = true;
          }
        }
        if (needParallaxTick && !liteMotion && !prefersReducedMotion) {
          lastScrollY = window.scrollY;
          if (!ticking) {
            ticking = true;
            requestAnimationFrame(tick);
          }
        }
      },
      { rootMargin: '120px 0px', threshold: 0 }
    );
    for (var pl = 0; pl < parallaxLayers.length; pl++) {
      parallaxIO.observe(parallaxLayers[pl].el);
    }
  }

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
    if (!liteMotion && !prefersReducedMotion) updateLayerParallax();
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  function updateHeroParallax() {
    if (!hero) return;
    var vh = window.innerHeight;
    if (lastScrollY > vh * 1.35) return;
    if (!heroImg) return;

    var imgS  = liteMotion ? 1.12 : 1.15;
    var imgTy = liteMotion ? 0.025 : 0.06;
    var s = imgS + lastScrollY * (liteMotion ? 0.00003 : 0.00008);
    heroImg.style.transform = 'scale(' + s + ') translate3d(0,' + (lastScrollY * imgTy) + 'px,0)';
  }

  function updateLayerParallax() {
    var vh = window.innerHeight;
    for (var i = 0; i < parallaxLayers.length; i++) {
      var layer = parallaxLayers[i];
      if (layer.visible === false) {
        layer.el.style.transform = '';
        continue;
      }
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
        var oh = o.querySelector('.role-header');
        var od = o.querySelector('.role-drawer');
        if (oh) oh.setAttribute('aria-expanded', 'false');
        if (od) od.style.maxHeight = '0';
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

  /* Closed positions: one summary row, expand to show past roles */
  var closedToggle = document.querySelector('[data-closed-toggle]');
  var closedRolesRoot = closedToggle ? closedToggle.closest('[data-closed-roles]') : null;
  var closedPanel = document.getElementById('closedRolesPanel');

  function collapseClosedRoleCards() {
    if (!closedPanel) return;
    closedPanel.querySelectorAll('[data-role].expanded').forEach(function (c) {
      c.classList.remove('expanded');
      var hdr = c.querySelector('.role-header');
      var drw = c.querySelector('.role-drawer');
      if (hdr) hdr.setAttribute('aria-expanded', 'false');
      if (drw) drw.style.maxHeight = '0';
    });
  }

  function setClosedRolesOpen(open) {
    if (!closedRolesRoot || !closedToggle || !closedPanel) return;
    closedRolesRoot.classList.toggle('is-open', open);
    closedToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    closedPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (!open) collapseClosedRoleCards();
  }

  if (closedToggle && closedRolesRoot && closedPanel) {
    closedToggle.addEventListener('click', function () {
      setClosedRolesOpen(!closedRolesRoot.classList.contains('is-open'));
    });
  }

  function setApplyDrawerOpen(open) {
    if (!applyDrawer || !applyToggle) return;
    applyDrawer.classList.toggle('is-open', open);
    applyToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    applyDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function focusApplyFormFirst() {
    if (!applyForm) return;
    var el = applyForm.querySelector('input:not(.apply-honeypot):not([type="hidden"]), textarea, select');
    if (el) el.focus();
  }

  function scrollInterestedHeadingToTop() {
    var el = contactInterested || (contactPanel && contactPanel.querySelector('h2'));
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function pulseContact() {
    if (!contactPanel) return;
    contactPanel.classList.remove('pulse-gold');
    void contactPanel.offsetWidth;
    contactPanel.classList.add('pulse-gold');
    contactPanel.addEventListener('animationend', function () {
      contactPanel.classList.remove('pulse-gold');
    }, { once: true });
  }

  function openApplyFromRoles(roleName) {
    if (!contactPanel) return;
    resetApplySubmitArm();
    scrollInterestedHeadingToTop();
    pulseContact();
    setApplyDrawerOpen(true);
    if (applyRoleSelect && roleName) {
      for (var i = 0; i < applyRoleSelect.options.length; i++) {
        if (applyRoleSelect.options[i].value === roleName) {
          applyRoleSelect.selectedIndex = i;
          break;
        }
      }
    }
    setTimeout(focusApplyFormFirst, 400);
  }

  if (applyToggle && applyDrawer) {
    applyToggle.addEventListener('click', function () {
      var open = !applyDrawer.classList.contains('is-open');
      if (open) scrollInterestedHeadingToTop();
      setApplyDrawerOpen(open);
      if (open) focusApplyFormFirst();
      if (applyFormStatus) {
        applyFormStatus.textContent = '';
        applyFormStatus.classList.remove('is-error', 'is-success', 'is-pending');
      }
      resetApplySubmitArm();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (applyDrawer && applyDrawer.classList.contains('is-open')) {
      setApplyDrawerOpen(false);
      resetApplySubmitArm();
      if (applyToggle) applyToggle.focus();
      return;
    }
    if (closedRolesRoot && closedPanel && closedRolesRoot.classList.contains('is-open')) {
      if (!closedPanel.contains(document.activeElement) && document.activeElement !== closedToggle) return;
      setClosedRolesOpen(false);
      if (closedToggle) closedToggle.focus();
    }
  });

  document.querySelectorAll('[data-apply]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openApplyFromRoles(btn.getAttribute('data-apply-role') || '');
    });
  });

  function countWords(text) {
    var t = (text || '').trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }

  function getApplyFormSnapshot() {
    if (!applyForm) return '';
    var name = applyForm.querySelector('[name="name"]');
    var email = applyForm.querySelector('[name="email"]');
    var role = applyForm.querySelector('[name="role"]');
    var portfolio = applyForm.querySelector('[name="portfolio"]');
    var msg = applyForm.querySelector('[name="message"]');
    return [
      name && name.value,
      email && email.value,
      role && role.value,
      portfolio && portfolio.value,
      msg && msg.value
    ].join('\x1e');
  }

  function resetApplySubmitArm() {
    applySubmitArmed = false;
    applyArmedSnapshot = null;
    if (!applyForm) return;
    var submitBtn = applyForm.querySelector('.apply-submit');
    if (submitBtn) {
      submitBtn.textContent = submitBtn.getAttribute('data-default-label') || 'Send application';
      submitBtn.classList.remove('apply-submit-confirm');
    }
  }

  function isValidPortfolioUrl(raw) {
    var p = (raw || '').trim();
    if (!p || p.length < 4) return false;
    try {
      var u = new URL(/^https?:\/\//i.test(p) ? p : 'https://' + p);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      var h = u.hostname;
      if (!h || h.indexOf('.') === -1) return false;
      var parts = h.split('.').filter(function (s) { return s.length > 0; });
      if (parts.length < 2) return false;
      var tld = parts[parts.length - 1];
      if (tld.length < 2) return false;
      if (h.replace(/\./g, '').length < 3) return false;
      return true;
    } catch (err) {
      return false;
    }
  }

  function validateApplyForm() {
    if (!applyForm) return { ok: false, message: 'Form missing.' };
    var name = applyForm.querySelector('[name="name"]');
    var email = applyForm.querySelector('[name="email"]');
    var role = applyForm.querySelector('[name="role"]');
    var portfolio = applyForm.querySelector('[name="portfolio"]');
    if (!name || !String(name.value).trim()) {
      return { ok: false, message: 'Please enter your name.' };
    }
    var em = email && String(email.value).trim();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return { ok: false, message: 'Please enter a valid email address.' };
    }
    if (!role || !String(role.value).trim()) {
      return { ok: false, message: 'Please select a role.' };
    }
    if (!portfolio || !String(portfolio.value).trim()) {
      return { ok: false, message: 'Please add a portfolio or relevant link.' };
    }
    if (!isValidPortfolioUrl(portfolio.value)) {
      return { ok: false, message: 'Portfolio must be a real link with a domain (e.g. yoursite.com)' };
    }
    var words = countWords(applyMessage ? applyMessage.value : '');
    if (words < APPLY_MESSAGE_MIN_WORDS) {
      return { ok: false, message: 'Message must be at least ' + APPLY_MESSAGE_MIN_WORDS + ' words.' };
    }
    if (words > APPLY_MESSAGE_MAX_WORDS) {
      return { ok: false, message: 'Message must be ' + APPLY_MESSAGE_MAX_WORDS + ' words or fewer.' };
    }
    return { ok: true, message: '' };
  }

  function updateApplyWordCount() {
    if (!applyMessage || !applyWordCount || !applyForm) return;
    var n = countWords(applyMessage.value);
    applyWordCount.textContent = n + ' / ' + APPLY_MESSAGE_MAX_WORDS + ' words (min ' + APPLY_MESSAGE_MIN_WORDS + ')';
    var over = n > APPLY_MESSAGE_MAX_WORDS;
    var under = n < APPLY_MESSAGE_MIN_WORDS;
    applyWordCount.classList.toggle('is-over', over);
    applyWordCount.classList.toggle('is-under', under && n > 0);
    applyMessage.classList.toggle('apply-field-over-limit', over);
    applyMessage.classList.toggle('apply-field-under-limit', under && !over && n > 0);
    var wordsBlock = under || over;
    if (wordsBlock) resetApplySubmitArm();
    var submitBtn = applyForm.querySelector('.apply-submit');
    if (submitBtn) submitBtn.disabled = wordsBlock;
  }

  if (applyForm) {
    applyForm.addEventListener('input', function () {
      if (applySubmitArmed && applyArmedSnapshot !== null && getApplyFormSnapshot() !== applyArmedSnapshot) {
        resetApplySubmitArm();
        if (applyFormStatus) {
          applyFormStatus.textContent = '';
          applyFormStatus.classList.remove('is-error', 'is-success', 'is-pending');
        }
      }
      updateApplyWordCount();
    });
    applyForm.addEventListener('change', function () {
      if (applySubmitArmed && applyArmedSnapshot !== null && getApplyFormSnapshot() !== applyArmedSnapshot) {
        resetApplySubmitArm();
        if (applyFormStatus) {
          applyFormStatus.textContent = '';
          applyFormStatus.classList.remove('is-error', 'is-success', 'is-pending');
        }
      }
      updateApplyWordCount();
    });
    updateApplyWordCount();
  }

  if (applyForm && applyFormStatus) {
    applyForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var action = applyForm.getAttribute('action') || '';
      if (action.indexOf('REPLACE_ME') !== -1) {
        applyFormStatus.textContent = 'Form is not connected yet — replace REPLACE_ME in the form action with your Formspree form id.';
        applyFormStatus.classList.remove('is-success', 'is-pending');
        applyFormStatus.classList.add('is-error');
        return;
      }
      var check = validateApplyForm();
      if (!check.ok) {
        applyFormStatus.textContent = check.message;
        applyFormStatus.classList.remove('is-success', 'is-pending');
        applyFormStatus.classList.add('is-error');
        resetApplySubmitArm();
        return;
      }
      var submitBtn = applyForm.querySelector('.apply-submit');
      if (!applySubmitArmed) {
        applySubmitArmed = true;
        applyArmedSnapshot = getApplyFormSnapshot();
        if (submitBtn) {
          submitBtn.textContent = 'Click again to send';
          submitBtn.classList.add('apply-submit-confirm');
          submitBtn.disabled = false;
        }
        applyFormStatus.textContent = 'Click again to confirm and send your application.';
        applyFormStatus.classList.remove('is-error', 'is-success');
        applyFormStatus.classList.add('is-pending');
        return;
      }
      if (getApplyFormSnapshot() !== applyArmedSnapshot) {
        resetApplySubmitArm();
        applyFormStatus.textContent = 'Something changed — review the form and press Send twice again.';
        applyFormStatus.classList.remove('is-success', 'is-pending');
        applyFormStatus.classList.add('is-error');
        return;
      }
      var checkSend = validateApplyForm();
      if (!checkSend.ok) {
        applyFormStatus.textContent = checkSend.message;
        applyFormStatus.classList.remove('is-success', 'is-pending');
        applyFormStatus.classList.add('is-error');
        resetApplySubmitArm();
        return;
      }
      applySubmitArmed = false;
      applyArmedSnapshot = null;
      if (submitBtn) {
        submitBtn.textContent = submitBtn.getAttribute('data-default-label') || 'Send application';
        submitBtn.classList.remove('apply-submit-confirm');
        submitBtn.disabled = true;
      }
      applyFormStatus.textContent = 'Sending…';
      applyFormStatus.classList.remove('is-error', 'is-success', 'is-pending');
      fetch(action, {
        method: 'POST',
        body: new FormData(applyForm),
        headers: { Accept: 'application/json' }
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            applyFormStatus.textContent = 'Thanks — we’ll be in touch.';
            applyFormStatus.classList.add('is-success');
            applyForm.reset();
            resetApplySubmitArm();
            updateApplyWordCount();
          } else {
            throw new Error(data.error || 'Submit failed');
          }
        })
        .catch(function () {
          applyFormStatus.textContent = 'Could not send. Try again or use Discord.';
          applyFormStatus.classList.add('is-error');
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
          updateApplyWordCount();
        });
    });
  }

  onScroll();
})();
