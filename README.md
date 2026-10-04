# River of Light 2026

An unofficial, local, mobile-first 3D exploration of Liverpool's River of Light. React + TypeScript + Vite + React Three Fiber / Three.js. No map API key, accounts or backend required.

## Run

Requires Node 24 (the data scripts and tests use native TypeScript stripping).

```sh
npm install
npm run dev
```

Open http://127.0.0.1:4317. `npm run build` type-checks and creates `dist/`. `npm run preview` serves the production build. `npm test` checks projection, catalogue integrity, preview hysteresis, map data and trail geometry.

## What's implemented

- Bounded geographic scene built from a saved OpenStreetMap extract: 1,161 building footprints, dock outlines, roads, pedestrian paths, green spaces and 524 trees.
- Landmark roof/tower details, low-poly representations of all thirteen installations, day/night lighting, instanced trees and batched building/path geometry.
- Touch/mouse pan, zoom and rotate; keyboard map controls; overview and north reset; animated artwork focus respecting reduced motion.
- Artwork list/search, photo galleries, automatic compact previews after the camera settles nearby, external walking directions and a suggested trail along mapped walking-network edges.
- Responsive panels and a usable artwork-list fallback if WebGL or map loading fails.
- File-based survey corrections and photo ingestion, ready for incoming site images.

## Photo-informed sculptures and on-site trail

All thirteen stops now have artwork silhouettes informed by the official images in `public/photos/official/`: looped neon daisies, seated wheel drums, a white neon sign, stacked open frames, layered peonies, five linked figures, a striped octagonal tower, a star-lit drum, the projected Together gate, Paradigm’s radial sphere, an overhead sheep canopy, POP’s opening monoliths and the Town Hall Anooki. These remain illustrative models and approximate placements; older survey-batch notes below record the earlier surroundings-only stage.

`sculpture-models.ts` batches the ten procedural models into at most two vertex-coloured meshes (the church sign adds one cached text texture). Near detail switches at 350 m with a 420 m exit threshold. Numbered pill markers retain their original hover treatment, and unseen artworks keep their light columns at overview distance. Boundary fills and fine sculpture detail simplify in the distance. Waterfront fittings are hidden above overview height without rebuilding their shared buffers. Existing lighting pools and the special artwork approaches remain intact.

The trail guide follows the artwork after the last confirmed visit in strict numbered order (07 → 08 → 09), even if a later stop is already collected. Opening artwork details or toggling trail mode does not change that order. Visit order persists with the collection across reloads. Confirming an already-collected stop advances without unchecking it; the route ends at 13 without automatically jumping back to earlier stops. The guide also shows collection progress, walking directions and a mobile Back to map action. `npm run data:trail` regenerates both the rendered route and `src/data/trail-distances.json`. Times use mapped leg lengths at an illustrative 65 m/min, exclude stops, and explicitly name the origin. Missing connections produce no guessed estimate; revisiting earlier stops follows the mapped trail in reverse. This is a suggested route, without verified event access. Suggested trail mode requests browser location permission and shows a red You marker with GPS accuracy. It uses the standard secure-context Geolocation API supported by mobile Safari and Chrome. Tracking stops when the mode is turned off, the page is hidden, or the page is left. Live fixes stay in memory and stale fixes disappear after 30 seconds. The map has no GPS banner; status and Refresh GPS live in the GPS debug field log, available from About or the direct `?debug=gps` URL (not from Suggested trail; this is not an authentication boundary). In that view a field tester can explicitly save fresh readings (at most 10 seconds old) with artwork, notes, reported accuracy, coordinates, scene projection and displacement from the mapped artwork. Up to 100 captures persist on the device and can be copied or downloaded as JSON for manual corrections. Nothing is uploaded automatically. The camera remains under the visitor’s control.

## Data and images

`src/data/installations.ts` contains the thirteen artwork records. Positions are approximate site placements informed by the official event pages and PDF, not surveyed installation footprints. The list follows the official 1–13 numbering supplied in the event-map screenshot (batch 01).

`src/data/survey.json` overlays new photographs, installation coordinates, building height/visibility corrections and additional tree coordinates. All input geographic coordinates use `[longitude, latitude]`; the scene projection uses metres, x east and z south. Camera locations must never automatically replace subject locations.

Official event reference images are linked from the VisitLiverpool image CDN, attributed in each card, and loaded only when needed. They need network access. These are reference images from the event website and may depict an earlier presentation or a proposed installation. They are not photographs from our site survey. No reuse permission for public redistribution is implied. Replace with approved/user-supplied imagery before public release.

The base scene is intentionally stylised: building heights use available OSM metadata or estimates, ordinary buildings are capped at 38 metres, and the ground is flat. The artwork shapes are artistic impressions, with exaggerated scale for legibility. The photo survey should refine placement, landmark proportions, trees, steps and ramps. This is not an accessibility-certified route or a navigation system.

## Refresh geography

```sh
npm run data:fetch
npm run data:prepare
npm run data:trail
```

The raw source is ignored in `data/raw/liverpool.osm`; prepared output is checked in under `public/data/`. The runtime does not query OSM. Trail generation uses the largest connected pedestrian network, excludes explicit private/no-foot access and never bridges failed routes with a straight line. It does not verify event closures, opening times, crossing safety or accessibility. Rebuild the trail after changing installation coordinates. Prepared data is © OpenStreetMap contributors, licensed under ODbL: https://www.openstreetmap.org/copyright . Keep attribution and licence information with distributed data.

## Add survey photos as they arrive

Keep original files in `references/incoming/` (ignored by Git), then run:

```sh
npm run photos:import -- --file /absolute/path/photo.jpg --installation loop --kind site --direction north
```

Optional `--alt` and `--credit` set the caption and attribution. Use `--kind artwork` for installation imagery; explicitly label a proposed artwork visualisation in its caption and credit. The script rotates/resizes to WebP, strips published metadata, preserves the original, rejects accidental filename overwrites and appends a manifest record. The live gallery updates automatically. The importer does not infer object positions or upload originals anywhere.

Example survey entries:

```json
{
  "photos": [{ "installationId": "loop", "src": "/photos/loop-square.webp", "kind": "site", "alt": "St Paul's Square looking north", "credit": "Photo supplied by project owner", "direction": "north" }],
  "installationOverrides": [{ "id": "loop", "coordinates": [-2.99405, 53.41033] }],
  "buildingOverrides": [{ "id": "24611033", "height": 51 }],
  "additionalTrees": []
}
```

Only mark installation coordinates surveyed after an explicit location check. Photo GPS alone is insufficient. Survey images appear before event reference images; cards distinguish location photographs from artwork imagery.

## Reference sources

- Programme: https://www.visitliverpool.com/river-of-light-2026/light-artworks/
- Official map: https://www.visitliverpool.com/river-of-light-2026/river-of-light-map/
- Each artwork record links to its individual source page.
- Interaction and visual reference: https://weberstatemap.base44.app/ — inspected as inspiration; no source code or model assets copied.

## Remaining survey and release work

Batch 01 is incorporated: nine Town Hall / Water Street / Castle Street field photographs, one supplied Anooki artwork visualisation and one separately archived numbering screenshot. Originals are preserved under `references/incoming/01-the-anooki/`; captions and modelling evidence are catalogued in `references/anooki-batch-01.json`. The photo-informed Town Hall model replaces its generic footprint extrusion; the Anooki figures now wrap around the front portico columns. Dimensions, rear geometry and exact sculpture positions remain estimated. The approach photos also inform close-view green blocks, bollards, café tables/chairs, windbreaks and parasols. These details appear near the Town Hall (230 m camera threshold with hysteresis), with approximate placement; they are not a survey of event-day obstacles. No new trees are inferred from this batch. Verify on-site placements, landmark/tree fidelity and access before treating this as a visitor-ready map. Actual iPhone/Android frame rates, touch gestures and thermal behaviour need physical-device validation; a desktop browser at a mobile viewport is not that evidence. Hosting and official event integration are intentionally not configured.

## Exchange Flags — photo batch 02

Six field photographs are archived under `references/incoming/02-flower-power/` and catalogued in `references/flower-power-batch-02.json`. `src/data/exchange-flags.json` restores the previously omitted OSM Exchange Buildings multipolygon (relation 9302126, including its interior hole) and courtyard outline. The low-poly monument uses the saved OSM monument location; façade details, planted café boxes, banner lanterns, picnic tables and bollards are photo-informed approximations. Furniture appears within 280 scene metres. The photographed temporary container remains a reference only. Seven stylised flowers occupy an illustrative arrangement clear of the monument; their actual layout remains unverified.

## St Paul’s Square — photo batch 03

Ten field photographs are archived under `references/incoming/03-loop/`, with modelling roles in `references/loop-batch-03.json`. The scene uses saved OSM plaza/building footprints (`src/data/st-pauls-square.json`) plus photo-informed façade colours and diagonal atrium braces, branching broadleaf trees, strap-leaf planting, grasses, angular segmented stone seating, cycle stands, modern lamps and café furniture. Plant forms are visual interpretations, not species identifications. Positions and dimensions are approximate, and the six LOOP rings use an illustrative layout. Foreground glazing fades on selection so the courtyard remains visible; small furniture is shown within 230 scene metres.

## Church gardens — photo batch 04

Ten surroundings photographs for **Today I Love You** are archived under `references/incoming/04-today-i-love-you/`, with evidence and outstanding questions in `references/today-i-love-you-batch-04.json`. The church footprint, lawns and approach paths use saved OSM geometry. `ChurchGardens.tsx` adds a raised garden platform, lower waterfront terrace, retaining edge and railings, two stepped approaches and a separate gated entry. Its Gothic windows, clock tower/open spire, timber benches, bins, broadleaf trees and strap-leaf planting interpret the photographs. The estimated 3.8 m upper level and 2.15 m terrace are modelling choices, not surveyed heights; entry geometry and access suitability remain unverified. Close furniture is culled beyond 240 scene metres.

This batch contains no artwork-placement evidence. The installation marker identifies the location, while its temporary sculpture and ground halo are hidden. The gallery retains the official artwork reference separately from the ten site photos. Other existing sculptures remain illustrative until final placement references arrive; site photographs do not confirm their position.

## Pier Head — photo batch 05

Eight surroundings photographs for **Invisible Cities** are archived in `references/incoming/05-invisible-cities/` and catalogued in `references/invisible-cities-batch-05.json`. `src/data/pier-head.json` anchors the terminal footprint, lawn, canal, wall seating, tree positions and Edward VII monument to the saved OSM extract. `PierHead.tsx` interprets the angled terminal and glazing, stepped equestrian plinth, broadleaf avenue, stone seating, tapered lamps, bins and metal canal rails. Furniture detail is shown within 320 scene metres. The canal and adjoining walk use a cutout in the ground and underlying river plane so their estimated lower levels are visible; their depths, gradients and other dimensions are visual estimates, not survey data. Background landmarks remain simplified. No installation geometry is placed for Invisible Cities pending the actual placement references; its approximate location marker and official reference image remain available.

## Cunard forecourt — photo batch 06

Ten surroundings photographs for **Coloured Peonies** are archived under `references/incoming/06-coloured-peonies/` and catalogued in `references/coloured-peonies-batch-06.json`. `src/data/cunard-forecourt.json` retains the saved OSM Cunard footprint, five bench runs and eleven tree positions. `CunardForecourt.tsx` replaces the generic building with its footprint and a photo-informed east façade: arched lower windows, rustication, upper window grid, entrance steps, globe lamps and basement railings. Striped paving, stone benches with metal inlays, tiered flowering planters, tree grates/inset lights, a timber seat and wayfinding totem interpret the reference photos. Fine detail is culled beyond 400 scene metres. Dimensions, elevation details and non-mapped furniture positions remain estimated; municipal flowers are modelled as street furniture. Final installation placement is pending, so its temporary sculpture/halo is hidden while the approximate marker and official artwork reference remain available.

## George’s Dock forecourt — photo batch 07

Eight surroundings photographs for **Unity** are archived under `references/incoming/07-unity/` and catalogued in `references/unity-batch-07.json`. The photographed northern forecourt is anchored to saved OSM wall edges beside George’s Dock Building, whose relation 9074112 footprint and courtyard hole are retained in `src/data/georges-dock.json`. The scene adds an estimated 1 m rise over the pavement, three separated stair approaches, low green rails with gaps, paired green-and-gold ornamental lamps, stone blocks and a circular green metal cover on a low stone base. Paving joints, bolts and lamp details are visible within 330 scene metres. The adjoining Art Deco façade/tower and Cunard south-facing windows provide simplified context. Platform height, entry geometry and furniture dimensions are visual estimates; this does not establish step-free access. The Unity location marker and selected view identify this photographed forecourt without marking artwork coordinates surveyed or changing routing data. Final artwork placement is pending; the existing circular cover is a site feature, not the artwork.

## Shared waterfront links — unnumbered reference batch

Nine landmark photographs and one map screenshot are preserved byte-for-byte under `references/incoming/waterfront-links-01/`, with captions, roles and SHA-256 checksums in `references/waterfront-links-01.json`. These are shared surroundings for the waterfront connections around sites 6–8, not an installation, a numbered stop or an artwork gallery. The screenshot remains a private location-context reference and does not establish surveyed coordinates.

`src/data/waterfront-links.json` extracts the saved OSM Canning Dock River Gates bridge centreline (155196220), three octagonal hut footprints, Pilotage Building footprint and nearby fence lines. The existing horse sculpture uses the mapped Waiting... node (2517642852). `WaterfrontLinks.tsx` adds the photo-informed bronze horse/plinth, stone huts and black window grids, cross-braced bridge portals, tension rods, railings, lamps, lifebuoy, totem and cobbled patch. Fine details are culled beyond 260 scene metres; silhouettes remain visible. Generic extrusions for these four buildings are replaced. Heights, widths, sculpture orientation and unmapped furniture positions are estimates; this does not verify walking access or alter the suggested trail or artwork placements.

The second shared batch adds five photographs under `references/incoming/waterfront-links-02/`, catalogued with checksums in `references/waterfront-links-02.json`. The saved map anchors the southern grass boundary, Billy Fury statue (348135362), Legacy Sculpture (348173738), Piermaster’s House and adjoining brick wings. The scene adds simplified statue silhouettes, circular plinths, the empty cobbled lawn inset, seaward chain posts, lamps, benches and a lifebuoy. The south bridge hut now has the photographed broad roof, finial, weather vane and door. Statue likenesses, building elevations and furniture placements remain illustrative. The map’s Raleigh artwork node is used only to approximate the photographed empty circular inset; no sculpture is added there. These photographs remain shared route context, with no changes to artwork numbering, installation galleries or routing.

The third shared batch preserves ten originals in `references/incoming/waterfront-links-03/`, with captions and checksums in `references/waterfront-links-03.json`. Saved OSM geometry anchors Hartley’s Bridge (31291003), Liverpool Mountain (12398123401) and the western warehouse (157514651). The scene adds the low curved bridge rails and white deck strips, five coloured rocks, one multi-face wayfinding totem, warehouse windows and wall crane, refined house elevations and an external courtyard staircase. House roofs, dimensions, façade details and unmapped furniture remain photo-informed approximations. Temporary scaffolding and barriers are kept as photographic context rather than assumed event-day restrictions. The existing rock sculpture is a shared landmark; artwork numbering, galleries and route data are unchanged.


## Pump House surroundings — photo batch 08

Ten site photographs for **Colour Rush** are archived byte-for-byte in `references/incoming/08-colour-rush/`, with captions and SHA-256 checksums in `references/colour-rush-batch-08.json`. The gallery contains those ten site images plus the separate official artwork reference. `src/data/pump-house.json` anchors the Pump House footprint, chimney, carousel, four trees, Salthouse Quay road and slipway to the saved OSM extract. `PumpHouse.tsx` adds brick walls, slate gables, square tower, banded chimney, porch, broadleaf canopies, red road markings, cobbles, dock chains, bollards, lamps, pub sign and carousel. Generic building/tree duplicates are excluded; fine details disappear beyond 250 scene metres. The selected camera frames these surroundings.

The mapped 42 m chimney height is itself an estimate; other heights, façade details, slipway width/gradient and furniture positions are photo interpretations, not surveyed dimensions. The visible slipway meets the existing map water plane and does not establish public or step-free access. Temporary works and mobile vendors remain photographic context, not assumed event-day fixtures. Artwork placement remains pending, so Colour Rush’s illustrative sculpture and halo are hidden. Official numbering, location coordinates and routing are unchanged.


## King’s Parade circular platform — photo batch 09

Ten references for **The Stars Come Out at Night** are archived byte-for-byte in `references/incoming/09-the-stars-come-out-at-night/`, with captions and SHA-256 checksums in `references/the-stars-come-out-at-night-batch-09.json`. They appear as site photographs in Number 9’s gallery, separately from its official artwork reference. The Measure screenshot is retained as approximate dimensional evidence: the overlay appears to read 22½ inches (0.5715 m), not a surveyed height.

`src/data/kings-parade.json` anchors the photographed circular feature to saved OSM way 1512682728 and retains nearby chain, bollard, road, arena, wheel and tree geometry. `KingsParade.tsx` adds concentric cobbles, a low sloping rim with a recessed three-step opening, globe lamps, railings/chains, lifebuoy, red approach road, totem, gate piers and warehouse window details. Arena and static wheel silhouettes replace generic extrusions. Fine detail is culled beyond 300 scene metres. Platform radius, stair bearing, furniture and façade dimensions are interpretations. Access suitability and event-day arrangements remain unverified. The scene marker and camera now identify the photographed platform; catalogue coordinates and routing retain their existing approximate values. Artwork geometry and halo remain hidden pending placement references.


## Wapping Dock Wall surroundings — photo batch 10

Eight site photographs for **Together** are archived byte-for-byte in `references/incoming/10-together/`, with captions and SHA-256 checksums in `references/together-batch-10.json`. Number 10’s gallery contains these eight site photos and its separate official artwork reference. `src/data/wapping-gate.json` anchors the wall to saved OSM way 511054673 and the open passage to node 4999872828, with mapped gate boundaries, benches, planter, trees and road alignment.

`WappingGate.tsx` models the freestanding gabled stone wall with an open arched passage, dressed jambs and voussoirs, south-face recessed panel, north-face plaque, coping and tapered buttresses. Slab paving, cobbled flanks, inset lights, globe lamps, gate piers, open iron leaves, bridge rails, dock chains, benches, bin and planted stone bed provide surroundings. Fine details disappear beyond 260 scene metres and mapped tree duplicates are excluded. Heights, arch dimensions, stonework and gate opening angles are visual interpretations rather than surveyed dimensions; the open gates do not establish event-day access. The selected camera and marker identify the photographed arch while catalogue coordinates and routing remain unchanged. Artwork geometry and halo are hidden pending final placement references.


## Primary artwork thumbnails

All 13 artworks use their named programme images from the user-supplied [VisitLiverpool / Culture Liverpool Instagram carousel](https://www.instagram.com/p/DdbI9FYiP8p/) as the first gallery slide and the nearby artwork thumbnail. The downloaded JPEGs are stored in `public/photos/instagram/`; `src/data/artwork-thumbnails.json` maps them by artwork ID, and `references/instagram-artwork-thumbnails.json` records carousel positions and SHA-256 provenance. Existing site photographs and earlier reference/placeholder images retain their relative order after the new opening slide. Catalogue numbering and placement status are unchanged.

### Map clarity and placement pass — 2 October 2026

The custom Three.js renderer remains in place. Mapbox Streets' road/path/structure classification and the supplied Apple Maps screenshots inform the hierarchy; no Mapbox tiles, SDK, token or live API have been added. The geographic source is still the attributed local OpenStreetMap extract.

The display and walking graph now have separate responsibilities. The basemap shows streets, named pedestrian streets, park paths and bridges. Sidewalks, crossings, unnamed urban connectors and parking/service aisles are implicit in continuous paved ground rather than drawn as parallel lines. The full permitted graph remains available to the suggested trail. Of 2,045 non-area path features in this extract, 183 are drawn individually; 46 public pedestrian areas are filled as areas. This is a cartographic selection, not evidence that omitted paths are inaccessible.

`clipper-lib` is a build-time dependency used by `scripts/lib/map-surfaces.mjs` for round joins/caps and polygon subtraction. Prepared road/path/plaza polygons are clipped against buildings and water (mapped bridges retain water crossings), with a 1 cm numerical clearance. The library is not shipped in the browser bundle. Run `npm run data:prepare` then `npm run data:trail` after geographic edits.

The six-metre visual trail ribbon has teal/light-blue stripes moving along the numbered route. Its display corners are rounded within the walking corridor, its geometry is clipped around buildings/water, and reduced-motion mode keeps the stripes static. The underlying network remains unchanged by display smoothing. All twelve inter-artwork connections exist in the saved network; access still needs an event survey.

09 retains detailed paving only on its circular platform and rim. 10 has a centred passage, gable and inset panel. Dream Herd sits around the central plinth of the Derby Square circle with a smaller halo; POP! has moved into the open part of Williamson Square. Photo-informed catalogue positions now also drive walking directions and trail endpoints. All remain approximate, not surveyed. Gallery photos and primary Instagram thumbnails are preserved.

Attraction focus boundaries share a 29 m radius in every selection state. The church-garden boundary is raised to the terrace elevation. Rings depth-test against opaque models; a ghost-building depth pass separately attenuates ring pixels behind transparent buildings, without hiding the artworks. Custom geometry carries a per-vertex building flag through material batching, so furniture, vegetation and monuments never enter the ghost mask. Town Hall is protected when 01 is selected; the church (04) and Wapping archway (10) remain solid. Coloured Peonies (06) is provisionally anchored on the Cunard east forecourt, with the route and camera updated to match.

The renderer uses logarithmic depth to keep closely stacked ground surfaces stable from landmark close-ups to distant views. The trail and boundary shaders use the same depth encoding, including the ghost-depth comparison. River and land meshes share a shoreline rather than overlapping beneath the whole city, removing the large-area depth conflict that produced striped patches when zoomed out.

Open river water uses slow, world-scale lighting ripples with distance filtering to avoid shimmer. Enclosed dock polygons and the recessed Pier Head canal use the same water material palette without animation. Water remains opaque and depth-tested; waves do not displace the surface through bridges or quays. Dock basins are cut out of the land and recessed to an illustrative -1.2 m surface with quay walls; the photo-informed canal retains its existing -2.05 m level. These are visual model elevations, not surveyed tides or bathymetry. Reduced-motion mode freezes the river ripples, and the 30fps water invalidation timer sleeps while the document is hidden.

Stop 09 now uses the user-marked Salthouse Quay position (135, 487) for its sculpture, marker, lights, camera and walking route. Stop 05 is back at its original Pier Head position.

### Credits and licence notices

About includes a fixed-height, keyboard-scrollable credits panel with map, font, image, artist, service and library credits. Full notices live in `public/credits/`. Run `npm run credits:prepare` after dependency updates, then review the generated inventory and any missing-notice warnings. See [the credits audit](docs/credits-audit.md) for provenance and remaining upstream notice gaps, and [the final performance check](docs/performance-audit-2026-10-04.md) for measured scene performance.
