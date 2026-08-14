import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Home,
  CalendarDays,
  User,
  ShieldCheck,
  LogOut,
  Plus,
  Check,
  X,
  Clock,
  MapPin,
  Phone,
  Users as UsersIcon,
  CreditCard,
  Waves,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Building2,
  AlertTriangle,
} from "lucide-react";

// ---------- helpers ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const obf = (s) => btoa(unescape(encodeURIComponent(s || "")));
const MS_12H = 12 * 60 * 60 * 1000;

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEK_NAMES = ["D", "S", "T", "Q", "Q", "S", "S"];

function getSeasonMonths() {
  const today = new Date();
  let y = today.getFullYear();
  let m = today.getMonth();
  const months = [];
  for (let i = 0; i < 12; i++) {
    months.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return months;
}

function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function fmtBR(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtDiaSemana(d) {
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm} (${dias[d.getDay()]})`;
}
function nightsBetween(aISO, bISO) {
  const a = parseISO(aISO), b = parseISO(bISO);
  return Math.round((b - a) / 86400000);
}

async function loadJSON(key, shared, fallback) {
  try {
    const res = await window.storage.get(key, shared);
    if (!res || res.value === null || res.value === undefined) return fallback;
    if (typeof res.value === "string") return JSON.parse(res.value);
    return res.value;
  } catch (e) {
    return fallback;
  }
}
async function saveJSON(key, shared, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), shared);
  } catch (e) {
    console.error("Falha ao salvar", key, e);
  }
}

// ---------- app ----------
// tenantCode identifica a empresa (vem do link /empresa/CODIGO). Cada código
// tem seus próprios dados, totalmente separados dos outros.
export default function App({ tenantCode }) {
  const safeTenant = (tenantCode || "default").toLowerCase().replace(/[^a-z0-9-_]/g, "");
  const K = (name) => `${safeTenant}:${name}`;

  const [booting, setBooting] = useState(true);
  const [tick, setTick] = useState(0);
  const [license, setLicense] = useState(null);

  const [users, setUsers] = useState({});
  const [properties, setProperties] = useState([]);
  const [reservations, setReservations] = useState([]);

  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "", role: "cliente" });
  const [authError, setAuthError] = useState("");

  const [tab, setTab] = useState("imoveis");
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [monthIdx, setMonthIdx] = useState(0);
  const [selection, setSelection] = useState({ start: null, end: null });
  const [showBooking, setShowBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    requesterName: "", phone: "", city: "", numPeople: 1,
    paymentStatus: "nenhum", paymentMethod: "",
  });

  const [showAddProperty, setShowAddProperty] = useState(false);
  const [propForm, setPropForm] = useState({ title: "", address: "", city: "", ownerName: "" });

  const seasonMonths = useMemo(() => getSeasonMonths(), []);

  useEffect(() => {
    (async () => {
      const [u, p, r, lic] = await Promise.all([
        loadJSON(K("users"), true, {}),
        loadJSON(K("properties"), true, []),
        loadJSON(K("reservations"), true, []),
        loadJSON(K("license"), true, null),
      ]);
      setUsers(u);
      setProperties(p);
      setReservations(r);
      // Na primeira vez que essa empresa (tenantCode) é acessada, cria a
      // licença com validade de 365 dias a partir de agora. Depois disso,
      // essa data fica fixa até alguém (o fornecedor) renová-la manualmente.
      let finalLicense = lic;
      if (!finalLicense) {
        const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
        finalLicense = { expiresAt, createdAt: Date.now() };
        await saveJSON(K("license"), true, finalLicense);
      }
      setLicense(finalLicense);
      setBooting(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTenant]);

  const [syncing, setSyncing] = useState(false);
  const refetchAll = useCallback(async (silent) => {
    if (!silent) setSyncing(true);
    const [p, r] = await Promise.all([
      loadJSON(K("properties"), true, []),
      loadJSON(K("reservations"), true, []),
    ]);
    setProperties(p);
    setReservations(r);
    if (!silent) setSyncing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTenant]);

  useEffect(() => {
    const t = setInterval(() => { refetchAll(true); setTick((n) => n + 1); }, 15000);
    function onVisible() {
      if (document.visibilityState === "visible") refetchAll(true);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refetchAll]);

  const persistReservations = useCallback(async (next) => {
    setReservations(next);
    await saveJSON(K("reservations"), true, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTenant]);
  const persistProperties = useCallback(async (next) => {
    setProperties(next);
    await saveJSON(K("properties"), true, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTenant]);
  const persistUsers = useCallback(async (next) => {
    setUsers(next);
    await saveJSON(K("users"), true, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTenant]);

  function handleAuthSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setAuthError("");
    const uname = authForm.username.trim().toLowerCase();
    if (!uname || !authForm.password) {
      setAuthError("Preencha usuário e senha.");
      return;
    }
    if (authMode === "register") {
      if (users[uname]) {
        setAuthError("Esse usuário já existe. Faça login.");
        return;
      }
      const next = { ...users, [uname]: { pass: obf(authForm.password), role: authForm.role } };
      persistUsers(next);
      setCurrentUser({ username: uname, role: authForm.role });
    } else {
      const u = users[uname];
      if (!u || u.pass !== obf(authForm.password)) {
        setAuthError("Usuário ou senha incorretos.");
        return;
      }
      setCurrentUser({ username: uname, role: u.role });
    }
    setAuthForm({ username: "", password: "", role: "cliente" });
  }
  function logout() {
    setCurrentUser(null);
    setTab("imoveis");
    setSelection({ start: null, end: null });
  }

  function dayStatus(propertyId, dateObj) {
    const dt = toDateOnly(dateObj).getTime();
    const todayT = toDateOnly(new Date()).getTime();
    const relevant = reservations.filter((r) => r.propertyId === propertyId);
    for (const r of relevant) {
      const inT = parseISO(r.checkIn).getTime();
      const outT = parseISO(r.checkOut).getTime();
      if (dt >= inT && dt < outT) {
        if (r.status === "confirmed") return "red";
        if (r.status === "pre" && Date.now() - r.createdAt < MS_12H) return "yellow";
      }
    }
    if (dt < todayT) return "past";
    return "green";
  }

  function isRangeAvailable(propertyId, startISO, endISO) {
    if (!propertyId || !startISO || !endISO) return false;
    if (endISO <= startISO) return false;
    let cur = parseISO(startISO);
    const end = parseISO(endISO);
    while (cur < end) {
      if (dayStatus(propertyId, cur) !== "green") return false;
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
    return true;
  }

  function handleDayClick(propertyId, dateObj) {
    const status = dayStatus(propertyId, dateObj);
    if (status !== "green") return;
    const iso = fmtISO(dateObj);
    if (!selection.start || (selection.start && selection.end)) {
      setSelection({ start: iso, end: null });
      return;
    }
    if (iso <= selection.start) {
      setSelection({ start: iso, end: null });
      return;
    }
    setSelection({ start: selection.start, end: iso });
  }

  function handleStartDateChange(iso) {
    setSelection({ start: iso || null, end: null });
  }
  function handleEndDateChange(iso) {
    setSelection((sel) => ({ ...sel, end: iso || null }));
  }

  function openBookingModal() {
    setBookingForm({
      requesterName: currentUser.username,
      phone: "",
      city: "",
      numPeople: 1,
      paymentStatus: "nenhum",
      paymentMethod: "",
    });
    setShowBooking(true);
  }

  async function submitBooking(e) {
    if (e && e.preventDefault) e.preventDefault();
    const newRes = {
      id: uid(),
      propertyId: selectedPropertyId,
      requesterName: bookingForm.requesterName.trim(),
      phone: bookingForm.phone.trim(),
      city: bookingForm.city.trim(),
      numPeople: Number(bookingForm.numPeople) || 1,
      checkIn: selection.start,
      checkOut: selection.end,
      status: "pre",
      paymentStatus: bookingForm.paymentStatus,
      paymentMethod: bookingForm.paymentMethod.trim(),
      createdBy: currentUser.username,
      createdAt: Date.now(),
    };
    const next = [...reservations, newRes];
    await persistReservations(next);
    setShowBooking(false);
    setSelection({ start: null, end: null });
    setTab("minhasReservas");
  }

  async function adminConfirm(resId, paymentStatus, paymentMethod) {
    const next = reservations.map((r) =>
      r.id === resId ? { ...r, status: "confirmed", paymentStatus, paymentMethod } : r
    );
    await persistReservations(next);
  }
  async function adminUpdatePayment(resId, field, value) {
    const next = reservations.map((r) => (r.id === resId ? { ...r, [field]: value } : r));
    await persistReservations(next);
  }
  async function deleteReservation(resId) {
    const next = reservations.filter((r) => r.id !== resId);
    await persistReservations(next);
  }

  async function addProperty(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!propForm.title.trim() || !propForm.address.trim() || !propForm.ownerName.trim()) return;
    const next = [...properties, { id: uid(), ...propForm }];
    await persistProperties(next);
    setPropForm({ title: "", address: "", city: "", ownerName: "" });
    setShowAddProperty(false);
  }
  async function deleteProperty(id) {
    await persistProperties(properties.filter((p) => p.id !== id));
    await persistReservations(reservations.filter((r) => r.propertyId !== id));
    if (selectedPropertyId === id) setSelectedPropertyId(null);
  }

  const isAdmin = currentUser?.role === "admin";
  const myReservations = reservations.filter((r) => r.createdBy === currentUser?.username);
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  if (booting) {
    return (
      <div style={styles.bootWrap}>
        <StyleBlock />
        <Waves size={40} color="#F2E9DC" />
        <p style={{ color: "#F2E9DC", fontFamily: "Inter, sans-serif", marginTop: 12 }}>
          Carregando Maré Alta…
        </p>
      </div>
    );
  }

  const licenseExpired = license && Date.now() > license.expiresAt;
  if (licenseExpired) {
    return (
      <div style={styles.bootWrap}>
        <StyleBlock />
        <AlertTriangle size={40} color="#F2E9DC" />
        <p style={{ color: "#F2E9DC", fontFamily: "Inter, sans-serif", marginTop: 12, textAlign: "center", padding: "0 20px", lineHeight: 1.6 }}>
          Licença expirada.<br />
          Entre em contato com o fornecedor do sistema para renovar o acesso.
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={styles.authWrap}>
        <StyleBlock />
        <div className="wave-bg" />
        <div style={styles.authCard}>
          <Logo />
          <div style={styles.authTabs}>
            <button
              className={authMode === "login" ? "authTabActive" : "authTab"}
              onClick={() => { setAuthMode("login"); setAuthError(""); }}
            >
              Entrar
            </button>
            <button
              className={authMode === "register" ? "authTabActive" : "authTab"}
              onClick={() => { setAuthMode("register"); setAuthError(""); }}
            >
              Criar conta
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label className="field">
              <span>Usuário</span>
              <input
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                placeholder="ex: joana.souza"
                autoComplete="username"
              />
            </label>
            <label className="field">
              <span>Senha</span>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") handleAuthSubmit(e); }}
                placeholder="••••••••"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
              />
            </label>
            {authMode === "register" && (
              <label className="field">
                <span>Perfil de acesso</span>
                <select
                  value={authForm.role}
                  onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                >
                  <option value="cliente">Locatário / cliente</option>
                  <option value="admin">Imobiliária (administrador)</option>
                </select>
              </label>
            )}
            {authError && <div className="authError"><AlertTriangle size={14} /> {authError}</div>}
            <button type="button" onClick={handleAuthSubmit} className="btnPrimary" style={{ marginTop: 4 }}>
              {authMode === "login" ? "Entrar" : "Criar conta e entrar"}
            </button>
          </div>
          <p style={styles.authFoot}>
            Cada usuário só enxerga seus próprios dados pessoais e de pagamento.
            Disponibilidade dos imóveis fica visível para todos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appWrap}>
      <StyleBlock />
      <header style={styles.header}>
        <Logo compact />
        <div style={styles.headerRight}>
          <span style={{ fontSize: 10.5, color: "#F2E9DC", opacity: 0.6, fontFamily: "monospace" }}>
            tenant: {safeTenant}
          </span>
          <button className="btnGhost small" onClick={() => refetchAll(false)} title="Buscar atualizações agora" style={{ color: "#F2E9DC", borderColor: "rgba(242,233,220,0.35)" }}>
            {syncing ? "Sincronizando…" : "Atualizar"}
          </button>
          <span style={styles.userChip}>
            <User size={14} /> {currentUser.username}
            {isAdmin && <ShieldCheck size={14} style={{ marginLeft: 4 }} title="Administrador" />}
          </span>
          <button className="btnGhost" onClick={logout}>
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>
      <div className="wave-divider" />

      <nav style={styles.nav}>
        <NavBtn active={tab === "imoveis"} onClick={() => setTab("imoveis")} icon={<Home size={16} />} label="Imóveis" />
        <NavBtn active={tab === "calendario"} onClick={() => setTab("calendario")} icon={<CalendarDays size={16} />} label="Calendário" />
        <NavBtn active={tab === "minhasReservas"} onClick={() => setTab("minhasReservas")} icon={<UsersIcon size={16} />} label="Minhas reservas" />
        {isAdmin && (
          <NavBtn active={tab === "painel"} onClick={() => setTab("painel")} icon={<ShieldCheck size={16} />} label="Painel" />
        )}
      </nav>

      <main style={styles.main}>
        {tab === "imoveis" && (
          <PropertiesTab
            properties={properties}
            isAdmin={isAdmin}
            onSelect={(id) => { setSelectedPropertyId(id); setTab("calendario"); }}
            showAddProperty={showAddProperty}
            setShowAddProperty={setShowAddProperty}
            propForm={propForm}
            setPropForm={setPropForm}
            addProperty={addProperty}
            deleteProperty={deleteProperty}
          />
        )}

        {tab === "calendario" && (
          <CalendarTab
            properties={properties}
            selectedPropertyId={selectedPropertyId}
            setSelectedPropertyId={(id) => { setSelectedPropertyId(id); setSelection({ start: null, end: null }); }}
            seasonMonths={seasonMonths}
            monthIdx={monthIdx}
            setMonthIdx={setMonthIdx}
            dayStatus={dayStatus}
            handleDayClick={handleDayClick}
            handleStartDateChange={handleStartDateChange}
            handleEndDateChange={handleEndDateChange}
            isRangeAvailable={isRangeAvailable}
            selection={selection}
            setSelection={setSelection}
            openBookingModal={openBookingModal}
          />
        )}

        {tab === "minhasReservas" && (
          <MyReservationsTab
            reservations={myReservations}
            properties={properties}
          />
        )}

        {tab === "painel" && isAdmin && (
          <AdminTab
            reservations={reservations}
            properties={properties}
            adminConfirm={adminConfirm}
            adminUpdatePayment={adminUpdatePayment}
            deleteReservation={deleteReservation}
          />
        )}
      </main>

      {showBooking && selectedProperty && (
        <BookingModal
          property={selectedProperty}
          selection={selection}
          bookingForm={bookingForm}
          setBookingForm={setBookingForm}
          onClose={() => setShowBooking(false)}
          onSubmit={submitBooking}
        />
      )}
    </div>
  );
}

function Logo({ compact }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: compact ? "flex-start" : "center" }}>
      <div style={styles.logoMark}>
        <Waves size={compact ? 18 : 26} color="#F2E9DC" />
      </div>
      <div>
        <div style={{ ...styles.logoText, fontSize: compact ? 20 : 28 }}>Maré Alta</div>
        {!compact && <div style={styles.logoSub}>Temporada de verão · litoral gaúcho</div>}
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={active ? "navBtnActive" : "navBtn"}>
      {icon} <span>{label}</span>
    </button>
  );
}

function PropertiesTab({
  properties, isAdmin, onSelect, showAddProperty, setShowAddProperty,
  propForm, setPropForm, addProperty, deleteProperty,
}) {
  return (
    <div>
      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>Imóveis para locação</h2>
        {isAdmin && (
          <button className="btnPrimary" onClick={() => setShowAddProperty((s) => !s)}>
            <Plus size={15} /> Novo imóvel
          </button>
        )}
      </div>

      {showAddProperty && (
        <div style={styles.card}>
          <div style={styles.formGrid}>
            <label className="field">
              <span>Nome / apelido do imóvel</span>
              <input value={propForm.title} onChange={(e) => setPropForm({ ...propForm, title: e.target.value })} placeholder="Casa Vista Mar" />
            </label>
            <label className="field">
              <span>Nome do proprietário</span>
              <input value={propForm.ownerName} onChange={(e) => setPropForm({ ...propForm, ownerName: e.target.value })} placeholder="Carlos Menezes" />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>Endereço</span>
              <input value={propForm.address} onChange={(e) => setPropForm({ ...propForm, address: e.target.value })} placeholder="Rua das Gaivotas, 120" />
            </label>
            <label className="field">
              <span>Cidade</span>
              <input value={propForm.city} onChange={(e) => setPropForm({ ...propForm, city: e.target.value })} placeholder="Torres/RS" />
            </label>
          </div>
          <button type="button" onClick={addProperty} className="btnPrimary" style={{ marginTop: 10 }}>Salvar imóvel</button>
        </div>
      )}

      {properties.length === 0 && (
        <EmptyState icon={<Building2 size={28} />} text="Nenhum imóvel cadastrado ainda." />
      )}

      <div style={styles.propGrid}>
        {properties.map((p) => (
          <div key={p.id} style={styles.propCard} onClick={() => onSelect(p.id)}>
            <div style={styles.propCardTop}>
              <Building2 size={18} color="#1C6E8C" />
              <strong>{p.title}</strong>
            </div>
            <div style={styles.propRow}><MapPin size={13} /> {p.address}{p.city ? `, ${p.city}` : ""}</div>
            <div style={styles.propRow}><User size={13} /> Proprietário: {p.ownerName}</div>
            <div style={styles.propFoot}>
              <span>Ver calendário de disponibilidade →</span>
              {isAdmin && (
                <button
                  className="btnGhost small"
                  onClick={(e) => { e.stopPropagation(); deleteProperty(p.id); }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarTab({
  properties, selectedPropertyId, setSelectedPropertyId, seasonMonths,
  monthIdx, setMonthIdx, dayStatus, handleDayClick, handleStartDateChange, handleEndDateChange,
  isRangeAvailable, selection, setSelection, openBookingModal,
}) {
  const property = properties.find((p) => p.id === selectedPropertyId);
  const { year, month } = seasonMonths[monthIdx];
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const seasonEndISO = fmtISO(new Date(seasonMonths[11].year, seasonMonths[11].month + 1, 0));

  const allSeasonDays = [];
  seasonMonths.forEach(({ year: y, month: m }) => {
    const dim = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) allSeasonDays.push(new Date(y, m, d));
  });

  const entryOptions = property
    ? allSeasonDays.filter((d) => dayStatus(property.id, d) === "green")
    : [];

  let exitOptions = [];
  if (property && selection.start) {
    let cur = parseISO(selection.start);
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    while (true) {
      const night = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1);
      if (dayStatus(property.id, night) !== "green") break;
      exitOptions.push(new Date(cur));
      if (fmtISO(cur) >= seasonEndISO) break;
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
  }

  const nights = selection.start && selection.end ? nightsBetween(selection.start, selection.end) : 0;
  const bothChosen = !!(selection.start && selection.end);
  const valid = bothChosen && property && isRangeAvailable(property.id, selection.start, selection.end);

  return (
    <div>
      <h2 style={styles.h2}>Calendário (próximos 12 meses)</h2>

      <label className="field" style={{ maxWidth: 380, marginBottom: 16 }}>
        <span>Imóvel</span>
        <select value={selectedPropertyId || ""} onChange={(e) => setSelectedPropertyId(e.target.value || null)}>
          <option value="">Selecione um imóvel…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.title} — {p.address}</option>
          ))}
        </select>
      </label>

      {!property && <EmptyState icon={<CalendarDays size={28} />} text="Selecione um imóvel para ver as datas." />}

      {property && (
        <>
          <div style={styles.dateFieldsRow}>
            <label className="field">
              <span><CalendarDays size={13} /> Data de entrada</span>
              <select
                value={selection.start || ""}
                onChange={(e) => handleStartDateChange(e.target.value || null)}
              >
                <option value="">Selecione…</option>
                {entryOptions.map((d) => (
                  <option key={fmtISO(d)} value={fmtISO(d)}>{fmtDiaSemana(d)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span><CalendarDays size={13} /> Data de saída</span>
              <select
                value={selection.end || ""}
                onChange={(e) => handleEndDateChange(e.target.value || null)}
                disabled={!selection.start}
              >
                <option value="">{selection.start ? "Selecione…" : "Escolha a entrada primeiro"}</option>
                {exitOptions.map((d) => (
                  <option key={fmtISO(d)} value={fmtISO(d)}>{fmtDiaSemana(d)}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={styles.legendRow}>
            <Legend color="#3F8F5F" label="Livre" />
            <Legend color="#E0A930" label="Pré-reserva (até 12h)" />
            <Legend color="#C0392B" label="Reservado (confirmado)" />
            <Legend color="#B8AD94" label="Data passada" />
          </div>

          <div style={styles.calCard}>
            <div style={styles.calNav}>
              <button className="btnGhost" disabled={monthIdx === 0} onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}>
                <ChevronLeft size={16} />
              </button>
              <strong>{MONTH_NAMES[month]} / {year}</strong>
              <button className="btnGhost" disabled={monthIdx === 11} onClick={() => setMonthIdx((i) => Math.min(11, i + 1))}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div style={styles.weekRow}>
              {WEEK_NAMES.map((w, i) => <div key={i} style={styles.weekName}>{w}</div>)}
            </div>
            <div style={styles.dayGrid}>
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const status = dayStatus(property.id, d);
                const iso = fmtISO(d);
                const isStart = selection.start === iso;
                const isEnd = selection.end === iso;
                const inRange = selection.start && selection.end && iso > selection.start && iso < selection.end;
                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(property.id, d)}
                    disabled={status !== "green" && !isStart && !isEnd}
                    className="dayCell"
                    style={{
                      background: isStart || isEnd ? "#0B3D4C" : inRange ? "#BFE3D0" : dayColor(status),
                      color: isStart || isEnd ? "#F2E9DC" : status === "past" ? "#7a7259" : "#1B2E33",
                      cursor: status === "green" ? "pointer" : "default",
                    }}
                    title={status}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {bothChosen && !valid && (
            <div style={styles.warnBar}>
              <AlertTriangle size={14} /> Esse período inclui datas já ocupadas ou indisponíveis. Ajuste a entrada ou a saída.
            </div>
          )}

          {valid && (
            <div style={styles.selectionBar}>
              <div>
                <Clock size={14} /> {fmtBR(selection.start)} → {fmtBR(selection.end)}
                <span style={{ marginLeft: 8, opacity: 0.75 }}>({nights} diária{nights > 1 ? "s" : ""})</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btnGhost small" onClick={() => setSelection({ start: null, end: null })}>Limpar</button>
                <button className="btnPrimary small" onClick={openBookingModal}>Solicitar pré-reserva</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function dayColor(status) {
  if (status === "green") return "#7FC79A";
  if (status === "yellow") return "#F0C868";
  if (status === "red") return "#D97A6F";
  return "#E5DFCE";
}

function Legend({ color, label }) {
  return (
    <div style={styles.legendItem}>
      <span style={{ ...styles.legendDot, background: color }} />
      {label}
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={styles.empty}>
      {icon}
      <p>{text}</p>
    </div>
  );
}

function BookingModal({ property, selection, bookingForm, setBookingForm, onClose, onSubmit }) {
  const nights = nightsBetween(selection.start, selection.end);
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHead}>
          <strong>Solicitar pré-reserva</strong>
          <button className="btnGhost small" onClick={onClose}><X size={15} /></button>
        </div>
        <p style={{ margin: "4px 0 14px", color: "#4a5a5f", fontSize: 13.5 }}>
          {property.title} · {fmtBR(selection.start)} → {fmtBR(selection.end)} ({nights} noite{nights > 1 ? "s" : ""})
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="field">
            <span><User size={13} /> Nome completo do requisitante</span>
            <input value={bookingForm.requesterName} onChange={(e) => setBookingForm({ ...bookingForm, requesterName: e.target.value })} />
          </label>
          <label className="field">
            <span><Phone size={13} /> Telefone</span>
            <input value={bookingForm.phone} onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })} placeholder="(51) 90000-0000" />
          </label>
          <label className="field">
            <span><MapPin size={13} /> Endereço / cidade onde reside</span>
            <input value={bookingForm.city} onChange={(e) => setBookingForm({ ...bookingForm, city: e.target.value })} placeholder="Porto Alegre/RS" />
          </label>
          <label className="field">
            <span><UsersIcon size={13} /> Quantas pessoas irão se hospedar</span>
            <input type="number" min={1} value={bookingForm.numPeople} onChange={(e) => setBookingForm({ ...bookingForm, numPeople: e.target.value })} />
          </label>
          <div style={{ height: 1, background: "#E5DFCE", margin: "2px 0" }} />
          <label className="field">
            <span><CreditCard size={13} /> Pagamento da estadia</span>
            <select
              value={bookingForm.paymentStatus}
              onChange={(e) => setBookingForm({ ...bookingForm, paymentStatus: e.target.value })}
            >
              <option value="nenhum">Ainda não paguei nada</option>
              <option value="caucao">Já paguei a caução</option>
              <option value="total">Já paguei o valor total</option>
            </select>
          </label>
          <label className="field">
            <span>Forma de pagamento</span>
            <select
              value={bookingForm.paymentMethod}
              onChange={(e) => setBookingForm({ ...bookingForm, paymentMethod: e.target.value })}
            >
              <option value="">Selecione…</option>
              <option value="Pix">Pix</option>
              <option value="Cartão de crédito">Cartão de crédito</option>
              <option value="Cartão de débito">Cartão de débito</option>
              <option value="Transferência bancária">Transferência bancária</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </label>
          <div className="noteBox">
            <AlertTriangle size={14} />
            A data só fica confirmada (marcada em vermelho) depois que a imobiliária conferir o pagamento da caução. Até lá, ela some automaticamente em até 12 horas.
          </div>
          <button
            type="button"
            className="btnPrimary"
            disabled={!bookingForm.requesterName.trim() || !bookingForm.phone.trim() || !bookingForm.city.trim()}
            onClick={onSubmit}
          >
            Enviar pré-reserva
          </button>
        </div>
      </div>
    </div>
  );
}

function MyReservationsTab({ reservations, properties }) {
  if (reservations.length === 0) {
    return <EmptyState icon={<UsersIcon size={28} />} text="Você ainda não fez nenhuma reserva." />;
  }
  return (
    <div>
      <h2 style={styles.h2}>Minhas reservas</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {reservations
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((r) => {
            const prop = properties.find((p) => p.id === r.propertyId);
            const expired = r.status === "pre" && Date.now() - r.createdAt >= MS_12H;
            const hoursLeft = Math.max(0, Math.ceil((MS_12H - (Date.now() - r.createdAt)) / 3600000));
            return (
              <div key={r.id} style={styles.resCard}>
                <div style={styles.resCardTop}>
                  <strong>{prop ? prop.title : "Imóvel removido"}</strong>
                  <StatusBadge status={expired ? "expired" : r.status} />
                </div>
                <div style={styles.propRow}><CalendarDays size={13} /> {fmtBR(r.checkIn)} → {fmtBR(r.checkOut)}</div>
                <div style={styles.propRow}><UsersIcon size={13} /> {r.numPeople} pessoa(s)</div>
                <div style={styles.propRow}><CreditCard size={13} /> Pagamento: {paymentLabel(r.paymentStatus)}{r.paymentMethod ? ` · ${r.paymentMethod}` : ""}</div>
                {r.status === "pre" && !expired && (
                  <div style={styles.hoursLeft}><Clock size={12} /> Expira em ~{hoursLeft}h se a caução não for confirmada</div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function paymentLabel(s) {
  if (s === "caucao") return "Caução paga";
  if (s === "total") return "Pago integralmente";
  return "Ainda não pago";
}

function StatusBadge({ status }) {
  const map = {
    pre: { bg: "#F0C868", fg: "#5A4A12", label: "Pré-reserva" },
    confirmed: { bg: "#7FC79A", fg: "#134022", label: "Confirmada" },
    expired: { bg: "#E5DFCE", fg: "#6b6349", label: "Expirada" },
  };
  const s = map[status] || map.expired;
  return <span style={{ ...styles.badge, background: s.bg, color: s.fg }}>{s.label}</span>;
}

function AdminTab({ reservations, properties, adminConfirm, adminUpdatePayment, deleteReservation }) {
  const sorted = reservations.slice().sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div>
      <h2 style={styles.h2}>Painel da imobiliária</h2>
      {sorted.length === 0 && <EmptyState icon={<ShieldCheck size={28} />} text="Nenhuma solicitação até o momento." />}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map((r) => {
          const prop = properties.find((p) => p.id === r.propertyId);
          const expired = r.status === "pre" && Date.now() - r.createdAt >= MS_12H;
          return (
            <div key={r.id} style={styles.adminCard}>
              <div style={styles.resCardTop}>
                <strong>{prop ? prop.title : "Imóvel removido"} · {r.requesterName}</strong>
                <StatusBadge status={expired ? "expired" : r.status} />
              </div>
              <div style={styles.propRow}><CalendarDays size={13} /> {fmtBR(r.checkIn)} → {fmtBR(r.checkOut)}</div>
              <div style={styles.propRow}><Phone size={13} /> {r.phone} &nbsp;·&nbsp; <MapPin size={13} /> {r.city}</div>
              <div style={styles.propRow}><UsersIcon size={13} /> {r.numPeople} pessoa(s) · usuário: {r.createdBy}</div>

              <div style={styles.adminPayRow}>
                <label className="field small">
                  <span>Status pagamento</span>
                  <select
                    value={r.paymentStatus}
                    onChange={(e) => adminUpdatePayment(r.id, "paymentStatus", e.target.value)}
                  >
                    <option value="nenhum">Não pago</option>
                    <option value="caucao">Caução paga</option>
                    <option value="total">Pago integralmente</option>
                  </select>
                </label>
                <label className="field small">
                  <span>Forma de pagamento</span>
                  <input
                    value={r.paymentMethod}
                    onChange={(e) => adminUpdatePayment(r.id, "paymentMethod", e.target.value)}
                    placeholder="Pix, cartão, dinheiro…"
                  />
                </label>
              </div>

              <div style={styles.adminActions}>
                {r.status !== "confirmed" && !expired && (
                  <button
                    className="btnPrimary small"
                    onClick={() => adminConfirm(r.id, r.paymentStatus === "nenhum" ? "caucao" : r.paymentStatus, r.paymentMethod)}
                  >
                    <Check size={13} /> Confirmar reserva (caução recebida)
                  </button>
                )}
                <button className="btnGhost small" onClick={() => deleteReservation(r.id)}>
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StyleBlock() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      .field { display:flex; flex-direction:column; gap:5px; font-family:'Inter',sans-serif; font-size:13px; color:#37474A; }
      .field.small { font-size:12px; }
      .field span { font-weight:600; display:flex; align-items:center; gap:5px; }
      .field input, .field select {
        font-family:'Inter',sans-serif; padding:9px 11px; border-radius:9px; border:1.5px solid #D9CBB0;
        background:#FFFDF8; font-size:14px; color:#1B2E33; outline:none; transition:border-color .15s;
      }
      .field input:focus, .field select:focus { border-color:#1C6E8C; }
      .btnPrimary {
        display:inline-flex; align-items:center; gap:6px; justify-content:center;
        background:#0B3D4C; color:#F2E9DC; border:none; padding:10px 16px; border-radius:10px;
        font-family:'Inter',sans-serif; font-weight:600; font-size:13.5px; cursor:pointer; transition:transform .1s, background .15s;
      }
      .btnPrimary:hover { background:#134D60; }
      .btnPrimary:active { transform:scale(0.97); }
      .btnPrimary.small { padding:7px 12px; font-size:12.5px; }
      .btnGhost {
        display:inline-flex; align-items:center; gap:5px; background:transparent; color:#0B3D4C;
        border:1.5px solid #D9CBB0; padding:9px 13px; border-radius:10px; font-family:'Inter',sans-serif;
        font-weight:600; font-size:13px; cursor:pointer;
      }
      .btnGhost:hover { background:#EFE6D3; }
      .btnGhost.small { padding:6px 10px; font-size:12px; }
      .btnGhost:disabled { opacity:.35; cursor:default; }
      .authTab, .authTabActive {
        flex:1; padding:9px; border-radius:9px; border:none; font-family:'Inter',sans-serif; font-weight:600; font-size:13px; cursor:pointer;
      }
      .authTab { background:transparent; color:#7a8b8f; }
      .authTabActive { background:#0B3D4C; color:#F2E9DC; }
      .authError {
        display:flex; align-items:center; gap:6px; background:#F7DEDB; color:#8A2E23;
        padding:8px 10px; border-radius:8px; font-family:'Inter',sans-serif; font-size:12.5px;
      }
      .navBtn, .navBtnActive {
        display:flex; align-items:center; gap:6px; padding:9px 14px; border-radius:10px; border:none;
        font-family:'Inter',sans-serif; font-weight:600; font-size:13px; cursor:pointer; white-space:nowrap;
      }
      .navBtn { background:transparent; color:#5A6B6E; }
      .navBtn:hover { background:#EFE6D3; }
      .navBtnActive { background:#1C6E8C; color:#F2E9DC; }
      .dayCell {
        aspect-ratio:1; border:none; border-radius:8px; font-family:'JetBrains Mono', monospace;
        font-size:12.5px; font-weight:600; display:flex; align-items:center; justify-content:center;
      }
      .noteBox {
        display:flex; gap:8px; align-items:flex-start; background:#FBF0DA; color:#7A5A16;
        padding:10px 12px; border-radius:9px; font-family:'Inter',sans-serif; font-size:12px; line-height:1.5;
      }
      .wave-bg {
        position:absolute; inset:0; background:
          radial-gradient(circle at 15% 20%, rgba(232,147,91,0.18), transparent 45%),
          linear-gradient(160deg, #0B3D4C 0%, #135065 55%, #1C6E8C 100%);
        z-index:0;
      }
      .wave-divider {
        height:14px; width:100%;
        background: radial-gradient(circle at 10px -4px, transparent 12px, #1C6E8C 13px) 0 0/24px 20px repeat-x;
        opacity:0.85;
      }
      ::selection { background:#E8935B55; }
    `}</style>
  );
}

const styles = {
  bootWrap: {
    minHeight: 420, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(160deg,#0B3D4C,#1C6E8C)", borderRadius: 16, padding: 40,
  },
  authWrap: {
    position: "relative", minHeight: 620, borderRadius: 18, overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
  },
  authCard: {
    position: "relative", zIndex: 1, background: "#F9F4E9", borderRadius: 16, padding: "28px 26px",
    width: "100%", maxWidth: 380, boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
  },
  authTabs: { display: "flex", gap: 8, margin: "18px 0 16px" },
  authFoot: { marginTop: 16, fontSize: 11.5, color: "#7a8b8f", lineHeight: 1.5, fontFamily: "Inter,sans-serif" },
  appWrap: { background: "#F2E9DC", borderRadius: 16, overflow: "hidden", fontFamily: "Inter,sans-serif", minHeight: 560 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", background: "#0B3D4C" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  userChip: {
    display: "flex", alignItems: "center", gap: 5, background: "rgba(242,233,220,0.12)", color: "#F2E9DC",
    padding: "6px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 600,
  },
  logoMark: { width: 38, height: 38, borderRadius: 11, background: "#1C6E8C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  logoText: { fontFamily: "Fraunces,serif", fontWeight: 700, color: "#F2E9DC", lineHeight: 1 },
  logoSub: { fontFamily: "Inter,sans-serif", fontSize: 12, color: "#B9CBD0", marginTop: 3 },
  nav: { display: "flex", gap: 6, padding: "12px 20px", flexWrap: "wrap", background: "#F2E9DC" },
  main: { padding: "6px 20px 28px" },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 },
  h2: { fontFamily: "Fraunces,serif", fontSize: 21, color: "#0B3D4C", margin: "8px 0 14px" },
  card: { background: "#FFFDF8", border: "1.5px solid #D9CBB0", borderRadius: 14, padding: 16, marginBottom: 18 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  propGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 14 },
  propCard: { background: "#FFFDF8", border: "1.5px solid #D9CBB0", borderRadius: 14, padding: 16, cursor: "pointer", transition: "transform .1s" },
  propCardTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 15 },
  propRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 12.8, color: "#4a5a5f", marginBottom: 4 },
  propFoot: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "#1C6E8C", fontWeight: 600 },
  dateFieldsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 420, marginBottom: 16 },
  legendRow: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4a5a5f" },
  legendDot: { width: 11, height: 11, borderRadius: 4, display: "inline-block" },
  warnBar: {
    display: "flex", alignItems: "center", gap: 8, background: "#F7DEDB", color: "#8A2E23",
    borderRadius: 12, padding: "10px 16px", marginTop: 14, maxWidth: 420, fontSize: 12.5,
  },
  calCard: { background: "#FFFDF8", border: "1.5px solid #D9CBB0", borderRadius: 14, padding: 16, maxWidth: 420 },
  calNav: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, fontFamily: "Fraunces,serif", fontSize: 15, color: "#0B3D4C" },
  weekRow: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 },
  weekName: { textAlign: "center", fontSize: 11, color: "#9a8f72", fontWeight: 700 },
  dayGrid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 },
  selectionBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
    background: "#0B3D4C", color: "#F2E9DC", borderRadius: 12, padding: "10px 16px", marginTop: 14, maxWidth: 420, fontSize: 13,
  },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#9a8f72", padding: "40px 0" },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(11,61,76,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalCard: { background: "#F9F4E9", borderRadius: 16, padding: 22, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "Fraunces,serif", fontSize: 17, color: "#0B3D4C" },
  resCard: { background: "#FFFDF8", border: "1.5px solid #D9CBB0", borderRadius: 14, padding: 14 },
  resCardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, fontSize: 14.5 },
  badge: { fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 },
  hoursLeft: { display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#9a7b1d", marginTop: 6 },
  adminCard: { background: "#FFFDF8", border: "1.5px solid #D9CBB0", borderRadius: 14, padding: 14 },
  adminPayRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "10px 0" },
  adminActions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 },
};
