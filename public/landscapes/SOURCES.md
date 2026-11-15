# Landscape provenance

Original artwork: [ASCII Magic](https://www.ascii-magic.com/ascii). The gallery FAQ identifies its pieces as MIT licensed. These five MP4 exports were supplied by the user for the Cognera redesign.

| Local stem | User supplied source |
|---|---|
| rainforest-falls-mist | rainforest-falls-mist-1920x1080.mp4 |
| lighthouse-storm | lighthouse-storm-1920x1080.mp4 |
| cherry-blossom-river | cherry-blossom-river-1920x1080.mp4 |
| camel-caravan-dusk | camel-caravan-dusk-1920x1080.mp4 |
| autumn-pagoda-maples | autumn-pagoda-maples-1920x1080 (1).mp4 |
| balloon-valley-sunrise | balloon-valley-sunrise-1920x1080.mp4 |
| elephants-at-waterhole | elephants-at-waterhole-1920x1080.mp4 |
| floating-islands | floating-islands-1920x1080.mp4 |
| sea-cliff-puffins | sea-cliff-puffins-1920x1080.mp4 |

MP4 derivatives remove the export's black perimeter, resize to 1440px wide, encode H.264 at 24fps (CRF 24, yuv420p, faststart), and discard audio. WebP posters use the matching source at one second. Reproduction: `scripts/prepare-landscapes.mjs` takes the five source paths in the order above. Source content is preserved; only crop, size and compression change. No native image generation was used.
