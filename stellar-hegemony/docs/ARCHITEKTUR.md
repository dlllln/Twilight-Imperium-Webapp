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
│   │       ├── galaxy/        SystemTile, SystemState, StarSystem (Expert)   → It. 2: GalaxyBuilder, MapString, HexPathfinder
│   │       ├── player/        CommandSheet, PlayerState
│   │       ├── game/          GameConfig, RuleNumbers, GameState, GameEvent, GameCommand
│   │       ├── eventsourcing/ DomainEvent, ReducerMap, Command, CommandHandler
│   │       ├── setup/         CreateGame, SeatPlayer                          → It. 2/3: Galaxie, Startaufstellung
│   │       ├── phases/        (It. 3) State Pattern: Setup/Strategy/Action/Status/Agenda/GameOver
│   │       ├── movement/      (It. 4) MovementValidator, TransportPlanner
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
    └── web/                 (It. 2) React 18 + Vite + Zustand, SVG-Hexkarte, i18n de/en
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
                   nextUnitNumber, winner }
       1 ── * PlayerState, 1 ── * SystemState, 1 ── * PlanetState

«interface» CommandHandler<S, C, E> { commandType; decide(state, command, ctx): Result<E[]> }
«type» ReducerMap<S, E>   genau ein Reducer pro Event-Typ (vom Compiler erzwungen)

«port» RandomPort { nextInt(min, max) }      «port» ClockPort { now() }
«port» EventStorePort { load, append(expectedVersion) }   «port» EventPublisherPort { publish }
«controller» GameController { create(CreateGame), execute(gameId, GameCommand), load(gameId) }
```

Geplante Erweiterungen (je Iteration, gleiche Muster):

```
«state» Phase { allowedCommands, onEnter, next }  ◁── SetupPhase, StrategyPhase, ActionPhase,
                                                      StatusPhase, AgendaPhase, GameOverPhase
«service» HexPathfinder, MovementValidator, CombatResolver, ProductionCalculator, VotingTally
«fabrication» EffectResolver, TimingWindowManager (Chain of Responsibility: when → after,
              ab dem aktiven Spieler im Uhrzeigersinn)
«data» EffectDefinition { trigger, timing: when|after|action, condition, cost, effect }
«strategy» FactionAbility, CardEffect, BotStrategy
«factory» GalaxyBuilder (Map-String, Draft), UnitFactory
```

## 4. Commands und Events

Commands sind Absichten (Imperativ), Events sind Tatsachen (Partizip). ✓ = umgesetzt.

| Bereich             | Commands                                                                                                    | Events                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aufbau              | ✓ CreateGame, ✓ SeatPlayer, ImportMap, PlaceSystemTile (Draft), StartGame, KeepSecretObjective              | ✓ GameCreated, ✓ PlayerSeated, SpeakerAssigned, GalaxyAssembled, SystemTilePlaced, StartingForcesPlaced, ObjectivesPrepared, SecretObjectivesDealt, SecretObjectiveKept, GameStarted                                                                                                                                                                  |
| Strategiephase      | PickStrategyCard                                                                                            | StrategyCardPicked, TradeGoodsPlacedOnUnpickedCards, StrategyPhaseEnded                                                                                                                                                                                                                                                                               |
| Taktische Aktion    | ActivateSystem, MoveUnits, AnnounceRetreat, AssignHits, CommitGroundForces, ProduceUnits, EndTacticalAction | SystemActivated, UnitsMoved, GravityRiftRolled, SpaceCannonFired, AntiFighterBarrageFired, CombatRoundRolled, HitsAssigned, UnitDamaged, UnitDestroyed, Retreated, SpaceCombatEnded, BombardmentRolled, GroundForcesCommitted, GroundCombatRoundRolled, PlanetControlGained, CenterTokenRemoved, UnitsProduced, PlanetsExhausted, TacticalActionEnded |
| Strategische Aktion | PerformPrimaryAbility, ResolveSecondaryAbility, DeclineSecondaryAbility                                     | PrimaryAbilityResolved, SecondaryAbilityResolved, SecondaryAbilityDeclined, CommandTokensGained, SystemLocked, PlanetsReadied, SpeakerChanged, ActionCardsDrawn, StructurePlaced, TradeGoodsGained, CommoditiesReplenished, CommandTokenReturned, TechnologyResearched, SecretObjectiveDrawn                                                          |
| Komponentenaktion   | PlayActionCard, UseComponentAbility                                                                         | ActionCardPlayed, ActionCardCancelled, EffectResolved                                                                                                                                                                                                                                                                                                 |
| Passen              | Pass                                                                                                        | PlayerPassed, ActionPhaseEnded                                                                                                                                                                                                                                                                                                                        |
| Handel              | ProposeTransaction, AcceptTransaction, RejectTransaction                                                    | TransactionProposed, TransactionCompleted, TransactionRejected                                                                                                                                                                                                                                                                                        |
| Statusphase         | ScoreObjective, SkipScoring, DiscardActionCards, RedistributeCommandTokens                                  | ObjectiveScored, PublicObjectiveRevealed, ActionCardsDrawn, ActionCardsDiscarded, CommandTokensReturned, CommandTokensRedistributed, PlanetsReadied, UnitsRepaired, StrategyCardsReturned, StatusPhaseEnded                                                                                                                                           |
| Agendaphase         | CastVotes, Abstain, BreakTie                                                                                | AgendaRevealed, VotesCast, PlayerAbstained, LawEnacted, DirectiveResolved, AgendaDiscarded, AgendaPhaseEnded                                                                                                                                                                                                                                          |
| Reaktionsfenster    | PlayReaction, PassReaction                                                                                  | TimingWindowOpened, ReactionPlayed, ReactionPassed, ReactionTimedOut, TimingWindowClosed                                                                                                                                                                                                                                                              |
| Sieg                | –                                                                                                           | VictoryPointGained, GameWon                                                                                                                                                                                                                                                                                                                           |

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

## 6. Iterationen

| #   | Inhalt                                              | Stand |
| --- | --------------------------------------------------- | ----- |
| 1   | Monorepo, Tooling, CI, Domain-Grundtypen            | ✓     |
| 2   | Galaxie-Aufbau, Hex-Rendering, Map-Import           | offen |
| 3   | Phasen-State-Machine, Strategiephase                | offen |
| 4   | Taktische Aktion: Bewegung, Kapazität, Flottenlimit | offen |
| 5   | Kampf, Space Cannon, Bombardement                   | offen |
| 6   | Produktion, Wirtschaft, Transaktionen               | offen |
| 7   | Technologie, Einheiten-Upgrades                     | offen |
| 8   | Ziele, Statusphase, Sieg                            | offen |
| 9   | Effekt-System, Aktionskarten, Timing-Fenster        | offen |
| 10  | Agendaphase, Abstimmung                             | offen |
| 11  | Fraktionsfähigkeiten (3 eigene Fraktionen)          | offen |
| 12  | Multiplayer, Persistenz, Reconnect                  | offen |
| 13  | Animationen, Sound-Hooks, Tutorial                  | offen |

## 7. Befehle

```
pnpm install
pnpm check          # typecheck + lint + format + Tests mit Coverage
pnpm test           # nur Tests
```
