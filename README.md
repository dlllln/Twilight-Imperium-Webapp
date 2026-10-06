# Sternenthron

Browser-Strategiespiel für 2 bis 6 Spieler (Menschen und KI): Hex-Galaxie, Strategiekarten, Flottenkampf, Bodeninvasionen, Technologien, Ratsabstimmungen und ein Wettrennen um 10 Siegpunkte. Alle Namen, Fraktionen, Texte und Grafiken sind eigene Inhalte.

## Starten

```bash
npm install
npm start
```

Danach im Browser `http://localhost:3000` öffnen. Das Spiel ist öffentlich, ein Passwort ist nicht nötig. Ein Spieler erstellt ein Spiel und gibt den 5-stelligen Spielcode an die anderen weiter. Spielstände werden in `saves/` gespeichert, Spieler können nach einem Verbindungsabbruch einfach neu laden.

Umgebungsvariablen: `PORT` (Standard 3000), `SAVE_DIR`, `MAX_ROOMS` (Standard 300), `BOT_DELAY` und optional `GAME_PASSWORD`, falls der Server doch nur für eine Gruppe sein soll.

Ungenutzte Spiele werden nach 14 Tagen gelöscht, beendete nach einem Tag.

## Online stellen (Render)

1. Auf [render.com](https://render.com) mit GitHub anmelden.
2. „New“ → „Blueprint“ wählen und dieses Repo auswählen. Render liest `render.yaml` und richtet den Dienst ein.
3. Nach dem ersten Build ist das Spiel unter der angezeigten `onrender.com`-Adresse erreichbar.

Hinweis: Im kostenlosen Tarif schläft der Server nach längerer Inaktivität ein (der erste Aufruf dauert dann etwas), und Spielstände gehen bei einem Neustart verloren. Ein bezahlter Tarif mit Festplatte behebt beides.

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
