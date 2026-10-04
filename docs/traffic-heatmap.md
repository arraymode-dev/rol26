# Unlisted traffic atlas

Open `/insights/traffic/` directly. The page is not linked from the app and has
`noindex, nofollow, noarchive`. This is unlisted, not an authentication boundary.
The published JSON contains aggregate counts only. The main app does not import
this view. Its separate Vite entry never loads Three.js, Heap, GPS or the viewport
guard. The basemap has no pan, zoom, hover or selection handlers.

## Data and interpretation

`public/data/heap-traffic.json` is a saved snapshot of Heap **Production**
(`442235230`), read on 4 October 2026. All three queries used **Unique users**,
**Entire range**, **Past 7 days** (28 September–4 October), and the event property
filter **environment equals production**, excluding local-preview events.

- Denominator: unique users who did **Experience opened** (5).
- Exploration numerator: unique users who did **Artwork opened**, grouped by `artwork_id`.
- Seen numerator: unique users who did **Artwork marked seen**, grouped by `artwork_id`.
- Missing groups in a completed query are stored as zero, with all 13 artworks represented.

The timestamp is when the snapshot was retrieved from Heap, not a promise of
real-time ingestion. The small sample
includes setup testing. Unique visitors are browsers/devices, not verified people.
A mark-seen event is self-reported; unmarking later does not subtract history.
No GPS trajectories are collected or inferred.

Each artwork weight = unique artwork visitors / unique experience visitors in the
same window. Do not sum daily unique counts, or sum artwork visitors to create the
denominator. A visitor can be present at multiple artworks. Nearby 85 m Gaussian footprints merge using a smooth union of their coverage.
Their colour is a kernel-weighted mean of visitor shares, never a sum.
Duplicate input points are ignored. This produces irregular connected shapes
where neighbouring footprints overlap, while distant clusters stay separate. The halo is
illustrative, not a measured geographical reach or a count of a combined region.
Magma is fixed to 0–100%, not rescaled to the busiest location. Zero stays transparent; a smooth opacity curve softens the outer edges.

## Updating

The owner chose a snapshot until a Heap Connect export is available. **Reload
snapshot** fetches the latest published JSON; it does not log in to or query Heap.
Re-run the three queries above for an identical date window/filter, replace the
JSON counts, update the period and capturedAt, run `npm test` and `npm run build`,
and deploy. Validation rejects non-Production data, missing/duplicate artworks,
invalid counts and numerators above the denominator. If counts exceed the
Experience-opened denominator, reconcile the cohort before publishing.

For future automatic updates, use an authenticated, server-side Heap Connect
warehouse/export source producing this aggregate schema. Never ship Heap login
credentials, session cookies, raw user IDs or warehouse credentials to the browser.
No live export was configured or claimed for this version.

## Rendering

Fixed north-up OpenStreetMap raster tiles use Web Mercator. Only tiles needed by
this single visible extent are requested, with browser caching and attribution.
The overlay raster is 470 × 560, computed on data/metric changes only, with no
render loop. Canonical artwork coordinates come from `installations.ts`.

Sources: [Heap exports](https://help.heap.io/hc/en-us/articles/37271965550609-How-do-I-get-data-out-of-Heap),
[Heap chart export](https://help.heap.io/hc/en-us/articles/37271837981201-Charts-overview),
[OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
