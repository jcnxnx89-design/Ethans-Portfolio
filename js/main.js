/* ============================================================
   ETHAN PORTFOLIO — boot sequence, HUD, audio, navigation.
   Plain script; psp.js is the module and talks to us via
   window.SK (a tiny shared bus).
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* shared bus ------------------------------------------------ */
  var SK = window.SK = {
    ready: false,
    _onReady: [],
    onReady: function (fn) { this.ready ? fn() : this._onReady.push(fn); },
    fireReady: function () {
      this.ready = true;
      this._onReady.splice(0).forEach(function (f) { f(); });
    }
  };

  /* ---------------------------------------------------------- */
  /* BOOT SEQUENCE                                              */
  /* ---------------------------------------------------------- */
  var boot = document.getElementById('boot');
  var fillEl = document.getElementById('bootFill');
  var pctEl = document.getElementById('bootPct');

  var pct = 0, targetPct = 0;
  var bootDone = false;

  function setPct(v) {
    pct = v;
    if (fillEl) fillEl.style.right = (100 - v) + '%';
    if (pctEl) pctEl.textContent = String(Math.round(v)).padStart(3, '0');
  }

  /* creep toward 96 while the model streams in; finishBoot waits on the scene */
  function crawl() {
    targetPct = Math.min(96, targetPct + 6);
    if (targetPct < 96) setTimeout(crawl, reduce ? 30 : 90);
    else finishBoot();
  }

  function tickPct() {
    if (bootDone) return;
    setPct(pct + (targetPct - pct) * 0.14);
    requestAnimationFrame(tickPct);
  }

  function finishBoot() {
    // wait for the 3D scene (or bail after 9s so a slow CDN never traps anyone)
    var released = false;
    function release() {
      if (released) return; released = true;
      targetPct = 100; setPct(100);
      setTimeout(function () {
        bootDone = true;
        if (boot) boot.classList.add('is-done');
        document.body.classList.remove('is-booting');
        document.body.classList.add('is-lit');
      }, reduce ? 60 : 420);
    }
    SK.onReady(release);
    setTimeout(release, 9000);
  }

  requestAnimationFrame(tickPct);
  setTimeout(crawl, reduce ? 0 : 200);

  /* ---------------------------------------------------------- */
  /* AUDIO & MUSIC PLAYER — on by default, remembered per session */
  /*                                                              */
  /* Browsers will not let a page make noise before the visitor    */
  /* has interacted with it. Two things follow, and the old code   */
  /* got both wrong:                                              */
  /*                                                              */
  /*  1. `wheel` and `scroll` are NOT user-activation gestures.    */
  /*     This is a scroll-driven site, so the first thing almost   */
  /*     every visitor does is scroll — the old arming used        */
  /*     {once:true} and tore down the pointer/key listeners on    */
  /*     the first wheel event, then called play(), which was      */
  /*     refused and swallowed. One scroll killed the music for    */
  /*     the whole visit, and no later click could revive it.      */
  /*     So: never disarm except on confirmed success.             */
  /*                                                              */
  /*  2. MUTED playback is always allowed. So the track is set     */
  /*     rolling silently from the very first frame and is fully   */
  /*     buffered by the time a gesture arrives — the gesture      */
  /*     only has to unmute, which cannot fail on a load or a      */
  /*     network stall the way a cold play() can.                  */
  /* ---------------------------------------------------------- */
  var audio = document.getElementById('bgAudio');
  var playerToggleBtn = document.getElementById('playerToggle');
  var playerCloseBtn = document.getElementById('playerClose');
  var playerEl = document.getElementById('player');
  var playerPlayPause = document.getElementById('playerPlayPause');
  var playerVolume = document.getElementById('playerVolume');
  
  var wanted = false, fadeTimer = null, audible = false;
  var VOL = 0.42;
  var playerOpen = false;

function updatePlayerDisplay() {
    updatePlayPauseIcon();
    updateVolumeIcon();
  }

  function updatePlayPauseIcon() {
    if (!playerPlayPause) return;
    var playIcon = playerPlayPause.querySelector('.player__icon-play');
    var pauseIcon = playerPlayPause.querySelector('.player__icon-pause');
    var isPlaying = audible && !audio.paused;
    if (playIcon && pauseIcon) {
      playIcon.style.display = isPlaying ? 'none' : 'block';
      pauseIcon.style.display = isPlaying ? 'block' : 'none';
    }
  }

  function updateVolumeIcon() {
    if (!playerVolume || !audio) return;
    var vol = audio.volume;
    var mutedIcon = document.querySelector('.player__volume-muted');
    var lowIcon = document.querySelector('.player__volume-low');
    var highIcon = document.querySelector('.player__volume-high');
    
    if (mutedIcon && lowIcon && highIcon) {
      if (vol === 0) {
        mutedIcon.style.display = 'block';
        lowIcon.style.display = 'none';
        highIcon.style.display = 'none';
      } else if (vol < 0.5) {
        mutedIcon.style.display = 'none';
        lowIcon.style.display = 'block';
        highIcon.style.display = 'none';
      } else {
        mutedIcon.style.display = 'none';
        lowIcon.style.display = 'none';
        highIcon.style.display = 'block';
      }
    }
  }

  function fadeTo(target, done) {
    if (!audio) return;
    clearInterval(fadeTimer);
    var step = (target - audio.volume) / 22;
    fadeTimer = setInterval(function () {
      var v = audio.volume + step;
      if ((step > 0 && v >= target) || (step < 0 && v <= target) || step === 0) {
        audio.volume = Math.max(0, Math.min(1, target));
        clearInterval(fadeTimer);
        done && done();
      } else {
        audio.volume = Math.max(0, Math.min(1, v));
      }
    }, 40);
  }

  function reflect() { 
    if (playerToggleBtn) playerToggleBtn.setAttribute('aria-pressed', wanted ? 'true' : 'false'); 
  }

  function rollSilently() {
    if (!audio) return;
    audio.muted = true;
    audio.volume = 0;
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }

  var inFlight = null;
  function goAudible() {
    if (!audio) return Promise.resolve(false);
    if (audible) return Promise.resolve(true);
    if (inFlight) return inFlight;

    var wasMuted = audio.muted;
    audio.muted = false;
    if (wasMuted) { try { audio.currentTime = 0; } catch (e) {} }
    audio.volume = 0;

    var p;
    try { p = audio.play(); } catch (e) { p = null; }
    var settle = function (ok) { inFlight = null; return ok; };
    var win = function () { audible = true; fadeTo(VOL); updatePlayerDisplay(); return settle(true); };
    var lose = function () {
      audio.muted = wasMuted;
      if (wasMuted && audio.paused) rollSilently();
      return settle(false);
    };
    if (!p || !p.then) return Promise.resolve(audio.paused ? lose() : win());
    inFlight = p.then(win, lose);
    return inFlight;
  }

  var ARM = ['pointerdown', 'pointerup', 'click', 'keydown', 'touchstart', 'touchend', 'wheel', 'scroll'];
  var armed = false;
  function kick() {
    if (!wanted || audible) { disarm(); return; }
    goAudible().then(function (ok) { if (ok) disarm(); });
  }
  function arm() {
    if (armed || !audio) return;
    armed = true;
    ARM.forEach(function (t) { window.addEventListener(t, kick, { capture: true, passive: true }); });
  }
  function disarm() {
    if (!armed) return;
    armed = false;
    ARM.forEach(function (t) { window.removeEventListener(t, kick, true); });
  }

  function setSound(on) {
    if (!audio) return;
    wanted = on;
    reflect();
    try { sessionStorage.setItem('sk_sound', on ? '1' : '0'); } catch (e) {}
    if (on) {
      goAudible().then(function (ok) { if (!ok) { rollSilently(); arm(); } });
    } else {
      audible = false;
      disarm();
      fadeTo(0, function () { audio.pause(); });
    }
  }

  if (playerToggleBtn) playerToggleBtn.addEventListener('click', function () { 
    playerOpen = !playerOpen;
    if (playerEl) playerEl.classList.toggle('is-open', playerOpen);
    playerToggleBtn.setAttribute('aria-pressed', playerOpen ? 'true' : 'false');
  });

  if (playerCloseBtn) playerCloseBtn.addEventListener('click', function () {
    playerOpen = false;
    if (playerEl) playerEl.classList.remove('is-open');
    playerToggleBtn.setAttribute('aria-pressed', 'false');
  });
  if (playerPlayPause) playerPlayPause.addEventListener('click', function () {
    if (!audio) return;
    if (audible && !audio.paused) {
      audio.pause();
    } else {
      audio.play();
    }
    updatePlayPauseIcon();
  });

  if (playerVolume) playerVolume.addEventListener('input', function () {
    if (!audio) return;
    VOL = playerVolume.value / 100;
    audio.volume = VOL;
    updateVolumeIcon();
  });

  document.addEventListener('visibilitychange', function () {
    if (!audio) return;
    if (document.hidden) { audio.pause(); }
    else if (wanted) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
  });

  var soundOnByDefault = true;
  try { if (sessionStorage.getItem('sk_sound') === '0') soundOnByDefault = false; } catch (e) {}

  if (audio && soundOnByDefault) {
    wanted = true;
    reflect();
    goAudible().then(function (ok) {
      if (ok) return;
      rollSilently();
      arm();
    });
  }

  /* ---------------------------------------------------------- */
  /* INVERT — swaps the ink and the paper, keeps pink/cyan        */
  /* ---------------------------------------------------------- */
  var invBtn = document.getElementById('invertToggle');
  function setInvert(on) {
    document.body.classList.toggle('is-invert', on);
    if (invBtn) invBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', on ? '#000000' : '#ffffff');
    if (SK.setShellInvert) SK.setShellInvert(on);   // the PSP casing goes white
    if (typeof onScroll === 'function') onScroll();  // repaint the backdrop tone
    try { localStorage.setItem('sk_invert', on ? '1' : '0'); } catch (e) {}
  }
  if (invBtn) {
    invBtn.addEventListener('click', function () {
      setInvert(!document.body.classList.contains('is-invert'));
    });
  }
  try { if (localStorage.getItem('sk_invert') === '1') setInvert(true); } catch (e) {}

  /* ---------------------------------------------------------- */
  /* SCROLL ENGINE                                               */
  /* Three jobs: bleed the backdrop tone across section seams,   */
  /* drift each element at its own rate, and reveal type as it   */
  /* enters. Everything runs off one rAF loop.                   */
  /* ---------------------------------------------------------- */
  var backdrop = document.querySelector('.backdrop');
  var secs = [].slice.call(document.querySelectorAll('.sec'));
  var movers = [].slice.call(document.querySelectorAll('.el, .lay'));

  /* how far each piece drifts, as a fraction of the viewport */
  var DEPTH = {
    'el--star-a': 0.16, 'el--star-b': -0.13, 'el--dice': 0.07,
    'el--cd-a': 0.15, 'el--cd-b': -0.12, 'el--cards': 0.08,
    'lay--shutter': -0.05, 'lay--kif': 0.05,
    'lay--abouth': -0.04, 'lay--bio': 0.035,
    'lay--contact': -0.05, 'lay--me': 0.05, 'lay--icons': 0.03
  };
  movers.forEach(function (m) {
    var d = 0;
    for (var k in DEPTH) if (m.classList.contains(k)) d = DEPTH[k];
    m.__d = d;
  });

  function toneOf(sec) { return sec.classList.contains('sec--dark') ? 1 : 0; }

  var ticking = false;
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }

  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    var mid = window.scrollY + vh * 0.5;

    /* --- backdrop tone, blended across a band at each seam --- */
    if (backdrop && secs.length) {
      var band = vh * 0.6;
      var tone = toneOf(secs[secs.length - 1]);
      for (var i = 0; i < secs.length; i++) {
        var top = secs[i].offsetTop, bot = top + secs[i].offsetHeight;
        if (mid >= top && mid < bot) {
          tone = toneOf(secs[i]);
          if (i < secs.length - 1 && mid > bot - band) {
            tone += (toneOf(secs[i + 1]) - tone) * ((mid - (bot - band)) / band);
          } else if (i > 0 && mid < top + band) {
            tone += (toneOf(secs[i - 1]) - tone) * (1 - (mid - top) / band);
          }
          break;
        }
      }
      var inv = document.body.classList.contains('is-invert');
      var v = Math.round((inv ? tone : 1 - tone) * 255);
      backdrop.style.backgroundColor = 'rgb(' + v + ',' + v + ',' + v + ')';
    }

    /* --- per-element drift --- */
    for (var j = 0; j < movers.length; j++) {
      var m = movers[j];
      if (!m.__d) continue;
      var r = m.parentNode.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) continue;      // far off-screen, skip
      var p = (r.top + r.height / 2 - vh / 2) / vh;        // -1 .. 1 through the viewport
      m.style.setProperty('--ty', (p * m.__d * vh).toFixed(1) + 'px');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  frame();

  /* reveal the type and the cut-outs as each section arrives */
  if ('IntersectionObserver' in window && !reduce) {
    var lays = [].slice.call(document.querySelectorAll('.lay, .el'));
    lays.forEach(function (n) { n.classList.add('rev'); });
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-shown'); ro.unobserve(e.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    lays.forEach(function (n) { ro.observe(n); });

    /* Failsafe — nothing may be left hidden because an observer misfired.
       PER ELEMENT, not blanket: it only shows what is actually on screen, so a
       section further down still gets its animation when you reach it. An
       earlier build force-showed everything 2.5s after load and killed every
       reveal past the fold; the one before that left all body text invisible.
       Do not remove this, and do not turn it back into a blanket timeout. */
    var showIfNear = function () {
      var vh = window.innerHeight, live = 0;
      for (var z = 0; z < lays.length; z++) {
        var el = lays[z];
        if (el.classList.contains('is-shown')) continue;
        live++;
        var r = el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) { el.classList.add('is-shown'); ro.unobserve(el); }
      }
      if (!live && guard) { clearInterval(guard); guard = null; }
    };
    var guard = setInterval(showIfNear, 900);
    showIfNear();
    window.addEventListener('scroll', showIfNear, { passive: true });
    window.addEventListener('resize', showIfNear, { passive: true });
  }

  /* ---------------------------------------------------------- */
  /* SMOOTH IN-PAGE NAV                                          */
  /* ---------------------------------------------------------- */
  document.querySelectorAll('[data-nav]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ---------------------------------------------------------- */
  /* SECTION REVEALS                                             */
  /* ---------------------------------------------------------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.18 });
    document.querySelectorAll('.about, .contact').forEach(function (el) { io.observe(el); });
  }

  if (playerPlayPause) {
    playerPlayPause.addEventListener('click', function() {
      setTimeout(function() {
        updatePlayPauseIcon();
      }, 50);
    });
  }

  /* ---------------------------------------------------------- */
  /* PROFILE PICTURE MODAL — click to show                       */
  /* ---------------------------------------------------------- */
  var pfp = document.querySelector('.lay--pfp');
  var pfpModal = document.getElementById('pfpModal');
  var pfpModalClose = document.querySelector('.pfp-modal__close');
  
  if (pfp && pfpModal) {
    pfp.addEventListener('click', function(e) {
      e.stopPropagation();
      pfpModal.classList.add('is-open');
      pfpModal.setAttribute('aria-hidden', 'false');
    });
    
    pfpModalClose.addEventListener('click', function() {
      pfpModal.classList.remove('is-open');
      pfpModal.setAttribute('aria-hidden', 'true');
    });
    
    // Close modal when clicking backdrop
    document.querySelector('.pfp-modal__backdrop').addEventListener('click', function() {
      pfpModal.classList.remove('is-open');
      pfpModal.setAttribute('aria-hidden', 'true');
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && pfpModal.classList.contains('is-open')) {
        pfpModal.classList.remove('is-open');
        pfpModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /* ---------------------------------------------------------- */
  /* CUSTOM MOUSE CURSOR                                         */
  /* ---------------------------------------------------------- */
  var cursor = document.getElementById('customCursor');
  var cursorDot = cursor.querySelector('.custom-cursor__dot');
  var cursorRing = cursor.querySelector('.custom-cursor__ring');
  
  var mouseX = 0, mouseY = 0;
  var dotX = 0, dotY = 0;
  
  document.addEventListener('mousemove', function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorRing.style.left = mouseX + 'px';
    cursorRing.style.top = mouseY + 'px';
  });
  
  function animateDot() {
    dotX += (mouseX - dotX) * 0.2;
    dotY += (mouseY - dotY) * 0.2;
    cursorDot.style.left = dotX + 'px';
    cursorDot.style.top = dotY + 'px';
    requestAnimationFrame(animateDot);
  }
  animateDot();
  
  // Cursor effects on interactive elements
  var interactiveElements = document.querySelectorAll('a, button, [role="button"], .lay--pfp, .letter, input, textarea, select');
  interactiveElements.forEach(function(el) {
    el.addEventListener('mouseenter', function() {
      document.body.classList.add('cursor-active');
    });
    el.addEventListener('mouseleave', function() {
      document.body.classList.remove('cursor-active');
    });
  });
  
  // Hide cursor when leaving window
  document.addEventListener('mouseleave', function() {
    cursor.style.opacity = '0';
  });
  document.addEventListener('mouseenter', function() {
    cursor.style.opacity = '1';
  });
})();
