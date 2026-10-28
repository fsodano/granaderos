# CollectResidentSupply

A free, living resident can collect one nearby unattended supply at each game
hour. The default policy selects a supply that the resident does not carry.
Eligible supplies are rations, dressings, torches, and boleadoras. The maximum
distance is one tile on each axis. Source identity orders simultaneous choices.

The use case loads `ResidentSupplies` and `GroundSupply` objects from its narrow
repository. `ScavengingPolicy` selects a valid source. `ItemTransferService`
prepares both finite inventory changes. `GroundSupply` then records the transferred unit's custody. The repository commits both
quantities together. An empty selection changes nothing.

The field adapter transfers finite stock at the exact hourly event. The campaign
adapter acknowledges each receipt once into the persistent character's supply
record. A long operation applies the same events as several short operations.
`ResidentRoutine` orders local movement before collection when both are due at
the same second. A resident who later dies keeps the earlier transfer in the
corpse's actual equipment. Serving, captured, unconscious,
departed, detained, or escorted characters cannot scavenge. Closed containers,
corpses, held property, quest deliveries, money, and weapons are outside this
policy. The explicit world-time operation schedules opportunities; read-only
queries never collect equipment.
