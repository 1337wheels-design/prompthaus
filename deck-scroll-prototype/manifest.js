/**
 * Asset manifest — Quelle:
 * https://drive.google.com/drive/folders/1ogAECk3I-Rn9WAc-zNjf0tHpdDRyD-5_
 */
(function (global) {
  const DRIVE_FOLDER_URL =
    'https://drive.google.com/drive/folders/1ogAECk3I-Rn9WAc-zNjf0tHpdDRyD-5_?usp=sharing';

  /** Horizontale Deck-Grafiken (Scroll-Slides) */
  const DECK_SLIDES = [
    { id: 'el-39', file: 'Element 39.svg', label: 'Design 01', tag: 'SS26' },
    { id: 'el-41', file: 'Element 41.svg', label: 'Design 02', tag: 'SS26' },
    { id: 'el-42', file: 'Element 42.svg', label: 'Design 03', tag: 'SS26' },
    { id: 'el-43', file: 'Element 43.svg', label: 'Design 04', tag: 'SS26' },
    { id: 'el-44', file: 'Element 44.svg', label: 'Design 05', tag: 'SS26' },
    { id: 'el-45', file: 'Element 45.svg', label: 'Design 06', tag: 'SS26' },
    { id: 'el-46', file: 'Element 46.svg', label: 'Design 07', tag: 'SS26' },
    { id: 'el-47', file: 'Element 47.svg', label: 'Design 08', tag: 'SS26' },
    { id: 'el-48', file: 'Element 48.svg', label: 'Design 09', tag: 'SS26' },
    { id: 'el-49', file: 'Element 49.svg', label: 'Design 10', tag: 'SS26' },
    { id: 'el-50', file: 'Element 50.svg', label: 'Design 11', tag: 'SS26' },
    { id: 'el-51', file: 'Element 51.svg', label: 'Design 12', tag: 'SS26' },
    { id: 'el-52', file: 'Element 52.svg', label: 'Design 13', tag: 'SS26' },
  ];

  /** Kleine UI-/Ornament-Layer (Parallax) */
  const ORNAMENTS = [
    { id: 'orn-12', file: 'Element 12.svg', depth: 0.35 },
    { id: 'orn-13', file: 'Element 13.svg', depth: 0.5 },
    { id: 'orn-14', file: 'Element 14.svg', depth: 0.45 },
    { id: 'orn-16', file: 'Element 16.svg', depth: 0.55 },
    { id: 'orn-17', file: 'Element 17.svg', depth: 0.4 },
    { id: 'orn-18', file: 'Element 18.svg', depth: 0.6 },
  ];

  global.PAYDAY_DECK_SCROLL_MANIFEST = {
    DRIVE_FOLDER_URL,
    DECK_SLIDES,
    ORNAMENTS,
  };
})(window);
