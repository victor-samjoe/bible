import { describe, expect, it } from "vitest";
import {
  activeAreaOf,
  appAreas,
  isAreaActive,
  isAreaAvailable,
  unavailableReason,
  type AppArea,
} from "../../src/domain/app-navigation";

function areaOf(id: string): AppArea {
  const area = appAreas.find((entry) => entry.id === id);
  if (!area) throw new Error(`área inexistente no teste: ${id}`);
  return area;
}

describe("áreas do aplicativo", () => {
  it("segue a ordem e os rótulos pedidos na fila C15", () => {
    expect(appAreas.map((area) => area.label)).toEqual([
      "Início",
      "Bíblia",
      "Materiais",
      "Notas",
      "Estudos",
      "Cursos",
      "Planos",
      "Perfil",
      "Acessos",
    ]);
  });

  it("não repete id nem rota", () => {
    expect(new Set(appAreas.map((area) => area.id)).size).toBe(appAreas.length);
    expect(new Set(appAreas.map((area) => area.href)).size).toBe(appAreas.length);
  });

  it("só marca como disponível a área que tem página publicada", () => {
    // `perfil` entra aqui porque `app/perfil/page.tsx` existe (frente C17b).
    for (const id of ["inicio", "biblia", "materiais", "estudos", "cursos", "planos", "perfil", "acessos"]) {
      expect(isAreaAvailable(areaOf(id))).toBe(true);
      expect(unavailableReason(areaOf(id))).toBeNull();
    }
  });

  it("deixa notas indisponível, com motivo escrito, porque não existe página", () => {
    const area = areaOf("notas");
    expect(isAreaAvailable(area)).toBe(false);
    expect(unavailableReason(area)?.length ?? 0).toBeGreaterThan(20);
  });

  it("descreve cada área sem prometer sincronização", () => {
    for (const area of appAreas) {
      expect(area.description.trim().length).toBeGreaterThan(0);
      expect(area.href.startsWith("/")).toBe(true);
    }
  });
});

describe("área ativa", () => {
  it("casa segmento inteiro, não prefixo solto", () => {
    expect(isAreaActive("/biblia", areaOf("biblia"))).toBe(true);
    expect(isAreaActive("/biblia/genesis/1", areaOf("biblia"))).toBe(true);
    expect(isAreaActive("/bibliateca", areaOf("biblia"))).toBe(false);
    expect(isAreaActive("/estudos/romanos-9-contexto", areaOf("estudos"))).toBe(true);
    expect(isAreaActive("/estudos", areaOf("materiais"))).toBe(false);
  });

  it("ignora barra final, query e fragmento", () => {
    expect(isAreaActive("/inicio/", areaOf("inicio"))).toBe(true);
    expect(isAreaActive("/inicio?x=1", areaOf("inicio"))).toBe(true);
    expect(isAreaActive("/inicio#conteudo", areaOf("inicio"))).toBe(true);
  });

  it("não ativa nenhuma área na raiz nem em rota vazia", () => {
    expect(activeAreaOf("/")).toBeNull();
    expect(activeAreaOf("")).toBeNull();
    for (const area of appAreas) expect(isAreaActive("/", area)).toBe(false);
  });

  it("não ativa área indisponível, mesmo que a rota coincida", () => {
    expect(isAreaActive("/notas", areaOf("notas"))).toBe(false);
    expect(activeAreaOf("/notas")).toBeNull();
  });

  it("ativa perfil, que tem página publicada", () => {
    expect(isAreaActive("/perfil", areaOf("perfil"))).toBe(true);
    expect(activeAreaOf("/perfil")?.id).toBe("perfil");
  });

  it("devolve a área da rota atual", () => {
    expect(activeAreaOf("/biblia/joao/3")?.id).toBe("biblia");
    expect(activeAreaOf("/materiais")?.id).toBe("materiais");
    expect(activeAreaOf("/cursos")?.id).toBe("cursos");
  });

  it("em empate, vence a rota mais específica", () => {
    const areas: readonly AppArea[] = [
      { ...areaOf("estudos"), id: "raiz", href: "/estudos" },
      { ...areaOf("estudos"), id: "profundo", href: "/estudos/romanos-9-contexto" },
    ];
    expect(activeAreaOf("/estudos/romanos-9-contexto", areas)?.id).toBe("profundo");
  });
});
