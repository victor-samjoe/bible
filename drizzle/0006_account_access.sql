-- Frente A — criação de contas e controle de acesso.
--
-- Aditiva e idempotente: não altera, recria nem renomeia nada de 0000–0005.
-- NÃO aplicar em Supabase remoto sem autorização operacional explícita, e só
-- depois de conferir o baseline remoto (0003 ainda pode não estar aplicada).
--
-- Esta migration fecha quatro lacunas que a aplicação sozinha não pode fechar,
-- porque quem fala com o Postgres pelo PostgREST/Supabase não passa pelo nosso
-- servidor:
--
--  1. `profiles` nasceu em 0000 sem RLS. Como é a tabela que define papel, sem
--     RLS qualquer chave publicável poderia ler a lista de usuários e — pior —
--     escrever `role`. Aqui ela ganha RLS com uma única política: a pessoa lê a
--     própria linha. Não existe política de INSERT, UPDATE ou DELETE para o
--     cliente; papel é concedido por operação administrativa.
--  2. O perfil precisa existir no primeiro acesso. O gatilho em `auth.users`
--     resolve isso dentro da transação do próprio cadastro, com `role` sempre
--     `reader` — nunca lido de `raw_user_meta_data`, que é editável pelo cliente.
--  3. O pedido de exclusão de conta precisava de registro auditável. A tabela
--     `account_deletion_requests` guarda o pedido; a execução da remoção é ato
--     do operador, conforme a política de retenção aprovada.
--  4. Defesa contra elevação de papel: um gatilho recusa mudança de `role` feita
--     por papel de aplicação (`anon`, `authenticated`), mesmo que alguém crie
--     uma política permissiva por engano no futuro.
--
-- Dependência registrada: este arquivo usa o schema `auth` do Supabase
-- (`auth.uid()`, `auth.users`), como 0003 já fazia. Em Postgres puro a
-- validação exige stub de `auth.uid()` e de `auth.users`.

BEGIN;

-- 1. RLS em profiles -----------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_read_own'
  ) THEN
    CREATE POLICY profiles_read_own ON profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

-- 2. Papel é servidor-side: cliente não muda `role` ---------------------------

CREATE OR REPLACE FUNCTION protect_profile_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'profile role is server controlled';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_protect_role ON profiles;
CREATE TRIGGER profiles_protect_role BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_role();

-- 3. Perfil no primeiro acesso -------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- `role` fixo em 'reader'. Nenhum campo vem de metadado do cliente.
  INSERT INTO profiles (id, role) VALUES (NEW.id, 'reader') ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
    DROP TRIGGER IF EXISTS auth_user_creates_profile ON auth.users;
    CREATE TRIGGER auth_user_creates_profile AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
  END IF;
END $$;

-- 4. Pedido de exclusão de conta ----------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_deletion_request_state') THEN
    CREATE TYPE account_deletion_request_state AS ENUM ('requested', 'in_progress', 'completed', 'canceled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  state account_deletion_request_state NOT NULL DEFAULT 'requested',
  -- Sem campo livre de texto: o pedido não coleta dado pessoal adicional.
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (state IN ('requested', 'in_progress') AND resolved_at IS NULL AND resolved_by IS NULL) OR
    (state IN ('completed', 'canceled') AND resolved_at IS NOT NULL)
  )
);

-- Um pedido aberto por pessoa; histórico de pedidos resolvidos é preservado.
CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_open_idx
  ON account_deletion_requests(user_id) WHERE state IN ('requested', 'in_progress');

CREATE INDEX IF NOT EXISTS account_deletion_requests_queue_idx
  ON account_deletion_requests(state, requested_at);

ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_deletion_requests' AND policyname = 'account_deletion_requests_read_own'
  ) THEN
    CREATE POLICY account_deletion_requests_read_own ON account_deletion_requests
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_deletion_requests' AND policyname = 'account_deletion_requests_insert_own'
  ) THEN
    -- A pessoa pede a exclusão da própria conta e sempre no estado inicial;
    -- avançar o estado é ato do operador, fora de qualquer política de cliente.
    CREATE POLICY account_deletion_requests_insert_own ON account_deletion_requests
      FOR INSERT WITH CHECK (auth.uid() = user_id AND state = 'requested');
  END IF;
END $$;

-- Reusa o gatilho de 0003 quando ele existe; cria o seu quando 0003 não rodou.
CREATE OR REPLACE FUNCTION touch_account_deletion_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS account_deletion_requests_touch ON account_deletion_requests;
CREATE TRIGGER account_deletion_requests_touch BEFORE UPDATE ON account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION touch_account_deletion_updated_at();

COMMIT;
