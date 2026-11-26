/** Verifica os bytes preparados para commit, inclusive conversão de quebras de linha do Git. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";

const git = ["-c", `safe.directory=${process.cwd().replaceAll("\\", "/")}`];
const manifest = JSON.parse(execFileSync("git", [...git, "show", ":public/biblia-offline/manifest.json"], { encoding: "utf8" }));
const paths = manifest.files.map((item) => `public${item.path}`);
const batch = execFileSync("git", [...git, "cat-file", "--batch"], {
  input: paths.map((path) => `:${path}\n`).join(""), maxBuffer: 20 * 1024 * 1024,
});
let offset = 0;
for (let index = 0; index < paths.length; index += 1) {
  const end = batch.indexOf(10, offset);
  assert(end >= 0, `cabeçalho ausente: ${paths[index]}`);
  const header = batch.subarray(offset, end).toString("utf8");
  const match = /^[0-9a-f]{40} blob (\d+)$/u.exec(header);
  assert(match, `blob ausente: ${paths[index]} (${header})`);
  const size = Number(match[1]);
  const content = batch.subarray(end + 1, end + 1 + size);
  assert.equal(content.length, size);
  assert.equal(createHash("sha256").update(content).digest("hex"), manifest.files[index].sha256, `hash divergente: ${paths[index]}`);
  offset = end + 1 + size + 1;
}
assert.equal(offset, batch.length);
console.log(`${paths.length} arquivos preparados para commit conferem com o manifesto — OK`);
