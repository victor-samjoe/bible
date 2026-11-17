import { join } from "node:path";
import { draft, loadStudy, newStudy, publish, research, submit } from "./workflow";
import { validateStudy } from "../domain/editorial/validation";

async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  const directory = join(process.cwd(), "editorial-drafts");
  if (command === "study:new") {
    const options = new Map<string, string>();
    for (let i = 0; i < rest.length; i += 2) {
      const key = rest[i];
      const value = rest[i + 1];
      if (!key || !["--topic", "--passage", "--type"].includes(key) || !value || value.startsWith("--") || options.has(key)) throw new Error("Opções inválidas: use --topic, --passage e --type uma vez cada.");
      options.set(key, value);
    }
    const study = await newStudy(directory, options.get("--topic") ?? "", options.get("--passage") ?? "", options.get("--type") ?? "");
    console.log(`Rascunho criado: ${study.id}`);
    return;
  }
  if (!command || rest.length !== 1 || !rest[0]) throw new Error("Use study:new, study:research, study:draft, study:validate, study:submit ou study:publish.");
  const id = rest[0];
  switch (command) {
    case "study:research": await research(directory, id); console.log("Dossiê mantido para pesquisa manual; nenhuma fonte foi inventada."); return;
    case "study:draft": await draft(directory, id); console.log("Estrutura de rascunho preparada."); return;
    case "study:validate": {
      const errors = validateStudy(await loadStudy(directory, id));
      if (errors.length) throw new Error(errors.join("\n"));
      console.log("Validação editorial aprovada."); return;
    }
    case "study:submit": await submit(directory, id); console.log("Enviado para revisão."); return;
    case "study:publish": await publish(directory, id);
    default: throw new Error("Comando desconhecido.");
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Erro editorial.");
  process.exitCode = 1;
});
