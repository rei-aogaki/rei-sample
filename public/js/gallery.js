'use strict';

/* ================================================================
   REI SAMPLE — Gallery JavaScript  (Enhanced Edition)
   ================================================================ */

const API_BASE   = '/api';
const THEME_KEY  = 'rei_sample_theme';
const ANIM_CLASSES = ['anim-fade', 'anim-scale', 'anim-rotate', 'anim-split'];

const $  = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const isTouchDevice       = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================
   THEME
   ================================================================ */
function getTheme() { return localStorage.getItem(THEME_KEY); }
function setTheme(t) { document.body.className = `theme-${t}`; localStorage.setItem(THEME_KEY, t); }

/* ================================================================
   LANDING
   ================================================================ */
function initLanding() {
  const landing = $('#landing');
  const gallery = $('#gallery');
  const saved   = getTheme();

  if (saved) {
    landing.style.display = 'none';
    gallery.style.display = '';
    setTheme(saved);
    initGallery();
    return;
  }

  initLandingCanvas();

  $$('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      card.classList.add('selected');
      $$('.mode-card').forEach((c) => { if (c !== card) c.style.opacity = '0'; });
      card.style.transform = 'scale(1.1)';
      setTimeout(() => {
        landing.style.transition = 'opacity 0.5s ease';
        landing.style.opacity   = '0';
        setTimeout(() => {
          landing.style.display = 'none';
          gallery.style.display = '';
          setTheme(mode);
          initGallery();
        }, 500);
      }, 300);
    });
  });
}

function initLandingCanvas() {
  const canvas = $('#landingCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const dots = [];
  let mouse = { x: -999, y: -999 };

  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

  for (let i = 0; i < 140; i++) {
    dots.push({
      x: Math.random() * (typeof w !== 'undefined' ? w : window.innerWidth),
      y: Math.random() * (typeof h !== 'undefined' ? h : window.innerHeight),
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 2.5 + 0.5,
      a: Math.random() * 0.5 + 0.1,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    // connections
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 140) {
          ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y);
          ctx.strokeStyle = `rgba(255,255,255,${0.1 * (1 - dist/140)})`; ctx.lineWidth = 0.8; ctx.stroke();
        }
      }
    }
    dots.forEach((d) => {
      // mouse repulsion
      const mdx = d.x - mouse.x, mdy = d.y - mouse.y;
      const md = Math.sqrt(mdx*mdx + mdy*mdy);
      if (md < 120 && md > 0) { d.vx += (mdx / md) * 0.15; d.vy += (mdy / md) * 0.15; }
      // damping
      d.vx *= 0.98; d.vy *= 0.98;
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = w; if (d.x > w) d.x = 0;
      if (d.y < 0) d.y = h; if (d.y > h) d.y = 0;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${d.a})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

/* ================================================================
   GALLERY INIT
   ================================================================ */
let galleryInitDone = false;

function initGallery() {
  if (galleryInitDone) return;
  galleryInitDone = true;

  loadPhotos();
  initScrollProgress();
  initModeSwitchBtn();

  if (!prefersReducedMotion) {
    initParticles();
    initBackgroundEffect();
  }
  initGeoBackground();
}

function initModeSwitchBtn() {
  const btn = $('#modeSwitchBtn');
  if (!btn) return;
  btn.addEventListener('click', () => { localStorage.removeItem(THEME_KEY); location.reload(); });
}

/* ================================================================
   PHOTO LOADING
   ================================================================ */
async function loadPhotos() {
  try {
    const res = await fetch(`${API_BASE}/photos`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    renderPhotos(json.data || []);
  } catch (err) {
    console.error('Failed to load photos:', err);
    renderPhotos([]);
  }
}

function renderPhotos(photos) {
  const list = $('#photoList');
  const hint = $('#scrollHint');
  if (!list) return;

  if (!photos.length) {
    list.innerHTML = `<div style="text-align:center;padding:4rem 1rem;opacity:0.5;">
      <p style="font-size:1.2rem;margin-bottom:0.5rem;">No photos yet</p>
      <p style="font-size:0.8rem;">Upload photos from the admin panel</p></div>`;
    if (hint) hint.style.display = 'none';
    return;
  }

  list.innerHTML = '';
  photos.forEach((photo, i) => {
    const item = document.createElement('div');
    item.className = 'photo-item ' + ANIM_CLASSES[Math.floor(Math.random() * ANIM_CLASSES.length)];

    item.innerHTML = `
      <div class="photo-wrap" data-index="${i}" role="button" tabindex="0" aria-label="${escapeHtml(photo.title)}">
        <div class="photo-loading-indicator"></div>
        <img class="photo-img" alt="${escapeHtml(photo.title)}" loading="lazy" decoding="async" />
        <div class="shine-overlay"></div>
      </div>`;

    list.appendChild(item);

    const imgEl = item.querySelector('.photo-img');
    const loadEl = item.querySelector('.photo-loading-indicator');
    loadImageWithRetry(imgEl, photo.url, loadEl);

    item.querySelector('.photo-wrap').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.querySelector('.photo-wrap').click(); }
    });
  });

  initScrollAnimations();
  if (!isTouchDevice()) initTiltEffect();
  initLightbox(photos);

  if (hint) {
    const hide = () => { if (window.scrollY > 100) { hint.style.opacity = '0'; window.removeEventListener('scroll', hide); } };
    window.addEventListener('scroll', hide, { passive: true });
  }
}

/* ================================================================
   IMAGE RETRY
   ================================================================ */
function loadImageWithRetry(imgEl, src, loadingEl, maxRetries = 3) {
  let retries = 0;
  function tryLoad() {
    imgEl.onload = () => { if (loadingEl) loadingEl.style.display = 'none'; imgEl.classList.add('loaded'); };
    imgEl.onerror = () => {
      if (retries < maxRetries) {
        retries++;
        setTimeout(() => { imgEl.src = src + (src.includes('?') ? '&' : '?') + `_r=${retries}`; }, 900 * retries);
      } else {
        if (loadingEl) loadingEl.style.display = 'none';
        imgEl.closest('.photo-item')?.classList.add('load-error');
        imgEl.style.display = 'none';
        const wrap = imgEl.closest('.photo-wrap');
        if (wrap && !wrap.querySelector('.error-placeholder')) {
          const ph = document.createElement('div'); ph.className = 'error-placeholder'; ph.innerHTML = '<span>⚠</span>'; wrap.appendChild(ph);
        }
      }
    };
    imgEl.src = src;
  }
  tryLoad();
}

/* ================================================================
   SCROLL ANIMATIONS
   ================================================================ */
function initScrollAnimations() {
  const items = $$('.photo-item');
  if (!items.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
  items.forEach((item) => obs.observe(item));
}

/* ================================================================
   3D TILT + SHINE EFFECT  (desktop only)
   ================================================================ */
function initTiltEffect() {
  const theme  = getTheme();
  // ── Max-drama tilt settings ──
  const maxRot = theme === 'pop' ? 28 : theme === 'inorganic' ? 32 : 38; // degrees
  const scale  = 1.10;

  $$('.photo-wrap').forEach((wrap) => {
    const shine = wrap.querySelector('.shine-overlay');
    let rafId = null;
    let currentRX = 0, currentRY = 0;
    let targetRX  = 0, targetRY  = 0;
    let isHovered = false;

    function lerp(a, b, t) { return a + (b - a) * t; }

    function tick() {
      currentRX = lerp(currentRX, targetRX, 0.16); // faster response
      currentRY = lerp(currentRY, targetRY, 0.16);

      if (isHovered) {
        wrap.style.transition = 'none';
        wrap.style.transform  = `perspective(600px) rotateX(${currentRX}deg) rotateY(${currentRY}deg) scale3d(${scale},${scale},${scale}) translateZ(20px)`;
      } else {
        currentRX = lerp(currentRX, 0, 0.12);
        currentRY = lerp(currentRY, 0, 0.12);
        if (Math.abs(currentRX) < 0.05 && Math.abs(currentRY) < 0.05) {
          wrap.style.transition = 'transform 0.55s cubic-bezier(0.16,1,0.3,1)';
          wrap.style.transform  = '';
          cancelAnimationFrame(rafId); rafId = null;
          return;
        }
        wrap.style.transition = 'none';
        wrap.style.transform  = `perspective(600px) rotateX(${currentRX}deg) rotateY(${currentRY}deg) scale3d(1,1,1)`;
      }
      rafId = requestAnimationFrame(tick);
    }

    wrap.addEventListener('mouseenter', () => {
      isHovered = true;
      if (!rafId) rafId = requestAnimationFrame(tick);
      if (shine) shine.style.opacity = '1';
    });

    wrap.addEventListener('mousemove', (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - 0.5; // -0.5 … 0.5
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      targetRY =  x * maxRot;
      targetRX = -y * maxRot;

      // Shine highlight position — stronger specular highlight
      if (shine) {
        const px = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
        const py = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
        shine.style.background = `radial-gradient(ellipse at ${px}% ${py}%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 30%, transparent 60%)`;
      }
    });

    wrap.addEventListener('mouseleave', () => {
      isHovered = false;
      targetRX  = 0; targetRY = 0;
      if (shine) shine.style.opacity = '0';
      if (!rafId) rafId = requestAnimationFrame(tick);
    });

    // Click: brief deep-press dip
    wrap.addEventListener('mousedown', () => {
      wrap.style.transition = 'transform 0.08s ease';
      wrap.style.transform  = `perspective(600px) rotateX(${currentRX}deg) rotateY(${currentRY}deg) scale3d(0.93,0.93,0.93)`;
    });
    wrap.addEventListener('mouseup', () => {
      wrap.style.transition = 'none';
      wrap.style.transform  = `perspective(600px) rotateX(${currentRX}deg) rotateY(${currentRY}deg) scale3d(${scale},${scale},${scale}) translateZ(20px)`;
    });
  });
}

/* ================================================================
   LIGHTBOX
   ================================================================ */
function initLightbox(photos) {
  const lb      = $('#lightbox');
  const img     = $('#lightboxImg');
  const closeBtn = $('#lightboxClose');
  const prevBtn  = $('#lightboxPrev');
  const nextBtn  = $('#lightboxNext');
  if (!lb || !img) return;

  const caption = $('#lightboxCaption');
  const counter = $('#lightboxCounter');
  let current = 0, scale = 1, lastDist = 0;

  function updateCaption(i) {
    if (caption) caption.textContent = photos[i].title || '';
    if (counter) counter.textContent = `${i + 1} / ${photos.length}`;
  }
  function open(i) {
    current = i; img.src = photos[i].url; img.alt = photos[i].title || '';
    img.style.transform = ''; scale = 1; updateCaption(i);
    lb.classList.add('active'); document.body.style.overflow = 'hidden';
  }
  function close() { lb.classList.remove('active'); document.body.style.overflow = ''; }
  function nav(dir) {
    current = (current + dir + photos.length) % photos.length;
    img.style.opacity = '0'; if (caption) caption.style.opacity = '0';
    setTimeout(() => {
      img.src = photos[current].url; img.alt = photos[current].title || '';
      img.style.opacity = '1'; if (caption) caption.style.opacity = '0.8';
      scale = 1; img.style.transform = ''; updateCaption(current);
    }, 200);
  }

  $$('.photo-wrap').forEach((wrap) => {
    wrap.addEventListener('click', () => { const idx = parseInt(wrap.dataset.index, 10); if (!isNaN(idx)) open(idx); });
  });
  closeBtn?.addEventListener('click', close);
  prevBtn?.addEventListener('click',  () => nav(-1));
  nextBtn?.addEventListener('click',  () => nav(1));
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lightbox-backdrop')) close(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('active')) return;
    if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') nav(-1); if (e.key === 'ArrowRight') nav(1);
  });

  let touchStartX = 0;
  lb.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
    if (e.touches.length === 2) lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  lb.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastDist > 0) { scale = Math.max(1, Math.min(4, scale * (dist / lastDist))); img.style.transform = `scale(${scale})`; }
      lastDist = dist;
    }
  }, { passive: false });
  lb.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) { lastDist = 0; if (scale < 1.05) { scale = 1; img.style.transform = ''; } }
    if (e.touches.length === 0 && scale <= 1.05) { const dx = e.changedTouches[0].clientX - touchStartX; if (Math.abs(dx) > 60) nav(dx > 0 ? -1 : 1); }
  });
}

/* ================================================================
   SCROLL PROGRESS
   ================================================================ */
function initScrollProgress() {
  const bar = $('#scrollProgress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.height = `${h > 0 ? (window.scrollY / h) * 100 : 0}%`;
  }, { passive: true });
}

/* ================================================================
   PARTICLE SYSTEM — Much more dramatic
   ================================================================ */
function initParticles() {
  const canvas = $('#particleCanvas');
  if (!canvas) return;
  const ctx   = canvas.getContext('2d');
  let w, h;
  const theme = getTheme();
  const particles = [];
  let mouse = { x: w / 2, y: h / 2 };

  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

  const count = theme === 'pop' ? 120 : theme === 'cyber' ? 160 : 80;
  for (let i = 0; i < count; i++) particles.push(createParticle(w, h, theme, true));

  function draw() {
    // Theme-specific clear
    if (theme === 'cyber') {
      ctx.fillStyle = 'rgba(10,10,10,0.18)'; // trail effect
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    // CYBER — dense connection web
    if (theme === 'cyber') {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 160) {
            const a = 0.25 * (1 - dist / 160);
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,212,255,${a})`; ctx.lineWidth = 1; ctx.stroke();
          }
        }
        // mouse proximity connection — strong glow
        const mdx = particles[i].x - mouse.x, mdy = particles[i].y - mouse.y;
        const md  = Math.sqrt(mdx*mdx + mdy*mdy);
        if (md < 220) {
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(0,255,200,${0.35 * (1 - md/220)})`; ctx.lineWidth = 1.2; ctx.stroke();
        }
      }
      // Mouse burst circle
      const burstGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 80);
      burstGrad.addColorStop(0, 'rgba(0,212,255,0.12)');
      burstGrad.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 80, 0, Math.PI*2);
      ctx.fillStyle = burstGrad; ctx.fill();
    }

    particles.forEach((p, i) => {
      // mouse interaction
      if (theme === 'cyber') {
        const mdx = p.x - mouse.x, mdy = p.y - mouse.y;
        const md  = Math.sqrt(mdx*mdx + mdy*mdy);
        if (md < 150 && md > 0) { p.vx += (mdx / md) * 0.3; p.vy += (mdy / md) * 0.3; }
      }
      if (theme === 'pop') {
        const mdx = p.x - mouse.x, mdy = p.y - mouse.y;
        const md  = Math.sqrt(mdx*mdx + mdy*mdy);
        if (md < 100 && md > 0) { p.vx += (mdx / md) * 0.2; p.vy += (mdy / md) * 0.2; }
      }

      // damping
      p.vx *= 0.97; p.vy *= 0.97;
      p.x += p.vx; p.y += p.vy;
      p.life--;
      if (theme === 'inorganic') p.angle += p.spin;

      if (p.life <= 0 || p.y < -60 || p.x < -60 || p.x > w + 60 || p.y > h + 60) {
        particles[i] = createParticle(w, h, theme, false); return;
      }

      const lr    = p.life / p.maxLife;
      const alpha = Math.min(lr * 4, 1) * Math.min((1 - lr) * 4, 1) * p.baseAlpha;
      ctx.save(); ctx.globalAlpha = Math.max(0, alpha);

      if (theme === 'pop') {
        // Large emoji with glow
        ctx.shadowColor = p.color; ctx.shadowBlur = 12;
        ctx.font = `${p.size}px serif`; ctx.fillText(p.char, p.x, p.y);
      } else if (theme === 'inorganic') {
        ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.strokeStyle = p.color; ctx.lineWidth = p.thick || 0.8;
        drawShape(ctx, p.shape, p.size);
      } else {
        // Cyber: bright glowing core + large halo
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5);
        grad.addColorStop(0,   p.color);
        grad.addColorStop(0.3, p.color.replace('0.9', '0.4'));
        grad.addColorStop(1,   'transparent');
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI*2);
        ctx.fillStyle = grad; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fillStyle = '#fff'; ctx.fill();
      }
      ctx.restore();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

function createParticle(w, h, theme, randomY = false) {
  const life = Math.random() * 500 + 250;
  const base = {
    x: Math.random() * w,
    y: randomY ? Math.random() * h : (Math.random() > 0.5 ? -20 : h + 20),
    life, maxLife: life,
    baseAlpha: Math.random() * 0.6 + 0.2,
  };

  if (theme === 'pop') {
    const chars = ['♥','★','✦','♡','☆','✿','◎','♪','✨','💫','🌸','🌟'];
    return { ...base,
      vx: (Math.random()-0.5) * 0.8, vy: -(Math.random()*1.2+0.4),
      size: Math.random()*22+12,
      char: chars[Math.floor(Math.random()*chars.length)],
      color: ['#ff69b4','#ffd700','#b19cd9','#87ceeb','#ff85c2','#ffe4b5','#ff1493','#da70d6'][Math.floor(Math.random()*8)],
    };
  }
  if (theme === 'inorganic') {
    const shapes = ['triangle','square','circle','cross','diamond'];
    return { ...base,
      y: randomY ? Math.random() * h : Math.random() * h,
      vx: (Math.random()-0.5)*0.35, vy: (Math.random()-0.5)*0.35,
      size: Math.random()*20+8, thick: Math.random()*1.5+0.5,
      shape: shapes[Math.floor(Math.random()*shapes.length)],
      angle: Math.random()*Math.PI*2, spin: (Math.random()-0.5)*0.012,
      color: Math.random()>0.88 ? '#cc0000' : `rgba(0,0,0,${Math.random()*0.18+0.06})`,
      baseAlpha: Math.random()*0.4+0.1,
    };
  }
  // Cyber
  return { ...base,
    vx: (Math.random()-0.5)*0.7, vy: -(Math.random()*0.6+0.1),
    size: Math.random()*3+0.8,
    color: ['rgba(0,212,255,0.9)','rgba(0,212,255,0.7)','rgba(255,255,255,0.9)','rgba(255,0,110,0.8)','rgba(0,255,180,0.8)'][Math.floor(Math.random()*5)],
  };
}

function drawShape(ctx, shape, size) {
  const s = size / 2;
  ctx.beginPath();
  switch (shape) {
    case 'triangle': ctx.moveTo(0,-s); ctx.lineTo(-s,s); ctx.lineTo(s,s); ctx.closePath(); break;
    case 'square':   ctx.rect(-s,-s,size,size); break;
    case 'circle':   ctx.arc(0,0,s,0,Math.PI*2); break;
    case 'cross':    ctx.moveTo(-s,0); ctx.lineTo(s,0); ctx.moveTo(0,-s); ctx.lineTo(0,s); break;
    case 'diamond':  ctx.moveTo(0,-s); ctx.lineTo(s,0); ctx.lineTo(0,s); ctx.lineTo(-s,0); ctx.closePath(); break;
  }
  ctx.stroke();
}

/* ================================================================
   EXTRA BG EFFECTS — Maximum drama per theme
   ================================================================ */
function initBackgroundEffect() {
  const theme = getTheme();
  if (theme === 'cyber')     initCyberBg();
  if (theme === 'pop')       initPopBg();
  if (theme === 'inorganic') initInorganicBg();
}

/* ── CYBER ── */
function initCyberBg() {
  const styleId = 'cyberBgStyle';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style'); s.id = styleId;
    s.textContent = `
      @keyframes scanMove  { 0%{top:-4px;opacity:0} 3%{opacity:0.9} 97%{opacity:0.6} 100%{top:100vh;opacity:0} }
      @keyframes dataFall  { 0%{top:-120px;opacity:0} 8%{opacity:0.7} 92%{opacity:0.4} 100%{top:110vh;opacity:0} }
      @keyframes gridPulse { 0%,100%{opacity:0.04} 50%{opacity:0.16} }
      @keyframes neonFlash { 0%,100%{opacity:0} 45%,55%{opacity:0.5} }
      .cyber-scanline { position:fixed;left:0;right:0;height:3px;z-index:1;pointer-events:none;
        background:linear-gradient(transparent,rgba(0,212,255,0.18),rgba(0,212,255,0.08),transparent);
        animation:scanMove linear infinite; }
      .cyber-data-stream { position:fixed;width:1px;z-index:1;pointer-events:none;
        background:linear-gradient(transparent,rgba(0,212,255,0.5),rgba(0,212,255,0.2),transparent);
        animation:dataFall linear infinite; }
      .cyber-grid-h { position:fixed;left:0;right:0;height:1px;z-index:0;pointer-events:none;
        background:rgba(0,212,255,0.15);animation:gridPulse ease-in-out infinite; }
      .cyber-grid-v { position:fixed;top:0;bottom:0;width:1px;z-index:0;pointer-events:none;
        background:rgba(0,212,255,0.15);animation:gridPulse ease-in-out infinite; }
      .cyber-neon-flash { position:fixed;left:0;right:0;height:2px;z-index:2;pointer-events:none;
        background:rgba(255,0,110,0.7);box-shadow:0 0 12px rgba(255,0,110,0.8);
        animation:neonFlash ease-in-out infinite; }`;
    document.head.appendChild(s);
  }

  // 6 scanlines at different speeds
  [2, 4, 6, 8, 11, 15].forEach((dur, i) => {
    const el = document.createElement('div'); el.className = 'cyber-scanline';
    el.style.animationDuration = `${dur}s`; el.style.animationDelay = `${i * 1.2}s`;
    document.body.appendChild(el);
  });

  // 35 data streams — dense rain
  for (let i = 0; i < 35; i++) {
    const el = document.createElement('div'); el.className = 'cyber-data-stream';
    const h  = 60 + Math.random() * 160;
    el.style.cssText += `left:${Math.random()*98}%;height:${h}px;
      animation-duration:${2+Math.random()*6}s;animation-delay:${Math.random()*5}s;`;
    document.body.appendChild(el);
  }

  // Dense grid lines
  for (let i = 1; i <= 14; i++) {
    const h = document.createElement('div'); h.className = 'cyber-grid-h';
    h.style.cssText += `top:${i*7}%;animation-duration:${3+Math.random()*5}s;animation-delay:${Math.random()*4}s;`;
    document.body.appendChild(h);
    const v = document.createElement('div'); v.className = 'cyber-grid-v';
    v.style.cssText += `left:${i*7}%;animation-duration:${4+Math.random()*5}s;animation-delay:${Math.random()*4}s;`;
    document.body.appendChild(v);
  }

  // More frequent neon flash lines
  [6, 11, 17, 24, 38].forEach((dur, i) => {
    const el = document.createElement('div'); el.className = 'cyber-neon-flash';
    el.style.top = `${10 + i * 18}%`;
    el.style.animationDuration = `${dur}s`; el.style.animationDelay = `${i * 3}s`;
    document.body.appendChild(el);
  });
}

/* ── POP ── */
function initPopBg() {
  const styleId = 'popBgStyle';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style'); s.id = styleId;
    s.textContent = `
      @keyframes blobDrift  { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,-40px) scale(1.15)} 66%{transform:translate(-40px,50px) scale(0.9)} }
      @keyframes blobPulse  { 0%,100%{opacity:0.08} 50%{opacity:0.22} }
      @keyframes rainbowWave{ 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      @keyframes sparkle    { 0%,100%{opacity:0;transform:scale(0)} 50%{opacity:1;transform:scale(1)} }
      .pop-blob { position:fixed;border-radius:60% 40% 55% 45% / 50% 60% 40% 50%;pointer-events:none;z-index:0;
        filter:blur(60px);
        animation:blobDrift ease-in-out infinite, blobPulse ease-in-out infinite; }
      .pop-rainbow { position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0.07;
        background:linear-gradient(135deg,#ff69b4,#ffd700,#b19cd9,#87ceeb,#ff69b4,#ffd700);
        background-size:400% 400%; animation:rainbowWave 12s ease infinite; }
      .pop-sparkle { position:fixed;pointer-events:none;z-index:1;font-size:1.4rem;
        animation:sparkle ease-in-out infinite; }`;
    document.head.appendChild(s);
  }

  // Rainbow base layer
  const rb = document.createElement('div'); rb.className = 'pop-rainbow';
  document.body.appendChild(rb);

  // Oversized floating blobs — max drama
  const blobConfigs = [
    { color:'#ff69b4', size:720, left:5,  top:10, dur:12, delay:0 },
    { color:'#ffd700', size:620, left:55, top:0,  dur:16, delay:2 },
    { color:'#b19cd9', size:780, left:22, top:48, dur:14, delay:5 },
    { color:'#87ceeb', size:560, left:70, top:52, dur:10, delay:1 },
    { color:'#ff85c2', size:680, left:0,  top:65, dur:18, delay:7 },
    { color:'#ffe4b5', size:500, left:76, top:22, dur:13, delay:3 },
    { color:'#ff1493', size:420, left:40, top:78, dur:20, delay:9 },
    { color:'#da70d6', size:540, left:14, top:32, dur:11, delay:6 },
  ];
  blobConfigs.forEach(({ color, size, left, top, dur, delay }) => {
    const el = document.createElement('div'); el.className = 'pop-blob';
    el.style.cssText += `width:${size}px;height:${size}px;left:${left}%;top:${top}%;
      background:radial-gradient(circle,${color} 0%,transparent 65%);
      opacity:0.20;
      animation-duration:${dur}s,${dur*0.7}s;animation-delay:${delay}s,${delay}s;`;
    document.body.appendChild(el);
  });

  // More sparkles scattered around
  const sparkleChars = ['✨','💫','⭐','🌸','✦','♥','★','🌟','💖','🦋','✿','◎','♪','❤'];
  for (let i = 0; i < 32; i++) {
    const el = document.createElement('div'); el.className = 'pop-sparkle';
    el.textContent = sparkleChars[i % sparkleChars.length];
    const dur   = 2 + Math.random() * 3;
    const delay = Math.random() * 4;
    el.style.cssText += `left:${Math.random()*95}%;top:${Math.random()*95}%;
      animation-duration:${dur}s;animation-delay:${delay}s;`;
    document.body.appendChild(el);
  }
}

/* ── INORGANIC ── */
function initInorganicBg() {
  const styleId = 'inorgBgStyle';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style'); s.id = styleId;
    s.textContent = `
      @keyframes gridFlash  { 0%,100%{opacity:0} 50%{opacity:0.22} }
      @keyframes geoRotate  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes geoPulse   { 0%,100%{opacity:0.06;transform:scale(1)} 50%{opacity:0.2;transform:scale(1.08)} }
      @keyframes glitchLine { 0%,89%,100%{opacity:0} 90%,97%{opacity:0.6;transform:scaleX(1)} 93%{transform:scaleX(0.3) translateX(40px)} }
      .inorg-grid-h { position:fixed;left:0;right:0;height:1px;z-index:0;pointer-events:none;background:#222;animation:gridFlash linear infinite; }
      .inorg-grid-v { position:fixed;top:0;bottom:0;width:1px;z-index:0;pointer-events:none;background:#222;animation:gridFlash linear infinite; }
      .inorg-geo { position:fixed;pointer-events:none;z-index:0;animation:geoPulse ease-in-out infinite; }
      .inorg-geo svg { animation:geoRotate linear infinite; }
      .inorg-glitch { position:fixed;left:0;right:0;height:2px;z-index:2;pointer-events:none;background:#ff0000;animation:glitchLine linear infinite; }`;
    document.head.appendChild(s);
  }

  // Ultra-dense grid — H lines
  for (let i = 1; i <= 22; i++) {
    const el = document.createElement('div'); el.className = 'inorg-grid-h';
    el.style.cssText += `top:${i*4.5}%;animation-duration:${4+Math.random()*8}s;animation-delay:${Math.random()*6}s;`;
    document.body.appendChild(el);
  }
  // Ultra-dense grid — V lines
  for (let i = 1; i <= 22; i++) {
    const el = document.createElement('div'); el.className = 'inorg-grid-v';
    el.style.cssText += `left:${i*4.5}%;animation-duration:${5+Math.random()*8}s;animation-delay:${Math.random()*6}s;`;
    document.body.appendChild(el);
  }

  // Large geometric shapes
  const sizes  = [200, 280, 160, 320, 240];
  const colors = ['#333','#555','#444','#222','#666'];
  sizes.forEach((sz, i) => {
    const el = document.createElement('div'); el.className = 'inorg-geo';
    const dur   = 25 + i * 8;
    const delay = i * 3;
    const left  = [5, 70, 20, 80, 45][i];
    const top   = [10, 5, 60, 50, 80][i];
    el.style.cssText += `width:${sz}px;height:${sz}px;left:${left}%;top:${top}%;
      animation-duration:${dur}s;animation-delay:${delay}s;`;
    el.innerHTML = `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${i % 3 === 0
        ? `<polygon points="${sz/2},8 ${sz-8},${sz-8} 8,${sz-8}" stroke="${colors[i]}" stroke-width="1.5"/>`
        : i % 3 === 1
          ? `<rect x="8" y="8" width="${sz-16}" height="${sz-16}" stroke="${colors[i]}" stroke-width="1.5"/>`
          : `<circle cx="${sz/2}" cy="${sz/2}" r="${sz/2-8}" stroke="${colors[i]}" stroke-width="1.5"/>`}
    </svg>`;
    el.querySelector('svg').style.animationDuration = `${dur}s`;
    document.body.appendChild(el);
  });

  // More frequent glitch lines
  [0, 1, 2, 3, 4].forEach((i) => {
    const el = document.createElement('div'); el.className = 'inorg-glitch';
    el.style.top = `${12 + i * 20}%`;
    el.style.animationDuration = `${6 + i * 4}s`; el.style.animationDelay = `${i * 2}s`;
    document.body.appendChild(el);
  });
}

/* ================================================================
   GEO BACKGROUND (INORGANIC static layer)
   ================================================================ */
function initGeoBackground() {
  const svg = $('#geoBackground');
  if (!svg || getTheme() !== 'inorganic') return;

  const w = window.innerWidth, h = window.innerHeight * 3;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', w); svg.setAttribute('height', h);

  let content = '';
  for (let x = 0; x < w; x += 70) content += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#ccc" stroke-width="0.5" opacity="0.2"/>`;
  for (let y = 0; y < h; y += 70) content += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#ccc" stroke-width="0.5" opacity="0.2"/>`;
  for (let i = 0; i < 25; i++) {
    const cx = Math.random()*w, cy = Math.random()*h, r = Math.random()*90+20;
    content += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#bbb" stroke-width="0.5" opacity="0.15"/>`;
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.random()*w, y = Math.random()*h, s = Math.random()*60+20;
    content += `<polygon points="${x},${y-s} ${x-s*0.87},${y+s*0.5} ${x+s*0.87},${y+s*0.5}" fill="none" stroke="#bbb" stroke-width="0.5" opacity="0.12"/>`;
  }
  svg.innerHTML = content;
}

/* ================================================================
   UTILS
   ================================================================ */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', initLanding);
