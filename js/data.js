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
      shinyBonus: 0, unlocked: false, cost: 15000,
      sky: { top: "#d4ebf7", bottom: "#f0f9ff" },
    },
    opensea: {
      id: "opensea", name: "Open Sea", tint: "#2f8fe0",
      blurb: "Endless blue with no land in sight — giant pelagic wanderers cruise the open water.",
      maxDepth: 850, worldWidth: 2800, topColor: "#1f7fc4", deepColor: "#04204a",
      shinyBonus: 0, unlocked: false, cost: 40000,
      sky: { top: "#aee0ff", bottom: "#e8f6ff" },
    },
    ancient: {
      id: "ancient", name: "Fossil Abyss", tint: "#c79a52",
      blurb: "A primordial sea sealed in the deep, where prehistoric monsters never went extinct.",
      maxDepth: 1000, worldWidth: 2600, topColor: "#5e7050", deepColor: "#160f04",
      shinyBonus: 0, unlocked: false, cost: 110000,
      sky: { top: "#cdbb8a", bottom: "#ece0c0" },
    },
    trench: {
      id: "trench", name: "Sunken Trench", tint: "#5a6cff",
      blurb: "The deepest, final frontier — a crushing abyss where the Kraken itself waits.",
      maxDepth: 1400, worldWidth: 2600, topColor: "#13496e", deepColor: "#01040c",
      shinyBonus: 0, unlocked: false, cost: 1000000,
      requireAreas: ["river", "kelp", "arctic", "ancient", "opensea"], // always the last to unlock
      sky: { top: "#86b4d4", bottom: "#cfe8f2" },
    },
    forest: {
      id: "forest", name: "Sunken Grove", tint: "#5fae4a",
      blurb: "A drowned old-growth forest — sun filters through towering submerged trees draped in green.",
      maxDepth: 600, worldWidth: 2600, topColor: "#3f8f5a", deepColor: "#0a2415",
      shinyBonus: 0, unlocked: false, cost: 130000,
      sky: { top: "#bfe8c0", bottom: "#eafce0" },
    },
    swamp: {
      id: "swamp", name: "Mangrove Swamp", tint: "#7a8a3a",
      blurb: "Murky brackish water thick with roots and gators. Watch the shallows.",
      maxDepth: 500, worldWidth: 2400, topColor: "#5a6a3a", deepColor: "#16200c",
      shinyBonus: 0, unlocked: false, cost: 180000,
      sky: { top: "#aebf8a", bottom: "#d6e0b0" },
    },
    boneyard: {
      id: "boneyard", name: "The Boneyard", tint: "#d8d2c0",
      blurb: "A vast whale-fall graveyard where titans came to die. Bones glow pale in the gloom.",
      maxDepth: 1200, worldWidth: 2600, topColor: "#3a4450", deepColor: "#05070a",
      shinyBonus: 0.05, unlocked: false, cost: 250000,
      sky: { top: "#8a96a4", bottom: "#cdd6de" },
    },
    backrooms: {
      id: "backrooms", name: "The Backrooms", tint: "#d8c84a", secret: true,
      blurb: "You weren't supposed to find this. Endless damp yellow rooms, humming lights, water that shouldn't be here.",
      maxDepth: 700, worldWidth: 3000, topColor: "#c8b84a", deepColor: "#5a5018",
      shinyBonus: 0.15, unlocked: false, cost: 0,
      sky: { top: "#d8c860", bottom: "#b8a838" },
    },
    japan: {
      id: "japan", name: "Hidden Coast", tint: "#e0556a", secret: true,
      blurb: "A secret koi-filled coast beneath red torii gates — and something colossal sleeping offshore.",
      maxDepth: 900, worldWidth: 2800, topColor: "#3a6fb0", deepColor: "#0a1a3a",
      shinyBonus: 0.1, unlocked: false, cost: 0,
      sky: { top: "#ffd6e0", bottom: "#ffeef2" },
    },
    secretcave: {
      id: "secretcave", name: "Hollow Deep", tint: "#9a8ad0", secret: true,
      blurb: "A still, lightless pocket of the cavern that only opens to those who arrive unarmed by boss relics.",
      maxDepth: 700, worldWidth: 2200, topColor: "#26303a", deepColor: "#03040a",
      shinyBonus: 0.1, unlocked: false, cost: 0,
      sky: { top: "#1a2230", bottom: "#0a0e16" },
    },
    cave: {
      id: "cave", name: "Gloom Cavern", tint: "#8a7ad0",
      blurb: "A creepy flooded cavern where every kind of sea creature gathers — drifting freely in the dark. Something huge skitters below.",
      maxDepth: 800, worldWidth: 2600, topColor: "#2a3340", deepColor: "#04050a",
      shinyBonus: 0.12, unlocked: false, cost: 280000,
      caveArea: true, creaturePool: true, requireAllCreatures: true,
      sky: { top: "#1a2230", bottom: "#0a0e16" },
    },
    cloud: {
      id: "cloud", name: "Cloud Reaches", tint: "#bfe0ff",
      blurb: "Climb above the waves into a dreamlike sky and catch the birds themselves. Shinies bloom thick up here.",
      maxDepth: 600, worldWidth: 2600, topColor: "#bfe8ff", deepColor: "#6f9fd0",
      shinyBonus: 0.2, unlocked: false, cost: 320000,
      airArea: true, birdPool: true, requireAllBirds: true,
      sky: { top: "#cdeeff", bottom: "#eaf8ff" },
    },
    sanctuary: {
      id: "sanctuary", name: "Starlight Sanctuary", tint: "#b07bff",
      blurb: "A post-game paradise where EVERY creature in the sea gathers — and shinies bloom like stars.",
      maxDepth: 900, worldWidth: 2600, topColor: "#5a3ea8", deepColor: "#0a0226",
      shinyBonus: 0.25, starfield: true, allContent: true, unlocked: false, cost: 600000,
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
    { id: "clownfish",  name: "Clownfish",   area: "coral", rarity: "common",   size: 1, value: 18,  minDepth: 0,   color: "#ff7a18", shape: "fish" },
    { id: "cod",        name: "Cod",         area: "coral", rarity: "common",   size: 1, value: 22,  minDepth: 0,   color: "#bda079", shape: "fish" },
    { id: "seabass",    name: "Sea Bass",    area: "coral", rarity: "common",   size: 1, value: 26,  minDepth: 20,  color: "#8fa6b0", shape: "fish" },
    { id: "angelfish",  name: "Angelfish",   area: "coral", rarity: "uncommon", size: 1, value: 70,  minDepth: 40,  color: "#ffd84a", shape: "tang" },
    { id: "parrotfish", name: "Parrotfish",  area: "coral", rarity: "uncommon", size: 2, value: 95,  minDepth: 60,  color: "#36d6a0", shape: "fish" },
    { id: "pufferfish", name: "Pufferfish",  area: "coral", rarity: "uncommon", size: 2, value: 110, minDepth: 80,  color: "#c8d24a", shape: "round" },
    { id: "lionfish",   name: "Lionfish",    area: "coral", rarity: "rare",     size: 2, value: 240, minDepth: 120, color: "#e0533a", shape: "fish" },
    { id: "seaturtle",  name: "Sea Turtle",  area: "coral", rarity: "rare",     size: 3, value: 320, minDepth: 100, color: "#4f9e5e", shape: "turtle" },
    { id: "reefshark",  name: "Reef Shark",  area: "coral", rarity: "epic",     size: 4, value: 900, minDepth: 180, color: "#7d93a3", shape: "shark" },

    // ---- Kelp Forest ----
    { id: "mackerel",   name: "Mackerel",    area: "kelp", rarity: "common",   size: 1, value: 28,   minDepth: 0,   color: "#5fa8c4", shape: "longfish" },
    { id: "herring",    name: "Herring",     area: "kelp", rarity: "common",   size: 1, value: 30,   minDepth: 20,  color: "#aebfc9", shape: "longfish" },
    { id: "seahorse",   name: "Seahorse",    area: "kelp", rarity: "uncommon", size: 1, value: 85,   minDepth: 40,  color: "#e6a13c", shape: "seahorse" },
    { id: "seaotter",   name: "Sea Otter",   area: "kelp", rarity: "uncommon", size: 2, value: 130,  minDepth: 30,  color: "#8a5a32", shape: "otter" },
    { id: "morayeel",   name: "Moray Eel",   area: "kelp", rarity: "rare",     size: 2, value: 270,  minDepth: 150, color: "#5c7a3a", shape: "eel" },
    { id: "octopus",    name: "Octopus",     area: "kelp", rarity: "rare",     size: 3, value: 360,  minDepth: 180, color: "#c05f8f", shape: "octopus" },
    { id: "giantsquid", name: "Giant Squid", area: "kelp", rarity: "epic",     size: 5, value: 1300, minDepth: 360, color: "#d06a5a", shape: "squid" },

    // ---- Open water (appears in coral/kelp/trench mid depths) ----
    { id: "tuna",       name: "Bluefin Tuna", area: "kelp",   rarity: "rare",     size: 3, value: 300,  minDepth: 120, color: "#3a6fb0", shape: "longfish" },
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
    { id: "aurorafish",  name: "Aurora Fish",     area: "sanctuary", rarity: "uncommon", size: 1, value: 150,  minDepth: 60,  color: "#7affd0", shape: "tang" },
    { id: "cosmicray",   name: "Cosmic Ray",      area: "sanctuary", rarity: "rare",     size: 4, value: 520,  minDepth: 150, color: "#7a5cff", shape: "ray" },
    { id: "nebulaeel",   name: "Nebula Eel",      area: "sanctuary", rarity: "rare",     size: 3, value: 560,  minDepth: 220, color: "#c46bff", shape: "eel" },
    { id: "prismtang",   name: "Prismatic Tang",  area: "sanctuary", rarity: "epic",     size: 2, value: 1400, minDepth: 300, color: "#ff8be0", shape: "tang" },
    { id: "galaxywhale", name: "Galaxy Whale",    area: "sanctuary", rarity: "legendary",size: 8, value: 6000, minDepth: 500, color: "#3a2c78", shape: "whale" },

    // ======== Wave 2 content: +5 per area ========
    // ---- Coral Coast ----
    { id: "damselfish", name: "Damselfish",   area: "coral", rarity: "common",   size: 1, value: 24,  minDepth: 0,   color: "#3a7bd5", shape: "fish" },
    { id: "butterflyfish", name: "Butterflyfish", area: "coral", rarity: "uncommon", size: 1, value: 72, minDepth: 30, color: "#ffcf3a", shape: "tang" },
    { id: "moorishidol", name: "Moorish Idol", area: "coral", rarity: "uncommon", size: 1, value: 90,  minDepth: 50,  color: "#f0e6c8", shape: "tang" },
    { id: "triggerfish", name: "Triggerfish",  area: "coral", rarity: "rare",     size: 2, value: 230, minDepth: 90,  color: "#2f8f7a", shape: "fish" },
    { id: "sandtiger",  name: "Sand Tiger Shark", area: "coral", rarity: "epic",  size: 4, value: 1000, minDepth: 150, color: "#9aa6ad", shape: "shark" },

    // ---- Kelp Forest ----
    { id: "kelpfish",   name: "Kelpfish",      area: "kelp", rarity: "common",   size: 1, value: 30,  minDepth: 0,   color: "#5a8f3a", shape: "fish" },
    { id: "rockfish",   name: "Rockfish",      area: "kelp", rarity: "common",   size: 2, value: 44,  minDepth: 40,  color: "#b05a4a", shape: "fish" },
    { id: "garibaldi",  name: "Garibaldi",     area: "kelp", rarity: "uncommon", size: 1, value: 95,  minDepth: 30,  color: "#ff7a18", shape: "tang" },
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
    { id: "pike",       name: "Pike",          area: "river", rarity: "rare",     size: 3, value: 260, minDepth: 60,  color: "#4a6a4a", shape: "longfish" },
    { id: "rivereel",   name: "River Eel",     area: "river", rarity: "rare",     size: 2, value: 300, minDepth: 80,  color: "#5c6a3a", shape: "eel" },
    { id: "sturgeon",   name: "Sturgeon",      area: "river", rarity: "epic",     size: 5, value: 900, minDepth: 100, color: "#7a8a6a", shape: "fish" },

    // ---- Secret fish (need a purchased hint + a condition; spawn rarely) ----
    // Special catch methods: circle = swim in tight circles · lowOxygen = let
    // your air drop low · fast = move at full speed · still = stay perfectly still.
    { id: "dolphin",    name: "Spinner Dolphin", area: "coral", rarity: "mythic", size: 4, value: 5200, minDepth: 0, color: "#8fb0c4", accent: "#ffffff", shape: "dolphin", secret: true,
      hint: "A playful spinner — it only leaps out to copy you. Swim in tight CIRCLES to call it!",
      condition: { circle: true } },
    { id: "seaangel",   name: "Sea Angel",     area: "arctic", rarity: "mythic", size: 1, value: 6500, minDepth: 60, color: "#cfe8ff", accent: "#ffd24a", shape: "clione", secret: true,
      hint: "A clione that drifts to divers near their last breath — let your OXYGEN run very low (below 20%).",
      condition: { lowOxygen: true } },
    { id: "sailfish",   name: "Sailfish",      area: "river", rarity: "mythic", size: 4, value: 5800, minDepth: 30, color: "#3a6fb0", accent: "#7affd0", shape: "sword", secret: true,
      hint: "The fastest fish in the sea — it only races into view when YOU are moving at full speed (max fins help!).",
      condition: { fast: true } },
    { id: "stonefish",  name: "Stonefish",     area: "kelp", rarity: "mythic", size: 2, value: 4800, minDepth: 80, color: "#7a6a4a", accent: "#e0533a", shape: "round", secret: true,
      hint: "A master of disguise — hold perfectly STILL on the seabed and it may reveal itself.",
      condition: { still: true } },
    { id: "goldenkoi",  name: "Golden Koi",    area: "coral",     rarity: "mythic", size: 2, value: 2600, minDepth: 0,   color: "#ffd54a", accent: "#fff3b0", shape: "fish",  secret: true,
      hint: "Shimmers only in the brightest shallows of Coral Coast (above 60m). Rare and skittish.",
      condition: { maxDepth: 60 } },
    { id: "leafydragon",name: "Leafy Seadragon",area: "kelp",      rarity: "mythic", size: 2, value: 3000, minDepth: 100,color: "#7fc36b", shape: "seahorse", secret: true,
      hint: "Camouflaged among deep kelp (below 100m). You must be patient and still.",
      condition: { minDepth: 100 } },
    { id: "deeplev",    name: "Deep Leviathan", area: "trench",    rarity: "mythic", size: 9, value: 9000, minDepth: 900,color: "#3a4e6a", shape: "eel", secret: true,
      hint: "A colossal sea-serpent coils through the very bottom of the Trench (below 900m). Only the brave reach it.",
      condition: { minDepth: 900 } },
    { id: "celestserp", name: "Astral Serpent",area:"sanctuary",rarity: "mythic", size: 7, value: 12000,minDepth: 400,color: "#c9b3ff", shape: "eel", secret: true,
      hint: "Coils through the deepest starlight (below 400m), woven from the night sky itself.",
      condition: { minDepth: 400 } },
    { id: "rainbowtrout", name: "Rainbow Trout", area: "river", rarity: "mythic", size: 2, value: 3400, minDepth: 0, color: "#ff4d6d", accent: "#7afcff", rainbow: true, shape: "fish", secret: true,
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
    // +1 more creature per area (varying rarity)
    { id: "hermitcrab", name: "Hermit Crab",  area: "coral", creature: true, rarity: "rare",      size: 1, value: 320,  color: "#c98a5a", shape: "crab" },
    { id: "riversnail", name: "River Snail",  area: "river", creature: true, rarity: "common",    size: 1, value: 45,   color: "#7a6a4a", shape: "urchin" },
    { id: "abalone",    name: "Abalone",      area: "kelp",  creature: true, rarity: "uncommon",  size: 1, value: 150,  color: "#8a7a9a", shape: "urchin" },
    { id: "seacucumber",name: "Sea Cucumber", area: "trench", creature: true, rarity: "rare",     size: 2, value: 380,  color: "#6a4a5a", shape: "bug" },
    { id: "voidstar",   name: "Void Star",    area: "sanctuary", creature: true, rarity: "legendary", size: 1, value: 1800, color: "#9f7bff", shape: "starfish" },
    // ---- Hollow Deep (the secret cave) — its own creatures + fish ----
    // (Gloom Cavern itself now just gathers all the PRE-EXISTING creatures.)
    { id: "cavefish",   name: "Blind Cavefish", area: "secretcave", rarity: "common",   size: 1, value: 140,  minDepth: 0, color: "#e8dcd0", shape: "fish" },
    { id: "ghostshrimp",name: "Ghost Shrimp",   area: "secretcave", creature: true, rarity: "rare",      size: 1, value: 360,  color: "#cfe0e8", shape: "bug" },
    { id: "cavecrab",   name: "Cave Crab",      area: "secretcave", creature: true, rarity: "uncommon",  size: 2, value: 300,  color: "#7a5a4a", shape: "crab" },
    { id: "glowsnail",  name: "Glow Snail",     area: "secretcave", creature: true, rarity: "epic",      size: 1, value: 900,  color: "#8affc0", shape: "urchin" },

    // ======== Nocturnal fish (ONLY appear on night dives) — 2 per area ========
    { id: "lanterneye",  name: "Lantern-eye",      area: "coral",   night: true, rarity: "rare",  size: 2, value: 360,  minDepth: 60,  color: "#2a6a7a", accent: "#7afcff", shape: "lanternjaw" },
    { id: "moonwrasse",  name: "Moon Wrasse",      area: "coral",   night: true, rarity: "uncommon", size: 2, value: 220, minDepth: 0,  color: "#3a5aa0", accent: "#dfe8ff", shape: "moonfish" },
    { id: "nightcat",    name: "Night Catfish",    area: "river",   night: true, rarity: "uncommon", size: 2, value: 240, minDepth: 0,  color: "#5a4a3a", accent: "#cabba0", shape: "catfish" },
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
    { id: "sunbasker",   name: "Sun Basker",     area: "coral",   day: true, rarity: "uncommon", size: 2, value: 200, minDepth: 0,  color: "#ffd24a", accent: "#fff3b0", shape: "tang" },
    { id: "daygoby",     name: "Dawn Goby",      area: "coral",   day: true, rarity: "common",   size: 1, value: 90,  minDepth: 0,  color: "#ff9a4a", accent: "#fff0c0", shape: "fish" },
    { id: "sunperch",    name: "Sun Perch",      area: "river",   day: true, rarity: "uncommon", size: 1, value: 180, minDepth: 0,  color: "#f0b53a", accent: "#fff0c0", shape: "fish" },
    { id: "glintminnow", name: "Glint Minnow",   area: "river",   day: true, rarity: "common",   size: 1, value: 80,  minDepth: 0,  color: "#9fe0c0", accent: "#ffffff", shape: "longfish" },
    { id: "kelpdarter",  name: "Kelp Darter",    area: "kelp",    day: true, rarity: "rare",     size: 2, value: 360, minDepth: 40, color: "#6cae4a", accent: "#dfffb0", shape: "longfish" },
    { id: "sunwrasse",   name: "Sun Wrasse",     area: "kelp",    day: true, rarity: "uncommon", size: 1, value: 210, minDepth: 20, color: "#ffb24a", accent: "#fff0c0", shape: "tang" },
    { id: "icebasker",   name: "Ice Basker",     area: "arctic",  day: true, rarity: "rare",     size: 3, value: 420, minDepth: 40, color: "#cdeeff", accent: "#ffffff", shape: "fish" },
    { id: "snowjack",    name: "Snow Jack",      area: "arctic",  day: true, rarity: "uncommon", size: 2, value: 240, minDepth: 20, color: "#dfeef7", accent: "#bcd0dc", shape: "longfish" },
    { id: "sundialfish", name: "Sundial Fish",   area: "ancient", day: true, rarity: "rare",     size: 3, value: 460, minDepth: 80, color: "#c79a52", accent: "#ffe14d", shape: "coelacanth" },
    { id: "amberray",    name: "Amber Ray",      area: "ancient", day: true, rarity: "epic",     size: 4, value: 1100,minDepth: 150,color: "#d8a24a", accent: "#fff0c0", shape: "ray" },
    { id: "sunfintuna",  name: "Sunfin Tuna",    area: "opensea", day: true, rarity: "rare",     size: 4, value: 520, minDepth: 80, color: "#3a8fd0", accent: "#ffe14d", shape: "longfish" },
    { id: "goldenmola",  name: "Golden Mola",    area: "opensea", day: true, rarity: "epic",     size: 5, value: 1300,minDepth: 120,color: "#e0b24a", accent: "#fff3b0", shape: "moonfish" },
    { id: "glarefish",   name: "Glare Fish",     area: "trench",  day: true, rarity: "rare",     size: 2, value: 480, minDepth: 300,color: "#7fa0c0", accent: "#ffffff", shape: "lantern" },
    { id: "prismcod",    name: "Prism Cod",      area: "trench",  day: true, rarity: "uncommon", size: 2, value: 260, minDepth: 200,color: "#bcd0e0", accent: "#fff0c0", shape: "fish" },
    { id: "solartang",   name: "Solar Tang",     area: "sanctuary", day: true, rarity: "epic",   size: 2, value: 1500,minDepth: 100,color: "#ffd24a", accent: "#fff3b0", shape: "tang" },
    { id: "dawnstar",    name: "Dawn Starfish",  area: "sanctuary", day: true, rarity: "rare",    size: 2, value: 640, minDepth: 60, color: "#ffb24a", accent: "#fff0c0", shape: "starfish" },

    // ---- one nocturnal bird + one nocturnal sea creature (night only) ----
    { id: "nightowl",   name: "Night Owl",      area: "river", bird: true, night: true, rarity: "rare", size: 2, value: 520, color: "#6a5a4a", accent: "#e0d2b0", shape: "owl", seedCost: 800 },
    { id: "fireflysquid", name: "Firefly Squid", area: "kelp", creature: true, night: true, rarity: "rare", size: 1, value: 420, color: "#3a4a8a", accent: "#7afcff", shape: "slug" },

    // ======== Sunken Grove (forest) ========
    { id: "grovefish",  name: "Grovefish",    area: "forest", rarity: "common",   size: 1, value: 60,  minDepth: 0,   color: "#6cae4a", shape: "fish" },
    { id: "mossback",   name: "Mossback Turtle", area: "forest", rarity: "uncommon", size: 3, value: 280, minDepth: 40, color: "#4f7a3a", shape: "turtle" },
    { id: "branchpike", name: "Branch Pike",  area: "forest", rarity: "uncommon", size: 2, value: 220, minDepth: 30,  color: "#7a6a3a", shape: "longfish" },
    { id: "canopyray",  name: "Canopy Ray",   area: "forest", rarity: "rare",     size: 4, value: 540, minDepth: 120, color: "#5a8a4a", shape: "ray" },
    { id: "willoweel",  name: "Willow Eel",   area: "forest", rarity: "rare",     size: 3, value: 480, minDepth: 180, color: "#3a6a3a", shape: "eel" },
    { id: "ancientcarp",name: "Ancient Carp", area: "forest", rarity: "epic",     size: 5, value: 1500,minDepth: 300, color: "#8a9a4a", shape: "fish" },
    { id: "grovebeetle",name: "Grove Beetle", area: "forest", creature: true, rarity: "common", size: 1, value: 90, color: "#4a6a2a", shape: "bug" },
    { id: "grovewarden",name: "Grove Warden", area: "forest", areaBoss: true, rarity: "mythic", size: 12, value: 14000, minDepth: 200, color: "#3a5a2a", accent: "#9fe0a0", shape: "mosasaur", hp: 4, reward: "" },

    // ======== Mangrove Swamp ========
    { id: "swamppike",  name: "Swamp Pike",   area: "swamp", rarity: "common",   size: 2, value: 70,  minDepth: 0,   color: "#5a6a3a", shape: "longfish" },
    { id: "gar",        name: "Alligator Gar",area: "swamp", rarity: "uncommon", size: 3, value: 260, minDepth: 30,  color: "#6a5a3a", shape: "eel" },
    { id: "bullfrogfish",name: "Bullfrog Fish",area: "swamp", rarity: "uncommon", size: 2, value: 200, minDepth: 0,  color: "#6a8a3a", shape: "round" },
    { id: "snapper",    name: "Snapping Turtle", area: "swamp", rarity: "rare", size: 3, value: 420, minDepth: 60,   color: "#3a4a2a", shape: "turtle" },
    { id: "mudcat",     name: "Mud Catfish",  area: "swamp", rarity: "rare",     size: 3, value: 480, minDepth: 120, color: "#4a3a2a", shape: "catfish" },
    { id: "swampgator", name: "Baby Gator",   area: "swamp", rarity: "epic",     size: 5, value: 1400,minDepth: 200, color: "#3a4a28", shape: "crocodile" },
    { id: "swampcrab",  name: "Marsh Crab",   area: "swamp", creature: true, rarity: "common", size: 1, value: 80, color: "#7a5a3a", shape: "crab" },
    { id: "swampcroc",  name: "Swamp Croc",   area: "swamp", areaBoss: true, rarity: "mythic", size: 12, value: 16000, minDepth: 200, color: "#2f3a22", accent: "#aebf6a", shape: "crocodile", hp: 4, reward: "" },

    // ======== The Boneyard ========
    { id: "bonefish",   name: "Bonefish",     area: "boneyard", rarity: "common",   size: 1, value: 110, minDepth: 0,   color: "#e8e2d0", shape: "fish" },
    { id: "ribeel",     name: "Rib Eel",      area: "boneyard", rarity: "uncommon", size: 3, value: 320, minDepth: 80,  color: "#d8d0bc", shape: "eel" },
    { id: "fossilray",  name: "Fossil Ray",   area: "boneyard", rarity: "rare",     size: 4, value: 620, minDepth: 200, color: "#c8c0aa", shape: "ray" },
    { id: "skullsquid", name: "Skull Squid",  area: "boneyard", rarity: "rare",     size: 4, value: 700, minDepth: 300, color: "#e0d8c4", shape: "squid" },
    { id: "marrowshark",name: "Marrow Shark", area: "boneyard", rarity: "epic",     size: 6, value: 2200, minDepth: 400, color: "#d0c8b4", shape: "shark" },
    { id: "wraithwhale",name: "Wraith Whale", area: "boneyard", rarity: "legendary",size: 9, value: 6500, minDepth: 600, color: "#cfd6dc", shape: "whale" },
    { id: "bonecrab",   name: "Bone Crab",    area: "boneyard", creature: true, rarity: "uncommon", size: 2, value: 280, color: "#ded6c2", shape: "crab" },
    { id: "skeletonshark", name: "Skeleton Shark", area: "boneyard", areaBoss: true, rarity: "mythic", size: 13, value: 22000, minDepth: 300, color: "#f2eede", accent: "#cfc6b0", shape: "skeletonshark", hp: 5, reward: "" },

    // ======== The Backrooms (secret) ========
    { id: "wallpaperfish", name: "Wallpaper Fish", area: "backrooms", rarity: "common", size: 2, value: 200, minDepth: 0, color: "#d8c468", accent: "#b8a038", shape: "wallpaperfish" },
    { id: "weircorejelly", name: "Weirdcore Jelly", area: "backrooms", rarity: "uncommon", size: 3, value: 360, minDepth: 20, color: "#c8b84a", accent: "#fff6a0", shape: "glowjelly" },
    { id: "bacteriaurchin", name: "Bacteria Urchin", area: "backrooms", rarity: "uncommon", size: 2, value: 320, minDepth: 40, color: "#9aa83a", accent: "#dfff6a", shape: "urchin" },
    { id: "hazmatshark", name: "Hazmat Shark", area: "backrooms", rarity: "epic", size: 6, value: 2400, minDepth: 120, color: "#e0c83a", accent: "#1a1a1a", shape: "shark" },
    { id: "poolnoodle", name: "Pool Noodle Eel", area: "backrooms", rarity: "rare", size: 3, value: 520, minDepth: 80, color: "#4ad0e0", accent: "#ffffff", shape: "eel" },
    { id: "cctvfish",   name: "CCTV Fish",    area: "backrooms", rarity: "mythic", size: 2, value: 4000, minDepth: 0, color: "#7a8a90", accent: "#ff4040", shape: "cctv", secret: true,
      hint: "They watch from the corners. Linger at the very edges of the rooms and one will find you.", condition: { corner: true } },
    { id: "bacteriawhale", name: "Bacteria Whale", area: "backrooms", areaBoss: true, rarity: "mythic", size: 13, value: 24000, minDepth: 200, color: "#b8c83a", accent: "#eaff8a", shape: "bacteriawhale", hp: 5, reward: "" },

    // ======== Hidden Coast (secret, Japanese) ========
    { id: "koi",        name: "Koi",          area: "japan", rarity: "common",   size: 1, value: 120, minDepth: 0,   color: "#ff7a3a", accent: "#ffffff", shape: "fish" },
    { id: "nishikigoi", name: "Nishikigoi",   area: "japan", rarity: "uncommon", size: 2, value: 280, minDepth: 0,   color: "#ff9a4a", accent: "#ffffff", shape: "fish" },
    { id: "tai",        name: "Red Tai",      area: "japan", rarity: "uncommon", size: 2, value: 240, minDepth: 20,  color: "#e0556a", accent: "#ffd6e0", shape: "tang" },
    { id: "katsuo",     name: "Katsuo",       area: "japan", rarity: "rare",     size: 3, value: 420, minDepth: 60,  color: "#3a6fb0", shape: "longfish" },
    { id: "ryukin",     name: "Ryukin",       area: "japan", rarity: "rare",     size: 2, value: 460, minDepth: 30,  color: "#ff5b3a", accent: "#ffe14d", shape: "round" },
    { id: "tairyu",     name: "Tatsu Dragon", area: "japan", rarity: "epic",     size: 6, value: 2200, minDepth: 200, color: "#c0423a", accent: "#ffd24a", shape: "eel" },
    { id: "japcrab",    name: "Heikegani Crab", area: "japan", creature: true, rarity: "uncommon", size: 2, value: 300, color: "#b0503a", shape: "crab" },
    { id: "kaiju",      name: "The Kaiju",    area: "japan", areaBoss: true, rarity: "mythic", size: 14, value: 30000, minDepth: 250, color: "#2f4a3a", accent: "#6affc0", shape: "kaiju", hp: 6, reward: "" },

    // ======== Hollow Deep (secret cave) — Olm is its secret fish ========
    { id: "olm",        name: "Olm",          area: "secretcave", rarity: "epic", size: 1, value: 1200, minDepth: 0, color: "#f0d6cc", accent: "#ffc0cc", shape: "eel", secret: true,
      hint: "A ghostly blind salamander of the lightless deep — it surfaces only in the Hollow Deep.", condition: {} },
    { id: "cavelantern",name: "Cave Lantern", area: "secretcave", rarity: "rare", size: 2, value: 420, minDepth: 60, color: "#bcd0c0", accent: "#ffe98a", shape: "lantern" },

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

    // ======== Arctic Shelf ========
    { id: "arcticcod",  name: "Arctic Cod",   area: "arctic", rarity: "common",   size: 1, value: 50,   minDepth: 0,   color: "#9fb6c4", shape: "longfish" },
    { id: "capelin",    name: "Capelin",      area: "arctic", rarity: "common",   size: 1, value: 60,   minDepth: 20,  color: "#bcc9d2", shape: "longfish" },
    { id: "arcticchar", name: "Arctic Char",  area: "arctic", rarity: "uncommon", size: 1, value: 150,  minDepth: 40,  color: "#e07a8a", shape: "fish" },
    { id: "halibut",    name: "Halibut",      area: "arctic", rarity: "uncommon", size: 3, value: 260,  minDepth: 120, color: "#5a6a78", shape: "flatfish" },
    { id: "wolffish",   name: "Wolffish",     area: "arctic", rarity: "rare",     size: 2, value: 380,  minDepth: 180, color: "#6a7080", shape: "eel" },
    { id: "beluga",     name: "Beluga",       area: "arctic", rarity: "rare",     size: 6, value: 900,  minDepth: 150, color: "#eef4f8", shape: "whale" },
    { id: "narwhal",    name: "Narwhal",      area: "arctic", rarity: "epic",     size: 6, value: 1700, minDepth: 250, color: "#bcd0dc", shape: "narwhal" },
    { id: "orca",       name: "Orca",         area: "arctic", rarity: "epic",     size: 8, value: 2200, minDepth: 300, color: "#22262c", shape: "whale" },
    { id: "greenlandshark", name: "Greenland Shark", area: "arctic", rarity: "legendary", size: 8, value: 5200, minDepth: 450, color: "#5a6470", shape: "shark" },
    { id: "icecrab",    name: "Ice Crab",     area: "arctic", creature: true, rarity: "common",   size: 1, value: 70,  color: "#a9c6d6", shape: "crab" },
    { id: "brittlestar",name: "Brittle Star", area: "arctic", creature: true, rarity: "uncommon", size: 1, value: 160, color: "#c98a9a", shape: "starfish" },
    { id: "puffin",     name: "Puffin",       area: "arctic", bird: true, rarity: "common",   size: 1, value: 120, color: "#2a2e34", shape: "bird", seedCost: 300 },
    { id: "arctictern", name: "Arctic Tern",  area: "arctic", bird: true, rarity: "uncommon", size: 1, value: 220, color: "#e8eef2", shape: "bird", seedCost: 500 },
    { id: "frostwyrm",  name: "Frost Wyrm",   area: "arctic", rarity: "mythic", size: 9, value: 13000, minDepth: 550, color: "#9fe6ff", shape: "eel", secret: true,
      hint: "An ancient ice-serpent said to coil through the coldest deep (below 550m).", condition: { minDepth: 550 } },

    // ======== Fossil Abyss (prehistoric) ========
    { id: "placoderm",  name: "Placoderm",    area: "ancient", rarity: "common",   size: 2, value: 80,   minDepth: 0,   color: "#7a6a4a", shape: "armored" },
    { id: "paleoherring",name: "Paleo Herring",area: "ancient", rarity: "common",  size: 1, value: 70,   minDepth: 20,  color: "#9a8a6a", shape: "longfish" },
    { id: "coelacanth", name: "Coelacanth",   area: "ancient", rarity: "uncommon", size: 3, value: 320,  minDepth: 80,  color: "#3a5a6a", shape: "coelacanth" },
    { id: "helicoprion",name: "Helicoprion",  area: "ancient", rarity: "rare",     size: 4, value: 560,  minDepth: 200, color: "#6a6052", shape: "shark" },
    { id: "ichthyosaur",name: "Ichthyosaur",  area: "ancient", rarity: "rare",     size: 5, value: 700,  minDepth: 280, color: "#5a6a5a", shape: "shark" },
    { id: "leedsichthys",name: "Leedsichthys",area: "ancient", rarity: "epic",     size: 9, value: 2600, minDepth: 400, color: "#8a7a5a", shape: "whale" },
    { id: "mosasaur",   name: "Mosasaur",     area: "ancient", rarity: "epic",     size: 8, value: 3000, minDepth: 500, color: "#3a4a3a", shape: "mosasaur" },
    { id: "megalodon",  name: "Megalodon",    area: "ancient", rarity: "legendary", size: 10, value: 7800, minDepth: 700, color: "#4a5560", shape: "shark" },
    { id: "trilobite",  name: "Trilobite",    area: "ancient", creature: true, rarity: "common",   size: 1, value: 90,   color: "#7a5a3a", shape: "trilobite" },
    { id: "ammonite",   name: "Ammonite",     area: "ancient", creature: true, rarity: "uncommon", size: 2, value: 240,  color: "#a08a5a", shape: "ammonite" },
    { id: "archaeopteryx", name: "Archaeopteryx", area: "ancient", bird: true, rarity: "uncommon", size: 1, value: 260, color: "#6a5a3a", shape: "bird", seedCost: 600 },
    { id: "pteranodon", name: "Pteranodon",   area: "ancient", bird: true, rarity: "rare", size: 3, value: 700, color: "#8a6a4a", shape: "bird", seedCost: 1500 },
    { id: "ancientlev", name: "Ancient Leviathan", area: "ancient", rarity: "mythic", size: 10, value: 16000, minDepth: 800, color: "#5a4a2a", shape: "eel", secret: true,
      hint: "The first and largest serpent, fossilised legends say it still hunts the abyss floor (below 800m).", condition: { minDepth: 800 } },

    // ======== Open Sea ========
    { id: "mahimahi",  name: "Mahi-Mahi",    area: "opensea", rarity: "common",   size: 2, value: 90,  minDepth: 0,   color: "#3ad0a0", shape: "longfish" },
    { id: "flyingfish",name: "Flying Fish",  area: "opensea", rarity: "common",   size: 1, value: 70,  minDepth: 0,   color: "#5fb0e0", shape: "longfish" },
    { id: "skipjack",  name: "Skipjack Tuna", area: "opensea", rarity: "common",  size: 2, value: 100, minDepth: 30,  color: "#3a6fb0", shape: "longfish" },
    { id: "wahoo",     name: "Wahoo",        area: "opensea", rarity: "uncommon", size: 3, value: 240, minDepth: 80,  color: "#4a7a9a", shape: "longfish" },
    { id: "opah",      name: "Opah",         area: "opensea", rarity: "uncommon", size: 3, value: 320, minDepth: 100, color: "#e0533a", shape: "tang" },
    { id: "bluemarlin",name: "Blue Marlin",  area: "opensea", rarity: "rare",     size: 5, value: 700, minDepth: 160, color: "#2a4a8a", shape: "sword" },
    { id: "whaleshark",name: "Whale Shark",  area: "opensea", rarity: "epic",     size: 9, value: 2400, minDepth: 250, color: "#4a6a7a", shape: "shark" },
    { id: "bluewhale", name: "Blue Whale",   area: "opensea", rarity: "legendary", size: 10, value: 7000, minDepth: 400, color: "#3a5a8a", shape: "whale" },
    { id: "glasssquid",name: "Glass Squid",  area: "opensea", creature: true, rarity: "uncommon", size: 1, value: 180, color: "#bfe6ff", shape: "urchin" },
    { id: "seaspider", name: "Sea Spider",   area: "opensea", creature: true, rarity: "rare",     size: 2, value: 340, color: "#8a6a5a", shape: "crab" },
    { id: "booby",     name: "Booby",        area: "opensea", bird: true, rarity: "common",   size: 1, value: 140, color: "#cdb89a", shape: "bird", seedCost: 400 },
    { id: "frigatebird",name: "Frigatebird", area: "opensea", bird: true, rarity: "uncommon", size: 2, value: 260, color: "#2a2e34", shape: "bird", seedCost: 600 },
    { id: "phantomjelly", name: "Phantom Jelly", area: "opensea", rarity: "mythic", size: 6, value: 7000, minDepth: 120, color: "#15131c", accent: "#7affd0", shape: "jelly", secret: true,
      hint: "A ghostly giant jelly that rises only to the breathless — let your oxygen run very low.", condition: { lowOxygen: true } },

    // ======== Area bosses (rise once you've caught every fish in their area) ========
    { id: "manowar",   name: "Man o' War",   area: "coral",   areaBoss: true, rarity: "mythic", size: 7,  value: 3000, minDepth: 120, color: "#b06bd0", accent: "#ffd6f2", shape: "manowar", hp: 3, reward: "stinger" },
    { id: "siphonophore", name: "Siphonophore", area: "opensea", areaBoss: true, rarity: "mythic", size: 10, value: 6000, minDepth: 200, color: "#ff6f91", shape: "siphonophore", hp: 3, reward: "necklace" },
    { id: "apexmega",  name: "Apex Megalodon", area: "ancient", areaBoss: true, rarity: "mythic", size: 12, value: 8000, minDepth: 300, color: "#3a4650", shape: "megalodon", hp: 3, reward: "megtooth" },
    { id: "rogueorca", name: "Rogue Orca",    area: "arctic",  areaBoss: true, trigger: "creatures", rarity: "mythic", size: 11, value: 5000, minDepth: 250, color: "#16181d", accent: "#f2f6fa", shape: "orca", hp: 3, reward: "sonar" },
    { id: "roc",       name: "The Roc",       area: "cloud",   areaBoss: true, rarity: "mythic", size: 12, value: 9000, minDepth: 200, color: "#6a4a2a", accent: "#d8c0a0", shape: "roc", hp: 3, reward: "rocfeather" },
    { id: "spidercrab", name: "Colossal Spider Crab", area: "cave", areaBoss: true, rarity: "mythic", size: 12, value: 9000, minDepth: 250, color: "#8a3a2a", accent: "#e0a060", shape: "spidercrab", hp: 3, reward: "crabcrown" },
    { id: "celestboss", name: "Celestial Serpent", area: "sanctuary", areaBoss: true, rarity: "mythic", size: 13, value: 40000, minDepth: 200, color: "#9f7bff", accent: "#fff3b0", shape: "glowworm", hp: 5, reward: "" },
    { id: "gloomlurker", name: "The Gloom Lurker", area: "cave", areaBoss: true, trigger: "allcreatures", rarity: "mythic", size: 13, value: 26000, minDepth: 300, color: "#2a2438", accent: "#9f8ad0", shape: "angler", hp: 5, reward: "" },
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
    return !f.isKraken && !f.isBlob && !f.areaBoss && !f.secret && LOCATIONS[f.area];
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
      name: "Wide-View Goggles",
      desc: "Crystal-clear goggles — see much further underwater and spot distant fish from a long way off.",
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
