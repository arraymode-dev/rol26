# Attraction lighting — 2 October 2026

Extended the approved Pier Head / Colour Rush treatment to all 13 attractions. Each site has a bounded, two-colour surface wash with a 24–38 m radius. Anooki uses the shared Town Hall forecourt anchor; the church garden uses its 3.8 m elevation. Lower nearby walls receive restrained coloured spill. Warm architectural treatments are confined to six mapped landmark footprints.

The surface effects modify existing materials and geometry: no additional pool meshes, textures, draw calls or render passes. Transparent ghost buildings and water are excluded. Day mode restores the original materials. Low quality keeps the static pools and architectural washes.

Two non-shadowed dynamic lights are shared by the nearest viewed artwork in full quality. The former generic shadowed attraction light and the added city street-lamp layer are no longer rendered. Existing fixtures in detailed site models are retained.

Measured in the local development preview at 1302 × 993, a 1 second warm-up plus 6 second overview orbit (361 samples):

| Mode | DPR | FPS | Frame p95 | CPU submission median | GPU median | GPU p95 | Draw calls | Triangles |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Full | 1.5 | 60 | 17.5 ms | 2.5 ms | 6.02 ms | 10.50 ms | 656 | 656,205 |
| Low | 1 | 60 | 17.2 ms | 1.7 ms | 4.63 ms | 10.23 ms | 373 | 353,215 |

GPU timing is asynchronous and device-specific. CPU submission excludes other JavaScript work. Counts include shadow passes. This is not a frame-rate guarantee for mobile hardware. The earlier 3-site measurement used a different viewport/DPR and is not a controlled timing baseline.

Build and all 29 tests pass, including site anchoring/elevation, facade footprint bounds, exclusion of water/ghost/remote surfaces, and material restoration. Existing production bundle size warning remains.

Visually verified coloured pools remain in low quality and disappear in daytime; no browser console errors in the final QA tab.
