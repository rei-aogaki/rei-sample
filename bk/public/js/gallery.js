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

  // Landing particle canvas
  initLandingCanvas();

  // Card clicks
  $$('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      card.classList.add('selected');
      $$('.mode-card').forEach((c) => {
        if (c !== card) c.style.opacity = '0';
      });
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

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 40; i++) {
    dots.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      a: Math.random() * 0.3 + 0.1,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
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

  if (!isTouchDevice() && !prefersReducedMotion) {
    initParticles();
  }

  // Init geo background for inorganic
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

    // Random animation class
    const animClass = ANIM_CLASSES[Math.floor(Math.random() * ANIM_CLASSES.length)];
    item.classList.add(animClass);

    item.innerHTML = `
      <div class="photo-wrap" data-index="${i}">
        <img class="photo-img" src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.title)}"
             loading="lazy" decoding="async"
             ${photo.width ? `width="${photo.width}"` : ''}
             ${photo.height ? `height="${photo.height}"` : ''} />
      </div>
      <div class="photo-meta">
        <span class="photo-title">${escapeHtml(photo.title)}</span>
      </div>`;

    list.appendChild(item);
  });

  initScrollAnimations();
  if (!isTouchDevice()) initMagneticTilt();
  initLightbox(photos);

  // Hide scroll hint after first scroll
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
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  items.forEach((item) => observer.observe(item));

  // Parallax
  if (!isTouchDevice() && !prefersReducedMotion) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const center = rect.top + rect.height / 2 - window.innerHeight / 2;
        item.style.setProperty('--parallax-y', `${center * 0.03}px`);
      });
    }, { passive: true });
  }
}

/* ================================================================
   MAGNETIC TILT (desktop only)
   ================================================================ */

function initMagneticTilt() {
  $$('.photo-wrap').forEach((wrap) => {
    wrap.addEventListener('mousemove', (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      wrap.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
    wrap.addEventListener('mouseleave', () => {
      wrap.style.transform = '';
    });
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

  let current = 0;
  let scale = 1;
  let lastDist = 0;

  function open(index) {
    current = index;
    img.src = photos[index].url;
    img.alt = photos[index].title || '';
    img.style.transform = '';
    scale = 1;
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
    setTimeout(() => {
      img.src = photos[current].url;
      img.alt = photos[current].title || '';
      img.style.opacity = '1';
      scale = 1;
      img.style.transform = '';
    }, 200);
  }

  // Click handlers
  $$('.photo-wrap').forEach((wrap) => {
    wrap.addEventListener('click', () => {
      const idx = parseInt(wrap.dataset.index, 10);
      if (!isNaN(idx)) open(idx);
    });
  });

  closeBtn?.addEventListener('click', close);
  prevBtn?.addEventListener('click', () => nav(-1));
  nextBtn?.addEventListener('click', () => nav(1));

  // Backdrop click
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.classList.contains('lightbox-backdrop')) close();
  });

  // Keyboard
  const onKey = (e) => {
    if (!lb.classList.contains('active')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') nav(-1);
    if (e.key === 'ArrowRight') nav(1);
  };
  document.addEventListener('keydown', onKey);

  // Touch: swipe & pinch
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
    if (e.touches.length < 2) {
      lastDist = 0;
      if (scale < 1.05) { scale = 1; img.style.transform = 'scale(1)'; }
    }
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
   PARTICLE SYSTEMS (per theme)
   ================================================================ */

function initParticles() {
  const canvas = $('#particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [];
  const theme = getTheme();

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const count = 50;
  for (let i = 0; i < count; i++) particles.push(createParticle(w, h, theme));

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy;
      p.life--;
      if (theme === 'inorganic') p.angle += p.spin;

      if (p.life <= 0 || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
        particles[i] = createParticle(w, h, theme);
        return;
      }

      const alpha = Math.min((p.life / p.maxLife) * 2, 1) * p.baseAlpha;
      ctx.save();
      ctx.globalAlpha = alpha;

      if (theme === 'pop') {
        // Hearts & stars
        ctx.font = `${p.size}px serif`;
        ctx.fillText(p.char, p.x, p.y);
      } else if (theme === 'inorganic') {
        // Geometric shapes
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.5;
        drawShape(ctx, p.shape, p.size);
      } else {
        // Cyber: glowing dots
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

function createParticle(w, h, theme) {
  const life = Math.random() * 300 + 150;
  const base = {
    x: Math.random() * w, y: Math.random() * h,
    life, maxLife: life,
    baseAlpha: Math.random() * 0.4 + 0.1,
  };

  if (theme === 'pop') {
    const chars = ['♥', '★', '✦', '♡', '☆'];
    return {
      ...base,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.5 - 0.2,
      size: Math.random() * 12 + 8,
      char: chars[Math.floor(Math.random() * chars.length)],
      color: ['#ff69b4', '#ffd700', '#b19cd9', '#87ceeb'][Math.floor(Math.random() * 4)],
    };
  }

  if (theme === 'inorganic') {
    const shapes = ['triangle', 'square', 'circle', 'cross'];
    return {
      ...base,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      size: Math.random() * 10 + 5,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.005,
      color: Math.random() > 0.9 ? '#ff0000' : `rgba(0,0,0,${Math.random() * 0.15 + 0.05})`,
    };
  }

  // Cyber
  return {
    ...base,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    size: Math.random() * 2 + 0.5,
    color: ['#ffffff', '#00d4ff', '#00d4ff'][Math.floor(Math.random() * 3)],
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
  }
  ctx.stroke();
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
  // Grid lines
  for (let x = 0; x < w; x += 100) {
    content += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#ddd" stroke-width="0.5" opacity="0.3"/>`;
  }
  for (let y = 0; y < h; y += 100) {
    content += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#ddd" stroke-width="0.5" opacity="0.3"/>`;
  }
  // Random shapes
  for (let i = 0; i < 15; i++) {
    const cx = Math.random() * w, cy = Math.random() * h, r = Math.random() * 60 + 20;
    content += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ccc" stroke-width="0.5" opacity="0.2"/>`;
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * w, y = Math.random() * h, s = Math.random() * 40 + 20;
    content += `<polygon points="${x},${y - s} ${x - s * 0.87},${y + s * 0.5} ${x + s * 0.87},${y + s * 0.5}" fill="none" stroke="#ccc" stroke-width="0.5" opacity="0.15"/>`;
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
