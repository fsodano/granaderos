// The tactical reducer resolves contextual equipment actions before this map.
export function spriteOrderPose(type){
 if(['fire','firePoint'].includes(type))return 'fire';
 if(['reload','reprime','repair'].includes(type))return 'reload';
 if(['melee','charge','boleadoras','grenade','breach'].includes(type))return 'strike';
 if(['heal','loot','lootBatch','equipLoot','drop','transfer','steal','environment','free','ration','fitBayonet','removeBayonet'].includes(type))return 'interact';
 return 'idle';
}
