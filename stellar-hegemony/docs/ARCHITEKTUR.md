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
│   │       ├── strategy/      (It. 3/4) Strategiekarten als Strategy Pattern (Führung, Diplomatie)
│   │       ├── combat/        (It. 5) CombatResolver, HitAssignment, SpaceCannon, Bombardment, GroundCombat
│   │       ├── economy/       (It. 6) ProductionCalculator, PaymentPlanner, Transaction
│   │       ├── technology/    (It. 7) TechTree, UpgradeResolver
│   │       ├── objectives/    (It. 8) ObjectiveEvaluator, VictoryChecker
│   │       ├── action-card/   (It. 9) Aktionskarten als Daten, Wirkungsregeln, Zeitfenster, Verhindern
│   │       ├── agenda/        (It. 10) Agenden als Daten, Abstimmung, Gesetze, Direktiven
│   │       ├── faction/       (It. 11) FactionAbility, Fraktionsregeln; galaxy/board-limits
│   │       └── simulator/     (It. 16) Flotte kaufen, Kampfrunde mit Taktikkarten, KI-Gegner
│   ├── application/         Use Cases: GameController, Ports (EventStorePort, EventPublisherPort)
│   ├── infrastructure/      Adapter: SeededRandom, SystemClock, InMemoryEventStore, InProcessEventPublisher
│   │                        CryptoRandom, CryptoIds, InMemoryLobbyStore; unter `/node` PostgresEventStore, RedisLobbyStore
│   ├── content/             Daten: Regelzahlen, Einheiten, Systeme, Fraktionen, Techs, Karten
│   └── bots/                (It. 11) KI-Gegner: Planer schlagen Commands vor, die Domain prüft
└── apps/
    ├── server/              (It. 12) Fastify + Socket.IO, Composition Root, SocketGateway, BotDriver
    └── web/                 React 18 + Vite + Zustand, i18n de/en, Playwright-E2E
        ├── src/render/      (It. 4) PixiJS-Szene: prozeduraler Nebel, Planeten, Anomalien,
        │                    Schiffsminiaturen, Bloom-Glühen; darüber SVG-Trefferflächen
        ├── src/battle/      (It. 16) Aufstellung und Choreografie der Kampfbühne (reine Funktionen)
        ├── src/simulator/   (It. 16) Ablauf des Kampfsimulators
        ├── src/hand/        (It. 17) Handkarten als reine Daten und gewählte strategische Aktion
        ├── src/hud/         (It. 18) Anzeigen über der Karte: Vorräte, Spieler, Zug beenden, Hex-Knöpfe
        ├── src/setup/       (It. 18) Fraktionswahl vor der Partie
        └── src/system/      (It. 20) Kamera der Karte: Zoom zum Zeiger, Heranfahren, Schilder beim Nahzoom
```

Abhängigkeiten zeigen nur nach innen: `web → application → domain`, `infrastructure → application → domain`,
`content → domain`, `bots → domain`. Nur `apps/server` (Composition Root) kennt alle Schichten. ESLint (`no-restricted-imports`) bricht den Build, wenn eine Schicht nach außen greift.

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

| Bereich             | Commands                                                                                                                            | Events                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aufbau              | ✓ CreateGame, ✓ SeatPlayer, ✓ ImportMap, ✓ GenerateGalaxy, PlaceSystemTile (Draft), ✓ StartGame, ✓ KeepSecretObjectives             | ✓ GameCreated, ✓ PlayerSeated, ✓ GalaxyAssembled, SystemTilePlaced, ✓ HomeSystemPlaced (mit Startflotte), ✓ TechnologiesGranted (Starttechnologien), ✓ ObjectivesPrepared, ✓ SecretObjectivesDealt, ✓ SecretObjectivesKept, ✓ GameStarted (legt auch den Sprecher fest)                                                                                                                                                                                                                                                                       |
| Strategiephase      | ✓ PickStrategyCard                                                                                                                  | ✓ StrategyPhaseStarted, ✓ StrategyCardPicked, ✓ TradeGoodsPlacedOnCards, ✓ ActionPhaseStarted                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Taktische Aktion    | ✓ ActivateSystem, ✓ MoveShips, ✓ DeclareRetreat, ✓ AssignHits, ✓ Bombard, ✓ CommitGroundForces, ✓ ProduceUnits, ✓ EndTacticalAction | ✓ SystemActivated, ✓ ShipsMoved, ✓ GravityRiftRolled, ✓ TacticalStepReached, ✓ SpaceCannonFired, ✓ SpaceCombatStarted, ✓ AntiFighterBarrageFired, ✓ SpaceCombatRoundStarted, ✓ RetreatDeclared, ✓ CombatRoundRolled, ✓ HitsAssigned (inkl. Schaden), ✓ UnitsDestroyed, ✓ ShipsRetreated, ✓ SpaceCombatEnded, ✓ BombardmentRolled, ✓ GroundForcesCommitted, ✓ SpaceCannonDefenseFired, ✓ GroundCombatRoundRolled, ✓ GroundCombatEnded, ✓ PlanetControlGained, ✓ CenterTokenRemoved, ✓ UnitsProduced, ✓ PlanetsExhausted, ✓ TacticalActionEnded |
| Strategische Aktion | ✓ PerformStrategicAction, ✓ ResolveSecondary, ✓ DeclineSecondary                                                                    | ✓ StrategicActionPerformed, ✓ SecondaryResolved, ✓ SecondaryDeclined, ✓ CommandTokensGained, ✓ PlanetsExhausted, ✓ TradeGoodsSpent, ✓ CommandTokensPlaced, ✓ PlanetsReadied, ✓ SpeakerChanged, ✓ ActionCardsDrawn, ✓ StructuresPlaced, ✓ TradeGoodsGained, ✓ CommoditiesReplenished, ✓ SecondaryCostWaived, ✓ CommandTokenReturned, ✓ CommandTokensRedistributed, ✓ TechnologyResearched, ✓ SecretObjectiveDrawn, ✓ VictoryPointsGained                                                                                                       |
| Komponentenaktion   | ✓ PlayActionCard, UseComponentAbility                                                                                               | ✓ ActionDeckPrepared, ✓ ActionDeckReshuffled, ✓ ActionCardPlayed, ✓ ActionCardCancelled, ✓ CancelDeclined, ✓ ActionCardResolved, ✓ CombatBonusGranted, ✓ HitsCancelled, ✓ UnitsRepaired                                                                                                                                                                                                                                                                                                                                                       |
| Transaktion         | ✓ ProposeTransaction, ✓ AcceptTransaction, ✓ RejectTransaction                                                                      | ✓ TransactionProposed, ✓ TransactionCompleted, ✓ TransactionRejected                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Passen              | ✓ Pass                                                                                                                              | ✓ PlayerPassed, ✓ TurnEnded, ✓ StatusPhaseStarted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Statusphase         | ✓ ScoreObjective, ✓ EndScoring, ✓ DiscardActionCards, ✓ AllocateCommandTokens                                                       | ✓ ObjectiveScored, ✓ ScoringFinished, ✓ PublicObjectiveRevealed, ✓ ActionCardsDrawn, ✓ ActionCardsDiscarded, ✓ CommandTokensCleared, ✓ TokenStepReached, ✓ CommandTokensAllocated, ✓ RoundEnded (Planeten bereit, Reparatur, Karten zurück)                                                                                                                                                                                                                                                                                                   |
| Agendaphase         | ✓ CastVotes, ✓ Abstain, ✓ BreakTie                                                                                                  | ✓ AgendaDeckPrepared, ✓ AgendaDeckReshuffled, ✓ AgendaPhaseStarted, ✓ AgendaRevealed, ✓ VotesCast, ✓ PlayerAbstained, ✓ AgendaTied, ✓ AgendaResolved, ✓ LawEnacted, ✓ LawsRepealed, ✓ AgendaDiscarded, ✓ CommandTokensLost, ✓ AgendaPhaseEnded                                                                                                                                                                                                                                                                                                |
| Reaktionsfenster    | ✓ PlayActionCard, ✓ PassReaction                                                                                                    | ✓ ReactionWindowOpened, ✓ ActionCardPlayed, ✓ ReactionPassed (schließt das Fenster nach dem Letzten)                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Sieg                | –                                                                                                                                   | ✓ VictoryPointsGained, ✓ GameWon                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

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
| Web: `useGameStore` (`remote`), `tryCommand`                                                                | Adapter zum Server: Commands gehen übers Netz; `tryCommand` erprobt sie nur, damit Knöpfe zeigen, was die Domain erlaubt.                            |
| Web: `PhaseBar`, `StrategyCardGrid`, `TurnPanel`, `TokenForm`                                               | SRP: Anzeige und Eingabe; Regeln stammen aus der Domain.                                                                                             |

Mechaniken, deren Karten noch nicht registriert sind, lehnt die Domain mit `strategy.mechanicUnavailable` ab: Diplomatie kam in Iteration 4, Kriegsführung, Bauen und Handel in 6; Technologie folgt in 7, Imperium in 8, Politik in 10. Bis dahin endet eine Runde im Browser nicht, weil Passen erst nach allen eigenen Strategiekarten erlaubt ist (RR 4.3).

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

Die Kriegsführung (Marker vom Plan zurücknehmen) folgt mit Produktion in Iteration 6, weil ihre Sekundärfähigkeit eine Produktion im Heimatsystem ist. Kampf und Weltraumkanonen folgen in Iteration 5, Invasion und Produktion im aktiven System in Iteration 6.

## 9. Iteration 5 im Detail

Nach der Bewegung läuft die Taktikaktion als kleine Zustandsmaschine weiter:
`movement → spaceCannon → spaceCombat → done` (`TacticalActionState.step`). Alles, was ohne
Wahl abläuft (Würfe, erzwungene Trefferzuweisung, Rückzug ausführen, Kampfende), erledigt
`progressTactical` sofort. Es hält nur an, wenn ein Spieler entscheiden muss: Treffer zuweisen
oder Rückzug ankündigen. Wer gerade dran ist, sagt `tacticalDecider`; das kann auch ein
Spieler sein, der nicht am Zug ist.

| Element                                                      | Prinzip                                                                                                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `progressTactical`, `tacticalDecider`                        | Pure Fabrication + Controller: ein Ort führt den Ablauf nach RR 79/63 fort; Handler liefern nur ihr eigenes Event und hängen den Fortschritt an (`withProgress`).                          |
| `spaceCannonOffense`, `spaceCannonShooters`, `distancesFrom` | Information Expert: Reichweite und Kampfwerte kommen aus der `spaceCannon`-Fähigkeit der Einheit; reihum ab dem aktiven Spieler (RR 87.3), der aktive Spieler zielt auf den Gegner.        |
| `startSpaceCombat`, `barrage`                                | RR 41: Jägerabwehr beider Seiten vor Runde 1; Jäger sind gleichwertig, daher ohne Wahl.                                                                                                    |
| `nextRound`, `rollRound`, `retreatEvents`, `combatEnd`       | SRP je Kampfschritt (RR 63.5): Rückzug ankündigen, würfeln, Treffer zuweisen, Rückzug ausführen, Ende prüfen.                                                                              |
| `rollVolley`, `hitsOf`                                       | Pure Fabrication: Würfe über den `RandomPort`; das Event speichert jedes Ergebnis, damit Replays und Kampfansicht ohne erneutes Würfeln auskommen.                                         |
| `validateHitAssignment`, `suggestHitAssignment`              | Information Expert über Kosten und Schadensresistenz (RR 66, RR 89.1). Der Vorschlag dient Oberfläche und späteren Bots.                                                                   |
| `retreatTargets`                                             | RR 63.7 als reine Abfrage; Handler und Oberfläche nutzen dieselbe Funktion.                                                                                                                |
| `assignHitsHandler`, `declareRetreatHandler`                 | Command Pattern; prüfen nur die Entscheidung, nicht den Ablauf.                                                                                                                            |
| Web: `combat-view.ts`                                        | Presentation Model: Kampfprotokoll aus den Events, Seiten, offene Entscheidung (testbar ohne Grafik).                                                                                      |
| Web: `CombatView`, `FleetColumn`, `CombatLog`, Formulare     | Eigene Kampfansicht über der Karte: Miniaturen und Nebel aus denselben prozeduralen Malroutinen wie die Karte (`render/images.ts`, Flyweight), Würfel je Salve, Trefferformular vorbelegt. |

## 10. Iteration 6 im Detail

Die Taktikaktion hat jetzt alle Schritte aus RR 79: `movement → spaceCannon → spaceCombat →
bombardment → invasion → production → done`. `reachNext` springt über Schritte, in denen es
nichts zu entscheiden gibt (kein Schiff mit Bombardement, keine Bodentruppen im Weltraum, keine
eigene Produktion im System). Bodenkampf und Abwehrfeuer laufen ohne Abfrage; Treffer werden
nach `suggestHitAssignment` verteilt (siehe Regelfragen 13 und 14).

| Element                                                    | Prinzip                                                                                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reachNext` (`tactical/tactical-steps.ts`)                 | Information Expert: je Schritt eine Abfrage „gibt es hier etwas zu tun?“; Handler fragen nur nach dem nächsten Schritt (Open/Closed für weitere Schritte). |
| `chain` (`game/event-chain.ts`)                            | Pure Fabrication: jede Stufe sieht den Zustand nach den Events der vorherigen, ohne dass Handler selbst Reducer aufrufen müssen.                           |
| `invasion-queries.ts`                                      | Information Expert für Landung und Bombardement (Bodentruppen, Planetarer Schild, Thronwelt); Handler und Oberfläche nutzen dieselben Abfragen.            |
| `resolveLanding`, `groundCombat`                           | SRP: Abwehrfeuer, Kampfrunden und Kontrollwechsel als getrennte Stufen; Würfe stehen im Event, Replays würfeln nie neu.                                    |
| `productionEvents`                                         | Pure Fabrication für alle Produktionswege (Taktikaktion, Kriegsführung sekundär): Bestellung, Bezahlung, Blockade, Vorrat, Flottenlimit und Kapazität.     |
| `productionQuote`, `producibleUnits`                       | Information Expert für die Vorschau; Kosten rechnet dieselbe Funktion wie der Command (keine doppelte Regel im Client).                                    |
| `constructionEffect`, `tradeEffect`, `warfareEffect`       | Strategy Pattern: neue Karten sind neue Effekte; das Kartenregister bleibt geschlossen gegen Änderung (OCP).                                               |
| `SecondaryWindow.free`                                     | Der Handel erlässt gewählten Spielern den Strategiemarker; `paysStrategyToken` ist der einzige Ort, der das prüft.                                         |
| `transaction/*` (`areNeighbors`, Commands, Reducer)        | RR 55/82: Angebot und Zustimmung sind zwei Commands, weil zwei Spieler entscheiden; Rohstoffe werden beim Empfänger zu Handelswaren.                       |
| Web: `invasion-view.ts`, `payment-view.ts`, `card-view.ts` | Presentation Model: Auswahllisten aus Domain-Abfragen, testbar ohne React.                                                                                 |
| Web: `InvasionForms`, `ProductionForm`, Kartenformulare    | Je Schritt bzw. Mechanik ein Formular; `ChoiceForm` wählt nach Mechanik (Polymorphie), `FormParts` bündelt wiederkehrende Auswahlfelder (DRY).             |
| Web: Kampfprotokoll                                        | Bombardement, Landung, Abwehrfeuer und Bodenkampf erscheinen in derselben Kampfansicht; ohne Raumkampf heißt sie „Einmarsch“.                              |

## 11. Iteration 7 im Detail

Technologien sind reine Daten (`TechnologyDefinition`): Farbe, Voraussetzungen als Mehrfachmenge
von Farben, optional die aufgewertete Einheit und eine Liste von `UnitModifier`s bzw.
`RuleModifier`s. Einheiten speichern keine Werte; jede Abfrage holt sie aus dem Katalog. Darum
wirkt eine neue Technologie sofort auf alle Einheiten ihres Besitzers, auch beim Replay.

| Element                                                    | Prinzip                                                                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UnitCatalog.find(type, owner?)`                           | Liskov: ohne Besitzer die Grundwerte, mit Besitzer dessen Werte; alle Regeln fragen mit `unit.owner` und kennen Technologien nicht (DIP).                     |
| `TechnologyCatalog` (`technology/technology-catalog.ts`)   | Decorator um den Grundkatalog: Aufwertungen ersetzen zuerst Werte, danach addieren sich Boni (RR 80.6). Neue Technologien brauchen keinen neuen Code (OCP).   |
| `applyChange`, `matches` (`technology/unit-modifiers.ts`)  | Pure Functions: eine Änderung auf eine Einheitendefinition anwenden; Würfelziele bleiben mindestens 1.                                                        |
| `withTechnologies` in `decideGameCommand`                  | Protected Variations: jeder Handler bekommt einen Kontext mit verbessertem Katalog; Bewegung, Kampf, Produktion und Einmarsch ändern sich dafür nicht.        |
| `fleetLimitOf`                                             | Information Expert für das Flottenlimit (RR 28) samt Technologie-Boni; Bewegung und Produktion fragen nur hier.                                               |
| `researchEvents`, `missingPrerequisites` (`research.ts`)   | Pure Fabrication für jedes Erforschen: Voraussetzungen der Reihe nach (die erste Technologie zählt für die zweite), Spezialisierungen als gemeinsamer Vorrat. |
| `technologyEffect`, `researchCost`                         | Strategy Pattern wie die übrigen Karten; `researchCost` ist die einzige Stelle für Anzahl und Kosten, Formular und Command nutzen sie gleichermaßen.          |
| `TechnologiesGranted` bei `StartGame`                      | RR 80.5: Starttechnologien der Fraktion werden erhalten, nicht erforscht, also ohne Voraussetzungen.                                                          |
| Web: `technology-view.ts`                                  | Presentation Model: erforschbare Technologien mit fehlenden Farben (die Auswahl zählt mit) und nutzbare Spezialisierungen.                                    |
| Web: `TechnologyForm`, `TechnologyPanel`, `TechnologyChip` | Formular nach Farben gruppiert, Voraussetzungen als Punkte (hohl = fehlt); die Seitenleiste zeigt die Technologien aller Spieler offen (RR 80.1).             |
| Web: `unitsOf(game)`                                       | Alle Ansichten (Bewegung, Fracht, Kampf, Einmarsch, Produktion) zeigen die Werte nach Technologien.                                                           |

## 12. Iteration 8 im Detail

Aufträge sind reine Daten (`ObjectiveDefinition`): Kategorie, Stufe, Punkte, Zeitpunkt und eine
Bedingung aus einer geschlossenen Union (`ObjectiveCondition`). Unser eigener Satz hat 10 Aufträge
der Stufe I, 10 der Stufe II und 20 geheime. Die Statusphase läuft als kleine Zustandsmaschine
(`statusPhase.step`: Werten, dann Marker), der Sieg wird nach jedem Command geprüft.

| Element                                                      | Prinzip                                                                                                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ObjectiveCondition`, `CHECKERS` (`objective-conditions.ts`) | Interpreter/Strategy: je Bedingungsart eine reine Prüffunktion in einer Tabelle; neue Aufträge brauchen nur Daten (OCP).                                          |
| `board-queries.ts`                                           | Information Expert für Heimat, Zentrum, eigene Planeten und Einheiten auf dem Brett; Bedingungen und Thronkarte fragen nur hier.                                  |
| `availabilityChecks`, `timingCheck`, `scoringEvents`         | Pure Fabrication: Verfügbarkeit (RR 61.6/61.17), Zeitpunkt und Limit je Phase (RR 61.10/61.11) und Bezahlung getrennt prüfbar; Command und Thronkarte teilen sie. |
| `scoringOptions`, `availableObjectives`                      | Information Expert für Clients: was der Spieler jetzt werten könnte und ob die Anforderung erfüllt ist.                                                           |
| `trackRoundStats` in `evolveGame`                            | Observer: zählt pro Runde gewonnene Kämpfe, zerstörte Schiffe und eroberte Planeten aus den Events, ohne dass Kampf oder Einmarsch Aufträge kennen (DIP).         |
| `withVictory` in `decideGameCommand`                         | Protected Variations: RR 68.7 an einer Stelle; nach dem Event, das das Ziel erreicht, folgt `GameWon` und der Rest entfällt.                                      |
| `secretChoice` am Spieler, `KeepSecretObjectives`            | Ein Mechanismus für die Startwahl (RR 12.20) und das Überschreiten des Limits (RR 37.4); zurückgelegte Karten werden in den Stapel gemischt.                      |
| `EndScoring`, `AllocateCommandTokens`, `afterScoring`        | State Pattern über `statusPhase.step`; nach dem letzten Spieler deckt die Domain den nächsten Auftrag auf, räumt Marker ab und beginnt die nächste Runde.         |
| `imperialEffect`, `politicsEffect`                           | Strategy Pattern wie die übrigen Karten: Thronkarte (Auftrag werten, Thron-Siegpunkt oder Geheimauftrag) und Politik (Sprecher wechseln).                         |
| Web: `ObjectivesPanel`, `ObjectiveCard`, `ScoreAction`       | Siegpunktleiste, öffentliche Reihe mit verdeckten Plätzen und die geheimen Aufträge des Spielers am Bildschirm; Werten mit Bezahlung im selben Formular.          |
| Web: `SecretChoiceForm`, `StatusTurn`, `GameOverNotice`      | `currentActor` stellt offene Wahlen vor jede Phase; die Statusphase zeigt Werten und Markerverteilung, nach dem Sieg nur noch das Ergebnis.                       |

## 13. Iteration 9 im Detail

Aktionskarten sind Daten (`ActionCardDefinition`: Zeitpunkt und Wirkung aus einer geschlossenen
Union `ActionEffect`). Unser eigener Satz hat 19 Karten in 49 Exemplaren. Eine Tabelle von
Wirkungsregeln liefert je Wirkungsart die möglichen Ziele, eine Zusatzbedingung und die Abhandlung.
Die Taktikaktion öffnet Zeitfenster nach der Aktivierung, vor jeder Kampfrunde und vor dem Einmarsch,
aber nur, wenn jemand eine passende Karte spielen könnte.

| Element                                               | Prinzip                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ActionEffect`, `EffectRules` (`card-effects.ts`)     | Interpreter/Strategy: je Wirkungsart `targets`, `usable` und `resolve` in einer Registry aus drei Teiltabellen (Wirtschaft, Brett, Kampf); neue Karten sind Daten (OCP). |
| `TIMINGS` (`card-timing.ts`)                          | Information Expert für den Zeitpunkt: je Zeitangabe eine Regel; Command, Antwortreihenfolge und Client fragen dieselbe Tabelle.                                          |
| `windowEvents` (`reaction-windows.ts`)                | Chain of Responsibility über `TRIGGERS`: das erste fällige Fenster öffnet sich einmal je Taktikaktion bzw. Kampfrunde (Schlüssel in `tactical.windows`).                 |
| `PendingPlay`, `cancelEvents`, `resolution`           | Command Pattern mit Aufschub: eine gespielte Karte wirkt erst, wenn reihum niemand verhindert (RR 3.8); eine verhinderte Materialaktion kostet keinen Zug.               |
| `admission`, `withFlow` in `decideGameCommand`        | Protected Variations: offene Fenster sperren alle anderen Commands an einer Stelle; nach jedem Command läuft die Taktikaktion selbst weiter, bis sie wartet.             |
| `CombatBonus`, `boosted`                              | Decorator auf die Schützen: Kartenboni wirken wie Technologien über den Würfelwert, ohne dass Raum- oder Bodenkampf Karten kennen (DIP).                                 |
| `drawEvents`, `drawForAll`, `excessActionCards`       | Pure Fabrication: Ziehen mit Mischen des Ablagestapels (RR 3.7) und das Handkartenlimit (RR 3.4) an einer Stelle; Statusphase und Politik nutzen sie.                    |
| `handCards`, `reactionActor`                          | Information Expert für Clients: dieselbe Prüfung wie `PlayActionCard`, dazu die erlaubten Ziele je Karte.                                                                |
| Web: `HandPanel`, `CardItem`, `TargetFields`          | Die Hand des Spielers am Bildschirm; spielbare Karten bekommen genau die Zielfelder, die ihre Wirkung verlangt.                                                          |
| Web: `ReactionPrompt`, `DiscardForm`, `PlayableCards` | `currentActor` stellt Reaktionen und Ablegen vor den Zug; die Kampfansicht fragt Fenster und Karten gegen Treffer direkt neben der Trefferverteilung ab.                 |

## 14. Iteration 10 im Detail

Agenden sind Daten (`AgendaDefinition`): Art (Gesetz oder Direktive), Wahl (Dafür/Dagegen,
Spieler oder Planet mit Filter) und je Ergebnis Schritte aus Empfänger und Wirkung. Unser eigener
Satz des Sternenrats hat 9 Gesetze und 15 Direktiven. Gesetze wirken über umkehrbare Wirkungen auf
Regelwerte, Rohstofflimits, Siegpunkte oder Zusatzstimmen; die Wirkung wird beim Beschluss
mitgespeichert, damit eine Aufhebung sie exakt zurücknimmt.

| Element                                                  | Prinzip                                                                                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AgendaEffect`, `EFFECTS` (`agenda-effects.ts`)          | Interpreter: je Wirkungsart eine reine Funktion; Empfänger (`all`, `supporters`, `opponents`, `elected`, `speaker`) bestimmt der Ablauf, nicht die Wirkung.      |
| `LawEffect`, `APPLIERS` (`law-effects.ts`)               | Strategy mit Richtung (+1/−1): Beschließen und Aufheben nutzen dieselbe Funktion; Regelwerte ändert ein Gesetz nur über `AdjustableRule` (Protected Variations). |
| `voting.ts`                                              | Information Expert für Abstimmungen: Reihenfolge ab links vom Sprecher (RR 72.2), wählbare Ergebnisse, Auszählung und Gleichstand.                               |
| `agenda-flow.ts`                                         | Pure Fabrication für den Ablauf: aufdecken, auszählen, abhandeln, nächste Agenda oder Rundenende; jeder Abschnitt sieht den Zustand des vorigen (`chain`).       |
| `CastVotes`, `Abstain`, `BreakTie`                       | Command Pattern: die Stimmen kommen aus derselben Bezahlprüfung wie Einfluss sonst (`evaluatePayment`), Handelswaren sind ausgeschlossen (RR 2.13).              |
| `roundEndEvents` in der Statusphase                      | State Pattern: nach dem letzten Marker folgt die Agendaphase nur, wenn der Zentrumsmarker entfernt ist (RR 36.4); sonst direkt die nächste Runde.                |
| `agendaActor`, `currentAgenda`, `votingPower`            | Information Expert für Clients: wer entscheidet, Zwischenstand und die eigenen bereiten Planeten samt Gesetzesstimmen.                                           |
| Web: `AgendaTurn`, `AgendaCard`, `VoteForm`, `LawsPanel` | Offene Agenda mit Wirkung bei Annahme und Ablehnung, Stimmabgabe mit Planeten und Summe, Stichentscheid des Sprechers und geltende Gesetze in der Seitenleiste.  |

## 15. Iteration 11 im Detail

Jede unserer sechs Fraktionen hat zwei eigene Fähigkeiten (RR 27.21). Sie sind Daten
(`FactionAbility`): Einheitenwerte über dieselben Bausteine wie Technologien und wenige Regelwerte
(Zusatzstimmen, Handkartenlimit, Einkommen in der Statusphase, Flottenlimit, kostenlose
Sekundärfähigkeiten). Dazu kommen KI-Gegner im Paket `@stellar/bots`: Sie spielen über genau
dieselben Commands wie Menschen und kennen keine Sonderregeln.

| Element                                                 | Prinzip                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FactionAbility`, `FactionRules`, `combinedRules`       | Open/Closed: eine neue Fähigkeit ist ein Datensatz; die Regeln fragen nur `factionRule` ab und kennen keine Fraktion beim Namen.                                          |
| `ModifierSource` im Technologiekatalog                  | Protected Variations: Einheitenwerte aus Technologien und Fähigkeiten laufen durch denselben Katalog, Kampf und Bewegung bleiben unverändert.                             |
| `boardLimitEvents` (`board-limits.ts`)                  | Pure Fabrication: nach jedem Command prüft ein Durchlauf Flottenlimit (RR 28.3) und Kapazität (RR 43.3); das aktive System während des Kampfes ist ausgenommen (RR 43.4). |
| `excessCargo`, `shipCapacity`, `hangarSpace`            | Information Expert: das System weiß, wie viel Platz Schiffe und Hangars bieten; Bodentruppen belegen Schiffsplatz, Jäger zuerst Hangars.                                  |
| `currentActor` (Domain)                                 | Information Expert: wer gerade entscheiden muss, an einer Stelle für Web-App, Bots und später den Server.                                                                 |
| `BotStrategy`, `heuristicBot`                           | Strategy Pattern: die Web-App kennt nur `nextCommand`; weitere Schwierigkeitsstufen sind weitere Strategien.                                                              |
| Planer (`actionPhase`, `statusPhase`, `agendaPhase`, …) | Generate and Test: jeder Planer schlägt Commands vor, `decideGameCommand` prüft, der erste angenommene gewinnt. So kann ein Bot nie gegen die Regeln ziehen (DIP).        |
| `targetValue`, `planMoves`, `planOrders`                | High Cohesion: Ziele, Bewegung mit Flottenlimit und Produktion sind getrennte, einzeln testbare Funktionen.                                                               |
| Web: `useBotDriver`, `botStep`, `involvesHuman`         | Controller: ein Zeitgeber lässt die KI ziehen, solange sie dran ist; die Kampfansicht öffnet sich nur, wenn ein Mensch beteiligt ist.                                     |
| Web: `FactionsPanel`, `BotCountSelect`, `BotNotice`     | Die Fähigkeiten jeder Fraktion in der Seitenleiste, die Zahl der KI-Gegner beim Start und ein Hinweis, solange die KI überlegt.                                           |

## 16. Iteration 12 im Detail

Online-Partien laufen über einen eigenen Server (`apps/server`). Der Gastgeber eröffnet eine Lobby
mit seiner Galaxie und bekommt einen sechsstelligen Code; Mitspieler treten mit dem Code bei. Beim
Start übernimmt die KI alle freien Plätze und zieht auf dem Server. Jeder Browser bekommt nur, was
sein Spieler sehen darf. Mit Code und geheimem Platzschlüssel (im Browser gespeichert) kehrt man nach
einem Verbindungsabbruch oder Neuladen auf seinen Platz zurück.

| Element                                                         | Prinzip                                                                                                                                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playerView`, `visibleEvents` (Domain)                          | Information Expert: die Domain weiß, was verdeckt ist (RR 3.5, 12.13, 12.17). Fremde Hände, ungewertete Geheimaufträge und Stapel werden zu Platzhaltern, Anzahlen bleiben.        |
| `setupCommands`, `seatPlayerId` (Anwendung)                     | Pure Fabrication: Hot-Seat und Server bauen eine Partie mit denselben Commands auf; nichts davon ist doppelt.                                                                      |
| `Lobby`, `claimSeat`, `fillWithBots`                            | Reine Funktionen auf Daten: Plätze vergeben, Schlüssel prüfen, freie Plätze an die KI geben. Der Lobby-Store speichert nur das Ergebnis.                                           |
| `OnlineGames`                                                   | GRASP Controller: Eröffnen, Beitreten, Zurückkehren, Starten, Commands und KI-Züge. Commands laufen immer im Namen des eigenen Platzes, egal was der Browser sendet.               |
| `LobbyStorePort`, `IdGeneratorPort`, `BotPort`                  | Dependency Inversion: die Anwendung kennt weder Redis noch Zufallsquellen noch `@stellar/bots`, nur diese Schnittstellen.                                                          |
| `SerialQueue`                                                   | Je Lobby eine Warteschlange: ein Spielerzug und ein KI-Zug greifen nie gleichzeitig auf den Event Store zu.                                                                        |
| `GameController` (Cache, `publish` mit Zustand)                 | Der letzte Zustand bleibt im Speicher; nach einem Neustart entsteht er durch Replay aus dem Event Store.                                                                           |
| `PostgresEventStore`, `RedisLobbyStore` (`infrastructure/node`) | Adapter: eine Zeile je Event mit optimistischer Sperre über Version und Primärschlüssel; Lobbys als JSON mit Ablaufzeit. Ohne `DATABASE_URL`/`REDIS_URL` laufen beide im Speicher. |
| `CryptoRandom`, `CryptoIds`                                     | Würfe und Codes aus `crypto.getRandomValues`, ohne Modulo-Verzerrung; Platzschlüssel sind UUIDs.                                                                                   |
| Server: `compose` (Composition Root)                            | Die einzige Stelle, an der Adapter und Anwendungsfälle verdrahtet werden.                                                                                                          |
| Server: `SocketGateway`                                         | Adapter zwischen Socket.IO und `OnlineGames`: merkt sich den Platz je Verbindung, verteilt Lobby und Zustand je Spieler, fängt jeden Fehler ab.                                    |
| Server: `BotDriver`                                             | Observer: nach jedem gespeicherten Zug ein Anstoß; die KI zieht mit kurzer Pause, bis ein Mensch dran ist.                                                                         |
| Web: `OnlineConnection`, `socketConnector`                      | Port und Adapter zum Server; Tests setzen eine Attrappe ein.                                                                                                                       |
| Web: `useOnlineStore`, `saved-seat`                             | Zustand der Verbindung; der Platzschlüssel liegt im `localStorage`, damit ein Neuladen zurückführt.                                                                                |
| Web: `useGameStore` (`me`, `remote`, `receive`)                 | Strategy: im Hot-Seat entscheidet die Domain lokal, online schickt `send` an den Server; `useHumanActor` und `useViewer` zeigen online nur den eigenen Platz.                      |
| Web: `OnlinePanel`, `LobbyPanel`, `ConnectionBanner`            | Eröffnen und Beitreten, Wartesaal mit Code und Verbindungsstatus, Hinweis bei Verbindungsabbruch; getrennte Mitspieler tragen in der Spielerliste ein Kennzeichen.                 |

## 17. Iteration 13 im Detail

Züge werden sichtbar und hörbar. Die Karte zeigt kurze Effekte: ein Puls beim Aktivieren, eine
Leuchtspur entlang der Flugroute, Explosionen, die Eroberung eines Planeten und neu gebaute Einheiten.
Würfel rollen nacheinander aus, Treffer flammen auf, die aktuelle Phase leuchtet. Alle Klänge sind
eigene Synthesizer-Klänge aus der Web Audio API, ohne Audiodateien. Klang, Lautstärke, Animationen
und Phasentipps stellt jeder Spieler in der Werkzeugleiste ein; wer im System weniger Bewegung
wünscht, startet ohne Animationen. Die Anleitung erklärt Bedienung und Ablauf in eigenen Worten und
hebt dabei das jeweilige Bedienelement hervor.

| Element                                   | Prinzip                                                                                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useGameStore.lastEvents`                 | Single Source: jeder Zug hinterlässt Zustand vorher und seine Events; Karte und Klang lesen beides, die Domain bleibt unberührt.                                |
| `mapEffects` mit Tabelle `RULES`          | Open/Closed: ein neuer Effekt ist ein Tabelleneintrag je Event-Typ, keine Verzweigung. Reine Funktion, deshalb ohne Pixi testbar.                               |
| `EffectLayer`                             | Single Responsibility: zeichnet nur laufende Effekte und meldet, wann sie enden. Die Szene erhöht die Bildrate nur so lange, danach ruht die Zeichenschleife.   |
| `soundCues`, `turnCue` mit Tabelle `CUES` | Open/Closed und Information Expert: welcher Event welchen Klang auslöst, steht als Daten; höchstens vier Klänge je Zug, der Sieg übertönt alles.                |
| `RECIPES`                                 | Klänge als Daten (Töne mit Gleitfrequenz, gefiltertes Rauschen). Ein neuer Klang braucht keinen neuen Code.                                                     |
| `SoundPort`, `SynthSound`                 | Dependency Inversion und Interpreter: die Oberfläche kennt nur `play`; der Synthesizer übersetzt Rezepte in Web-Audio-Knoten und entsteht erst beim ersten Ton. |
| `useSoundEffects`                         | Adapter zwischen Spielzustand und `SoundPort`; Tests setzen über `setSoundPort` eine Attrappe ein.                                                              |
| `useSettingsStore`                        | Einstellungen je Spieler im `localStorage`; `motion-off` am Wurzelelement schaltet alle CSS-Bewegungen ab.                                                      |
| `TUTORIAL_STEPS`, `PHASE_TIPS`            | Inhalte als Daten in eigenen Worten; `data-tutorial` verbindet einen Schritt mit seinem Bedienelement, ohne dass die Panels die Anleitung kennen.               |
| `useTutorialStore`, `TutorialDialog`      | Zustand (offen, Schritt) getrennt von der Darstellung; fehlt ein Element gerade, bleibt der Schritt trotzdem lesbar.                                            |

## 18. Iteration 14 im Detail (Optik)

Ein Doppelklick auf ein System (oder das Fernrohr in der Kartensteuerung) fährt die Kamera in das
Feld hinein; dann öffnet sich die Systemansicht. Dort stehen Stern oder Anomalie, die Planeten auf
ihren Bahnen mit Mond, Bodentruppen und Raumdock, und die Flotten jedes Spielers in Keilformation;
Jäger umkreisen ihre Flotte, Triebwerke flackern, Monde ziehen vor und hinter ihren Planeten vorbei.
Beschriftungen und eine Kartenleiste nennen alles im Klartext. Escape oder „Zur Sternenkarte“ fährt
zurück. Planeten haben Wolken, Glanzlichter und Lichter auf der Nachtseite, Schiffe Plattenfugen
und Fensterreihen. Die Oberfläche nutzt Radix UI (Popover, Switch, Slider, Tooltip, Collapsible),
Motion für Übergänge und Lucide-Symbole; alle Grafiken bleiben eigene, prozedurale Zeichnungen.

| Element                                        | Prinzip                                                                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `systemLayout`, `fitScale`                     | Reine Funktion (Information Expert): ordnet Stern, Bahnen, Planeten, Truppen und Flotten auf einer gedachten Bühne an; ohne Pixi oder DOM testbar. |
| `SystemScene`, `system-pieces`                 | Controller und Builder: jedes Teil liefert Darstellung und `animate(time)`; die Szene blendet sie gestaffelt ein. Ohne Animationen ein Standbild.  |
| `focusViewport`, `blendViewport`               | Reine Kameramathematik: Ziel mittig vergrößern, Zoom logarithmisch und Verschiebung passend dazu, damit das Ziel ruhig in der Mitte bleibt.        |
| `useSystemViewStore`                           | Zustand der Ansicht (offenes Feld, Rückkehrpunkt); öffnen und schließen fahren die Kamera, je nach Einstellung animiert oder sofort.               |
| `SystemView`, `SystemLabels`, `SystemContents` | Darstellung in React: dieselben Bühnenkoordinaten für Pixi und DOM-Beschriftung; der Inhalt ist als Liste lesbar und testbar.                      |
| `createApplication`, `KEEP_SHARED`             | Karte und Systemansicht sind zwei Pixi-Anwendungen; beim Abbau bleiben Pixis globale Pools erhalten, sonst zerbricht die jeweils andere.           |
| `paintStar`, `paintGlow`, Detail-Texturen      | Flyweight wie bisher, zusätzlich in hoher Auflösung für die Nahansicht; Planeten- und Schiffsmaler zeichnen mehr Einzelheiten.                     |
| `Panel`, `IconButton`, `SettingsMenu`, Phasen  | Wiederverwendbare Bausteine (Komposition): einklappbare Abschnitte mit Symbol, Tooltips, Einstellungsmenü; die Phasenpille gleitet mit Motion.     |

## 19. Iteration 15 im Detail (Namen, schlichtere Oberfläche)

Allgemeine Spielbegriffe tragen jetzt die gängigen Namen: die Strategiekarten heißen Führung,
Diplomatie, Politik, Konstruktion, Handel, Kriegsführung, Technologie und Imperium, die Einheiten
Schlachtschiff (Dreadnought), PVS (PDS) und Raumdock (Space Dock). Eigene Namen bleiben überall dort,
wo Namen geschützt sind: Spieltitel, Fraktionen, Planeten, Thronwelt, Sonnenbrecher, Technologien,
Aktionskarten, Aufträge und Agenden. Die Oberfläche zeigt weniger auf einmal: Phasen, Runde und
Sprecher stehen in der Kopfzeile, die Seitenleiste hat drei Reiter (Zug, Wertung, Reich), Anleitung
und Einstellungen sind Symbolknöpfe, die Sprache steht im Einstellungsmenü, Tipps sind anfangs aus
und die Karte zeigt keine Systemkennungen mehr (der Tooltip nennt sie).

| Element                           | Prinzip                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GameSidebar`, `TabPanel`         | Komposition: dieselben Abschnitte, auf drei Reiter verteilt; der Inhalt bleibt im DOM, damit Formulare ihren Stand behalten.      |
| `useSidebarStore`                 | Information Expert für den offenen Reiter; `reveal` öffnet den Reiter, in dem ein Element der Anleitung steht (geringe Kopplung). |
| `PhaseBar` in der `Toolbar`       | Eine Zeile statt zwei; nur die aktuelle Phase zeigt ihren Namen, die anderen erklären sich per Tooltip.                           |
| `IconButton` mit eigenem Provider | Selbstständiger Baustein: funktioniert auch außerhalb des App-Providers, etwa in Tests einzelner Leisten.                         |

## 20. Iteration 16 im Detail (Kampfsimulator, Kampfbühne)

Der Kampfsimulator ist ein eigener Modus neben der Partie, erreichbar über „Kampfsimulator“ im
Aufbau. Ablauf: Fraktion wählen (Liste, Heimatplanet mit Wappen, Komplexität, Fähigkeiten und ein
eigener kurzer Hintergrund), Flotte in der Werft kaufen (Ressourcen, Produktionslimit, Kapazität
für Jäger, Bestandslimit je Schiff), dann der Raumkampf gegen einen KI-Gegner über bis zu drei
Kämpfe. Pro Runde darf eine Taktikkarte gespielt werden (+1 auf Würfe, ein Treffer abgewehrt,
zwei Würfel mehr, Reparatur), danach feuern beide Seiten gleichzeitig. Die Kampfbühne zeigt
Laser, Funken, Schilde, Explosionen mit Trümmern, Rauch an beschädigten Schiffen und zwei große
Planeten im Hintergrund; darüber liegen Seitenkarten, Rundenbanner, Serienanzeige und Karten.
Dieselbe Bühne steht jetzt auch in der Kampfansicht der Partie: Würfe lösen Schüsse aus, die
Zuweisung lässt die gewählten Schiffe explodieren oder qualmen.

| Element                                         | Prinzip                                                                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `fightRound`, `validateFleet`, `botFleet`       | Domain mit `Result` statt Ausnahmen; Regeln des Simulators sind reine Funktionen, Zufall kommt über den `RandomPort` (Dependency Inversion).    |
| `SIMULATOR_RULES`, `TACTIC_CARDS`, Profile      | Daten im Paket `content` (Open/Closed): neue Karten oder Schiffe ohne Codeänderung; Texte und Hintergründe sind eigene Formulierungen.          |
| `battleLayout`, `shotsOf`, `combatStage`        | Reine Funktionen (Information Expert): Aufstellung, Choreografie einer Runde und die Brücke vom Kampfprotokoll zur Bühne, ohne Pixi testbar.    |
| `BattleScene`, `EffectLayer`, `BattleShipPiece` | Controller und Komposition: die Szene gleicht Schiffe ab und plant Wirkungen zeitlich ein; jedes Teil animiert sich selbst.                     |
| `usePixiScene`                                  | Ein Hook für alle Pixi-Bühnen (DRY): Anwendung anlegen, Größe nachführen, sauber abbauen; Karte, Systemansicht und Kampf teilen ihn.            |
| `useSimulatorStore`                             | Controller (GRASP) für den Ablauf; `battle` ist der Stand, `shown` hinkt während der Schüsse nach, damit Treffer sichtbar werden.               |
| `CombatStage` in der Partie                     | Geringe Kopplung: liest nur Spielstand und Protokoll; zerstörte Schiffe bleiben für die Salve auf der Bühne, danach gilt wieder der Spielstand. |

## 21. Iteration 17 im Detail (Handkarten, Systemzoom ohne Fenster)

Statt Knöpfen in der Seitenleiste liegt unten auf der Karte eine Hand im Fächer. In der
Strategiephase sind das die freien Strategiekarten, im Zug die strategische Aktion je unbenutzter
Karte, die taktische Aktion und Passen, dazu immer die Aktionskarten. Eine Karte hebt sich beim
Überfahren an; Antippen oder nach oben Ziehen spielt sie aus, sie fliegt dann aufs Spielfeld.
Was gerade nicht geht, bleibt liegen und sagt warum. Die taktische Aktion aktiviert das auf der
Karte gewählte System, die strategische Aktion öffnet ihr Formular in der Seitenleiste, Zurück
legt sie wieder auf die Hand. Aktionskarten mit Zielen zeigen die Zielwahl direkt über der Karte.

Ein Klick auf ein System wählt es aus und fährt ohne Fenster hinein: Die Karte zoomt, die
Detailansicht blendet randlos über. Wer mit dem Mausrad oder den Zoomknöpfen tief genug
hineinzoomt, landet automatisch im System unter dem Zeiger oder in der Bildmitte; Herauszoomen,
Escape oder „Zur Sternenkarte“ fahren zurück.

Jede Karte hat ihr eigenes Aussehen: Die acht Strategiekarten tragen je eine Farbe und ein
Symbol, Zugkarten sind gold und schiefer, Aktionskarten färben sich nach ihrem Zeitpunkt
(Kampf rot, Antworten rosa, Sekundär violett …). Ein Zierrahmen mit Rauten, ein Bildfenster mit
prozeduralem Sternfeld und Umlaufbahn, ein Initiative-Siegel und eine Trennlinie geben der Karte
Tiefe; alles ist eigene Grafik aus CSS und SVG.

| Element                                  | Prinzip                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `handEntries`, `interrupted`             | Reine Funktionen (Information Expert): welche Karten bereitliegen und ob sie spielbar sind, aus Spielstand und Auswahl, ohne React testbar.     |
| `HandEntry` als Union                    | Polymorphie über die Art (`pick`, `strategic`, `tactical`, `pass`, `action`); Vorderseite, Name und Befehl werden je Art gewählt (Open/Closed). |
| `useHandStore`                           | Kleiner Controller (GRASP) für die gewählte strategische Aktion; Hand und Seitenleiste lesen denselben Stand und kennen einander nicht.         |
| `HandDock`, `HandCard`, `useGesture`     | Single Responsibility: Fächer und Ein-/Ausflug, eine Karte, die Geste; Befehle gehen wie bisher über `send`, die Domain prüft (Low Coupling).   |
| `useZoom`, `reachesSystem`, `systemNear` | Reine Schwellen- und Abstandsrechnung (Pure Fabrication); die Karte entscheidet nur, welches System sich beim tiefen Zoom öffnet.               |
| `lookOf`, `specksOf`, `CardArt`          | Aussehen als Daten (Open/Closed): Motiv je Mechanik oder Zeitpunkt, Farben im Stylesheet, Sterne deterministisch aus der Karten-Id.             |
| `SystemView` randlos                     | Gleiche Kamerafahrt wie zuvor, nur ohne Rahmen; Herauszoomen schließt. Die Inhaltsliste bleibt für Screenreader im Baum (Barrierefreiheit).     |

## 22. Iteration 18 im Detail (Spieltisch über der Karte, Fraktionswahl)

Die Partie spielt jetzt auf der ganzen Karte. Vor dem Start wählt jeder Mensch am Bildschirm
seine Fraktion (Wappen links, rechts Name, Komplexität, Rohstoffe und die Reiter Übersicht,
Details mit Heimatwelten, Startaufstellung und Starttechnologien, Hintergrund); vergebene
Fraktionen tragen das Platzkürzel, die KI bekommt die übrigen. Während der Partie liegen über der
Karte: links die Spielerporträts (Wappen, Siegpunkte, Initiative, wer am Zug ist, gepasst),
oben die eigenen Vorräte (Ressourcen und Einfluss bereit/gesamt, Handelswaren, Rohstoffe,
Kommandotafel als Dreieck, Technologien je Farbe, Siegpunkte), rechts oben die offenen
Entscheidungen, unten rechts die Phase mit „Zug beenden“ oder „Passen“. Ein Klick auf ein System
wählt es und zeigt sechseckige Knöpfe darüber: „System ansehen“ fährt hinein, „System aktivieren“
erscheint nur, wenn die Domain die Aktivierung gerade erlaubt. Systeme mit nur einem Besitzer
tragen dessen Farbe am Rand. Wertung, Reich und Kartenauslage sind eine Schublade am rechten Rand.

| Element                                    | Prinzip                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `seatFactions`, `takenSeats`, `firstFree`  | Reine Funktionen: die Wahl ordnet nur die Fraktionsliste; `setupCommands` bleibt für Hot-Seat und Server gleich (Open/Closed, DRY).          |
| `useDraftStore`                            | Controller (GRASP) für den Ablauf der Wahl; nach dem letzten Menschen startet er die Partie über den bestehenden `start`.                    |
| `FactionChooser`                           | Eine Auswahl für Simulator und Partie (DRY); was sie anzeigt und wohin ihre Knöpfe führen, kommt über Props (Dependency Inversion).          |
| `empireSummary`, `playerRail`, `endTurnOf` | Information Expert ohne React: Vorräte, Reihenfolge und der passende Abschlussknopf entstehen aus dem Spielstand und sind einzeln getestet.  |
| `systemActions`                            | Die Domain entscheidet: „Aktivieren“ wird an einer Kopie des Spielstands erprobt, die Oberfläche kennt keine eigene Regel (Low Coupling).    |
| `SystemActions` im SVG                     | Gleiche Abbildung wie die Trefferflächen (`foreignObject`), daher keine Messung von DOM-Größen; reicht der Platz oben nicht, unter dem Feld. |
| `control` im Szenenmodell                  | Die Szene liefert den alleinigen Besitzer, Pixi zeichnet nur den Rand (Single Responsibility).                                               |
| `GameSidebar` als Schublade                | Gleiche Panels, andere Anordnung; der Sidebar-Store merkt sich Reiter und Offen-Zustand, die Anleitung öffnet beides.                        |

## 23. Iteration 19 im Detail (plastische Karte)

Die Karte wirkt wie ein Spielbrett aus echten Teilen, bleibt aber in der Draufsicht, damit
Trefferflächen, Zoom und die Knöpfe am Feld exakt sitzen. Jede Kachel ist eine erhabene Platte:
etwas kleiner als das Feld (Fugen), mit Seitenwänden nach unten, weichem Schlagschatten,
Lichtkante oben links und Schattenfase unten rechts; die Fläche zeigt Tiefraum mit eigenen
Sternen und einem Schleier in vier Varianten. Tiefer liegende Kacheln decken die oberen ab.
Planeten werfen einen Schatten auf die Kachel, Schiffe haben eine dunkle Rumpfunterseite und
schweben mit Schatten über dem Feld, Kommandomarker sind Chips mit Dicke und Glanzpunkt.
Heimat- und Besitzränder leuchten in der Platzfarbe (breiter Schein und helle Linie).

| Element                             | Prinzip                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `tile-shape.ts`                     | Reine Geometrie (Fläche, Wände, Fasen, Anker) ohne Canvas, einzeln getestet (Pure Fabrication, Testbarkeit).          |
| `paintTile` mit Varianten           | Flyweight: je Rückseite vier Bilder im Textur-Cache, die Variante kommt stabil aus dem Feldschlüssel.                 |
| Draufsicht statt gekippter Kamera   | Gleiche Abbildung für Pixi und SVG; Tiefe entsteht nur in den Texturen (Low Coupling zur Trefferebene).               |
| `zIndex` nach Feldhöhe              | Die Szene ordnet die Ebenen, die Felder wissen nichts voneinander (Single Responsibility).                            |
| `dropShadow`, Kiel in `paintFigure` | Eine Schattenfunktion für Schiffe und Bodentruppen (DRY); Kiel und Rumpf nutzen denselben Umriss, der Kampf erbt ihn. |
| `seatFrame`                         | Ein Rand für Heimat und Besitz, nur Stärke und Größe unterscheiden sich (Open/Closed).                                |

## 24. Iteration 20 im Detail (Nahzoom statt Systemansicht, gerenderte Planeten)

Es gibt keine eigene Systemansicht mehr. „System ansehen“ oder ein zweiter Klick fährt die
Kamera auf der Karte an das System heran, bis es etwa zwei Drittel des Bildes füllt; das Mausrad
zoomt stufenlos und weich zum Mauszeiger hin, bis ein einzelner Planet das Bild füllt (Zoom bis
28). Escape oder „Ansicht zurücksetzen“ fährt zurück. Planeten sind keine hochskalierten Bilder
mehr, sondern werden auf der Grafikkarte gerechnet: Kugelnormale, verwirbeltes 3D-Rauschen für
Kontinente, feines Relief mit Licht und Schatten, Meere mit Glanz, Wolken, Nachtlichter und
Atmosphäre, scharf in jeder Zoomstufe. Ab Zoom 5 weichen die kleinen Zahlen der Karte lesbaren
Schildern unter Planeten (Name, Werte, Eigenschaft, Besitzer, Truppen) und Flotten. Striche,
Leuchtränder und Kachelsterne wachsen beim Zoomen nur gedämpft mit, Schiffe und Anomalien sind in
hoher Auflösung mit Mipmaps gemalt, Wände und Lichtkanten der Kacheln sind Vektorgrafik.

| Element                                    | Prinzip                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `planet-shader.ts`, `planetMesh`           | Ein GL-Programm für alle Planeten (Flyweight), je Planet nur Werte; Geometrie je Größe und Shader je Planet geteilt.             |
| `planetPaint`                              | Reine Funktion: dieselben Farbstufen wie der Canvas-Maler, damit Karte, Fraktionswahl und Kampf denselben Planeten zeigen (DRY). |
| `zoomAround`, `approach`, `systemZoom`     | Reine Kamerarechnung, einzeln getestet; der feste Punkt unter dem Zeiger bleibt beim Zoomen und Gleiten stehen.                  |
| `glideTo`, `animateViewport`, `stopCamera` | Eine Kamerabewegung zur Zeit: Mausrad gleitet, Heranfahren fährt, Ziehen hält beide an (Single Responsibility).                  |
| `useCameraStore`                           | Ersetzt die Systemansicht: merkt nur den Rückkehrpunkt (Information Expert), die Karte selbst bleibt die einzige Ansicht.        |
| `closeUpMarks`, `CloseUpLabels`            | Reine Projektion der Planeten und Flotten auf den Bildschirm, darüber echtes DOM: lesbar, scharf, testbar.                       |
| `detailLevel`, `lineScale`, `drawFine`     | Nur beim Wechsel der Detailstufe werden Glühen und Sterne neu gezeichnet, nicht die ganze Karte (Low Coupling zur Spiellogik).   |
| Systemansicht entfernt                     | Kampfbühne behält ihre Bausteine (`WORLD`, `SHIP_SCALE`, `starfield`); toter Code der alten Ansicht ist gelöscht.                |

## 25. Iteration 21 im Detail (schräger Blick vom Heimatsystem, saubere Kacheln, eigene Planeten)

Die Karte liegt wie ein Brett auf dem Tisch und wird schräg gesehen, nicht mehr aus der
Vogelperspektive. Jeder sieht sie von der Seite seines Heimatsystems: online immer vom eigenen
Platz, am Hot-Seat vom Menschen am Zug; wechselt der Platz, dreht sich das Brett weich und die
Kamera fährt auf die ganze Karte zurück. Zu Beginn der Partie liegt das Brett gleich richtig.
Vorne wirkt alles größer als hinten. Planeten und Schiffe stehen dem Betrachter zugewandt auf dem
Brett, ihre Anordnung im Feld dreht sich nicht mit (Flotten stehen immer vorne). Die Kacheln liegen
fugenlos; statt Wänden, Lichtkanten und Doppelrahmen gibt es dünne Fugen, eine helle Außenkante
und eine Brettkante zum Betrachter. Heimatsysteme, Besitz und Hervorhebung haben je eine schlanke
Linie mit weichem Schein. Jeder Planet hat einen eigenen Charakter (Ozeanwelt, Archipel, Eiswelt,
Wüste mit Dünen, Kraterwelt, Gasriese mit Ring …), leicht verschobenen Farbton und eigene Größe;
die Art bleibt an der Farbe erkennbar.

| Element                                          | Prinzip                                                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `board-view.ts` (`turn`, `lift`, `boardBounds`)  | Reine Projektion, einzeln getestet; Pixi, SVG-Trefferflächen, Schilder, Knöpfe und Effekte nutzen dieselbe Abbildung (DRY).            |
| `board-pieces.ts` (`flatImage`, `standing`)      | Stücke werden einmal gebaut und nur neu ausgerichtet (Strategy); beim Drehen entstehen keine neuen Objekte.                            |
| `board-grid.ts` (`boardEdges`)                   | Jede gemeinsame Kante genau einmal: gleichmäßig dünne Fugen, Außenkante und Brettkante aus derselben Kantenliste (Information Expert). |
| `hex-layout.ts`                                  | Plätze und Größen im Feld ohne Pixi: Karte und Nahbeschriftung teilen sie, das Hauptpaket lädt kein Pixi (Low Coupling).               |
| `board-camera.ts` (`viewerSeat`, `useBoardView`) | Wer vorne sitzt, ist eine reine Funktion des Spielstands; die Drehung ist davon getrennt (Single Responsibility).                      |
| `planet-style.ts` (`planetStyle`, `hueRotate`)   | Reine Funktion aus Art und Name: gleiche Welt bei jedem Aufruf, Shader und Canvas-Maler nutzen dieselben Farben (DRY).                 |
| `GalaxyScene.redraw`, `moveCamera`               | Ein Bild pro Frame, auch wenn Kamera und Drehung zugleich ändern; eine Kamerafahrt an dieselbe Stelle entfällt.                        |

## 26. Iteration 22 im Detail (nur private Lobbys, Zugverlauf, Rückgängig, Tablet)

Gespielt wird nur noch in privaten Lobbys: Jeder Mensch sitzt an seinem eigenen Gerät, der
Gastgeber gibt den Code weiter, freie Plätze übernimmt beim Start die KI. Den Hot-Seat-Modus mit
lokaler Partie, lokaler KI und Fraktionswahl am gemeinsamen Bildschirm gibt es nicht mehr. Die
Fraktion wählt jeder in der Lobby auf seinem Gerät; was andere gewählt haben, ist gesperrt. Neu sind
der Zugverlauf „Was ist passiert?“ als Reiter der Übersicht und ein Knopf „Rückgängig“ für den
letzten eigenen Schritt, solange man noch am Zug ist und nichts Neues verraten wurde. Der Hinweis am
Mauszeiger ist knapp (Planeten in einer Zeile, Einheiten je Spieler zusammengefasst), klappt vom Rand
weg und zeigt die Bedienhilfe nur bis zum ersten Klick. Die Hand liegt eingeklappt am unteren Rand,
bis man sie braucht (Kartenwahl), auf sie zeigt oder sie mit dem Knopf öffnet. Am Tablet zoomen zwei
Finger um ihren Mittelpunkt, ein Finger verschiebt, der Hinweis am Zeiger entfällt, und Knöpfe sind
größer.

| Element                                              | Prinzip                                                                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StepUndone`, `withoutUndone`, `replayGame` (Domain) | Event Sourcing bleibt unveränderlich: Die Rücknahme ist selbst ein Event, das Replay lässt die zurückgenommenen Events aus; die Version zählt den ganzen Strom. |
| `isReversible`, `undoStep` (Domain)                  | Positivliste (Information Expert): Nur Events, die nichts verraten, lassen sich zurücknehmen; ein neues Event ist erst einmal endgültig (Open/Closed, sicher).  |
| `OnlineGames.undo`, `GameController.undo`            | GRASP Controller: Nur die Anwendung kennt die Grenzen eines Commands; sie merkt sich den letzten zurücknehmbaren Schritt je Lobby und prüft die Version.        |
| `chooseFaction`, `seatFactions` (Anwendung)          | Reine Funktionen: Wahl je Platz, Rest der Reihe nach; `setupCommands` baut die Partie wie bisher (DRY).                                                         |
| `CommandReceipt`, `useCanUndo` (Web)                 | Die Quittung sagt, ob der Schritt zurücknehmbar ist; der Knopf erscheint nur, solange die Partie noch bei dieser Version steht (kein Wettlauf mit Updates).     |
| `turn-history.ts` (`historyLines`, `appendHistory`)  | Reine Funktionen: Events werden zu Daten, Text entsteht erst beim Anzeigen in der gewählten Sprache (Single Responsibility).                                    |
| `pinchStep`, `usePointers` (`use-pan-zoom.ts`)       | Reine Geste plus dünner Hook: Zwei Finger liefern Zoomfaktor und Verschiebung, Maus und ein Finger bleiben ein Ziehen (Low Coupling).                           |
| Tests: `local-table.ts` (`seatTable`)                | Testattrappe des Servers (Dependency Inversion über `Remote`): Komponententests bedienen alle Plätze, das Produkt kennt nur den eigenen.                        |

## 27. Iteration 23 im Detail (ganze Karte, freier Blick, Benachrichtigungen, Mechs)

Die Karte liegt in der Partie immer ganz im freien Bereich zwischen Spielern (links), Vorräten
(oben), Hand (unten) sowie Benachrichtigungen und Reitern (rechts). Sie wird dadurch auf jedem
Bildschirm so groß wie möglich, und kein Fenster liegt mehr über einem System. Den Platz für die
Benachrichtigungen hält die Karte nur frei, wenn sie dadurch höchstens 15 % kleiner wird; auf eher
quadratischen Bildschirmen liegen die Meldungen kurz über der Karte. Der Blick ist frei: Die rechte
Maustaste (oder Umschalt) dreht und neigt die Karte, zwei verdrehte Finger drehen sie, Knöpfe und
die Tasten Q, E und T drehen in Achtelschritten und wechseln zur Draufsicht; „Ansicht
zurücksetzen“ führt zum Blick vom eigenen Heimatsystem zurück. Was man entscheiden muss, ploppt
unten rechts wie eine Benachrichtigung auf; darüber erscheinen kurz die Züge der anderen. Ein
abgelehnter Befehl bleibt rot stehen, bis man ihn schließt. Die Flächen der Anzeigen teilen sich
Farben und Schatten, Ressourcen und Einfluss stehen auf einem Schildchen unter jedem Planeten.

Mit der Erweiterung kommt als Erstes der Mech: eine Bodeneinheit mit Schadensresistenz (Kosten 2,
Kampf 6, höchstens 4). Jede Fraktion hat dazu eine eigene Mech-Fähigkeit; zwei davon setzen Mechs
kostenlos aus der Verstärkung ein (nach einer Eroberung bzw. nach dem Bau von mindestens 3
Bodentruppen). Schadensresistenz wirkt nun auch gegen Bombardement und Verteidigungsfeuer.

| Element                                                 | Prinzip                                                                                                                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `map-frame.ts` (`hudInsets`, `frameBounds`, `freeBand`) | Reine Funktionen: Bildschirmränder in Pixeln werden zu einer viewBox; Pixi-Bild, SVG-Flächen und Knöpfe nutzen dieselbe Abbildung (DRY, Low Coupling).         |
| `BoardView.tilt`, `lift(point, height, tilt)`           | Die Neigung gehört zum Blick (Information Expert); alle Abbildungen fragen sie dort ab, statt eine feste Konstante zu kennen.                                  |
| `orbit-store.ts` (`orbitBy`, `orbitTo`, `toggleTop`)    | Eigene kleine Ablage für die Verstellung des Spielers; die Grundrichtung vom Heimatsystem bleibt in `board-camera` (Single Responsibility).                    |
| `pinchStep` mit `twist`, `useGestures`                  | Reine Geste plus dünner Hook: Zwei Finger liefern Zoom, Verschiebung und Drehung; die rechte Maustaste schaltet Ziehen auf Drehen um (Polymorphie über Modus). |
| `NoticeStack`, `useTurnPanelKey`, `fresh-notices.ts`    | Entscheidungen bleiben in `TurnPanel` (keine Kopie); ein Schlüssel sagt, wann eine neue Entscheidung aufploppt. Meldungen entstehen aus dem Verlauf (DRY).     |
| Mech als Daten (`units.ts`), `mechAbilityOf`            | Open/Closed: Produktion, Transport, Kampf und Reparatur fragen Fähigkeiten ab, nicht den Typ; der Mech brauchte dort keinen neuen Code.                        |
| `DeployRule`, `deployEvents`, `UnitsDeployed` (Domain)  | Einsetzen als Daten an der Fraktionsfähigkeit (Strategy); ein eigenes Event hält das Event Sourcing nachvollziehbar, `supplyAllows` prüft das Limit (Expert).  |
| Bombardement und Verteidigungsfeuer mit `sustained`     | Dieselbe Trefferzuteilung wie im Bodenkampf (DRY): erst Schadensresistenz, dann die billigsten Einheiten; alte Events ohne das Feld bleiben abspielbar.        |

## 28. Iteration 24 im Detail (Erkundung, Relikte, legendäre Planeten)

Wer einen unbesetzten Planeten mit Eigenschaft erobert, erkundet ihn: Eine Karte aus dem Stapel
seiner Eigenschaft (kulturell, gefährlich, industriell) wirkt sofort. Sie bringt Handelswaren,
Rohstoffe, eine Aktionskarte oder Einheiten, legt eine Anlage an den Planeten (mehr Ressourcen
oder Einfluss, eine Spezialisierung) oder ist ein Reliktfragment. Systeme ohne Planeten tragen zu
Beginn einen Grenzmarker; mit der neuen Technologie Tiefraumscanner erkundet man ihn am Ende einer
Taktikaktion aus dem Grenzstapel. Drei Fragmente einer Art (Grenzfragmente zählen als jede Art)
werden zu einem Relikt aus einem eigenen Stapel von acht. Zwei legendäre Planeten liegen im Vorrat
der Galaxie; ihre Fähigkeit wirkt einmal je Runde als Komponentenaktion. Alle Namen und Texte
sind eigene Entwürfe.

In der Oberfläche liegen Relikte, Fragmente und legendäre Planeten als Karten in der Hand:
Antippen nutzt ein Relikt, opfert drei Fragmente oder löst die legendäre Fähigkeit aus. Auf der
Karte stehen Grenzmarker als Kompassstern, Depots als Münzstapel, legendäre Planeten mit goldenem
Strahlenkranz (matt, wenn genutzt); der Hinweis am Zeiger nennt Anlagen und Fähigkeit. Der Reiter
„Karten“ zeigt Stapel, Ablagen und die Funde aller Spieler. Eigene Funde melden sich unten rechts.

| Element                                                     | Prinzip                                                                                                                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RewardEffect`, `reward-effects.ts` (Domain)                | Wirkungen als Daten mit einem Interpreter (Interpreter, Open/Closed): Erkundungskarten, Relikte und legendäre Planeten teilen sich dieselben Effekte. |
| `ExplorationState`, Events `PlanetExplored`, `RelicDrawn` … | Event Sourcing wie bisher: jede Karte und jedes Relikt ist ein Event; verdeckte Stapel zeigt `player-view` nur als Anzahl (Information Hiding).       |
| `withAttachments`, `currentPlanetDefinition`                | Information Expert: Der Planet kennt seine Werte samt Anlagen; Bezahlen, Forschung, Ziele und die Karte fragen nur noch dort.                         |
| `purgeOptions`, `usableRelics`, `usableLegendaryPlanets`    | Abfragen in der Domain (Expert); Hand und KI rufen sie auf, statt Regeln zu wiederholen (DRY, Low Coupling).                                          |
| `tableEntries`, `TableEntry` (Web)                          | Die Hand bleibt eine Liste von Karten (Polymorphie über `kind`); neue Kartenarten brauchen nur Gesicht und Befehl, nicht neue Bedienung.              |
| `scene-model` mit `frontier`, `cache`, `legendary`          | Reine Daten für Pixi, Hinweis und Nahbeschriftung (Pure Fabrication); das Zeichnen kennt keine Domainregeln.                                          |
| `fresh-notices.ts` mit `REVEALS`                            | Eine Liste sagt, welche eigenen Zeilen trotzdem aufploppen (Daten statt Verzweigung, Open/Closed).                                                    |

## 29. Iterationen

| #   | Inhalt                                              | Stand |
| --- | --------------------------------------------------- | ----- |
| 1   | Monorepo, Tooling, CI, Domain-Grundtypen            | ✓     |
| 2   | Galaxie-Aufbau, Hex-Rendering, Map-Import           | ✓     |
| 3   | Phasen-State-Machine, Strategiephase                | ✓     |
| 4   | Taktische Aktion: Bewegung, Kapazität, Flottenlimit | ✓     |
| 5   | Weltraumkanone, Raumkampf, Rückzug, Kampfansicht    | ✓     |
| 6   | Invasion, Produktion, Wirtschaft, Transaktionen     | ✓     |
| 7   | Technologie, Einheiten-Upgrades                     | ✓     |
| 8   | Ziele, Statusphase, Sieg                            | ✓     |
| 9   | Effekt-System, Aktionskarten, Timing-Fenster        | ✓     |
| 10  | Agendaphase, Abstimmung                             | ✓     |
| 11  | Fraktionsfähigkeiten, KI-Gegner                     | ✓     |
| 12  | Multiplayer, Persistenz, Reconnect                  | ✓     |
| 13  | Animationen, Sound-Hooks, Tutorial                  | ✓     |
| 14  | Systemansicht mit Kamerafahrt, moderne Oberfläche   | ✓     |
| 15  | Gängige Namen, schlichtere Oberfläche mit Reitern   | ✓     |
| 16  | Kampfsimulator, Kampfbühne auch in der Partie       | ✓     |
| 17  | Handkarten statt Knöpfe, Systemzoom ohne Fenster    | ✓     |
| 18  | Spieltisch über der Karte, Fraktionswahl            | ✓     |
| 19  | Plastische Karte: Kacheln, Schatten, Leuchtränder   | ✓     |
| 20  | Nahzoom statt Systemansicht, Shader-Planeten        | ✓     |
| 21  | Schräger Blick vom Heimatsystem, eigene Planeten    | ✓     |
| 22  | Nur private Lobbys, Zugverlauf, Rückgängig, Tablet  | ✓     |
| 23  | Ganze Karte, freier Blick, Meldungen, Mechs (PoK)   | ✓     |
| 24  | Erkundung, Relikte, legendäre Planeten (PoK)        | ✓     |

## 30. Befehle

```
pnpm install
pnpm check          # typecheck + lint + format + Tests mit Coverage
pnpm test           # nur Tests
pnpm --filter @stellar/web dev   # Web-App lokal (http://localhost:5173)
pnpm server         # Online-Server (Port 3000); im Dev-Modus leitet Vite /socket.io dorthin
pnpm e2e            # Playwright gegen den Server, der den Produktions-Build ausliefert
```

Der Online-Server liest seine Einstellungen aus der Umgebung:

| Variable       | Bedeutung                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------- |
| `PORT`         | Port für HTTP und Socket.IO (Standard 3000)                                                   |
| `WEB_DIST`     | Gebaute Web-App, die der Server mit ausliefert; relativ zu `apps/server`, z. B. `../web/dist` |
| `DATABASE_URL` | PostgreSQL für den Event Store; ohne Angabe im Speicher                                       |
| `REDIS_URL`    | Redis für Lobbys; ohne Angabe im Speicher                                                     |
| `BOT_DELAY_MS` | Pause vor jedem KI-Zug (Standard 400)                                                         |
| `LOG_LEVEL`    | Log-Stufe von Fastify (Standard `info`)                                                       |

Für ein Hosting als ein Dienst: im Ordner `stellar-hegemony` mit `pnpm install --frozen-lockfile &&
pnpm build` bauen und mit `WEB_DIST=../web/dist pnpm server` starten. Der Health-Check liegt unter
`/health`.

### Render

`render.yaml` im Wurzelordner des Repos beschreibt alles für Render: den Webdienst
`stellar-hegemony`, die Datenbank `stellar-hegemony-db` und den Key-Value-Speicher
`stellar-hegemony-lobbies` (nur intern erreichbar). Einrichten: auf render.com „New“ →
„Blueprint“, dieses Repo wählen und bestätigen; bei einem schon verbundenen Blueprint genügt
„Sync“. Die Tabelle für die Events legt der Server beim ersten Start selbst an.

Grenzen des kostenlosen Tarifs:

- Der Webdienst schläft nach 15 Minuten ohne Aufrufe ein; der erste Aufruf danach dauert etwa
  eine Minute. Laufende Partien gehen dabei nicht verloren, weil sie im Event Store liegen.
- Die kostenlose Datenbank läuft 30 Tage nach dem Anlegen ab (danach 14 Tage Frist). Vorher auf
  einen bezahlten Tarif wechseln oder sie neu anlegen, sonst startet der Server nicht mehr.
- Key Value hält Lobbys nur im Arbeitsspeicher; startet er neu, sind offene Lobbycodes weg.
