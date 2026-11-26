import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { sanitizeUsfm } from "../../src/server/contracts/bible";

describe("texto offline e leitor online", () => {
  it("aplica a mesma limpeza de notas, referências e palavras acrescentadas", () => {
    const html = readFileSync("public/leitor-offline.html", "utf8");
    const source = html.match(/function limparUsfm\(valor\)\s*\{[\s\S]*?\n  \}/u)?.[0];
    expect(source).toBeDefined();
    const clean = runInNewContext(`(${source})`) as (value: string) => string;
    for (const verse of [
      "No princípio era a Palavra, \\f + \\fr 1:1 \\fq Palavra \\ft equiv. Verbo \\f* e a Palavra era Deus.",
      "Ele \\add era\\add* justo. \\x + \\xo 1:1 \\xt Gn 1:1 \\x* Fim.",
      "Um \\nd nome\\nd* simples.",
    ]) expect(clean(verse)).toBe(sanitizeUsfm(verse));
  });
});
