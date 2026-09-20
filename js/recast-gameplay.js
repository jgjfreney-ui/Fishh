/* Deep Sea Diver: Recast — small gameplay rule overrides
 * Recast keeps venom as a boss-combat mechanic, not a passive contact hazard
 * on ordinary fish and creatures.
 */
(function(){
  'use strict';
  var D=window.GAMEDATA;
  if(!D)return;

  var fish=D.FISH||[];
  for(var i=0;i<fish.length;i++){
    var f=fish[i];
    if(f&&f.venom&&!f.areaBoss) f.venom=false;
  }

  if(D.UPGRADES&&D.UPGRADES.gloves){
    D.UPGRADES.gloves.name='Venom Guard Gloves';
    D.UPGRADES.gloves.desc='Reinforced gloves that blunt venom from dangerous boss attacks. Higher levels reduce poison damage; max level blocks it completely.';
    D.UPGRADES.gloves.unit='boss venom';
  }

  window.RECAST_BOSS_VENOM_ONLY=true;
})();