# Material industry and delayed personal imports

Full-game continuation after PR #4. Regional resource sites are explicit campaign
abstractions; the quantities and locations are game balance rather than a claim
about surveyed historical deposits.

New materials: timber, recovered iron, lead, tanned leather, saltpeter, charcoal
and sulfur. New campaigns receive finite starter stocks; older saves migrate
missing stocks to zero rather than silently receiving free material.

Owned, supplied and undamaged sites yield materials daily. Córdoba supplies
wood/iron, Santa Fe wood/leather, Mendoza copper/charcoal/sulfur, Salta lead/saltpeter,
Tucumán saltpeter/leather and San Nicolás iron/leather. Each active site improves
workshop throughput by 10%; the actual order duration and UI use the same helper.
Site damage pauses that site's contribution until recovery. Resource cargo has
explicit weight and can use existing finite depot convoy rules.

Recipes consume actual material: powder uses saltpeter/charcoal/sulfur; cartridges
also need lead; reconditioned muskets need wood and recovered iron; blades use iron
and charcoal; bronze guns need wood/charcoal; uniforms consume leather. Charcoal
can be made from timber. Free daily powder generation was removed. Imported raw
materials offer an alternate finite supply route with existing shipment delays.

Brown Bess and Baker personal weapons now enter a separate paid shipment queue,
not the available armory immediately. Foreign reputation determines prices;
Ensenada and willing merchants are required; delivery takes 72–120 hours and
blockades/occupation hold due shipments. The armory UI shows pending orders.
Local weapons retain workshop stock purchase. This does not yet implement every
period accessory or fully custom individual weapon manufacture.

Tests: industry-web covers ingredient depletion, timed completion, insufficient
inputs, ownership/supply/damage effects, throughput, weighted cargo, import delay,
blocked delivery, once-only arrival, and save migration/malformed queues. Existing
equipment tests now wait for actual personal imports before equipping them.

The full campaign acceptance playthrough must brew powder or import resources
when stocks run low; do not restore free powder to make old tests pass.
