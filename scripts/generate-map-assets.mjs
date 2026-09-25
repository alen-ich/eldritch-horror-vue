import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const width = 680;
const height = 460;
const topologyPath = fileURLToPath(import.meta.resolve("world-atlas/land-110m.json"));
const topology = JSON.parse(await readFile(topologyPath, "utf8"));
const land = feature(topology, topology.objects.land);
const projection = geoNaturalEarth1().fitExtent([[18, 28], [width - 18, height - 28]], { type: "Sphere" });
const draw = geoPath(projection).digits(1);
const landPath = draw(land);
const graticulePath = draw(geoGraticule10());
const spherePath = draw({ type: "Sphere" });

if (!landPath || !graticulePath || !spherePath) throw new Error("Natural Earth geometry could not be projected.");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="none">
  <defs>
    <radialGradient id="ocean" cx="48%" cy="42%" r="74%"><stop offset="0" stop-color="#214754"/><stop offset=".58" stop-color="#102f39"/><stop offset="1" stop-color="#071b22"/></radialGradient>
    <linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6e7151"/><stop offset=".55" stop-color="#4b573f"/><stop offset="1" stop-color="#313f35"/></linearGradient>
    <filter id="coast" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".018 .08" numOctaves="2" seed="13"/><feColorMatrix type="saturate" values="0"/></filter>
    <clipPath id="sphere-clip"><path d="${spherePath}"/></clipPath>
  </defs>
  <path d="${spherePath}" fill="url(#ocean)"/>
  <path d="${graticulePath}" fill="none" stroke="#92adb0" stroke-opacity=".10" stroke-width=".65"/>
  <path d="${landPath}" fill="#b79f63" fill-opacity=".20" stroke="#d1b977" stroke-opacity=".14" stroke-width="4" filter="url(#coast)"/>
  <path d="${landPath}" fill="url(#land)" stroke="#a9a275" stroke-opacity=".58" stroke-width=".8"/>
  <rect width="${width}" height="${height}" clip-path="url(#sphere-clip)" filter="url(#paper)" opacity=".07"/>
  <path d="${spherePath}" fill="none" stroke="#8ca4a3" stroke-opacity=".35" stroke-width="1.2"/>
</svg>
`;

const outputDirectory = path.join(process.cwd(), "apps/web/public/map");
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "earth-background.svg"), svg);
console.log("Generated the 680x460 Natural Earth SVG basemap.");
