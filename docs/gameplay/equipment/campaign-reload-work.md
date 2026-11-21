# Preserve unfinished reloads on campaign return

Unfinished firearm loading started during tactical exploration or combat survives returning to the campaign map for an ordinary issued gun as well as a map-equipped gun. A soldier must finish the remaining work through the normal reload action. Returning to the map, saving, loading, or entering another sector cannot finish or erase that work.

The ammunition return plan retains the completed barrel charges with the gun and returns only the reserve cartridges to general stock. The retained amount is deducted from the existing issue/loot allowance. Captured soldiers keep the load and unfinished work in custody; a returning or escaping soldier keeps it in their own carried weapon record. No cartridge is consumed for unfinished work. A charge consumes one reserve cartridge only when it is completed.

This uses the existing validated carried-loading state. Subsequent deployments retain the exact load, even if empty. A completed continuation clears the unfinished fraction and preserves the completed charge. No-ammunition reload attempts retain the fraction without spending time or changing physical state.

Every held firearm keeps its actual load on return, including ordinary fully loaded and empty guns. See [persistent gun loads](campaign-gun-loads.md) for the accounting and initial-issue boundary.
