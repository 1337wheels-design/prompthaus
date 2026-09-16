/**
 * Payday Deck Renderer — shared canvas engine from decks/editor.html
 */
(function (global) {
  const W = 400, H = 1400;
  const ILLUS_H = 970, ILLUS_Y = 215;
  const ILLUS_BG_SEED = 451;
  const ILLUSTRATION_BG = ['#2a1008', '#182030', '#181828', '#201810', '#0e2010', '#282030', '#2a0820'];
  const DECK_PATH = 'M 200,0 C 310.4,0 400,89.6 400,200 L 400,1200 C 400,1310.4 310.4,1400 200,1400 C 89.6,1400 0,1310.4 0,1200 L 0,200 C 0,89.6 89.6,0 200,0 Z';

  const CAMO_PATTERNS = [
    { name: 'PAYDAY', seed: 42, palettes: [['#000000','#0e0e10','#1a1a1c','#222026'],['#2c1040','#3a1f4a','#4a2460','#5f3a72'],['#6e2a6f','#7a3880','#863780','#8d61a6'],['#a0a0a2','#bababa','#d0d0d2','#c8c8ca']] },
    { name: 'MILITARY', seed: 137, palettes: [['#080e04','#0c1408','#10180a','#141e0c'],['#1c2c10','#243618','#2c4020','#364c28'],['#3e5830','#4a6838','#567040','#5e7848'],['#6a8050','#788e5c','#889a68','#98a878']] },
    { name: 'DESERT', seed: 314, palettes: [['#1e1608','#28200e','#322a14','#3c3418'],['#4e3c24','#60502e','#726038','#806e44'],['#948060','#a8926e','#bc9e78','#c8aa84'],['#d4b88c','#dcca9c','#c8b082','#b89870']] },
    { name: 'ARCTIC', seed: 512, palettes: [['#c0d4e4','#ccdce8','#d4e4f0','#d0dcea'],['#98b4cc','#a4c0d8','#b0cce4','#8ea8c0'],['#deeaf8','#e8f2fc','#e4eef8','#f0f6fc'],['#f8fafe','#f2f6fc','#eef4fa','#e8f0f8']] },
    { name: 'NEON', seed: 999, palettes: [['#04000e','#080018','#0c0020','#10002a'],['#280060','#380080','#4000a0','#3400c0'],['#7000d0','#9000f0','#a000ff','#c000ff'],['#e000c0','#ff00d0','#ff40e8','#ff60f0']] },
    { name: 'NIGHT', seed: 777, palettes: [['#020308','#04060e','#060810','#080c14'],['#0a1422','#0c1c2e','#0e2038','#122440'],['#162c4c','#1a3458','#1e3a60','#223e68'],['#2a4a78','#304e80','#385688','#405e90']] },
    { name: 'CANDY', seed: 111, palettes: [['#1a000a','#240010','#2e0018','#380022'],['#7a0050','#920060','#aa0070','#c00080'],['#dd00a0','#ee10b0','#ff20c0','#ff40d0'],['#ff70e0','#ff90e8','#ffb0f0','#cc60cc']] },
    { name: 'COBALT', seed: 222, palettes: [['#060e1a','#081222','#0a162a','#0c1a32'],['#1a3460','#203c70','#264480','#2c4c90'],['#3a5ea8','#4468b8','#4e74c8','#5880d8'],['#6e92e0','#7aa0e8','#86aef0','#6888cc']] },
    { name: 'GHOST', seed: 333, palettes: [['#c0ccd8','#c8d4e0','#d0dce8','#d8e4f0'],['#a0b4c8','#a8bcd0','#b0c4d8','#b8cce0'],['#e0ecf8','#e8f2fc','#f0f6fe','#f4f8ff'],['#fafcff','#f6f9ff','#f0f5ff','#eaf2ff']] },
    { name: 'BLOOD', seed: 444, palettes: [['#080000','#100002','#180004','#200006'],['#400010','#580018','#700020','#880028'],['#aa0030','#c80038','#e00040','#f00048'],['#c02040','#a81830','#901020','#801818']] },
    { name: 'JUNGLE', seed: 555, palettes: [['#020800','#040c00','#060e00','#081200'],['#0c2408','#122e0c','#183810','#1e4214'],['#2a5c1a','#347220','#3e8826','#489e2c'],['#5cba38','#70cc48','#84d858','#98e468']] },
    { name: 'SUNSET', seed: 666, palettes: [['#0e0600','#160900','#1e0c00','#260f00'],['#4a1800','#602000','#762800','#8c3000'],['#b44800','#cc5800','#e46800','#f07818'],['#f09030','#e8a840','#d8b848','#c8a040']] },
    { name: 'TOXIC', seed: 888, palettes: [['#020400','#040800','#060c00','#081000'],['#103000','#184200','#205400','#286600'],['#508000','#689800','#80b000','#98c800'],['#c0e000','#d8f000','#e8fc00','#f0ff10']] },
    { name: 'ASH', seed: 101, palettes: [['#0e0e10','#141416','#1a1a1c','#202022'],['#2c2c2e','#383838','#424242','#4c4c4e'],['#606062','#707072','#808082','#909092'],['#a8a8aa','#b8b8ba','#c8c8ca','#d8d8da']] },
    { name: 'LAVA', seed: 202, palettes: [['#080000','#0e0000','#140000','#1a0000'],['#3a1000','#4e1400','#621800','#761c00'],['#c03000','#d44000','#e85000','#f06000'],['#f88030','#f4a050','#f0b060','#e8902c']] },
    { name: 'CHROME', seed: 303, palettes: [['#101012','#181818','#202022','#28282a'],['#404044','#505054','#606064','#707074'],['#909096','#a0a0a6','#b0b0b6','#c0c0c6'],['#d8d8dc','#e4e4e8','#ececf0','#f4f4f8']] },
    { name: 'DUSK', seed: 505, palettes: [['#180010','#200018','#280020','#300028'],['#600030','#800040','#a00050','#c00060'],['#c04000','#d85020','#e86030','#f07040'],['#e08000','#e89000','#f0a000','#f8b800']] },
    { name: 'FLARE', seed: 707, palettes: [['#1a0010','#240018','#2c0020','#340028'],['#7c0b7e','#8a0c8c','#9810a0','#a612a8'],['#b00873','#c82060','#e06020','#e87030'],['#f49f21','#f4b030','#f8c040','#fad050']] },
    { name: 'GROVE', seed: 808, palettes: [['#0e0a1a','#14102a','#1a1630','#100820'],['#1a4a08','#2a6010','#3a7818','#4a9020'],['#c00878','#d02068','#e04828','#f06020'],['#f09020','#f4a830','#f8c040','#fcd850']] },
  ];

  const ILLUSTRATIONS = [
    { name: 'KICKER', src: '../decks/illus_KICKER.svg' },
    { name: 'GAP', src: '../decks/illus_GAP.svg' },
    { name: 'HUBBA', src: '../decks/illus_HUBBA.svg' },
    { name: 'DOUBLE', src: '../decks/illus_DOUBLE.svg' },
    { name: 'GRASS', src: '../decks/illus_GRASS.svg' },
    { name: 'RAIL', src: '../decks/illus_RAIL.svg', whiteBands: { topFrac: 0.21, bottomFrac: 0.24 } },
    { name: 'MANUAL', src: '../decks/illus_MANUAL.svg', whiteBands: { topFrac: 0.20, bottomFrac: 0.20 } },
  ];

  const DECK_SIZES = [
    { id: '838', label: '8.38"', widthIn: 8.38, price: 59 },
    { id: '850', label: '8.5"', widthIn: 8.5, price: 59 },
  ];

  function drawLinearGradientBg(ctx, w, h, palette) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, palette[0][0]);
    g.addColorStop(0.33, palette[1][1]);
    g.addColorStop(0.66, palette[2][2]);
    g.addColorStop(1, palette[3][3]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function mkRng(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
  }

  function drawCamoBlobs(ctx, w, h, palettes, seed) {
    const rng = mkRng(seed);
    ctx.fillStyle = palettes[0][0];
    ctx.fillRect(0, 0, w, h);
    palettes.forEach((palette) => {
      const count = 18 + palettes.indexOf(palette) * 8;
      for (let b = 0; b < count; b++) {
        const cx = rng() * w, cy = rng() * h * 1.6 - h * 0.3;
        const rx = (rng() * 0.2 + 0.06) * w, ry = (rng() * 0.16 + 0.06) * h;
        const pts = 5 + Math.floor(rng() * 4);
        ctx.beginPath();
        for (let p = 0; p < pts; p++) {
          const a = (p / pts) * Math.PI * 2, an = ((p + 1) / pts) * Math.PI * 2;
          const pr = 0.6 + rng() * 0.7;
          const x1 = cx + Math.cos(a) * rx * pr, y1 = cy + Math.sin(a) * ry * pr;
          const xc = cx + Math.cos((a + an) / 2) * rx * (0.5 + rng() * 0.5);
          const yc = cy + Math.sin((a + an) / 2) * ry * (0.5 + rng() * 0.5);
          const x2 = cx + Math.cos(an) * rx * (0.6 + rng() * 0.7);
          const y2 = cy + Math.sin(an) * ry * (0.6 + rng() * 0.7);
          if (p === 0) ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(xc, yc, x2, y2);
        }
        ctx.closePath();
        ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
        ctx.fill();
      }
    });
  }

  function makeMonoPalette(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const h2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    const mk = (rv, gv, bv) => '#' + h2(rv) + h2(gv) + h2(bv);
    const dk = f => mk(r * f, g * f, b * f);
    const lt = (f, t) => mk(r * f + (255 - r) * t, g * f + (255 - g) * t, b * f + (255 - b) * t);
    return [[dk(0.30), dk(0.36), dk(0.42), dk(0.48)], [dk(0.55), dk(0.65), dk(0.75), dk(0.85)], [dk(0.88), dk(0.93), dk(0.97), dk(1.00)], [lt(0.90, 0.05), lt(0.85, 0.10), lt(0.80, 0.15), lt(0.70, 0.22)]];
  }

  function drawCamoBleedBands(ctx, ctxW, ctxH, illusY, illusH, palette, seed, bands) {
    if (bands.topFrac) {
      const topH = Math.round(illusH * bands.topFrac);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, illusY, ctxW, topH); ctx.clip();
      drawCamoBlobs(ctx, ctxW, ctxH, palette, seed);
      ctx.restore();
    }
    if (bands.bottomFrac) {
      const botH = Math.round(illusH * bands.bottomFrac);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, illusY + illusH - botH, ctxW, botH); ctx.clip();
      drawCamoBlobs(ctx, ctxW, ctxH, palette, seed);
      ctx.restore();
    }
  }

  function drawCamoEdgeBleed(ctx, w, h, illusY, illusH, palette, seed) {
    const fadeH = Math.round(illusH * 0.20);
    const topOfc = document.createElement('canvas');
    topOfc.width = w; topOfc.height = fadeH;
    const tc = topOfc.getContext('2d');
    tc.save(); tc.translate(0, -illusY); drawCamoBlobs(tc, w, h, palette, seed); tc.restore();
    const tg = tc.createLinearGradient(0, 0, 0, fadeH);
    tg.addColorStop(0, 'rgba(0,0,0,1)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
    tc.globalCompositeOperation = 'destination-in';
    tc.fillStyle = tg; tc.fillRect(0, 0, w, fadeH);
    ctx.drawImage(topOfc, 0, illusY);
    const botOfc = document.createElement('canvas');
    botOfc.width = w; botOfc.height = fadeH;
    const bc = botOfc.getContext('2d');
    bc.save(); bc.translate(0, -(illusY + illusH - fadeH)); drawCamoBlobs(bc, w, h, palette, seed); bc.restore();
    const bg_ = bc.createLinearGradient(0, 0, 0, fadeH);
    bg_.addColorStop(0, 'rgba(0,0,0,0)'); bg_.addColorStop(1, 'rgba(0,0,0,1)');
    bc.globalCompositeOperation = 'destination-in';
    bc.fillStyle = bg_; bc.fillRect(0, 0, w, fadeH);
    ctx.drawImage(botOfc, 0, illusY + illusH - fadeH);
  }

  function drawIllustration(ctx, w, h, img, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const srcAspect = img.naturalWidth / img.naturalHeight;
    const dstAspect = w / h;
    let drawW, drawH, sx, sy;
    if (srcAspect > dstAspect) { drawH = h; drawW = h * srcAspect; sx = ox + (w - drawW) / 2; sy = oy; }
    else { drawW = w; drawH = w / srcAspect; sx = ox; sy = oy + (h - drawH) / 2; }
    ctx.drawImage(img, sx, sy, drawW, drawH);
  }

  function paintBackground(ctx, w, h, opts) {
    const camoIndex = opts.camoIndex ?? 0;
    const illusIndex = opts.illusIndex ?? 0;
    const camoStyle = opts.camoStyle || 'blob';
    const camoOnly = opts.camoOnly ?? false;
    const camo = CAMO_PATTERNS[camoIndex];

    if (camoStyle === 'linear') {
      drawLinearGradientBg(ctx, w, h, camo.palettes);
    } else {
      drawCamoBlobs(ctx, w, h, camo.palettes, camo.seed);
    }

    if (camoOnly) return;

    const ill = ILLUSTRATIONS[illusIndex];
    const bgColor = ILLUSTRATION_BG[illusIndex];
    const illusPalette = makeMonoPalette(bgColor);
    const img = illustrationImgs[illusIndex];

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, ILLUS_Y, w, ILLUS_H); ctx.clip();
      drawIllustration(ctx, w, ILLUS_H, img, 0, ILLUS_Y);
      if (ill.whiteBands) drawCamoBleedBands(ctx, w, h, ILLUS_Y, ILLUS_H, illusPalette, ILLUS_BG_SEED, ill.whiteBands);
      ctx.restore();
      drawCamoEdgeBleed(ctx, w, h, ILLUS_Y, ILLUS_H, illusPalette, ILLUS_BG_SEED);
    }
  }

  let logoImg = null;
  const illustrationImgs = [];

  function loadAssets(basePath) {
    basePath = basePath || '../decks/';
    return new Promise((resolve) => {
      let logoDone = false;
      let illusLoaded = 0;
      const total = ILLUSTRATIONS.length;

      const logo = new Image();
      logo.onload = () => { logoImg = logo; logoDone = true; tryResolve(); };
      logo.onerror = () => { logoDone = true; tryResolve(); };
      logo.src = basePath + 'payday_logo_aligned.png';

      ILLUSTRATIONS.forEach((ill, i) => {
        const img = new Image();
        illustrationImgs[i] = img;
        img.onload = () => { illusLoaded++; tryResolve(); };
        img.onerror = () => { illusLoaded++; tryResolve(); };
        img.src = ill.src.startsWith('.') ? ill.src : basePath + ill.src;
      });

      function tryResolve() {
        if (logoDone && illusLoaded >= total) resolve();
      }
      setTimeout(resolve, 10000);
    });
  }

  function renderDeck(canvas, opts = {}) {
    const {
      camoIndex = 0,
      illusIndex = 0,
      camoStyle = 'blob',
      camoOnly = false,
      showLogo = true,
      logoScale = 0.85,
    } = opts;
    const ctx = canvas.getContext('2d');
    const path = new Path2D(DECK_PATH);
    const cw = canvas.width || W, ch = canvas.height || H;
    const sx = cw / W, sy = ch / H;

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.scale(sx, sy);
    ctx.clip(path);

    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const bgCtx = bg.getContext('2d');
    paintBackground(bgCtx, W, H, { camoIndex, illusIndex, camoStyle, camoOnly });
    ctx.drawImage(bg, 0, 0);

    if (showLogo && logoImg && logoImg.naturalWidth) {
      const drawH = H * logoScale;
      const drawW = drawH * (logoImg.naturalWidth / logoImg.naturalHeight);
      ctx.drawImage(logoImg, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
    }
    ctx.restore();

    ctx.save();
    ctx.scale(sx, sy);
    ctx.strokeStyle = 'rgba(208,208,210,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke(path);
    ctx.restore();
  }

  function renderFromDesign(canvas, design, showLogo = true) {
    renderDeck(canvas, {
      camoIndex: design.camoIndex,
      camoStyle: design.camoStyle || 'blob',
      camoOnly: true,
      showLogo,
      logoScale: design.logoScale ?? 0.72,
    });
  }

  global.PaydayDeckRenderer = {
    W, H, CAMO_PATTERNS, ILLUSTRATIONS, DECK_SIZES,
    loadAssets, renderDeck, renderFromDesign,
  };
})(window);
