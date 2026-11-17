import Link from "next/link";

export default function HomePage() {
  return <main>
    <nav className="nav"><Link className="brand" href="/">samjoe<span>•</span>estudos</Link><div><Link href="/estudos">Estudos</Link><Link href="/planos">Planos</Link><Link className="button small" href="/entrar">Entrar</Link></div></nav>
    <section className="hero"><p className="eyebrow">LEITURA • CONTEXTO • PESQUISA</p><h1>Leia com calma.<br/><em>Aprofunde com fontes.</em></h1><p className="lede">Uma biblioteca viva para quem quer ir além de respostas prontas — sem transformar a leitura bíblica em uma ferramenta complicada.</p><div className="actions"><Link className="button" href="/estudos/romanos-9-contexto">Ler um estudo gratuito</Link><Link className="text-link" href="/temas/eleicao">Explorar por tema →</Link></div></section>
    <section className="principles"><article><b>01</b><h2>Comece pelo texto</h2><p>Leitura fluida e caminhos opcionais para contexto, história e interpretação.</p></article><article><b>02</b><h2>Veja as fontes</h2><p>O que é citação, paráfrase ou síntese editorial fica sempre identificado.</p></article><article><b>03</b><h2>Compare com honestidade</h2><p>Tradições diferentes aparecem com seus argumentos e limites, não caricaturas.</p></article></section>
    <section className="feature"><div><p className="eyebrow">ESTUDO EM DESTAQUE</p><h2>Romanos 9:<br/>misericórdia, promessa e eleição</h2><p>Um percurso introdutório pelo argumento de Paulo — antes de entrar nas leituras doutrinárias que a passagem recebeu.</p><Link className="text-link" href="/estudos/romanos-9-contexto">Abrir contexto gratuito →</Link></div><aside><span>Rm</span><strong>9</strong><p>“O estudo começa pela delimitação do texto e pela pergunta que ele próprio procura responder.”</p></aside></section>
    <section className="closing"><p className="eyebrow">SEM PRESSA, SEM PRESSÃO</p><h2>Há valor real antes da assinatura.</h2><p>Você decide quando quer abrir uma pesquisa mais aprofundada. A leitura continua sendo sua.</p><Link className="button" href="/planos">Conhecer os planos</Link></section>
    <footer><span>© 2026 SamJoE Tech &amp; Consulting</span><div><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos</Link><Link href="/direitos-autorais">Direitos autorais</Link><Link href="/contato">Contato</Link></div></footer>
  </main>;
}
