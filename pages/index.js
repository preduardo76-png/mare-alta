import dynamic from "next/dynamic";

// carregado sem SSR porque usa window.storage no client
const MareAltaApp = dynamic(() => import("../components/MareAltaApp"), { ssr: false });

export default function Home() {
  return <MareAltaApp />;
}
