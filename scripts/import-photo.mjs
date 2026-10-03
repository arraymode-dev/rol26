import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { basename, extname } from "node:path";
import sharp from "sharp";
import { installations } from "../src/data/installations.ts";
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (all, value, index, values) =>
        value.startsWith("--")
          ? [...all, [value.slice(2), values[index + 1]]]
          : all,
      [],
    ),
);
if (
  !args.file ||
  !args.installation ||
  !installations.some((i) => i.id === args.installation)
)
  throw new Error(
    "Usage: npm run photos:import -- --file /path/to/image --installation loop --kind site --direction north",
  );
const kind = args.kind ?? "site";
if (!["site", "artwork"].includes(kind))
  throw new Error("kind must be site or artwork");
const name = basename(args.file, extname(args.file))
  .replace(/[^a-z0-9]+/gi, "-")
  .toLowerCase();
const file = `${args.installation}-${name}.webp`;
mkdirSync("public/photos", { recursive: true });
if (existsSync(`public/photos/${file}`))
  throw new Error(
    "This photo was already imported; use a different filename to add a new version.",
  );
await sharp(args.file)
  .rotate()
  .resize({
    width: 1600,
    height: 1200,
    fit: "inside",
    withoutEnlargement: true,
  })
  .webp({ quality: 84 })
  .toFile(`public/photos/${file}`);
const path = "src/data/survey.json",
  survey = JSON.parse(readFileSync(path, "utf8"));
survey.photos.push({
  installationId: args.installation,
  src: `/photos/${file}`,
  alt:
    args.alt ??
    `${kind === "site" ? "Location study" : "Artwork photograph"}: ${installations.find((i) => i.id === args.installation).name}`,
  credit: args.credit ?? "Photo supplied by project owner",
  kind,
  ...(args.direction ? { direction: args.direction } : {}),
});
writeFileSync(path, JSON.stringify(survey, null, 2) + "\n");
console.log(
  `Added ${file}. The original is unchanged; no location metadata is published.`,
);
