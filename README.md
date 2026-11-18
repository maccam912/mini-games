# Pocket Cabinet

A static arcade for small single-player games. [Open the arcade](https://maccam912.github.io/mini-games/) to play [Orbit Hop](https://maccam912.github.io/mini-games/games/orbit-hop/) or [Timberline Dash](https://maccam912.github.io/mini-games/games/timberline-dash/).

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

## Assets and deployment

Common binary image, audio, video, model, font and game formats are tracked by Git LFS through `.gitattributes`. To include another format, run `git lfs track "*.ext"` and commit the updated attributes with the asset. The build rejects unresolved LFS pointers.

Push to `main` to test, build and deploy `dist/` with GitHub Actions. Pull requests run the same checks. In another repository, choose **Settings → Pages → Build and deployment → Source → GitHub Actions**. All site URLs are relative, so the same build works at the domain root or under a GitHub Pages project path.
