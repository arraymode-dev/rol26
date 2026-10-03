# Street lighting performance — 2 October 2026

Measured locally in the Codex in-app browser, development build, 1280 × 720 viewport. Each run discards a 1 second warm-up and samples 6 seconds of camera orbit (361 frames). The camera is restored after each run, allowing full/low comparisons from the same starting view. These are local measurements, not a mobile-device performance guarantee.

| View / configuration | DPR | FPS | Frame p95 ms | CPU submission median ms | GPU median ms | GPU p95 ms | Draw calls | Triangles |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Overview, original 16 lights | 1.5 | 60 | 17.8 | 4.7 | 33.95 | 57.01 | 661 | 905,805 |
| Overview, brighter optimized 8 lights | 1.5 | 60 | 17.7 | 2.4 | 7.94 | 11.04 | 661 | 905,805 |
| Overview, low quality | 1 | 60 | 17.2 | 1.7 | 5.21 | 10.06 | 373 | 353,215 |
| Lamp district close-up, full | 1.5 | 60 | 17.6 | 2.0 | 6.41 | 10.88 | 263 | 894,553 |
| Lamp district close-up, low | 1 | 60 | 17.4 | 0.7 | 1.40 | 2.56 | 55 | 93,355 |

Draw calls and triangle counts include rendering and shadow passes. CPU timing covers rendering submission, not all JavaScript/React frame work. GPU timing uses asynchronous EXT_disjoint_timer_query_webgl2 queries and discards reported disjoint results. GPU timings can include scheduling/contention effects; the original GPU numbers exceed the observed presentation interval, so do not interpret them as FPS or claim a proportional FPS improvement. All runs were presentation-capped at approximately 60 fps.

Low quality reduces overview draw calls by 44% and triangles by 61%. Close-up draw calls fall by 79% and triangles by 90%. These are work reductions, not promised speedups on every device.

## Changes

- Globe emission 2.2 → 4; nearby lamp light intensity 58 → 105; stronger pavement pools and slightly larger soft halos. Existing 16 m light radius and attraction exclusion remain unchanged.
- Dynamic street-light pool reduced from 16 to 8 on desktop, 8 to 4 on narrow viewports. Instanced lamp models and shared pool/glow batches remain.
- Skip the ghost-building depth render when no attraction is selected; maintain a cleared depth texel for boundary shaders.
- Persisted Low quality toggle: removes street lamps and attraction point light, disables shadows, uses DPR 1, stills water and halves the selected-attraction depth target resolution. Keeps landmarks, artworks, selection, routes and camera controls.
- Development-only `?profile=1` benchmark UI. Not included in the production rendering path.

## Verification

Production build and all 27 tests pass. Visually checked brighter street lighting, full/low switching, selected-attraction ghost depth in low quality, persistence after reload, and control placement/function at 390 × 844. Full quality restored after testing. Build retains the existing large Three.js chunk warning.
