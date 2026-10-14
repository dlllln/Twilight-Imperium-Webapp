# Sternenthron

Die Dokumentation zu Stellar Hegemony steht in [stellar-hegemony/README.md](stellar-hegemony/README.md).
Browser-Strategiespiel für 2 bis 6 Spieler (Menschen und KI): Hex-Galaxie, Strategiekarten, Flottenkampf, Bodeninvasionen, Technologien, Ratsabstimmungen und ein Wettrennen um 10 Siegpunkte. Alle Namen, Fraktionen, Texte und Grafiken sind eigene Inhalte.

## Starten

```bash
npm install
npm start
```

Danach im Browser `http://localhost:3000` öffnen. Das Spiel ist öffentlich, ein Passwort ist nicht nötig. Ein Spieler erstellt ein Spiel und gibt den 5-stelligen Spielcode an die anderen weiter. Spielstände werden in `saves/` gespeichert, Spieler können nach einem Verbindungsabbruch einfach neu laden.

Umgebungsvariablen: `PORT` (Standard 3000), `SAVE_DIR`, `MAX_ROOMS` (Standard 300), `BOT_DELAY` und optional `GAME_PASSWORD`, falls der Server doch nur für eine Gruppe sein soll.

Ungenutzte Spiele werden nach 14 Tagen gelöscht, beendete nach einem Tag.

## Einzelspieler-Version

`node tools/build-solo.js` erzeugt `dist/sternenthron-solo.html`: eine einzelne Datei, die das Spiel ohne Server komplett im Browser gegen KI-Gegner laufen lässt.

## Online stellen (Render)

`render.yaml` startet nicht mehr Sternenthron, sondern **Stellar Hegemony** aus
`stellar-hegemony/` (Webdienst mit Socket.IO, PostgreSQL für den Event Store, Key Value für Lobbys).
Einrichtung und Grenzen des kostenlosen Tarifs stehen in `stellar-hegemony/docs/ARCHITEKTUR.md`
unter „Befehle“. Sternenthron läuft weiterhin lokal mit `npm start`.

## Aufbau

- `src/data.js` – Fraktionen, Planeten, Einheiten, Technologien, Karten, Ziele
- `src/engine.js` – Regel-Engine (Phasen, Bewegung, Kampf, Produktion, Abstimmung)
- `server.js` – HTTP- und WebSocket-Server, Räume, Speicherung
- `public/` – Browser-Client (SVG-Karte, Dialoge)
- `src/bot.js`, `src/botrunner.js` – KI-Gegner
- `test/` – Simulationen: `smoke.js` (Zufallszüge), `bots.js` (reine Bot-Partien), `combat.js` (Raumkampf)

## KI-Gegner

In der Lobby fügt „+ KI-Gegner“ einen Bot mit zufälliger freier Fraktion hinzu. Bots wählen Strategiekarten, expandieren, kämpfen, forschen, stimmen ab und erfüllen Ziele. `BOT_DELAY` (ms) steuert, wie schnell sie ziehen.

## Regelstand (Version 0.3)

- Bewegung: Nur fremde Kriegsschiffe (keine Jäger) versperren den Durchflug. Nebel, Asteroidenfelder, Supernovae und Schwerkraftrisse wirken wie beschrieben.
- Orbitalgeschütze feuern nach jeder Bewegung, auch die des aktiven Spielers auf gegnerische Schiffe im aktivierten System.
- Raumkampf: Flakfeuer in Runde 1, Rückzug wird angekündigt (erst Verteidiger, dann Angreifer; zieht sich der Verteidiger zurück, darf der Angreifer nicht), danach Würfeln, Verluste selbst zuordnen, Rückzug ausführen.
- Produktion: Bei Blockade (nur fremde Schiffe im System) können nur noch Bodentruppen gebaut werden. Flottenlimit und Kapazität werden geprüft.
- Forschung: Planeten mit Spezialisierung werden erschöpft, wenn sie eine Voraussetzung ersetzen.
- Spielbeginn: Jeder zieht zwei geheime Ziele und behält eines.
- Rat: Es wird reihum abgestimmt (links vom Sprecher beginnend, der Sprecher zuletzt), Stimmen sind sichtbar, bei Gleichstand entscheidet der Sprecher.
- Statusphase: Wer nach dem Neuverteilen zu wenige Flottenmarker hat, verliert überzählige Schiffe.
- Kontor kann andere Spieler kostenlos auffüllen, Rüstung erlaubt das Neuverteilen der Kommandomarker.

Noch vereinfacht: Bodenkampf, Bombardement und Geschützfeuer werden automatisch ausgewürfelt und zugeordnet, und beim Transport werden Einheiten nur im Start- und Zielsystem aufgenommen.
