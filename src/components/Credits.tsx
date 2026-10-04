import { useEffect, useState } from "react";
import { installations } from "../data/installations";

const disclaimer =
  "This project is not affiliated with, endorsed by, sponsored by or authorised by Liverpool City Council, Culture Liverpool, Arts Council England, the River of Light organisers or the participating artists. Artwork images, names and trademarks belong to their respective owners.";
type Library = {
  name: string;
  version: string;
  licence: string;
  scope: string;
  copyright: string[];
  author?: string;
  source: string;
  notice: string;
  note?: string;
};
let catalogue: Promise<Library[]> | undefined;
const external = { target: "_blank", rel: "noreferrer" } as const;

/** Mounted only in About. Notices stay outside the map's startup bundle. */
export function Credits() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    catalogue ??= fetch("/credits/libraries.json")
      .then((r) => {
        if (!r.ok) throw new Error("Credits unavailable");
        return r.json() as Promise<Library[]>;
      })
      .catch((error) => {
        catalogue = undefined;
        throw error;
      });
    catalogue
      .then((items) => {
        if (active) setLibraries(items);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="legal-disclaimer credits-box">
      {/* Retain exactly the previous disclaimer's responsive height. */}
      <div className="credits-size-reference" aria-hidden="true">
        <strong>Unofficial project disclaimer</strong>
        <p>{disclaimer}</p>
      </div>
      <div
        className="credits-scroll"
        role="region"
        aria-label="Project disclaimer, credits and licences"
        tabIndex={0}
      >
        <strong>
          Disclaimer, credits &amp; licences <span aria-hidden="true">↓</span>
        </strong>
        <p>{disclaimer}</p>
        <h3>Credits &amp; licences</h3>
        <p>
          Map data, typography, imagery and software that make this guide
          possible. Scroll to explore; open a library for its copyright and full
          notice.
        </p>
        <h4>Maps &amp; geography</h4>
        <p>
          ©{" "}
          <a href="https://www.openstreetmap.org/copyright" {...external}>
            OpenStreetMap contributors
          </a>
          . Buildings, waterways, roads and the pedestrian network are adapted
          from OpenStreetMap under the{" "}
          <a
            href="https://opendatacommons.org/licenses/odbl/1-0/"
            {...external}
          >
            Open Database Licence (ODbL) 1.0
          </a>
          . The trail and stylised scene include project edits and approximate
          placements.
        </p>
        <p>
          <a href="/data/map.json" {...external}>
            Prepared map data
          </a>{" "}
          ·{" "}
          <a href="/data/trail.json" {...external}>
            Prepared trail data
          </a>{" "}
          ·{" "}
          <a href="https://github.com/arraymode-dev/rol26" {...external}>
            Project source and data preparation
          </a>
          . The traffic view also uses OpenStreetMap tiles.
        </p>
        <h4>Fonts &amp; icons</h4>
        <p>
          DM Sans — Copyright 2014 The DM Sans Project Authors. Manrope —
          Copyright 2018 The Manrope Project Authors. Both are served by Google
          Fonts under the SIL Open Font Licence 1.1:{" "}
          <a href="/credits/dm-sans-OFL.txt" {...external}>
            DM Sans notice
          </a>{" "}
          ·{" "}
          <a href="/credits/manrope-OFL.txt" {...external}>
            Manrope notice
          </a>
          .
        </p>
        <p>
          Georgia, Arial and system fallbacks use fonts available on your
          device; their font files are not distributed by this project. Lucide
          icons are ISC licensed, with Feather-derived portions credited to Cole
          Bemis under MIT; full notices appear below.
        </p>
        <h4>Artwork &amp; photography</h4>
        <p>
          Official artwork images and programme information are sourced from{" "}
          <a
            href="https://www.visitliverpool.com/river-of-light-2026/"
            {...external}
          >
            VisitLiverpool / River of Light
          </a>
          . Additional programme thumbnails came from the{" "}
          <a href="https://www.instagram.com/p/DdbI9FYiP8p/" {...external}>
            VisitLiverpool / Culture Liverpool carousel
          </a>
          . Artwork and image rights remain with the respective artists,
          photographers and rights holders. Attribution does not grant
          permission to reuse or redistribute them.
        </p>
        <ul className="artwork-credits">
          {installations.map((item) => (
            <li key={item.id}>
              <a href={item.source} {...external}>
                {item.name}
              </a>{" "}
              — {item.artist}
            </li>
          ))}
        </ul>
        <p>
          Site photography, the capsule passenger cutout and the guide’s logo
          were supplied by the project owner. Individual gallery captions retain
          the supplied credits; photographer ownership is not inferred. The
          stylised models, paving and moon surface are generated for this
          concept scene, with artwork designs credited above.
        </p>
        <h4>Services</h4>
        <p>
          Google Fonts supplies the web fonts. Heap (Contentsquare) supplies the
          hosted analytics service; it is a third-party service, not covered by
          this project’s open-source library licences.
        </p>
        <h4>Open-source libraries &amp; tools</h4>
        <p>
          The inventory covers the installed, version-locked application
          dependencies and development tools, including indirect packages. Some
          optional packages are unused by the rendered map. Development tools
          and native image-processing binaries are not delivered to visitors.
        </p>
        <p>
          <a href="/credits/THIRD-PARTY-NOTICES.txt" {...external}>
            Read all third-party notices
          </a>
        </p>
        {!libraries.length && (
          <p role="status">
            {failed
              ? "The library list could not load. Use the complete notices link above."
              : "Loading library notices…"}
          </p>
        )}
        {["Application dependency tree", "Build and development"].map(
          (scope) => (
            <div key={scope}>
              <h4>{scope}</h4>
              {libraries
                .filter((item) => item.scope === scope)
                .map((item) => (
                  <details
                    className="library-credit"
                    key={`${item.name}@${item.version}`}
                  >
                    <summary>
                      {item.name}{" "}
                      <span>
                        {item.version} · {item.licence}
                      </span>
                    </summary>
                    {item.copyright.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    {!item.copyright.length && (
                      <p>
                        {item.author ? `Package author: ${item.author}. ` : ""}
                        See the supplied notices for copyright terms.
                      </p>
                    )}
                    {item.note && <p>{item.note}</p>}
                    <p>
                      <a href={item.notice} {...external}>
                        Full licence / supplied notice
                      </a>{" "}
                      ·{" "}
                      <a href={item.source} {...external}>
                        Upstream project
                      </a>
                    </p>
                  </details>
                ))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
