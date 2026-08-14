import React, { useState } from "react";

// Troque essa senha por uma só sua antes de publicar (é só um texto simples
// aqui no código — não é super seguro, mas serve bem pra afastar acesso
// casual, já que ninguém de fora sabe que essa página existe nem a senha).
const MASTER_PASSWORD = "6fCMutIIwSiWmrpF";

async function loadJSON(key, fallback) {
  try {
    const res = await window.storage.get(key, true);
    if (!res || res.value === null || res.value === undefined) return fallback;
    if (typeof res.value === "string") return JSON.parse(res.value);
    return res.value;
  } catch (e) {
    return fallback;
  }
}
async function saveJSON(key, value) {
  await window.storage.set(key, JSON.stringify(value), true);
}

function toInputDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromInputDateStart(iso) {
  // início do dia escolhido
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0).getTime();
}
function fromInputDateEnd(iso) {
  // fim do dia escolhido (23:59:59), pra dar o dia inteiro de acesso
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).getTime();
}
function fmtBR(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function PainelMestre() {
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdError, setPwdError] = useState("");

  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(null); // licença carregada
  const [inicio, setInicio] = useState("");
  const [termino, setTermino] = useState("");
  const [msg, setMsg] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    if (pwd === MASTER_PASSWORD) {
      setAuthed(true);
      setPwdError("");
    } else {
      setPwdError("Senha incorreta.");
    }
  }

  function safeCode(c) {
    return (c || "").trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
  }

  async function handleCarregar() {
    const code = safeCode(codigo);
    if (!code) return;
    setLoading(true);
    setMsg("");
    const lic = await loadJSON(`${code}:license`, null);
    setCurrent(lic);
    if (lic) {
      setInicio(toInputDate(lic.createdAt));
      setTermino(toInputDate(lic.expiresAt));
    } else {
      setInicio(toInputDate(Date.now()));
      setTermino("");
    }
    setLoading(false);
  }

  async function handleSalvar() {
    const code = safeCode(codigo);
    if (!code || !inicio || !termino) {
      setMsg("Preencha o código da empresa e as duas datas.");
      return;
    }
    setLoading(true);
    const novaLicenca = {
      createdAt: fromInputDateStart(inicio),
      expiresAt: fromInputDateEnd(termino),
    };
    await saveJSON(`${code}:license`, novaLicenca);
    setCurrent(novaLicenca);
    setMsg("Salvo com sucesso.");
    setLoading(false);
  }

  const now = Date.now();
  const status = current
    ? now > current.expiresAt
      ? { label: "Vencida", color: "#C0392B" }
      : { label: "Ativa", color: "#3F8F5F" }
    : null;

  if (!authed) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Painel mestre</h1>
          <p style={styles.sub}>Acesso restrito — gestão de licenças por empresa.</p>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Senha mestre"
              style={styles.input}
              autoFocus
            />
            {pwdError && <div style={{ color: "#C0392B", fontSize: 13 }}>{pwdError}</div>}
            <button type="submit" style={styles.btnPrimary}>Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={{ ...styles.card, maxWidth: 460 }}>
        <h1 style={styles.h1}>Painel mestre</h1>
        <p style={styles.sub}>Defina o período de acesso de cada empresa cliente.</p>

        <label style={styles.label}>
          Código da empresa
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="ex: pousadaxv-2026"
              style={{ ...styles.input, flex: 1 }}
            />
            <button onClick={handleCarregar} disabled={loading} style={styles.btnGhost}>
              Carregar
            </button>
          </div>
        </label>

        {current !== undefined && current !== null && status && (
          <div style={{ ...styles.statusBox, borderColor: status.color }}>
            <strong style={{ color: status.color }}>{status.label}</strong>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>
              Início: {fmtBR(current.createdAt)}<br />
              Término: {fmtBR(current.expiresAt)}
            </div>
          </div>
        )}
        {current === null && codigo && (
          <div style={styles.statusBox}>
            <span style={{ fontSize: 12.5 }}>Nenhuma licença encontrada ainda para esse código — será criada ao salvar.</span>
          </div>
        )}

        <label style={styles.label}>
          Início
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} style={styles.input} />
        </label>
        <label style={styles.label}>
          Término
          <input type="date" value={termino} onChange={(e) => setTermino(e.target.value)} style={styles.input} />
        </label>

        <button onClick={handleSalvar} disabled={loading} style={{ ...styles.btnPrimary, marginTop: 6 }}>
          Salvar validade
        </button>

        {msg && <div style={{ marginTop: 10, fontSize: 13, color: "#0B3D4C" }}>{msg}</div>}

        <p style={styles.hint}>
          Link que você entrega ao cliente: <br />
          <code>mare-alta-theta.vercel.app/empresa/{safeCode(codigo) || "CODIGO"}</code>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(160deg,#0B3D4C,#1C6E8C)", padding: 24, fontFamily: "sans-serif",
  },
  card: {
    background: "#F9F4E9", borderRadius: 16, padding: "28px 26px", width: "100%", maxWidth: 380,
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
  },
  h1: { fontSize: 22, color: "#0B3D4C", margin: "0 0 4px" },
  sub: { fontSize: 13, color: "#7a8b8f", margin: "0 0 18px" },
  label: { display: "flex", flexDirection: "column", gap: 5, fontSize: 13, color: "#37474A", fontWeight: 600, marginBottom: 12 },
  input: {
    padding: "9px 11px", borderRadius: 9, border: "1.5px solid #D9CBB0", background: "#FFFDF8",
    fontSize: 14, color: "#1B2E33", outline: "none",
  },
  btnPrimary: {
    background: "#0B3D4C", color: "#F2E9DC", border: "none", padding: "10px 16px", borderRadius: 10,
    fontWeight: 600, fontSize: 13.5, cursor: "pointer",
  },
  btnGhost: {
    background: "transparent", color: "#0B3D4C", border: "1.5px solid #D9CBB0", padding: "0 14px",
    borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
  statusBox: {
    border: "1.5px solid #D9CBB0", borderRadius: 10, padding: "8px 12px", marginBottom: 12, background: "#FFFDF8",
  },
  hint: { fontSize: 11.5, color: "#7a8b8f", marginTop: 18, lineHeight: 1.6, wordBreak: "break-all" },
};
