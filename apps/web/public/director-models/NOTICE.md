# Neutral reference figure

`neutral-figure-v1.glb` is derived from **Body Male – Realistic**, by **Dan Ulrich**, from Blender Studio's **Human Base Meshes v1.4.1** bundle. The source collection's asset metadata and the official download catalogue license it under **CC0 1.0 Universal**.

- Official source and license: https://www.blender.org/download/demo-files/#assets
- Source bundle: https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip
- CC0: https://creativecommons.org/publicdomain/zero/1.0/

ACTBYME changes: one level of smooth subdivision, a static bent-arm presentation pose, normalization to approximately 1.8 metres, neutral untextured clay materials, and a texture-free GLB export. No likeness, motion, expression, lip sync or pose is extracted from uploaded performances. This generic figure is never presented as an actor on the marketplace.

Regenerate with Blender 4.5 LTS:

```sh
blender --background /path/to/human_base_meshes_bundle.blend --python apps/web/scripts/export-director-figure.py
```

Blender is an optional asset-authoring tool only. The checked-in GLB is served directly by the web app; preview and MP4 rendering run in the browser.
