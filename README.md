# Sternenthron

Privates Browser-Strategiespiel für 3 bis 6 Spieler: Hex-Galaxie, Strategiekarten, Flottenkampf, Bodeninvasionen, Technologien, Ratsabstimmungen und ein Wettrennen um 10 Siegpunkte. Alle Namen, Fraktionen, Texte und Grafiken sind eigene Inhalte.

## Starten

```bash
npm install
GAME_PASSWORD=euer-passwort npm start
```

Danach im Browser `http://localhost:3000` öffnen. Ein Spieler erstellt ein Spiel und gibt den 5-stelligen Spielcode an die anderen weiter. Spielstände werden in `saves/` gespeichert, Spieler können nach einem Verbindungsabbruch einfach neu laden.

Umgebungsvariablen: `PORT` (Standard 3000), `GAME_PASSWORD` (Gruppenpasswort), `SAVE_DIR`.

## Aufbau

- `src/data.js` – Fraktionen, Planeten, Einheiten, Technologien, Karten, Ziele
- `src/engine.js` – Regel-Engine (Phasen, Bewegung, Kampf, Produktion, Abstimmung)
- `server.js` – HTTP- und WebSocket-Server, Räume, Speicherung
- `public/` – Browser-Client (SVG-Karte, Dialoge)
- `src/bot.js`, `src/botrunner.js` – KI-Gegner
- `test/` – Simulationen: `smoke.js` (Zufallszüge), `bots.js` (reine Bot-Partien), `combat.js` (Raumkampf)

## KI-Gegner

In der Lobby fügt „+ KI-Gegner“ einen Bot mit zufälliger freier Fraktion hinzu. Bots wählen Strategiekarten, expandieren, kämpfen, forschen, stimmen ab und erfüllen Ziele. `BOT_DELAY` (ms) steuert, wie schnell sie ziehen.

## Bekannte Vereinfachungen (Version 0.2)

- Raumkampf läuft rundenweise mit Rückzug und eigener Verlustwahl; Bodenkampf und Geschützfeuer werden automatisch ausgewürfelt.
- Abstimmungen im Rat laufen gleichzeitig und verdeckt.
- Orbitalgeschütze feuern automatisch auf jede fremde Flotte, die in Reichweite einfliegt.
