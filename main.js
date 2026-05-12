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

  function checkLiteMotion() {
    return window.innerWidth < 768 ||
      window.matchMedia('(pointer: coarse)').matches;
  }

  function startIntro() {
    if (hero) void hero.offsetHeight;
    /* Triple-rAF: first flushes any pending style recalc, second ensures paint commit,
     * third fires after the browser has composited at least one frame — so CSS transitions
     * on .hero-intro-ready always run instead of snapping to their end state. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (hero) hero.classList.add('hero-intro-ready');
          setTimeout(function () { introComplete = true; }, 2400);
        });
      });
    });
  }

  startIntro();

  /* Hero “Join our team” ring: drive conic `from` with rAF (CSS can’t animate custom props in most engines). */
  (function initHeroJoinRing() {
    var ring = document.querySelector('.hero-join__ring');
    if (!ring) return;
    var period = 4200;
    var t0 = null;
    function frame(now) {
      if (t0 === null) t0 = now;
      var elapsed = (now - t0) % period;
      var deg = (elapsed / period) * 360;
      ring.style.setProperty('--hero-join-sweep', String(deg) + 'deg');
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  /* Side-scroll marquee: clone row, then rAF + inline translateX (WAAPI/CSS keyframes were not moving on some builds). */
  function initVideoMarquee(root) {
    if (!root || root.getAttribute('data-video-marquee-ready') === '1') return;
    var track = root.querySelector('.video-marquee__track');
    var set = root.querySelector('.video-marquee__set');
    if (!track || !set) return;
    root.setAttribute('data-video-marquee-ready', '1');
    var shell = root.closest('.channel-videos-shell');
    /* When the shell is scroll-revealed off-screen, the rail keeps translating in rAF, so
     * re-entering shows a shifted strip + jagged stagger. Pause rAF, snap translate to 0, and
     * resync lastNow when the shell is visible again. */
    var resyncMarqueeTimeNextVisible = false;

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
    var pxPerSec = 44;

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

      if (shell && !shell.classList.contains('is-visible')) {
        accumPx = 0;
        resyncMarqueeTimeNextVisible = true;
        lastNow = now;
        track.style.transform = 'translate3d(0,0,0)';
        return;
      }

      if (resyncMarqueeTimeNextVisible) {
        lastNow = now;
        resyncMarqueeTimeNextVisible = false;
      }

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
    if (shell && window.MutationObserver) {
      new MutationObserver(function () {
        if (shell.classList.contains('is-visible')) {
          scheduleMarqueeFrame();
        }
      }).observe(shell, { attributes: true, attributeFilter: ['class'] });
    }

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

  /* SVG markup for role cards — keys must match window.KAIM_ROLES[].icon in roles-config.js */
  var ROLE_ICONS = {
    concept:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
    community:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    manager:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    thumbnail:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    vfx:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>',
    cutter:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>'
  };

  /* Scroll-reveal: add .is-visible when a section enters the viewport; remove it after a
   * **debounced** time off-screen (avoids fast edge flicker from isIntersecting toggling). */
  var REVEAL_EXIT_MS = 450;
  var revealExitByEl = typeof WeakMap !== 'undefined' ? new WeakMap() : new Map();
  function clearRevealExitTimer(el) {
    var id = revealExitByEl.get(el);
    if (id != null) {
      clearTimeout(id);
      revealExitByEl.delete(el);
    }
  }
  function scheduleRevealExit(el) {
    clearRevealExitTimer(el);
    revealExitByEl.set(
      el,
      setTimeout(function () {
        revealExitByEl.delete(el);
        if (el && el.isConnected) {
          el.setAttribute('data-reveal-latched', '0');
          el.classList.remove('is-visible');
        }
      }, REVEAL_EXIT_MS)
    );
  }
  var revealObserver = new IntersectionObserver(
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var el = entry.target;
        if (entry.isIntersecting) {
          clearRevealExitTimer(el);
          if (el.getAttribute('data-reveal-latched') === '1') continue;
          var ir = entry.intersectionRect;
          /* Edge case: on some loads, IO reports isIntersecting=true while layout is mid-flight,
           * so intersectionRect can be ~0×0. With threshold:0, the observer may not fire again
           * once it becomes “really” visible, leaving the element stuck at opacity:0 (but clickable).
           * If we see a near-zero rect, re-check on the next frame using getBoundingClientRect. */
          if (ir != null && (ir.width < 0.5 || ir.height < 0.5)) {
            (function retryRevealOnce(target) {
              if (target.__revealRetryQueued) return;
              target.__revealRetryQueued = true;
              requestAnimationFrame(function () {
                target.__revealRetryQueued = false;
                if (!target || !target.isConnected) return;
                if (target.getAttribute('data-reveal-latched') === '1') return;
                var r = target.getBoundingClientRect();
                if (r.width < 1 || r.height < 1) return;
                var vh = window.innerHeight || document.documentElement.clientHeight || 0;
                var vw = window.innerWidth || document.documentElement.clientWidth || 0;
                var onScreen = r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
                if (!onScreen) return;
                target.setAttribute('data-reveal-latched', '1');
                target.classList.add('is-visible');
              });
            })(el);
            continue;
          }
          el.setAttribute('data-reveal-latched', '1');
          el.classList.add('is-visible');
        } else {
          if (el.getAttribute('data-reveal-latched') === '1') {
            scheduleRevealExit(el);
          }
        }
      }
    },
    { root: null, rootMargin: '0px', threshold: 0 }
  );

  function roleIconSvg(iconKey) {
    var svg = ROLE_ICONS[iconKey];
    return svg || '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"></svg>';
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  /* Renders window.KAIM_ROLES (roles-config.js) into mounts + apply dropdown. */
  function initRolesFromConfig() {
    var roles = typeof window.KAIM_ROLES !== 'undefined' && Array.isArray(window.KAIM_ROLES) ? window.KAIM_ROLES : null;
    if (!roles) return;

    var openMount = document.querySelector('[data-roles-open-mount]');
    var closedMount = document.querySelector('[data-roles-closed-mount]');
    var closedCountEl = document.querySelector('[data-closed-roles-count]');
    var closedReveal = document.querySelector('[data-closed-roles-reveal]');
    if (!openMount || !closedMount) return;

    var chevron =
      '<svg class="role-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

    function buildOpenCard(role, delayIndex) {
      var wrap = document.createElement('div');
      wrap.className = 'scroll-reveal scroll-reveal-up';
      if (delayIndex > 0) wrap.setAttribute('data-reveal-delay', String(delayIndex));

      var card = document.createElement('div');
      card.className = 'role-card glass';
      card.setAttribute('data-role', '');

      var applyValue = role.applyValue != null && role.applyValue !== '' ? String(role.applyValue) : String(role.title || '');

      card.innerHTML =
        '<div class="role-header" role="button" tabindex="0" aria-expanded="false">' +
        '<div class="role-icon">' +
        roleIconSvg(role.icon) +
        '</div>' +
        '<div class="role-text">' +
        '<div class="role-title"></div>' +
        '<div class="role-meta"></div>' +
        '</div>' +
        '<div class="role-right">' +
        '<span class="role-dot"></span>' +
        '<span class="role-badge"></span>' +
        chevron +
        '</div>' +
        '</div>' +
        '<div class="role-drawer">' +
        '<div class="role-drawer-inner">' +
        '<p class="role-desc"></p>' +
        '<button type="button" class="apply-btn" data-apply data-apply-role="' +
        escapeAttr(applyValue) +
        '">Apply now</button>' +
        '</div>' +
        '</div>';

      card.querySelector('.role-title').textContent = role.title || '';
      card.querySelector('.role-meta').textContent = role.meta || '';
      card.querySelector('.role-badge').textContent = role.badge || '';
      card.querySelector('.role-desc').textContent = role.description || '';

      wrap.appendChild(card);
      return wrap;
    }

    function buildClosedCard(role) {
      var card = document.createElement('div');
      card.className = 'role-card closed';
      card.setAttribute('data-role', '');

      var baseBadge = role.badge || '';
      var closedBadge = baseBadge ? baseBadge + ' \u00b7 Closed' : 'Closed';

      card.innerHTML =
        '<div class="role-header" role="button" tabindex="0" aria-expanded="false">' +
        '<div class="role-icon">' +
        roleIconSvg(role.icon) +
        '</div>' +
        '<div class="role-text">' +
        '<div class="role-title"></div>' +
        '<div class="role-meta"></div>' +
        '</div>' +
        '<div class="role-right">' +
        '<span class="role-dot closed"></span>' +
        '<span class="role-badge"></span>' +
        chevron +
        '</div>' +
        '</div>' +
        '<div class="role-drawer">' +
        '<div class="role-drawer-inner">' +
        '<p class="role-desc"></p>' +
        '</div>' +
        '</div>';

      card.querySelector('.role-title').textContent = role.title || '';
      card.querySelector('.role-meta').textContent = role.meta || '';
      card.querySelector('.role-badge').textContent = closedBadge;
      card.querySelector('.role-desc').textContent = role.description || '';

      return card;
    }

    var openList = [];
    var closedList = [];
    for (var r = 0; r < roles.length; r++) {
      if (roles[r].open) openList.push(roles[r]);
      else closedList.push(roles[r]);
    }

    openMount.innerHTML = '';
    closedMount.innerHTML = '';

    for (var o = 0; o < openList.length; o++) {
      openMount.appendChild(buildOpenCard(openList[o], o));
    }
    for (var c = 0; c < closedList.length; c++) {
      closedMount.appendChild(buildClosedCard(closedList[c]));
    }

    if (closedCountEl) {
      var n = closedList.length;
      closedCountEl.textContent = n === 1 ? '1 role' : n + ' roles';
    }

    if (closedReveal) {
      if (openList.length > 0) {
        closedReveal.setAttribute('data-reveal-delay', String(openList.length));
      } else {
        closedReveal.removeAttribute('data-reveal-delay');
      }
    }

    if (applyRoleSelect) {
      while (applyRoleSelect.firstChild) applyRoleSelect.removeChild(applyRoleSelect.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.disabled = true;
      opt0.selected = true;
      opt0.textContent = 'Select a role';
      applyRoleSelect.appendChild(opt0);
      for (var a = 0; a < openList.length; a++) {
        var av =
          openList[a].applyValue != null && openList[a].applyValue !== ''
            ? String(openList[a].applyValue)
            : String(openList[a].title || '');
        var opt = document.createElement('option');
        opt.value = av;
        opt.textContent = av;
        applyRoleSelect.appendChild(opt);
      }
      var optOther = document.createElement('option');
      optOther.value = 'Other / general';
      optOther.textContent = 'Other / general';
      applyRoleSelect.appendChild(optOther);
    }

    openMount.querySelectorAll('.scroll-reveal').forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  document.querySelectorAll('.scroll-reveal').forEach(function (el) {
    revealObserver.observe(el);
  });
  initRolesFromConfig();

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
        if (needParallaxTick && !liteMotion) {
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
    if (!liteMotion) updateLayerParallax();
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

  /* 3D tilt on channel cards (pointer devices only). Coalesces mousemove to latest pointer per frame. */
  if (window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 640) {
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      var raf = null;
      var pending = null;

      function applyPointer(ev) {
        var r = card.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width - 0.5;
        var y = (ev.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'rotateY(' + x * 14 + 'deg) rotateX(' + -y * 14 + 'deg) scale3d(1.03,1.03,1.03)';
      }

      function scheduleTilt() {
        if (raf != null) return;
        raf = requestAnimationFrame(function tick() {
          raf = null;
          if (!pending) return;
          var ev = pending;
          pending = null;
          applyPointer(ev);
          if (pending) {
            raf = requestAnimationFrame(tick);
          }
        });
      }

      card.addEventListener('mousemove', function (e) {
        pending = e;
        scheduleTilt();
      });

      card.addEventListener('mouseleave', function () {
        pending = null;
        if (raf != null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
        card.style.transition = 'transform 0.4s ease';
        card.style.transform = '';
        setTimeout(function () {
          card.style.transition = '';
        }, 400);
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
    var contact = applyForm.querySelector('[name="contact"]');
    var role = applyForm.querySelector('[name="role"]');
    var portfolio = applyForm.querySelector('[name="portfolio"]');
    var msg = applyForm.querySelector('[name="message"]');
    return [
      name && name.value,
      contact && contact.value,
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
    var contact = applyForm.querySelector('[name="contact"]');
    var role = applyForm.querySelector('[name="role"]');
    var portfolio = applyForm.querySelector('[name="portfolio"]');
    var nameVal = name && String(name.value).trim();
    if (!nameVal || nameVal.length < 2) {
      return { ok: false, message: 'Please enter your full name (at least 2 characters).' };
    }
    var contactVal = contact && String(contact.value).trim();
    if (!contactVal || contactVal.length < 2) {
      return { ok: false, message: 'Please enter a way to reach you (email, Twitter, Discord, etc.).' };
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
    function onApplyFormChange() {
      if (applySubmitArmed && applyArmedSnapshot !== null && getApplyFormSnapshot() !== applyArmedSnapshot) {
        resetApplySubmitArm();
        if (applyFormStatus) {
          applyFormStatus.textContent = '';
          applyFormStatus.classList.remove('is-error', 'is-success', 'is-pending');
        }
      }
      updateApplyWordCount();
    }
    applyForm.addEventListener('input', onApplyFormChange);
    applyForm.addEventListener('change', onApplyFormChange);
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
