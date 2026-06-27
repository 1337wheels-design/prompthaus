# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository-Zweck

Planungsrepository für **Üpark Payday 2026** — ein Skateboarding-Event mit Yu-Gi-Oh!-Style Spielkarten als Teilnehmer- und Sponsor-Mechanik. Enthält ausschließlich Planungsdokumente (Markdown), keine Applikationscode.

## Dokumentenstruktur

```
docs/
  event-overview.md     — Zeitplan (14:00–19:00), Challenges, Scoring-Parameter
  card-design-spec.md   — SVG-Layer-Spezifikation, Maße, Typografie, Prototypen
  sponsors.md           — Sponsorenpakete, Zielgruppen, Preisstrukturen
  distribution.md       — Pack-Typen, Tombola-Lose-Allocation, DSGVO-Hinweise
  refinement-plan.md    — 5-Schritte-Plan zur Finalisierung
```

## Kernkonzepte

**Kartenmechanik:** Physische Karten (63×88 mm, 300gsm) im Yu-Gi-Oh! Spell-Card-Stil kodieren Challenges, Obstacles (Field Spell Cards) und Sponsor-Preise. Karten enthalten QR-Codes für digitale Collectible-Gallery.

**Pack-Größen & Tombola:** Single (1 Los) / Double (3 Lose) / Triple (7 Lose) — Lose proportional zur Pack-Größe.

**Field Cards:** Repräsentieren reale Obstacles im Park (z.B. „STAIR SET + HUBBA"). Moab-Fotos als Platzhalter im SVG-`<image>`-Tag — nach Event-Fotoprobe austauschbar.

**Sponsoren-Zuweisung:** Jeder Sponsor belegt max. 2 Kartentypen. Attitude Bremen → Art/Commemo, Titus → Youth Rewards, Skate Deluxe → Premium, Pay Day + Skate Bar Hay Day → Cash/Voucher Double Set.

## IP-Hinweis

Das Kartendesign ist eine stilistische Hommage an Yu-Gi-Oh! Spell Cards. Für kommerziellen Druck/Verkauf juristische Freigabe prüfen oder Design durch eigene Markenelemente differenzieren (→ `docs/refinement-plan.md`, Offene Entscheidungen).

## Noch offen (Stand: Projektstart)

- IP-Strategie Design (Hommage safe vs. screen-accurate)
- Farbprofil-Entscheidung (CMYK Druck vs. RGB Digital)
- SVG-Prototypen noch nicht erstellt (Schritt 5 in `refinement-plan.md`)
- Tombola-Lose-Allocation finale Zahlen noch nicht bestätigt
