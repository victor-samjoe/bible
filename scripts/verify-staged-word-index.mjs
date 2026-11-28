import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = "public/word-study/cf56d8fd29bb1ed5";
const git = (path) => execFileSync("git", ["-c", `safe.directory=${process.cwd().replaceAll("\\", "/")}`, "show", `:${path}`], { maxBuffer: 8 * 1024 * 1024 });
const manifest = JSON.parse(git(`${root}/manifest.json`).toString("utf8"));
for (const part of manifest.partitions) {
  const bytes = git(`${root}/${part.file}`);
  if (bytes.length !== part.bytes || createHash("sha256").update(bytes).digest("hex") !== part.sha256) throw new Error(`Bytes divergentes no Git: ${part.file}`);
}
console.log(`${manifest.partitions.length} partições no índice Git conferem com o manifesto`);
