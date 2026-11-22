# Community crosshairs

Crosshair Y's **Community** tab loads designs from `community/index.json` in this repository.

## Submitting a design

The easiest way is from the app: open a crosshair, then choose **Share → Submit to community**. That opens GitHub with the file filled in. Sign in, then propose the file. If you don't have write access, GitHub forks the repository and opens a pull request for you.

To do it by hand, add a file to `community/designs/` named with lowercase letters, digits and dashes, for example `my-crosshair.json`:

```json
{
  "author": "your-name",
  "tags": ["tactical", "small"],
  "game": "Valorant",
  "design": {
    "name": "My Crosshair",
    "lines": { "enabled": true, "color": "#00ff88", "length": 6, "thickness": 2, "gap": 3 },
    "outline": { "enabled": true, "opacity": 0.7 }
  }
}
```

Fields you leave out of `design` use their default values. The easiest way to get a complete design is **Share → Export file → Design file (.json)** in the app.

## Rules

- Only submit designs you made yourself. Don't upload artwork, logos or characters you don't have the rights to.
- Keep images small. Image layers must be base64 `data:image/...` URLs, and the file must be under 2 MB.
- Pull requests are checked automatically (`node scripts/build-community-index.mjs --check`).

## How the index is built

When a design is merged into `main`, the **Community gallery** workflow runs `scripts/build-community-index.mjs` and commits the updated `community/index.json`. You can also run it locally:

```bash
npm run community:index
```
