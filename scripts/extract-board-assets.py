#!/usr/bin/env python3
"""Extract embedded board JPEGs from Payday PDFs → deck-shop/assets/boards/"""
import hashlib
import io
import json
import os
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / 'deck-shop' / 'assets' / 'pdfs'
OUT_DIR = ROOT / 'deck-shop' / 'assets' / 'boards'
THUMB_W, PREVIEW_W = 200, 400


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}

    for pdf_path in sorted(PDF_DIR.glob('payday_*.pdf')):
        doc = fitz.open(pdf_path)
        imgs = doc[0].get_images(full=True)
        if not imgs:
            raise SystemExit(f'No embedded image in {pdf_path.name}')
        info = doc.extract_image(imgs[0][0])
        data = info['image']
        sha = hashlib.sha256(data).hexdigest()
        base = pdf_path.stem
        img = Image.open(io.BytesIO(data))

        for suffix, width in (('-thumb', THUMB_W), ('-preview', PREVIEW_W)):
            ratio = width / img.width
            resized = img.resize((width, int(img.height * ratio)), Image.Resampling.LANCZOS)
            out = OUT_DIR / f'{base}{suffix}.jpg'
            resized.save(out, 'JPEG', quality=88 if suffix == '-thumb' else 90, optimize=True)

        manifest[base] = {
            'pdf': pdf_path.name,
            'sha256': sha,
            'width': info['width'],
            'height': info['height'],
            'thumb': f'boards/{base}-thumb.jpg',
            'preview': f'boards/{base}-preview.jpg',
        }
        print(f'{base}: sha256={sha[:16]}…')
        doc.close()

    (OUT_DIR / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Wrote {len(manifest)} boards → {OUT_DIR}')


if __name__ == '__main__':
    main()
