# Deck Scroll Show (Prototyp)

Scroll-getriebene **Deck Show** mit SVGs aus dem Drive-Ordner  
[Google Drive — Elemente](https://drive.google.com/drive/folders/1ogAECk3I-Rn9WAc-zNjf0tHpdDRyD-5_?usp=sharing).

Eigenständig unter `deck-scroll-prototype/` — einbindbar in Event-Site oder Deck Shop ohne den bestehenden Event-Carousel (`shop/scroll-carousel.js`) zu verändern.

## Artefakt-Atlas (neu)

Der Ordner enthält **28 SVGs** in fünf Kategorien:

| Kategorie | Anzahl | Beispiele |
|-----------|--------|-----------|
| Deck-Grafiken | 14 | horizontale Comps 2123×549, Camo/Linear-Fills |
| Fadenkreuz & Zielhilfen | 4 | Element 12, 14, 16, 17 |
| Achsen & Guides | 2 | Element 13, 15 |
| Marken-Rahmen | 4 | Element 18, 19, 21, 22 |
| Kachel-Motive | 4 | Element 24–27 |
| Produktion | 1 | Element 28 (Matt-Platzhalter) |

`artifact-catalog.js` ist die **Single Source of Truth**; `manifest.js` und der Atlas lesen daraus.

```html
<link rel="stylesheet" href="deck-scroll-prototype/artifact-atlas.css">
<div id="artifact-atlas"></div>
<script src="deck-scroll-prototype/artifact-catalog.js"></script>
<script src="deck-scroll-prototype/artifact-atlas.js"></script>
<script>
  PAYDAY_ARTIFACT_ATLAS.mount({ root: '#artifact-atlas', assetsBase: 'deck-scroll-prototype/assets/' });
</script>
```

## Demo lokal

```bash
cd deck-scroll-prototype
python3 -m http.server 8765
# http://localhost:8765/
```

## Integration

```html
<link rel="stylesheet" href="deck-scroll-prototype/deck-scroll-show.css">
<div id="deck-scroll-show"></div>
<script src="deck-scroll-prototype/manifest.js"></script>
<script src="deck-scroll-prototype/deck-scroll-show.js"></script>
<script>
  PAYDAY_DECK_SCROLL_SHOW.mount({
    root: '#deck-scroll-show',
    assetsBase: 'deck-scroll-prototype/assets/',
    ctaTarget: '#shop-section',
    slideIds: ['el-39', 'el-41', 'el-42', 'el-43', 'el-44', 'el-45'],
    onSlideChange: (index, slide) => { /* optional */ },
    onCtaClick: () => { window.location.href = '/prompthaus/deck-shop/'; },
  });
</script>
```

### Optionen

| Option | Default | Beschreibung |
|--------|---------|--------------|
| `root` | — | CSS-Selektor oder Element |
| `assetsBase` | `assets/` | Pfad zu den Drive-SVGs |
| `slides` | — | Eigene Slide-Liste `{ id, file, label, tag }` |
| `slideIds` | erste 6 | Filter auf `manifest.js` |
| `scrollPerSlide` | `0.38` | Scroll-Höhe pro Slide (× 100vh) |
| `ctaTarget` | — | Element für CTA-Scroll |
| `onSlideChange` | — | Callback bei aktivem Slide |
| `onComplete` | — | Scroll am Ende der Show |
| `showOrnaments` | `true` | Kleine Element-SVGs als Parallax |

## Assets aktualisieren

```bash
python3 -m pip install gdown
python3 -m gdown --folder "https://drive.google.com/drive/folders/1ogAECk3I-Rn9WAc-zNjf0tHpdDRyD-5_" -O deck-scroll-prototype/assets
```

Labels in `manifest.js` an echte Designnamen (CHROME, NEON, …) anpassen.
