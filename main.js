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

  /* ── Intro video ──────────────────────────────────────────────────────── */
  function initIntro() {
    const SEEN_KEY = "cr-intro-seen";
    const CROSSFADE_S = 0.9;
    const FAILSAFE_MS = 9000;
    const overlay = $("#intro-overlay");
    const root = $("#site-root");
    const video = overlay ? $("video", overlay) : null;

    if (!overlay || !root) return;

    if (sessionStorage.getItem(SEEN_KEY)) {
      overlay.remove();
      root.classList.add("instant", "reveal-now");
      return;
    }

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(failSafe);
      sessionStorage.setItem(SEEN_KEY, "1");
      root.classList.add("reveal-now");
      overlay.classList.add("hide");
      setTimeout(() => overlay.remove(), 900);
    }

    const failSafe = setTimeout(finish, FAILSAFE_MS);

    if (video) {
      video.addEventListener("timeupdate", () => {
        if (video.duration && video.currentTime >= video.duration - CROSSFADE_S) finish();
      });
      video.addEventListener("ended", finish);
      video.addEventListener("error", finish);
    } else {
      finish();
    }
  }

  /* ── Navbar scroll state ──────────────────────────────────────────────── */
  function initNavbar() {
    const nav = $("#navbar");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ── Hero entrance animation ──────────────────────────────────────────── */
  function initHero() {
    document.querySelectorAll(".hero-anim").forEach((el) => el.classList.add("play"));
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

    let current = 0, target = 0;

    function measure() {
      const vh = window.innerHeight;
      const rect = container.getBoundingClientRect();
      const travel = vh - 0.25 * vh;
      target = clamp((vh - rect.top) / travel, 0, 1);
    }
    function render() {
      current += (target - current) * 0.12;
      const scale = lerp(0.35, 0.88, current);
      frame.style.transform = "scale(" + scale + ")";
      requestAnimationFrame(render);
    }
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    render();

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

    playBtn.addEventListener("click", function() {
      video.paused ? video.play() : video.pause();
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
  }

  /* ── Why (scroll-highlight text) ──────────────────────────────────────── */
  function initWhy() {
    const container = $("#why");
    const p = $("#why-text");
    if (!container || !p) return;
    const text = "Brands are a lot like people. Looks get you attention, but character is what earns trust. Your brand needs both and that's why it is so important to shape your brand's character before designing its identity.";
    const words = text.split(" ");
    const spans = words.map((w) => {
      const s = document.createElement("span");
      s.className = "word";
      s.textContent = w + " ";
      p.appendChild(s);
      return s;
    });

    const gray = [161, 161, 161], dark = [18, 18, 18];
    function update() {
      const vh = window.innerHeight;
      const rect = container.getBoundingClientRect();
      // prog: 0 when sticky locks in (rect.top=0), 1 when track bottom hits viewport bottom
      const prog = clamp(-rect.top / (container.offsetHeight - vh), 0, 1);
      const n = spans.length;
      spans.forEach((s, i) => {
        const start = i / n, end = (i + 1) / n;
        const wp = clamp((prog - start) / (end - start), 0, 1);
        s.style.opacity = (0.15 + 0.85 * wp).toString();
        const c = gray.map((g, k) => Math.round(lerp(g, dark[k], wp)));
        s.style.color = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
      });
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ── Selected work ────────────────────────────────────────────────────── */
  const WORK_CARDS = [
    { category: "01 — Education", name: "Zenith School", variant: 1 },
    { category: "02 — Security", name: "Xtreme Inc.", variant: 2 },
    { category: "03 — Commerce", name: "Bohemian Alley", variant: 3 },
    { category: "04 — Food", name: "NoFuss", variant: 4 },
    { category: "05 — Studio", name: "Reverie", variant: 5 },
    { category: "06 — Tech", name: "Northpoint", variant: 6 },
  ];
  const STACK = [
    { x: -2, y: 0, r: -8 }, { x: -1, y: -1, r: -4 }, { x: 0, y: 0, r: -1 },
    { x: 1, y: -1, r: 2 }, { x: 2, y: 0, r: 5 }, { x: 3, y: 1, r: 9 },
  ];
  const FAN = [
    { x: -33, y: 2, r: -16 }, { x: -20, y: -2, r: -9 }, { x: -7, y: 0, r: -3 },
    { x: 7, y: 0, r: 3 }, { x: 20, y: -2, r: 9 }, { x: 33, y: 2, r: 16 },
  ];
  const GRID = [
    { x: -30, y: -9, r: 0 }, { x: 0, y: -9, r: 0 }, { x: 30, y: -9, r: 0 },
    { x: -30, y: 23, r: 0 }, { x: 0, y: 23, r: 0 }, { x: 30, y: 23, r: 0 },
  ];
  const lerpPos = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), r: lerp(a.r, b.r, t) });

  function cardInner() {
    return '<div class="overlay"><span>VIEW PROJECT →</span></div>';
  }

  function initSelectedWork() {
    const mount = $("#selected-work");
    if (!mount) return;

    // Desktop
    const desktop = document.createElement("section");
    desktop.className = "work-desktop";
    desktop.innerHTML =
      '<div class="work-sticky">' +
        '<div class="work-heading"><h2 class="heading-2"><span class="dark">FEATURED </span><span class="red">WORKS</span></h2></div>' +
        '<div class="work-stage" id="work-stage"></div>' +
      "</div>";

    const stage = $("#work-stage", desktop) || desktop.querySelector(".work-stage");
    const cardEls = WORK_CARDS.map((card) => {
      const a = document.createElement("a");
      a.href = "#";
      a.className = "work-card";
      a.innerHTML = cardInner();
      stage.appendChild(a);
      return a;
    });

    // Mobile
    const mobile = document.createElement("section");
    mobile.className = "work-mobile";
    mobile.innerHTML =
      '<h2><span style="color:#121212">FEATURED </span><span style="color:#E42222">WORKS</span></h2>' +
      '<div class="work-mobile-list"></div>';
    const mlist = mobile.querySelector(".work-mobile-list");
    WORK_CARDS.forEach((card, i) => {
      const a = document.createElement("a");
      a.href = "#";
      a.className = "work-mcard reveal";
      a.style.transitionDelay = (i * 0.05) + "s";
      a.innerHTML = cardInner();
      mlist.appendChild(a);
    });

    mount.appendChild(desktop);
    mount.appendChild(mobile);

    function update() {
      const scrollable = desktop.offsetHeight - window.innerHeight;
      const p = scrollable <= 0 ? 0 : clamp(-desktop.getBoundingClientRect().top / scrollable, 0, 1);
      let phase, t;
      if (p < 0.40) { phase = 1; t = easeInOut(p / 0.40); }
      else if (p < 0.78) { phase = 2; t = easeInOut((p - 0.40) / 0.38); }
      else { phase = 3; t = 1; }
      const isGrid = phase === 3 || (phase === 2 && t > 0.55);
      cardEls.forEach((card, i) => {
        const pos = phase === 1 ? lerpPos(STACK[i], FAN[i], t)
                  : phase === 2 ? lerpPos(FAN[i], GRID[i], t)
                  : GRID[i];
        card.style.transform = "translate(-50%,-50%) translate(" + pos.x + "vw," + pos.y + "vh) rotate(" + pos.r + "deg)";
        card.style.pointerEvents = isGrid ? "auto" : "none";
      });
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ── Process ──────────────────────────────────────────────────────────── */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    penTool: '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  };
  const PROCESS = [
    { num: "01", icon: "search", title: "Knowing the Business", desc: "Every branding project starts with understanding the business behind the brand. We dive deep into your business goals, target audience, industry, competitors and market to build a clear picture before developing your brand strategy." },
    { num: "02", icon: "target", title: "Finding Your Edge", desc: "A strong brand stands for something specific. Through brand positioning and market research, we identify what makes your business different, who it serves best and how it can occupy a space that's difficult to replace." },
    { num: "03", icon: "fileText", title: "Defining Your Brand", desc: "This is where your brand strategy comes together. We define your brand's purpose, brand vision, values, positioning, messaging and brand voice to create a clear foundation for every future marketing and design decision." },
    { num: "04", icon: "heart", title: "Humanising the Brand", desc: "Our favourite part because this is where brands stop feeling like businesses and start feeling human. It's the moment your brand begins to feel like a person instead of a project. We shape its brand personality, tone of voice and communication style, creating a brand people don't just recognise, but they connect with." },
    { num: "05", icon: "penTool", title: "Crafting the Identity", desc: "Once the strategy is in place, we translate it into a complete visual identity. From logo design and typography to colour palettes, photography direction and graphic systems, every element is created to reflect your brand consistently across every touchpoint." },
    { num: "06", icon: "rocket", title: "Bringing It to Life", desc: "A brand does not just live in a digital presentation, it lives in the real world. We apply your visual identity across packaging design, social media, stationery, marketing collateral, print and digital touchpoints to create a complete brand system that's ready to grow with your business." },
  ];
  function initProcess() {
    const mount = $("#process-steps");
    if (!mount) return;
    mount.innerHTML = PROCESS.map((s) =>
      '<div class="process-card">' +
        '<div class="process-tick"></div>' +
        '<div class="process-row">' +
          '<div class="process-numicon">' +
            '<div class="process-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[s.icon] + "</svg></div>" +
          "</div>" +
          "<div><h4>" + s.title + "</h4><p>" + s.desc + "</p></div>" +
        "</div>" +
      "</div>"
    ).join("");
  }

  /* ── Services ─────────────────────────────────────────────────────────── */
  const SERVICES = [
    { num: "01", category: "Brand Strategy System", heading: "The hardest branding decision isn't your logo. It's giving people a reason to remember you.", desc: "Before we design anything, we help you define your positioning, understand your audience and uncover what makes your business worth choosing. That's what turns a business into a memorable brand.", flip: false, dark: false },
    { num: "02", category: "Brand Identity System", heading: "Build A Brand People Recognise", desc: "Recognition isn't built through a logo alone. It's built through consistency. We design an identity system (logo, typography, colours, imagery and brand guidelines) that makes your brand instantly known whether someone sees your packaging on quick commerce, website, social media or billboards.", flip: true, dark: true },
    { num: "03", category: "Packaging Design System", heading: "Win The Shelf Before The Sale!", desc: "Shelf space is expensive, but grabbing attention is even more valuable. Your product packaging has just a few seconds to communicate, persuade and reassure before a customer picks it up. We design strategic packaging that captures attention, intrigues and makes people choose you over competitors.", flip: false, dark: false },
  ];
  function initServices() {
    const container = $("#services-container");
    if (!container) return;
    const CARD_H = 514;
    container.style.height = (CARD_H * SERVICES.length + 400) + "px";
    const image = '<div class="service-image"><div class="placeholder-visual"><span>Image Placeholder</span></div></div>';
    SERVICES.forEach((svc) => {
      const text =
        '<div class="service-text ' + (svc.dark ? "dark" : "light") + '">' +
          "<h3>" + svc.category + "</h3>" +
          '<p class="service-sub">' + svc.heading + "</p>" +
          '<p class="service-body">' + svc.desc + "</p>" +
        "</div>";
      const card = document.createElement("div");
      card.className = "service-card";
      card.style.height = CARD_H + "px";
      card.innerHTML = svc.flip ? image + text : text + image;
      container.appendChild(card);
    });
  }

  /* ── Reviews ──────────────────────────────────────────────────────────── */
  const REVIEWS = [
    { rating: "4.9", name: "Jared Kim", role: "Marketing Director", quote: "Proactive, precise, and easy to work with — no hand-holding needed, just smooth collaboration from start to finish.", avatar: "https://i.pravatar.cc/48?img=11" },
    { rating: "5.0", name: "Maya Collins", role: "Head of Product", quote: "Felt like an embedded team with zero friction; communication was clear, and revisions landed perfectly on the first go.", avatar: "https://i.pravatar.cc/48?img=12" },
    { rating: "4.9", name: "Jesse Leigh", role: "CEO & Founder", quote: "The quality was unmatched. We submitted our request on Monday and had polished designs by Wednesday.", avatar: "https://i.pravatar.cc/48?img=13" },
    { rating: "4.9", name: "Benjamin Daul", role: "Head of Engineering", quote: "We've tried other design subscriptions — none compare to Formix. Professional, reliable, and seriously creative.", avatar: "https://i.pravatar.cc/48?img=14" },
    { rating: "5.0", name: "Michael Joseph", role: "Head of Content", quote: "Formix completely transformed the way we approach design. The turnaround time is insane and the output's always on-brand.", avatar: "https://i.pravatar.cc/48?img=15" },
    { rating: "5.0", name: "Amy Louise", role: "Customer Success Manager", quote: "It felt like an in-house design team. Communication was seamless, and revisions were spot on from the first pass.", avatar: "https://i.pravatar.cc/48?img=16" },
  ];
  function initReviews() {
    const grid = $("#reviews-grid");
    if (!grid) return;
    const star = '<svg width="26" height="26" viewBox="0 0 24 24" fill="#E42222"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    const stars = star.repeat(5);
    const silhouette = '<svg class="review-avatar" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#E8E8E8"/><circle cx="18" cy="14" r="6" fill="#C0C0C0"/><path d="M6 33c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="#C0C0C0"/></svg>';
    grid.innerHTML = REVIEWS.map((r, i) =>
      '<div class="review-card reveal" style="transition-delay:' + (i * 0.08) + 's">' +
        '<div class="review-stars">' + stars + "</div>" +
        '<p class="review-text">&ldquo;' + r.quote + "&rdquo;</p>" +
        '<div class="review-foot">' +
          silhouette +
          '<div class="info"><p class="name">' + r.name + '</p><p class="role">' + r.role + "</p></div>" +
        "</div>" +
      "</div>"
    ).join("");
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
    if (!("IntersectionObserver" in window)) {
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

  /* ── Boot ─────────────────────────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    initIntro();
    initNavbar();
    initHero();
    initDustField();
    initShowreel();
    initWhy();
    initSelectedWork();
    initProcess();
    initServices();
    initReviews();
    initTeam();
    initFAQ();
    initContact();
    initReveal(); // after dynamic content is injected
  });
})();
