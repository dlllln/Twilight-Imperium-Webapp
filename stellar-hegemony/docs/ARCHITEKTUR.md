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
│   │       ├── action-card/   (It. 9) Aktionskarten als Daten, Wirkungsregeln, Zeitfenster, Verhindern
│   │       ├── agenda/        (It. 10) Agenden als Daten, Abstimmung, Gesetze, Direktiven
│   │       └── faction/       (It. 11) FactionAbility, Fraktionsregeln; galaxy/board-limits
│   ├── application/         Use Cases: GameController, Ports (EventStorePort, EventPublisherPort)
│   ├── infrastructure/      Adapter: SeededRandom, SystemClock, InMemoryEventStore, InProcessEventPublisher
│   │                        CryptoRandom, CryptoIds, InMemoryLobbyStore; unter `/node` PostgresEventStore, RedisLobbyStore
│   ├── content/             Daten: Regelzahlen, Einheiten, Systeme, Fraktionen, Techs, Karten
│   └── bots/                (It. 11) KI-Gegner: Planer schlagen Commands vor, die Domain prüft
└── apps/
    ├── server/              (It. 12) Fastify + Socket.IO, Composition Root, SocketGateway, BotDriver
    └── web/                 React 18 + Vite + Zustand, i18n de/en, Playwright-E2E
        └── src/render/      (It. 4) PixiJS-Szene: prozeduraler Nebel, Planeten, Anomalien,
                             Schiffsminiaturen, Bloom-Glühen; darüber SVG-Trefferflächen
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
| Web: `createLocalGame`, `useGameStore`                                                                      | Lokaler Adapter: dieselben Commands wie später über das Netz, nur ohne Server (Hot-Seat).                                                            |
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

## 17. Iterationen

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
| 13  | Animationen, Sound-Hooks, Tutorial                  | offen |

## 18. Befehle

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
