"use client";

import { useReader } from "./reader-state";

// Atalho de tema no cabeçalho. O estado real mora em ReaderProvider, para que este
// botão e a aba "Leitura" das ferramentas nunca mostrem valores diferentes.
export function ThemeToggle() {
  const { theme, toggleTheme } = useReader();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      {theme === "dark" ? "☀" : "◐"}
    </button>
  );
}
