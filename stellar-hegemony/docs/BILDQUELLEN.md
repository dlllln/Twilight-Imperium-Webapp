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
  Commit `e0de5a7db198ae4fd66cfa5270fcca893bb510a3`: Einheiten, Systemgrafiken,
  Thunder’s-Edge-Fraktionsreferenzen und Stammdaten der 30 offiziellen Fraktionen.

Die Auswahl enthält 30 offizielle Standardfraktionen: 17 aus dem Grundspiel,
7 aus Prophecy of Kings, den Rat der Keleres und 5 aus Thunder’s Edge.
Firmament/Obsidian ist eine Fraktion mit zwei Formen; die Mahact-Könige aus dem
separaten Spielmodus Twilight’s Fall zählen nicht als zusätzliche Standardfraktionen.
Die acht früheren Eigenkreationen bleiben im Content ausschließlich für ältere
Spielstände und Referenzen verfügbar und erscheinen nicht in der neuen Auswahl.
Neue Spiele verwenden vorrangig die offiziellen Fraktionen.

Heimatsysteme, Planetenwerte, Startflotten und Anführernamen stammen aus den
festgeschriebenen Daten. Planeten-IDs sind pro Fraktion getrennt, damit gemeinsame
Heimatnamen (etwa Keleres/Mentak) nicht kollidieren. Nomad beginnt mit einem
Flaggschiff; Muaat mit einer Kriegssonne. Die Webapp verwendet ihren angepassten
Technologiebaum, acht bestehende Fähigkeitsprofile und vereinfachte Anführeraktionen.
Komplexe originale Sonderregeln, Fraktionseinheiten, flexible Starttechnologien und
die Verwandlung Firmament/Obsidian werden dadurch nicht vollständig nachgebildet.
Auswahltechnologien und frei verteilbare Starteinheiten sind vorbelegt. Diese
Unterscheidung ist in der Fraktionsauswahl sichtbar; vollständige Originalregeln
sind als Bogen bzw. Referenzkarte zugänglich. Bei Karten bleiben
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
node tools/import-ti4-factions.mjs
```

`assets:sync` lädt nur die erfassten Bilder von festgeschriebenen Git-Commits.
`assets:check` prüft offline Bildsignaturen, Quellen und Prüfsummen. Ein Wechsel der
Quellversion erfolgt bewusst über die Kategorie-Manifeste.

`import-ti4-factions.mjs` erneuert den offiziellen Fraktionskatalog und sein
Bildmanifest aus denselben festgeschriebenen Quellen. Anschließend `assets:sync`
ausführen und die erzeugten TypeScript-/JSON-Dateien mit Prettier formatieren.

## Urheber

Twilight Imperium und die originalen Illustrationen und Spielgrafiken gehören
Fantasy Flight Games / ihren jeweiligen Rechteinhabern. Dieses Projekt ist ein
inoffizielles Fanprojekt. Die Softwarelizenzen der Community-Repositories gelten
nicht automatisch für die enthaltenen Spielgrafiken; beide Quellen nehmen die
Grafiken ausdrücklich von ihrer Softwarelizenz aus.

Die bisherige eigenständige Sternenthron-Version im Repository-Root wird über
`npm start` gestartet. Die neue Bildintegration betrifft Stellar Hegemony, die in
`render.yaml` konfigurierte Webapp.
