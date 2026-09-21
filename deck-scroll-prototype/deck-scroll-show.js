/**
 * Deck Scroll Show — scroll-driven deck walkthrough (Drive SVG assets).
 * Standalone; embed via PAYDAY_DECK_SCROLL_SHOW.mount({ root, ... }).
 */
(function (global) {
  const DEFAULTS = {
    assetsBase: 'assets/',
    scrollPerSlide: 0.38,
    ctaLabel: 'Zum Deck Shop',
    eyebrow: 'Payday SS26',
    title: 'Deck Show',
    showOrnaments: true,
    slideIds: null,
  };

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function assetUrl(base, file) {
    const path = base.replace(/\/?$/, '/') + file.split('/').map(encodeURIComponent).join('/');
    return path;
  }

  function resolveSlides(config) {
    const manifest = global.PAYDAY_DECK_SCROLL_MANIFEST;
    const all = manifest ? manifest.DECK_SLIDES : [];
    if (!config.slides?.length) {
      const ids = config.slideIds;
      if (ids?.length) {
        return all.filter((s) => ids.includes(s.id));
      }
      return all.slice(0, 6);
    }
    return config.slides;
  }

  function resolveOrnaments(config) {
    const manifest = global.PAYDAY_DECK_SCROLL_MANIFEST;
    if (!config.showOrnaments || !manifest) return [];
    return manifest.ORNAMENTS || [];
  }

  function buildDom(root, config, slides, ornaments) {
    root.classList.add('deck-scroll-show');
    root.innerHTML = `
      <div class="deck-scroll-show__track">
        <div class="deck-scroll-show__progress-bar" aria-hidden="true">
          <div class="deck-scroll-show__progress-fill"></div>
        </div>
        <div class="deck-scroll-show__stage" id="dss-stage">
          <header class="deck-scroll-show__header">
            <p class="deck-scroll-show__eyebrow">${config.eyebrow}</p>
            <h2 class="deck-scroll-show__title">${config.title}</h2>
          </header>
          <p class="deck-scroll-show__progress" id="dss-progress-label">1 / ${slides.length}</p>
          <div class="deck-scroll-show__ornaments" id="dss-ornaments"></div>
          <div class="deck-scroll-show__table" id="dss-table" role="list"></div>
          <div class="deck-scroll-show__info" id="dss-info">
            <div class="deck-scroll-show__info-name" id="dss-info-name"></div>
            <div class="deck-scroll-show__info-tag" id="dss-info-tag"></div>
          </div>
          <p class="deck-scroll-show__hint" id="dss-hint">Scroll · Decks durchblättern</p>
          <button type="button" class="deck-scroll-show__cta" id="dss-cta">${config.ctaLabel}</button>
        </div>
      </div>`;

    const table = root.querySelector('#dss-table');
    const slideEls = slides.map((slide, index) => {
      const el = document.createElement('article');
      el.className = 'deck-scroll-show__slide';
      el.dataset.index = String(index);
      el.setAttribute('role', 'listitem');
      el.innerHTML = `<img src="${assetUrl(config.assetsBase, slide.file)}" alt="${slide.label}" loading="${index < 2 ? 'eager' : 'lazy'}" width="880" height="228">`;
      table.appendChild(el);
      return el;
    });

    const ornamentEls = [];
    const ornRoot = root.querySelector('#dss-ornaments');
    const positions = [
      { left: '8%', top: '18%' },
      { left: '86%', top: '22%' },
      { left: '12%', top: '72%' },
      { left: '82%', top: '68%' },
      { left: '48%', top: '12%' },
      { left: '52%', top: '78%' },
    ];
    ornaments.forEach((orn, i) => {
      const img = document.createElement('img');
      img.className = 'deck-scroll-show__ornament';
      img.src = assetUrl(config.assetsBase, orn.file);
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      const pos = positions[i % positions.length];
      img.style.left = pos.left;
      img.style.top = pos.top;
      img.dataset.depth = String(orn.depth);
      ornRoot.appendChild(img);
      ornamentEls.push(img);
    });

    return {
      track: root.querySelector('.deck-scroll-show__track'),
      stage: root.querySelector('#dss-stage'),
      slideEls,
      ornamentEls,
      info: root.querySelector('#dss-info'),
      infoName: root.querySelector('#dss-info-name'),
      infoTag: root.querySelector('#dss-info-tag'),
      progressFill: root.querySelector('.deck-scroll-show__progress-fill'),
      progressLabel: root.querySelector('#dss-progress-label'),
      hint: root.querySelector('#dss-hint'),
      header: root.querySelector('.deck-scroll-show__header'),
      cta: root.querySelector('#dss-cta'),
    };
  }

  function slideTransform(index, progress, activeFloat, count) {
    const spreadStart = 0.05;
    const spreadEnd = 0.9;
    const spread = clamp((progress - spreadStart) / (spreadEnd - spreadStart), 0, 1);
    const dist = Math.abs(activeFloat - index);

    const stackT = 1 - easeOutCubic(clamp(spread / 0.14, 0, 1));
    const stackY = (index - activeFloat) * 14 * stackT;
    const stackX = (index - count / 2) * 6 * stackT;
    const stackRot = (index - activeFloat) * 2.2 * stackT;

    const fanAngle = (index - activeFloat) * 6.5;
    const fanRadius = 100 + dist * 22;
    const fanX = Math.sin((fanAngle * Math.PI) / 180) * fanRadius;
    const fanY = Math.cos((fanAngle * Math.PI) / 180) * -6 + dist * 8;

    const activeBoost = Math.max(0, 1 - dist * 0.5);
    const scale = lerp(0.78, 1.12, activeBoost);
    const lift = -activeBoost * 36;
    const z = Math.round(80 - dist * 8 + activeBoost * 40);

    const exitT = clamp((progress - 0.88) / 0.12, 0, 1);
    const exitScale = 1 - exitT * 0.25;
    const exitOpacity = 1 - exitT * 0.85;

    const x = stackX + fanX * (1 - stackT * 0.35);
    const y = stackY + fanY + lift;
    const rot = stackRot + fanAngle * (1 - stackT * 0.5);

    const revealAt = index / (count - 1 || 1);
    const cardReveal = easeOutCubic(clamp((spread - revealAt * 0.65) / 0.2, 0, 1));

    return {
      x,
      y,
      rot,
      scale: scale * exitScale,
      opacity: cardReveal * exitOpacity,
      z,
    };
  }

  function mount(userConfig) {
    const config = { ...DEFAULTS, ...userConfig };
    const root =
      typeof config.root === 'string'
        ? document.querySelector(config.root)
        : config.root;
    if (!root) {
      console.warn('[deck-scroll-show] root not found');
      return null;
    }

    const slides = resolveSlides(config);
    if (!slides.length) {
      console.warn('[deck-scroll-show] no slides');
      return null;
    }

    const ornaments = resolveOrnaments(config);
    const ui = buildDom(root, config, slides, ornaments);
    const count = slides.length;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctaPhase = 0.15;
    const totalScrollVh = count * config.scrollPerSlide + ctaPhase;
    if (!reducedMotion) {
      ui.track.style.height = `${totalScrollVh * 100}vh`;
    }

    let ticking = false;
    let lastActive = -1;

    function getProgress() {
      const rect = ui.track.getBoundingClientRect();
      const trackTop = rect.top + window.scrollY;
      const scrollable = ui.track.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return 0;
      return clamp((window.scrollY - trackTop) / scrollable, 0, 1);
    }

    function update() {
      ticking = false;
      const progress = getProgress();
      const immersive = progress > 0.01 && progress < 0.995;
      const browseProgress = clamp(progress / 0.9, 0, 1);
      const activeFloat = browseProgress * (count - 1);
      const activeIndex = Math.round(activeFloat);

      ui.stage.classList.toggle('deck-scroll-show__stage--immersive', immersive);
      document.body.classList.toggle('deck-scroll-show-immersive', immersive);

      ui.slideEls.forEach((el, i) => {
        const t = slideTransform(i, progress, activeFloat, count);
        el.style.zIndex = String(t.z);
        el.style.opacity = String(t.opacity);
        el.style.transform = `translate(calc(-50% + ${t.x}px), calc(-50% + ${t.y}px)) rotate(${t.rot}deg) scale(${t.scale})`;
        const isActive = i === activeIndex && progress < 0.92;
        el.classList.toggle('deck-scroll-show__slide--active', isActive);
      });

      ui.ornamentEls.forEach((img) => {
        const depth = parseFloat(img.dataset.depth || '0.4', 10);
        const drift = (progress - 0.5) * 120 * depth;
        const spin = progress * 360 * depth * 0.15;
        img.style.transform = `translateY(${drift}px) rotate(${spin}deg)`;
        img.style.opacity = String(0.2 + (1 - Math.abs(progress - 0.5) * 1.2) * 0.35);
      });

      if (activeIndex !== lastActive && activeIndex >= 0 && activeIndex < count) {
        lastActive = activeIndex;
        const slide = slides[activeIndex];
        ui.infoName.textContent = slide.label;
        ui.infoTag.textContent = slide.tag || 'Payday Deck';
        ui.info.classList.add('visible');
        ui.progressLabel.textContent = `${activeIndex + 1} / ${count}`;
        if (typeof config.onSlideChange === 'function') {
          config.onSlideChange(activeIndex, slide);
        }
      }

      if (ui.progressFill) ui.progressFill.style.width = `${progress * 100}%`;
      if (ui.hint) ui.hint.style.opacity = String(Math.max(0, 1 - progress * 3));

      const ctaT = easeInOutCubic(clamp((progress - 0.82) / 0.18, 0, 1));
      if (ui.cta) ui.cta.classList.toggle('visible', ctaT > 0.5);
      if (ui.header) ui.header.style.opacity = String(1 - ctaT * 1.1);
      if (ui.info) ui.info.style.opacity = String(ctaT > 0.7 ? 0.4 : 1);

      if (ctaT > 0.98 && typeof config.onComplete === 'function') {
        config.onComplete();
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    ui.cta.addEventListener('click', () => {
      if (typeof config.onCtaClick === 'function') {
        config.onCtaClick();
        return;
      }
      const target =
        typeof config.ctaTarget === 'string'
          ? document.querySelector(config.ctaTarget)
          : config.ctaTarget;
      if (target) {
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    });

    if (!reducedMotion) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
    } else {
      ui.info.classList.add('visible');
      ui.infoName.textContent = `${count} Designs`;
      ui.infoTag.textContent = 'Reduced Motion';
      ui.slideEls.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%, -50%)';
      });
      ui.cta.classList.add('visible');
    }

    return {
      destroy() {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        document.body.classList.remove('deck-scroll-show-immersive');
        root.innerHTML = '';
        root.classList.remove('deck-scroll-show');
      },
      getSlides: () => slides.slice(),
      getActiveIndex: () => lastActive,
    };
  }

  global.PAYDAY_DECK_SCROLL_SHOW = { mount, DEFAULTS };
})(window);
