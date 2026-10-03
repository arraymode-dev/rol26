# October 3 field placement review

The supplied field fixes are observations, not a single translation to apply to the entire map. Reported accuracy is a radius; a visitor can also stand beside the intended subject. The comparison readings and original courtyard photos are retained locally in ignored `references/incoming/`, outside the public app and Git history.

| Artwork | Offset / reported accuracy | Decision |
| --- | --- | --- |
| 01 Anooki | 28.1 m / ±14.2 m | Keep figures attached to Town Hall columns; the reading is near the viewing forecourt. |
| 02 Flower Power | 15.4 m / ±14.2 m | Keep the existing Exchange Flags placement pending a more precise subject position. |
| 03 LOOP | 7.3 m / ±14.2 m | Keep; within reported accuracy. |
| 04 Today I Love You | 11.9 m / ±14.2 m | Keep church garden placement; within reported accuracy. |
| 05 Invisible Cities | 45.7 m / ±4.8 m | Apply the owner-confirmed artwork coordinate to the catalogue, model, marker, directions and regenerated route. |
| 06 Coloured Peonies | 22.1 m / ±14.2 m | Retain for follow-up; a single viewing-position fix does not establish the flower arrangement centre. |
| 07 Unity | 5.9 m / ±14.2 m | Keep; within reported accuracy. |
| 08 Colour Rush | 11.5 m / ±14.2 m | Keep; within reported accuracy. |
| 09 Stars | 46.2 m / ±14.0 m | Move provisionally to the courtyard fix, matching the saved entrance footpath and supplied Anchor Courtyard photos. Keep approximate status until the installation/model is confirmed. |
| 10 Together | 3.2 m / ±14.2 m | Keep; within reported accuracy. |
| 11 Paradigm | 6.0 m / ±14.2 m | Keep; within reported accuracy. |
| 12 Dream Herd | 32.0 m / ±14.2 m | Retain for follow-up; preserve the existing Derby Square grouping until its centre is confirmed. |
| 13 POP! | No reading | No change. |

The 09 gallery now uses the new courtyard photographs. The old platform images remain as source references, not as gallery evidence for this placement. No new detailed courtyard model is inferred from these photographs; the owner plans to supply a better model.

The field log remains lazy-loaded at `?debug=gps`. Following the owner’s subsequent request, About also has a field-log button; Suggested trail has no debug entry. The direct URL is not authentication. High-accuracy tracking still runs only while Suggested trail is active.

### Anchor Courtyard surround

The four saved OSM building footprints surrounding 09 now use a lightweight,
photo-informed model: tall warehouse wings, low slate-roofed wings,
stone entrance piers, courtyard walls, flagstone joints, palms and benches.
Heights and roof profiles are visual estimates from the owner's courtyard photos
and supplied massing screenshots, not a measured architectural survey. Artwork
09's placement remains provisional. Windows, paving joints and small furniture
use close-range LOD; geometry is merged by material and needs no new textures.
Tests enforce a 25k-triangle / 12-batch budget and an unobstructed entrance route.
Architecture uses the shared light building palette, preserving dark windows,
roof details and the geometry from the photo references. Courtyard furniture
retains its own materials; the Liver Building treatment is unchanged.

Phones now default to performance rendering (coarse pointer and short screen
edge at most 700px). An explicit quality choice uses `rol-render-quality` and
survives reload. The old automatically saved false value does not override the
new phone default.

### Inland dock furniture

Shared instanced railings and lamps now follow the perimeters of all eight named
inland docks/basins in the saved map. Fixtures are offset onto land; bridge
approaches, water connections and building footprints remain clear. Existing
curated rails at the north landing and Pump House are retained without doubling.
Lamps share emissive materials rather than adding lights. Uncapped six-sided
chain rods use two spans per sag, reducing triangle cost; the same seven draw
batches and overview visibility cutoff are retained.

### Animated dock rides

The Wheel of Liverpool and nearby carousel now have independent, batched ride
models. The wheel has twin rims, spokes, framed upright cabins and cool lamps;
the carousel has shaped horses, saddles, gold poles and warm canopy/platform bulbs.
Both animate only nearby and on screen, retaining their phase when stopped.
The wheel starts within 220m and stops beyond 260m; the carousel uses 160m/190m.
This hysteresis prevents flicker near the cutoff. Hidden pages and reduced-motion
preferences stop animation. Performance mode retains this bounded local motion
while still suppressing water movement and dynamic lights. Lit surfaces use
emissive geometry, not extra point lights or shadow maps. Demand rendering is
woken at 30Hz locally; wheel cabins use two instanced batches and stay upright.
