"use client";

import { useEffect, useState } from "react";
import styles from "./palavra.module.css";

/** Só oferece áudio quando o navegador disponibiliza uma voz hebraica. */
export function Pronunciation({ word }: { readonly word: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoice(window.speechSynthesis.getVoices().find((item) => /^he(?:-|$)/i.test(item.lang)) ?? null);
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  if (!voice) return null;
  return <button className={styles.listen} type="button" onClick={() => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = voice.lang;
    utterance.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }}>▶ Ouvir pronúncia</button>;
}
