"use client";

import { useEffect, useRef } from "react";
import { stopActiveSpeech } from "./speech";
import styles from "./speech.module.css";

const sample = [
  "No princípio criou Deus os céus e a terra.",
  "E a terra estava desordenada e vazia, e as trevas estavam sobre a face do abismo, e o Espírito de Deus se movia sobre a face das águas.",
  "E disse Deus: Haja luz; e houve luz.",
];

/** Prévia pontual de homologação, só para o texto que foi gravado. */
export function VoiceDemo({ book, chapter, translation, verses }: {
  readonly book: string; readonly chapter: number; readonly translation: string;
  readonly verses: readonly { readonly number: number; readonly content: string }[];
}) {
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const pause = () => audio.current?.pause();
    window.addEventListener("reader-speech-start", pause);
    return () => window.removeEventListener("reader-speech-start", pause);
  }, []);
  const matches = book === "Gênesis" && chapter === 1 && translation === "Bíblia Livre" &&
    sample.every((text, index) => verses.some((verse) => verse.number === index + 1 && verse.content.replace(/\s+/gu, " ").trim() === text));
  if (!matches) return null;
  return <div className={styles.chapter}>
    <div className={styles.recording}>
      <small className={styles.note}>Teste de voz Felipe · Gênesis 1:1–3</small>
      <audio ref={audio} controls preload="none" aria-label="Teste de voz Felipe: Gênesis 1, versículos 1 a 3"
        src="/audio/homologacao/genesis-1-1-3-felipe.mp3" onPlay={stopActiveSpeech} />
    </div>
  </div>;
}
