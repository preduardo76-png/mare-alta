import { useEffect } from "react";

// Adaptador: substitui o window.storage (que só existe dentro de artefatos do
// Claude) por chamadas reais à nossa API, que persiste no Vercel KV.
// Mantém a mesma assinatura: get(key, shared), set(key, value, shared)
function installStoragePolyfill() {
  if (typeof window === "undefined" || window.storage) return;
  window.storage = {
    async get(key) {
      const r = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", key }),
      });
      if (!r.ok) throw new Error("storage get failed");
      const data = await r.json();
      if (data.value === null || data.value === undefined) return null;
      return { key, value: data.value, shared: true };
    },
    async set(key, value) {
      const r = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", key, value }),
      });
      if (!r.ok) throw new Error("storage set failed");
      return { key, value, shared: true };
    },
  };
}

installStoragePolyfill();

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return <Component {...pageProps} />;
}
