/* ================================================================
   Rei Aogaki — Portfolio JS
   Hero particles, gallery loading, lightbox, scroll animations
   ================================================================ */

(function () {
  'use strict';

  /* ─── API ─── */
  const API = '/api/photos';

  /* ─── State ─── */
  let photos = [];        // gallery photos (excluding hero/about)
  let heroPhoto = null;
  let aboutPhoto = null;
  let lightboxIndex = -1;
  let slideshowTimer = null;

  /* ─── DOM ─── */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const heroVisual     = $('#heroVisual');
  const heroPlaceholder = $('#heroPlaceholder');
  const heroSlideshow  = $('#heroSlideshow');
  const aboutPortrait  = $('#aboutPortrait');
  const aboutPlaceholder = $('#aboutPlaceholder');
  const photoGrid      = $('#photoGrid');
  const galleryCount   = $('#galleryCount');

  /* lightbox */
  const lightbox       = $('#lightbox');
  const lightboxImg    = $('#lightboxImg');
  const lightboxCaption = $('#lightboxCaption');
  const lightboxCounter = $('#lightboxCounter');
  const lightboxClose  = $('#lightboxClose');
  const lightboxPrev   = $('#lightboxPrev');
  const lightboxNext   = $('#lightboxNext');

  /* scroll */
  const scrollProgress = $('#scrollProgress');
  const scrollCue      = $('#scrollCue');
  const navDots        = $$('.nav-dot');

  /* ================================================================
     HERO PARTICLES
     ================================================================ */
  function initParticles() {
    const canvas = $('#heroCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let particles = [];
    let mouse = { x: -1000, y: -1000 };
    const PARTICLE_COUNT = 60;
    const MAX_DIST = 140;

    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mouseleave', () => { mouse.x = -1000; mouse.y = -1000; });

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.r = Math.random() * 1.6 + 0.4;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.alpha = Math.random() * 0.5 + 0.2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > W) this.vx *= -1;
        if (this.y < 0 || this.y > H) this.vy *= -1;
        /* mouse repulsion */
        const dx = this.x - mouse.x, dy = this.y - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          const f = (120 - d) / 120 * 0.02;
          this.vx += dx * f;
          this.vy += dy * f;
        }
        /* damping */
        this.vx *= 0.99;
        this.vy *= 0.99;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120,143,167,${this.alpha})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

    function frame() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => { p.update(); p.draw(); });

      /* connections */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(120,143,167,${0.08 * (1 - d / MAX_DIST)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ================================================================
     LOAD PHOTOS
     ================================================================ */
  async function loadPhotos() {
    try {
      const res = await fetch(`${API}?limit=200`);
      const data = await res.json();
      if (data.error) { console.warn('API error:', data.error); photos = []; renderGallery(); return; }
      const all = data.data || [];

      /* separate hero / about / gallery */
      heroPhoto  = all.find(p => (p.title || '').toLowerCase().includes('[hero]')) || null;
      aboutPhoto = all.find(p => (p.title || '').toLowerCase().includes('[about]')) || null;
      photos = all.filter(p => p !== heroPhoto && p !== aboutPhoto);

      setHeroImage();
      setAboutImage();
      renderGallery();
      initSlideshow(all);
    } catch (err) {
      console.warn('Photos API not available yet:', err.message);
      photos = [];
      renderGallery();
    }
  }

  /* ================================================================
     HERO BACKGROUND SLIDESHOW
     ================================================================ */
  function initSlideshow(allPhotos) {
    if (!heroSlideshow) return;
    /* Use gallery photos for slideshow (exclude hero/about) */
    const slidePhotos = allPhotos.filter(p => p !== heroPhoto && p !== aboutPhoto);
    if (slidePhotos.length === 0) return;

    /* Limit to 8 photos max for performance */
    const selected = slidePhotos.slice(0, 8);
    let currentSlide = 0;

    /* Create slide elements */
    selected.forEach((photo, i) => {
      const slide = document.createElement('div');
      slide.className = 'hero-slide' + (i === 0 ? ' active' : '');
      const img = document.createElement('img');
      img.src = photo.url || `${API}/${photo.id}/image`;
      img.alt = '';
      img.loading = i === 0 ? 'eager' : 'lazy';
      slide.appendChild(img);
      heroSlideshow.appendChild(slide);
    });

    /* Rotate slides */
    if (selected.length > 1) {
      slideshowTimer = setInterval(() => {
        const slides = $$('.hero-slide');
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
      }, 5000);
    }
  }

  /* ─── Set Hero Image ─── */
  function setHeroImage() {
    if (!heroPhoto) return;
    const img = document.createElement('img');
    img.alt = cleanTitle(heroPhoto.title);
    img.loading = 'eager';
    img.onload = () => {
      if (heroPlaceholder && heroPlaceholder.parentNode) heroPlaceholder.remove();
      heroVisual.appendChild(img);
    };
    img.onerror = () => console.warn('Hero image failed to load');
    img.src = heroPhoto.url || `${API}/${heroPhoto.id}/image`;
  }

  /* ─── Set About Image ─── */
  function setAboutImage() {
    if (!aboutPhoto) return;
    const img = document.createElement('img');
    img.alt = cleanTitle(aboutPhoto.title);
    img.loading = 'eager';
    img.onload = () => {
      if (aboutPlaceholder && aboutPlaceholder.parentNode) aboutPlaceholder.remove();
      aboutPortrait.appendChild(img);
    };
    img.onerror = () => console.warn('About image failed to load');
    img.src = aboutPhoto.url || `${API}/${aboutPhoto.id}/image`;
  }

  /* ─── Clean title (remove tags) ─── */
  function cleanTitle(t) {
    if (!t) return '';
    return t.replace(/\[(hero|about)\]/gi, '').trim();
  }

  /* ─── Render Gallery ─── */
  function renderGallery() {
    if (photos.length === 0) {
      photoGrid.innerHTML = `<div class="photo-grid-empty">まだ写真がありません</div>`;
      galleryCount.textContent = '';
      return;
    }
    galleryCount.textContent = `${photos.length} works`;

    const fragment = document.createDocumentFragment();
    photos.forEach((photo, i) => {
      const item = document.createElement('div');
      item.className = 'photo-item';
      item.innerHTML = `
        <div class="photo-wrap">
          <div class="photo-loading"></div>
          <img class="photo-img" alt="${escapeHtml(cleanTitle(photo.title))}" loading="lazy" />
          <div class="shine-overlay"></div>
        </div>
      `;
      const img = item.querySelector('.photo-img');
      const loader = item.querySelector('.photo-loading');
      img.onload = () => {
        img.classList.add('loaded');
        loader.style.display = 'none';
      };
      img.src = photo.url || `${API}/${photo.id}/image`;

      /* tilt effect */
      const wrap = item.querySelector('.photo-wrap');
      const shine = item.querySelector('.shine-overlay');
      wrap.addEventListener('mousemove', e => {
        const r = wrap.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const px = (e.clientX - cx) / (r.width / 2);
        const py = (e.clientY - cy) / (r.height / 2);
        wrap.style.transform = `perspective(600px) rotateY(${px * 4}deg) rotateX(${-py * 4}deg)`;
        const gx = ((e.clientX - r.left) / r.width) * 100;
        const gy = ((e.clientY - r.top) / r.height) * 100;
        shine.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(120,143,167,0.15), transparent 60%)`;
        shine.style.opacity = '1';
      });
      wrap.addEventListener('mouseleave', () => {
        wrap.style.transform = 'perspective(600px) rotateY(0) rotateX(0)';
        shine.style.opacity = '0';
      });

      /* click → lightbox */
      item.addEventListener('click', () => openLightbox(i));

      fragment.appendChild(item);
    });

    photoGrid.innerHTML = '';
    photoGrid.appendChild(fragment);

    /* staggered reveal via intersection observer */
    observePhotos();
  }

  /* ─── Photo visibility observer ─── */
  function observePhotos() {
    const items = $$('.photo-item');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px 60px 0px' });
    items.forEach(item => io.observe(item));
  }

  /* ================================================================
     LIGHTBOX
     ================================================================ */
  function openLightbox(idx) {
    if (photos.length === 0) return;
    lightboxIndex = idx;
    updateLightbox();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    lightboxIndex = -1;
  }

  function updateLightbox() {
    if (lightboxIndex < 0 || lightboxIndex >= photos.length) return;
    const photo = photos[lightboxIndex];
    lightboxImg.src = `${API}/${photo.id}/image`;
    lightboxCaption.textContent = cleanTitle(photo.title) || '';
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${photos.length}`;
  }

  function lightboxPrevFn() {
    if (photos.length === 0) return;
    lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length;
    updateLightbox();
  }

  function lightboxNextFn() {
    if (photos.length === 0) return;
    lightboxIndex = (lightboxIndex + 1) % photos.length;
    updateLightbox();
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', lightboxPrevFn);
  lightboxNext.addEventListener('click', lightboxNextFn);
  lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrevFn();
    if (e.key === 'ArrowRight') lightboxNextFn();
  });

  /* Touch swipe for lightbox */
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
  lightbox.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) lightboxPrevFn(); else lightboxNextFn();
    }
  });

  /* ================================================================
     SCROLL EFFECTS
     ================================================================ */

  /* Progress bar */
  function updateScrollProgress() {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const perc = h > 0 ? (window.scrollY / h) * 100 : 0;
    scrollProgress.style.height = perc + '%';
  }

  /* Hide scroll cue after scrolling */
  function updateScrollCue() {
    if (window.scrollY > 80) {
      scrollCue.style.opacity = '0';
    } else {
      scrollCue.style.opacity = '1';
    }
  }

  /* Nav dots */
  const sectionIds = ['hero', 'about', 'gallery', 'sns'];
  function updateNavDots() {
    const scrollY = window.scrollY + window.innerHeight / 3;
    let active = 'hero';
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el && el.offsetTop <= scrollY) active = id;
    }
    navDots.forEach(dot => {
      dot.classList.toggle('active', dot.dataset.section === active);
    });
  }

  navDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const target = document.getElementById(dot.dataset.section);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* Scroll handler */
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateScrollProgress();
        updateScrollCue();
        updateNavDots();
        ticking = false;
      });
      ticking = true;
    }
  });

  /* Fade-in observer for sections */
  function observeFadeIns() {
    const els = $$('.about-inner, .gallery-header-area, .sns-content, .about-tags, .follow-btn');
    els.forEach(el => el.classList.add('fade-in'));

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    els.forEach(el => io.observe(el));
  }

  /* ================================================================
     UTILITIES
     ================================================================ */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    initParticles();
    loadPhotos();
    observeFadeIns();
    updateScrollProgress();
    updateNavDots();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
