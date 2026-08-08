import { kv } from "@vercel/kv";

// Todas as chaves deste app são compartilhadas entre usuários (users, properties,
// reservations), então usamos sempre um prefixo fixo simples.
function fullKey(key) {
  return `mare-alta:${key}`;
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
      const v = await kv.get(fullKey(key));
      return res.status(200).json({ value: v ?? null });
    }
    if (action === "set") {
      await kv.set(fullKey(key), value);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Ação inválida" });
  } catch (e) {
    console.error("storage api error", e);
    return res.status(500).json({ error: "Falha no armazenamento. Verifique se o Vercel KV está configurado (variáveis KV_* nas Environment Variables)." });
  }
}
