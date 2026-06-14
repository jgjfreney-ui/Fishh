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
  const LOCATIONS = {
    coral: {
      id: "coral",
      name: "Coral Coast",
      blurb: "Sun-dappled shallows bursting with colour. A gentle place to start.",
      maxDepth: 280,
      worldWidth: 2400,
      topColor: "#39c4d6",
      deepColor: "#063a6b",
      shinyBonus: 0,
      unlocked: true,
      cost: 0,
      sky: { top: "#9fd8ff", bottom: "#e6f7ff" },
    },
    river: {
      id: "river",
      name: "River Run",
      blurb: "A bright freshwater river winding between the coast and the kelp — trout, pike, catfish and more.",
      maxDepth: 220,
      worldWidth: 2200,
      topColor: "#4a9ec4",
      deepColor: "#143a2a",
      shinyBonus: 0,
      unlocked: false,
      cost: 500,
      sky: { top: "#bfe8ff", bottom: "#eafce0" },
    },
    kelp: {
      id: "kelp",
      name: "Kelp Forest",
      blurb: "Towering green columns hide clever, slippery creatures.",
      maxDepth: 520,
      worldWidth: 2600,
      topColor: "#2f9e8f",
      deepColor: "#04332f",
      shinyBonus: 0,
      unlocked: false,
      cost: 1200,
      sky: { top: "#9fb6b0", bottom: "#d6e6dc" },
    },
    trench: {
      id: "trench",
      name: "Sunken Trench",
      blurb: "A crushing abyss. The rarest monsters lurk in the dark below.",
      maxDepth: 1200,
      worldWidth: 2600,
      topColor: "#13496e",
      deepColor: "#01040c",
      shinyBonus: 0,
      unlocked: false,
      cost: 6000,
      sky: { top: "#86b4d4", bottom: "#cfe8f2" },
    },
    sanctuary: {
      id: "sanctuary",
      name: "Starlight Sanctuary",
      blurb: "A shimmering, otherworldly reef where the water glitters with stars. Shinies thrive here.",
      maxDepth: 900,
      worldWidth: 2600,
      topColor: "#5a3ea8",
      deepColor: "#0a0226",
      shinyBonus: 0.04, // elevated shiny odds (the true shiny haven comes post-Kraken)
      starfield: true,
      unlocked: false,
      cost: 18000,
      sky: { top: "#160b32", bottom: "#3a2a6a", night: true },
    },
  };

  // --- Fish --------------------------------------------------------------
  // shape drives how it is drawn. size = inventory slots it occupies.
  // minDepth = won't appear above this depth (deeper = rarer fish gate).
  // value = sale price (shiny multiplies this).
  const FISH = [
    // ---- Coral Coast ----
    { id: "clownfish",  name: "Clownfish",   area: "coral", rarity: "common",   size: 1, value: 18,  minDepth: 0,   color: "#ff7a18", shape: "fish" },
    { id: "cod",        name: "Cod",         area: "coral", rarity: "common",   size: 1, value: 22,  minDepth: 0,   color: "#bda079", shape: "fish" },
    { id: "seabass",    name: "Sea Bass",    area: "coral", rarity: "common",   size: 1, value: 26,  minDepth: 20,  color: "#8fa6b0", shape: "fish" },
    { id: "angelfish",  name: "Angelfish",   area: "coral", rarity: "uncommon", size: 1, value: 70,  minDepth: 40,  color: "#ffd84a", shape: "fish" },
    { id: "parrotfish", name: "Parrotfish",  area: "coral", rarity: "uncommon", size: 2, value: 95,  minDepth: 60,  color: "#36d6a0", shape: "fish" },
    { id: "pufferfish", name: "Pufferfish",  area: "coral", rarity: "uncommon", size: 2, value: 110, minDepth: 80,  color: "#c8d24a", shape: "round" },
    { id: "lionfish",   name: "Lionfish",    area: "coral", rarity: "rare",     size: 2, value: 240, minDepth: 120, color: "#e0533a", shape: "fish" },
    { id: "seaturtle",  name: "Sea Turtle",  area: "coral", rarity: "rare",     size: 3, value: 320, minDepth: 100, color: "#4f9e5e", shape: "turtle" },
    { id: "reefshark",  name: "Reef Shark",  area: "coral", rarity: "epic",     size: 4, value: 900, minDepth: 180, color: "#7d93a3", shape: "shark" },

    // ---- Kelp Forest ----
    { id: "mackerel",   name: "Mackerel",    area: "kelp", rarity: "common",   size: 1, value: 28,   minDepth: 0,   color: "#5fa8c4", shape: "fish" },
    { id: "herring",    name: "Herring",     area: "kelp", rarity: "common",   size: 1, value: 30,   minDepth: 20,  color: "#aebfc9", shape: "fish" },
    { id: "seahorse",   name: "Seahorse",    area: "kelp", rarity: "uncommon", size: 1, value: 85,   minDepth: 40,  color: "#e6a13c", shape: "seahorse" },
    { id: "seaotter",   name: "Sea Otter",   area: "kelp", rarity: "uncommon", size: 2, value: 130,  minDepth: 30,  color: "#8a5a32", shape: "otter" },
    { id: "morayeel",   name: "Moray Eel",   area: "kelp", rarity: "rare",     size: 2, value: 270,  minDepth: 150, color: "#5c7a3a", shape: "eel" },
    { id: "octopus",    name: "Octopus",     area: "kelp", rarity: "rare",     size: 3, value: 360,  minDepth: 180, color: "#c05f8f", shape: "octopus" },
    { id: "giantsquid", name: "Giant Squid", area: "kelp", rarity: "epic",     size: 5, value: 1300, minDepth: 360, color: "#d06a5a", shape: "squid" },

    // ---- Open water (appears in coral/kelp/trench mid depths) ----
    { id: "tuna",       name: "Bluefin Tuna", area: "kelp",   rarity: "rare",     size: 3, value: 300,  minDepth: 120, color: "#3a6fb0", shape: "fish" },
    { id: "swordfish",  name: "Swordfish",    area: "trench", rarity: "rare",     size: 4, value: 420,  minDepth: 120, color: "#4a6678", shape: "sword" },
    { id: "manta",      name: "Manta Ray",    area: "trench", rarity: "epic",     size: 5, value: 1100, minDepth: 220, color: "#2c3e57", shape: "ray" },
    { id: "hammerhead", name: "Hammerhead",   area: "trench", rarity: "epic",     size: 5, value: 1250, minDepth: 300, color: "#6e8290", shape: "hammer" },

    // ---- Sunken Trench (deep) ----
    { id: "lanternfish", name: "Lanternfish",  area: "trench", rarity: "common",   size: 1, value: 40,   minDepth: 100, color: "#7fa0c0", shape: "lantern" },
    { id: "hatchetfish", name: "Hatchetfish",  area: "trench", rarity: "uncommon", size: 1, value: 120,  minDepth: 200, color: "#cfd6e0", shape: "round" },
    { id: "anglerfish",  name: "Anglerfish",   area: "trench", rarity: "uncommon", size: 2, value: 160,  minDepth: 300, color: "#283b2f", shape: "angler" },
    { id: "viperfish",   name: "Viperfish",    area: "trench", rarity: "rare",     size: 2, value: 380,  minDepth: 400, color: "#3a4a55", shape: "eel" },
    { id: "gulpereel",   name: "Gulper Eel",   area: "trench", rarity: "rare",     size: 3, value: 460,  minDepth: 500, color: "#241f33", shape: "eel" },
    { id: "frilledshark",name: "Frilled Shark",area: "trench", rarity: "epic",     size: 5, value: 1500, minDepth: 600, color: "#4a3f4f", shape: "shark" },
    { id: "colossalsquid",name:"Colossal Squid",area:"trench", rarity: "legendary",size: 7, value: 4200, minDepth: 800, color: "#b03c5a", shape: "squid" },
    { id: "spermwhale",  name: "Sperm Whale",  area: "trench", rarity: "legendary",size: 8, value: 5200, minDepth: 700, color: "#5a5f6b", shape: "whale" },
    { id: "greatwhite",  name: "Great White Shark", area: "trench", rarity: "legendary", size: 8, value: 6800, minDepth: 850, color: "#8a97a0", shape: "shark" },

    // ---- Starlight Sanctuary ----
    { id: "starjelly",   name: "Starlight Jelly", area: "sanctuary", rarity: "common",   size: 1, value: 60,   minDepth: 0,   color: "#9fd8ff", shape: "jelly" },
    { id: "aurorafish",  name: "Aurora Fish",     area: "sanctuary", rarity: "uncommon", size: 1, value: 150,  minDepth: 60,  color: "#7affd0", shape: "fish" },
    { id: "cosmicray",   name: "Cosmic Ray",      area: "sanctuary", rarity: "rare",     size: 4, value: 520,  minDepth: 150, color: "#7a5cff", shape: "ray" },
    { id: "nebulaeel",   name: "Nebula Eel",      area: "sanctuary", rarity: "rare",     size: 3, value: 560,  minDepth: 220, color: "#c46bff", shape: "eel" },
    { id: "prismtang",   name: "Prismatic Tang",  area: "sanctuary", rarity: "epic",     size: 2, value: 1400, minDepth: 300, color: "#ff8be0", shape: "fish" },
    { id: "galaxywhale", name: "Galaxy Whale",    area: "sanctuary", rarity: "legendary",size: 8, value: 6000, minDepth: 500, color: "#3a2c78", shape: "whale" },

    // ======== Wave 2 content: +5 per area ========
    // ---- Coral Coast ----
    { id: "damselfish", name: "Damselfish",   area: "coral", rarity: "common",   size: 1, value: 24,  minDepth: 0,   color: "#3a7bd5", shape: "fish" },
    { id: "butterflyfish", name: "Butterflyfish", area: "coral", rarity: "uncommon", size: 1, value: 72, minDepth: 30, color: "#ffcf3a", shape: "fish" },
    { id: "moorishidol", name: "Moorish Idol", area: "coral", rarity: "uncommon", size: 1, value: 90,  minDepth: 50,  color: "#f0e6c8", shape: "fish" },
    { id: "triggerfish", name: "Triggerfish",  area: "coral", rarity: "rare",     size: 2, value: 230, minDepth: 90,  color: "#2f8f7a", shape: "fish" },
    { id: "sandtiger",  name: "Sand Tiger Shark", area: "coral", rarity: "epic",  size: 4, value: 1000, minDepth: 150, color: "#9aa6ad", shape: "shark" },

    // ---- Kelp Forest ----
    { id: "kelpfish",   name: "Kelpfish",      area: "kelp", rarity: "common",   size: 1, value: 30,  minDepth: 0,   color: "#5a8f3a", shape: "fish" },
    { id: "rockfish",   name: "Rockfish",      area: "kelp", rarity: "common",   size: 2, value: 44,  minDepth: 40,  color: "#b05a4a", shape: "fish" },
    { id: "garibaldi",  name: "Garibaldi",     area: "kelp", rarity: "uncommon", size: 1, value: 95,  minDepth: 30,  color: "#ff7a18", shape: "fish" },
    { id: "wolfeel",    name: "Wolf Eel",      area: "kelp", rarity: "rare",     size: 3, value: 340, minDepth: 180, color: "#6a6a5a", shape: "eel" },
    { id: "sunfish",    name: "Ocean Sunfish", area: "kelp", rarity: "epic",     size: 6, value: 1500, minDepth: 220, color: "#9fb4c4", shape: "round" },

    // ---- Sunken Trench ----
    { id: "barreleye",  name: "Barreleye",     area: "trench", rarity: "uncommon", size: 1, value: 150, minDepth: 250, color: "#2a3a44", shape: "round", glow: true },
    { id: "blackdragon",name: "Black Dragonfish", area: "trench", rarity: "rare",  size: 2, value: 400, minDepth: 450, color: "#241f33", shape: "eel", glow: true },
    { id: "dumbo",      name: "Dumbo Octopus", area: "trench", rarity: "rare",     size: 3, value: 480, minDepth: 520, color: "#c06a8a", shape: "octopus" },
    { id: "fangtooth",  name: "Fangtooth",     area: "trench", rarity: "rare",     size: 1, value: 360, minDepth: 600, color: "#3a3a44", shape: "round" },
    { id: "oarfish",    name: "Giant Oarfish", area: "trench", rarity: "legendary",size: 8, value: 5600, minDepth: 700, color: "#cfd6e0", shape: "eel" },

    // ---- Starlight Sanctuary ----
    { id: "moonfish",   name: "Moonfish",      area: "sanctuary", rarity: "common",   size: 1, value: 64,  minDepth: 0,   color: "#cfe6ff", shape: "round" },
    { id: "cometfish",  name: "Comet Fish",    area: "sanctuary", rarity: "uncommon", size: 2, value: 160, minDepth: 60,  color: "#9fd8ff", shape: "fish" },
    { id: "astraljelly",name: "Astral Jelly",  area: "sanctuary", rarity: "rare",     size: 1, value: 540, minDepth: 140, color: "#c46bff", shape: "jelly" },
    { id: "solarray",   name: "Solar Ray",     area: "sanctuary", rarity: "epic",     size: 5, value: 1500, minDepth: 320, color: "#ffd86b", shape: "ray" },
    { id: "voidwhale",  name: "Void Whale",    area: "sanctuary", rarity: "legendary",size: 8, value: 6400, minDepth: 520, color: "#2a2350", shape: "whale" },

    // ======== River Run (zone built later — fish data is ready) ========
    { id: "rivertrout", name: "River Trout",   area: "river", rarity: "common",   size: 1, value: 26,  minDepth: 0,   color: "#8a9a5a", shape: "fish" },
    { id: "perch",      name: "Perch",         area: "river", rarity: "common",   size: 1, value: 30,  minDepth: 10,  color: "#5a7a3a", shape: "fish" },
    { id: "salmon",     name: "Salmon",        area: "river", rarity: "uncommon", size: 2, value: 90,  minDepth: 20,  color: "#e07a6a", shape: "fish" },
    { id: "catfish",    name: "Catfish",       area: "river", rarity: "uncommon", size: 2, value: 110, minDepth: 40,  color: "#6a5a4a", shape: "fish" },
    { id: "pike",       name: "Pike",          area: "river", rarity: "rare",     size: 3, value: 260, minDepth: 60,  color: "#4a6a4a", shape: "fish" },
    { id: "rivereel",   name: "River Eel",     area: "river", rarity: "rare",     size: 2, value: 300, minDepth: 80,  color: "#5c6a3a", shape: "eel" },
    { id: "sturgeon",   name: "Sturgeon",      area: "river", rarity: "epic",     size: 5, value: 900, minDepth: 100, color: "#7a8a6a", shape: "fish" },

    // ---- Secret fish (need a purchased hint + a condition; spawn rarely) ----
    { id: "goldenkoi",  name: "Golden Koi",    area: "coral",     rarity: "mythic", size: 2, value: 2600, minDepth: 0,   color: "#ffd54a", shape: "fish",  secret: true,
      hint: "Shimmers only in the brightest shallows of Coral Coast (above 60m). Rare and skittish.",
      condition: { maxDepth: 60 } },
    { id: "leafydragon",name: "Leafy Seadragon",area: "kelp",      rarity: "mythic", size: 2, value: 3000, minDepth: 100,color: "#7fc36b", shape: "seahorse", secret: true,
      hint: "Camouflaged among deep kelp (below 100m). You must be patient and still.",
      condition: { minDepth: 100 } },
    { id: "deeplev",    name: "Deep Leviathan", area: "trench",    rarity: "mythic", size: 9, value: 9000, minDepth: 900,color: "#3a4e6a", shape: "eel", secret: true,
      hint: "A colossal sea-serpent coils through the very bottom of the Trench (below 900m). Only the brave reach it.",
      condition: { minDepth: 900 } },
    { id: "celestserp", name: "Celestial Serpent",area:"sanctuary",rarity: "mythic", size: 7, value: 12000,minDepth: 400,color: "#c9b3ff", shape: "eel", secret: true,
      hint: "Coils through the deepest starlight (below 400m), woven from the night sky itself.",
      condition: { minDepth: 400 } },
    { id: "rainbowtrout", name: "Rainbow Trout", area: "river", rarity: "mythic", size: 2, value: 3400, minDepth: 0, color: "#6fd0c0", shape: "fish", secret: true,
      hint: "A dazzling trout that glints with every colour, darting through bright river shallows (above 40m).",
      condition: { maxDepth: 40 } },
    { id: "rivergiant", name: "River Leviathan", area: "river", rarity: "mythic", size: 8, value: 11000, minDepth: 90, color: "#3a5a4a", shape: "eel", secret: true,
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
    { id: "waterbug",   name: "Water Bug",    area: "river", creature: true, rarity: "uncommon", size: 1, value: 95,  color: "#5a6a3a", shape: "bug" },
    { id: "seaurchin",  name: "Sea Urchin",   area: "kelp",  creature: true, rarity: "common",   size: 1, value: 65,  color: "#6a3a7a", shape: "urchin" },
    { id: "lobster",    name: "Lobster",      area: "kelp",  creature: true, rarity: "uncommon", size: 2, value: 170, color: "#9a3a2a", shape: "lobster" },
    { id: "giantisopod",name: "Giant Isopod", area: "trench", creature: true, rarity: "rare",    size: 2, value: 320, color: "#8a8a7a", shape: "bug" },
    { id: "kingcrab",   name: "King Crab",    area: "trench", creature: true, rarity: "rare",    size: 3, value: 460, color: "#b0503a", shape: "crab" },
    { id: "starcrab",   name: "Star Crab",    area: "sanctuary", creature: true, rarity: "rare", size: 2, value: 420, color: "#9f7bff", shape: "crab" },
    { id: "prismstar",  name: "Prism Star",   area: "sanctuary", creature: true, rarity: "epic", size: 1, value: 760, color: "#7affd0", shape: "starfish" },

    // ======== Birds (fly above the surface; lured with seeds) — 2 per area ========
    { id: "seagull",   name: "Seagull",      area: "coral", bird: true, rarity: "common",   size: 1, value: 45,  color: "#eef3f7", shape: "bird", seedCost: 200 },
    { id: "pelican",   name: "Pelican",      area: "coral", bird: true, rarity: "uncommon", size: 2, value: 130, color: "#d8c2a0", shape: "bird", seedCost: 400 },
    { id: "kingfisher",name: "Kingfisher",   area: "river", bird: true, rarity: "uncommon", size: 1, value: 140, color: "#2a9fd0", shape: "bird", seedCost: 400 },
    { id: "heron",     name: "Heron",        area: "river", bird: true, rarity: "rare",     size: 2, value: 300, color: "#90a6b6", shape: "bird", seedCost: 700 },
    { id: "cormorant", name: "Cormorant",    area: "kelp",  bird: true, rarity: "common",   size: 2, value: 95,  color: "#3a4048", shape: "bird", seedCost: 300 },
    { id: "osprey",    name: "Osprey",       area: "kelp",  bird: true, rarity: "rare",     size: 2, value: 340, color: "#7a6650", shape: "bird", seedCost: 700 },
    { id: "petrel",    name: "Storm Petrel", area: "trench", bird: true, rarity: "uncommon", size: 1, value: 170, color: "#4a4f57", shape: "bird", seedCost: 500 },
    { id: "albatross", name: "Albatross",    area: "trench", bird: true, rarity: "rare",     size: 3, value: 440, color: "#e2e8ee", shape: "bird", seedCost: 900 },
    { id: "aurorafinch",name: "Aurora Finch",area: "sanctuary", bird: true, rarity: "rare", size: 1, value: 520, color: "#7affd0", shape: "bird", seedCost: 1200 },
    { id: "starswift", name: "Star Swift",   area: "sanctuary", bird: true, rarity: "epic", size: 1, value: 950, color: "#b58bff", shape: "bird", seedCost: 2000 },
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
    "anglerfish", "frilledshark", "greatwhite", // Sunken Trench
    "prismtang", "galaxywhale",          // Starlight Sanctuary
  ];

  // Build a quick lookup
  const FISH_BY_ID = {};
  FISH.forEach(function (f) { FISH_BY_ID[f.id] = f; });

  // Fish that count toward "catch everything to summon the Kraken".
  // (Everything except the Kraken and the optional secrets, and only in
  // areas that actually exist yet — so not-yet-built zones like the River
  // don't make completion impossible.)
  const COMPLETION_FISH = FISH.filter(function (f) {
    return !f.isKraken && !f.isBlob && !f.secret && LOCATIONS[f.area];
  }).map(function (f) { return f.id; });

  // --- Treasures (from shipwrecks) --------------------------------------
  const TREASURES = [
    { id: "coins",   name: "Gold Coins",     value: 60,   color: "#ffd34a", rarity: "common" },
    { id: "bottle",  name: "Message Bottle", value: 90,   color: "#8fd6c0", rarity: "common" },
    { id: "pearl",   name: "Lustrous Pearl", value: 220,  color: "#f3eaff", rarity: "uncommon" },
    { id: "goblet",  name: "Silver Goblet",  value: 300,  color: "#cfd6de", rarity: "uncommon" },
    { id: "ruby",    name: "Blood Ruby",     value: 700,  color: "#e23b5a", rarity: "rare" },
    { id: "amulet",  name: "Ancient Amulet", value: 1200, color: "#49d6c0", rarity: "rare" },
    { id: "crown",   name: "Sunken Crown",   value: 3200, color: "#ffcf3a", rarity: "epic" },
    // plane-wreck-only treasures (rarer & more valuable)
    { id: "blackbox", name: "Black Box",      value: 1600, color: "#e8852a", rarity: "rare",  plane: true },
    { id: "pilotwatch", name: "Pilot's Watch", value: 2400, color: "#cfd6de", rarity: "epic",  plane: true },
    { id: "turbine", name: "Jet Turbine",    value: 4200, color: "#8aa0b0", rarity: "epic",  plane: true },
    { id: "goldwings", name: "Golden Wings",  value: 6500, color: "#ffcf3a", rarity: "legendary", plane: true },
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
        { cost: 150,  value: 40 },
        { cost: 450,  value: 55 },
        { cost: 1100, value: 75 },
        { cost: 2600, value: 100 },
        { cost: 6000, value: 135 },
        { cost: 14000,value: 180 },
      ],
    },
    fins: {
      name: "Fins",
      desc: "Swim faster across the deep.",
      unit: "spd",
      levels: [
        { cost: 0,    value: 170 },
        { cost: 120,  value: 205 },
        { cost: 380,  value: 240 },
        { cost: 900,  value: 280 },
        { cost: 2200, value: 325 },
        { cost: 5200, value: 380 },
      ],
    },
    net: {
      name: "Catch Gadget",
      desc: "Wider catch radius — snag fish from further away.",
      unit: "px",
      levels: [
        { cost: 0,    value: 70 },
        { cost: 200,  value: 95 },
        { cost: 600,  value: 120 },
        { cost: 1500, value: 150 },
        { cost: 3600, value: 190 },
      ],
    },
    reel: {
      name: "Reel Motor",
      desc: "Reel caught fish in faster.",
      unit: "x",
      levels: [
        { cost: 0,    value: 1.0 },
        { cost: 180,  value: 1.35 },
        { cost: 520,  value: 1.75 },
        { cost: 1300, value: 2.25 },
        { cost: 3200, value: 3.0 },
      ],
    },
    inventory: {
      name: "Cargo Hold",
      desc: "Total inventory space. Big fish eat more space!",
      unit: "slots",
      levels: [
        { cost: 0,    value: 8 },
        { cost: 250,  value: 14 },
        { cost: 700,  value: 22 },
        { cost: 1700, value: 34 },
        { cost: 4000, value: 50 },
        { cost: 9000, value: 72 },
      ],
    },
    suit: {
      name: "Diving Suit",
      desc: "Pressure suit — cuts oxygen use, letting you go deeper.",
      unit: "%O₂",
      levels: [
        { cost: 0,    value: 1.0 },
        { cost: 400,  value: 0.85 },
        { cost: 1200, value: 0.72 },
        { cost: 3000, value: 0.60 },
        { cost: 7000, value: 0.48 },
      ],
    },
    light: {
      name: "Dive Light",
      desc: "See further in the crushing dark of the deep.",
      unit: "px",
      levels: [
        { cost: 0,    value: 0 },
        { cost: 300,  value: 120 },
        { cost: 900,  value: 220 },
        { cost: 2200, value: 340 },
      ],
    },
    scoop: {
      name: "Fishing Net",
      desc: "Scoop sea-floor creatures (crabs, starfish, lobsters...). A bigger net each level — Lv 0 means no net.",
      unit: "px",
      levels: [
        { cost: 0,     value: 0 },
        { cost: 2500,  value: 55 },
        { cost: 5500,  value: 80 },
        { cost: 11000, value: 110 },
        { cost: 22000, value: 145 },
      ],
    },
  };

  // --- Charms (stackable consumable-style permanent buffs) --------------
  const CHARMS = {
    rarity: {
      name: "Rarity Charm",
      desc: "Each charm boosts the odds of rarer fish. Stacks!",
      cost: 800,
      perStack: 0.12,   // +12% rare-weight tilt per charm
      maxStack: 25,
    },
    shiny: {
      name: "Shiny Charm",
      desc: "Each charm slightly raises your chance of a shiny variant. Stacks, but shinies stay rare!",
      cost: 2500,
      perStack: 0.004,  // +0.4% absolute shiny chance per charm
      maxStack: 40,
    },
  };

  const BASE_SHINY_CHANCE = 0.0025; // 0.25% baseline (rarer — shinies are special)
  const SHINY_VALUE_MULT = 9;       // shinies sell for ~9x

  // One-time purchasable items
  const ITEMS = {
    goggles: {
      name: "Wide-View Goggles",
      desc: "Crystal-clear goggles — see much further underwater and spot distant fish from a long way off.",
      cost: 4000,
    },
    shinyPocket: {
      name: "Shiny Pocket",
      desc: "A magic pouch — you can still grab shiny catches even when your cargo hold is full.",
      cost: 6000,
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
