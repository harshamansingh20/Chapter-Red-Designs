/* ==========================================================================
   Chapter Red — vanilla JS
   Replaces framer-motion / gsap / React behaviour from the original build.
   ========================================================================== */
(function () {
  "use strict";

  const EASE = "cubic-bezier(0.16,1,0.3,1)";
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const $ = (sel, root = document) => root.querySelector(sel);

  /* ── Intro animation ─────────────────────────────────────────────────── */
  /* The R draws itself on, then breaks into the same dust the hero uses.
     The reveal is driven by a geodesic distance field: distance measured
     *through* the glyph from the tail, so the front travels along the stroke
     and rounds the bowl instead of sweeping across it. */

  // The authentic monogram, lifted from brand/logo-footer.svg. (vector.png is a
  // favicon crop — its edges are clipped, so it is not usable as the outline.)
  var R_PATH = "M1459.27,1085.41c-12.93,0-28.52-1.45-42.04-12.05-13.77-10.79-20.89-26.71-19.53-43.69,1.5-18.77,13.17-36.36,30.44-45.91,12.91-7.13,26.47-9.7,38.44-11.96,6.99-1.32,13.59-2.57,19.09-4.54,14.33-5.14,27.83-16.58,31.41-26.61,1.52-4.26,1.09-7.87-1.43-12.07-8.24-13.72-32.05-20.14-49.11-17.53-31.8,4.86-46.46,31.05-66.83,73.61-10.09,21.08-20.51,42.87-35.53,60.94-18.64,22.42-41,35.04-68.37,38.57l-5.75-44.5c33.39-4.31,48.41-30.98,69.18-74.38,20.14-42.09,42.97-89.81,100.53-98.6,32.33-4.94,75.13,6.79,94.34,38.78,9.51,15.82,11.32,33.2,5.23,50.25-9.9,27.74-37.71,46.3-58.52,53.76-8.84,3.17-17.52,4.81-25.91,6.4-9.49,1.8-18.46,3.49-25.08,7.15-4.74,2.62-7.17,7.13-7.41,10.22-.13,1.65.24,3.03,2.48,4.79,3.58,2.8,12.3,2.6,20.73,2.4,2.27-.05,4.51-.1,6.7-.11,12.78-.04,25.81-.23,38.4-.41,14.3-.21,29.08-.42,43.75-.42v44.87c-14.35,0-28.96.21-43.1.42-12.72.19-25.88.38-38.92.42-1.89,0-3.82.05-5.78.1-2.34.05-4.83.11-7.42.11Z";
  var R_RED = "#E31F2E";

  function pathBBox(d) {
    // Exact bounds straight from the path, so the fit never depends on probing.
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 1 1");
    svg.style.cssText = "position:absolute;left:-9999px;width:10px;height:10px";
    var pe = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pe.setAttribute("d", d);
    svg.appendChild(pe); document.body.appendChild(svg);
    var b = pe.getBBox(); svg.remove();
    return b;
  }

  function buildMark(size) {
    // Rasterise the glyph, then flood a geodesic distance out from its tail.
    var pad = Math.round(size * 0.06);
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var x = c.getContext("2d", { willReadFrequently: true });
    var b = pathBBox(R_PATH);
    var k = Math.min((size - pad * 2) / b.width, (size - pad * 2) / b.height);
    x.save();
    x.translate((size - b.width * k) / 2 - b.x * k, (size - b.height * k) / 2 - b.y * k);
    x.scale(k, k);
    x.fill(new Path2D(R_PATH));
    x.restore();

    var alpha = x.getImageData(0, 0, size, size).data;
    var inside = new Uint8Array(size * size);
    for (var j = 0; j < size * size; j++) if (alpha[j * 4 + 3] > 128) inside[j] = 1;

    // Start at the bottom-left tail — where the showreel's stroke begins.
    var start = -1, best = -1e9;
    for (var m = 0; m < size * size; m++) {
      if (!inside[m]) continue;
      var score = ((m / size) | 0) - (m % size);
      if (score > best) { best = score; start = m; }
    }
    if (start < 0) return null;

    // BFS = geodesic distance measured through the glyph, so the reveal front
    // follows the stroke and rounds the bowl instead of sweeping across it.
    var dist = new Float32Array(size * size).fill(-1);
    var q = new Int32Array(size * size), head = 0, tail = 0, maxD = 0;
    dist[start] = 0; q[tail++] = start;
    while (head < tail) {
      var cur = q[head++], cx = cur % size, cy = (cur / size) | 0, cd = dist[cur];
      if (cd > maxD) maxD = cd;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        var n = ny * size + nx;
        if (!inside[n] || dist[n] >= 0) continue;
        dist[n] = cd + (dx && dy ? 1.414 : 1);
        q[tail++] = n;
      }
    }
    return { size: size, inside: inside, dist: dist, maxD: maxD || 1 };
  }

  function initIntro() {
    var SEEN_KEY = "cr-intro-seen";
    var overlay = $("#intro-overlay");
    var root = $("#site-root");
    if (!overlay || !root) return;

    var skip = sessionStorage.getItem(SEEN_KEY) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (skip) {
      overlay.remove();
      root.classList.add("instant", "reveal-now");
      revealSite();
      return;
    }
    sessionStorage.setItem(SEEN_KEY, "1");
    root.classList.add("instant", "reveal-now");

    var revealed = false;
    function finish(animated) {
      if (revealed) return;
      revealed = true;
      revealSite();
      if (!animated) { overlay.remove(); return; }
      setTimeout(function () { overlay.classList.add("exit"); }, 140);
      setTimeout(function () { overlay.remove(); }, 760);
    }

    var canvas = $("#intro-canvas", overlay);
    var ctx = canvas && canvas.getContext("2d");
    // Any failure below must still let the site through — never trap the visitor.
    if (!ctx || typeof Path2D !== "function") { finish(false); return; }
    var mark = buildMark(190);
    if (!mark) { finish(false); return; }

    var GRID = mark.size;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var vw = overlay.clientWidth, vh = overlay.clientHeight;
    // A zero-size overlay (hidden tab, 0x0 viewport) would make the glyph canvas
    // 0x0 and throw on every frame — skip straight to the site instead.
    if (vw < 2 || vh < 2) { finish(false); return; }
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ~16% of viewport width on desktop, ~30% on a phone.
    var markW = Math.min(vw * 0.3, vh * 0.24, 340);
    var ox = (vw - markW) / 2, oy = (vh - markW) / 2;

    // When each cell stops being glyph and becomes dust — in draw order, so the
    // R erodes the same way it was written.
    var melt = new Float32Array(GRID * GRID);
    for (var i = 0; i < GRID * GRID; i++) {
      if (!mark.inside[i]) continue;
      var n = ((Math.imul(i, 2654435761) >>> 0) / 4294967296);
      melt[i] = (mark.dist[i] / mark.maxD) * 0.45 + n * 0.38;
    }

    // Dust in the hero field's own vocabulary, so the handoff is seamless.
    var DUST = "#121212", ACCENT = "#E42222", ACCENT_RATIO = 0.1;
    var parts = [];
    for (var j = 0; j < GRID * GRID; j++) {
      if (!mark.inside[j] || Math.random() > 0.085) continue;
      var accent = Math.random() < ACCENT_RATIO;
      var ang = Math.random() * Math.PI * 2;
      var spread = 0.25 + Math.random() * Math.random() * 1.9;   // a few travel far
      parts.push({
        x: ox + (j % GRID) / GRID * markW,
        y: oy + ((j / GRID) | 0) / GRID * markW,
        vx: Math.cos(ang) * spread,
        vy: Math.sin(ang) * spread * 0.55 - (0.25 + Math.random() * 0.85),
        r: accent ? 1.1 + Math.random() * 1.3 : 0.6 + Math.random() * 1.1,
        col: accent ? ACCENT : DUST,
        delay: melt[j]
      });
    }

    // Mask canvas at field resolution; the glyph itself stays true vector.
    var maskC = document.createElement("canvas");
    maskC.width = maskC.height = GRID;
    var maskX = maskC.getContext("2d");
    var maskImg = maskX.createImageData(GRID, GRID);
    var glyph = document.createElement("canvas");
    glyph.width = glyph.height = Math.round(markW * dpr);
    var gx = glyph.getContext("2d");
    var bbox = pathBBox(R_PATH);
    var pad = markW * dpr * 0.06;
    var gk = Math.min((glyph.width - pad * 2) / bbox.width, (glyph.height - pad * 2) / bbox.height);

    function paintGlyph(keep) {
      // keep(i) -> is this cell still solid?
      var px = maskImg.data;
      for (var i = 0; i < GRID * GRID; i++) px[i * 4 + 3] = keep(i) ? 255 : 0;
      maskX.putImageData(maskImg, 0, 0);
      gx.setTransform(1, 0, 0, 1, 0, 0);
      gx.clearRect(0, 0, glyph.width, glyph.height);
      gx.save();
      gx.translate((glyph.width - bbox.width * gk) / 2 - bbox.x * gk,
                   (glyph.height - bbox.height * gk) / 2 - bbox.y * gk);
      gx.scale(gk, gk);
      gx.fillStyle = R_RED;
      gx.fill(new Path2D(R_PATH));       // crisp vector edge
      gx.restore();
      gx.globalCompositeOperation = "destination-in";
      gx.drawImage(maskC, 0, 0, glyph.width, glyph.height);
      gx.globalCompositeOperation = "source-over";
      ctx.drawImage(glyph, ox, oy, markW, markW);
    }

    var DRAW = 2100, HOLD = 500, MELT = 1750;
    var t0 = null;

    function frame(now) {
      if (t0 === null) t0 = now;
      var t = now - t0;
      ctx.clearRect(0, 0, vw, vh);

      if (t < DRAW + HOLD) {
        var prog = Math.min(1, t / DRAW);
        var front = easeInOut(prog) * mark.maxD;
        paintGlyph(function (i) { return mark.inside[i] && mark.dist[i] <= front; });
      } else {
        var mt = Math.min(1, (t - DRAW - HOLD) / MELT);
        paintGlyph(function (i) { return mark.inside[i] && melt[i] > mt; });
        for (var k = 0; k < parts.length; k++) {
          var p = parts[k];
          var pt = (mt - p.delay) / (1 - p.delay);
          if (pt <= 0 || pt >= 1) continue;
          var travel = pt * 165;
          ctx.globalAlpha = 1 - pt;
          // Red at the break, settling into the hero's dust colours.
          ctx.fillStyle = pt < 0.3 ? R_RED : p.col;
          ctx.beginPath();
          ctx.arc(p.x + p.vx * travel, p.y + p.vy * travel, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (mt > 0.4) finish(true);
        if (mt >= 1) return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // Hard stop: rAF never runs in a background tab, so release the site anyway.
    setTimeout(function () { finish(true); }, DRAW + HOLD + MELT + 900);
  }

  /* ── Lead tracking helpers ────────────────────────────────────────────── */
  /* Shared by the contact form and the book-a-call form. Captures Google Ads
     click ids on landing (they only appear on the first URL) and reads the GA4
     cookies so the server can attribute its conversion to the same session. */
  var ADS_KEY = "cr-ads-click";

  function captureAdsClickId() {
    try {
      var q = new URLSearchParams(window.location.search);
      var found = null;
      ["gclid", "gbraid", "wbraid"].forEach(function (k) {
        var v = q.get(k);
        if (v && !found) found = { key: k, value: v, at: Date.now() };
      });
      if (found) localStorage.setItem(ADS_KEY, JSON.stringify(found));
    } catch (e) { /* private mode / blocked storage — tracking is best-effort */ }
  }

  function cookie(name) {
    var m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? m.pop() : "";
  }

  window.CRDLead = {
    // Identifiers the Apps Script needs to report the conversion server-side.
    context: function () {
      var out = {};
      // _ga cookie: GA1.1.<client_id part 1>.<part 2>
      var ga = cookie("_ga").split(".");
      if (ga.length >= 4) out.client_id = ga[2] + "." + ga[3];
      // _ga_<stream>. Older format: GS1.1.<session_id>.<n>...
      // Newer format:      GS2.1.s<session_id>$o1$g1$t...  — strip the s and the $ fields.
      var gs = cookie("_ga_K160Y2YJJE").split(".");
      if (gs.length >= 3) {
        var sid = gs[2].replace(/^s/, "").split("$")[0];
        if (/^\d+$/.test(sid)) out.session_id = sid;
      }
      try {
        var ads = JSON.parse(localStorage.getItem(ADS_KEY) || "null");
        // Ads click ids are only useful for ~90 days.
        if (ads && Date.now() - ads.at < 90 * 864e5) {
          out.ads_click_key = ads.key;
          out.ads_click_id = ads.value;
        }
      } catch (e) { /* ignore */ }
      out.page = window.location.pathname;
      return out;
    },
    // Mark this visitor as having genuinely just submitted, then hand off.
    complete: function () {
      try { sessionStorage.setItem("cr-lead-pending", "1"); } catch (e) {}
      window.location.href = "thank-you.html";
    }
  };

  /* ── Navbar scroll state ──────────────────────────────────────────────── */
  function initNavbar() {
    const nav = $("#navbar");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ── Hero + navbar entrance animation ─────────────────────────────────── */
  function revealSite() {
    document.querySelectorAll(".hero-anim, .nav-expand").forEach((el) => el.classList.add("play"));
  }

  /* ── Dust field ───────────────────────────────────────────────────────── */
  function initDustField() {
    const canvas = $("#dust-field");
    const container = canvas && canvas.parentElement;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const density = 150, speed = 1.44, pull = 140;
    const dustColor = "#121212", accentColor = "#E42222", accentRatio = 0.1;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0, height = 0, particles = [];
    const mouse = { x: -9999, y: -9999, active: false };

    function makeParticle() {
      const accent = Math.random() < accentRatio;
      const angle = Math.random() * Math.PI * 2;
      const mag = 0.12 + Math.random() * 0.2;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        r: accent ? 1.1 + Math.random() * 1.3 : 0.6 + Math.random() * 1.1,
        accent,
        alpha: accent ? 0.55 + Math.random() * 0.35 : 0.25 + Math.random() * 0.4,
      };
    }
    function rebuild() {
      particles = [];
      for (let i = 0; i < density; i++) particles.push(makeParticle());
    }
    function resize() {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const ro = new ResizeObserver(() => { resize(); rebuild(); });
    ro.observe(container);
    resize();
    rebuild();

    window.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    });
    container.addEventListener("mouseleave", () => {
      mouse.active = false; mouse.x = -9999; mouse.y = -9999;
    });

    function step() {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        if (mouse.active && pull > 0) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const radius = pull * 1.8;
          if (dist < radius) {
            const force = (1 - dist / radius) * 0.6;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.accent ? accentColor : dustColor;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (reduced) { step(); }
    else { (function loop() { step(); requestAnimationFrame(loop); })(); }
  }

  /* ── Showreel scroll scale ────────────────────────────────────────────── */
  function initShowreel() {
    const container = $("#showreel");
    const frame = $("#showreel-frame");
    if (!container || !frame) return;

    if (window.innerWidth >= 768) {
      let current = 0, target = 0;

      function measure() {
        const vh = window.innerHeight;
        const rect = container.getBoundingClientRect();
        const travel = vh;
        target = clamp((vh - rect.top) / travel, 0, 1);
      }
      function render() {
        current += (target - current) * 0.12;
        const scale = lerp(0.30, 0.85, current);
        frame.style.transform = "scale(" + scale + ")";
        requestAnimationFrame(render);
      }
      window.addEventListener("scroll", measure, { passive: true });
      window.addEventListener("resize", measure);
      measure();
      render();
    }

    // Controls
    const video = document.getElementById("showreel-video");
    const playBtn = document.getElementById("sr-play");
    const muteBtn = document.getElementById("sr-mute");
    if (!video || !playBtn || !muteBtn) return;

    function syncPlay() {
      playBtn.querySelector(".sr-icon--play").style.display  = video.paused ? "block" : "none";
      playBtn.querySelector(".sr-icon--pause").style.display = video.paused ? "none"  : "block";
    }
    function syncMute() {
      muteBtn.querySelector(".sr-icon--sound").style.display = video.muted ? "none"  : "block";
      muteBtn.querySelector(".sr-icon--muted").style.display = video.muted ? "block" : "none";
    }

    let pausedByUser = false;

    playBtn.addEventListener("click", function() {
      if (video.paused) { pausedByUser = false; video.play(); }
      else { pausedByUser = true; video.pause(); }
      syncPlay();
    });
    muteBtn.addEventListener("click", function() {
      video.muted = !video.muted;
      syncMute();
    });

    video.addEventListener("play",  syncPlay);
    video.addEventListener("pause", syncPlay);
    syncPlay();
    syncMute();

    // Pause when scrolled out of view, resume when back (unless the user paused it)
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            if (!pausedByUser) { var p = video.play(); if (p) p.catch(function() {}); }
          } else if (!video.paused) {
            video.pause();
          }
        });
      }, { threshold: 0.35 }).observe(video);
    }
  }

  /* ── Featured works ───────────────────────────────────────────────────
     Taglines are lifted from each project's own work page (its <h1
     id="project-title">), so the card and the page it opens agree.
     Cleaon Care has no page yet — hidden until it's ready to show. */
  const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.";
  const WORKS = [
    { name: "Cleaon Care", img: "brand/Cleaon-Care.png", href: "#",
      tag: LOREM, hidden: true },
    { name: "Punjabi Kadhai", img: "work/punjabi-kadhai/drive-download-20260724T153409Z-1-001/punjabi-kadhai-brand-pattern.png", href: "work/punjabi-kadhai/index.html",
      tag: "A beloved Punjabi restaurant in Siliguri reintroduces itself to a new generation" },
    { name: "GoPhrasing", img: "work/go-phrasing/drive-download-20260731T172209Z-1-001/GoPhrasing-App-Icon-Mob-Mockup.png", href: "work/go-phrasing/index.html",
      tag: "From trusted French educator to an EdTech platform" },
    { name: "Pink Tiger", img: "work/pink-tiger/drive-download-20260731T075215Z-1-001/Pink-Tiger-Brand-identity-Logo-Mockup.png", href: "work/pink-tiger/index.html",
      tag: "Pink Tiger brings restaurant-quality hospitality beyond the restaurant in Vancouver" },
    { name: "Curious Gigglers", img: "work/curious-gigglers/drive-download-20260731T062340Z-1-001/Curious-Gigglers-Logo-Mockup_.png", href: "work/curious-gigglers/index.html",
      tag: "Shaping the future of modern preschool branding" },
    { name: "Baking Diaries", img: "brand/Baking-Diaries-kurseong.png", href: "work/baking-diaries/index.html",
      tag: "Reimagining the Café & Bakery Experience in Kurseong" },
  ];

  function initWorks() {
    const mount = $("#selected-work");
    if (!mount) return;
    const visible = WORKS.filter((w) => !w.hidden);
    mount.innerHTML =
      '<section class="works"><div class="works-inner">' +
        '<h2 class="heading-2 reveal"><span class="dark">FEATURED </span><span class="red">WORKS</span></h2>' +
        '<div class="works-grid">' +
          visible.map((w, i) =>
            '<a class="wk-card reveal" href="' + w.href + '" style="transition-delay:' + (i % 2) * 0.08 + 's">' +
              '<span class="wk-media">' +
                '<img src="' + w.img + '" alt="' + w.name + '" loading="lazy" />' +
              "</span>" +
              '<h3 class="wk-name">' + w.name + "</h3>" +
              '<p class="wk-tag">' + w.tag + "</p>" +
            "</a>"
          ).join("") +
        "</div>" +
      "</div></section>";
  }

  /* ── Process ──────────────────────────────────────────────────────────
     Six rings that fill with red as the brand takes shape.
       fill  liquid level, 0-1
       tilt  degrees the surface slants; +ve drops the right side
       fx    figure's x in viewBox units, so it stands where the art puts it
     Silhouettes are referenced, not inlined — 65KB of path data doesn't
     belong in this file. ART_SCALE keeps their relative sizes as exported. */
  const ART_SCALE = 0.565;
  const PROCESS = [
    { num: "01", fill: 0.12, tilt:  -5, fx: 42, art: ["Vector.svg",   19,  69], title: "Understanding <br>the Business", tag: "Business · Audience · Market" },
    { num: "02", fill: 0.26, tilt:  -8, fx: 44, art: ["Vector-2.svg", 23,  80], title: "Finding <br>the Edge",           tag: "Positioning · Differentiation · Opportunity" },
    { num: "03", fill: 0.46, tilt:  -8, fx: 46, art: ["Vector-3.svg", 34,  64], title: "Defining <br>the Brand",         tag: "Purpose · Values · Direction" },
    { num: "04", fill: 0.60, tilt:  -6, fx: 50, art: ["Vector-4.svg", 29,  70], title: "Giving It <br>Personality",      tag: "Character · Personality · Voice" },
    { num: "05", fill: 0.80, tilt: -14, fx: 60, art: ["Vector-5.svg", 51,  88], title: "Building <br>the Identity",      tag: "Logo · Colour · Typography" },
    { num: "06", fill: 0.90, tilt:  -2, fx: 52, art: ["Vector-6.svg", 53, 112], title: "Bringing It <br>to Life",        tag: "Packaging · Digital · Social" },
  ];

  /* A gently waved surface, tilted by each ring's `tilt` into a slope. Static
     geometry — no drift. Deliberately far wider and deeper than the ring: the
     tilt rotates this path, and a tight box would swing its corners into view. */
  const SURFACE = "M-200 10q12.5-6 25 0" + "t25 0".repeat(23) + "V600H-200Z";

  function initProcess() {
    const mount = $("#process-steps");
    if (!mount) return;
    mount.innerHTML = PROCESS.map((s, i) => {
      const surface = 100 - s.fill * 100;          // liquid line, in viewBox units
      const rise = surface - 10;
      const [file, aw, ah] = s.art;
      const w = aw * ART_SCALE, h = ah * ART_SCALE;
      // Stand the figure on the slanted surface, a hair into the liquid.
      const feet = surface + (s.fx - 50) * Math.tan((s.tilt * Math.PI) / 180) + 1;
      return (
        '<div class="pr-step" style="--rise:' + rise.toFixed(1) + 'px">' +
          '<svg class="pr-ring" viewBox="0 0 100 100" aria-hidden="true">' +
            '<defs><clipPath id="prc' + i + '"><circle cx="50" cy="50" r="48"/></clipPath></defs>' +
            '<g clip-path="url(#prc' + i + ')"><g class="pr-rise">' +
              '<g transform="rotate(' + s.tilt + ' 50 10) translate(' + i * 11 + ' 0)">' +
                '<path d="' + SURFACE + '"/>' +
              "</g>" +
            "</g></g>" +
            '<circle class="pr-out" cx="50" cy="50" r="48"/>' +
            '<g class="pr-rise"><image href="brand/process/' + file + '"' +
              ' x="' + (s.fx - w / 2).toFixed(2) + '" y="' + (feet - h - rise).toFixed(2) + '"' +
              ' width="' + w.toFixed(2) + '" height="' + h.toFixed(2) + '"/></g>' +
          "</svg>" +
          '<div class="pr-stem"></div><div class="pr-linerow"><span class="pr-dot"></span></div>' +
          '<div class="pr-num">' + s.num + "</div>" +
          '<h4 class="pr-title">' + s.title + "</h4>" +
          '<div class="pr-rule"></div>' +
          '<p class="pr-tag">' + s.tag + "</p>" +
        "</div>"
      );
    }).join("");

    // Fill on scroll-in, staggered left to right.
    new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        mount.querySelectorAll(".pr-step").forEach((el, i) => {
          el.querySelectorAll(".pr-rise").forEach((r) => {
            r.style.transitionDelay = i * 0.12 + "s";
          });
        });
        mount.classList.add("play");
        obs.disconnect();
      });
    }, { rootMargin: "-80px" }).observe(mount);
  }

  /* ── Services ─────────────────────────────────────────────────────────── */
  const SERVICES = [
    { num: "01", category: "BRAND STRATEGY SYSTEM", heading: "The hardest branding decision isn't your logo. It's giving people a reason to remember you.", desc: "Before we design anything, we help you define your positioning, understand your audience and uncover what makes your business worth choosing. That's what turns a business into a memorable brand.", flip: false, dark: false, img: "brand/Brand-strategy.png" },
    { num: "02", category: "BRAND IDENTITY SYSTEM", heading: "Build A Brand People Recognise", desc: "Recognition isn't built through a logo alone. It's built through consistency. We design an identity system (logo, typography, colours, imagery and brand guidelines) that makes your brand instantly known whether someone sees your packaging on quick commerce, website, social media or billboards.", flip: true, dark: true, img: "brand/Brand-identity.png" },
    { num: "03", category: "PACKAGING DESIGN SYSTEM", heading: "Win The Shelf Before The Sale!", desc: "Shelf space is expensive, but grabbing attention is even more valuable. Your product packaging has just a few seconds to communicate, persuade and reassure before a customer picks it up. We design strategic packaging that captures attention, intrigues and makes people choose you over competitors.", flip: false, dark: false, img: "brand/Packaging-design.png" },
  ];
  function initServices() {
    const container = $("#services-container");
    if (!container) return;
    const row = document.createElement("div");
    row.className = "svc-row";
    // Open/closed is pure CSS (first card open, hover swaps) — no JS state to desync.
    row.innerHTML = SERVICES.map((svc) =>
      '<article class="svc-card">' +
        '<div class="svc-media"><img src="' + svc.img + '" alt="' + svc.category + '" loading="lazy" /></div>' +
        '<div class="svc-num">' + svc.num + ".</div>" +
        '<div class="svc-inner">' +
          '<p class="svc-label">' + svc.category + "</p>" +
          '<div class="svc-reveal"><div class="svc-reveal-in">' +
            '<h3 class="svc-heading">' + svc.heading + "</h3>" +
            '<p class="svc-desc">' + svc.desc + "</p>" +
          "</div></div>" +
        "</div>" +
      "</article>"
    ).join("");
    container.appendChild(row);
  }

  /* ── Reviews ──────────────────────────────────────────────────────────── */
  const REVIEWS = [
    { name: "Chiranjeev Sandhu", role: "Cleaon Care", quote: "Chapter Red helped us build our complete brand identity, from the logo and brand language to packaging, website, content, and SEO. They immersed themselves deeply in the project and paid great attention to detail. The new branding has elevated our packaging and overall presentation, and we\u2019ve received positive feedback from our partners and marketers. The team was timely, collaborative, detail-oriented, and understood our vision really well." },
    { name: "Mohita Mathur", role: "Founder — Mo\u2019s Bakery", quote: "I have worked with Jasgul for over 2 years now and she is a very versatile and dynamic designer. She has not only designed our product packaging but has also helped us shape our brands personality by constantly working with us in refining it. She has a humble personality and is able to understand the requirements of the marketing team and brand owner well." },
    { name: "Sonal Bangia", role: "Co-Founder — The Brand Palette", quote: "Jasgul is one of the most talented thinkers and creative designers that I have met. Her sense of design is exceptional and she is extremely responsible about her work. She has grown exponentially in the last few years and I am looking forward to staying associated with her in the future." },
    { name: "Anamika Mahajan", role: "GoPhrasing & Zenith SFI", quote: "What stood out most about this agency was their ability to deeply understand my vision \u2014 even when I struggled to articulate it clearly. They asked the right questions, listened attentively, and took time to truly understand my brand\u2019s mission and personality. What impressed me was not just their technical skill, but their ability to translate abstract ideas into visual language that felt authentic, modern, and aligned with my goals." },
    { name: "Manish Dhir", role: "Xtreme Security", quote: "Their responsiveness to our needs was impressive; they were always quick to address any changes or feedback." },
    { name: "Nimisha Modi", role: "Bohemian Alley", quote: "I had a wonderful time working on my rebrand with Chapter Red. Jasgul did an amazing job of making my vision come to life. She was extremely accomodating and understanding all throughout the process. The entire journey felt like a cake walk!" },
    { name: "Bhawna Gupta", role: "NoFuss Foods", quote: "I had a great experience working with Chapter Red Designs. I wanted minimal, product-focused packaging and they nailed it. Highly recommend CRD for anyone seeking a thoughtful, supportive design team." },
  ];
  function initReviews() {
    const track = $("#reviews-grid");
    if (!track) return;
    const star =
      '<svg class="rv-star" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">' +
        '<rect width="24" height="24" rx="1" fill="#00B67A"/>' +
        '<polygon fill="#fff" points="12,4.2 14.41,9.08 19.8,9.87 15.9,13.67 16.82,19.06 12,16.5 7.18,19.06 8.1,13.67 4.2,9.87 9.59,9.08"/>' +
      "</svg>";
    track.innerHTML = REVIEWS.map((r) =>
      '<article class="rv-card">' +
        '<div class="rv-stars" role="img" aria-label="5 out of 5 stars">' + star.repeat(5) + "</div>" +
        '<p class="rv-name">' + r.name + (r.role ? '<span class="rv-role">' + r.role + "</span>" : "") + "</p>" +
        '<p class="rv-quote">' + r.quote + "</p>" +
      "</article>"
    ).join("");

    const prev = $("#rv-prev"), next = $("#rv-next");
    if (!prev || !next) return;
    // Scroll by one card, measured from the DOM so it survives any re-styling.
    function step() {
      const card = track.querySelector(".rv-card");
      if (!card) return track.clientWidth;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card.getBoundingClientRect().width + gap;
    }
    function sync() {
      // Tolerance: scroll snapping and sub-pixel widths leave a few px at each end.
      const EPS = 4;
      const max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= EPS;
      next.disabled = track.scrollLeft >= max - EPS;
    }
    prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  }

  /* ── Team ─────────────────────────────────────────────────────────────── */
  const TEAM = [
    { name: "Isabel Laurent", role: "Creative Director", img: "https://picsum.photos/seed/team1/400/520" },
    { name: "Mara Vasileva", role: "Brand Designer", img: "https://picsum.photos/seed/team2/400/520" },
    { name: "Noah Bellamy", role: "Web Designer", img: "https://picsum.photos/seed/team3/400/520" },
    { name: "Elena Cross", role: "Motion Designer", img: "https://picsum.photos/seed/team4/400/520" },
  ];
  function initTeam() {
    const grid = $("#team-grid");
    if (!grid) return;
    grid.innerHTML = TEAM.map((m, i) =>
      '<div class="team-card reveal" style="transition-delay:' + (i * 0.1) + 's">' +
        '<img src="' + m.img + '" alt="' + m.name + '" />' +
        '<div class="scrim"></div>' +
        '<div class="meta"><p class="name">' + m.name + '</p><p class="role">' + m.role + "</p></div>" +
      "</div>"
    ).join("");
  }

  /* ── FAQ ──────────────────────────────────────────────────────────────── */
  const FAQS = [
    { q: "Do you work with startups or established businesses?", a: "Yes. We work with both pre-funded and funded startups, as well as established businesses looking to reposition, scale or refresh their brand. Whether you're building something new or evolving an existing business, we tailor our approach to where you are in your journey." },
    { q: "What branding services do you offer?", a: "We offer Brand Strategy, Brand Identity and Packaging Design. Depending on your needs, we can work on an individual service or build a complete branding system from strategy through execution." },
    { q: "Do you offer logo design as a standalone service?", a: "Nope. A logo is one part of a much bigger brand. We believe it should be shaped by strategy, positioning and personality, not designed in isolation. That's why every identity project starts with understanding your business first." },
    { q: "Can you help us rebrand an existing business?", a: "Absolutely. Whether your business has outgrown its current identity or needs a clearer position in the market, we help redefine your strategy, refresh your visual identity and create a brand that's ready for its next stage of growth." },
    { q: "What industries do you work with?", a: "We've partnered with businesses across hospitality, food & beverage, consumer brands, SaaS, real estate, technology and professional services. Rather than specialising in one industry, we specialise in understanding businesses and translating them into curated brands." },
    { q: "How long does a branding project take?", a: "Most branding projects take between 5-6 weeks, depending on the scope and complexity. Once we understand your requirements, we'll provide a detailed timeline before we begin." },
  ];
  function initFAQ() {
    const list = $("#faq-list");
    if (!list) return;
    const toggleSVG =
      '<span class="faq-toggle"><svg width="14" height="14" viewBox="0 0 14 14" fill="none">' +
        '<rect class="bar-h" x="2" y="6.5" width="10" height="1.2" rx="0.6"/>' +
        '<rect class="bar-v" x="6.5" y="2" width="1.2" height="10" rx="0.6"/>' +
      "</svg></span>";
    list.innerHTML = FAQS.map((f, i) =>
      '<div class="faq-item' + (i === 0 ? " open" : "") + '">' +
        '<button class="faq-q"><span class="text">' + f.q + "</span>" + toggleSVG + "</button>" +
        '<div class="faq-a"><div class="faq-a-inner"><div><p>' + f.a + "</p></div></div></div>" +
      "</div>"
    ).join("");
    list.querySelectorAll(".faq-item").forEach((item) => {
      item.querySelector(".faq-q").addEventListener("click", () => {
        const wasOpen = item.classList.contains("open");
        list.querySelectorAll(".faq-item").forEach((it) => it.classList.remove("open"));
        if (!wasOpen) item.classList.add("open");
      });
    });
  }

  /* ── Contact form ─────────────────────────────────────────────────────── */
  function initContact() {
    const form = $("#contact-form");
    if (!form) return;
    form.querySelectorAll(".service-tag").forEach((tag) => {
      tag.addEventListener("click", () => tag.classList.toggle("selected"));
    });
    form.addEventListener("submit", (e) => e.preventDefault());
  }

  /* ── Reveal on scroll ─────────────────────────────────────────────────── */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (window.innerWidth < 768 || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "-60px" });
    els.forEach((el) => io.observe(el));
  }

  /* ── Mobile nav (hamburger) ───────────────────────────────────────────── */
  function initMobileNav() {
    const hamburger = $("#hamburger");
    const mobileNav = $("#mobile-nav");
    if (!hamburger || !mobileNav) return;

    // Clone logo from desktop navbar
    const desktopLogo = $(".navbar-logo");
    const mobileLogoSlot = $(".mobile-nav-logo", mobileNav);
    if (desktopLogo && mobileLogoSlot) {
      mobileLogoSlot.href = desktopLogo.href;
      mobileLogoSlot.innerHTML = desktopLogo.innerHTML;
    }

    // Populate links from desktop navbar
    const linksContainer = $("#mobile-nav-links");
    if (linksContainer) {
      document.querySelectorAll(".navbar-nav .navbar-link").forEach((link) => {
        const a = document.createElement("a");
        a.textContent = link.textContent.trim();
        if (link.classList.contains("navbar-link--disabled")) {
          a.className = "mobile-nav-link mobile-nav-link--disabled";
          a.setAttribute("aria-disabled", "true");
        } else {
          a.href = link.href;
          a.className = "mobile-nav-link";
        }
        linksContainer.appendChild(a);
      });
    }

    // Set CTA href from desktop .btn-call
    const desktopCta = $(".btn-call");
    const mobileCta = $("#mobile-nav-cta");
    if (desktopCta && mobileCta) mobileCta.href = desktopCta.href;

    function close() {
      mobileNav.classList.remove("open");
      hamburger.classList.remove("open");
      document.body.style.overflow = "";
    }

    hamburger.addEventListener("click", () => {
      const opening = !mobileNav.classList.contains("open");
      mobileNav.classList.toggle("open");
      hamburger.classList.toggle("open");
      document.body.style.overflow = opening ? "hidden" : "";
    });

    $("#mobile-nav-close", mobileNav).addEventListener("click", close);

    // Close on any link or CTA click
    mobileNav.addEventListener("click", (e) => {
      if (e.target.tagName === "A") close();
    });
  }

  /* ── Boot ─────────────────────────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    captureAdsClickId();  // must run before the visitor navigates away from the ad URL
    initIntro();   // calls revealSite() at the right moment internally
    initNavbar();
    initMobileNav();
    initDustField();
    initShowreel();
    initWorks();
    initProcess();
    initServices();
    initReviews();
    initTeam();
    initFAQ();
    initContact();
    initReveal(); // after dynamic content is injected
  });
})();
