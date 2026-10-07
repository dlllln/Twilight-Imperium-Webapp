# Offene Regelentscheidungen

Wo die Vorgabe vom Grundspiel abweicht oder mehrdeutig ist, steht hier die gewählte
Voreinstellung. Alles ist über `RuleNumbers`/`GameConfig` bzw. Content-Daten änderbar.

| #   | Frage                                                                                                                                      | Voreinstellung bis zur Entscheidung                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Die Vorgabe nennt 3–8 Spieler und eine Mech-Einheit. Im Grundspiel gibt es 3–6 Spieler und keine Mechs; beides stammt aus der Erweiterung. | Grundspiel: 3–6 Spieler, kein Mech. `maxPlayers` und Einheitenliste sind Daten und lassen sich später erweitern.                                                                      |
| 2   | Flaggschiffe sind fraktionsspezifisch.                                                                                                     | Werte kommen mit den Fraktionen in Iteration 11.                                                                                                                                      |
| 3   | Der Galaxie-Aufbau im Regelwerk ist ein reihum gelegter Draft.                                                                             | Zufallsgalaxie (regelkonform: keine benachbarten Anomalien oder gleichen Wurmlöcher, wo vermeidbar) oder Import per Map-String. Der Draft folgt mit dem Lobby-Ablauf in Iteration 12. |
| 4   | Ausgleich bei 5 Spielern (Handelswaren für benachteiligte Plätze, zusätzliche rote Tafel neben dem Zentrum).                               | Die zusätzliche rote Tafel ist in der Vorlage enthalten, liegt aber nicht zwingend neben dem Zentrum. Der Handelswaren-Ausgleich kommt mit der Wirtschaft in Iteration 6.             |
