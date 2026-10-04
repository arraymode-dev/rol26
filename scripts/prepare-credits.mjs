// Regenerate from the installed, lockfile-pinned tree; no network during builds.
import fs from "node:fs";
import path from "node:path";
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const root = JSON.parse(fs.readFileSync("package.json", "utf8"));

const extra = {
  "@react-three/fiber": ["references/licences/fiber.txt"],
  draco3d: ["references/licences/draco3d.txt"],
  "@mediapipe/tasks-vision": ["references/licences/mediapipe.txt"],
  "@esbuild/darwin-arm64": ["node_modules/esbuild/LICENSE.md"],
  "@rollup/rollup-darwin-arm64": ["node_modules/rollup/LICENSE.md"],
  "@img/sharp-libvips-darwin-arm64": [
    "node_modules/@img/sharp-libvips-darwin-arm64/README.md",
  ],
  "clipper-lib": [
    "references/licences/boost.txt",
    "references/licences/jsbn.txt",
  ],
};
const entries = [];
const output = "public/credits";
fs.mkdirSync(output, { recursive: true });
for (const [dir, meta] of Object.entries(lock.packages)) {
  if (!dir || !fs.existsSync(`${dir}/package.json`)) continue;
  const pkg = JSON.parse(fs.readFileSync(`${dir}/package.json`, "utf8"));
  const files = fs
    .readdirSync(dir)
    .filter(
      (f) =>
        /^(licen[cs]e|copying|notice)(\.|$|-)|third.*notic/i.test(f) &&
        fs.statSync(path.join(dir, f)).isFile(),
    )
    .map((f) => path.join(dir, f));
  files.push(...(extra[pkg.name] ?? []));
  let text = files
    .map((f) => `--- ${f} ---\n${fs.readFileSync(f, "utf8")}`)
    .join("\n\n");
  if (pkg.name === "clipper-lib")
    text =
      fs.readFileSync(`${dir}/clipper.js`, "utf8").split("(function ()")[0] +
      "\n" +
      text;
  const authors =
    typeof pkg.author === "string"
      ? pkg.author
      : Array.isArray(pkg.author)
        ? pkg.author.join("; ")
        : pkg.author?.name;
  const copyright = [
    ...new Set(
      text
        .split("\n")
        .map((l) => l.trim())
        .filter(
          (l) =>
            /copyright\s*(?:\([cC]\)|©|:|\d)|^Copyright \(c\) for portions/i.test(
              l,
            ) &&
            !/above|notice|holder|following|shall|retain|include|license|disclaimer/i.test(
              l,
            ),
        ),
    ),
  ];
  if (pkg.name === "lucide-react")
    copyright.splice(
      0,
      copyright.length,
      "Copyright (c) for portions of Lucide: Cole Bemis 2013–2022 (Feather). Other Lucide copyright: Lucide Contributors 2022.",
    );
  const licence =
    pkg.name === "clipper-lib"
      ? "BSL-1.0; embedded JSBN notice"
      : typeof pkg.license === "string"
        ? pkg.license
        : (pkg.license?.type ??
          (text.includes("MIT License") ? "MIT" : "See notices"));
  const gap = !files.length
    ? "The installed package declares this licence but includes no standalone copyright/licence notice. See its upstream project."
    : pkg.name.startsWith("@img/sharp-libvips")
      ? "Build-time image tooling only. Its vendor README lists bundled native libraries and their individual licences; these binaries are not shipped with the website."
      : undefined;
  const repository =
    typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const rawUrl = (
    repository ??
    pkg.homepage ??
    `https://www.npmjs.com/package/${pkg.name}`
  )
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/\.git$/, "");
  const url = rawUrl.startsWith("ssh://git@github.com/")
    ? rawUrl.replace("ssh://git@github.com/", "https://github.com/")
    : rawUrl.startsWith("git@github.com:")
      ? rawUrl.replace("git@github.com:", "https://github.com/")
      : /^[\w.-]+\/[\w.-]+$/.test(rawUrl)
        ? `https://github.com/${rawUrl}`
        : /^https?:/.test(rawUrl)
          ? rawUrl
          : `https://www.npmjs.com/package/${pkg.name}`;
  const name = `${pkg.name.replaceAll("/", "__")}--${pkg.version}.txt`;
  const notice = `${pkg.name} ${pkg.version}\nDeclared licence: ${licence}\n${authors ? `Package author: ${authors}\n` : ""}Source: ${url}\n${gap ?? ""}\n\n${text}`;
  fs.writeFileSync(`${output}/${name}`, notice);
  entries.push({
    name: pkg.name,
    version: pkg.version,
    licence,
    scope: meta.dev ? "Build and development" : "Application dependency tree",
    direct:
      dir === `node_modules/${pkg.name}` &&
      (!!root.dependencies?.[pkg.name] || !!root.devDependencies?.[pkg.name]),
    copyright,
    author: authors,
    source: url,
    notice: `/credits/${name}`,
    note: gap,
  });
}
entries.sort(
  (a, b) => Number(b.direct) - Number(a.direct) || a.name.localeCompare(b.name),
);
for (const name of ["dm-sans", "manrope"])
  fs.copyFileSync(
    `references/licences/${name}.txt`,
    `${output}/${name}-OFL.txt`,
  );
fs.writeFileSync(
  `${output}/libraries.json`,
  JSON.stringify(entries, null, 2) + "\n",
);
fs.writeFileSync(
  `${output}/THIRD-PARTY-NOTICES.txt`,
  "River of Light unofficial guide — third-party notices\nInstalled dependencies, including development tools and optional transitive packages. Inclusion does not mean a package is loaded in the browser. Platform packages not installed on this audit machine are excluded.\n\n" +
    entries
      .map((e) => fs.readFileSync(`public${e.notice}`, "utf8"))
      .join("\n\n" + "=".repeat(72) + "\n\n") +
    "\n\nDM Sans\n" +
    fs.readFileSync("references/licences/dm-sans.txt", "utf8") +
    "\n\nManrope\n" +
    fs.readFileSync("references/licences/manrope.txt", "utf8"),
);
console.log(
  `Generated notices for ${entries.length} installed packages. Missing standalone notices: ${entries
    .filter((e) => e.note?.startsWith("The installed"))
    .map((e) => e.name)
    .join(", ")}`,
);
