/* ===========================================================================
 * Deep Sea Diver — Game Data
 * All static content: fish, treasures, shop items, locations, rarity config.
 * Exposed on window.GAMEDATA so plain <script> tags work from file://.
 * ======================================================================== */
(function () {
  "use strict";

  // --- Rarity tiers ------------------------------------------------------
  // weight = base spawn weight at the surface. Higher = more common.
  // valueMul scales a fish's listed value is already absolute, this is just
  // for reference/labels.
  const RARITY = {
    common:    { name: "Common",    weight: 1000, color: "#9fb4c4", order: 0 },
    uncommon:  { name: "Uncommon",  weight: 360,  color: "#6dd36d", order: 1 },
    rare:      { name: "Rare",      weight: 110,  color: "#4aa3ff", order: 2 },
    epic:      { name: "Epic",      weight: 28,   color: "#b96bff", order: 3 },
    legendary: { name: "Legendary", weight: 6,    color: "#ffb22e", order: 4 },
    mythic:    { name: "Mythic",    weight: 1,    color: "#ff5b7f", order: 5 },
  };

  // --- Locations ---------------------------------------------------------
  // depth is in "meters" used by the gameplay (world pixels = meters * PXPM).
  // Listed in intended unlock order (cheaper + shallower first, ramping to the
  // deepest). The menu and Collection iterate this object, so order = progression.
  const LOCATIONS = {
    coral: {
      id: "coral", name: "Coral Coast", tint: "#ff8a5c",
      blurb: "Sun-dappled shallows bursting with colour. A gentle place to start.",
      maxDepth: 280, worldWidth: 2400, topColor: "#39c4d6", deepColor: "#063a6b",
      shinyBonus: 0, unlocked: true, cost: 0,
      sky: { top: "#9fd8ff", bottom: "#e6f7ff" },
    },
    river: {
      id: "river", name: "River Run", tint: "#5fc46a",
      blurb: "A bright freshwater river winding between the coast and the kelp — trout, pike, catfish and more.",
      maxDepth: 220, worldWidth: 2200, topColor: "#4a9ec4", deepColor: "#143a2a",
      shinyBonus: 0, unlocked: false, cost: 1500,
      sky: { top: "#bfe8ff", bottom: "#eafce0" },
    },

    forest: {
      id: "forest", name: "Tidal Grove", tint: "#5fae4a",
      blurb: "A drowned old-growth forest — sun filters through towering submerged trees draped in green.",
      maxDepth: 600, worldWidth: 2600, topColor: "#3f8f5a", deepColor: "#0a2415",
      shinyBonus: 0, unlocked: false, cost: 3000,
      sky: { top: "#bfe8c0", bottom: "#eafce0" },
    },
    cave: {
      id: "cave", name: "Gloom Cavern", tint: "#8a7ad0",
      blurb: "A creepy flooded cavern where every kind of sea creature gathers — drifting freely in the dark. Something huge skitters below.",
      maxDepth: 800, worldWidth: 2600, topColor: "#2a3340", deepColor: "#04050a",
      shinyBonus: 0.12, unlocked: false, cost: 3800,
      caveArea: true, creaturePool: true,
      sky: { top: "#1a2230", bottom: "#0a0e16" },
    },

    kelp: {
      id: "kelp", name: "Kelp Forest", tint: "#2fb59a",
      blurb: "Towering green columns hide clever, slippery creatures.",
      maxDepth: 520, worldWidth: 2600, topColor: "#2f9e8f", deepColor: "#04332f",
      shinyBonus: 0, unlocked: false, cost: 4500,
      sky: { top: "#9fb6b0", bottom: "#d6e6dc" },
    },

    arctic: {
      id: "arctic", name: "Arctic Shelf", tint: "#8fd0f0",
      blurb: "Frigid water beneath the ice. Belugas, narwhals and pale giants drift through the cold.",
      maxDepth: 700, worldWidth: 2600, topColor: "#6fb0d0", deepColor: "#08243a",
      shinyBonus: 0, unlocked: false, cost: 20000, smoke: true, fog: true, cold: true,
      sky: { top: "#d4ebf7", bottom: "#f0f9ff" },
    },
    desert: {
      id: "desert", name: "Buried Dunes", tint: "#e0c068",
      blurb: "A drowned desert of rippling sand dunes and half-buried ruins — rays glide low over the seabed while sand-lurkers wait below.",
      maxDepth: 650, worldWidth: 2700, topColor: "#3aa6c4", deepColor: "#3a2e14",
      shinyBonus: 0, unlocked: false, cost: 34000,
      sky: { top: "#ffe9b0", bottom: "#fff6e0" },
    },
    opensea: {
      id: "opensea", name: "Open Sea", tint: "#2f8fe0",
      blurb: "Endless blue with no land in sight — giant pelagic wanderers cruise the open water.",
      maxDepth: 850, worldWidth: 2800, topColor: "#1f7fc4", deepColor: "#04204a",
      shinyBonus: 0, unlocked: false, cost: 48000,
      sky: { top: "#aee0ff", bottom: "#e8f6ff" },
    },
    ancient: {
      id: "ancient", name: "Fossil Abyss", tint: "#c79a52",
      blurb: "A primordial sea sealed in the deep, where prehistoric monsters never went extinct.",
      maxDepth: 1000, worldWidth: 2600, topColor: "#5e7050", deepColor: "#160f04",
      shinyBonus: 0, unlocked: false, cost: 95000,
      sky: { top: "#cdbb8a", bottom: "#ece0c0" },
    },
    prism: {
      id: "prism", name: "Prism Reef", tint: "#ff7ad0",
      blurb: "A kaleidoscopic coral garden ablaze with colour — and a master of disguise hiding in plain sight.",
      maxDepth: 420, worldWidth: 2600, topColor: "#2fc0d0", deepColor: "#1a3a7a",
      shinyBonus: 0, unlocked: false, cost: 12000,
      sky: { top: "#bff0ff", bottom: "#ffe6fb" },
    },
    swamp: {
      id: "swamp", name: "Mangrove Swamp", tint: "#7a8a3a",
      blurb: "Murky brackish water thick with roots and gators. Watch the shallows.",
      maxDepth: 500, worldWidth: 2400, topColor: "#5a6a3a", deepColor: "#16200c",
      shinyBonus: 0, unlocked: false, cost: 210000,
      sky: { top: "#aebf8a", bottom: "#d6e0b0" },
    },
    boneyard: {
      id: "boneyard", name: "The Boneyard", tint: "#d8d2c0", cold: true,
      blurb: "A vast, frigid whale-fall graveyard where titans came to die. Bones glow pale in the gloom — and the cold burns your air without a Cold Suit.",
      maxDepth: 1200, worldWidth: 2600, topColor: "#3a4450", deepColor: "#05070a",
      shinyBonus: 0, unlocked: false, cost: 290000,
      sky: { top: "#8a96a4", bottom: "#cdd6de" },
    },
    storm: {
      id: "storm", name: "Stormy Seas", tint: "#6a7a9a", storm: true,
      blurb: "Black thunderheads, towering swells and forks of lightning — only the bold dive here.",
      maxDepth: 700, worldWidth: 2800, topColor: "#2a3a4a", deepColor: "#060a14",
      shinyBonus: 0, unlocked: false, cost: 330000,
      sky: { top: "#262a36", bottom: "#454c5e" },
    },
    mountain: {
      id: "mountain", name: "Sunlit Peaks", tint: "#8a9aae", peaks: true,
      blurb: "Submerged mountain crags climbing toward the light — high ridges, deep ravines and crystal-clear water.",
      maxDepth: 900, worldWidth: 3000, topColor: "#6a8aa8", deepColor: "#16202a",
      shinyBonus: 0, unlocked: false, cost: 260000,
      sky: { top: "#bcd6ee", bottom: "#e8f2fa" },
    },
    olympus: {
      id: "olympus", name: "Olympus Aerie", tint: "#ffe07a", secret: true,
      blurb: "Above the clouds atop the highest peak — a golden realm of the gods, where Poseidon's own steed swims the sky-sea.",
      maxDepth: 600, worldWidth: 2800, topColor: "#bfe0ff", deepColor: "#7a8ad0",
      shinyBonus: 0, unlocked: false, cost: 0,
      sky: { top: "#fff6d8", bottom: "#cfe0ff" },
    },
    ashen: {
      id: "ashen", name: "Magma Vents", tint: "#e0552a", smoke: true, hot: true,
      blurb: "A drowned volcanic vent — black water lit by lava, choked with drifting ash and smoke. Without a Heat Suit the heat burns through your oxygen.",
      maxDepth: 700, worldWidth: 2600, topColor: "#3a2218", deepColor: "#0a0402",
      shinyBonus: 0, unlocked: false, cost: 200000,
      sky: { top: "#3a2a20", bottom: "#1a0e08" },
    },
    pirate: {
      id: "pirate", name: "Drowned Cove", tint: "#caa14a", secret: true, hot: true,
      blurb: "A pirates' graveyard of sunken galleons and cursed gold, steaming over a vent of black volcanic water — and things that should have stayed buried. A Heat Suit spares your oxygen.",
      maxDepth: 800, worldWidth: 2800, topColor: "#1a2a3a", deepColor: "#04060a",
      shinyBonus: 0, unlocked: false, cost: 0,
      sky: { top: "#2a2e3a", bottom: "#454c5e" },
    },
    backrooms: {
      id: "backrooms", name: "The Backrooms", tint: "#d8c84a", secret: true,
      blurb: "You weren't supposed to find this. Endless damp yellow rooms, humming lights, water that shouldn't be here.",
      maxDepth: 700, worldWidth: 3000, topColor: "#c8b84a", deepColor: "#5a5018",
      shinyBonus: 0, unlocked: false, cost: 0,
      sky: { top: "#d8c860", bottom: "#b8a838" },
    },
    japan: {
      id: "japan", name: "Ornate Ocean", tint: "#e0556a", secret: true,
      blurb: "A hidden koi-filled coast beneath red torii gates, drifting with cherry blossom — and something colossal sleeping offshore.",
      maxDepth: 900, worldWidth: 2800, topColor: "#3a6fb0", deepColor: "#0a1a3a",
      shinyBonus: 0, unlocked: false, cost: 0,
      sky: { top: "#ffd6e0", bottom: "#ffeef2" },
    },
    secretcave: {
      id: "secretcave", name: "Hollow Deep", tint: "#9a8ad0", secret: true,
      blurb: "A still, lightless pocket of the cavern that only opens to those who arrive unarmed by boss relics.",
      maxDepth: 700, worldWidth: 2200, topColor: "#26303a", deepColor: "#03040a",
      shinyBonus: 0, unlocked: false, cost: 0,
      sky: { top: "#1a2230", bottom: "#0a0e16" },
    },
    oilrig: {
      id: "oilrig", name: "The Oil Rig", tint: "#caa14a", secret: true,
      blurb: "A black sea of crude beneath a derelict rig — where rusted machines and salvage-bots still swim.",
      maxDepth: 800, worldWidth: 2800, topColor: "#2a2418", deepColor: "#050402",
      shinyBonus: 0, unlocked: false, cost: 0,
      sky: { top: "#3a3320", bottom: "#1a160a" },
    },
    flooded: {
      id: "flooded", name: "Flooded Freighter", tint: "#3a8a6a", secret: true,
      blurb: "The black, silt-choked hold of a sunken cargo ship. Skittish things dart between the containers, shying away from any diver's light — and something with reaching jaws stalks the dark.",
      maxDepth: 800, worldWidth: 2600, topColor: "#1a2e2a", deepColor: "#03070a",
      shinyBonus: 0, unlocked: false, cost: 0,
      sky: { top: "#1a2622", bottom: "#0a120e" },
    },
    cloud: {
      id: "cloud", name: "Cloud Reaches", tint: "#bfe0ff",
      blurb: "Climb above the waves into a dreamlike sky and catch the birds themselves. Shinies bloom thick up here.",
      maxDepth: 600, worldWidth: 2600, topColor: "#bfe8ff", deepColor: "#6f9fd0",
      shinyBonus: 0.2, unlocked: false, cost: 430000,
      airArea: true, birdPool: true, requireAllBirds: true,
      sky: { top: "#cdeeff", bottom: "#eaf8ff" },
    },
    trench: {
      id: "trench", name: "Sunken Trench", tint: "#5a6cff",
      blurb: "The deepest, final frontier — a crushing abyss where the Kraken itself waits.",
      maxDepth: 1400, worldWidth: 2600, topColor: "#13496e", deepColor: "#01040c",
      shinyBonus: 0, unlocked: false, cost: 1500000,
      requireAreas: ["river", "kelp", "arctic", "ancient", "opensea"], // always the last to unlock
      sky: { top: "#86b4d4", bottom: "#cfe8f2" },
    },
    sanctuary: {
      id: "sanctuary", name: "Starlight Sanctuary", tint: "#b07bff",
      blurb: "A post-game paradise where EVERY creature in the sea gathers — and shinies bloom like stars.",
      maxDepth: 900, worldWidth: 2600, topColor: "#5a3ea8", deepColor: "#0a0226",
      shinyBonus: 0.25, starfield: true, allContent: true, unlocked: false, cost: 900000,
      requireBosses: true, // only buyable once the Kraken & blobfish are both caught
      sky: { top: "#160b32", bottom: "#3a2a6a", night: true },
    },
  };

  // --- Fish --------------------------------------------------------------
  // shape drives how it is drawn. size = inventory slots it occupies.
  // minDepth = won't appear above this depth (deeper = rarer fish gate).
  // value = sale price (shiny multiplies this).
  const FISH = [
    // ---- Coral Coast ----
    { id: "clownfish",  name: "Clownfish",   area: "coral", rarity: "common",   size: 1, value: 18,  minDepth: 0,   color: "#ff7a18", shape: "clownfish" },
    { id: "cod",        name: "Cod",         area: "coral", rarity: "common",   size: 1, value: 22,  minDepth: 0,   color: "#bda079", shape: "codfish" },
    { id: "seabass",    name: "Sea Bass",    area: "coral", rarity: "common",   size: 1, value: 26,  minDepth: 20,  color: "#8fa6b0", shape: "perch" },
    { id: "angelfish",  name: "Angelfish",   area: "coral", rarity: "uncommon", size: 1, value: 70,  minDepth: 40,  color: "#ffd84a", shape: "tang" },
    { id: "parrotfish", name: "Parrotfish",  area: "coral", rarity: "uncommon", size: 2, value: 95,  minDepth: 60,  color: "#36d6a0", shape: "parrotfish" },
    { id: "pufferfish", name: "Pufferfish",  area: "coral", rarity: "uncommon", size: 2, value: 110, minDepth: 80,  color: "#c8d24a", shape: "puffer" },
    { id: "lionfish",   name: "Lionfish",    area: "coral", rarity: "rare",     size: 2, value: 240, minDepth: 120, color: "#e0533a", shape: "lionfish" },
    { id: "seaturtle",  name: "Sea Turtle",  area: "coral", rarity: "rare",     size: 3, value: 320, minDepth: 100, color: "#4f9e5e", shape: "turtle" },
    { id: "reefshark",  name: "Reef Shark",  area: "coral", rarity: "epic",     size: 4, value: 900, minDepth: 180, color: "#7d93a3", shape: "shark" },

    // ---- Kelp Forest ----
    { id: "mackerel",   name: "Mackerel",    area: "kelp", rarity: "common",   size: 1, value: 28,   minDepth: 0,   color: "#5fa8c4", shape: "mackerel" },
    { id: "herring",    name: "Herring",     area: "kelp", rarity: "common",   size: 1, value: 30,   minDepth: 20,  color: "#aebfc9", shape: "sardine" },
    { id: "seahorse",   name: "Seahorse",    area: "kelp", rarity: "uncommon", size: 1, value: 85,   minDepth: 40,  color: "#e6a13c", shape: "seahorse" },
    { id: "seaotter",   name: "Sea Otter",   area: "kelp", rarity: "uncommon", size: 2, value: 130,  minDepth: 30,  color: "#8a5a32", shape: "otter" },
    { id: "morayeel",   name: "Moray Eel",   area: "kelp", rarity: "rare",     size: 2, value: 270,  minDepth: 150, color: "#5c7a3a", shape: "eel" },
    { id: "octopus",    name: "Octopus",     area: "kelp", rarity: "rare",     size: 3, value: 360,  minDepth: 180, color: "#c05f8f", shape: "octopus" },
    { id: "giantsquid", name: "Giant Squid", area: "kelp", rarity: "epic",     size: 5, value: 1300, minDepth: 360, color: "#d06a5a", shape: "giantsquid" },

    // ---- Open water (appears in coral/kelp/trench mid depths) ----
    { id: "tuna",       name: "Bluefin Tuna", area: "kelp",   rarity: "rare",     size: 3, value: 300,  minDepth: 120, color: "#3a6fb0", shape: "tuna" },
    { id: "swordfish",  name: "Swordfish",    area: "trench", rarity: "rare",     size: 4, value: 420,  minDepth: 120, color: "#4a6678", shape: "sword" },
    { id: "manta",      name: "Manta Ray",    area: "trench", rarity: "epic",     size: 5, value: 1100, minDepth: 220, color: "#2c3e57", shape: "manta" },
    { id: "hammerhead", name: "Hammerhead",   area: "trench", rarity: "epic",     size: 5, value: 1250, minDepth: 300, color: "#6e8290", shape: "hammer" },

    // ---- Sunken Trench (deep) ----
    { id: "lanternfish", name: "Lanternfish",  area: "trench", rarity: "common",   size: 1, value: 40,   minDepth: 100, color: "#7fa0c0", shape: "lantern" },
    { id: "hatchetfish", name: "Hatchetfish",  area: "trench", rarity: "uncommon", size: 1, value: 120,  minDepth: 200, color: "#cfd6e0", shape: "hatchetfish" },
    { id: "anglerfish",  name: "Anglerfish",   area: "trench", rarity: "uncommon", size: 2, value: 160,  minDepth: 300, color: "#283b2f", shape: "angler" },
    { id: "viperfish",   name: "Viperfish",    area: "trench", rarity: "rare",     size: 2, value: 380,  minDepth: 400, color: "#3a4a55", shape: "eel" },
    { id: "gulpereel",   name: "Gulper Eel",   area: "trench", rarity: "rare",     size: 3, value: 460,  minDepth: 500, color: "#241f33", shape: "glowworm" },
    { id: "frilledshark",name: "Frilled Shark",area: "trench", rarity: "epic",     size: 5, value: 1500, minDepth: 600, color: "#4a3f4f", shape: "helicoprion" },
    { id: "colossalsquid",name:"Colossal Squid",area:"trench", rarity: "legendary",size: 7, value: 4200, minDepth: 800, color: "#b03c5a", shape: "squid" },
    { id: "spermwhale",  name: "Sperm Whale",  area: "trench", rarity: "legendary",size: 8, value: 5200, minDepth: 700, color: "#5a5f6b", shape: "spermwhale" },
    { id: "greatwhite",  name: "Great White Shark", area: "trench", rarity: "legendary", size: 8, value: 6800, minDepth: 850, color: "#8a97a0", shape: "shark" },

    // ---- Starlight Sanctuary ----
    { id: "starjelly",   name: "Starlight Jelly", area: "sanctuary", rarity: "common",   size: 1, value: 60,   minDepth: 0,   color: "#9fd8ff", shape: "jelly" },
    { id: "aurorafish",  name: "Aurora Fish",     area: "sanctuary", rarity: "uncommon", size: 1, value: 150,  minDepth: 60,  color: "#7affd0", shape: "tang" },
    { id: "cosmicray",   name: "Cosmic Ray",      area: "sanctuary", rarity: "rare",     size: 4, value: 520,  minDepth: 150, color: "#7a5cff", shape: "ray" },
    { id: "nebulaeel",   name: "Nebula Eel",      area: "sanctuary", rarity: "rare",     size: 3, value: 560,  minDepth: 220, color: "#c46bff", shape: "eel" },
    { id: "prismtang",   name: "Prismatic Tang",  area: "sanctuary", rarity: "epic",     size: 2, value: 1400, minDepth: 300, color: "#ff8be0", shape: "butterflyfish" },
    { id: "galaxywhale", name: "Galaxy Whale",    area: "sanctuary", rarity: "legendary",size: 8, value: 6000, minDepth: 500, color: "#3a2c78", shape: "galaxywhale" },

    // ======== Wave 2 content: +5 per area ========
    // ---- Coral Coast ----
    { id: "damselfish", name: "Damselfish",   area: "coral", rarity: "common",   size: 1, value: 24,  minDepth: 0,   color: "#3a7bd5", shape: "guppy" },
    { id: "butterflyfish", name: "Butterflyfish", area: "coral", rarity: "uncommon", size: 1, value: 72, minDepth: 30, color: "#ffcf3a", shape: "butterflyfish" },
    { id: "moorishidol", name: "Moorish Idol", area: "coral", rarity: "uncommon", size: 1, value: 90,  minDepth: 50,  color: "#f0e6c8", shape: "moorishidol" },
    { id: "triggerfish", name: "Triggerfish",  area: "coral", rarity: "rare",     size: 2, value: 230, minDepth: 90,  color: "#2f8f7a", shape: "triggerfish" },
    { id: "sandtiger",  name: "Sand Tiger Shark", area: "coral", rarity: "epic",  size: 4, value: 1000, minDepth: 150, color: "#9aa6ad", shape: "megalodon" },

    // ---- Kelp Forest ----
    { id: "kelpfish",   name: "Kelpfish",      area: "kelp", rarity: "common",   size: 1, value: 30,  minDepth: 0,   color: "#5a8f3a", shape: "fish" },
    { id: "rockfish",   name: "Rockfish",      area: "kelp", rarity: "common",   size: 2, value: 44,  minDepth: 40,  color: "#b05a4a", shape: "perch" },
    { id: "garibaldi",  name: "Garibaldi",     area: "kelp", rarity: "uncommon", size: 1, value: 95,  minDepth: 30,  color: "#ff7a18", shape: "tang" },
    { id: "wolfeel",    name: "Wolf Eel",      area: "kelp", rarity: "rare",     size: 3, value: 340, minDepth: 180, color: "#6a6a5a", shape: "glowworm" },
    { id: "sunfish",    name: "Ocean Sunfish", area: "kelp", rarity: "epic",     size: 6, value: 1500, minDepth: 220, color: "#9fb4c4", shape: "mola" },

    // ---- Sunken Trench ----
    { id: "barreleye",  name: "Barreleye",     area: "trench", rarity: "uncommon", size: 1, value: 150, minDepth: 250, color: "#2a3a44", shape: "barreleye", glow: true },
    { id: "dumbo",      name: "Dumbo Octopus", area: "trench", rarity: "rare",     size: 3, value: 480, minDepth: 520, color: "#c06a8a", shape: "octopus" },
    { id: "fangtooth",  name: "Fangtooth",     area: "trench", rarity: "rare",     size: 1, value: 360, minDepth: 600, color: "#3a3a44", shape: "fangtooth" },
    { id: "oarfish",    name: "Giant Oarfish", area: "trench", rarity: "legendary",size: 8, value: 5600, minDepth: 700, color: "#cfd6e0", shape: "oarfish" },

    // ---- Starlight Sanctuary ----
    { id: "moonfish",   name: "Moonfish",      area: "sanctuary", rarity: "common",   size: 1, value: 64,  minDepth: 0,   color: "#cfe6ff", shape: "round" },
    { id: "cometfish",  name: "Comet Fish",    area: "sanctuary", rarity: "uncommon", size: 2, value: 160, minDepth: 60,  color: "#9fd8ff", shape: "guppy" },
    { id: "astraljelly",name: "Astral Jelly",  area: "sanctuary", rarity: "rare",     size: 1, value: 540, minDepth: 140, color: "#c46bff", shape: "clione" },
    { id: "solarray",   name: "Solar Ray",     area: "sanctuary", rarity: "epic",     size: 5, value: 1500, minDepth: 320, color: "#ffd86b", shape: "manta" },
    { id: "voidwhale",  name: "Void Whale",    area: "sanctuary", rarity: "legendary",size: 8, value: 6400, minDepth: 520, color: "#2a2350", shape: "voidwhale" },

    // ======== River Run (zone built later — fish data is ready) ========
    { id: "rivertrout", name: "River Trout",   area: "river", rarity: "common",   size: 1, value: 26,  minDepth: 0,   color: "#8a9a5a", shape: "fish" },
    { id: "perch",      name: "Perch",         area: "river", rarity: "common",   size: 1, value: 30,  minDepth: 10,  color: "#5a7a3a", shape: "mackerel" },
    { id: "salmon",     name: "Salmon",        area: "river", rarity: "uncommon", size: 2, value: 90,  minDepth: 20,  color: "#e07a6a", shape: "salmon" },
    { id: "catfish",    name: "Catfish",       area: "river", rarity: "uncommon", size: 2, value: 110, minDepth: 40,  color: "#6a5a4a", shape: "catfish" },
    { id: "pike",       name: "Pike",          area: "river", rarity: "rare",     size: 3, value: 260, minDepth: 60,  color: "#4a6a4a", shape: "pike" },
    { id: "rivereel",   name: "River Eel",     area: "river", rarity: "rare",     size: 2, value: 300, minDepth: 80,  color: "#5c6a3a", shape: "eel" },
    { id: "sturgeon",   name: "Sturgeon",      area: "river", rarity: "epic",     size: 5, value: 900, minDepth: 100, color: "#7a8a6a", shape: "sturgeon" },

    // ---- Secret fish (need a purchased hint + a condition; spawn rarely) ----
    // Special catch methods: circle = swim in tight circles · lowOxygen = let
    // your air drop low · fast = move at full speed · still = stay perfectly still.
    { id: "dolphin",    name: "Spinner Dolphin", area: "coral", rarity: "mythic", size: 4, value: 5200, minDepth: 0, color: "#8fb0c4", accent: "#ffffff", shape: "dolphin", secret: true,
      hint: "A playful spinner — it only leaps out to copy you. Swim in tight CIRCLES to call it!",
      condition: { circle: true } },
    { id: "whitesquid", name: "White Squid",   area: "coral", night: true, rarity: "mythic", size: 3, value: 6000, minDepth: 0, color: "#eef2f7", accent: "#bfe9ff", shape: "whitesquid", secret: true, skittish: true,
      hint: "A ghostly pale squid that only drifts out on the darkest nights — and BOLTS the instant you near it. You'll have to chase it down.",
      condition: {} },
    { id: "seaangel",   name: "Sea Angel",     area: "arctic", rarity: "mythic", size: 1, value: 6500, minDepth: 60, color: "#cfe8ff", accent: "#ffd24a", shape: "clione", secret: true,
      hint: "A clione that drifts to divers near their last breath — let your OXYGEN run very low (below 20%).",
      condition: { lowOxygen: true } },
    { id: "sailfish",   name: "Sailfish",      area: "river", rarity: "mythic", size: 4, value: 5800, minDepth: 30, color: "#3a6fb0", accent: "#7affd0", shape: "sword", secret: true,
      hint: "The fastest fish in the sea — it only races into view when YOU are moving at full speed (max fins help!).",
      condition: { fast: true } },
    { id: "stonefish",  name: "Stonefish",     area: "kelp", rarity: "mythic", size: 2, value: 4800, minDepth: 80, color: "#7a6a4a", accent: "#e0533a", shape: "round", secret: true,
      hint: "A master of disguise — hold perfectly STILL on the seabed and it may reveal itself.",
      condition: { still: true } },
    { id: "goldenkoi",  name: "Golden Koi",    area: "coral",     rarity: "mythic", size: 2, value: 2600, minDepth: 0,   color: "#ffd54a", accent: "#fff3b0", shape: "koi",  secret: true,
      hint: "Shimmers only in the brightest shallows of Coral Coast (above 60m). Rare and skittish.",
      condition: { maxDepth: 60 } },
    { id: "leafydragon",name: "Leafy Seadragon",area: "kelp",      rarity: "mythic", size: 2, value: 3000, minDepth: 100,color: "#5fae3a", accent: "#ffd24a", trim: "#d86aff", shape: "seadragon", secret: true,
      hint: "Camouflaged among deep kelp (below 100m). You must be patient and still.",
      condition: { minDepth: 100 } },
    { id: "deeplev",    name: "Deep Leviathan", area: "trench",    rarity: "mythic", size: 9, value: 9000, minDepth: 900,color: "#243a6a", accent: "#5bf0ff", trim: "#9f7bff", shape: "deeplev", secret: true,
      hint: "A colossal sea-serpent coils through the very bottom of the Trench (below 900m). Only the brave reach it.",
      condition: { minDepth: 900 } },
    { id: "celestserp", name: "Astral Serpent",area:"sanctuary",rarity: "mythic", size: 7, value: 12000,minDepth: 400,color: "#b38aff", accent: "#fff3b0", trim: "#7afcff", shape: "celestserp", secret: true,
      hint: "Coils through the deepest starlight (below 400m), woven from the night sky itself.",
      condition: { minDepth: 400 } },
    { id: "rainbowtrout", name: "Rainbow Trout", area: "river", rarity: "mythic", size: 2, value: 3400, minDepth: 0, color: "#ff4d6d", accent: "#7afcff", rainbow: true, shape: "trout", secret: true,
      hint: "A dazzling trout that glints with every colour, darting through bright river shallows (above 40m).",
      condition: { maxDepth: 40 } },
    { id: "rivergiant", name: "River Leviathan", area: "river", rarity: "mythic", size: 8, value: 11000, minDepth: 90, color: "#2f6a4a", accent: "#9fe0a0", trim: "#ffd24a", shape: "rivergiant", secret: true,
      hint: "An enormous serpent said to lurk in the deepest river pools (below 90m).",
      condition: { minDepth: 90 } },

    // ---- The "Kraken" fake-out + the true Kraken ----
    { id: "blobfish",   name: "Blobfish",     area: "trench", rarity: "legendary", size: 6, value: 50, minDepth: 800, color: "#e0909e", shape: "blob",
      isBlob: true },
    { id: "kraken",     name: "The Kraken",   area: "trench", rarity: "legendary", size: 10, value: 25000, minDepth: 1000, color: "#7a1f3d", shape: "kraken",
      isKraken: true,
      hint: "The true legend. It only rises once you have caught 100% of everything in the sea." },

    // ======== Sea-floor Creatures (caught with a Net) — 2 per area ========
    { id: "crab",       name: "Crab",         area: "coral", creature: true, rarity: "common",   size: 1, value: 40,  color: "#d8654a", shape: "crab" },
    { id: "starfish",   name: "Starfish",     area: "coral", creature: true, rarity: "uncommon", size: 1, value: 85,  color: "#ff8f4a", shape: "starfish" },
    { id: "crayfish",   name: "Crayfish",     area: "river", creature: true, rarity: "common",   size: 1, value: 50,  color: "#a04a3a", shape: "lobster" },
    { id: "waterbug",   name: "Water Bug",    area: "river", creature: true, rarity: "uncommon", size: 1, value: 95,  color: "#5a6a3a", accent: "#9fc05a", shape: "insect" },
    { id: "seaurchin",  name: "Sea Urchin",   area: "kelp",  creature: true, rarity: "common",   size: 1, value: 65,  color: "#6a3a7a", shape: "urchin" },
    { id: "lobster",    name: "Lobster",      area: "kelp",  creature: true, rarity: "uncommon", size: 2, value: 170, color: "#9a3a2a", shape: "lobster" },
    { id: "giantisopod",name: "Giant Isopod", area: "trench", creature: true, rarity: "rare",    size: 2, value: 320, color: "#8a8a7a", shape: "bug" },
    { id: "kingcrab",   name: "King Crab",    area: "trench", creature: true, rarity: "rare",    size: 3, value: 460, color: "#b0503a", shape: "crab" },
    { id: "starcrab",   name: "Star Crab",    area: "sanctuary", creature: true, rarity: "rare", size: 2, value: 420, color: "#9f7bff", shape: "crab" },
    { id: "prismstar",  name: "Prism Star",   area: "sanctuary", creature: true, rarity: "epic", size: 1, value: 760, color: "#7affd0", shape: "urchin" },
    // +1 more creature per area (varying rarity)
    { id: "hermitcrab", name: "Hermit Crab",  area: "coral", creature: true, rarity: "rare",      size: 1, value: 320,  color: "#c98a5a", shape: "hermitcrab" },
    { id: "riversnail", name: "River Snail",  area: "river", creature: true, rarity: "common",    size: 1, value: 45,   color: "#7a6a4a", shape: "snail" },
    { id: "abalone",    name: "Abalone",      area: "kelp",  creature: true, rarity: "uncommon",  size: 1, value: 150,  color: "#8a7a9a", shape: "snail" },
    { id: "seacucumber",name: "Sea Cucumber", area: "trench", creature: true, rarity: "rare",     size: 2, value: 380,  color: "#6a4a5a", shape: "ammonite" },
    { id: "voidstar",   name: "Void Star",    area: "sanctuary", creature: true, rarity: "legendary", size: 1, value: 1800, color: "#9f7bff", shape: "starfish" },
    // ---- Clams: prised open with a SHOVEL; some hide a pearl ----
    { id: "clam",       name: "Giant Clam",   area: "coral", creature: true, tool: "shovel", dropsPearl: true, rarity: "uncommon", size: 1, value: 180, color: "#cdbba0", accent: "#fff3e0", shape: "clam" },
    { id: "musselbed",  name: "Mussel",       area: "kelp",  creature: true, tool: "shovel", dropsPearl: true, rarity: "common",   size: 1, value: 120, color: "#5a5a6a", accent: "#cfd6e0", shape: "clam" },
    { id: "deepclam",   name: "Abyss Clam",   area: "trench",creature: true, tool: "shovel", dropsPearl: true, rarity: "rare",     size: 2, value: 520, color: "#7a6a8a", accent: "#e0d6ff", shape: "clam" },
    { id: "openclam",   name: "Pelagic Clam", area: "opensea",creature: true, tool: "shovel", dropsPearl: true, rarity: "common",  size: 2, value: 220, color: "#6a7a8a", accent: "#dfeaff", shape: "clam" },
    // ---- Hollow Deep (the secret cave) — its own creatures + fish ----
    // (Gloom Cavern itself now just gathers all the PRE-EXISTING creatures.)
    { id: "cavefish",   name: "Blind Cavefish", area: "secretcave", rarity: "common",   size: 1, value: 140,  minDepth: 0, color: "#e8dcd0", shape: "fish" },
    { id: "ghostshrimp",name: "Ghost Shrimp",   area: "secretcave", creature: true, rarity: "rare",      size: 1, value: 360,  color: "#cfe0e8", shape: "bug" },
    { id: "cavecrab",   name: "Cave Crab",      area: "secretcave", creature: true, rarity: "uncommon",  size: 2, value: 300,  color: "#7a5a4a", shape: "crab" },
    { id: "glowsnail",  name: "Glow Snail",     area: "secretcave", creature: true, rarity: "epic",      size: 1, value: 900,  color: "#8affc0", shape: "snail" },

    // ======== Nocturnal fish (ONLY appear on night dives) — 2 per area ========
    { id: "lanterneye",  name: "Lantern-eye",      area: "coral",   night: true, rarity: "rare",  size: 2, value: 360,  minDepth: 60,  color: "#2a6a7a", accent: "#7afcff", shape: "lanternjaw" },
    { id: "moonwrasse",  name: "Moon Wrasse",      area: "coral",   night: true, rarity: "uncommon", size: 2, value: 220, minDepth: 0,  color: "#3a5aa0", accent: "#dfe8ff", shape: "moonfish" },
    { id: "nightcat",    name: "Night Catfish",    area: "river",   night: true, rarity: "uncommon", size: 2, value: 240, minDepth: 0,  color: "#5a4a3a", accent: "#cabba0", shape: "dragonfish" },
    { id: "eelpout",     name: "Glimmer Eelpout",  area: "river",   night: true, rarity: "rare",  size: 2, value: 380,  minDepth: 40,  color: "#3a5a4a", accent: "#9fffd0", shape: "glowworm" },
    { id: "vampsquid",   name: "Vampire Squid",    area: "kelp",    night: true, rarity: "epic",  size: 3, value: 1100, minDepth: 150, color: "#5a1f2a", accent: "#ff6f91", shape: "vampsquid" },
    { id: "seamoth",     name: "Sea Moth",         area: "kelp",    night: true, rarity: "rare",  size: 2, value: 420,  minDepth: 60,  color: "#3a6a4a", accent: "#9fe0a0", shape: "seamoth" },
    { id: "frostjelly",  name: "Frost Jelly",      area: "arctic",  night: true, rarity: "rare",  size: 2, value: 460,  minDepth: 40,  color: "#5a8aa8", accent: "#cdeeff", shape: "glowjelly" },
    { id: "icelantern",  name: "Ice Lanternfish",  area: "arctic",  night: true, rarity: "uncommon", size: 1, value: 280, minDepth: 80, color: "#7a90a8", accent: "#dff2ff", shape: "lanternjaw" },
    { id: "fangdragon",  name: "Fang Dragon",      area: "ancient", night: true, rarity: "epic",  size: 3, value: 1300, minDepth: 200, color: "#2a2030", accent: "#ff9a4a", shape: "dragonfish" },
    { id: "ghostray",    name: "Ghost Ray",        area: "ancient", night: true, rarity: "rare",  size: 4, value: 560,  minDepth: 150, color: "#4a3a5a", accent: "#b48bff", shape: "ghostray" },
    { id: "moongazer",   name: "Midnight Stargazer", area: "opensea", night: true, rarity: "rare", size: 3, value: 520, minDepth: 120, color: "#1f3a5a", accent: "#6fd0ff", shape: "stargazer" },
    { id: "moonsquid",   name: "Moon Squid",       area: "opensea", night: true, rarity: "epic",  size: 4, value: 1200, minDepth: 200, color: "#3a2a6a", accent: "#b48bff", shape: "vampsquid" },
    { id: "blackdragon", name: "Black Dragonfish", area: "trench",  night: true, rarity: "epic",  size: 3, value: 1500, minDepth: 500, color: "#16121a", accent: "#3ad0ff", shape: "dragonfish" },
    { id: "deeplantern", name: "Deep Lantern",     area: "trench",  night: true, rarity: "rare",  size: 2, value: 480,  minDepth: 400, color: "#1a2430", accent: "#ffd24a", shape: "lanternjaw" },
    { id: "starmoth",    name: "Star Moth",        area: "sanctuary", night: true, rarity: "epic", size: 2, value: 1600, minDepth: 100, color: "#5a3ea8", accent: "#ff8be0", shape: "seamoth" },
    { id: "lunarjelly",  name: "Lunar Jelly",      area: "sanctuary", night: true, rarity: "rare", size: 2, value: 700, minDepth: 60, color: "#7a6ad0", accent: "#fff3b0", shape: "glowjelly" },

    // ======== Diurnal fish (ONLY appear on day dives) — 2 per area ========
    { id: "sunbasker",   name: "Sun Basker",     area: "coral",   day: true, rarity: "uncommon", size: 2, value: 200, minDepth: 0,  color: "#ffd24a", accent: "#fff3b0", shape: "mahimahi" },
    { id: "daygoby",     name: "Dawn Goby",      area: "coral",   day: true, rarity: "common",   size: 1, value: 90,  minDepth: 0,  color: "#ff9a4a", accent: "#fff0c0", shape: "fish" },
    { id: "sunperch",    name: "Sun Perch",      area: "river",   day: true, rarity: "uncommon", size: 1, value: 180, minDepth: 0,  color: "#f0b53a", accent: "#fff0c0", shape: "perch" },
    { id: "glintminnow", name: "Glint Minnow",   area: "river",   day: true, rarity: "common",   size: 1, value: 80,  minDepth: 0,  color: "#9fe0c0", accent: "#ffffff", shape: "longfish" },
    { id: "kelpdarter",  name: "Kelp Darter",    area: "kelp",    day: true, rarity: "rare",     size: 2, value: 360, minDepth: 40, color: "#6cae4a", accent: "#dfffb0", shape: "pike" },
    { id: "sunwrasse",   name: "Sun Wrasse",     area: "kelp",    day: true, rarity: "uncommon", size: 1, value: 210, minDepth: 20, color: "#ffb24a", accent: "#fff0c0", shape: "butterflyfish" },
    { id: "icebasker",   name: "Ice Basker",     area: "arctic",  day: true, rarity: "rare",     size: 3, value: 420, minDepth: 40, color: "#cdeeff", accent: "#ffffff", shape: "perch" },
    { id: "snowjack",    name: "Snow Jack",      area: "arctic",  day: true, rarity: "uncommon", size: 2, value: 240, minDepth: 20, color: "#dfeef7", accent: "#bcd0dc", shape: "mackerel" },
    { id: "sundialfish", name: "Sundial Fish",   area: "ancient", day: true, rarity: "rare",     size: 3, value: 460, minDepth: 80, color: "#c79a52", accent: "#ffe14d", shape: "flatfish" },
    { id: "amberray",    name: "Amber Ray",      area: "ancient", day: true, rarity: "epic",     size: 4, value: 1100,minDepth: 150,color: "#d8a24a", accent: "#fff0c0", shape: "ray" },
    { id: "sunfintuna",  name: "Sunfin Tuna",    area: "opensea", day: true, rarity: "rare",     size: 4, value: 520, minDepth: 80, color: "#3a8fd0", accent: "#ffe14d", shape: "tuna" },
    { id: "goldenmola",  name: "Golden Mola",    area: "opensea", day: true, rarity: "epic",     size: 5, value: 1300,minDepth: 120,color: "#e0b24a", accent: "#fff3b0", shape: "moonfish" },
    { id: "glarefish",   name: "Glare Fish",     area: "trench",  day: true, rarity: "rare",     size: 2, value: 480, minDepth: 300,color: "#7fa0c0", accent: "#ffffff", shape: "stargazer" },
    { id: "prismcod",    name: "Prism Cod",      area: "trench",  day: true, rarity: "uncommon", size: 2, value: 260, minDepth: 200,color: "#bcd0e0", accent: "#fff0c0", shape: "codfish" },
    { id: "solartang",   name: "Solar Tang",     area: "sanctuary", day: true, rarity: "epic",   size: 2, value: 1500,minDepth: 100,color: "#ffd24a", accent: "#fff3b0", shape: "moorishidol" },
    { id: "dawnstar",    name: "Dawn Starfish",  area: "sanctuary", day: true, rarity: "rare",    size: 2, value: 640, minDepth: 60, color: "#ffb24a", accent: "#fff0c0", shape: "ammonite" },

    // ---- one nocturnal bird + one nocturnal sea creature (night only) ----
    { id: "nightowl",   name: "Night Owl",      area: "river", bird: true, night: true, rarity: "rare", size: 2, value: 520, color: "#6a5a4a", accent: "#e0d2b0", shape: "owl", seedCost: 800 },
    { id: "fireflysquid", name: "Firefly Squid", area: "kelp", creature: true, night: true, rarity: "rare", size: 1, value: 420, color: "#3a4a8a", accent: "#7afcff", shape: "clione" },

    // ======== One extra bird + one extra creature per area (varied time) ========
    { id: "coraltern",  name: "Fairy Tern",     area: "coral",   bird: true, rarity: "uncommon", size: 1, value: 160, color: "#eef3f7", accent: "#3a9fd0", shape: "gull", seedCost: 350 },
    { id: "rivermallard",name: "Mallard",       area: "river",   bird: true, day: true, rarity: "common", size: 2, value: 130, color: "#3a7a4a", accent: "#caa15a", shape: "duck", seedCost: 350 },
    { id: "kelpgrebe",  name: "Grebe",          area: "kelp",    bird: true, rarity: "uncommon", size: 1, value: 180, color: "#6a5a4a", accent: "#e0533a", shape: "duck", seedCost: 400 },
    { id: "snowyowl",   name: "Snowy Owl",      area: "arctic",  bird: true, night: true, rarity: "rare", size: 2, value: 560, color: "#eef4f8", accent: "#caa15a", shape: "owl", seedCost: 900 },
    { id: "pterowing",  name: "Pterowing",      area: "ancient", bird: true, day: true, rarity: "rare", size: 3, value: 620, color: "#8a6a4a", accent: "#e0c0a0", shape: "raptor", seedCost: 1200 },
    { id: "shearwater", name: "Shearwater",     area: "opensea", bird: true, rarity: "uncommon", size: 2, value: 280, color: "#4a5560", accent: "#dfe8ee", shape: "seabird", seedCost: 600 },
    { id: "fulmar",     name: "Fulmar",         area: "trench",  bird: true, night: true, rarity: "rare", size: 2, value: 480, color: "#cfd6dc", accent: "#8a96a0", shape: "seabird", seedCost: 900 },
    { id: "woodduck",   name: "Wood Duck",      area: "forest",  bird: true, day: true, rarity: "uncommon", size: 2, value: 320, color: "#3a6a5a", accent: "#e0533a", shape: "duck", seedCost: 700 },
    { id: "egret",      name: "Egret",          area: "swamp",   bird: true, rarity: "rare", size: 2, value: 420, color: "#f0f4f6", accent: "#ffcf3a", shape: "heron", seedCost: 800 },
    { id: "bonevulture",name: "Bone Vulture",   area: "boneyard",bird: true, night: true, rarity: "rare", size: 3, value: 760, color: "#cfc6b4", accent: "#5a5048", shape: "raptor", seedCost: 1500 },
    { id: "redcrane",   name: "Red-Crowned Crane", area: "japan", bird: true, day: true, rarity: "rare", size: 3, value: 820, color: "#f0f4f6", accent: "#e0556a", shape: "crane", seedCost: 1600 },
    { id: "oilgull",    name: "Slick Gull",     area: "oilrig",  bird: true, rarity: "uncommon", size: 2, value: 360, color: "#3a342a", accent: "#caa14a", shape: "gull", seedCost: 700 },
    { id: "cometdove",  name: "Comet Dove",     area: "sanctuary", bird: true, rarity: "epic", size: 1, value: 1400, color: "#cfe6ff", accent: "#ff8be0", shape: "songbird", seedCost: 2400 },
    { id: "cowrie",     name: "Cowrie Snail",   area: "coral",   creature: true, day: true, rarity: "common", size: 1, value: 70, color: "#f0d8c0", accent: "#caa15a", shape: "snail" },
    { id: "mayflynymph",name: "Mayfly Nymph",   area: "river",   creature: true, night: true, rarity: "uncommon", size: 1, value: 150, color: "#5a6a4a", accent: "#aed080", shape: "trilobite" },
    { id: "seaslug",    name: "Sea Slug",       area: "kelp",    creature: true, night: true, rarity: "uncommon", size: 1, value: 180, color: "#c84a8a", accent: "#ffd24a", shape: "slug" },
    { id: "krillswarm", name: "Krill",          area: "arctic",  creature: true, day: true, rarity: "common", size: 1, value: 90, color: "#e09a8a", accent: "#fff0e0", shape: "bug" },
    { id: "trilobug",   name: "Trilobite",      area: "ancient", creature: true, rarity: "uncommon", size: 1, value: 220, color: "#6a5a3a", accent: "#caa15a", shape: "bug" },
    { id: "goosebarnacle",name: "Goose Barnacle", area: "opensea", creature: true, day: true, rarity: "uncommon", size: 1, value: 200, color: "#cfd6dc", accent: "#3a4a55", shape: "urchin" },
    { id: "tubeworm",   name: "Tube Worm",      area: "trench",  creature: true, rarity: "rare", size: 2, value: 380, color: "#e0533a", accent: "#fff0e0", shape: "slug" },
    { id: "forestsnail",name: "Grove Snail",    area: "forest",  creature: true, night: true, rarity: "common", size: 1, value: 110, color: "#6a5a3a", accent: "#aed080", shape: "snail" },
    { id: "swampleech", name: "Leech",          area: "swamp",   creature: true, night: true, rarity: "uncommon", size: 1, value: 160, color: "#3a2a2a", accent: "#7a3a3a", shape: "slug" },
    { id: "bonelouse",  name: "Bone Louse",     area: "boneyard",creature: true, rarity: "uncommon", size: 1, value: 260, color: "#ded6c2", accent: "#8a8474", shape: "bug" },
    { id: "sakurashrimp",name: "Sakura Shrimp", area: "japan",   creature: true, rarity: "rare", size: 1, value: 340, color: "#ffb0c4", accent: "#fff0f4", shape: "lobster" },
    { id: "rustmite",   name: "Rust Mite",      area: "oilrig",  creature: true, day: true, rarity: "common", size: 1, value: 150, color: "#8a5a3a", accent: "#caa14a", shape: "bug" },
    { id: "novasnail",  name: "Nova Snail",     area: "sanctuary", creature: true, night: true, rarity: "rare", size: 1, value: 700, color: "#9f7bff", accent: "#fff3b0", shape: "snail" },
    { id: "barnowl",    name: "Barn Owl",       area: "forest",  bird: true, night: true, rarity: "rare", size: 2, value: 540, color: "#e8dcc8", accent: "#caa15a", shape: "owl", seedCost: 1000 },
    { id: "tawnyowl",   name: "Tawny Owl",      area: "swamp",   bird: true, night: true, rarity: "rare", size: 2, value: 560, color: "#8a6a4a", accent: "#e0c0a0", shape: "owl", seedCost: 1000 },

    // ======== Prism Reef (colourful) ========
    { id: "mandarinfish", name: "Mandarinfish", area: "prism", rarity: "common",   size: 1, value: 200, minDepth: 0,   color: "#2a8ac0", accent: "#ff9a3a", shape: "fish" },
    { id: "neontetra",  name: "Neon Tetra",   area: "prism", rarity: "common",   size: 1, value: 160, minDepth: 0,   color: "#2fd0e0", accent: "#ff3a6a", shape: "guppy" },
    { id: "royalgramma",name: "Royal Gramma", area: "prism", rarity: "uncommon", size: 1, value: 280, minDepth: 20,  color: "#9a3ad0", accent: "#ffe14d", shape: "tang" },
    { id: "flamewrasse",name: "Flame Wrasse", area: "prism", rarity: "uncommon", size: 2, value: 320, minDepth: 40,  color: "#ff5b3a", accent: "#ffe14d", shape: "butterflyfish" },
    { id: "regalangel", name: "Regal Angelfish", area: "prism", rarity: "rare",  size: 2, value: 520, minDepth: 80,  color: "#ffcf3a", accent: "#2a6ac0", shape: "moorishidol" },
    { id: "harlequin",  name: "Harlequin Tusk", area: "prism", rarity: "rare",   size: 3, value: 620, minDepth: 120, color: "#3ac0a0", accent: "#ff5b3a", shape: "triggerfish" },
    { id: "rainbowparrot", name: "Rainbow Parrotfish", area: "prism", rarity: "epic", size: 4, value: 1800, minDepth: 200, color: "#36d6a0", accent: "#ff7ad0", rainbow: true, shape: "parrotfish" },
    // Prism birds (varied time)
    { id: "lorikeet",   name: "Rainbow Lorikeet", area: "prism", bird: true, day: true, rarity: "uncommon", size: 1, value: 240, color: "#2a8ac0", accent: "#ff5b3a", shape: "songbird", seedCost: 600 },
    { id: "sunbird",    name: "Sunbird",      area: "prism", bird: true, rarity: "rare", size: 1, value: 420, color: "#3ac0a0", accent: "#ffcf3a", shape: "finch", seedCost: 900 },
    // Prism clams (prised with the Shovel) — including a brand-new giant clam
    { id: "rainbowclam",name: "Rainbow Clam", area: "prism", creature: true, tool: "shovel", dropsPearl: true, rarity: "uncommon", size: 2, value: 360, color: "#ff7ad0", accent: "#7afcff", shape: "clam" },
    { id: "colossalclam", name: "Colossal Clam", area: "prism", creature: true, tool: "shovel", dropsPearl: true, rarity: "epic", size: 3, value: 1600, color: "#2fd0c0", accent: "#fff0f6", shape: "ammonite" },
    { id: "reefsnail",  name: "Turban Snail", area: "prism", creature: true, rarity: "common", size: 1, value: 120, color: "#caa15a", accent: "#fff0e0", shape: "snail" },
    // the secret camouflaged cuttlefish
    { id: "cuttlefish", name: "Mimic Cuttlefish", area: "prism", rarity: "mythic", size: 2, value: 6500, minDepth: 0, color: "#8a6aa0", accent: "#5bf0ff", trim: "#ff5bd0", shape: "cuttlefish", secret: true, camo: true,
      hint: "A master of disguise that melts into the reef — watch for the faint shimmer that doesn't match the coral.", condition: {} },
    { id: "kingcuttle", name: "The Vanishing King", area: "prism", areaBoss: true, rarity: "mythic", size: 12, value: 26000, minDepth: 150, color: "#8a5ad0", accent: "#ff7ad0", camo: true, shape: "kingcuttle", hp: 5, reward: "" },

    // ======== Sunken Grove (forest) ========
    { id: "grovefish",  name: "Grovefish",    area: "forest", rarity: "common",   size: 1, value: 60,  minDepth: 0,   color: "#6cae4a", shape: "goby" },
    { id: "mossback",   name: "Mossback Turtle", area: "forest", rarity: "uncommon", size: 3, value: 280, minDepth: 40, color: "#4f7a3a", shape: "turtle" },
    { id: "branchpike", name: "Branch Pike",  area: "forest", rarity: "uncommon", size: 2, value: 220, minDepth: 30,  color: "#7a6a3a", shape: "pike" },
    { id: "canopyray",  name: "Canopy Ray",   area: "forest", rarity: "rare",     size: 4, value: 540, minDepth: 120, color: "#5a8a4a", shape: "ray" },
    { id: "willoweel",  name: "Willow Eel",   area: "forest", rarity: "rare",     size: 3, value: 480, minDepth: 180, color: "#3a6a3a", shape: "eel" },
    { id: "ancientcarp",name: "Ancient Carp", area: "forest", rarity: "epic",     size: 5, value: 1500,minDepth: 300, color: "#8a9a4a", shape: "fish" },
    { id: "dappletrout",name: "Dapple Trout", area: "forest", rarity: "common",   size: 2, value: 120, minDepth: 20,  color: "#7aa84a", accent: "#d8e0a0", shape: "trout" },
    { id: "rootperch",  name: "Root Perch",   area: "forest", rarity: "uncommon", size: 2, value: 200, minDepth: 60,  color: "#5a7a3a", accent: "#caa15a", shape: "perch" },
    { id: "bramblemack",name: "Bramble Mackerel", area: "forest", rarity: "uncommon", size: 2, value: 260, minDepth: 100, color: "#4a8a5a", accent: "#bfe0a0", shape: "mackerel" },
    { id: "gladecatfish", name: "Glade Catfish", area: "forest", rarity: "rare",   size: 3, value: 620, minDepth: 180, color: "#6a5a3a", accent: "#9fd05a", shape: "catfish" },
    { id: "grovebeetle",name: "Grove Beetle", area: "forest", creature: true, rarity: "common", size: 1, value: 90, color: "#4a6a2a", accent: "#9fd05a", shape: "insect" },
    { id: "grovewarden",name: "Grove Warden", area: "forest", areaBoss: true, rarity: "mythic", size: 12, value: 14000, minDepth: 200, color: "#3a5a2a", accent: "#9fe0a0", shape: "mosasaur", hp: 4, reward: "" },

    // ======== Mangrove Swamp ========
    { id: "swamppike",  name: "Swamp Pike",   area: "swamp", rarity: "common",   size: 2, value: 70,  minDepth: 0,   color: "#5a6a3a", shape: "perch" },
    { id: "gar",        name: "Alligator Gar",area: "swamp", rarity: "uncommon", size: 3, value: 260, minDepth: 30,  color: "#6a5a3a", shape: "eel" },
    { id: "bullfrogfish",name: "Bullfrog Fish",area: "swamp", rarity: "uncommon", size: 2, value: 200, minDepth: 0,  color: "#6a8a3a", shape: "puffer" },
    { id: "snapper",    name: "Snapping Turtle", area: "swamp", rarity: "rare", size: 3, value: 420, minDepth: 60,   color: "#3a4a2a", shape: "turtle" },
    { id: "mudcat",     name: "Mud Catfish",  area: "swamp", rarity: "rare",     size: 3, value: 480, minDepth: 120, color: "#4a3a2a", shape: "catfish" },
    { id: "swampgator", name: "Baby Gator",   area: "swamp", rarity: "epic",     size: 5, value: 1400,minDepth: 200, color: "#3a4a28", shape: "mosasaur" },
    { id: "swampcrab",  name: "Marsh Crab",   area: "swamp", creature: true, rarity: "common", size: 1, value: 80, color: "#7a5a3a", shape: "crab" },
    { id: "swampcroc",  name: "Swamp Croc",   area: "swamp", areaBoss: true, rarity: "mythic", size: 12, value: 16000, minDepth: 200, color: "#2f3a22", accent: "#aebf6a", shape: "crocodile", hp: 4, reward: "" },

    // ======== The Boneyard ========
    { id: "bonefish",   name: "Bonefish",     area: "boneyard", rarity: "common",   size: 1, value: 110, minDepth: 0,   color: "#e8e2d0", shape: "perch" },
    { id: "ribeel",     name: "Rib Eel",      area: "boneyard", rarity: "uncommon", size: 3, value: 320, minDepth: 80,  color: "#d8d0bc", shape: "eel" },
    { id: "fossilray",  name: "Fossil Ray",   area: "boneyard", rarity: "rare",     size: 4, value: 620, minDepth: 200, color: "#c8c0aa", shape: "ray" },
    { id: "skullsquid", name: "Skull Squid",  area: "boneyard", rarity: "rare",     size: 4, value: 700, minDepth: 300, color: "#e0d8c4", shape: "squid" },
    { id: "marrowshark",name: "Marrow Shark", area: "boneyard", rarity: "epic",     size: 6, value: 2200, minDepth: 400, color: "#d0c8b4", shape: "shark" },
    { id: "wraithwhale",name: "Wraith Whale", area: "boneyard", rarity: "legendary",size: 9, value: 6500, minDepth: 600, color: "#cfd6dc", shape: "wraithwhale" },
    { id: "bonecrab",   name: "Bone Crab",    area: "boneyard", creature: true, rarity: "uncommon", size: 2, value: 280, color: "#ded6c2", shape: "crab" },
    { id: "skeletonshark", name: "Skeleton Shark", area: "boneyard", areaBoss: true, rarity: "mythic", size: 13, value: 22000, minDepth: 300, color: "#f2eede", accent: "#cfc6b0", shape: "skeletonshark", hp: 5, reward: "" },

    // ======== Stormy Seas ========
    { id: "stormjack", name: "Storm Jack",    area: "storm", rarity: "common",   size: 2, value: 180, minDepth: 0,   color: "#5a6a7a", accent: "#cfe0ff", shape: "longfish" },
    { id: "rainfish",  name: "Rainfish",      area: "storm", rarity: "common",   size: 1, value: 150, minDepth: 0,   color: "#7a8a9a", accent: "#dfeaff", shape: "fish" },
    { id: "thunderfish",name: "Thunderfish",  area: "storm", rarity: "uncommon", size: 2, value: 360, minDepth: 40,  color: "#3a4a6a", accent: "#7afcff", shape: "perch" },
    { id: "galeray",   name: "Gale Ray",      area: "storm", rarity: "rare",     size: 4, value: 620, minDepth: 100, color: "#46506a", accent: "#9fd0ff", shape: "ray" },
    { id: "tempesteel",name: "Tempest Eel",   area: "storm", rarity: "rare",     size: 3, value: 560, minDepth: 150, color: "#2a3a5a", accent: "#7afcff", shape: "eel" },
    { id: "maelshark", name: "Maelstrom Shark", area: "storm", rarity: "epic",   size: 6, value: 2400, minDepth: 250, color: "#3a4452", accent: "#bcd6ff", shape: "shark" },
    { id: "stormwhale",name: "Storm Whale",   area: "storm", rarity: "legendary",size: 9, value: 6800, minDepth: 400, color: "#2e3848", accent: "#9fd0ff", shape: "stormwhale" },
    { id: "stormcrab", name: "Storm Crab",    area: "storm", creature: true, rarity: "uncommon", size: 2, value: 280, color: "#4a5566", accent: "#9fd0ff", shape: "crab" },
    { id: "stormpetrel2", name: "Storm Albatross", area: "storm", bird: true, rarity: "rare", size: 3, value: 700, color: "#3a4452", accent: "#dfeaff", shape: "seabird", seedCost: 1200 },
    { id: "stormgull", name: "Squall Gull",   area: "storm", bird: true, night: true, rarity: "uncommon", size: 2, value: 360, color: "#5a6470", accent: "#cfe0ff", shape: "gull", seedCost: 700 },
    { id: "leviathanking", name: "The Leviathan King", area: "storm", areaBoss: true, rarity: "mythic", size: 14, value: 34000, minDepth: 250, color: "#2a3a5a", accent: "#9fd0ff", shape: "leviathanking", hp: 6, reward: "" },

    // ======== Sunlit Peaks (rocky mountain) ========
    { id: "ridgeperch", name: "Ridge Perch",  area: "mountain", rarity: "common",   size: 1, value: 170, minDepth: 0,   color: "#6a7a8a", accent: "#cfe0ee", shape: "perch" },
    { id: "craggoby",   name: "Crag Goby",    area: "mountain", rarity: "common",   size: 1, value: 150, minDepth: 0,   color: "#7a6a5a", accent: "#dfeaf2", shape: "goby" },
    { id: "alpinechar", name: "Alpine Char",  area: "mountain", rarity: "uncommon", size: 2, value: 280, minDepth: 20,  color: "#9a6a7a", accent: "#ffd6e0", shape: "trout" },
    { id: "ravineeel",  name: "Ravine Eel",   area: "mountain", rarity: "uncommon", size: 3, value: 340, minDepth: 60,  color: "#4a5a4a", accent: "#bcd6c0", shape: "eel" },
    { id: "peaktang",   name: "Peak Tang",    area: "mountain", rarity: "uncommon", size: 1, value: 260, minDepth: 30,  color: "#5a8ac0", accent: "#ffe14d", shape: "tang" },
    { id: "graniteray", name: "Granite Ray",  area: "mountain", rarity: "rare",     size: 4, value: 560, minDepth: 120, color: "#6a7280", accent: "#cfe0ee", shape: "ghostray" },
    { id: "cragshark",  name: "Crag Shark",   area: "mountain", rarity: "epic",     size: 6, value: 2400, minDepth: 250,color: "#5a6470", accent: "#dfeaf2", shape: "shark" },
    { id: "summitwhale",name: "Summit Whale", area: "mountain", rarity: "legendary",size: 9, value: 6600, minDepth: 450,color: "#5a6a7a", accent: "#cfe0ee", shape: "whale" },
    { id: "screebug",   name: "Scree Bug",    area: "mountain", creature: true, rarity: "common", size: 1, value: 90, color: "#7a6a5a", accent: "#bcd6c0", shape: "bug" },
    { id: "ridgecrab",  name: "Ridge Crab",   area: "mountain", creature: true, rarity: "uncommon", size: 2, value: 300, color: "#6a7280", accent: "#cfe0ee", shape: "crab" },
    { id: "crageagle",  name: "Crag Eagle",   area: "mountain", bird: true, day: true, rarity: "rare", size: 3, value: 760, color: "#5a4a3a", accent: "#e0c0a0", shape: "raptor", seedCost: 1400 },
    { id: "alpinetern", name: "Alpine Tern",  area: "mountain", bird: true, rarity: "uncommon", size: 1, value: 220, color: "#eef3f7", accent: "#5a8ac0", shape: "gull", seedCost: 500 },
    { id: "stonetitan", name: "Stone Titan",  area: "mountain", areaBoss: true, rarity: "mythic", size: 13, value: 30000, minDepth: 250, color: "#5a6470", accent: "#cfe0ee", shape: "stonetitan", hp: 6, reward: "" },

    // ======== Olympus Aerie (secret, reached from the mountain peak) ========
    { id: "auruscarp",  name: "Aureus Carp",  area: "olympus", rarity: "common",   size: 2, value: 400, minDepth: 0,   color: "#ffd24a", accent: "#fff3b0", shape: "koi" },
    { id: "zephyrfish", name: "Zephyr Fish",  area: "olympus", rarity: "common",   size: 1, value: 360, minDepth: 0,   color: "#cfe0ff", accent: "#ffffff", shape: "fish" },
    { id: "ambrosray",  name: "Ambrosia Ray", area: "olympus", rarity: "uncommon", size: 4, value: 720, minDepth: 60,  color: "#ffe07a", accent: "#fff6d8", shape: "manta" },
    { id: "nectartang", name: "Nectar Tang",  area: "olympus", rarity: "uncommon", size: 1, value: 560, minDepth: 30,  color: "#ffb24a", accent: "#fff3b0", shape: "tang" },
    { id: "aetherjelly",name: "Aether Jelly", area: "olympus", rarity: "uncommon", size: 2, value: 600, minDepth: 20,  color: "#bfe0ff", accent: "#fff6d8", shape: "glowjelly" },
    { id: "goldeneel",  name: "Golden Eel",   area: "olympus", rarity: "rare",     size: 3, value: 980, minDepth: 80,  color: "#e0b24a", accent: "#fff3b0", shape: "eel" },
    { id: "thunderpike",name: "Thunder Pike", area: "olympus", rarity: "rare",     size: 3, value: 1100, minDepth: 120,color: "#cfd6ff", accent: "#ffe14d", shape: "pike" },
    { id: "empyrshark", name: "Empyrean Shark",area: "olympus",rarity: "epic",     size: 6, value: 3200, minDepth: 250,color: "#e0cf8a", accent: "#fff6d8", shape: "shark" },
    { id: "celestcrab", name: "Celestial Crab",area: "olympus",creature: true, rarity: "uncommon", size: 2, value: 520, color: "#ffd24a", accent: "#fff3b0", shape: "crab" },
    { id: "ichordove",  name: "Ichor Dove",   area: "olympus", bird: true, rarity: "rare", size: 2, value: 900, color: "#fff6d8", accent: "#ffd24a", shape: "songbird", seedCost: 2000 },
    { id: "poseidonsteed", name: "Poseidon's Steed", area: "olympus", areaBoss: true, rarity: "mythic", size: 13, value: 40000, minDepth: 200, color: "#2a8ac0", accent: "#ffe07a", shape: "steed", hp: 7, reward: "" },

    // ======== Ashen Hollow (volcanic; needs a Heat Suit) ========
    { id: "emberfish",  name: "Emberfish",    area: "ashen", rarity: "common",   size: 1, value: 180, minDepth: 0,   color: "#e0552a", accent: "#ffcf3a", shape: "fish" },
    { id: "cinderfish", name: "Cinder Dace",  area: "ashen", rarity: "common",   size: 1, value: 160, minDepth: 0,   color: "#8a3a2a", accent: "#ff9a3a", shape: "longfish" },
    { id: "lavadart",   name: "Lava Dart",    area: "ashen", rarity: "uncommon", size: 1, value: 280, minDepth: 0,   color: "#ff5b1a", accent: "#ffe14d", shape: "guppy" },
    { id: "magmaeel",   name: "Magma Eel",    area: "ashen", rarity: "uncommon", size: 3, value: 360, minDepth: 40,  color: "#c0402a", accent: "#ffcf3a", shape: "eel" },
    { id: "pyrejelly",  name: "Pyre Jelly",   area: "ashen", rarity: "uncommon", size: 2, value: 320, minDepth: 30,  color: "#e0552a", accent: "#ffe14d", shape: "glowjelly" },
    { id: "obsidianray",name: "Obsidian Ray", area: "ashen", rarity: "rare",     size: 4, value: 620, minDepth: 120, color: "#2a2226", accent: "#ff5b1a", shape: "ray" },
    { id: "moltentuna", name: "Molten Tuna",  area: "ashen", rarity: "rare",     size: 4, value: 680, minDepth: 150, color: "#a03a2a", accent: "#ffcf3a", shape: "tuna" },
    { id: "ashshark",   name: "Ash Shark",    area: "ashen", rarity: "epic",     size: 6, value: 2600, minDepth: 250,color: "#3a2e2a", accent: "#ff7a3a", shape: "shark" },
    { id: "cindercrab", name: "Cinder Crab",  area: "ashen", creature: true, rarity: "uncommon", size: 2, value: 320, color: "#8a3a2a", accent: "#ffcf3a", shape: "crab" },
    { id: "ashsnail",   name: "Ash Snail",    area: "ashen", creature: true, rarity: "common", size: 1, value: 110, color: "#5a4a44", accent: "#ff9a3a", shape: "snail" },
    { id: "emberhawk",  name: "Ember Hawk",   area: "ashen", bird: true, day: true, rarity: "rare", size: 2, value: 720, color: "#c0402a", accent: "#ffcf3a", shape: "raptor", seedCost: 1200 },
    { id: "cinderboss", name: "Cinder Behemoth", area: "ashen", areaBoss: true, rarity: "mythic", size: 13, value: 30000, minDepth: 250, color: "#5a2a1a", accent: "#ff7a1a", shape: "cinderboss", hp: 6, reward: "" },
    { id: "magmawyrm",  name: "Magma Wyrm",   area: "ashen", secretBoss: true, fromSmoke: true, rarity: "mythic", size: 9, value: 9000, minDepth: 0, color: "#e0401a", accent: "#ffe14d", shape: "magmawyrm", hp: 1, reward: "",
      hint: "Something vast moves inside the ash clouds. Linger in the smoke and it will come for YOU — one harpoon is all it takes, if you're quick." },

    // ======== Drowned Cove (secret pirate location) ========
    { id: "cutlassfish", name: "Cutlassfish",  area: "pirate", rarity: "common",   size: 2, value: 200, minDepth: 0,   color: "#b0b6bc", accent: "#ffcf3a", shape: "longfish" },
    { id: "doubloonfish", name: "Doubloon Fish", area: "pirate", rarity: "common",  size: 1, value: 220, minDepth: 0,   color: "#e0b24a", accent: "#fff3b0", shape: "round" },
    { id: "ghostfish",   name: "Ghostfish",     area: "pirate", rarity: "uncommon", size: 2, value: 380, minDepth: 40,  color: "#9fd0c8", accent: "#ffffff", shape: "guppy" },
    { id: "corsaireel",  name: "Corsair Eel",   area: "pirate", rarity: "rare",     size: 3, value: 620, minDepth: 120, color: "#3a4a3a", accent: "#caa15a", shape: "eel" },
    { id: "pirateshark", name: "Plunderer Shark", area: "pirate", rarity: "epic",   size: 6, value: 2600, minDepth: 250, color: "#3a3a42", accent: "#ffcf3a", shape: "shark" },
    { id: "ghostwhale",  name: "Wraith Galleon Whale", area: "pirate", rarity: "legendary", size: 9, value: 7200, minDepth: 450, color: "#5a6470", accent: "#cfe0c8", shape: "ghostwhale" },
    { id: "peglegcrab",  name: "Peg-Leg Crab",  area: "pirate", creature: true, rarity: "uncommon", size: 2, value: 320, color: "#8a5a3a", accent: "#ffcf3a", shape: "crab" },
    { id: "pirateparrot", name: "Pirate Parrot", area: "pirate", bird: true, day: true, rarity: "rare", size: 2, value: 700, color: "#c0423a", accent: "#ffcf3a", shape: "songbird", seedCost: 1400 },
    { id: "bluemacaw", name: "Blue Macaw", area: "pirate", bird: true, secret: true, rarity: "mythic", size: 2, value: 7000, color: "#2a6ad0", accent: "#ffcf3a", shape: "macaw", seedCost: 0,
      hint: "A flash of brilliant blue darts through the rigging — too quick for seed. Knock it from the sky with a slingshot." },
    { id: "youngkraken", name: "Young Kraken",  area: "pirate", areaBoss: true, rarity: "mythic", size: 12, value: 28000, minDepth: 250, color: "#5a2f5d", accent: "#9affd0", shape: "youngkraken", hp: 5, reward: "" },
    { id: "davyjones",   name: "Davy Jones Pet", area: "pirate", secretBoss: true, rarity: "mythic", size: 14, value: 80000, minDepth: 200, color: "#2f4a3a", accent: "#9fffc0", shape: "davyjones", hp: 7, reward: "serpenteye" },

    // ======== The Backrooms (secret) ========
    { id: "wallpaperfish", name: "Wallpaper Fish", area: "backrooms", rarity: "common", size: 2, value: 200, minDepth: 0, color: "#d8c468", accent: "#b8a038", shape: "wallpaperfish" },
    { id: "weircorejelly", name: "Weirdcore Jelly", area: "backrooms", rarity: "uncommon", size: 3, value: 360, minDepth: 20, color: "#c8b84a", accent: "#fff6a0", shape: "glowjelly" },
    { id: "bacteriaurchin", name: "Bacteria Blob", area: "backrooms", rarity: "uncommon", size: 2, value: 320, minDepth: 40, color: "#c8b88a", accent: "#9aa83a", shape: "bacteria" },
    { id: "hazmatshark", name: "Hazmat Shark", area: "backrooms", rarity: "epic", size: 6, value: 2400, minDepth: 120, color: "#e0c83a", accent: "#1a1a1a", shape: "shark" },
    { id: "poolnoodle", name: "Pool Noodle Eel", area: "backrooms", rarity: "rare", size: 3, value: 520, minDepth: 80, color: "#4ad0e0", accent: "#ffffff", shape: "eel" },
    { id: "cctvfish",   name: "CCTV Fish",    area: "backrooms", rarity: "mythic", size: 2, value: 4000, minDepth: 0, color: "#7a8a90", accent: "#ff4040", shape: "cctv", secret: true,
      hint: "They watch from the corners. Linger at the very edges of the rooms and one will find you.", condition: { corner: true } },
    { id: "parsonscuttle", name: "Parson's Cuttlefish", area: "backrooms", rarity: "mythic", size: 3, value: 7000, minDepth: 0, color: "#d8c468", accent: "#b8a038", trim: "#fff6a0", shape: "cuttlefish", secret: true, camo: true,
      hint: "A cuttlefish that perfectly mimics the damp yellow wallpaper — all but invisible until it moves. Hold still and watch the walls.", condition: { still: true } },
    { id: "bacteriawhale", name: "Bacteria Whale", area: "backrooms", areaBoss: true, rarity: "mythic", size: 13, value: 24000, minDepth: 200, color: "#b8c83a", accent: "#eaff8a", shape: "bacteriawhale", hp: 5, reward: "" },

    // ======== Hidden Coast (secret, Japanese) ========
    { id: "koi",        name: "Koi",          area: "japan", rarity: "common",   size: 1, value: 120, minDepth: 0,   color: "#ff7a3a", accent: "#ffffff", shape: "fish" },
    { id: "nishikigoi", name: "Nishikigoi",   area: "japan", rarity: "uncommon", size: 2, value: 280, minDepth: 0,   color: "#ff9a4a", accent: "#ffffff", shape: "trout" },
    { id: "tai",        name: "Red Tai",      area: "japan", rarity: "uncommon", size: 2, value: 240, minDepth: 20,  color: "#e0556a", accent: "#ffd6e0", shape: "tang" },
    { id: "katsuo",     name: "Katsuo",       area: "japan", rarity: "rare",     size: 3, value: 420, minDepth: 60,  color: "#3a6fb0", shape: "tuna" },
    { id: "ryukin",     name: "Ryukin",       area: "japan", rarity: "rare",     size: 2, value: 460, minDepth: 30,  color: "#ff5b3a", accent: "#ffe14d", shape: "moonfish" },
    { id: "tairyu",     name: "Tatsu Dragon", area: "japan", rarity: "epic",     size: 6, value: 2200, minDepth: 200, color: "#c0423a", accent: "#ffd24a", shape: "dragon" },
    { id: "japcrab",    name: "Heikegani Crab", area: "japan", creature: true, rarity: "uncommon", size: 2, value: 300, color: "#b0503a", shape: "crab" },
    { id: "ornatestork",name: "Ornate Stork", area: "japan", bird: true, day: true, rarity: "rare", size: 3, value: 880, color: "#f0f4f6", accent: "#e0556a", shape: "stork", seedCost: 1800 },
    { id: "kaiju",      name: "The Kaiju",    area: "japan", areaBoss: true, rarity: "mythic", size: 14, value: 30000, minDepth: 250, color: "#2f4a3a", accent: "#6affc0", shape: "kaiju", hp: 6, reward: "kaijubreath" },

    // ======== Hollow Deep (secret cave) — Olm is its secret fish ========
    { id: "olm",        name: "Olm",          area: "secretcave", rarity: "epic", size: 1, value: 1200, minDepth: 0, color: "#f0d6cc", accent: "#ffc0cc", shape: "eel", secret: true,
      hint: "A ghostly blind salamander of the lightless deep — it surfaces only in the Hollow Deep.", condition: {} },
    { id: "cavelantern",name: "Cave Lantern", area: "secretcave", rarity: "rare", size: 2, value: 420, minDepth: 60, color: "#bcd0c0", accent: "#ffe98a", shape: "lantern" },

    // ======== The Oil Rig (secret) — metal / mechanical / robot catchables ========
    { id: "cogfish",    name: "Cogfish",      area: "oilrig", rarity: "common",   size: 1, value: 160, minDepth: 0,   color: "#8a8a90", accent: "#ffcf3a", shape: "goby" },
    { id: "boltminnow", name: "Bolt Minnow",  area: "oilrig", rarity: "common",   size: 1, value: 140, minDepth: 0,   color: "#9aa0a8", accent: "#ff7a3a", shape: "sardine" },
    { id: "pipeeel",    name: "Pipe Eel",     area: "oilrig", rarity: "uncommon", size: 3, value: 320, minDepth: 40,  color: "#6a7078", accent: "#3ad0ff", shape: "eel" },
    { id: "robojelly",  name: "Robo-Jelly",   area: "oilrig", rarity: "uncommon", size: 2, value: 300, minDepth: 30,  color: "#4a5a6a", accent: "#3affd0", shape: "glowjelly" },
    { id: "gearray",    name: "Gear Ray",     area: "oilrig", rarity: "rare",     size: 4, value: 560, minDepth: 120, color: "#7a7068", accent: "#ffcf3a", shape: "ray" },
    { id: "drillshark", name: "Drill Shark",  area: "oilrig", rarity: "epic",     size: 6, value: 2400, minDepth: 250, color: "#5a5a62", accent: "#ff5b3a", shape: "shark" },
    { id: "mechsquid",  name: "Mecha Squid",  area: "oilrig", rarity: "rare",     size: 4, value: 680, minDepth: 200, color: "#52606a", accent: "#3ad0ff", shape: "squid" },
    { id: "boltcrab",   name: "Salvage Bot",  area: "oilrig", creature: true, rarity: "uncommon", size: 2, value: 340, color: "#7a7a82", accent: "#ffcf3a", shape: "crab" },
    { id: "rigtitan",   name: "The Rig Titan", area: "oilrig", areaBoss: true, rarity: "mythic", size: 14, value: 32000, minDepth: 250, color: "#3a4250", accent: "#ff8a2a", shape: "rigtitan", hp: 6, reward: "", torpedoes: true },
    { id: "torpedofish", name: "Torpedo Fish", area: "oilrig", rarity: "mythic", size: 3, value: 8000, minDepth: 0, color: "#c8c0a0", accent: "#ff5b1a", shape: "torpedo", secret: true, skittish: true, fast: true,
      hint: "A live torpedo with fins — it screams through the rig faster than anything alive. You'll have to run it down.", condition: {} },
    { id: "mechakaiju", name: "Mecha-Kaiju", area: "japan", secretBoss: true, rarity: "mythic", size: 15, value: 60000, minDepth: 200, color: "#5a6470", accent: "#5bf0ff", trim: "#ff5b3a", shape: "mechakaiju", hp: 9, reward: "",
      hint: "A war-machine in the shape of a god, sleeping off the Ornate coast. Only stirs for those who've toppled both the Kaiju and the Rig Titan." },

    // ======== Flooded Freighter (secret; shy fish that hide from divers) ========
    { id: "holdperch",  name: "Hold Perch",    area: "flooded", rarity: "common",   size: 1, value: 360,  minDepth: 0,   color: "#6a7a6a", accent: "#bfe0a0", shape: "perch",    shy: true },
    { id: "silteel",    name: "Silt Eel",      area: "flooded", rarity: "uncommon", size: 3, value: 520,  minDepth: 40,  color: "#4a5a4a", accent: "#9fd0a0", shape: "eel",      shy: true },
    { id: "rustcod",    name: "Rust Cod",      area: "flooded", rarity: "common",   size: 2, value: 400,  minDepth: 20,  color: "#7a6a52", accent: "#d8a05a", shape: "codfish",  shy: true },
    { id: "bilgefish",  name: "Bilge Fish",    area: "flooded", rarity: "common",   size: 1, value: 340,  minDepth: 0,   color: "#5a6a72", accent: "#9fe0d0", shape: "fish",     shy: true },
    { id: "containerray", name: "Container Ray", area: "flooded", rarity: "rare",   size: 4, value: 1500, minDepth: 140, color: "#52606a", accent: "#ffcf3a", shape: "ray",      shy: true },
    { id: "paleflounder", name: "Pale Flounder", area: "flooded", rarity: "uncommon", size: 2, value: 560, minDepth: 80, color: "#8a8a7a", accent: "#e0e0c0", shape: "flatfish", shy: true },
    { id: "shadowtang", name: "Shadow Tang",   area: "flooded", rarity: "uncommon", size: 2, value: 600,  minDepth: 60,  color: "#3a4a5a", accent: "#5bd0ff", shape: "tang",     shy: true },
    { id: "murktrout",  name: "Murk Trout",    area: "flooded", rarity: "common",   size: 2, value: 380,  minDepth: 30,  color: "#5a6a5a", accent: "#caa15a", shape: "trout",    shy: true },
    { id: "lanterngoby", name: "Lantern Goby", area: "flooded", rarity: "common",   size: 1, value: 320,  minDepth: 0,   color: "#6a6258", accent: "#ffd24a", shape: "goby",     shy: true, glow: true },
    { id: "ironjelly",  name: "Iron Jelly",    area: "flooded", rarity: "rare",     size: 3, value: 1400, minDepth: 120, color: "#4a5a6a", accent: "#5bf0ff", shape: "glowjelly" },
    { id: "cratecrab",  name: "Crate Crab",    area: "flooded", creature: true, rarity: "uncommon", size: 2, value: 420, color: "#6a5a4a", accent: "#caa15a", shape: "crab", shy: true },
    { id: "goblinshark", name: "Goblin Shark", area: "flooded", areaBoss: true, rarity: "mythic", size: 13, value: 38000, minDepth: 200, color: "#caa0b0", accent: "#e25a7a", shape: "goblin", hp: 7, reward: "", jawLunge: true },

    // ---- secretcave: extra catchables (parity / more content) ----
    { id: "hollowperch", name: "Hollow Perch", area: "secretcave", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#9277cd", accent: "#dca7e7", shape: "perch" },
    { id: "palegoby", name: "Pale Goby", area: "secretcave", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#b290ba", accent: "#cac9e6", shape: "goby" },
    { id: "blindsardine", name: "Blind Sardine", area: "secretcave", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#9e7bb6", accent: "#b8bffd", shape: "sardine" },
    { id: "cavetrout", name: "Cave Trout", area: "secretcave", rarity: "common", size: 2, value: 312, minDepth: 0, color: "#827db9", accent: "#d6bfe6", shape: "trout" },
    { id: "hollowminnow", name: "Hollow Minnow", area: "secretcave", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#b292bb", accent: "#c1ccff", shape: "guppy" },
    { id: "paleclown", name: "Pale Clown", area: "secretcave", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#a371d8", accent: "#d8bde6", shape: "clownfish" },
    { id: "blindmackerel", name: "Blind Mackerel", area: "secretcave", rarity: "uncommon", size: 2, value: 686, minDepth: 40, color: "#8c70d7", accent: "#e9acf5", shape: "mackerel" },
    { id: "cavecod", name: "Cave Cod", area: "secretcave", rarity: "uncommon", size: 2, value: 686, minDepth: 40, color: "#9877d6", accent: "#bac8f6", shape: "codfish" },
    // ---- backrooms: extra catchables (parity / more content) ----
    { id: "yellowedperch", name: "Yellowed Perch", area: "backrooms", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#dfdc77", accent: "#eee0a9", shape: "perch" },
    { id: "liminalgoby", name: "Liminal Goby", area: "backrooms", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#e0d058", accent: "#fae0a7", shape: "goby" },
    { id: "buzzingsardine", name: "Buzzing Sardine", area: "backrooms", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#e9ac70", accent: "#e6ff91", shape: "sardine" },
    { id: "damptrout", name: "Damp Trout", area: "backrooms", rarity: "common", size: 2, value: 312, minDepth: 0, color: "#dbd36e", accent: "#feff98", shape: "trout" },
    { id: "yellowedminnow", name: "Yellowed Minnow", area: "backrooms", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#d9cd69", accent: "#faed93", shape: "guppy" },
    // ---- swamp: extra catchables (parity / more content) ----
    { id: "boggoby", name: "Bog Goby", area: "swamp", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#90794a", accent: "#d5c353", shape: "goby" },
    { id: "murksardine", name: "Murk Sardine", area: "swamp", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#82813f", accent: "#c3ec63", shape: "sardine" },
    { id: "mangrovetrout", name: "Mangrove Trout", area: "swamp", rarity: "common", size: 2, value: 312, minDepth: 0, color: "#8c8a30", accent: "#cab855", shape: "trout" },
    { id: "reedminnow", name: "Reed Minnow", area: "swamp", rarity: "common", size: 1, value: 233, minDepth: 0, color: "#7e8828", accent: "#d4c957", shape: "guppy" },
    // ---- boneyard: extra catchables (parity / more content) ----
    { id: "bonegoby", name: "Bone Goby", area: "boneyard", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#d2c49a", accent: "#987eb8", shape: "goby" },
    { id: "fossilsardine", name: "Fossil Sardine", area: "boneyard", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#d6ceca", accent: "#a6ae9c", shape: "sardine" },
    { id: "marrowtrout", name: "Marrow Trout", area: "boneyard", rarity: "common", size: 2, value: 504, minDepth: 0, color: "#c8d6ae", accent: "#9499ad", shape: "trout" },
    { id: "paleminnow", name: "Pale Minnow", area: "boneyard", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#e6c79c", accent: "#a37f99", shape: "guppy" },
    // ---- pirate: extra catchables (parity / more content) ----
    { id: "cursedperch", name: "Cursed Perch", area: "pirate", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#ccb158", accent: "#c8a792", shape: "perch" },
    { id: "brinygoby", name: "Briny Goby", area: "pirate", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#da9857", accent: "#e8cf98", shape: "goby" },
    { id: "galleonsardine", name: "Galleon Sardine", area: "pirate", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#ca975b", accent: "#dcdc8e", shape: "sardine" },
    { id: "salttrout", name: "Salt Trout", area: "pirate", rarity: "common", size: 2, value: 504, minDepth: 0, color: "#c4864b", accent: "#daae8b", shape: "trout" },
    // ---- japan: extra catchables (parity / more content) ----
    { id: "sakuraperch", name: "Sakura Perch", area: "japan", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#cb5851", accent: "#f0ebd6", shape: "perch" },
    { id: "koigoby", name: "Koi Goby", area: "japan", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#cc685d", accent: "#fcd3fb", shape: "goby" },
    { id: "roninsardine", name: "Ronin Sardine", area: "japan", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#e33e58", accent: "#ffd3e7", shape: "sardine" },
    { id: "jademinnow", name: "Jade Minnow", area: "japan", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#d57156", accent: "#ffd5fb", shape: "guppy" },
    // ---- prism: extra catchables (parity / more content) ----
    { id: "prismperch", name: "Prism Perch", area: "prism", rarity: "common", size: 1, value: 251, minDepth: 0, color: "#ff6fe1", accent: "#78f6ff", shape: "perch" },
    { id: "neongoby", name: "Neon Goby", area: "prism", rarity: "common", size: 1, value: 251, minDepth: 0, color: "#ff76c2", accent: "#67e5ee", shape: "goby" },
    { id: "opalsardine", name: "Opal Sardine", area: "prism", rarity: "common", size: 1, value: 251, minDepth: 0, color: "#ec6cde", accent: "#6ce0ff", shape: "sardine" },
    // ---- storm: extra catchables (parity / more content) ----
    { id: "stormgoby", name: "Storm Goby", area: "storm", rarity: "common", size: 1, value: 431, minDepth: 0, color: "#838389", accent: "#93c6e3", shape: "goby" },
    { id: "thundersardine", name: "Thunder Sardine", area: "storm", rarity: "common", size: 1, value: 431, minDepth: 0, color: "#5778a0", accent: "#9adbff", shape: "sardine" },
    { id: "galetrout", name: "Gale Trout", area: "storm", rarity: "common", size: 2, value: 576, minDepth: 0, color: "#6266aa", accent: "#b9d4ff", shape: "trout" },
    // ---- oilrig: extra catchables (parity / more content) ----
    { id: "rustperch", name: "Rust Perch", area: "oilrig", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#d7b05d", accent: "#e67b55", shape: "perch" },
    { id: "dieseltrout", name: "Diesel Trout", area: "oilrig", rarity: "common", size: 2, value: 504, minDepth: 0, color: "#dfbc59", accent: "#ff8137", shape: "trout" },
    { id: "slickminnow", name: "Slick Minnow", area: "oilrig", rarity: "common", size: 1, value: 377, minDepth: 0, color: "#c79e47", accent: "#e97c46", shape: "guppy" },
    // ---- mountain: extra catchables (parity / more content) ----
    { id: "ridgesardine", name: "Ridge Sardine", area: "mountain", rarity: "common", size: 1, value: 413, minDepth: 0, color: "#87819e", accent: "#b7d1ee", shape: "sardine" },
    { id: "alpineminnow", name: "Alpine Minnow", area: "mountain", rarity: "common", size: 1, value: 413, minDepth: 0, color: "#7885a7", accent: "#d9c7d8", shape: "guppy" },
    // ---- olympus: extra catchables (parity / more content) ----
    { id: "gildedperch", name: "Gilded Perch", area: "olympus", rarity: "common", size: 1, value: 809, minDepth: 0, color: "#e3e867", accent: "#ffddab", shape: "perch" },
    { id: "divinegoby", name: "Divine Goby", area: "olympus", rarity: "common", size: 1, value: 809, minDepth: 0, color: "#ffc562", accent: "#ffe4bb", shape: "goby" },
    // ---- ashen: extra catchables (parity / more content) ----
    { id: "cinderperch", name: "Cinder Perch", area: "ashen", rarity: "common", size: 1, value: 413, minDepth: 0, color: "#dc4236", accent: "#f39444", shape: "perch" },
    { id: "ashgoby", name: "Ash Goby", area: "ashen", rarity: "common", size: 1, value: 413, minDepth: 0, color: "#db5715", accent: "#eab43d", shape: "goby" },
    // ======== Buried Dunes (desert; sand-lurkers & gliding rays) ========
    { id: "dunegoby",  name: "Dune Goby",     area: "desert", rarity: "common",   size: 1, value: 130, minDepth: 0,   color: "#d8c068", accent: "#fff0b0", shape: "goby" },
    { id: "sandperch", name: "Sand Perch",    area: "desert", rarity: "common",   size: 2, value: 170, minDepth: 20,  color: "#caa860", accent: "#e8d090", shape: "perch" },
    { id: "ribbonsole", name: "Ribbon Sole",  area: "desert", rarity: "uncommon", size: 2, value: 280, minDepth: 40,  color: "#bfa86a", accent: "#6a5a3a", shape: "flatfish" },
    { id: "sidewinder", name: "Sidewinder Eel", area: "desert", rarity: "uncommon", size: 3, value: 360, minDepth: 80, color: "#c8a85a", accent: "#8a6a3a", shape: "eel" },
    { id: "dustray",   name: "Dust Ray",      area: "desert", rarity: "rare",     size: 4, value: 760, minDepth: 140, color: "#d8c078", accent: "#9a7a3a", shape: "ray" },
    { id: "glasskilli", name: "Glass Killifish", area: "desert", rarity: "common", size: 1, value: 150, minDepth: 0,  color: "#cfe0c0", accent: "#ffffff", shape: "fish" },
    { id: "coppermin", name: "Copper Minnow", area: "desert", rarity: "common",   size: 1, value: 140, minDepth: 0,   color: "#c87a3a", accent: "#ffcf8a", shape: "guppy" },
    { id: "sanddart",  name: "Sand Dart",     area: "desert", rarity: "uncommon", size: 1, value: 240, minDepth: 30,  color: "#d8b860", accent: "#a88030", shape: "sardine" },
    { id: "relictcod", name: "Relict Cod",    area: "desert", rarity: "uncommon", size: 2, value: 340, minDepth: 100, color: "#a88a5a", accent: "#d8c090", shape: "codfish" },
    { id: "duneshark", name: "Dune Shark",    area: "desert", rarity: "epic",     size: 6, value: 2400, minDepth: 250, color: "#caa868", accent: "#5a4a2a", shape: "shark" },
    { id: "ghostcrab", name: "Ghost Crab",    area: "desert", creature: true, rarity: "common", size: 1, value: 130, color: "#e0d0a0", accent: "#caa15a", shape: "crab" },
    { id: "dunesnail", name: "Dune Snail",    area: "desert", creature: true, rarity: "common", size: 1, value: 110, color: "#c8a860", accent: "#8a6a3a", shape: "snail" },
    { id: "seavulture", name: "Sea Vulture",  area: "desert", bird: true, rarity: "uncommon", size: 2, value: 420, color: "#7a6a52", accent: "#caa15a", shape: "raptor", seedCost: 700 },
    { id: "sandlark",  name: "Sand Lark",     area: "desert", bird: true, rarity: "common", size: 1, value: 200, color: "#d8c890", accent: "#fff0b0", shape: "finch", seedCost: 400 },
    { id: "dunetitan", name: "The Dune Titan", area: "desert", areaBoss: true, rarity: "mythic", size: 13, value: 30000, minDepth: 200, color: "#b8985a", accent: "#5a4a2a", shape: "dunkle", hp: 6, reward: "" },

    // ======== Birds (fly above the surface; lured with seeds) — 2 per area ========
    { id: "seagull",   name: "Seagull",      area: "coral", bird: true, rarity: "common",   size: 1, value: 45,  color: "#eef3f7", shape: "bird", seedCost: 200 },
    { id: "pelican",   name: "Pelican",      area: "coral", bird: true, rarity: "uncommon", size: 2, value: 130, color: "#d8c2a0", shape: "duck", seedCost: 400 },
    { id: "kingfisher",name: "Kingfisher",   area: "river", bird: true, rarity: "uncommon", size: 1, value: 140, color: "#2a9fd0", shape: "songbird", seedCost: 400 },
    { id: "heron",     name: "Heron",        area: "river", bird: true, rarity: "rare",     size: 2, value: 300, color: "#90a6b6", shape: "heron", seedCost: 700 },
    { id: "cormorant", name: "Cormorant",    area: "kelp",  bird: true, rarity: "common",   size: 2, value: 95,  color: "#3a4048", shape: "seabird", seedCost: 300 },
    { id: "osprey",    name: "Osprey",       area: "kelp",  bird: true, rarity: "rare",     size: 2, value: 340, color: "#7a6650", shape: "raptor", seedCost: 700 },
    { id: "petrel",    name: "Storm Petrel", area: "trench", bird: true, rarity: "uncommon", size: 1, value: 170, color: "#4a4f57", shape: "gull", seedCost: 500 },
    { id: "albatross", name: "Albatross",    area: "trench", bird: true, rarity: "rare",     size: 3, value: 440, color: "#e2e8ee", shape: "albatross", seedCost: 900 },
    { id: "aurorafinch",name: "Aurora Finch",area: "sanctuary", bird: true, rarity: "rare", size: 1, value: 520, color: "#7affd0", shape: "finch", seedCost: 1200 },
    { id: "starswift", name: "Star Swift",   area: "sanctuary", bird: true, rarity: "epic", size: 1, value: 950, color: "#b58bff", shape: "gull", seedCost: 2000 },

    // ======== Arctic Shelf ========
    { id: "arcticcod",  name: "Arctic Cod",   area: "arctic", rarity: "common",   size: 1, value: 50,   minDepth: 0,   color: "#9fb6c4", shape: "codfish" },
    { id: "capelin",    name: "Capelin",      area: "arctic", rarity: "common",   size: 1, value: 60,   minDepth: 20,  color: "#bcc9d2", shape: "sardine" },
    { id: "arcticchar", name: "Arctic Char",  area: "arctic", rarity: "uncommon", size: 1, value: 150,  minDepth: 40,  color: "#e07a8a", shape: "trout" },
    { id: "halibut",    name: "Halibut",      area: "arctic", rarity: "uncommon", size: 3, value: 260,  minDepth: 120, color: "#5a6a78", shape: "flatfish" },
    { id: "wolffish",   name: "Wolffish",     area: "arctic", rarity: "rare",     size: 2, value: 380,  minDepth: 180, color: "#6a7080", shape: "eel" },
    { id: "beluga",     name: "Beluga",       area: "arctic", rarity: "rare",     size: 6, value: 900,  minDepth: 150, color: "#eef4f8", shape: "whale" },
    { id: "narwhal",    name: "Narwhal",      area: "arctic", rarity: "epic",     size: 6, value: 1700, minDepth: 250, color: "#bcd0dc", shape: "narwhal" },
    { id: "orca",       name: "Orca",         area: "arctic", rarity: "epic",     size: 8, value: 2200, minDepth: 300, color: "#22262c", shape: "dolphin" },
    { id: "greenlandshark", name: "Greenland Shark", area: "arctic", rarity: "legendary", size: 8, value: 5200, minDepth: 450, color: "#5a6470", shape: "greenlandshark" },
    { id: "icecrab",    name: "Ice Crab",     area: "arctic", creature: true, rarity: "common",   size: 1, value: 70,  color: "#a9c6d6", shape: "crab" },
    { id: "brittlestar",name: "Brittle Star", area: "arctic", creature: true, rarity: "uncommon", size: 1, value: 160, color: "#c98a9a", shape: "starfish" },
    { id: "puffin",     name: "Puffin",       area: "arctic", bird: true, rarity: "common",   size: 1, value: 120, color: "#2a2e34", shape: "seabird", seedCost: 300 },
    { id: "arctictern", name: "Arctic Tern",  area: "arctic", bird: true, rarity: "uncommon", size: 1, value: 220, color: "#e8eef2", shape: "gull", seedCost: 500 },
    { id: "frostwyrm",  name: "Frost Wyrm",   area: "arctic", rarity: "mythic", size: 9, value: 13000, minDepth: 550, color: "#7fd0ff", accent: "#ffffff", trim: "#3a8ad0", shape: "frostwyrm", secret: true,
      hint: "An ancient ice-serpent said to coil through the coldest deep (below 550m).", condition: { minDepth: 550 } },

    // ======== Fossil Abyss (prehistoric) ========
    { id: "placoderm",  name: "Placoderm",    area: "ancient", rarity: "common",   size: 2, value: 80,   minDepth: 0,   color: "#7a6a4a", shape: "armored" },
    { id: "paleoherring",name: "Paleo Herring",area: "ancient", rarity: "common",  size: 1, value: 70,   minDepth: 20,  color: "#9a8a6a", shape: "longfish" },
    { id: "coelacanth", name: "Coelacanth",   area: "ancient", rarity: "uncommon", size: 3, value: 320,  minDepth: 80,  color: "#3a5a6a", shape: "coelacanth" },
    { id: "helicoprion",name: "Helicoprion",  area: "ancient", rarity: "rare",     size: 4, value: 560,  minDepth: 200, color: "#6a6052", shape: "helicoprion" },
    { id: "ichthyosaur",name: "Ichthyosaur",  area: "ancient", rarity: "rare",     size: 5, value: 700,  minDepth: 280, color: "#5a6a5a", shape: "ichthyosaur" },
    { id: "leedsichthys",name: "Leedsichthys",area: "ancient", rarity: "epic",     size: 9, value: 2600, minDepth: 400, color: "#8a7a5a", shape: "whale" },
    { id: "mosasaur",   name: "Mosasaur",     area: "ancient", rarity: "epic",     size: 8, value: 3000, minDepth: 500, color: "#3a4a3a", shape: "mosasaur" },
    { id: "megalodon",  name: "Megalodon",    area: "ancient", rarity: "legendary", size: 10, value: 7800, minDepth: 700, color: "#4a5560", shape: "megalodon" },
    { id: "trilobite",  name: "Trilobite",    area: "ancient", creature: true, rarity: "common",   size: 1, value: 90,   color: "#7a5a3a", shape: "trilobite" },
    { id: "ammonite",   name: "Ammonite",     area: "ancient", creature: true, rarity: "uncommon", size: 2, value: 240,  color: "#a08a5a", shape: "ammonite" },
    { id: "archaeopteryx", name: "Archaeopteryx", area: "ancient", bird: true, rarity: "uncommon", size: 1, value: 260, color: "#6a5a3a", shape: "songbird", seedCost: 600 },
    { id: "pteranodon", name: "Pteranodon",   area: "ancient", bird: true, rarity: "rare", size: 3, value: 700, color: "#8a6a4a", shape: "pteranodon", seedCost: 1500 },
    { id: "ancientlev", name: "Ancient Leviathan", area: "ancient", rarity: "mythic", size: 10, value: 16000, minDepth: 800, color: "#6a5326", accent: "#ffd24a", trim: "#9f7bff", shape: "ancientlev", secret: true,
      hint: "The first and largest serpent, fossilised legends say it still hunts the abyss floor (below 800m).", condition: { minDepth: 800 } },

    // ======== Open Sea ========
    { id: "mahimahi",  name: "Mahi-Mahi",    area: "opensea", rarity: "common",   size: 2, value: 90,  minDepth: 0,   color: "#3ad0a0", shape: "mahimahi" },
    { id: "flyingfish",name: "Flying Fish",  area: "opensea", rarity: "common",   size: 1, value: 70,  minDepth: 0,   color: "#5fb0e0", shape: "flyingfish" },
    { id: "skipjack",  name: "Skipjack Tuna", area: "opensea", rarity: "common",  size: 2, value: 100, minDepth: 30,  color: "#3a6fb0", shape: "longfish" },
    { id: "wahoo",     name: "Wahoo",        area: "opensea", rarity: "uncommon", size: 3, value: 240, minDepth: 80,  color: "#4a7a9a", shape: "mackerel" },
    { id: "opah",      name: "Opah",         area: "opensea", rarity: "uncommon", size: 3, value: 320, minDepth: 100, color: "#e0533a", shape: "mola" },
    { id: "bluemarlin",name: "Blue Marlin",  area: "opensea", rarity: "rare",     size: 5, value: 700, minDepth: 160, color: "#2a4a8a", shape: "sword" },
    { id: "whaleshark",name: "Whale Shark",  area: "opensea", rarity: "epic",     size: 9, value: 2400, minDepth: 250, color: "#4a6a7a", shape: "whaleshark" },
    { id: "bluewhale", name: "Blue Whale",   area: "opensea", rarity: "legendary", size: 10, value: 7000, minDepth: 400, color: "#3a5a8a", shape: "whale" },
    { id: "glasssquid",name: "Glass Squid",  area: "opensea", creature: true, rarity: "uncommon", size: 1, value: 180, color: "#bfe6ff", shape: "squid" },
    { id: "seaspider", name: "Sea Spider",   area: "opensea", creature: true, rarity: "rare",     size: 2, value: 340, color: "#8a6a5a", shape: "seaspider" },
    { id: "booby",     name: "Booby",        area: "opensea", bird: true, rarity: "common",   size: 1, value: 140, color: "#cdb89a", shape: "gull", seedCost: 400 },
    { id: "frigatebird",name: "Frigatebird", area: "opensea", bird: true, rarity: "uncommon", size: 2, value: 260, color: "#2a2e34", shape: "raptor", seedCost: 600 },
    { id: "phantomjelly", name: "Phantom Jelly", area: "opensea", rarity: "mythic", size: 6, value: 7000, minDepth: 120, color: "#15131c", accent: "#7affd0", shape: "jelly", secret: true,
      hint: "A ghostly giant jelly that rises only to the breathless — let your oxygen run very low.", condition: { lowOxygen: true } },

    // ======== Area bosses (rise once you've caught every fish in their area) ========
    { id: "manowar",   name: "Man o' War",   area: "coral",   areaBoss: true, rarity: "mythic", size: 7,  value: 3000, minDepth: 120, color: "#b06bd0", accent: "#ffd6f2", shape: "manowar", hp: 3, reward: "stinger" },
    { id: "siphonophore", name: "Siphonophore", area: "opensea", areaBoss: true, rarity: "mythic", size: 10, value: 6000, minDepth: 200, color: "#ff6f91", shape: "siphonophore", hp: 3, reward: "necklace" },
    { id: "leatherback", name: "Colossal Leatherback", area: "opensea", secretBoss: true, rarity: "mythic", size: 13, value: 30000, minDepth: 200, color: "#2a2e3a", accent: "#caa15a", shape: "leatherback", hp: 6, reward: "" },
    { id: "apexmega",  name: "Apex Megalodon", area: "ancient", areaBoss: true, rarity: "mythic", size: 12, value: 8000, minDepth: 300, color: "#3a4650", shape: "apexmega", hp: 3, reward: "megtooth" },
    { id: "rogueorca", name: "Rogue Orca",    area: "arctic",  areaBoss: true, trigger: "creatures", rarity: "mythic", size: 11, value: 5000, minDepth: 250, color: "#16181d", accent: "#f2f6fa", shape: "orca", hp: 3, reward: "sonar" },
    { id: "roc",       name: "The Roc",       area: "cloud",   areaBoss: true, rarity: "mythic", size: 12, value: 9000, minDepth: 200, color: "#6a4a2a", accent: "#d8c0a0", shape: "roc", hp: 3, reward: "rocfeather" },
    { id: "spidercrab", name: "Colossal Spider Crab", area: "cave", areaBoss: true, rarity: "mythic", size: 12, value: 9000, minDepth: 250, color: "#8a3a2a", accent: "#e0a060", shape: "spidercrab", hp: 3, reward: "crabcrown" },
    { id: "celestboss", name: "Celestial Serpent", area: "sanctuary", areaBoss: true, rarity: "mythic", size: 13, value: 40000, minDepth: 200, color: "#9f7bff", accent: "#fff3b0", shape: "glowworm", hp: 5, reward: "" },
    { id: "gloomlurker", name: "The Gloom Lurker", area: "cave", areaBoss: true, trigger: "allcreatures", rarity: "mythic", size: 13, value: 26000, minDepth: 300, color: "#2a2438", accent: "#9f8ad0", shape: "angler", hp: 5, reward: "" },
    { id: "cavernwyrm", name: "Cavern Wyrm", area: "cave", secretBoss: true, rarity: "mythic", size: 16, value: 38000, minDepth: 0, color: "#3a2f5e", accent: "#7affd0", trim: "#ffd24a", shape: "cavewyrm", hp: 8, reward: "",
      hint: "A colossal coil shifts in the deepest black of the cavern — wake it from the very bottom." },
  ];

  const CREATURES = FISH.filter(function (f) { return f.creature; }).map(function (f) { return f.id; });
  const BIRDS = FISH.filter(function (f) { return f.bird; }).map(function (f) { return f.id; });

  // The fish the game *claims* you need to summon the Kraken (a curated spread
  // of notable catches per area). Catching them all triggers the blobfish
  // fake-out — the real Kraken needs 100% of everything.
  const REQUIRED_FISH = [
    "reefshark", "sandtiger",            // Coral Coast
    "pike", "sturgeon",                  // River Run
    "giantsquid", "sunfish",             // Kelp Forest
    "greenlandshark", "narwhal",         // Arctic Shelf
    "megalodon", "mosasaur",             // Fossil Abyss
    "anglerfish", "frilledshark", "greatwhite", // Sunken Trench (final)
  ];

  // Build a quick lookup
  const FISH_BY_ID = {};
  FISH.forEach(function (f) { FISH_BY_ID[f.id] = f; });

  // Fish that count toward "catch everything to summon the Kraken".
  // (Everything except the Kraken and the optional secrets, and only in
  // areas that actually exist yet — so not-yet-built zones like the River
  // don't make completion impossible.)
  const COMPLETION_FISH = FISH.filter(function (f) {
    return !f.isKraken && !f.isBlob && !f.areaBoss && !f.secretBoss && !f.secret && LOCATIONS[f.area];
  }).map(function (f) { return f.id; });

  // --- Treasures (from shipwrecks) --------------------------------------
  const TREASURES = [
    { id: "coins",   name: "Gold Coins",     value: 60,    color: "#ffd34a", rarity: "common" },
    { id: "bottle",  name: "Message Bottle", value: 90,    color: "#8fd6c0", rarity: "common" },
    { id: "pearl",   name: "Lustrous Pearl", value: 240,   color: "#f3eaff", rarity: "uncommon" },
    { id: "goblet",  name: "Silver Goblet",  value: 340,   color: "#cfd6de", rarity: "uncommon" },
    // rare+ treasures are now MUCH rarer and worth a lot more
    { id: "clampearl", name: "Clam Pearl",   value: 1100,  color: "#fff0f6", rarity: "rare" },
    { id: "coinchest", name: "Cursed Coin Chest", value: 1400, color: "#ffcf3a", rarity: "rare" },
    { id: "ruby",    name: "Blood Ruby",     value: 2600,  color: "#e23b5a", rarity: "rare" },
    { id: "amulet",  name: "Ancient Amulet", value: 3800,  color: "#49d6c0", rarity: "rare" },
    { id: "crown",   name: "Sunken Crown",   value: 11000, color: "#ffcf3a", rarity: "epic" },
    // plane-wreck-only treasures (rarer & more valuable)
    { id: "blackbox", name: "Black Box",      value: 4200,  color: "#e8852a", rarity: "rare",  plane: true },
    { id: "pilotwatch", name: "Pilot's Watch", value: 7500,  color: "#cfd6de", rarity: "epic",  plane: true },
    { id: "turbine", name: "Jet Turbine",    value: 11000, color: "#8aa0b0", rarity: "epic",  plane: true },
    { id: "goldwings", name: "Golden Wings",  value: 26000, color: "#ffcf3a", rarity: "legendary", plane: true },
    // yacht-wreck-only treasures (rare luxury — high spoils)
    { id: "champagne", name: "Vintage Champagne", value: 6000,  color: "#bfe0a0", rarity: "rare",  yacht: true },
    { id: "rolex",   name: "Gold Wristwatch", value: 14000, color: "#ffcf3a", rarity: "epic",  yacht: true },
    { id: "tiara",   name: "Diamond Tiara",  value: 32000, color: "#bfeaff", rarity: "legendary", yacht: true },
    // cargo-ship container (its own bulk loot)
    { id: "container", name: "Cargo Container", value: 900, color: "#c46a3a", rarity: "uncommon", cargo: true },
  ];

  // --- Upgrade tracks ----------------------------------------------------
  // Each level lists [costToReachThisLevel, value]. Level 0 is the start.
  const UPGRADES = {
    oxygen: {
      name: "Oxygen Tank",
      desc: "More seconds underwater before you must surface.",
      unit: "s",
      levels: [
        { cost: 0,    value: 28 },
        { cost: 220,  value: 40 },
        { cost: 700,  value: 55 },
        { cost: 1900, value: 75 },
        { cost: 4800, value: 100 },
        { cost: 11500,value: 135 },
        { cost: 27000,value: 180 },
      ],
    },
    fins: {
      name: "Fins",
      desc: "Swim faster across the deep.",
      unit: "spd",
      levels: [
        { cost: 0,    value: 170 },
        { cost: 180,  value: 205 },
        { cost: 580,  value: 240 },
        { cost: 1500, value: 280 },
        { cost: 3900, value: 325 },
        { cost: 9500, value: 380 },
      ],
    },
    net: {
      name: "Catch Gadget",
      desc: "Wider catch radius — snag fish from further away.",
      unit: "px",
      levels: [
        { cost: 0,    value: 70 },
        { cost: 300,  value: 95 },
        { cost: 950,  value: 120 },
        { cost: 2500, value: 150 },
        { cost: 6400, value: 190 },
      ],
    },
    reel: {
      name: "Reel Motor",
      desc: "Reel caught fish in faster.",
      unit: "x",
      levels: [
        { cost: 0,    value: 1.0 },
        { cost: 270,  value: 1.35 },
        { cost: 820,  value: 1.75 },
        { cost: 2200, value: 2.25 },
        { cost: 5600, value: 3.0 },
      ],
    },
    inventory: {
      name: "Cargo Hold",
      desc: "Total inventory space. Big fish eat more space!",
      unit: "slots",
      levels: [
        { cost: 0,    value: 8 },
        { cost: 380,  value: 14 },
        { cost: 1150, value: 22 },
        { cost: 3000, value: 34 },
        { cost: 7400, value: 50 },
        { cost: 17000,value: 72 },
      ],
    },
    suit: {
      name: "Diving Suit",
      desc: "Pressure suit — cuts oxygen use, letting you go deeper.",
      unit: "%O₂",
      levels: [
        { cost: 0,    value: 1.0 },
        { cost: 600,  value: 0.85 },
        { cost: 2000, value: 0.72 },
        { cost: 5200, value: 0.60 },
        { cost: 13000,value: 0.48 },
      ],
    },
    light: {
      name: "Dive Light",
      desc: "See further in the crushing dark of the deep.",
      unit: "px",
      levels: [
        { cost: 0,    value: 0 },
        { cost: 450,  value: 120 },
        { cost: 1500, value: 220 },
        { cost: 3800, value: 340 },
      ],
    },
    scoop: {
      name: "Fishing Net",
      desc: "Scoop sea-floor creatures (crabs, starfish, lobsters...). A bigger net each level — Lv 0 means no net.",
      unit: "px",
      levels: [
        { cost: 0,    value: 0 },
        { cost: 1400, value: 55 },
        { cost: 3400, value: 80 },
        { cost: 7800, value: 110 },
        { cost: 16000,value: 145 },
      ],
    },
    trap: {
      name: "Deploy Net",
      desc: "A net you DROP in the water (tap 🪤). Any fish that swims into it is bagged — even when your hold is full. Bigger sizes cover more water.",
      unit: "size",
      levels: [
        { cost: 0,     value: 0 },    // none
        { cost: 4000,  value: 110 },  // small
        { cost: 12000, value: 170 },  // medium
        { cost: 30000, value: 240 },  // big
        { cost: 70000, value: 330 },  // huge
      ],
    },
    hammer: {
      name: "Sledgehammer",
      desc: "Smash open locked cages on the sea floor. Each upgrade cracks them harder for MORE treasure per cage.",
      unit: "loot",
      levels: [
        { cost: 0,     value: 0 },   // not owned
        { cost: 8000,  value: 1 },   // base
        { cost: 22000, value: 2 },
        { cost: 55000, value: 3 },
      ],
    },
    shovel: {
      name: "Shovel",
      desc: "Pry clams off the sea bed. Each upgrade improves your odds of a pearl and the value you dig up.",
      unit: "dig",
      levels: [
        { cost: 0,     value: 0 },   // not owned
        { cost: 6000,  value: 1 },   // base
        { cost: 18000, value: 2 },
        { cost: 46000, value: 3 },
      ],
    },
    sling: {
      name: "Slingshot",
      desc: "Knock birds out of the sky to catch them — aim with the joystick and tap 🪃. Upgrades give more shots per dive.",
      unit: "shots",
      levels: [
        { cost: 0,     value: 0 },   // not owned
        { cost: 7000,  value: 4 },
        { cost: 20000, value: 7 },
        { cost: 48000, value: 11 },
      ],
    },
    knife: {
      name: "Diver's Knife",
      desc: "A serrated dive knife — saw your way out of a boss's grip far faster. Each upgrade breaks the hold quicker (and bosses grip harder the more you've beaten).",
      unit: "x wiggle",
      levels: [
        { cost: 0,     value: 1.0 }, // bare hands
        { cost: 5000,  value: 1.6 },
        { cost: 14000, value: 2.3 },
        { cost: 34000, value: 3.2 },
      ],
    },
  };

  // --- Charms (stackable consumable-style permanent buffs) --------------
  const CHARMS = {
    rarity: {
      name: "Rarity Charm",
      desc: "Each charm boosts the odds of rarer fish. Stacks — but each one costs more than the last!",
      cost: 2500,
      perStack: 0.12,   // +12% rare-weight tilt per charm
      maxStack: 25,
    },
    shiny: {
      name: "Shiny Charm",
      desc: "Each charm slightly raises your chance of a shiny variant. Stacks — but each one costs more than the last!",
      cost: 9000,
      perStack: 0.004,  // +0.4% absolute shiny chance per charm
      maxStack: 40,
    },
  };

  const BASE_SHINY_CHANCE = 0.0025; // 0.25% baseline (rarer — shinies are special)
  const SHINY_VALUE_MULT = 9;       // shinies sell for ~9x

  // One-time purchasable items
  const ITEMS = {
    goggles: {
      name: "Night-Vision Goggles",
      desc: "Crystal-clear goggles — see much further underwater, AND a night-vision mode that turns night dives bright as day (toggle in your Items).",
      cost: 7500,
    },
    shinyPocket: {
      name: "Shiny Pocket",
      desc: "A magic pouch — you can still grab shiny catches even when your cargo hold is full.",
      cost: 45000,
    },
  };

  window.GAMEDATA = {
    RARITY: RARITY,
    LOCATIONS: LOCATIONS,
    FISH: FISH,
    FISH_BY_ID: FISH_BY_ID,
    COMPLETION_FISH: COMPLETION_FISH,
    REQUIRED_FISH: REQUIRED_FISH,
    CREATURES: CREATURES,
    BIRDS: BIRDS,
    TREASURES: TREASURES,
    UPGRADES: UPGRADES,
    CHARMS: CHARMS,
    ITEMS: ITEMS,
    BASE_SHINY_CHANCE: BASE_SHINY_CHANCE,
    SHINY_VALUE_MULT: SHINY_VALUE_MULT,
    PXPM: 4, // world pixels per "meter" of depth
  };
})();
