# Índice de ocorrências — 28/11/2026

Dois processamentos independentes, com heap Node limitado a 128 MB e as fontes
MACULA congeladas, produziram **61 arquivos idênticos** (manifesto e 60 partes).
O validador `scripts/validate-word-study-index.ts` conferiu os hashes, limites,
ordem, identidades, vetores, referências e totais de todas as partes: 14.812
chaves, 607.217 ocorrências. O manifesto tem versão `cf56d8fd29bb1ed5`.
A simulação anterior do corpus reproduziu o hash da concatenação dos bytes.
A validação é estrutural: não prova exaustividade linguística nem a correção
de todas as correspondências lexicais ou versificações.

O índice contém apenas chaves, referências e posições; não inclui texto bíblico
ou glosas. As fontes e a licença CC BY 4.0 estão no manifesto e na interface.
A soma das partes é 3.862.496 bytes sem compressão, 1.210.755 bytes em gzip
nível 9 na máquina; a maior parte tem 39.774 bytes gzip. O tráfego real e o
tamanho do manifesto dependem da CDN. Não foi medido o consumo atual da cota.

Na página da palavra, o botão opcional busca o manifesto e somente a partição
da chave, verifica SHA-256 no aparelho e a reutiliza na paginação. O fluxo não
abre consulta extra ao Supabase. Mostra referências da fonte, não supõe que
todas as versificações coincidam, e anuncia que formas com Strong diferente
podem faltar. A lista anterior, com trechos já identificados, continua presente.

Há pré-revisão não aprovada de Gênesis 2:1 em `GENESIS2-1-PRE-REVISAO.md`;
os outros 24 versículos continuam pendentes. Nenhuma correspondência nova foi
publicada como revisada. É necessária conferência independente antes de usá-la
para destacar traduções no leitor.

O comando `scripts/build-word-study-stream.ts` só aceita fontes cujos hashes
conferem com o registro e exige diretório novo; o manifesto é escrito por último.
Não aplica migrations, não acessa banco remoto e não altera fontes originais.
