# BKR Workbench — plano de implementação

**Estado em 18/11/2026:** planejamento e fundações de dados existem; oficina utilizável ainda não.

## O que já existe

- matriz de 66 tarefas, todas `NOT_STARTED`, em `BKR_BOOK_CONTEXT_BACKLOG.md`;
- template JSON de dossiê por livro;
- contratos BKF para direitos, evidência, documento, revisão, versão e job;
- tabelas `bkf_*` e controles de imutabilidade/versionamento.

## O que não existe ainda

- área interna autenticada para editar/criar documentos;
- criação dos 66 dossiês a partir da matriz;
- fila, agendamento, loop ou conector de pesquisa na internet;
- ingestão/recuperação de fontes e produção de evidências (BKF-P0-003 e P0-004);
- promoção de material autoral revisado ao catálogo do aplicativo.

## Fluxo alvo

```text
66 tarefas internas → pesquisa com escopo e fontes permitidas → dossiê BKR
→ rascunho de material autoral → edição e revisão humana → aprovação
→ versão publicada do material da plataforma → ferramentas do aplicativo
```

O BKR termina antes da seta final: os usuários e as ferramentas nunca consultam tarefas, dossiês, fontes privadas, prompts ou rascunhos BKR.

## MVP do workbench

1. **Fila de livros:** cartões para os 66 livros; estado, responsável, prazo, versão e bloqueio.
2. **Editor de documento:** Markdown/rich text, salvamento de rascunho, histórico de revisões e comparação de versões.
3. **Fontes e evidências:** ficha de URL/livro, edição, página/localização, tipo de uso, direitos, notas editoriais e ligação às afirmações do rascunho.
4. **Pesquisa controlada:** uma tarefa tem pergunta, escopo, lista de fontes permitidas, orçamento e registro do que foi realmente consultado. Falta de fonte ou direito mantém a tarefa bloqueada.
5. **Revisão:** redator → revisão de evidência → sua aprovação. Nenhuma automação avança para publicação.
6. **Saída:** exportar somente o texto autoral aprovado, com referências permitidas, para o domínio de materiais/estudos da plataforma.

## Loop das 66 tarefas

O loop automatiza preparação, não publicação:

```text
para cada livro sem dossiê aprovado:
  criar tarefa e documento a partir do template
  montar plano de pesquisa por categorias de fonte
  executar somente conectores e fontes autorizados
  registrar cobertura, lacunas e evidências
  gerar rascunho marcado como DRAFT
  parar para revisão humana
```

Categorias iniciais: introduções bíblicas, manuais/dicionários bíblicos, teologia bíblica, teologia sistemática quando pertinente, história/arqueologia/geografia e fontes primárias. A categoria não concede direito de processamento: cada edição, URL ou documento passa por seu próprio gate.

## Ordem de entrega

1. `BKR-CONTEXT-001`: schema, template, validação e criação determinística dos 66 rascunhos vazios.
2. Workbench interno de tarefas e editor, atrás de autenticação e papel editorial.
3. Registro de fontes/evidências e versões do documento.
4. Runner de pesquisa web, com allowlist, log, orçamento e bloqueio por direitos.
5. Geração assistida de rascunho, sempre em estado `DRAFT`.
6. Revisão, sua aprovação e exportação do material autoral para a plataforma.

## Dependência decisiva

O projeto ainda não tem Auth administrativo real configurado. Sem isso, é possível prototipar localmente, mas não é seguro disponibilizar um editor interno multiusuário ou promover conteúdos. A área interna deve começar após configurar autenticação e papéis de editor/revisor/aprovador.

## Fila atual para Claude CLI

As tarefas abaixo são sequenciais. Cada uma deve produzir testes e relatório
local; nenhuma está autorizada a aplicar migration remota, usar credenciais,
publicar conteúdo ou fazer deploy.

| Ordem | ID | Entrega | Limite de segurança | Estado |
| --- | --- | --- | --- | --- |
| 1 | `BKR-CONTEXT-001` | Schema Zod/TypeScript, CLI local `init/validate/preview` e testes para o template de dossiê | Sem fatos teológicos preenchidos, sem rede e sem Supabase | READY |
| 2 | `BKR-CONTEXT-002` | Gerador determinístico de 66 rascunhos vazios a partir da matriz canônica | Não preencher contexto, autoria, data ou fontes por IA | BLOCKED_BY_001 |
| 3 | `BKR-CONTEXT-003` | Interface interna somente de leitura para listar rascunhos, estados e bloqueios locais | Não expor em rotas públicas, não simular login ou aprovação | BLOCKED_BY_AUTH_DESIGN |
| 4 | `ORIGINAL-IMPORT-001` | Importador idempotente e testes em banco descartável para SBLGNT/MorphHB já verificados | Sem escrita remota; sem mudar estado editorial para `approved` | READY |
| 5 | `AUTH-READINESS-001` | Testes e configuração tipada para OTP/magic link, callback e isolamento por RLS | Sem chaves, sem envio de e-mail, sem criar conta real | READY |
| 6 | `BKR-WORKBENCH-001` | Design de papéis editor/revisor/aprovador e critérios de promoção de rascunho | Exige Auth real antes de qualquer interface de edição compartilhada | BLOCKED_BY_AUTH |

### Próxima delegação recomendada

Iniciar `BKR-CONTEXT-001`. O resultado esperado é código local testado e um
comando previsível, não uma tela pública nem conteúdo produzido. Em paralelo,
`ORIGINAL-IMPORT-001` pode ser planejada/revisada, mas sua importação em
produção permanece dependente da aprovação editorial formal registrada no
plano de contas e idiomas originais.
