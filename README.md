# 🌊 Deep Sea Diver 🐙

A deep sea diving & fishing game for **Android** (and any modern browser). Dive
into the ocean, catch fish to sell, raid shipwrecks for treasure, upgrade your
gear at the helpful shop, and chase the ultimate prize — **the Kraken**, which
only surfaces once you've catalogued every other fish in the sea.

Built as an HTML5/Canvas game and packaged into an installable Android `.apk`
with [Capacitor](https://capacitorjs.com/).

## Controls (touch)

- **Drag anywhere** on the dive screen — a floating joystick steers your diver
- Swim **near a fish** to automatically reel it in (watch the yellow meter)
- Watch your **oxygen** — run out and you black out, dropping your catch!
- Float to the **surface** and tap **Board the Boat** to sell & shop
- From the boat you can **sell**, visit the **shop**, browse your
  **collection**, change **dive site**, and **save**

*(On desktop, WASD / Arrow keys also work.)*

## Get the APK onto your phone

The easiest way — let GitHub build it for you, no Android tools required:

1. Push this branch (done) and open the repo's **Actions** tab on GitHub
2. Run the **"Build Android APK"** workflow (it also runs automatically on push)
3. When it finishes, download the **`deep-sea-diver-apk`** artifact — inside is
   `deep-sea-diver.apk`
4. Transfer it to your Pixel, then tap it to install. You'll need to allow
   *"Install unknown apps"* for your file manager / browser the first time
   (Settings → Apps → Special access → Install unknown apps).

This is a **debug** APK — perfect for installing on your own device.

## Run it in a browser (quick preview)

```
npm run serve          # builds www/ and serves it at http://localhost:8000
# or just open index.html directly
```

## Build the APK locally (optional)

Requires Node 18+, JDK 17, and the Android SDK (e.g. via Android Studio).

```
npm install
npm run apk            # copies web assets, syncs Capacitor, builds debug APK
# output: android/app/build/outputs/apk/debug/app-debug.apk
```

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
index.html             # game page + HUD (source of truth)
css/style.css          # styling (mobile + desktop)
js/data.js             # content: fish, treasures, shop items, locations
js/game.js             # engine, rendering, touch controls, gameplay & UI
scripts/copy-web.js    # copies the web app into www/ for Capacitor
capacitor.config.json  # Android app id/name/webDir
.github/workflows/android.yml  # CI that builds the installable APK
```

Have fun, and mind your oxygen down there. 🫧
