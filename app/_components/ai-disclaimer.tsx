const TEXTS = {
  single:
    "Esta análise foi gerada com apoio de inteligência artificial (IA) e submetida a curadoria editorial dedicada. Mesmo assim, pode conter erros: confira as fontes citadas antes de usar ou compartilhar o conteúdo.",
  collection:
    "Os estudos e análises publicados aqui são gerados com apoio de inteligência artificial (IA) e submetidos a curadoria editorial dedicada. Mesmo assim, podem conter erros: confira as fontes citadas antes de usar ou compartilhar o conteúdo.",
} as const;

export type AiDisclaimerVariant = keyof typeof TEXTS;

export const AI_DISCLAIMER_TEXTS = TEXTS;

/**
 * Aviso obrigatório de transparência sobre IA e curadoria editorial.
 * Deve aparecer próximo a qualquer estudo ou análise exibido no app.
 */
export function AiDisclaimer({
  variant = "single",
  className,
}: {
  variant?: AiDisclaimerVariant;
  className?: string;
}) {
  return (
    <aside
      className={className ? `notice ai-notice ${className}` : "notice ai-notice"}
      aria-label="Aviso sobre uso de inteligência artificial e curadoria editorial"
    >
      <strong>IA com curadoria editorial:</strong> {TEXTS[variant]}
    </aside>
  );
}
