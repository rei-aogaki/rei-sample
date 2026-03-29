'use strict';

/* ================================================================
   REI SAMPLE — Gallery JavaScript
   ================================================================ */

const API_BASE = '/api';
const THEME_KEY = 'rei_sample_theme';
const ANIM_CLASSES = ['anim-fade', 'anim-scale', 'anim-rotate', 'anim-split'];

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================
   THEME MANAGEMENT
   ================================================================ */

function getTheme() { return localStorage.getItem(THEME_KEY); }

function setTheme(theme) {
  document.body.className = `theme-${theme}`;
  localStorage.setItem(THEME_KEY, theme);
}

/* ================================================================
   LANDING PAGE
   ================================================================ */

function initLanding() {
  const landing = $('#landing');
  const gallery = $('#gallery');
  const saved = getTheme();

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
        landing.style.opacity = '0';
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

  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 60; i++) {
    dots.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      a: Math.random() * 0.4 + 0.1,
    });
  }
  // Connection lines
  function draw() {
    ctx.clearRect(0, 0, w, h);
    // Draw connections
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(dots[i].x, dots[i].y);
          ctx.lineTo(dots[j].x, dots[j].y);
          ctx.strokeStyle = `rgba(255,255,255,${0.06 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    dots.forEach((d) => {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = w; if (d.x > w) d.x = 0;
      if (d.y < 0) d.y = h; if (d.y > h) d.y = 0;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${d.a})`;
      ctx.fill();
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

/* ================================================================
   MODE SWITCH
   ================================================================ */

function initModeSwitchBtn() {
  const btn = $('#modeSwitchBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    localStorage.removeItem(THEME_KEY);
    location.reload();
  });
}

/* ================================================================
   PHOTO LOADING
   ================================================================ */

async function loadPhotos() {
  try {
    const res = await fetch(`${API_BASE}/photos`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const photos = json.data || [];
    renderPhotos(photos);
  } catch (err) {
    console.error('Failed to load photos:', err);
    renderPhotos([]);
  }
}

function renderPhotos(photos) {
  const list = $('#photoList');
  const hint = $('#scrollHint');
  if (!list) return;

  if (photos.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:4rem 1rem;opacity:0.5;">
        <p style="font-size:1.2rem;margin-bottom:0.5rem;">No photos yet</p>
        <p style="font-size:0.8rem;">Upload photos from the admin panel</p>
      </div>`;
    if (hint) hint.style.display = 'none';
    return;
  }

  list.innerHTML = '';
  photos.forEach((photo, i) => {
    const item = document.createElement('div');
    item.className = 'photo-item';
    const animClass = ANIM_CLASSES[Math.floor(Math.random() * ANIM_CLASSES.length)];
    item.classList.add(animClass);

    item.innerHTML = `
      <div class="photo-wrap" data-index="${i}" role="button" tabindex="0" aria-label="${escapeHtml(photo.title)} — クリックして拡大">
        <div class="photo-loading-indicator"></div>
        <img class="photo-img" alt="${escapeHtml(photo.title)}" loading="lazy" decoding="async" />
      </div>`;

    list.appendChild(item);

    // Lazy-load with retry
    const imgEl = item.querySelector('.photo-img');
    const loadingEl = item.querySelector('.photo-loading-indicator');
    loadImageWithRetry(imgEl, photo.url, loadingEl);

    // Keyboard support
    item.querySelector('.photo-wrap').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.querySelector('.photo-wrap').click();
      }
    });
  });

  initScrollAnimations();
  initPressEffect();
  initLightbox(photos);

  if (hint) {
    const hideHint = () => {
      if (window.scrollY > 100) {
        hint.style.opacity = '0';
        window.removeEventListener('scroll', hideHint);
      }
    };
    window.addEventListener('scroll', hideHint, { passive: true });
  }
}

/* ================================================================
   IMAGE RETRY LOADING
   ================================================================ */

function loadImageWithRetry(imgEl, src, loadingEl, maxRetries = 3) {
  let retries = 0;

  function tryLoad() {
    imgEl.onload = () => {
      if (loadingEl) loadingEl.style.display = 'none';
      imgEl.classList.add('loaded');
    };
    imgEl.onerror = () => {
      if (retries < maxRetries) {
        retries++;
        const delay = 800 * retries;
        setTimeout(() => {
          // Cache-bust to force retry
          imgEl.src = src + (src.includes('?') ? '&' : '?') + `_retry=${retries}`;
        }, delay);
      } else {
        // Final failure
        if (loadingEl) loadingEl.style.display = 'none';
        imgEl.closest('.photo-item')?.classList.add('load-error');
        imgEl.style.display = 'none';
        const wrap = imgEl.closest('.photo-wrap');
        if (wrap && !wrap.querySelector('.error-placeholder')) {
          const ph = document.createElement('div');
          ph.className = 'error-placeholder';
          ph.innerHTML = '<span>⚠</span>';
          wrap.appendChild(ph);
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
  if (items.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });

  items.forEach((item) => observer.observe(item));
}

/* ================================================================
   PRESS EFFECT (replaces magnetic tilt)
   ================================================================ */

function initPressEffect() {
  // CSS handles hover state; JS adds mousedown "deep press"
  $$('.photo-wrap').forEach((wrap) => {
    wrap.addEventListener('mousedown', () => wrap.classList.add('pressing'));
    wrap.addEventListener('mouseup', () => wrap.classList.remove('pressing'));
    wrap.addEventListener('mouseleave', () => wrap.classList.remove('pressing'));
  });
}

/* ================================================================
   LIGHTBOX
   ================================================================ */

function initLightbox(photos) {
  const lb = $('#lightbox');
  const img = $('#lightboxImg');
  const closeBtn = $('#lightboxClose');
  const prevBtn = $('#lightboxPrev');
  const nextBtn = $('#lightboxNext');
  if (!lb || !img) return;

  const caption = $('#lightboxCaption');
  const counter = $('#lightboxCounter');
  let current = 0;
  let scale = 1;
  let lastDist = 0;

  function updateCaption(index) {
    if (caption) caption.textContent = photos[index].title || '';
    if (counter) counter.textContent = `${index + 1} / ${photos.length}`;
  }

  function open(index) {
    current = index;
    img.src = photos[index].url;
    img.alt = photos[index].title || '';
    img.style.transform = '';
    scale = 1;
    updateCaption(index);
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lb.classList.remove('active');
    document.body.style.overflow = '';
  }

  function nav(dir) {
    current = (current + dir + photos.length) % photos.length;
    img.style.opacity = '0';
    if (caption) caption.style.opacity = '0';
    setTimeout(() => {
      img.src = photos[current].url;
      img.alt = photos[current].title || '';
      img.style.opacity = '1';
      if (caption) caption.style.opacity = '0.8';
      scale = 1;
      img.style.transform = '';
      updateCaption(current);
    }, 200);
  }

  $$('.photo-wrap').forEach((wrap) => {
    wrap.addEventListener('click', () => {
      const idx = parseInt(wrap.dataset.index, 10);
      if (!isNaN(idx)) open(idx);
    });
  });

  closeBtn?.addEventListener('click', close);
  prevBtn?.addEventListener('click', () => nav(-1));
  nextBtn?.addEventListener('click', () => nav(1));

  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.classList.contains('lightbox-backdrop')) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('active')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') nav(-1);
    if (e.key === 'ArrowRight') nav(1);
  });

  let touchStartX = 0;
  lb.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
    if (e.touches.length === 2) {
      lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  lb.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastDist > 0) {
        scale = Math.max(1, Math.min(4, scale * (dist / lastDist)));
        img.style.transform = `scale(${scale})`;
      }
      lastDist = dist;
    }
  }, { passive: false });

  lb.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) { lastDist = 0; if (scale < 1.05) { scale = 1; img.style.transform = ''; } }
    if (e.touches.length === 0 && scale <= 1.05) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 60) nav(dx > 0 ? -1 : 1);
    }
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
    const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
    bar.style.height = `${pct}%`;
  }, { passive: true });
}

/* ================================================================
   PARTICLE SYSTEMS — Enhanced per theme
   ================================================================ */

function initParticles() {
  const canvas = $('#particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [];
  const theme = getTheme();

  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  // Theme-specific counts
  const count = theme === 'pop' ? 80 : theme === 'cyber' ? 90 : 60;
  for (let i = 0; i < count; i++) particles.push(createParticle(w, h, theme, true));

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // CYBER: draw connection lines between nearby dots
    if (theme === 'cyber') {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            const a = 0.08 * (1 - dist / 100);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,212,255,${a})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy;
      p.life--;
      if (theme === 'inorganic') p.angle += p.spin;

      if (p.life <= 0 || p.y < -40 || p.x < -40 || p.x > w + 40) {
        particles[i] = createParticle(w, h, theme, false);
        return;
      }

      const lifeRatio = p.life / p.maxLife;
      const alpha = Math.min(lifeRatio * 3, 1) * (1 - Math.max(0, (1 - lifeRatio) * 2 - 0.6)) * p.baseAlpha;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);

      if (theme === 'pop') {
        ctx.font = `${p.size}px serif`;
        ctx.fillText(p.char, p.x, p.y);
      } else if (theme === 'inorganic') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.7;
        drawShape(ctx, p.shape, p.size);
      } else {
        // Cyber: glowing dot with halo
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.restore();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

function createParticle(w, h, theme, randomY = false) {
  const life = Math.random() * 400 + 200;
  const base = {
    x: Math.random() * w,
    y: randomY ? Math.random() * h : h + 20,
    life, maxLife: life,
    baseAlpha: Math.random() * 0.5 + 0.15,
  };

  if (theme === 'pop') {
    const chars = ['♥', '★', '✦', '♡', '☆', '✿', '◎', '♪'];
    return {
      ...base,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(Math.random() * 0.8 + 0.3),
      size: Math.random() * 16 + 8,
      char: chars[Math.floor(Math.random() * chars.length)],
      color: ['#ff69b4', '#ffd700', '#b19cd9', '#87ceeb', '#ff85c2', '#ffe4b5'][Math.floor(Math.random() * 6)],
    };
  }

  if (theme === 'inorganic') {
    const shapes = ['triangle', 'square', 'circle', 'cross', 'diamond'];
    return {
      ...base,
      y: randomY ? Math.random() * h : Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      size: Math.random() * 14 + 6,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.008,
      color: Math.random() > 0.85 ? '#cc0000' : `rgba(0,0,0,${Math.random() * 0.12 + 0.04})`,
      baseAlpha: Math.random() * 0.35 + 0.08,
    };
  }

  // Cyber
  return {
    ...base,
    vx: (Math.random() - 0.5) * 0.5,
    vy: -(Math.random() * 0.4 + 0.1),
    size: Math.random() * 2.5 + 0.5,
    color: ['rgba(255,255,255,0.9)', 'rgba(0,212,255,0.9)', 'rgba(0,212,255,0.7)', 'rgba(255,0,110,0.6)'][Math.floor(Math.random() * 4)],
  };
}

function drawShape(ctx, shape, size) {
  const s = size / 2;
  ctx.beginPath();
  switch (shape) {
    case 'triangle':
      ctx.moveTo(0, -s); ctx.lineTo(-s, s); ctx.lineTo(s, s); ctx.closePath(); break;
    case 'square':
      ctx.rect(-s, -s, size, size); break;
    case 'circle':
      ctx.arc(0, 0, s, 0, Math.PI * 2); break;
    case 'cross':
      ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(0, -s); ctx.lineTo(0, s); break;
    case 'diamond':
      ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); break;
  }
  ctx.stroke();
}

/* ================================================================
   EXTRA BACKGROUND EFFECTS per theme
   ================================================================ */

function initBackgroundEffect() {
  const theme = getTheme();
  if (theme === 'cyber') initCyberScanlines();
  if (theme === 'pop') initPopRibbons();
  if (theme === 'inorganic') initInorganicPulse();
}

function initCyberScanlines() {
  // Subtle horizontal scanline sweep
  const el = document.createElement('div');
  el.id = 'cyberScanline';
  el.style.cssText = `
    position:fixed; left:0; right:0; height:2px; z-index:1; pointer-events:none;
    background:linear-gradient(transparent,rgba(0,212,255,0.06),transparent);
    animation:scanMove 6s linear infinite;`;
  document.body.appendChild(el);

  if (!document.getElementById('scanStyle')) {
    const s = document.createElement('style');
    s.id = 'scanStyle';
    s.textContent = `
      @keyframes scanMove {
        0%  { top: -2px; opacity:0; }
        5%  { opacity:1; }
        95% { opacity:0.7; }
        100%{ top: 100vh; opacity:0; }
      }
      /* Data stream vertical lines */
      @keyframes dataStream {
        0%   { top:-100%; opacity:0; }
        10%  { opacity:0.5; }
        90%  { opacity:0.3; }
        100% { top:120%; opacity:0; }
      }`;
    document.head.appendChild(s);
  }

  // Data stream lines
  for (let i = 0; i < 6; i++) {
    const line = document.createElement('div');
    const left = 10 + Math.random() * 80;
    const dur = 4 + Math.random() * 6;
    const delay = Math.random() * 5;
    line.style.cssText = `
      position:fixed; left:${left}%; width:1px; height:60px; z-index:1; pointer-events:none;
      background:linear-gradient(transparent,rgba(0,212,255,0.15),transparent);
      animation:dataStream ${dur}s linear ${delay}s infinite;`;
    document.body.appendChild(line);
  }
}

function initPopRibbons() {
  // Soft pulsing glow spots
  if (!document.getElementById('popStyle')) {
    const s = document.createElement('style');
    s.id = 'popStyle';
    s.textContent = `
      @keyframes glowPulse { 0%,100%{opacity:0.03;transform:scale(1);} 50%{opacity:0.08;transform:scale(1.15);} }
      .pop-glow { position:fixed; border-radius:50%; pointer-events:none; z-index:0;
        animation:glowPulse ease-in-out infinite; }`;
    document.head.appendChild(s);
  }
  const colors = ['#ff69b4','#ffd700','#b19cd9','#87ceeb','#ffb6c1'];
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'pop-glow';
    const size = 200 + Math.random() * 300;
    const dur = 5 + Math.random() * 6;
    const delay = Math.random() * 4;
    el.style.cssText += `
      width:${size}px; height:${size}px;
      left:${Math.random() * 90}%; top:${Math.random() * 90}%;
      background:radial-gradient(circle,${colors[i]} 0%,transparent 70%);
      animation-duration:${dur}s; animation-delay:${delay}s;`;
    document.body.appendChild(el);
  }
}

function initInorganicPulse() {
  // Grid lines that occasionally flash
  if (!document.getElementById('inorgStyle')) {
    const s = document.createElement('style');
    s.id = 'inorgStyle';
    s.textContent = `
      @keyframes gridFlash { 0%,100%{opacity:0;} 50%{opacity:0.12;} }
      .inorg-hline,.inorg-vline { position:fixed; pointer-events:none; z-index:0; background:#333; }
      .inorg-hline { left:0; right:0; height:1px; animation:gridFlash linear infinite; }
      .inorg-vline { top:0; bottom:0; width:1px; animation:gridFlash linear infinite; }`;
    document.head.appendChild(s);
  }
  // Horizontal lines
  for (let i = 1; i <= 5; i++) {
    const el = document.createElement('div');
    el.className = 'inorg-hline';
    const dur = 8 + Math.random() * 8;
    const delay = Math.random() * 6;
    el.style.cssText += `top:${i * 16}%; animation-duration:${dur}s; animation-delay:${delay}s;`;
    document.body.appendChild(el);
  }
  // Vertical lines
  for (let i = 1; i <= 5; i++) {
    const el = document.createElement('div');
    el.className = 'inorg-vline';
    const dur = 10 + Math.random() * 8;
    const delay = Math.random() * 6;
    el.style.cssText += `left:${i * 16}%; animation-duration:${dur}s; animation-delay:${delay}s;`;
    document.body.appendChild(el);
  }
}

/* ================================================================
   GEO BACKGROUND (INORGANIC)
   ================================================================ */

function initGeoBackground() {
  const svg = $('#geoBackground');
  if (!svg || getTheme() !== 'inorganic') return;

  const w = window.innerWidth, h = window.innerHeight * 3;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);

  let content = '';
  for (let x = 0; x < w; x += 80) {
    content += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#ccc" stroke-width="0.5" opacity="0.25"/>`;
  }
  for (let y = 0; y < h; y += 80) {
    content += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#ccc" stroke-width="0.5" opacity="0.25"/>`;
  }
  for (let i = 0; i < 20; i++) {
    const cx = Math.random() * w, cy = Math.random() * h, r = Math.random() * 80 + 20;
    content += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#bbb" stroke-width="0.5" opacity="0.18"/>`;
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * w, y = Math.random() * h, s = Math.random() * 50 + 20;
    content += `<polygon points="${x},${y - s} ${x - s * 0.87},${y + s * 0.5} ${x + s * 0.87},${y + s * 0.5}" fill="none" stroke="#bbb" stroke-width="0.5" opacity="0.14"/>`;
  }
  svg.innerHTML = content;
}

/* ================================================================
   UTILS
   ================================================================ */

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/* ================================================================
   INIT
   ================================================================ */

document.addEventListener('DOMContentLoaded', initLanding);
