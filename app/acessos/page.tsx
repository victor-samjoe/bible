import { redirect } from "next/navigation";

/** A antiga página duplicava o Perfil; mantém links antigos sem expor outra área. */
export default function AccessControlPage() {
  redirect("/perfil");
}
