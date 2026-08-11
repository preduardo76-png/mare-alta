import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function fullKey(key) {
  return `mare-alta:${key}`;
}

export default async function handler(req, res) {
  console.log("[storage] chamada recebida", {
    method: req.method,
    hasUrl: !!process.env.KV_REST_API_URL,
    hasToken: !!process.env.KV_REST_API_TOKEN,
  });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }
  const { action, key, value } = req.body || {};
  console.log("[storage] action=" + action + " key=" + key + " valueLen=" + (value ? String(value).length : 0));

  if (!action || !key) {
    return res.status(400).json({ error: "Parâmetros ausentes" });
  }

  try {
    if (action === "get") {
      const v = await redis.get(fullKey(key));
      console.log("[storage] GET resultado para " + fullKey(key) + ": " + (v ? "encontrado, tamanho " + String(v).length : "vazio/null"));
      return res.status(200).json({ value: v ?? null });
    }
    if (action === "set") {
      const setResult = await redis.set(fullKey(key), value);
      console.log("[storage] SET resultado para " + fullKey(key) + ": " + JSON.stringify(setResult));
      const readBack = await redis.get(fullKey(key));
      console.log("[storage] confirmação de leitura pós-gravação: " + (readBack ? "OK, presente" : "AUSENTE! não gravou de verdade"));
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Ação inválida" });
  } catch (e) {
    console.error("[storage] ERRO: " + (e && e.message) + " | " + JSON.stringify(e));
    return res.status(500).json({ error: "Falha no armazenamento: " + (e && e.message) });
  }
}
