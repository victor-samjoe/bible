"use client";

import { useEffect, useState } from "react";
import styles from "./selection-bar.module.css";
import { highlightColors, type HighlightColor } from "@/src/domain/reader-marks";
import { useReader } from "./reader-state";

// Barra de ações da seleção (tarefa C13). Discreta e flutuante: só existe quando
// há versículo selecionado, e o texto continua sendo o protagonista.
//
// Regras que esta barra precisa respeitar:
// - comparar traduções e consultar original só abrem a partir de uma seleção;
// - somente BLIVRE está disponível; NVI, NTLH e Almeida ficam "Em licenciamento",
//   sem data prometida;
// - original e comparação explicam a indisponibilidade em vez de inventar dado;
// - destaque, nota e progresso são "local nesta sessão", sem conta.

const colorLabel: Record<HighlightColor, string> = {
  amarelo: "Amarelo",
  verde: "Verde",
  azul: "Azul",
  rosa: "Rosa",
};

const translations: readonly { code: string; name: string; available: boolean }[] = [
  { code: "BLIVRE", name: "Bíblia Livre", available: true },
  { code: "NVI", name: "Nova Versão Internacional", available: false },
  { code: "NTLH", name: "Nova Tradução na Linguagem de Hoje", available: false },
  { code: "Almeida", name: "Edição a confirmar", available: false },
];

export function SelectionBar() {
  const {
    selection,
    selectionLabel,
    clearSelection,
    applyHighlight,
    removeHighlight,
    highlightOf,
    selectionNote,
    saveNote,
    removeNote,
    panel,
    openPanel,
    closePanel,
    notice,
    setNotice,
  } = useReader();

  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const count = selection.size;
  const hasHighlight = [...selection].some((verse) => highlightOf(verse) !== undefined);

  // O rascunho acompanha a seleção e a nota já guardada para exatamente esses
  // versículos.
  useEffect(() => {
    setDraft(selectionNote);
  }, [selectionNote, selectionLabel]);

  // Sem seleção não há barra nem menu aberto.
  useEffect(() => {
    if (count === 0) setMenuOpen(false);
  }, [count]);

  if (count === 0) return null;

  return (
    <>
      <div className={styles.root} role="region" aria-label="Ações da seleção">
        <div className={styles.bar}>
          <p className={styles.label} aria-live="polite">
            <b>{selectionLabel}</b>
            <span>
              {count} {count === 1 ? "versículo selecionado" : "versículos selecionados"}
            </span>
          </p>
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.primary}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              Ações <span aria-hidden="true">{menuOpen ? "▾" : "▴"}</span>
            </button>
            <button type="button" onClick={clearSelection}>
              Limpar
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className={styles.menu} aria-label="Ações disponíveis">
            <p className={styles.group} id="grupo-destaque">
              Destacar
            </p>
            <div className={styles.colors} role="group" aria-labelledby="grupo-destaque">
              {highlightColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={styles.color}
                  data-color={color}
                  onClick={() => {
                    applyHighlight(color);
                    setNotice(`Destaque ${colorLabel[color].toLowerCase()} aplicado: local nesta sessão.`);
                  }}
                >
                  <span className={styles.swatch} data-color={color} aria-hidden="true" />
                  {colorLabel[color]}
                </button>
              ))}
              <button
                type="button"
                className={styles.color}
                disabled={!hasHighlight}
                onClick={() => {
                  removeHighlight();
                  setNotice("Destaque removido desta sessão.");
                }}
              >
                Remover destaque
              </button>
            </div>

            <p className={styles.group}>Texto</p>
            <div className={styles.actions}>
              <button type="button" onClick={() => openPanel("nota")}>
                ✎ {selectionNote ? "Editar nota" : "Adicionar nota"}
              </button>
              <button type="button" onClick={() => openPanel("versoes")}>
                ⇄ Comparar traduções
              </button>
              <button type="button" onClick={() => openPanel("original")}>
                α Consultar original
              </button>
              <button type="button" onClick={clearSelection}>
                ✕ Limpar seleção
              </button>
            </div>
          </div>
        )}

        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
      </div>

      {panel !== null && (
        <div className={styles.backdrop} role="presentation" onClick={closePanel}>
          <section
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label={
              panel === "nota"
                ? "Nota da seleção"
                : panel === "versoes"
                  ? "Comparar traduções"
                  : "Consultar original"
            }
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>{selectionLabel}</p>
                <h2>
                  {panel === "nota"
                    ? "Nota da seleção"
                    : panel === "versoes"
                      ? "Comparar traduções"
                      : "Consultar original"}
                </h2>
              </div>
              <button type="button" onClick={closePanel} aria-label="Fechar painel">
                ×
              </button>
            </header>

            {panel === "nota" && (
              <div className={styles.content}>
                <textarea
                  className={styles.note}
                  value={draft}
                  maxLength={10000}
                  rows={5}
                  placeholder="Escreva sua nota. Ela fica local nesta sessão."
                  aria-label={`Nota local para ${selectionLabel}`}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <div className={styles.actions}>
                  <button
                    type="button"
                    onClick={() => {
                      saveNote(draft);
                      setNotice(
                        draft.trim().length === 0
                          ? "Nota vazia: nada guardado."
                          : `Nota guardada em ${selectionLabel}, local nesta sessão.`,
                      );
                      closePanel();
                    }}
                  >
                    Guardar nota
                  </button>
                  <button
                    type="button"
                    disabled={selectionNote.length === 0}
                    onClick={() => {
                      removeNote();
                      setDraft("");
                      setNotice("Nota apagada desta sessão.");
                      closePanel();
                    }}
                  >
                    Apagar nota
                  </button>
                </div>
                <p className={styles.local}>
                  A nota pertence a esta seleção exata ({selectionLabel}) e fica local nesta sessão:
                  não há conta, não há sincronização e nada é enviado a servidor.
                </p>
              </div>
            )}

            {panel === "versoes" && (
              <div className={styles.content}>
                <p className={styles.local}>
                  A comparação exige pelo menos duas traduções liberadas. Hoje só a Bíblia Livre
                  está disponível, então não há o que comparar — e nenhum texto de outra versão é
                  exibido ou aproximado aqui.
                </p>
                {translations.map((item) => (
                  <div key={item.code} className={styles.translation}>
                    <b>{item.code}</b>
                    <span>{item.name}</span>
                    <em>{item.available ? "Disponível" : "Em licenciamento"}</em>
                  </div>
                ))}
                <p className={styles.local}>
                  Versões protegidas só serão abertas após licença documental por edição. Nenhuma
                  data de liberação está prometida.
                </p>
              </div>
            )}

            {panel === "original" && (
              <div className={styles.content}>
                <p className={styles.local}>
                  Grego e hebraico indisponíveis para {selectionLabel}: nenhuma edição crítica foi
                  importada com licença, checksum e proveniência verificados.
                </p>
                <p className={styles.local}>
                  Enquanto isso, nada de original é exibido — nem palavra, nem transliteração, nem
                  glossa, nem morfologia. Inventar esses dados seria pior do que não mostrá-los.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
