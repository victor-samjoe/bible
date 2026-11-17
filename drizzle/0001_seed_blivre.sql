-- Seed de metadados BLIVRE; aplicar após 0000_initial.sql.
-- Management API: POST https://api.supabase.com/v1/projects/<project-ref>/database/query
-- com Authorization: Bearer <access-token> e Content-Type: application/json;
-- o corpo JSON deve conter {"query": "<conteúdo integral UTF-8 deste arquivo>"}.
-- Serialize o conteúdo como string JSON; não exponha o token em arquivos ou logs.
-- A execução é transacional e repetível; os UUIDs abaixo identificam estes registros.
-- Não importa livros nem versículos. Após aplicar, consulte translations pelo UUID
-- 42f1e145-244c-4dd7-ae60-8ab66407f678 para obter o translation_id do conversor.
-- Fonte e decisão editorial: docs/licenses/biblia-livre-blivre.md, 17/11/2026.
-- Log de validação (17/11/2026): revisão estática das colunas, chaves, valores
-- e cláusulas de conflito contra 0000_initial.sql. psql não disponível; execução
-- e validação por PostgreSQL não realizadas. Nenhuma chamada de rede realizada.

BEGIN;

INSERT INTO public.licenses (id, holder, evidence_url, permissions, restrictions, verified_at, notes)
VALUES (
  '0c10bed3-8e7e-4c0f-95db-baa5d650884f',
  'Diego Santos, Mario Sérgio e Marco Teles',
  'https://ebible.org/study/content/texts/porbr2018/about.html',
  'Creative Commons Atribuição 4.0 Brasil (CC BY 4.0 BR).',
  'Preservar a atribuição; indicar alterações e não sugerir endosso. Não importar imagens sem avaliação separada nem misturar outra tradução sob o rótulo BLIVRE.',
  '2026-11-17 00:00:00+00',
  'Fonte porbr2018 / PORBLJ; verificação registrada em docs/licenses/biblia-livre-blivre.md. Importar apenas o pacote oficial, preservando checksum, data de importação e versão da fonte; obra em andamento.'
)
ON CONFLICT (id) DO UPDATE SET
  holder = EXCLUDED.holder, evidence_url = EXCLUDED.evidence_url,
  permissions = EXCLUDED.permissions, restrictions = EXCLUDED.restrictions,
  verified_at = EXCLUDED.verified_at, notes = EXCLUDED.notes
WHERE (licenses.holder, licenses.evidence_url, licenses.permissions, licenses.restrictions, licenses.verified_at, licenses.notes)
  IS DISTINCT FROM (EXCLUDED.holder, EXCLUDED.evidence_url, EXCLUDED.permissions, EXCLUDED.restrictions, EXCLUDED.verified_at, EXCLUDED.notes);

INSERT INTO public.translations (id, name, language, canon, license_id, status, attribution)
VALUES (
  '42f1e145-244c-4dd7-ae60-8ab66407f678',
  'Bíblia Livre (BLIVRE)', 'pt-BR', '66 livros',
  '0c10bed3-8e7e-4c0f-95db-baa5d650884f', 'approved',
  'Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio e Marco Teles, fevereiro de 2018. Licença Creative Commons Atribuição 4.0 Brasil.'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, language = EXCLUDED.language, canon = EXCLUDED.canon,
  license_id = EXCLUDED.license_id, status = EXCLUDED.status, attribution = EXCLUDED.attribution
WHERE (translations.name, translations.language, translations.canon, translations.license_id, translations.status, translations.attribution)
  IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.language, EXCLUDED.canon, EXCLUDED.license_id, EXCLUDED.status, EXCLUDED.attribution);

COMMIT;
