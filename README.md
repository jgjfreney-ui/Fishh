# 🌊 Deep Sea Diver 🐙

A browser-based deep sea diving & fishing game. Dive into the ocean, catch fish
to sell, raid shipwrecks for treasure, upgrade your gear at the helpful shop,
and chase the ultimate prize — **the Kraken**, which only surfaces once you've
catalogued every other fish in the sea.

## Play

No build step, no server needed. Just open **`index.html`** in any modern
browser (or serve the folder and visit it).

```
# optional: run a tiny local server
python3 -m http.server
# then open http://localhost:8000
```

## Controls

- **WASD / Arrow keys** — swim
- Get **near a fish** to automatically reel it in (watch the yellow meter)
- Watch your **oxygen** — run out and you black out, dropping your catch!
- Return to the **surface** (top) and press **Space** to climb aboard the boat
- From the boat you can **sell**, visit the **shop**, browse your
  **collection**, change **dive site**, and **save**

## Features

- 🐟 **40+ fish** across four dive sites, each with rarity tiers
  (Common → Mythic)
- 📏 **Fish size / inventory system** — a whale eats far more cargo space than
  a cod; upgrade your Cargo Hold to carry more
- 🌑 **Depth system** — the deeper you dive, the better the rarity odds (and the
  faster your oxygen drains)
- ✨ **Shiny variants** — every fish has a rare recoloured shiny form worth ~9×.
  Catch a **shiny Kraken** for the secret ending
- 🛒 **Helpful Shop** — Oxygen Tanks, Fins, Catch Gadgets, Reel Motors, Cargo
  Hold, Diving Suit and Dive Light upgrades
- 🔮 **Stackable charms** — **Rarity Charms** tilt the odds toward rarer fish,
  **Shiny Charms** raise your shiny chance. Stack as many as you can afford
- 🗺️ **Four locations** — Coral Coast, Kelp Forest, Sunken Trench, and the
  **Starlight Sanctuary** where shiny odds are dramatically higher
- 🤫 **Secret fish** — each area hides a secret species; buy its hint at the
  shop, then meet the condition to find it
- 🏴‍☠️ **Shipwrecks & treasure** — recover loot from wrecks to pawn for cash
- 💾 **3 save slots** — progress is stored in your browser
- 🦑 **Two endings** — defeat the Kraken, or catch it shiny for the secret ending

## Project layout

```
index.html      # page + HUD markup
css/style.css   # all styling
js/data.js      # game content: fish, treasures, shop items, locations
js/game.js      # engine, rendering, gameplay & UI logic
```

Have fun, and mind your oxygen down there. 🫧
