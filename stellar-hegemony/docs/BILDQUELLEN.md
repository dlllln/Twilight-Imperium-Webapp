# Twilight-Imperium-Bilder

Die aktive Webapp in `apps/web` verwendet originale Twilight-Imperium-IV-Grafiken
aus den Community-Sammlungen TI4-TTPG und AsyncTI4. Die Dateien liegen lokal in
`apps/web/public/ti4` und werden beim Vite-Build unverändert mitgeliefert. Es sind
keine externen Bildanfragen während des Spiels nötig.

## Quellen und Zuordnung

- [TI4-Online/TI4-TTPG](https://github.com/TI4-Online/TI4-TTPG), Commit
  `f5750930f0ed3283e15fc891af206eded2ebe739`: Fraktionswappen, Vorder- und Rückseiten
  der Fraktionsbögen sowie Strategie-, Aktions-, Agenda-, Ziel-, Technologie-,
  Erkundungs-, Relikt- und legendäre Planetenkarten.
- [AsyncTI4/TI4_map_generator_bot](https://github.com/AsyncTI4/TI4_map_generator_bot),
  Commit `e0de5a7db198ae4fd66cfa5270fcca893bb510a3`: Einheiten und Systemgrafiken.

Die bestehenden sechs Fraktionen, Spielkarten und Planeten haben eigene Namen und
angepasste Regeln. Die Bildzuordnung ändert diese Regeln und gespeicherten IDs
nicht. Fraktionsillustrationen nennen ihre TI-Herkunft separat. Bei Karten bleiben
die spielbaren Texte der App lesbar; fremde gedruckte Regeln werden nicht als
Regeln dieser App ausgegeben. Die ursprünglichen Fraktionsbögen sind als
Bildreferenz zugänglich.

Die komplette Download-Zuordnung steht in `tools/ti4/{factions,cards,units}.json`.
`apps/web/public/ti4/sources.json` protokolliert für jede Datei die genaue
Quelladresse, Größe und SHA-256-Prüfsumme.

## Aktualisieren und prüfen

```sh
pnpm assets:sync
pnpm assets:check
```

`assets:sync` lädt nur die erfassten Bilder von festgeschriebenen Git-Commits.
`assets:check` prüft offline Bildsignaturen, Quellen und Prüfsummen. Ein Wechsel der
Quellversion erfolgt bewusst über die Kategorie-Manifeste.

## Urheber

Twilight Imperium und die originalen Illustrationen und Spielgrafiken gehören
Fantasy Flight Games / ihren jeweiligen Rechteinhabern. Dieses Projekt ist ein
inoffizielles Fanprojekt. Die Softwarelizenzen der Community-Repositories gelten
nicht automatisch für die enthaltenen Spielgrafiken; beide Quellen nehmen die
Grafiken ausdrücklich von ihrer Softwarelizenz aus.

Die bisherige eigenständige Sternenthron-Version im Repository-Root wird über
`npm start` gestartet. Die neue Bildintegration betrifft Stellar Hegemony, die in
`render.yaml` konfigurierte Webapp.
