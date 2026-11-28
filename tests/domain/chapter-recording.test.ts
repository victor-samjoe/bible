import { describe, expect, it } from "vitest";
import { isPrivateRecordingSource, recordingText } from "../../src/domain/speech/recording";

describe("gravações privadas de capítulos", () => {
  it("gera texto determinístico com todos os versículos na ordem", () => {
    expect(recordingText([{ number: 2, content: " E havia  luz. " }, { number: 1, content: "No princípio." }])).toBe("No princípio. E havia luz.");
  });
  it("recusa capítulo incompleto, numeração repetida ou USFM sem limpar", () => {
    expect(recordingText([{ number: 2, content: "luz" }])).toBeNull();
    expect(recordingText([{ number: 1, content: "um" }, { number: 1, content: "outro" }])).toBeNull();
    expect(recordingText([{ number: 1, content: "um \\f nota" }])).toBeNull();
  });
  it("não aceita URLs públicas ou referências que escapem da rota privada", () => {
    expect(isPrivateRecordingSource("/api/private-audio/genesis/1.mp3")).toBe(true);
    for (const path of ["https://example.org/1.mp3", "/audio/1.mp3", "/api/private-audio/../1.mp3", "/api/private-audio/1.mp3?public=1"]) expect(isPrivateRecordingSource(path)).toBe(false);
  });
});
