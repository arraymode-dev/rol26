import fs from "node:fs/promises";
import sharp from "sharp";
const manifestPath = new URL(
  "../src/data/official-artworks.json",
  import.meta.url,
);
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const folder = new URL("../public/photos/official/", import.meta.url);
await fs.mkdir(folder, { recursive: true });
const rows = Object.entries(manifest);
for (let i = 0; i < rows.length; i += 3)
  await Promise.all(
    rows.slice(i, i + 3).map(async ([id, item]) => {
      const originalImage = item.originalImage ?? item.image;
      const response = await fetch(originalImage);
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/")
      )
        throw Error(`Official image failed: ${id} (${response.status})`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const optimized = await sharp(bytes)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      await fs.writeFile(new URL(`${id}.webp`, folder), optimized);
      item.originalImage = originalImage;
      item.image = `/photos/official/${id}.webp`;
      console.log(
        `${id}: ${Math.round(bytes.length / 1024)} KB -> ${Math.round(optimized.length / 1024)} KB`,
      );
    }),
  );
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
