import dynamic from "next/dynamic";
import { useRouter } from "next/router";

const MareAltaApp = dynamic(() => import("../../components/MareAltaApp"), { ssr: false });

export default function EmpresaPage() {
  const router = useRouter();
  const { codigo } = router.query;

  // aguarda o Next.js terminar de ler o código da URL antes de renderizar
  if (!router.isReady) return null;

  return <MareAltaApp tenantCode={codigo} />;
}
