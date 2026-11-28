"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chapterUtterances, chunkText, pickVoice, type SpeechTarget, type Utterance } from "@/src/domain/speech/plan";
import styles from "./speech.module.css";
import { isPrivateRecordingSource, recordingText, type ChapterRecording } from "@/src/domain/speech/recording";

// Leitura em voz alta com a voz do navegador. Não há áudio gravado: hebraico e
// grego usam voz moderna e são avisados como aproximação. Sem voz do idioma, o
// controle não aparece.

function useVoices(): readonly SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<readonly SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  return voices;
}

type State = "parado" | "falando" | "pausado";

// speechSynthesis é compartilhado pela página inteira; apenas o controle que
// iniciou a fala pode cancelá-la ao desmontar ou terminar.
let activeStop: (() => void) | null = null;

/** Pausa a leitura atual quando outra fonte de áudio começa no leitor. */
export function stopActiveSpeech() { activeStop?.(); }

/** Fila de falas: uma de cada vez, com parar/pausar, e cancela ao sair da tela. */
function useSpeaker(voice: SpeechSynthesisVoice | null) {
  const [state, setState] = useState<State>("parado");
  const [verse, setVerse] = useState<number | null>(null);
  const run = useRef(0);
  const stop: () => void = useCallback(() => {
    run.current += 1;
    if (activeStop === stop) {
      activeStop = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    }
    setState("parado");
    setVerse(null);
  }, []);
  useEffect(() => {
    window.addEventListener("pagehide", stop);
    return () => { window.removeEventListener("pagehide", stop); stop(); };
  }, [stop]);
  const play = useCallback((queue: readonly Utterance[]) => {
    if (!voice || !queue.length) return;
    window.dispatchEvent(new Event("reader-speech-start"));
    if (activeStop) activeStop();
    activeStop = stop;
    const id = ++run.current;
    const next = (index: number) => {
      if (id !== run.current) return;
      const item = queue[index];
      if (!item) { if (activeStop === stop) activeStop = null; setState("parado"); setVerse(null); return; }
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.onstart = () => { if (id === run.current) setVerse(item.verse); };
      utterance.onend = () => next(index + 1);
      utterance.onerror = () => { if (id === run.current) stop(); };
      window.speechSynthesis.speak(utterance);
    };
    setState("falando");
    try { next(0); } catch { stop(); }
  }, [voice, stop]);
  const togglePause = useCallback(() => {
    if (state === "falando") { window.speechSynthesis.pause(); setState("pausado"); }
    else if (state === "pausado") { window.speechSynthesis.resume(); setState("falando"); }
  }, [state]);
  return { state, verse, play, stop, togglePause };
}

/** Ouvir um trecho (versículo hebraico ou grego, por exemplo). */
export function SpeakText({ text, target, label }: { readonly text: string; readonly target: Exclude<SpeechTarget, "pt">; readonly label: string }) {
  const voices = useVoices();
  const pick = pickVoice(voices, target);
  const speaker = useSpeaker(pick?.voice ?? null);
  if (!pick) return null;
  const queue = chunkText(text).map((part) => ({ verse: 0, text: part }));
  if (!queue.length) return null;
  const active = speaker.state !== "parado";
  return <span className={styles.control}>
    <button type="button" className={styles.button} aria-pressed={active}
      onClick={() => (active ? speaker.stop() : speaker.play(queue))}>
      {active ? "■ Parar" : `▶ ${label}`}
    </button>
    <small className={styles.note}>voz moderna, pronúncia aproximada</small>
  </span>;
}

/** Ouvir o capítulo inteiro em português. */
export function ReadChapterAloud({ verses, recording }: { readonly verses: readonly { readonly number: number; readonly content: string }[]; readonly recording?: ChapterRecording }) {
  const voices = useVoices();
  const pick = pickVoice(voices, "pt");
  const speaker = useSpeaker(pick?.voice ?? null);
  const audio = useRef<HTMLAudioElement>(null);
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const text = recordingText(verses);
  const source = recording?.source;
  const expectedHash = recording?.textSha256;
  const currentKey = source && expectedHash && text && recording?.verseCount === verses.length
    ? `${source}\u0000${expectedHash}\u0000${text}` : null;
  const ready = currentKey !== null && currentKey === verifiedKey;
  useEffect(() => {
    let current = true;
    if (!currentKey || !source || !expectedHash || !text || !globalThis.crypto?.subtle || !isPrivateRecordingSource(source) || !/^[a-f0-9]{64}$/u.test(expectedHash)) return;
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((value) => {
      const digest = [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      if (current) setVerifiedKey(digest === expectedHash ? currentKey : null);
    }).catch(() => { if (current) setVerifiedKey(null); });
    return () => { current = false; };
  }, [source, expectedHash, text, currentKey]);
  if (!pick && !ready) return null;
  const queue = chapterUtterances(verses);
  if (!queue.length && !ready) return null;
  const active = speaker.state !== "parado";
  return <div className={styles.chapter}>
    <span className={styles.control} role="group" aria-label="Leitura em voz alta do capítulo">
      {ready && recording ? <span className={styles.recording}>
        <small className={styles.note}>{recording.label}</small>
        <audio ref={audio} controls preload="none" src={recording.source} aria-label={recording.label}
          onPlay={() => { if (active) speaker.stop(); }} onError={() => setAudioError(true)} />
        {audioError ? <small role="status">Áudio indisponível. Use a leitura do aparelho.</small> : null}
      </span> : null}
      {pick && queue.length ? <button type="button" className={styles.button} onClick={() => { audio.current?.pause(); if (active) speaker.stop(); else speaker.play(queue); }}>
        {active ? "■ Parar leitura" : "▶ Ouvir o capítulo"}
      </button> : null}
      {active ? <button type="button" className={styles.button} onClick={speaker.togglePause}>
        {speaker.state === "pausado" ? "Continuar" : "Pausar"}
      </button> : null}
      {active && speaker.verse ? <span className={styles.note} role="status">Versículo {speaker.verse}</span> : null}
    </span>
  </div>;
}
