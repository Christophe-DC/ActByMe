# ACTBYME Director — logiciels libres

L’assemblage local utilise les distributions npm non modifiées suivantes :

- `@ffmpeg/ffmpeg` 0.12.15 : wrapper JavaScript sous licence MIT.
  [Licence incluse](licenses/ffmpeg-wrapper-MIT.txt).
- `@ffmpeg/core` 0.12.10 : FFmpeg 5.1.4 compilé en WebAssembly avec ses bibliothèques externes.
  La distribution annonce GPL-2.0-or-later ; la configuration inclut des bibliothèques GPL.
  [GPL v2](licenses/ffmpeg-GPL-2.0.txt), [GPL v3](licenses/ffmpeg-GPL-3.0.txt),
  [détails FFmpeg et bibliothèques](licenses/ffmpeg-LICENSE.md).
- `mediainfo.js` 0.3.7 : inspection des médias côté API, BSD-2-Clause.
  [Licence incluse](licenses/mediainfo-BSD-2-Clause.txt).

Sources correspondantes et instructions de construction de la version distribuée :

- [Sources ffmpeg.wasm, version v12.15 (wrapper 0.12.15, core 0.12.10)](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v12.15).
- [Archive des sources ffmpeg.wasm v12.15](https://github.com/ffmpegwasm/ffmpeg.wasm/archive/refs/tags/v12.15.tar.gz).
- [Dockerfile de construction, versions et sources des bibliothèques externes](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/v12.15/Dockerfile).
- [Scripts de construction et modifications WebAssembly](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v12.15/build).
- [Sources FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4).
- [MediaInfo.js 0.3.7](https://github.com/buzz/mediainfo.js/tree/v0.3.7).

Les notices des auteurs et licences des bibliothèques externes figurent dans leurs sources respectives,
référencées par le Dockerfile de cette version. ACTBYME ne modifie pas ces distributions.
`pnpm media:prepare` les copie depuis les dépendances verrouillées du projet vers `/director-media/v1/`.
Les fichiers vidéo privés ne sont transmis à aucun fournisseur IA par ce moteur.
