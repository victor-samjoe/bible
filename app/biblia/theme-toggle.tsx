"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const next = window.sessionStorage.getItem("reader-theme") === "light" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.readerTheme = next;
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.sessionStorage.setItem("reader-theme", next);
    document.documentElement.dataset.readerTheme = next;
  }

  return <button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}>{theme === "dark" ? "☀" : "◐"}</button>;
}
