# Natural Earth basemap

The generated Earth background uses the 1:110m land dataset distributed by `world-atlas`, which is derived from Natural Earth.

Natural Earth raster and vector map data are in the public domain. The generated application asset is `apps/web/public/map/earth-background.svg`; run `pnpm map:generate` to reproduce it.

- Source project: <https://www.naturalearthdata.com/>
- Terms: <https://www.naturalearthdata.com/about/terms-of-use/>
- Conversion packages: `world-atlas`, `topojson-client`, and `d3-geo`
