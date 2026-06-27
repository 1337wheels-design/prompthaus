# Kartendesign-Spezifikation

Yu-Gi-Oh! Spell-Card-inspiriertes Layout für physische Event-Karten.

> **IP-Hinweis:** Das Design orientiert sich am Stil von Spell Cards (grüner Frame, goldene Ornamente). Für kommerziellen Druck/Verkauf ist eine juristische Freigabe zu prüfen oder das Design durch eigene Markenelemente ausreichend zu differenzieren.

---

## Format & Maße

| Parameter | Wert |
|---|---|
| Kartenformat | 63 × 88 mm (Standard-Kartenmaß) |
| Empfohlene Bildauflösung | 1030 × 1500 px (Raster-Platzhalter) |
| Exportformat | SVG (Primär) + PDF/X-1a für Druckausgabe |
| Farbprofil | CMYK für Druck, RGB für Digital |
| Papiergewicht (physisch) | 300 gsm |
| Goldfolie | Optional, nur für Deluxe Packs |

---

## SVG-Layer-Struktur

Alle folgenden Elemente werden als separate benannte Layer in der SVG-Datei angelegt:

```
1. Border       — goldene Außenornamente, feine Innenlinien
2. Title        — Kartenname (Pixel-/Square-Sans, gold, Vektorpfad)
3. Icon         — runde „SPELL/魔"-Plakette oben rechts (grün)
4. ArtMask      — mittleres Rechteck mit Stern-Ecken (Glow)
5. ImageSlot    — <image xlink:href="placeholder.jpg"> (1:1.4 Crop)
6. TextBox      — Pergament-Box mit Effekttext (Serif-Look)
7. Footer       — ATK / DEF Labels + Set-ID (Kapitälchen)
```

---

## Farbschema (Spell Card)

| Element | Farbe / Stil |
|---|---|
| Rahmen (Inner Frame) | Grüner Spell-Farbton |
| Außenornamente | Gold |
| Titel-Schrift | Gold, gefüllt |
| Icon-Plakette | Rund, grün, Schrift weiß |
| TextBox-Hintergrund | Pergament-Optik (creme/beige) |

---

## Typografie

| Bereich | Stil | Format |
|---|---|---|
| Kartenname | Pixel-/Square-Sans (verkörpert) | SVG-Vektorpfad |
| Typzeile | Klein, eckige Klammern, z.B. `[Field Spell — Zone II]` | SVG-Text |
| Effekttext | Klassische Serif / „Old Paper"-Stil | SVG-Text (editierbar) |
| Footer | Kapitälchen, klein | SVG-Text |

---

## Bildbereich / Moab-Foto-Platzhalter

```svg
<!-- Platzhalter im SVG — später durch echtes Moab-Bild ersetzen -->
<image
  id="ArtSlot"
  xlink:href="placeholder_obstacle.jpg"
  x="42" y="95"
  width="380" height="270"
  preserveAspectRatio="xMidYMid slice"
/>
```

Bilder werden nach Event-Fotoprobe ausgetauscht. Das SVG bleibt editierbar.

---

## Kartentypen (4 Typen)

| Typ | Beschreibung | Anzahl (geplant) |
|---|---|---|
| **Field Spell** | Obstacle/Zone im Park (z.B. Stair Set + Hubba) | ~6–8 |
| **Challenge Card** | Einzelne Contest-Challenge mit Effekttext | ~10–12 |
| **Sponsor Reward** | Preis/Pack je Sponsor (Sofortpreis oder Tombola) | ~8–10 |
| **Artist / Commemo** | Kulturelle Beiträge, Attitude-Kooperation | ~4–6 |

---

## Prototyp-SVGs (Nächste Schritte)

Drei zu erstellende Prototypen:

1. **Basic** — Standard-Teilnehmerkarte, RGB-Digital
2. **Deluxe** — Goldfolie-Rahmen-Variante, CMYK-Druck
3. **Attitude-Art** — Künstlerisch überarbeitete Variante für Art-Pack

Testdruck-Workflow: SVG → CMYK-PDF/X-1a → Farbprofil-Check → Freigabe durch Sponsoren.
