import { describe, expect, it } from "vitest";
import {
  ACCESS_CODE_SENT_NOTICE,
  confirmFailureMessage,
  maskEmail,
  requestFailureMessage,
  roleLabel,
  type ConfirmFailureReason,
  type RequestFailureReason,
} from "../../src/domain/account-access";

const REQUEST_REASONS: readonly RequestFailureReason[] = [
  "unavailable",
  "invalid_email",
  "rate_limited",
  "provider_error",
];
const CONFIRM_REASONS: readonly ConfirmFailureReason[] = [
  "unavailable",
  "invalid_input",
  "invalid_token",
  "rate_limited",
  "provider_error",
];

describe("vocabulário visível do acesso", () => {
  it("não revela existência de conta nem repassa texto do provedor", () => {
    const todas = [
      ACCESS_CODE_SENT_NOTICE,
      ...REQUEST_REASONS.map(requestFailureMessage),
      ...CONFIRM_REASONS.map(confirmFailureMessage),
    ];
    for (const frase of todas) {
      expect(frase.trim().length).toBeGreaterThan(0);
      // Nenhuma mensagem afirma ou nega que o endereço tem conta.
      expect(frase).not.toMatch(/não (existe|há) (conta|cadastro|usuário)|conta não encontrada|já (existe|tem) conta/i);
      expect(frase).not.toMatch(/token|jwt|supabase|gotrue|sql|undefined|null/i);
    }
    // Código errado e código expirado levam à mesma frase e ao mesmo caminho.
    expect(confirmFailureMessage("invalid_token")).toMatch(/inválido ou expirado/i);
  });

  it("mascara o e-mail preservando só a inicial e o domínio", () => {
    expect(maskEmail("pessoa@example.com")).toBe("p•••••@example.com");
    expect(maskEmail("a@b.co")).toBe("a•@b.co");
    expect(maskEmail("  PESSOA@Example.com  ")).toBe("P•••••@Example.com");
    for (const invalido of ["", "sem-arroba", "@example.com", "pessoa@", "   "]) {
      expect(maskEmail(invalido)).toBe("•••");
    }
  });

  it("não transforma papel desconhecido em leitor", () => {
    expect(roleLabel("reader")).toBe("Leitor");
    expect(roleLabel("editor")).toBe("Editor");
    expect(roleLabel("admin")).toBe("Administrador");
    expect(roleLabel("dono")).toBe("Papel não reconhecido");
  });
});
