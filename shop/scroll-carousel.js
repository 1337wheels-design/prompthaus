/**
 * Scroll Card Carousel — Eventkarten aufdecken beim Scrollen
 */
(function (global) {
  const FIELD_CARDS = [
    { zone: 'I', name: 'LONDON GAP', icon: '▬' },
    { zone: 'II', name: 'HIP', icon: '◠' },
    { zone: 'III', name: 'LEDGE', icon: '═' },
    { zone: 'IV', name: 'GRASS GAP', icon: '▲' },
    { zone: 'V', name: 'HUBBA', icon: '▼' },
    { zone: 'VI', name: 'DOUBLE SET', icon: '▦' },
    { zone: 'VII', name: 'KICKER RAIL', icon: '╱' },
    { zone: 'VIII', name: 'BLÖCKE', icon: '▣' },
  ];

  const SPONSOR_CARDS = [
    { id: 'CHX-01', name: 'CASH FOR TRICKS', sponsor: 'ALL SPONSORS', type: 'Quick-Play Spell' },
    { id: 'CHX-02', name: 'SWITCH DROP', sponsor: 'PAY DAY', type: 'Trick Bounty' },
    { id: 'CHX-03', name: 'YOUNG GUN PASS', sponsor: 'TITUS', type: 'Youth Bracket' },
    { id: 'CHX-04', name: 'STREET PASS', sponsor: 'FIRST', type: 'Open Bracket' },
    { id: 'CHX-05', name: 'SHOP BATTLE', sponsor: 'FIRST + ATTITUDE', type: 'Shop Battle' },
    { id: 'CHX-06', name: 'DEATHRACE', sponsor: 'PAY DAY', type: 'Race Format' },
    { id: 'CHX-07', name: 'STUFF FOR STEEZE', sponsor: 'ALL SPONSORS', type: 'Style Bounty' },
    { id: 'CHX-08', name: 'S.K.A.T.E.', sponsor: 'ALL SPONSORS', type: 'Elimination' },
  ];

  function buildItems() {
    const items = [];
    FIELD_CARDS.forEach((c) => {
      items.push({
        kind: 'field',
        name: c.name,
        sub: `Field Spell · Zone ${c.zone}`,
        type: 'Obstacle im Park',
        icon: c.icon,
      });
    });
    SPONSOR_CARDS.forEach((c) => {
      items.push({
        kind: 'sponsor',
        name: c.name,
        sub: c.sponsor,
        type: c.type,
        icon: '✦',
      });
    });
    return items;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function createCardEl(item, index) {
    const el = document.createElement('article');
    el.className = `carousel-card carousel-card--${item.kind}`;
    el.dataset.index = String(index);
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="carousel-card__face">
        <span class="carousel-card__kind">${item.kind === 'field' ? 'Field Spell' : 'Challenge'}</span>
        <h3 class="carousel-card__name">${item.name}</h3>
        <div class="carousel-card__art" aria-hidden="true">${item.icon}</div>
        <p class="carousel-card__meta">${item.sub}</p>
      </div>`;
    return el;
  }

  function init() {
    const root = document.getElementById('scroll-carousel');
    if (!root) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items = buildItems();
    const count = items.length;

    const track = root.querySelector('.scroll-carousel__track');
    const stage = document.getElementById('carousel-stage');
    const table = root.querySelector('.scroll-carousel__table');
    const info = document.getElementById('carousel-info');
    const infoName = document.getElementById('carousel-info-name');
    const infoSub = document.getElementById('carousel-info-sub');
    const infoType = document.getElementById('carousel-info-type');
    const progressFill = document.getElementById('carousel-progress-fill');
    const progressLabel = document.getElementById('carousel-progress-label');
    const portalTarget = document.getElementById('sponsors');
    const header = root.querySelector('.scroll-carousel__header');
    const hint = root.querySelector('.scroll-carousel__hint');

    const cardEls = items.map((item, i) => {
      const el = createCardEl(item, i);
      table.appendChild(el);
      return el;
    });

    const scrollPerCard = 0.42;
    const totalScrollVh = count * scrollPerCard;
    if (!reducedMotion) {
      track.style.height = `${totalScrollVh * 100}vh`;
    }

    let ticking = false;
    let lastActive = -1;

    function getProgress() {
      const rect = track.getBoundingClientRect();
      const trackTop = rect.top + window.scrollY;
      const scrollable = track.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return 0;
      const raw = (window.scrollY - trackTop) / scrollable;
      return clamp(raw, 0, 1);
    }

    function isImmersive(progress) {
      return progress > 0.008 && progress < 0.995;
    }

    function cardTransform(index, progress, activeFloat, immersive) {
      const spreadStart = 0.04;
      const spreadEnd = 0.88;
      const spread = clamp((progress - spreadStart) / (spreadEnd - spreadStart), 0, 1);

      const itemPhase = index / (count - 1 || 1);
      const revealAt = itemPhase * 0.82;
      const cardReveal = easeOutCubic(clamp((spread - revealAt * 0.7) / 0.18, 0, 1));

      const dist = Math.abs(activeFloat - index);
      const isActive = Math.abs(activeFloat - index) < 0.45;
      const fanSpread = immersive ? 1.55 : 1;

      const stackT = 1 - easeOutCubic(clamp(spread / 0.12, 0, 1));
      const stackRot = (index - activeFloat) * 1.8 * stackT;
      const stackY = index * -1.2 * stackT;
      const stackX = (index - count / 2) * 0.4 * stackT;

      const fanAngle = (index - activeFloat) * 7 * fanSpread;
      const fanRadius = (immersive ? 180 : 120) + dist * (immersive ? 28 : 18);
      const fanX = Math.sin((fanAngle * Math.PI) / 180) * fanRadius;
      const fanY = Math.cos((fanAngle * Math.PI) / 180) * -8 + dist * 6;
      const fanRot = fanAngle * (1 - stackT * 0.6);

      const activeBoost = Math.max(0, 1 - dist * 0.55);
      const maxScale = immersive ? 1.12 : 1.06;
      const scale = lerp(0.72 + cardReveal * 0.1, maxScale, activeBoost);
      const lift = -activeBoost * (immersive ? 32 : 22);
      const z = Math.round(100 - dist * 10 + activeBoost * 50);

      const fadeOut = clamp((progress - 0.94) / 0.06, 0, 1);

      const x = stackX + fanX * (1 - stackT * 0.3);
      const y = stackY + fanY + lift;
      const rot = stackRot + fanRot;

      return {
        x, y, rot, scale: scale * (1 - fadeOut * 0.2),
        opacity: cardReveal * (1 - fadeOut),
        z,
        isActive,
      };
    }

    function update() {
      ticking = false;
      const progress = getProgress();
      const immersive = isImmersive(progress);
      const spreadEnd = 0.88;
      const browseProgress = clamp(progress / spreadEnd, 0, 1);
      const activeFloat = browseProgress * (count - 1);
      const activeIndex = Math.round(activeFloat);

      if (stage) stage.classList.toggle('scroll-carousel__stage--immersive', immersive);
      document.body.classList.toggle('carousel-immersive', immersive);

      cardEls.forEach((el, i) => {
        const t = cardTransform(i, progress, activeFloat, immersive);
        el.style.zIndex = String(t.z);
        el.style.opacity = String(t.opacity);
        el.style.transform = `translate(calc(-50% + ${t.x}px), calc(-50% + ${t.y}px)) rotate(${t.rot}deg) scale(${t.scale})`;
        const isActive = i === activeIndex && progress < 0.9;
        el.classList.toggle('carousel-card--active', isActive);
        el.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });

      if (activeIndex !== lastActive && activeIndex >= 0 && activeIndex < count) {
        lastActive = activeIndex;
        const item = items[activeIndex];
        infoName.textContent = item.name;
        infoSub.textContent = item.sub;
        infoType.textContent = item.type;
        info.classList.add('visible');
        progressLabel.textContent = `${activeIndex + 1} / ${count}`;
      }

      if (progressFill) progressFill.style.width = `${progress * 100}%`;

      if (header) header.style.opacity = String(Math.max(0, 1 - progress * 0.5));
      if (hint) hint.style.opacity = String(Math.max(0, 1 - progress * 4));
      if (info) info.style.opacity = String(Math.max(0, 1 - clamp((progress - 0.9) / 0.1, 0, 1)));

      if (portalTarget) {
        if (progress > 0.94) {
          portalTarget.classList.remove('portal-hidden');
          portalTarget.classList.add('portal-revealed');
          document.body.classList.remove('carousel-immersive');
          if (stage) stage.classList.remove('scroll-carousel__stage--immersive');
        } else if (progress > 0.02) {
          portalTarget.classList.add('portal-hidden');
          portalTarget.classList.remove('portal-revealed');
        } else {
          portalTarget.classList.remove('portal-hidden', 'portal-revealed');
        }
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    if (!reducedMotion) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
    } else {
      progressLabel.textContent = `${count} Karten`;
      info.classList.add('visible');
      infoName.textContent = 'Alle Event-Karten';
      infoSub.textContent = 'Field Spells · Challenges';
      infoType.textContent = 'Scroll-Animation deaktiviert (Reduced Motion)';
      cardEls.forEach((el) => {
        el.classList.add('carousel-card--active');
      });
      if (portalTarget) {
        portalTarget.classList.remove('portal-hidden');
        portalTarget.classList.add('portal-revealed');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.PAYDAY_SCROLL_CAROUSEL = { buildItems, FIELD_CARDS, SPONSOR_CARDS };
})(window);
