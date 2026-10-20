# Neutral Director figures

The generic figures derive from **BodyMaleRealistic**, authored by **Dan Ulrich**, in Blender Studio’s **Human Base Meshes v1.4.1**, licensed **CC0 1.0 Universal**. They represent no actor identity and are never marketplace profiles.

- Source/license: https://www.blender.org/download/demo-files/#assets
- Bundle: https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip
- CC0: https://creativecommons.org/publicdomain/zero/1.0/

`neutral-figure-v1.glb` retains the earlier static presentation figure for compatibility. `neutral-performer-v2.glb` is a subdivided, approximately 1.8 m neutral clay figure with a skinned skeleton, finger chains, head and jaw. ACTBYME authored the rig and weights. Imported performances drive estimated joint rotations, not identity, clothes or scenery. Jaw opening is approximate, not exact lip sync. Unobserved body parts stay neutral.

Regenerate v2 using Blender 4.5 LTS:

```sh
blender --background /path/to/human_base_meshes_bundle.blend --python apps/web/scripts/export-director-motion-figure.py
```

Blender is an optional asset-authoring tool. Production serves the checked-in GLB and performs animation/rendering in the browser.
