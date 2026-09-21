/**
 * Scroll-Show Manifest (abgeleitet aus artifact-catalog.js)
 */
(function (global) {
  const cat = global.PAYDAY_ARTIFACT_CATALOG;
  const DRIVE_FOLDER_URL = cat
    ? cat.DRIVE_FOLDER_URL
    : 'https://drive.google.com/drive/folders/1ogAECk3I-Rn9WAc-zNjf0tHpdDRyD-5_?usp=sharing';

  const DECK_SLIDES = cat ? cat.deckSlides() : [];
  const ORNAMENTS = cat ? cat.ornaments() : [];

  global.PAYDAY_DECK_SCROLL_MANIFEST = {
    DRIVE_FOLDER_URL,
    DECK_SLIDES,
    ORNAMENTS,
  };
})(window);
