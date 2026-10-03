# Heap analytics

Production builds load environment `442235230` through the EU Heap CDN. Development and the standalone City/Model Studies pages do not load Heap. Production previews have `environment=local-preview`; deployed app events have `environment=production`.

Heap autocaptures page interactions. Custom events make canvas interactions and app outcomes queryable:

| Event | Meaning |
| --- | --- |
| Experience opened / Map ready / Map unavailable | App startup, readiness and fallback |
| UI control activated / UI field changed | Buttons, links, controls; labelled by control and surface |
| Panel toggled / Panel scrolled | About, list, details, trail, certificate and debug panels |
| Artwork selection requested / Artwork opened / Artwork closed / Artwork hovered | Artwork exploration |
| Artwork photo viewed / Artwork photo unavailable | Gallery images and expanded views |
| Artwork search | Debounced search length and result count |
| Artwork marked seen / Artwork marked unseen / Collection reset / Collection completed | Collection progress |
| Trail toggled / Trail next artwork | Trail usage and the next suggested stop |
| Map command / Map gesture / Keyboard shortcut | Reset and camera commands, drag, wheel, pinch, twist, tilt and keyboard navigation |
| Rendering quality changed / Artwork panel resized | Display preferences |
| GPS status changed / GPS field log action | GPS availability and named debug actions |
| Certificate share started / Certificate share finished / Certificate downloaded | Certificate sharing attempts, actual outcomes and downloads |

Custom events carry artwork ID, trail state, rendering mode, seen count and schema version where applicable. No event is sent for each render frame. Pointer gestures emit at completion; wheel/key bursts debounce for 300 ms; search debounces for 600 ms. Map gesture camera context is a coarse zoom level, never a position.

Target text autocapture is disabled. The field-log DOM is excluded with `heap-ignore`; its explicit action events contain only fixed action names. GPS fixes, coordinates, field-log notes and search contents are not added to custom properties. Link properties omit queries/fragments. Property names are allowlisted and the pre-SDK queue is bounded. Tracking failures never block app actions.

References: [Heap installation](https://developers.heap.io/docs/web), [custom track API](https://developers.heap.io/reference/track), [redaction](https://developers.heap.io/docs/ignoring-sensitive-data-and-pii).
