/* Deep Sea Diver: Recast — shiny consistency pass
 * Shinies follow Pokemon-style logic: same species, stable alternate palette.
 * This wrapper deliberately suppresses the old literal sparkle/glow treatment
 * and feeds the Recast creature renderer an authored palette swap instead.
 */
(function(){
  'use strict';

  function install(){
    if(!window.SPRITES||window.SPRITES.__recastShiny)return false;
    var S=window.SPRITES,priorDraw=S.draw;

    var PALETTES=[
      ['#ffd36b','#7b2cff'],['#9cf5d5','#ff5f91'],['#ff8fcf','#4b4dff'],
      ['#e8f1ff','#ff7a45'],['#22263a','#ff3b6d'],['#75e6ff','#5b35b5'],
      ['#c4ff6b','#2d7d69'],['#ffb45e','#2449c9'],['#f3e3ff','#7d3b8f'],
      ['#9fb4ff','#ffd84f'],['#ff746b','#4de0c1'],['#d8fff4','#7b5cff']
    ];

    function hash(s){var h=2166136261>>>0;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
    function palette(arch,o){
      var key=arch+'|'+(o.color||'')+'|'+(o.accent||'');
      var p=PALETTES[hash(key)%PALETTES.length];
      return {color:p[0],accent:p[1]};
    }

    S.draw=function(ctx,arch,x,y,opts){
      opts=opts||{};
      if(!opts.shiny)return priorDraw.call(S,ctx,arch,x,y,opts);
      var local={};for(var k in opts)local[k]=opts[k];
      var p=palette(arch,opts);
      local.color=p.color;
      local.accent=p.accent;
      local.shiny=false;              // prevents literal glow/star effects below
      local.recastShiny=true;         // semantic marker for future art passes
      return priorDraw.call(S,ctx,arch,x,y,local);
    };

    S.__recastShiny=true;
    window.RECAST_SHINY_RULE='alternate-palette';
    return true;
  }

  if(!install())setTimeout(install,0);
})();
