"use client";

import { useEffect, useState } from "react";
import styles from "./reader-tools.module.css";
import { chapterReference, verseReference } from "./chapter-data";
import {
  useReader,
  type FontFamily,
  type FontSize,
  type Spacing,
  type ToolsTab,
} from "./reader-state";

// Menu secundário do leitor. O texto bíblico continua sendo o protagonista: estas
// ferramentas só abrem sob demanda, em painel sobreposto.
//
// Regras que este componente precisa respeitar:
// - somente BLIVRE está disponível; NVI, NTLH e Almeida ficam "Em licenciamento";
// - notas, destaques e progresso são "local nesta sessão" até Auth/persistência real;
// - contexto e línguas originais ficam indisponíveis enquanto não houver fonte
//   licenciada e verificada (tarefa C6). Nada é inventado aqui.

const translations: readonly {
  code: string;
  name: string;
  available: boolean;
}[] = [
  { code: "BLIVRE", name: "Bíblia Livre", available: true },
  { code: "NVI", name: "Nova Versão Internacional", available: false },
  { code: "NTLH", name: "Nova Tradução na Linguagem de Hoje", available: false },
  { code: "Almeida", name: "Edição a confirmar", available: false },
];

const fontSizes: readonly { value: FontSize; label: string }[] = [
  { value: "pequeno", label: "A−" },
  { value: "medio", label: "A" },
  { value: "grande", label: "A+" },
];

const fontFamilies: readonly { value: FontFamily; label: string }[] = [
  { value: "serif", label: "Serifada" },
  { value: "sans", label: "Sem serifa" },
];

const spacings: readonly { value: Spacing; label: string }[] = [
  { value: "compacto", label: "Compacto" },
  { value: "padrao", label: "Padrão" },
  { value: "amplo", label: "Amplo" },
];

const tabs: readonly { value: ToolsTab; label: string }[] = [
  { value: "leitura", label: "Leitura" },
  { value: "versoes", label: "Versões" },
  { value: "versiculo", label: "Versículo" },
];

export function ReaderTools() {
  const {
    theme,
    toggleTheme,
    preferences,
    setPreference,
    toolsOpen,
    openTools,
    closeTools,
    tab,
    setTab,
    selectedVerse,
    highlights,
    toggleHighlight,
    read,
    toggleRead,
    notes,
    saveNote,
    removeNote,
    totalVerses,
    notice,
    setNotice,
  } = useReader();

  const [draft, setDraft] = useState("");

  // O rascunho acompanha o versículo selecionado e a nota já guardada nesta sessão.
  useEffect(() => {
    setDraft(selectedVerse === null ? "" : (notes[selectedVerse] ?? ""));
  }, [selectedVerse, notes]);

  return (
    <div className={styles.root}>
      <button
        type="button"
        onClick={() => openTools()}
        aria-expanded={toolsOpen}
        aria-label="Abrir ferramentas de leitura"
      >
        •••
      </button>
      {toolsOpen && (
        <div className={styles.backdrop} role="presentation" onClick={closeTools}>
          <section
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label="Ferramentas de leitura"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>{chapterReference} · BLIVRE</p>
                <h2>Ferramentas de leitura</h2>
              </div>
              <button type="button" onClick={closeTools} aria-label="Fechar ferramentas">
                ×
              </button>
            </header>
            <nav aria-label="Seções das ferramentas">
              {tabs.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={tab === item.value ? styles.active : ""}
                  aria-current={tab === item.value ? "true" : undefined}
                  onClick={() => setTab(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {tab === "leitura" && (
              <div className={styles.content}>
                <h3>Tamanho do texto</h3>
                <div className={styles.controls}>
                  {fontSizes.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={preferences.fontSize === item.value ? styles.on : ""}
                      aria-pressed={preferences.fontSize === item.value}
                      onClick={() => setPreference("fontSize", item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <h3>Fonte</h3>
                <div className={styles.choices}>
                  {fontFamilies.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={preferences.fontFamily === item.value ? styles.on : ""}
                      aria-pressed={preferences.fontFamily === item.value}
                      onClick={() => setPreference("fontFamily", item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <h3>Espaçamento</h3>
                <div className={styles.choices}>
                  {spacings.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={preferences.spacing === item.value ? styles.on : ""}
                      aria-pressed={preferences.spacing === item.value}
                      onClick={() => setPreference("spacing", item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <h3>Tema</h3>
                <div className={styles.choices}>
                  <button
                    type="button"
                    className={theme === "dark" ? styles.on : ""}
                    aria-pressed={theme === "dark"}
                    onClick={() => {
                      if (theme !== "dark") toggleTheme();
                    }}
                  >
                    Escuro
                  </button>
                  <button
                    type="button"
                    className={theme === "light" ? styles.on : ""}
                    aria-pressed={theme === "light"}
                    onClick={() => {
                      if (theme !== "light") toggleTheme();
                    }}
                  >
                    Claro
                  </button>
                </div>
                <p className={styles.local}>
                  Fonte, tamanho, espaçamento e tema são aplicados agora e ficam local nesta sessão
                  deste navegador. Não são salvos em conta e são descartados ao fechar a aba.
                </p>
              </div>
            )}

            {tab === "versoes" && (
              <div className={styles.content}>
                <h3>Traduções</h3>
                {translations.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className={styles.translation}
                    disabled={!item.available}
                    onClick={() =>
                      setNotice("BLIVRE já está selecionada: é a única tradução liberada.")
                    }
                  >
                    <b>{item.code}</b>
                    <span>{item.name}</span>
                    <em>{item.available ? "Disponível" : "Em licenciamento"}</em>
                  </button>
                ))}
                <p className={styles.local}>
                  Versões protegidas só serão abertas após licença documental por edição. Nenhuma
                  data de liberação está prometida.
                </p>
              </div>
            )}

            {tab === "versiculo" && (
              <div className={styles.content}>
                {selectedVerse === null ? (
                  <>
                    <p className={styles.selected}>NENHUM VERSÍCULO SELECIONADO</p>
                    <p className={styles.local}>
                      Toque em um versículo do capítulo para destacar, anotar ou marcar como lido
                      nesta sessão.
                    </p>
                  </>
                ) : (
                  <>
                    <p className={styles.selected}>
                      VERSÍCULO SELECIONADO · {verseReference(selectedVerse).toUpperCase()}
                    </p>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={highlights.has(selectedVerse) ? styles.on : ""}
                        aria-pressed={highlights.has(selectedVerse)}
                        onClick={() => {
                          const active = highlights.has(selectedVerse);
                          toggleHighlight(selectedVerse);
                          setNotice(
                            active
                              ? "Destaque removido (local nesta sessão)."
                              : "Destaque aplicado: local nesta sessão.",
                          );
                        }}
                      >
                        ● {highlights.has(selectedVerse) ? "Remover destaque" : "Destacar"}
                      </button>
                      <button
                        type="button"
                        className={read.has(selectedVerse) ? styles.on : ""}
                        aria-pressed={read.has(selectedVerse)}
                        onClick={() => {
                          const active = read.has(selectedVerse);
                          toggleRead(selectedVerse);
                          setNotice(
                            active
                              ? "Marca de leitura removida (local nesta sessão)."
                              : "Marcado como lido: local nesta sessão.",
                          );
                        }}
                      >
                        ✓ {read.has(selectedVerse) ? "Desmarcar lido" : "Lido"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setNotice(
                            "Contexto do livro indisponível: depende de fonte licenciada e revisada ainda não importada.",
                          )
                        }
                      >
                        ⌁ Contexto
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setNotice(
                            "Grego e hebraico indisponíveis: nenhuma edição crítica com licença e checksum foi importada.",
                          )
                        }
                      >
                        α Original
                      </button>
                    </div>

                    <h3>Nota deste versículo</h3>
                    <textarea
                      className={styles.note}
                      value={draft}
                      maxLength={10000}
                      rows={4}
                      placeholder="Escreva sua nota. Ela fica local nesta sessão."
                      aria-label={`Nota local para ${verseReference(selectedVerse)}`}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <div className={styles.choices}>
                      <button
                        type="button"
                        onClick={() => {
                          saveNote(selectedVerse, draft);
                          setNotice(
                            draft.trim().length === 0
                              ? "Nota vazia: nada guardado."
                              : "Nota guardada local nesta sessão.",
                          );
                        }}
                      >
                        Guardar nota
                      </button>
                      <button
                        type="button"
                        disabled={!notes[selectedVerse]}
                        onClick={() => {
                          removeNote(selectedVerse);
                          setDraft("");
                          setNotice("Nota apagada desta sessão.");
                        }}
                      >
                        Apagar nota
                      </button>
                    </div>

                    <p className={styles.local}>
                      Progresso desta sessão: {read.size} de {totalVerses} versículos deste
                      capítulo. Notas, destaques e progresso são local nesta sessão: não há conta,
                      não há sincronização e nada é enviado a servidor.
                    </p>
                  </>
                )}
              </div>
            )}

            {notice && (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
