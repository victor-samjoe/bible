"use client";

import styles from "./reader-tools.module.css";
import {
  useReader,
  type FontFamily,
  type FontSize,
  type ReaderTheme,
  type Spacing,
} from "./reader-state";

// Menu de três pontos: **somente configurações de leitura** (tarefa C13).
//
// Tema, tamanho, fonte e espaçamento. Nada de versões e nada de ações de
// seleção aqui: comparar traduções, consultar original, destacar e anotar vivem
// na barra que aparece quando há seleção, e "lido" é um botão de capítulo no
// cabeçalho.

const fontSizes: readonly { value: FontSize; label: string }[] = [
  { value: "muito-pequeno", label: "Muito pequeno" },
  { value: "menor", label: "Menor" },
  { value: "pequeno", label: "Pequeno" },
  { value: "medio", label: "Padrão" },
  { value: "grande", label: "Grande" },
];

const fontFamilies: readonly { value: FontFamily; label: string }[] = [
  { value: "serif", label: "Serifada" },
  { value: "sans", label: "Sem serifa" },
  { value: "literaria", label: "Literária" },
  { value: "humana", label: "Humanista" },
  { value: "monospace", label: "Monoespaçada" },
];

const spacings: readonly { value: Spacing; label: string }[] = [
  { value: "continuo", label: "Leitura contínua" },
  { value: "compacto", label: "Compacto" },
  { value: "padrao", label: "Padrão" },
  { value: "amplo", label: "Amplo" },
];

const themes: readonly { value: ReaderTheme; label: string }[] = [
  { value: "dark", label: "Escuro" },
  { value: "light", label: "Claro" },
];

export function ReaderTools() {
  const {
    theme,
    setTheme,
    preferences,
    setPreference,
    settingsOpen,
    openSettings,
    closeSettings,
    reference,
  } = useReader();

  return (
    <div className={styles.root}>
      <button
        type="button"
        onClick={openSettings}
        aria-expanded={settingsOpen}
        aria-label="Abrir configurações de leitura"
      >
        •••
      </button>
      {settingsOpen && (
        <div className={styles.backdrop} role="presentation" onClick={closeSettings}>
          <section
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label="Configurações de leitura"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>{reference}</p>
                <h2>Configurações de leitura</h2>
              </div>
              <button type="button" onClick={closeSettings} aria-label="Fechar configurações">
                ×
              </button>
            </header>

            <div className={styles.content}>
              <h3 id="ajuste-tema">Tema</h3>
              <div className={styles.choices} role="group" aria-labelledby="ajuste-tema">
                {themes.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={theme === item.value ? styles.on : ""}
                    aria-pressed={theme === item.value}
                    onClick={() => setTheme(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <h3 id="ajuste-tamanho">Tamanho do texto</h3>
              <div className={styles.choices} role="group" aria-labelledby="ajuste-tamanho">
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

              <h3 id="ajuste-fonte">Fonte</h3>
              <div className={styles.choices} role="group" aria-labelledby="ajuste-fonte">
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

              <h3 id="ajuste-espacamento">Espaçamento</h3>
              <div className={styles.choices} role="group" aria-labelledby="ajuste-espacamento">
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

              <p className={styles.local}>
                Tema, tamanho, fonte e espaçamento são aplicados agora e ficam local nesta sessão
                deste navegador. Não são salvos em conta e são descartados ao fechar a aba.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
