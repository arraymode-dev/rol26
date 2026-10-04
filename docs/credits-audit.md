# Credits audit — 4 October 2026

The About panel retains the former disclaimer's responsive height and scrolls internally. Its library inventory is fetched only when About opens. Font licences and all installed package notices are served as text from `public/credits/`, outside the application JavaScript bundles.

## Scope and provenance

- OpenStreetMap map/network data and derived trail: ODbL 1.0, credited both on the map and in About, with links to the prepared data and preparation source.
- DM Sans and Manrope: SIL OFL 1.1, copyright notices and full licence copies from the Google Fonts upstream repository. Reference download URLs are in `references/licences/sources.json`.
- Device fonts (Georgia, Arial, system fallbacks): no font binaries bundled.
- Artwork images/programme thumbnails: VisitLiverpool / Culture Liverpool sources and named artists, with the existing gallery credits retained. No public redistribution permission is established by attribution. Individual photographers are not identified in the supplied metadata.
- Field photographs, passenger cutout and logo: project-owner supplied; ownership is not inferred from supply.
- Procedural models/materials: project-created; artwork design credits remain with the listed artists.
- Heap/Contentsquare: hosted analytics service, separately identified rather than represented as an open-source dependency.
- 145 installed package/version entries, including indirect and optional dependencies and build tools. Some are not used by the rendered app. Platform variants absent from this machine are outside this installed-tree inventory. Root licence/notice files (including bundled third-party notices) are copied verbatim; key upstream omissions have supplemental copies with source records.
- Sharp's native libvips bundle is a development image-processing tool, not a website download. Its vendor README is retained with the bundled native library/licence table.

## Explicit gaps

`maath@0.10.8` and `stats-gl@2.4.2` declare MIT in package metadata but omit standalone notices. Their versioned/current upstream trees inspected during this audit did not supply a matching notice. The UI and text files state this gap; no copyright owner or historical licence text was fabricated. A newer maath licence was deliberately not attributed to the older installed version.

## Maintenance

Run `npm run credits:prepare` after changing dependencies, then review the regenerated inventory and any missing-notice warnings. The generator reads the lockfile and installed packages without network access. Supplemental notices are version-reviewed inputs, not an automatic licence-clearance service. Do not auto-regenerate on hosting platforms with a different native dependency tree without reviewing the diff.
