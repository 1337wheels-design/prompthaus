/**
 * Artefakt-Atlas — filterbare Übersicht aller Drive-Elemente.
 * PAYDAY_ARTIFACT_ATLAS.mount({ root: '#artifact-atlas' })
 */
(function (global) {
  function assetUrl(base, file) {
    return base.replace(/\/?$/, '/') + file.split('/').map(encodeURIComponent).join('/');
  }

  function isStrokeArtifact(a) {
    return a.category === 'ui-reticle' || a.category === 'ui-axis';
  }

  function mount(config) {
    const root =
      typeof config.root === 'string' ? document.querySelector(config.root) : config.root;
    const catalog = global.PAYDAY_ARTIFACT_CATALOG;
    if (!root || !catalog) return null;

    const assetsBase = config.assetsBase || 'assets/';
    const stats = catalog.stats();
    const cats = Object.values(catalog.CATEGORIES);

    root.className = 'artifact-atlas';
    root.innerHTML = `
      <header class="artifact-atlas__head">
        <p class="artifact-atlas__eyebrow">Google Drive · Element-Bibliothek</p>
        <h2 class="artifact-atlas__title">Artefakt-Atlas</h2>
        <p class="artifact-atlas__meta">${stats.total} SVGs · ${stats.deckGraphics} Deck-Comps · ${stats.uiAndBrand} UI &amp; Brand-Marks</p>
        <div class="artifact-atlas__stats" id="aa-stats"></div>
      </header>
      <div class="artifact-atlas__filters" id="aa-filters"></div>
      <div class="artifact-atlas__grid" id="aa-grid" role="list"></div>
      <div class="artifact-atlas__detail" id="aa-detail" aria-live="polite"></div>
      <div class="artifact-atlas__marquee" aria-hidden="true">
        <div class="artifact-atlas__marquee-track" id="aa-marquee"></div>
      </div>`;

    const statsEl = root.querySelector('#aa-stats');
    Object.entries(stats.byCategory).forEach(([key, n]) => {
      const chip = document.createElement('span');
      chip.className = 'artifact-atlas__stat';
      chip.innerHTML = `<strong>${n}</strong>${catalog.CATEGORIES[key]?.label || key}`;
      statsEl.appendChild(chip);
    });

    const filtersEl = root.querySelector('#aa-filters');
    const gridEl = root.querySelector('#aa-grid');
    const detailEl = root.querySelector('#aa-detail');
    const marqueeEl = root.querySelector('#aa-marquee');

    let activeFilter = 'all';
    let selectedId = catalog.ARTIFACTS[0]?.id;

    function renderFilters() {
      filtersEl.innerHTML = '';
      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'artifact-atlas__chip' + (activeFilter === 'all' ? ' active' : '');
      allBtn.textContent = 'Alle';
      allBtn.dataset.filter = 'all';
      filtersEl.appendChild(allBtn);
      cats.forEach((c) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'artifact-atlas__chip' + (activeFilter === c.id ? ' active' : '');
        btn.textContent = c.label;
        btn.dataset.filter = c.id;
        btn.title = c.description;
        filtersEl.appendChild(btn);
      });
    }

    function showDetail(a) {
      if (!a) {
        detailEl.innerHTML = '<p class="artifact-atlas__detail-row">Element wählen …</p>';
        return;
      }
      const cat = catalog.CATEGORIES[a.category];
      const paletteHtml = (a.palette || [])
        .map((c) => `<span class="artifact-atlas__swatch" style="background:${c}" title="${c}"></span>`)
        .join('');
      detailEl.innerHTML = `
        <div class="artifact-atlas__detail-title">${a.name}</div>
        <p class="artifact-atlas__detail-row"><strong>Kategorie:</strong> ${cat?.label || a.category} — ${cat?.description || ''}</p>
        <p class="artifact-atlas__detail-row"><strong>Datei:</strong> <code>${a.file}</code> · Element #${a.num}</p>
        <p class="artifact-atlas__detail-row"><strong>Einsatz:</strong> ${a.usage || '—'}</p>
        <p class="artifact-atlas__detail-row"><strong>Integration:</strong> <code>${a.integration}</code>${paletteHtml ? ` · <span class="artifact-atlas__swatches">${paletteHtml}</span>` : ''}</p>`;
    }

    function renderGrid() {
      gridEl.innerHTML = '';
      const list =
        activeFilter === 'all'
          ? catalog.ARTIFACTS
          : catalog.byCategory(activeFilter);
      list.forEach((a) => {
        const card = document.createElement('article');
        card.className =
          'artifact-atlas__card' + (a.id === selectedId ? ' artifact-atlas__card--selected' : '');
        card.setAttribute('role', 'listitem');
        const wide = a.category === 'deck-graphic' || a.category === 'production';
        const stroke = isStrokeArtifact(a);
        const previewClass =
          'artifact-atlas__preview' + (wide ? ' artifact-atlas__preview--wide' : '') + (stroke ? ' artifact-atlas__preview--stroke' : '');
        const swatches = (a.palette || [])
          .map((c) => `<span class="artifact-atlas__swatch" style="background:${c}"></span>`)
          .join('');
        card.innerHTML = `
          <div class="${previewClass}">
            <img src="${assetUrl(assetsBase, a.file)}" alt="" loading="lazy">
          </div>
          <div class="artifact-atlas__name">${a.name}</div>
          <div class="artifact-atlas__meta">${catalog.CATEGORIES[a.category]?.label || a.category}</div>
          ${swatches ? `<div class="artifact-atlas__swatches">${swatches}</div>` : ''}`;
        card.addEventListener('click', () => {
          selectedId = a.id;
          renderGrid();
          showDetail(a);
          if (typeof config.onSelect === 'function') config.onSelect(a);
        });
        gridEl.appendChild(card);
      });
    }

    function renderMarquee() {
      const items = catalog.ARTIFACTS.slice();
      const track = document.createElement('div');
      track.className = 'artifact-atlas__marquee-track';
      const doubled = items.concat(items);
      doubled.forEach((a) => {
        const img = document.createElement('img');
        img.src = assetUrl(assetsBase, a.file);
        img.alt = '';
        if (isStrokeArtifact(a)) img.classList.add('aa-stroke');
        track.appendChild(img);
      });
      marqueeEl.innerHTML = '';
      marqueeEl.appendChild(track);
    }

    filtersEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.artifact-atlas__chip');
      if (!btn) return;
      activeFilter = btn.dataset.filter;
      renderFilters();
      renderGrid();
    });

    renderFilters();
    renderGrid();
    showDetail(catalog.ARTIFACTS.find((a) => a.id === selectedId));
    renderMarquee();

    return {
      setFilter(id) {
        activeFilter = id;
        renderFilters();
        renderGrid();
      },
      select(id) {
        selectedId = id;
        renderGrid();
        showDetail(catalog.ARTIFACTS.find((a) => a.id === id));
      },
    };
  }

  global.PAYDAY_ARTIFACT_ATLAS = { mount };
})(window);
