import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";

// Troque essa senha por uma só sua antes de publicar (é só um texto simples
// aqui no código — não é super seguro, mas serve bem pra afastar acesso
// casual, já que ninguém de fora sabe que essa página existe nem a senha).
const MASTER_PASSWORD = "6fCMutIIwSiWmrpF";

const REGISTRY_KEY = "master:registry";

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
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0).getTime();
}
function fromInputDateEnd(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).getTime();
}
function fmtBR(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function safeCode(c) {
  return (c || "").trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
}

export default function PainelMestre() {
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdError, setPwdError] = useState("");

  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(null);
  const [inicio, setInicio] = useState("");
  const [termino, setTermino] = useState("");
  const [msg, setMsg] = useState("");

  const [lista, setLista] = useState([]);
  const [listaLoading, setListaLoading] = useState(false);

  const carregarLista = useCallback(async () => {
    setListaLoading(true);
    const registro = await loadJSON(REGISTRY_KEY, []);
    const items = await Promise.all(
      registro.map(async (code) => {
        const lic = await loadJSON(`${code}:license`, null);
        return { code, license: lic };
      })
    );
    items.sort((a, b) => {
      const ea = a.license ? a.license.expiresAt : 0;
      const eb = b.license ? b.license.expiresAt : 0;
      return eb - ea;
    });
    setLista(items);
    setListaLoading(false);
  }, []);

  useEffect(() => {
    if (authed) carregarLista();
  }, [authed, carregarLista]);

  function handleLogin(e) {
    e.preventDefault();
    if (pwd === MASTER_PASSWORD) {
      setAuthed(true);
      setPwdError("");
    } else {
      setPwdError("Senha incorreta.");
    }
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

  function selecionarDaLista(code) {
    setCodigo(code);
    setTimeout(() => {
      document.getElementById("campoCodigo")?.focus();
    }, 50);
    (async () => {
      setLoading(true);
      const lic = await loadJSON(`${code}:license`, null);
      setCurrent(lic);
      if (lic) {
        setInicio(toInputDate(lic.createdAt));
        setTermino(toInputDate(lic.expiresAt));
      }
      setLoading(false);
    })();
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

    // adiciona ao registro de empresas, se ainda não estiver lá
    const registro = await loadJSON(REGISTRY_KEY, []);
    if (!registro.includes(code)) {
      registro.push(code);
      await saveJSON(REGISTRY_KEY, registro);
    }

    setCurrent(novaLicenca);
    setMsg("Salvo com sucesso.");
    setLoading(false);
    carregarLista();
  }

  const now = Date.now();
  const status = current
    ? now > current.expiresAt
      ? { label: "Vencida", color: "#C0392B" }
      : { label: "Ativa", color: "#3F8F5F" }
    : null;

  if (!authed) {
    return (
      <>
        <Head>
          <link rel="manifest" href="/manifest-mestre.json" />
          <link rel="apple-touch-icon" href="/icons/icon-mestre-192.png" />
          <meta name="theme-color" content="#8A4B1F" />
          <meta name="apple-mobile-web-app-title" content="Painel Mestre" />
        </Head>
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
      </>
    );
  }

  return (
    <>
      <Head>
        <link rel="manifest" href="/manifest-mestre.json" />
        <link rel="apple-touch-icon" href="/icons/icon-mestre-192.png" />
        <meta name="theme-color" content="#8A4B1F" />
        <meta name="apple-mobile-web-app-title" content="Painel Mestre" />
      </Head>
      <div style={styles.wrap}>
      <div style={{ ...styles.card, maxWidth: 720 }}>
        <h1 style={styles.h1}>Painel mestre</h1>
        <p style={styles.sub}>Defina o período de acesso de cada empresa cliente.</p>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: 280 }}>
            <label style={styles.label}>
              Código da empresa
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="campoCodigo"
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

          <div style={{ flex: "1 1 320px", minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <strong style={{ fontSize: 14, color: "#0B3D4C" }}>Todas as empresas</strong>
              <button onClick={carregarLista} disabled={listaLoading} style={styles.btnGhostSmall}>
                {listaLoading ? "..." : "Atualizar"}
              </button>
            </div>

            {lista.length === 0 && !listaLoading && (
              <p style={{ fontSize: 12.5, color: "#7a8b8f" }}>Nenhuma empresa cadastrada ainda.</p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
              {lista.map((item) => {
                const exp = item.license?.expiresAt;
                const vencida = exp && now > exp;
                const st = !item.license
                  ? { label: "Sem licença", color: "#9a8f72" }
                  : vencida
                  ? { label: "Vencida", color: "#C0392B" }
                  : { label: "Ativa", color: "#3F8F5F" };
                return (
                  <button
                    key={item.code}
                    onClick={() => selecionarDaLista(item.code)}
                    style={styles.listItem}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 13 }}>{item.code}</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                    </div>
                    {item.license && (
                      <div style={{ fontSize: 11, color: "#7a8b8f", marginTop: 2 }}>
                        até {fmtBR(item.license.expiresAt)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
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
  btnGhostSmall: {
    background: "transparent", color: "#0B3D4C", border: "1.5px solid #D9CBB0", padding: "4px 10px",
    borderRadius: 8, fontWeight: 600, fontSize: 11.5, cursor: "pointer",
  },
  statusBox: {
    border: "1.5px solid #D9CBB0", borderRadius: 10, padding: "8px 12px", marginBottom: 12, background: "#FFFDF8",
  },
  listItem: {
    textAlign: "left", background: "#FFFDF8", border: "1.5px solid #D9CBB0", borderRadius: 10,
    padding: "8px 12px", cursor: "pointer", width: "100%",
  },
  hint: { fontSize: 11.5, color: "#7a8b8f", marginTop: 18, lineHeight: 1.6, wordBreak: "break-all" },
};
