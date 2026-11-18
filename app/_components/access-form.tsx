"use client";

import { useActionState } from "react";
import styles from "./access-form.module.css";

/**
 * Formulário de acesso por código de uso único, em dois passos: pedir o código
 * e digitar o código. Mesmo componente para `/entrar` e `/criar-conta`, porque
 * o fluxo é idêntico — o que muda é o modo, que o servidor vincula à ação.
 *
 * O componente não decide nada: não sabe se o e-mail existe, não guarda sessão,
 * não lê cookie e não chama o provedor. Ele mostra o estado que a Server Action
 * devolveu. O código digitado só existe no POST; nunca volta no estado.
 */

export interface AccessFormState {
  readonly step: "request" | "verify";
  /** Necessário no passo 2 para casar o código com o e-mail que o pediu. */
  readonly email: string;
  readonly maskedEmail: string;
  readonly notice: string | null;
  readonly error: string | null;
}

export type AccessFormAction = (state: AccessFormState, formData: FormData) => Promise<AccessFormState>;

/** Estado de partida: passo 1, sem e-mail, sem recado. */
const INITIAL_STATE: AccessFormState = {
  step: "request",
  email: "",
  maskedEmail: "",
  notice: null,
  error: null,
};

export interface AccessFormProps {
  readonly action: AccessFormAction;
  readonly requestLabel: string;
  readonly requestHint: string;
}

export function AccessForm({ action, requestLabel, requestHint }: AccessFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const verifying = state.step === "verify";

  return (
    <form className={styles.form} action={formAction} noValidate>
      {/* Uma única região viva: leitor de tela anuncia sucesso e erro no mesmo lugar. */}
      <div className={styles.feedback} role="status" aria-live="polite">
        {state.error ? (
          <p className={styles.error} id="acesso-erro">
            {state.error}
          </p>
        ) : null}
        {state.notice ? <p className={styles.notice}>{state.notice}</p> : null}
      </div>

      {verifying ? (
        <>
          <input type="hidden" name="email" value={state.email} />
          <p className={styles.sentTo}>
            Código enviado para <strong>{state.maskedEmail}</strong>.
          </p>
          <label className={styles.label} htmlFor="code">
            Código de 6 dígitos
          </label>
          <input
            className={styles.input}
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            required
            autoFocus
            aria-describedby={state.error ? "acesso-erro" : undefined}
            aria-invalid={state.error ? true : undefined}
          />
          <div className={styles.actions}>
            <button className={styles.primary} type="submit" name="intent" value="verify" disabled={pending}>
              {pending ? "Verificando…" : "Entrar"}
            </button>
            <button className={styles.secondary} type="submit" name="intent" value="restart" disabled={pending}>
              Usar outro e-mail
            </button>
          </div>
          <p className={styles.hint}>
            O código vale por 1 hora e serve uma única vez. Nenhuma senha é criada ou guardada.
          </p>
        </>
      ) : (
        <>
          <input type="hidden" name="intent" value="request" />
          <label className={styles.label} htmlFor="email">
            E-mail
          </label>
          <input
            className={styles.input}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            defaultValue={state.email}
            required
            aria-describedby={state.error ? "acesso-erro" : "acesso-dica"}
            aria-invalid={state.error ? true : undefined}
          />
          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={pending}>
              {pending ? "Enviando…" : requestLabel}
            </button>
          </div>
          <p className={styles.hint} id="acesso-dica">
            {requestHint}
          </p>
        </>
      )}
    </form>
  );
}
