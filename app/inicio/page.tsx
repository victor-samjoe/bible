import { PersonalDashboard } from "./dashboard";

// Início do aplicativo (tarefa C15). A raiz `/` continua redirecionando para o
// leitor, como a regressão do C8 exige: este painel é uma área própria, alcançada
// pelo menu de áreas.
//
// Página sem banco, sem Auth e sem pagamento: o painel lê somente o registro
// local da sessão, no cliente.
export const metadata = {
  title: "Início | Bíblia Bereana",
  description:
    "Retomar a leitura, ver o registro local desta sessão e o que está disponível na plataforma.",
};

export default function InicioPage() {
  return <PersonalDashboard />;
}
