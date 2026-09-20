/* Recast gameplay smoke: venom belongs to bosses, not ordinary catches. */
"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path");
const root=path.join(__dirname,"..");
const ctx={console};ctx.window=ctx;vm.createContext(ctx);
function run(file){vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),ctx,{filename:file});}
run("js/data.js");
const before=(ctx.GAMEDATA.FISH||[]).filter(f=>f&&f.venom).map(f=>f.id);
if(!before.length)throw new Error("Fixture error: expected authored venom entries before Recast override");
run("js/recast-gameplay.js");
const D=ctx.GAMEDATA,venom=(D.FISH||[]).filter(f=>f&&f.venom);
const ordinary=venom.filter(f=>!f.areaBoss);
if(ordinary.length)throw new Error("Ordinary catches still venomous: "+ordinary.map(f=>f.id).join(", "));
const bossVenom=venom.filter(f=>f.areaBoss);
if(!bossVenom.length)throw new Error("Boss venom was accidentally removed");
if(!bossVenom.some(f=>f.id==="alienoverlord"))throw new Error("Xenofish boss venom was not preserved");
if(!ctx.RECAST_BOSS_VENOM_ONLY)throw new Error("Boss-only venom rule flag missing");
if(!D.UPGRADES||!D.UPGRADES.gloves||!/boss/i.test(D.UPGRADES.gloves.desc||""))throw new Error("Glove description does not explain boss venom protection");
console.log("Recast gameplay smoke passed: normal venom removed; boss venom preserved for "+bossVenom.map(f=>f.name).join(", ")+".");
