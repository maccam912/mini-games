# Pocket Cabinet

A static arcade for small single-player games. [Open the arcade](https://maccam912.github.io/mini-games/) to play [Slipstream](https://maccam912.github.io/mini-games/games/slipstream/), [Orbit Hop](https://maccam912.github.io/mini-games/games/orbit-hop/), or [Timberline Dash](https://maccam912.github.io/mini-games/games/timberline-dash/).

## Run locally

Use Node.js 22 or newer, Git LFS, and Python 3 for the preview server. On a fresh clone, run

```sh
git lfs install
git lfs pull
npm test
npm run build
npm run preview
```

Open [localhost:4173](http://localhost:4173). The build has no package dependencies. Rebuild after editing source files. To pick up a new offline game version in a running preview, close all open windows of that game and reopen it.

## Add a game

1. Create `games/<slug>/` using lowercase letters, numbers and hyphens. The slug becomes the game’s permanent URL and installed app identity.
2. Put the playable `index.html`, scripts, styles, artwork and audio in that folder. Keep asset URLs relative. Add `<!-- arcade:head -->` once inside `<head>`. The build inserts the manifest, offline registration, install helpers and theme metadata there.
3. Add a responsive viewport, touch and keyboard controls, and buttons for the shared install and fullscreen actions. The shared module exposes the controls supported by the browser.

   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
   <!-- In the game toolbar -->
   <button type="button" data-install hidden>Install game</button>
   <button type="button" data-fullscreen hidden><span data-fullscreen-label>Fullscreen</span></button>
   ```

4. Add `game.json` alongside the page. All asset filenames are relative to the game folder. Supply square PNG icons at the indicated sizes.

   ```json
   {
     "title": "Moon Garden",
     "description": "Grow a garden on a very small moon.",
     "genre": "Puzzle",
     "controls": "Tap or click",
     "cover": "cover.png",
     "icon192": "icon-192.png",
     "icon512": "icon-512.png",
     "themeColor": "#191525"
   }
   ```

5. Run the tests and build. The directory automatically lists every game by title and links to its own page. To change the homepage feature, move `"featured": true` to the new game. The first game alphabetically is the fallback. Optional `wordmark` artwork replaces the featured title lettering. An optional `maskableIcon` points to a 512×512 PNG designed for launcher cropping.

The build copies the contents of each published game folder and `shared/` to the site. Keep development-only source art outside those folders. Each game’s service worker caches its game and shared files on the first online visit, so keep those assets small and local. Each game has its own offline cache and home-screen launch URL. Test installation over HTTPS or localhost. On iPhone or iPad, use **Share → Add to Home Screen**.

## Timberline Dash

Tap anywhere on the trail or press Space to jump a log. Hold the same control to slide beneath a gate. At a switchback, tap when the turn prompt lights up. The fox takes the bend at the arrow. Press P or use the pause button to pause.

Babylon.js renders the fox and trail meshes. Cannon runs the rigid-body simulation at 60 Hz. Both engines are bundled locally for offline play. To regenerate the pinned bundles and notices, run `node scripts/refresh-timberline-vendor.mjs`.

<details>
<summary>Cover and launcher artwork</summary>

The built-in image generator produced [the cover](games/timberline-dash/cover.webp). The [192px](games/timberline-dash/icon-192.png) and [512px](games/timberline-dash/icon-512.png) launcher icons crop the same illustration.

> Landscape 3:2 full-bleed vintage alpine national park adventure game key art, exquisite colorful screenprinted travel-poster illustration in large confident shaped layers and fine tactile halftone paper grain. No lettering or typography anywhere. Dynamic orange red fox courier with cream cheeks and tail tip, dark socks, little teal canvas satchel, running on all fours in mid leap on a sunlit golden wooden railway trestle in the high mountains. Make the fox clearly recognizable in silhouette with angular face, ears, lively determined gaze. Fox centered at x=68%,y=53%, large enough for a good thumbnail. Strong diagonals of trestle sweep from bottom right toward middle left, distant switchbacks span a deep conifer gorge. Jagged snow capped blue and mauve ridges, coral sun and pale apricot sky, dusty teal layers of spruce silhouettes and deep evergreen ink shadows in foreground. Leave left third naturally quiet and dark evergreen for game title overlay, subject right of center as noted. Crisp hand-cut silhouettes, striking light, premium illustrated indie game box art. No text, no letters, no UI, no border.

</details>

## Slipstream

Race three heats on the Bonneville salt flats. Drag across the track to hold any lateral position and follow a wind-shifted wake. Use the touch arrows, arrow keys, or A and D for lane changes. Hold Boost or Space to draw from five seconds of extra motor power per heat. P pauses. The field awards 5, 3, 2 and 1 points per heat. A tie goes to the driver ahead in the final heat.

All four cars share the same fixed-step vehicle simulation. It combines wheel power, rolling resistance, and a drag force opposite the car’s velocity relative to the local air. Drag grows with airspeed squared, and the effective drag area increases as crosswind exposes the car’s side. Behind a rival, a widening wake carries some air along with that car. Its influence decays with distance and lateral offset, and crosswind shifts its center. The blue ribbons visualize this approximate wake field. The HUD compares the force on the car to the open-air force at its current velocity. Vehicle coefficients and wake parameters are gameplay approximations. [NASA’s drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)

<details>
<summary>Track and vehicle artwork</summary>

The built-in ImageGen tool produced the [landscape](games/slipstream/salt-flats.webp), [title-screen car](games/slipstream/streamliner.webp), and the sheet for the [player](games/slipstream/player.webp), [Vega](games/slipstream/vega.webp), [Moss](games/slipstream/moss.webp), and [Sol](games/slipstream/sol.webp). The [cover](games/slipstream/cover.webp) combines the landscape and title-screen car. The [192px](games/slipstream/icon-192.png) and [512px](games/slipstream/icon-512.png) launcher icons use its racing roundel.

> Use case: stylized-concept. Asset: side-scrolling background for a vintage Bonneville salt flats racing game. Create a cinematic very wide horizontal landscape, ideally 3:1. An exceptionally handsome 1960s illustrated land-speed record event poster, matte silkscreen printing on slightly textured paper. Luminous pale warm aqua blue sky with a single big muted golden cream sun near upper right and a few long geometric ivory wisps of cloud. Layers of rugged angular arid mountain ridges, dusty slate-blue shadows and terracotta/salmon/tan faces, horizon at about 60% image height. The foreground bottom 40 percent is a level expansive warm ivory and peach-colored salt flat, sparse extremely fine horizontal pastel streaks, a straight distant glint of water. Camera looking directly side-on/elevation across the salt pan, extremely low on ground, no vanishing road. Layered cut-paper outlines, strong graphical scale, sophisticated mid-century motorsport travel-poster illustration. Beautiful in its own right while remaining quiet enough to put an orange car sprite on the empty ground. No cars, objects, people, flags, lettering, logos, text, border, roads, road markings, lane lines or UI.

> Use case: stylized-concept. Transparent PNG game artwork sprite sheet with TWO visually separated right-facing racing vehicles in two horizontal rows. Landscape 3:2 sheet. Transparent background, empty space and clear transparent gutter between the two rows. Top row: beautifully drawn tangerine-vermilion 1960s Bonneville streamliner racer. Very long and low cigar/teardrop aerodynamic racing shell, a flowing pointed rounded nose to the RIGHT, stabilizer tail fin on LEFT, streamlined enclosed low dark teal glass cockpit near center-right, two distinct visible charcoal rubber wheels half enclosed, ivory racing stripe and a small ivory roundel numbered 7. Bottom row: also facing RIGHT, a handsome compact boxy 1960s orange racing sedan with upright windscreen, blunt vertical nose on RIGHT, modest upright greenhouse, cream roof and cream stripe, charcoal tires, same roundel 7. EXACT orthographic side elevation for both, clearly resting on two wheels, zero perspective, never front or three-quarter view. Each complete car extending from x 8% to 92%, upper car centered vertically at y=26%, lower car at y=73%, no overlap, no cropping. Both share the same illustrated look: rich vintage silkscreen racing-poster art with clean sculptural silhouettes, crisp ink shadow blocks, cream glints across enamel, subtle printed grain, meticulously shaped alloys. Bold uncomplicated poster beauty at small sizes. No scenery, no roadway, no shadows outside vehicles, no text except car number 7, no extra objects or captions.

> Use case: stylized-concept. Sprite sheet for a polished retro Bonneville land-speed racing video game. Four isolated beautiful 1960s bubble-canopy race cars on genuinely transparent background. Arrange in a precisely spaced 2 x 2 grid; one vertically oriented car centered in each quadrant, transparent gutters. ALL cars shown from exactly the SAME high overhead chase camera above and slightly behind, nose pointing straight to the TOP of the image, square back end at bottom, symmetrical left to right, absolutely no side-on view. Each vehicle has roughly 2.3:1 length to width, fits within its quadrant and occupies most of the quadrant height. Top left hero: vivid vermilion orange street-legal streamlined salt racer, ivory longitudinal stripe and white number 7, dark teal glass cockpit, distinct round taillights at bottom. Top right: midnight blue longtail racing coupe, two white stripes, number 12. Bottom left: British racing green blunt vintage touring car with white roof stripe, number 23. Bottom right: golden mustard yellow sleek open-cockpit racer, black stripes, number 41. Genuinely varied recognizable vehicle silhouettes at game scale. Crisp, dimensional vintage screenprinted 1960s motorsport illustration, rich cel-shaded bodywork. Carefully drawn tires, rim lighting, restrained enamel highlights and warm cream reflections. Tight clean mask edges. No track, cast shadows, environment, background, labels or anything besides these four clearly separated cars. Square sheet.

</details>

## Assets and deployment

Common binary image, audio, video, model, font and game formats are tracked by Git LFS through `.gitattributes`. To include another format, run `git lfs track "*.ext"` and commit the updated attributes with the asset. The build rejects unresolved LFS pointers.

Push to `main` to test, build and deploy `dist/` with GitHub Actions. Pull requests run the same checks. In another repository, choose **Settings → Pages → Build and deployment → Source → GitHub Actions**. All site URLs are relative, so the same build works at the domain root or under a GitHub Pages project path.
