import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function fullKey(key) {
  return `mare-alta:${key}`;
}

function safeUserList(jsonStringOrObj) {
  try {
    const obj = typeof jsonStringOrObj === "string" ? JSON.parse(jsonStringOrObj) : jsonStringOrObj;
    return Object.keys(obj || {});
  } catch (e) {
    return ["(não foi possível ler: " + e.message + ")"];
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }
  const { action, key, value } = req.body || {};
  if (!action || !key) {
    return res.status(400).json({ error: "Parâmetros ausentes" });
  }

  try {
    if (action === "get") {
      const v = await redis.get(fullKey(key));
      if (key === "users") {
        console.log("[storage] GET users -> usuários encontrados: " + JSON.stringify(safeUserList(v)));
      } else {
        console.log("[storage] GET " + key + " -> " + (v ? "tem dado" : "vazio"));
      }
      return res.status(200).json({ value: v ?? null });
    }
    if (action === "set") {
      if (key === "users") {
        console.log("[storage] SET users -> vai salvar usuários: " + JSON.stringify(safeUserList(value)));
      }
      await redis.set(fullKey(key), value);
      const readBack = await redis.get(fullKey(key));
      if (key === "users") {
        console.log("[storage] SET users -> confirmado após salvar: " + JSON.stringify(safeUserList(readBack)));
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Ação inválida" });
  } catch (e) {
    console.error("[storage] ERRO: " + (e && e.message));
    return res.status(500).json({ error: "Falha no armazenamento: " + (e && e.message) });
  }
}
