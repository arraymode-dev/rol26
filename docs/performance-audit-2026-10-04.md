# Final scene performance check — 4 October 2026

Measured in the local Codex browser at 1280 × 720, device pixel ratio 1.5, full-quality mode with existing shadows, detail and antialiasing. The opt-in development profiler measures both render passes and records WebGL timer-query results. These are local-machine observations, not a guarantee for mobile hardware or every browser.

| Scenario | Samples | Mean fps | Frame p95 | Worst frame | GPU p95 | New shaders | Frames >50 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Overview orbit | 693 | 115.3 | 11.7 ms | 13.7 ms | 6.73 ms | 0 | 0 |
| Clean first flight to Paradigm / raised park | 479 | 119.6 | 9.3 ms | 29.5 ms | 7.15 ms | 0 | 0 |
| Suggested-trail flight to Together / dock promenade | 473 | 118.1 | 9.3 ms | 34.6 ms | 8.12 ms | 0 | 0 |
| Sustained promenade orbit | 721 | 120.0 | 9.1 ms | 12.1 ms | 8.15 ms | 0 | 0 |

The waterfront view retains about 1.73 million rendered triangles (including render passes) and 161 median draw calls; park flight about 1.56 million and 81 calls. The raised terrain, extended paving and full moon did not produce a sustained rendering bottleneck in these samples. No models, textures, quality settings or draw distances were reduced. Isolated 29–35 ms transition frames remain observable; the result is not claimed to be perfectly frame-drop-free.

An exploratory run immediately after switching high/low quality recorded one additional shader compilation and a 30 ms frame. A clean first-visit run and the final trail run recorded zero new shaders. The development profiler now includes newly created shader keys to make future regressions traceable.

Build and all 125 automated tests passed. Credits scrolling was checked at desktop and 390 × 844 mobile layouts: original responsive card height retained (about 148 px desktop / 189 px mobile), keyboard scrolling works, and no horizontal overflow. The 69 KB library catalogue loads only when About opens; full notices are separate text files and do not increase the map's JavaScript payload.
