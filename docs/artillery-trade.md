# Stored artillery trading

The armory can sell an exact gun held in the local artillery depot and buy it back from that workshop. Transport a deployed piece to a workshop depot first. Sale transfers the entire gun, including its identity, loaded charge, reserve rounds and unfinished reload. It does not create generic cannon or ammunition resources. Merchant-held guns no longer count toward the player's artillery.

The shop pays 40% of the catalog price and charges 80% for repurchase, matching the existing handheld trade fractions. These are Granaderos tuning. Ammunition travels with the piece but receives no separate price. Merchant funds are finite. Purchases require actual player money. Trading requires a present squad, a supplied patriot workshop, no pending battle/encounter and no known active local hostile force. Each shop can retain 100 exact guns; each depot retains its existing 2,000-piece limit.

The shop retains sold guns across saves and stock refresh. A repeated sale or purchase fails without changing funds or custody. Save validation includes merchant guns in the same identity ledger as deployed, stored and transported pieces, and rejects invalid loads, cargo and duplicate ownership. Older saves need no invented merchant stock.

Validation includes payment/custody round trips, redeployment after repurchase, rejected orders, malformed saves and actual armory button dispatch. A separate local QA fixture passed live sale, reload/resume and repurchase: a bronze gun retained two rounds and 25% reload progress; treasury changed from 3,200 to 3,480 to 2,920 pesos, and merchant cash from 1,200 to 920 to 1,480.

This does not close all trading requirements. Generic undeployed cannon stock, direct battlefield sales, dealer preferences and barter remain separate work. The QA fixture establishes the interface and persistence flow, not a complete campaign or historical market-price accuracy.
