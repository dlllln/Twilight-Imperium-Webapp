# Stellar Hegemony – Architektur

Arbeitstitel „Stellar Hegemony“. Rundenbasiertes Multiplayer-Strategiespiel im Browser,
mechanisch am Grundspiel eines bekannten 4X-Brettspiels orientiert. Alle Namen, Texte,
Fraktionen und Grafiken sind eigene Erfindungen; Regeln und Zahlenwerte liegen als Daten
im Paket `content`. Regelverweise in Tests nennen nur die Abschnittsnummer des deutschen
Referenzhandbuchs („RR 28.1“), niemals dessen Wortlaut.

## 1. Ordnerstruktur

```
stellar-hegemony/
├── package.json             pnpm-Workspace-Root (Skripte: typecheck, lint, test, check)
├── pnpm-workspace.yaml
├── tsconfig.base.json       strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├── eslint.config.js         Schichtgrenzen, keine any, ≤ 20 Zeilen/Funktion, keine Magic Numbers in der Domain
├── vitest.config.ts         Coverage-Schwelle 90 % für packages/domain
├── .husky/pre-commit        lint-staged + typecheck
├── docs/
│   ├── ARCHITEKTUR.md       dieses Dokument
│   └── REGELFRAGEN.md       offene Regelentscheidungen
├── packages/
│   ├── domain/              reine Spiellogik, keine Abhängigkeiten
│   │   └── src/
│   │       ├── shared/        Result, DomainError, gebrandete Ids
│   │       ├── hex/           axiale Hex-Koordinaten
│   │       ├── ports/         RandomPort, ClockPort
│   │       ├── unit/          UnitDefinition, Fähigkeiten, Katalog, Unit
│   │       ├── planet/        PlanetDefinition, PlanetState, Planet (Expert)
│   │       ├── galaxy/        SystemTile, StarSystem (Expert), MapString, GalaxyAssembler (Builder),
│   │       │                  GalaxyGenerator (Factory), Nachbarschaft  → It. 4: HexPathfinder
│   │       ├── player/        CommandSheet, PlayerState
│   │       ├── game/          GameConfig, RuleNumbers, GameState, GameEvent, GameCommand
│   │       ├── eventsourcing/ DomainEvent, ReducerMap, Command, CommandHandler
│   │       ├── setup/         CreateGame, SeatPlayer                          → It. 2/3: Galaxie, Startaufstellung
│   │       ├── phases/        (It. 3) State Pattern: Setup/Strategy/Action/Status/Agenda/GameOver
│   │       ├── faction/       (It. 4) FactionDefinition, Heimatsysteme und Startflotten
│   │       ├── tactical/      (It. 4) Aktivieren, ShipMoveValidator, ShipPathfinder, Transport, Anomalien
│   │       ├── strategy/      (It. 3/4) Strategiekarten als Strategy Pattern (Vorhut, Gesandtschaft)
│   │       ├── combat/        (It. 5) CombatResolver, HitAssignment, SpaceCannon, Bombardment, GroundCombat
│   │       ├── economy/       (It. 6) ProductionCalculator, PaymentPlanner, Transaction
│   │       ├── technology/    (It. 7) TechTree, UpgradeResolver
│   │       ├── objectives/    (It. 8) ObjectiveEvaluator, VictoryChecker
│   │       ├── effects/       (It. 9) EffectResolver, TimingWindowManager
│   │       ├── agenda/        (It. 10) VotingTally, AgendaResolver
│   │       └── factions/      (It. 11) FactionAbility-Strategien
│   ├── application/         Use Cases: GameController, Ports (EventStorePort, EventPublisherPort)
│   ├── infrastructure/      Adapter: SeededRandom, SystemClock, InMemoryEventStore, InProcessEventPublisher
│   │                        → It. 12: PostgresEventStore, RedisLobbyStore, SocketIoGateway, Logger
│   └── content/             Daten: Regelzahlen, Einheiten  → Systeme, Fraktionen, Techs, Karten
└── apps/
    ├── server/              (It. 12) Fastify + Socket.IO, Composition Root
    └── web/                 React 18 + Vite + Zustand, i18n de/en, Playwright-E2E
        └── src/render/      (It. 4) PixiJS-Szene: prozeduraler Nebel, Planeten, Anomalien,
                             Schiffsminiaturen, Bloom-Glühen; darüber SVG-Trefferflächen
```

Abhängigkeiten zeigen nur nach innen: `web → application → domain`, `infrastructure → application → domain`,
`content → domain`. ESLint (`no-restricted-imports`) bricht den Build, wenn eine Schicht nach außen greift.

## 2. Architekturentscheidungen

| Entscheidung         | Umsetzung                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event Sourcing       | `Command` → `CommandHandler.decide()` → `DomainEvent[]` → `evolveGame()` (Reducer) → `GameState`. Der Zustand entsteht nur aus Events (`replayGame`).                |
| Determinismus        | Zufall nur über `RandomPort`. Würfelergebnisse stehen im Event, Replays würfeln nie neu.                                                                             |
| Fehler als Werte     | `Result<T, E>`; ESLint verbietet `throw` in `packages/domain/src`.                                                                                                   |
| Unveränderlichkeit   | Alle Zustandstypen sind `readonly`; Änderungen liefern neue Objekte.                                                                                                 |
| Server autoritativ   | Clients senden Commands; der Server liefert pro Spieler gefilterte Views (It. 12: `PlayerViewProjector`).                                                            |
| Keine Magic Numbers  | `RuleNumbers` (Domain-Typ) mit Werten aus `content/rule-numbers.ts`.                                                                                                 |
| Undo vor Bestätigung | Der Client hält einen unbestätigten Zug lokal (Commands werden gegen eine lokale Kopie simuliert) und sendet erst beim Bestätigen. Bestätigte Events sind endgültig. |

## 3. Domain-Modell (UML-artig)

```
«value» Hex { q, r } ── hexDistance, hexNeighbors, hexRing, hexSpiral, hexKey

«data» UnitDefinition
  id: UnitTypeId, category: ship|groundForce|structure, isFighter
  cost?: { resources, unitsPerCost }, combat?: { hitOn, dice }, move?, capacity?
  capabilities: UnitCapability[]   ◇── sustainDamage | bombardment | spaceCannon(range)
                                        | antiFighterBarrage | production(bonus) | planetaryShield
                                        | ignoresPlanetaryShield | fighterHangar(n)
  componentLimit, requiresTechnology?
«interface» CanMove, HasCapacity, HasCombat, CanBeProduced   (Type Guards auf Daten)
«interface» UnitCatalog { find(type), all() } ◁── StaticUnitCatalog   (It. 7: PlayerUnitCatalog mit Upgrades)
«data» Unit { id, type, owner, damaged }

«data» PlanetDefinition { id, resources, influence, trait?, technologySpecialty? }
«data» PlanetState { id, controller, exhausted, units: Unit[] }
«expert» Planet { resources, influence, isExhausted, exhaust(p): Result, ready(), availableResources() }

«data» SystemTile { id, back: center|home|blue|red, planets, anomaly?, wormholes[] }
«data» SystemState { id, position: Hex, planetIds, spaceUnits: Unit[], commandTokens: PlayerId[] }
«expert» StarSystem { nonFighterShipCount, exceedsFleetLimit, capacity, capacityUsage,
                      exceedsCapacity, opponentsWithShips, hasCommandToken }

«value» CommandSheet { tactic, fleet, strategy; spend(pool), gain(pool, n), redistribute(target) }
«data» PlayerState { id, name, color, faction, seat, commandPools, reinforcementTokens,
                     tradeGoods, commodities, commodityLimit, technologies, victoryPoints }

«data» GameConfig { playerCount, victoryPointsToWin, rules: RuleNumbers }
«data» GameState { id, config, version, round, phase, speaker, players[], systems{}, planets{},
                   nextUnitNumber, strategyCards{}, pickQueue[], actionPhase?, centerTokenRemoved, winner }
«data» StrategyCardDefinition { id, initiative, mechanic, secondaryCostsStrategyToken, parameters }
«data» StrategyCardState { id, initiative, mechanic, holder?, exhausted, tradeGoods }
«data» ActionPhaseState { order[], active?, passed[], secondary?: { card, awaiting[] } }
«state» GamePhase { name, accepts(commandType), next(state) }  ◁── SetupPhase, StrategyPhase,
        ActionPhase, StatusPhase, AgendaPhase, GameOverPhase
«strategy» StrategyEffect { mechanic, primary(input), secondary(input) }  ◁── commandTokensEffect
«value» Payment { planets[], tradeGoods } ── evaluatePayment(currency), paymentEvents
       1 ── * PlayerState, 1 ── * SystemState, 1 ── * PlanetState

«interface» CommandHandler<S, C, E> { commandType; decide(state, command, ctx): Result<E[]> }
«type» ReducerMap<S, E>   genau ein Reducer pro Event-Typ (vom Compiler erzwungen)

«port» RandomPort { nextInt(min, max) }      «port» ClockPort { now() }
«port» EventStorePort { load, append(expectedVersion) }   «port» EventPublisherPort { publish }
«controller» GameController { create(CreateGame), execute(gameId, GameCommand), load(gameId) }
```

Geplante Erweiterungen (je Iteration, gleiche Muster):

```
«service» HexPathfinder, MovementValidator, CombatResolver, ProductionCalculator, VotingTally
«fabrication» EffectResolver, TimingWindowManager (Chain of Responsibility: when → after,
              ab dem aktiven Spieler im Uhrzeigersinn)
«data» EffectDefinition { trigger, timing: when|after|action, condition, cost, effect }
«strategy» FactionAbility, CardEffect, BotStrategy
«factory» GalaxyBuilder (Map-String, Draft), UnitFactory
```

## 4. Commands und Events

Commands sind Absichten (Imperativ), Events sind Tatsachen (Partizip). ✓ = umgesetzt.

| Bereich             | Commands                                                                                                             | Events                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aufbau              | ✓ CreateGame, ✓ SeatPlayer, ✓ ImportMap, ✓ GenerateGalaxy, PlaceSystemTile (Draft), ✓ StartGame, KeepSecretObjective | ✓ GameCreated, ✓ PlayerSeated, ✓ GalaxyAssembled, SystemTilePlaced, ✓ HomeSystemPlaced (mit Startflotte), ObjectivesPrepared, SecretObjectivesDealt, SecretObjectiveKept, ✓ GameStarted (legt auch den Sprecher fest)                                                                                                                                            |
| Strategiephase      | ✓ PickStrategyCard                                                                                                   | ✓ StrategyPhaseStarted, ✓ StrategyCardPicked, ✓ TradeGoodsPlacedOnCards, ✓ ActionPhaseStarted                                                                                                                                                                                                                                                                    |
| Taktische Aktion    | ✓ ActivateSystem, ✓ MoveShips, AnnounceRetreat, AssignHits, CommitGroundForces, ProduceUnits, ✓ EndTacticalAction    | ✓ SystemActivated, ✓ ShipsMoved, ✓ GravityRiftRolled, SpaceCannonFired, AntiFighterBarrageFired, CombatRoundRolled, HitsAssigned, UnitDamaged, ✓ UnitsDestroyed, Retreated, SpaceCombatEnded, BombardmentRolled, GroundForcesCommitted, GroundCombatRoundRolled, PlanetControlGained, CenterTokenRemoved, UnitsProduced, PlanetsExhausted, ✓ TacticalActionEnded |
| Strategische Aktion | ✓ PerformStrategicAction, ✓ ResolveSecondary, ✓ DeclineSecondary                                                     | ✓ StrategicActionPerformed, ✓ SecondaryResolved, ✓ SecondaryDeclined, ✓ CommandTokensGained, ✓ PlanetsExhausted, ✓ TradeGoodsSpent, ✓ CommandTokensPlaced, ✓ PlanetsReadied, SpeakerChanged, ActionCardsDrawn, StructurePlaced, ✓ TradeGoodsGained, CommoditiesReplenished, CommandTokenReturned, TechnologyResearched, SecretObjectiveDrawn                     |
| Komponentenaktion   | PlayActionCard, UseComponentAbility                                                                                  | ActionCardPlayed, ActionCardCancelled, EffectResolved                                                                                                                                                                                                                                                                                                            |
| Passen              | ✓ Pass                                                                                                               | ✓ PlayerPassed, ✓ TurnEnded, ✓ StatusPhaseStarted                                                                                                                                                                                                                                                                                                                |
| Handel              | ProposeTransaction, AcceptTransaction, RejectTransaction                                                             | TransactionProposed, TransactionCompleted, TransactionRejected                                                                                                                                                                                                                                                                                                   |
| Statusphase         | ScoreObjective, SkipScoring, DiscardActionCards, RedistributeCommandTokens                                           | ObjectiveScored, PublicObjectiveRevealed, ActionCardsDrawn, ActionCardsDiscarded, CommandTokensReturned, CommandTokensRedistributed, PlanetsReadied, UnitsRepaired, StrategyCardsReturned, StatusPhaseEnded                                                                                                                                                      |
| Agendaphase         | CastVotes, Abstain, BreakTie                                                                                         | AgendaRevealed, VotesCast, PlayerAbstained, LawEnacted, DirectiveResolved, AgendaDiscarded, AgendaPhaseEnded                                                                                                                                                                                                                                                     |
| Reaktionsfenster    | PlayReaction, PassReaction                                                                                           | TimingWindowOpened, ReactionPlayed, ReactionPassed, ReactionTimedOut, TimingWindowClosed                                                                                                                                                                                                                                                                         |
| Sieg                | –                                                                                                                    | VictoryPointGained, GameWon                                                                                                                                                                                                                                                                                                                                      |

## 5. Prinzipien je Klasse (Iteration 1)

| Element                                                | Prinzip                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `Result`, `guard`, `firstFailure`                      | Clean Code: Fehler als Werte, keine verschachtelten if-Kaskaden.                            |
| `Hex`-Funktionen                                       | High Cohesion, reine Funktionen; Pure Fabrication für Geometrie.                            |
| `RandomPort`, `ClockPort`                              | DIP: Domain kennt nur Abstraktionen; `SeededRandom`, `SystemClock` im Composition Root.     |
| `UnitDefinition` + `UnitCapability`                    | LSP/Polymorphie: Engine fragt Fähigkeiten ab, nie Typnamen. OCP: neue Einheit = neue Daten. |
| `CanMove`, `HasCapacity`, `HasCombat`, `CanBeProduced` | ISP: kleine Rollen-Interfaces mit Type Guards.                                              |
| `UnitCatalog` / `StaticUnitCatalog`                    | DIP + Protected Variations: später ersetzt durch spielerabhängigen Katalog mit Upgrades.    |
| `Planet`                                               | Information Expert: Ressourcen, Einfluss, Erschöpfung.                                      |
| `StarSystem`                                           | Information Expert: Flottenlimit, Kapazität, Gegner im System.                              |
| `CommandSheet`                                         | Wertobjekt, SRP: nur Pools und deren Invarianten.                                           |
| `GameConfig`, `RuleNumbers`                            | Protected Variations: 10/14 Siegpunkte, Spielerzahl, alle Regelzahlen.                      |
| `ReducerMap`, `evolveGame`, `replayGame`               | OCP + Indirection: Module registrieren ihre Reducer; Vollständigkeit prüft der Compiler.    |
| `CommandHandler`, `seatPlayerHandler`                  | Command Pattern, SRP: ein Handler pro Command.                                              |
| `decideGameCommand`                                    | Controller in der Domain: Dispatch über eine typisierte Handler-Tabelle.                    |
| `GameController`                                       | GRASP Controller + DIP: orchestriert Store, Domain, Publisher über Ports.                   |
| `InMemoryEventStore`                                   | Adapter (Hexagonal), optimistische Sperre über `expectedVersion`.                           |
| `InProcessEventPublisher`                              | Observer / Event-Bus.                                                                       |

## 6. Iteration 2 im Detail

| Element                              | Prinzip                                                                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseMapString` / `formatMapString` | SRP: nur das Textformat. Tafel-Ids in Spiral-Reihenfolge, `H` = Heimat-Platz, `.` = leer.                                                                                  |
| `assembleGalaxy`                     | Builder + Information Expert: prüft Layout gegen Tafeln (eindeutig, Zentrum, Heimat-Plätze) und erzeugt `GalaxyAssembled`.                                                 |
| `generateGalaxyLayout`               | Factory: zieht Tafeln je Vorlage und legt sie per Backtracking so, dass keine Anomalien oder gleichen Wurmlöcher nebeneinander liegen; nur wenn das unmöglich ist, gierig. |
| `areSystemsAdjacent`                 | Pure Fabrication: Nachbarschaft über Kanten und Wurmlöcher.                                                                                                                |
| `ContentPort`                        | DIP: Handler bekommen Tafeln, Einheiten und Vorlagen über den `DecisionContext`.                                                                                           |
| `galaxyTemplate` (Content)           | Protected Variations: Heimat-Plätze und Tafelzahl je Spielerzahl sind Daten.                                                                                               |
| Web: `useGalaxyStore`                | Zustand für UI-State; validiert über dieselbe Domain-Logik wie der Server.                                                                                                 |
| Web: `toSlotViews`, `hex-geometry`   | Reine Präsentationslogik, getrennt von den Komponenten (testbar ohne DOM).                                                                                                 |
| Web: `usePanZoom`, `handleShortcut`  | SRP: Eingabe-Steuerung getrennt von der Darstellung.                                                                                                                       |

Funktionen in `.ts`-Dateien haben höchstens 20 Zeilen. React-Komponenten (`.tsx`) dürfen 30 Zeilen haben, weil das JSX-Markup mitzählt.

## 7. Iteration 3 im Detail

| Element                                                                                                     | Prinzip                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GamePhase` mit `SetupPhase`, `StrategyPhase`, `ActionPhase`, `StatusPhase`, `AgendaPhase`, `GameOverPhase` | State Pattern: jede Phase kennt ihre erlaubten Commands und ihren Nachfolger. `decideGameCommand` fragt nur `phaseOf(state).accepts(...)`.           |
| `startGameHandler`, `pickQueueFor`                                                                          | Information Expert: Sprecher per `RandomPort`, Wahlreihenfolge ab dem Sprecher im Uhrzeigersinn, bei 3–4 Spielern zwei Durchgänge.                   |
| `pickStrategyCardHandler`, `orderByInitiative`                                                              | SRP: Kartenwahl und Initiative getrennt; nach der letzten Wahl Handelswaren auf freie Karten und Start der Aktionsphase.                             |
| `StrategyEffect`, `strategyEffectFor`                                                                       | Strategy Pattern + OCP: jede Kartenmechanik ist ein Objekt mit Primär- und Sekundärfähigkeit, registriert in einer Tabelle.                          |
| `commandTokensEffect`, `previewCommandTokens`                                                               | Information Expert: Markerzahl aus Grundwert, Einfluss und Nachschub. Die Vorschau nutzt dieselbe Rechnung, damit der Client keine Regel dupliziert. |
| `performStrategicActionHandler`, `resolveSecondaryHandler`, `declineSecondaryHandler`, `passHandler`        | Command Pattern: ein Handler je Command. Das Sekundärfenster läuft ab dem linken Nachbarn reihum, danach endet der Zug.                              |
| `nextActivePlayer`                                                                                          | Pure Fabrication: nächster Spieler in Initiativreihenfolge, der noch nicht gepasst hat.                                                              |
| `evaluatePayment`, `paymentEvents`                                                                          | Information Expert über `Planet.exhaust`: Bezahlen mit Planeten und Handelswaren, wiederverwendbar für Produktion und Abstimmung.                    |
| Web: `createLocalGame`, `useGameStore`                                                                      | Lokaler Adapter: dieselben Commands wie später über das Netz, nur ohne Server (Hot-Seat).                                                            |
| Web: `PhaseBar`, `StrategyCardGrid`, `TurnPanel`, `TokenForm`                                               | SRP: Anzeige und Eingabe; Regeln stammen aus der Domain.                                                                                             |

Mechaniken, deren Karten noch nicht registriert sind, lehnt die Domain mit `strategy.mechanicUnavailable` ab: Diplomatie kam in Iteration 4, Kriegsführung, Bauen und Handel folgen in 6, Technologie in 7, Imperium in 8, Politik in 10. Bis dahin endet eine Runde im Browser nicht, weil Passen erst nach allen eigenen Strategiekarten erlaubt ist (RR 4.3).

## 8. Iteration 4 im Detail

| Element                                                                 | Prinzip                                                                                                                                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FactionDefinition`, `homeSystemEvents`, `UnitNumbering`                | Information Expert: Fraktionsdaten liefern Heimatsystem und Startflotte; `StartGame` legt sie auf die Heimat-Plätze. Sechs eigene Fraktionen im Content-Paket.                   |
| `activateSystemHandler`, `moveShipsHandler`, `endTacticalActionHandler` | Command Pattern: Aktivieren (RR 79.2), Bewegen (RR 79.3), Beenden. `activeTurnChecks` verhindert neue Aktionen, solange eine Taktikaktion offen ist.                             |
| `validateShipMove`                                                      | Pure Fabrication + SRP: prüft Route, Reichweite, Blockade, eigene Marker und Fracht je Schiff; liefert ein `ValidatedMove`, das der Handler nur noch in Events übersetzt.        |
| `canEnter`, `baseMove`, `isGravityRift`                                 | Information Expert für Anomalien: Supernova und Asteroidenfeld sperren, Nebel nur als Ziel und mit Bewegung 1 beim Verlassen, Gravitationsriss +1 Bewegung und Wurf.             |
| `findShipPath`, `movementOptions`                                       | Pure Fabrication: Breitensuche über das verbleibende Bewegungsbudget. Die Web-App fragt so, welche Schiffe das aktive System erreichen, statt Regeln zu duplizieren.             |
| `limitsCheck`                                                           | Simuliert den Reducer und prüft danach Kapazität (RR 43) und Flottenlimit (RR 28), damit Prüfung und Zustandsänderung nie auseinanderlaufen.                                     |
| `diplomacyEffect`                                                       | Strategy Pattern + OCP: neue Strategiekarte ohne Änderung an den Aktions-Handlern; nur ein Eintrag in `strategy-effects.ts`.                                                     |
| Web: `scene-model.ts`                                                   | Presentation Model: übersetzt `GameState` in Pixi-unabhängige `SceneHex`-Daten (testbar ohne Grafik).                                                                            |
| Web: `GalaxyScene`, `drawHex`, `textures.ts`                            | Controller + Flyweight: eine Klasse steuert Ebenen und Ansicht, jede prozedurale Textur wird einmal gemalt und geteilt. Keine fremden Grafiken.                                  |
| Web: `worldTransform`, SVG-`HexTarget`                                  | Gleiche Abbildung für Pixi-Bild und SVG-Trefferflächen: Maus, Tastatur, Screenreader und E2E-Tests arbeiten auf dem SVG, das Bild bleibt rein dekorativ. Ohne WebGL: SVG-Ersatz. |
| Web: `TacticalPanel`, `ChoiceForm`, `DiplomacyForm`                     | SRP + Polymorphie: Formular je Kartenmechanik, Bewegungsformular aus `movementOptions`.                                                                                          |

Die Kriegsführung (Marker vom Plan zurücknehmen) folgt mit Produktion in Iteration 6, weil ihre Sekundärfähigkeit eine Produktion im Heimatsystem ist. Kampf, Weltraumkanonen, Invasion und Produktion im aktiven System kommen in Iteration 5 und 6; bis dahin endet die Taktikaktion nach der Bewegung.

## 9. Iterationen

| #   | Inhalt                                              | Stand |
| --- | --------------------------------------------------- | ----- |
| 1   | Monorepo, Tooling, CI, Domain-Grundtypen            | ✓     |
| 2   | Galaxie-Aufbau, Hex-Rendering, Map-Import           | ✓     |
| 3   | Phasen-State-Machine, Strategiephase                | ✓     |
| 4   | Taktische Aktion: Bewegung, Kapazität, Flottenlimit | ✓     |
| 5   | Kampf, Space Cannon, Bombardement                   | offen |
| 6   | Produktion, Wirtschaft, Transaktionen               | offen |
| 7   | Technologie, Einheiten-Upgrades                     | offen |
| 8   | Ziele, Statusphase, Sieg                            | offen |
| 9   | Effekt-System, Aktionskarten, Timing-Fenster        | offen |
| 10  | Agendaphase, Abstimmung                             | offen |
| 11  | Fraktionsfähigkeiten (3 eigene Fraktionen)          | offen |
| 12  | Multiplayer, Persistenz, Reconnect                  | offen |
| 13  | Animationen, Sound-Hooks, Tutorial                  | offen |

## 10. Befehle

```
pnpm install
pnpm check          # typecheck + lint + format + Tests mit Coverage
pnpm test           # nur Tests
pnpm --filter @stellar/web dev   # Web-App lokal (http://localhost:5173)
pnpm e2e            # Playwright-Test gegen den Produktions-Build
```
