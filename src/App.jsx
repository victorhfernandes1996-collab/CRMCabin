// CabinCraft CRM — npm i @supabase/supabase-js html2canvas jspdf
// .env: VITE_SUPABASE_URL=...  VITE_SUPABASE_ANON_KEY=...
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configurado = Boolean(SB_URL && SB_KEY);
const sb = configurado ? createClient(SB_URL, SB_KEY) : null;
const PRODUTOS_PADRAO = [
  { nome: "Cabine 180º - Fixo", preco: 9900, desconto_max: 10, descricao: "Cabine 180º com piso fixo (instalação permanente)" },
  { nome: "Cabine 180º - Móvel", preco: 10800, desconto_max: 10, descricao: "Cabine 180º com piso móvel sobre rodas reforçadas" },
];
const ProdutosCtx = createContext(PRODUTOS_PADRAO);
const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const C = { bg: "#15171b", card: "#1e2126", line: "#333842", or: "#f28c0f", tx: "#f3f0ea", mut: "#9aa0aa" };
const S = {
  page: { background: C.bg, color: C.tx, minHeight: "100vh", padding: 16, fontFamily: "system-ui,sans-serif" },
  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginBottom: 12 },
  in: { background: C.bg, color: C.tx, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, width: "100%", boxSizing: "border-box", marginBottom: 8 },
  btn: { background: C.or, color: "#000", border: 0, borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  ghost: { background: "transparent", color: C.tx, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer" },
};

export default function Root() {
  if (!configurado)
    return (
      <div style={{ background: "#15171b", color: "#f3f0ea", minHeight: "100vh", padding: 24, fontFamily: "system-ui,sans-serif" }}>
        <h2 style={{ color: "#f28c0f" }}>Variáveis do Supabase não encontradas</h2>
        <p>Cadastre <b>VITE_SUPABASE_URL</b> e <b>VITE_SUPABASE_ANON_KEY</b> nas Environment Variables da Vercel e faça um novo Redeploy.</p>
        <p style={{ color: "#9aa0aa" }}>URL: {SB_URL ? "ok" : "faltando"} · Chave: {SB_KEY ? "ok" : "faltando"}</p>
      </div>
    );
  return <App />;
}

function App() {
  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [recup, setRecup] = useState(false);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((e, s) => { setSession(s); if (e === "PASSWORD_RECOVERY") setRecup(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  const carregaPerfil = async () => {
    const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
    setPerfil(data);
  };
  useEffect(() => { if (session) carregaPerfil(); else setPerfil(null); }, [session]);

  if (session === undefined) return <div style={S.page}>Carregando…</div>;
  if (recup) return <NovaSenha onOk={() => setRecup(false)} />;
  if (!session) return <Auth />;
  if (!perfil) return <div style={S.page}>Carregando perfil…</div>;
  if (!perfil.aprovado)
    return (
      <div style={S.page}>
        <div style={S.card}>
          <h2 style={{ color: C.or }}>Cadastro em análise</h2>
          <p>Seu acesso ainda precisa ser aprovado pelo administrador.</p>
          <button style={S.ghost} onClick={carregaPerfil}>Verificar novamente</button>{" "}
          <button style={S.ghost} onClick={() => sb.auth.signOut()}>Sair</button>
        </div>
      </div>
    );
  return <Crm perfil={perfil} recarrega={carregaPerfil} />;
}

function Auth() {
  const [modo, setModo] = useState("login");
  const [f, setF] = useState({ nome: "", email: "", senha: "" });
  const [msg, setMsg] = useState("");
  const enviar = async () => {
    setMsg("");
    const r = modo === "login"
      ? await sb.auth.signInWithPassword({ email: f.email, password: f.senha })
      : await sb.auth.signUp({ email: f.email, password: f.senha, options: { data: { nome: f.nome } } });
    if (r.error) setMsg(r.error.message);
    else if (modo === "cadastro" && !r.data.session) setMsg("Cadastro feito! Confirme seu e-mail (se exigido) e aguarde aprovação.");
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const esqueci = async () => {
    if (!f.email) return setMsg("Digite seu e-mail acima e clique de novo.");
    const r = await sb.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin });
    setMsg(r.error ? r.error.message : "Enviamos um link para redefinir sua senha. Confira seu e-mail.");
  };
  return (
    <div style={{ ...S.page, display: "grid", placeItems: "center" }}>
      <div style={{ ...S.card, width: 340 }}>
        <h2 style={{ color: C.or, marginTop: 0 }}>CabinCraft CRM</h2>
        {modo === "cadastro" && <input style={S.in} placeholder="Nome" value={f.nome} onChange={set("nome")} />}
        <input style={S.in} placeholder="E-mail" value={f.email} onChange={set("email")} />
        <input style={S.in} placeholder="Senha" type="password" value={f.senha} onChange={set("senha")} />
        <button style={{ ...S.btn, width: "100%" }} onClick={enviar}>{modo === "login" ? "Entrar" : "Solicitar acesso"}</button>
        {modo === "login" && <p style={{ color: C.or, fontSize: 13, cursor: "pointer", marginBottom: 0 }} onClick={esqueci}>Esqueci minha senha</p>}
        {msg && <p style={{ color: C.mut, fontSize: 13 }}>{msg}</p>}
        <p style={{ color: C.mut, fontSize: 13, cursor: "pointer" }} onClick={() => setModo(modo === "login" ? "cadastro" : "login")}>
          {modo === "login" ? "Não tem conta? Solicitar acesso" : "Já tenho conta"}
        </p>
      </div>
    </div>
  );
}

function Admin() {
  const [l, setL] = useState([]);
  const load = async () => setL((await sb.from("profiles").select("*").order("created_at", { ascending: false })).data || []);
  useEffect(() => { load(); }, []);
  const upd = async (id, v) => { await sb.from("profiles").update(v).eq("id", id); load(); };
  return (
    <div>
      <h3>Usuários</h3>
      {l.map((u) => (
        <div key={u.id} style={{ ...S.card, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <b>{u.nome || "—"}</b> <span style={{ color: C.mut }}>{u.email} · {u.role}</span>
          </div>
          {u.aprovado
            ? <button style={S.ghost} onClick={() => upd(u.id, { aprovado: false })}>Revogar</button>
            : <button style={S.btn} onClick={() => upd(u.id, { aprovado: true })}>Aprovar</button>}
          <button style={S.ghost} onClick={() => upd(u.id, { role: u.role === "admin" ? "vendedor" : "admin" })}>
            {u.role === "admin" ? "Tornar vendedor" : "Tornar admin"}
          </button>
        </div>
      ))}
    </div>
  );
}

const ETAPAS = ["Apresentação", "Construir Proposta", "Negociação", "Fechamento", "Contrato"];
const hojeStr = () => new Date().toLocaleDateString("sv-SE");
const dataBR = (d) => new Date(d + "T00:00").toLocaleDateString("pt-BR");
const Modal = ({ children, z = 5 }) => (
  <div style={{ position: "fixed", inset: 0, background: "#000c", overflow: "auto", padding: 16, zIndex: z }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>{children}</div>
  </div>
);
const Badge = ({ s }) => (
  <span style={{ background: s === "ganho" ? "#1f7a3d" : s === "perdido" ? "#a32626" : C.line, borderRadius: 6, padding: "2px 8px", fontSize: 12 }}>
    {s === "aberto" ? "em andamento" : s}
  </span>
);

const diasParado = (n) => Math.floor((Date.now() - new Date(n.atualizado_em || n.created_at)) / 864e5);
const infoNeg = (n, pend) => {
  const p = pend.filter((x) => x.negocio_id === n.id);
  return { dias: diasParado(n), semProx: p.length === 0, atrasada: p.some((x) => x.vencimento && x.vencimento < hojeStr()) };
};
const parado = (n, pend) => n.status === "aberto" && (diasParado(n) >= 7 || infoNeg(n, pend).atrasada);
const nomeDe = (vend, id) => { const v = vend.find((x) => x.id === id); return v ? v.nome || v.email?.split("@")[0] : "—"; };
const soma = (l) => l.reduce((s, n) => s + Number(n.preco || 0), 0);
const ORIGENS = ["Indicação", "Instagram", "Evento", "Igreja da rede", "Site", "WhatsApp", "Outro"];
const PROB = { "Apresentação": 10, "Construir Proposta": 25, "Negociação": 50, "Fechamento": 75, "Contrato": 90 };
const probEf = (n) => (n.probabilidade ?? PROB[n.etapa] ?? 0);
const Kpi = ({ t, v, s, cor }) => (
  <div style={{ ...S.card, marginBottom: 0 }}>
    <div style={{ color: C.mut, fontSize: 12 }}>{t}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: cor || C.tx }}>{v}</div>
    {s && <div style={{ color: C.mut, fontSize: 12 }}>{s}</div>}
  </div>
);

const MENU = [["painel", "📊", "Painel"], ["negocios", "💼", "Negócios"], ["clientes", "👥", "Clientes"], ["atividades", "✅", "Atividades"]];
const mesISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };

function Crm({ perfil, recarrega }) {
  const [aba, setAba] = useState("painel");
  const [clientes, setClientes] = useState([]);
  const [negocios, setNegocios] = useState([]);
  const [vend, setVend] = useState([]);
  const [pend, setPend] = useState([]);
  const [metas, setMetas] = useState([]);
  const [produtos, setProdutos] = useState(PRODUTOS_PADRAO);
  const [aprov, setAprov] = useState([]);
  const [cliQ, setCliQ] = useState("");
  const [aberto, setAberto] = useState(null);
  const [v, setV] = useState(0);
  const [aberta, setAberta] = useState(() => {
    try { const x = localStorage.getItem("sidebar"); if (x !== null) return x === "1"; } catch (e) {}
    return window.innerWidth >= 800;
  });
  const alterna = () => {
    const n = !aberta; setAberta(n);
    try { localStorage.setItem("sidebar", n ? "1" : "0"); } catch (e) {}
  };
  const load = async () => {
    setClientes((await sb.from("clientes").select("*").order("nome")).data || []);
    setNegocios((await sb.from("negocios").select("*, clientes(nome, igreja)").order("created_at", { ascending: false })).data || []);
    setVend((await sb.rpc("listar_vendedores")).data || []);
    setPend((await sb.from("tarefas").select("negocio_id, vencimento").eq("feita", false)).data || []);
    setMetas((await sb.from("metas").select("*").eq("mes", mesISO())).data || []);
    const pr = await sb.from("produtos").select("*").eq("ativo", true).order("nome");
    if (pr.data?.length) setProdutos(pr.data);
    if (perfil.role === "admin") setAprov((await sb.from("propostas").select("*, negocios(id, titulo, owner, clientes(nome))").eq("status_aprov", "pendente").order("created_at")).data || []);
  };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  const admin = perfil.role === "admin";
  const itens = [...MENU, ...(admin ? [["aprovacoes", "🔔", "Aprovações"], ["admin", "🔑", "Usuários"], ["produtos", "📦", "Produtos"]] : []), ["perfil", "👤", "Meu perfil"]];
  const atras = pend.filter((x) => x.vencimento && x.vencimento < hojeStr()).length;
  const neg = negocios.find((n) => n.id === aberto);
  const badgeDe = (k) => (k === "atividades" ? atras : k === "aprovacoes" ? aprov.length : 0);
  return (
    <ProdutosCtx.Provider value={produtos}>
      <div style={{ display: "flex", background: C.bg, color: C.tx, minHeight: "100vh", fontFamily: "system-ui,sans-serif" }}>
        <aside style={{ width: aberta ? 210 : 64, flexShrink: 0, background: "#101216", borderRight: `1px solid ${C.line}`, position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column", padding: 8, boxSizing: "border-box", transition: "width .15s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: aberta ? "space-between" : "center", padding: "6px 4px 12px" }}>
            {aberta && <b style={{ color: C.or, fontSize: 17 }}>CabinCraft</b>}
            <button title={aberta ? "Recolher menu" : "Expandir menu"} style={{ ...S.ghost, padding: "4px 10px" }} onClick={alterna}>{aberta ? "«" : "»"}</button>
          </div>
          {itens.map(([k, ic, l]) => (
            <button key={k} title={l} onClick={() => setAba(k)}
              style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: aberta ? "flex-start" : "center", width: "100%", background: aba === k ? "#2a2016" : "transparent", color: aba === k ? C.or : C.tx, border: 0, borderLeft: `3px solid ${aba === k ? C.or : "transparent"}`, borderRadius: 8, padding: "10px", marginBottom: 2, cursor: "pointer", fontSize: 15, position: "relative" }}>
              <span style={{ fontSize: 18 }}>{ic}</span>
              {aberta && <span>{l}</span>}
              {badgeDe(k) > 0 && (
                <span style={{ marginLeft: aberta ? "auto" : 0, position: aberta ? "static" : "absolute", top: 2, right: 6, background: "#d64545", color: "#fff", borderRadius: 10, fontSize: 11, padding: "0 6px" }}>{badgeDe(k)}</span>
              )}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {aberta && <div style={{ color: C.mut, fontSize: 12, padding: "4px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perfil.nome || perfil.email}</div>}
          <button title="Sair" style={{ ...S.ghost, width: "100%" }} onClick={() => sb.auth.signOut()}>{aberta ? "Sair" : "⎋"}</button>
        </aside>
        <main style={{ flex: 1, minWidth: 0, padding: 16 }}>
          <BuscaGlobal clientes={clientes} negocios={negocios} abrir={setAberto} irCliente={(q) => { setCliQ(q); setAba("clientes"); }} />
          {!perfil.whatsapp && aba !== "perfil" && (
            <div style={{ ...S.card, borderColor: C.or }}>
              Preencha seu WhatsApp em <b style={{ color: C.or, cursor: "pointer" }} onClick={() => setAba("perfil")}>Meu perfil</b>. Ele aparece nas suas propostas.
            </div>
          )}
          {aba === "painel" && <Painel negocios={negocios} vend={vend} pend={pend} perfil={perfil} metas={metas} load={load} />}
          {aba === "negocios" && <Negocios negocios={negocios} clientes={clientes} vend={vend} pend={pend} perfil={perfil} abrir={setAberto} load={load} />}
          {aba === "clientes" && <Clientes clientes={clientes} negocios={negocios} perfil={perfil} abrir={setAberto} load={load} q={cliQ} setQ={setCliQ} />}
          {aba === "atividades" && <Atividades key={v} abrir={setAberto} negocios={negocios} vend={vend} perfil={perfil} />}
          {aba === "admin" && <Admin />}
          {aba === "aprovacoes" && <Aprovacoes itens={aprov} vend={vend} load={load} />}
          {aba === "produtos" && <Produtos recarrega={load} />}
          {aba === "perfil" && <Perfil perfil={perfil} recarrega={recarrega} />}
        </main>
        {neg && <Negocio n={neg} perfil={perfil} vend={vend} load={load} fechar={() => { setAberto(null); setV(v + 1); load(); }} />}
      </div>
    </ProdutosCtx.Provider>
  );
}

function MetasCard({ negocios, vend, metas, perfil, reload }) {
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const admin = perfil.role === "admin";
  const lista = admin ? vend : vend.filter((x) => x.id === perfil.id);
  const real = (id) => soma(negocios.filter((n) => n.owner === id && n.status === "ganho" && n.fechado_em && new Date(n.fechado_em) >= ini));
  const meta = (id) => Number(metas.find((m) => m.vendedor_id === id)?.valor || 0);
  const salvar = async (id, valor) => {
    const r = await sb.from("metas").upsert({ vendedor_id: id, mes: mesISO(), valor: Number(valor) || 0 }, { onConflict: "vendedor_id,mes" });
    if (r.error) alert(r.error.message);
    reload();
  };
  const barra = (r, m) => {
    const pct = m > 0 ? Math.round((100 * r) / m) : 0;
    return (
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ background: C.bg, borderRadius: 6, height: 10 }}>
          <div style={{ background: pct >= 100 ? "#3ecf6e" : C.or, width: `${Math.min(100, pct)}%`, height: 10, borderRadius: 6 }} />
        </div>
        <small style={{ color: C.mut }}>{brl(r)} de {brl(m)} · {pct}%</small>
      </div>
    );
  };
  const totM = lista.reduce((s, x) => s + meta(x.id), 0);
  const totR = lista.reduce((s, x) => s + real(x.id), 0);
  return (
    <div style={S.card}>
      <b>Metas do mês</b>
      {admin && <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0", flexWrap: "wrap" }}><span style={{ minWidth: 140 }}>Time todo</span>{barra(totR, totM)}</div>}
      {lista.map((x) => (
        <div key={x.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", flexWrap: "wrap", borderTop: `1px solid ${C.line}` }}>
          <span style={{ minWidth: 140 }}>{x.id === perfil.id ? "Eu" : x.nome || x.email}</span>
          {barra(real(x.id), meta(x.id))}
          {admin && <input key={meta(x.id)} style={{ ...S.in, width: 130, marginBottom: 0 }} type="number" placeholder="Meta R$" defaultValue={meta(x.id) || ""} onBlur={(e) => { if (Number(e.target.value) !== meta(x.id)) salvar(x.id, e.target.value); }} />}
        </div>
      ))}
      {!admin && !meta(perfil.id) && <div style={{ color: C.mut, fontSize: 13 }}>O admin ainda não definiu sua meta deste mês.</div>}
    </div>
  );
}

const StatusAprov = ({ p }) => {
  const m = {
    ok: ["dentro da política", C.line], pendente: ["⏳ aguardando aprovação", "#8a6d1f"],
    aprovada: ["✓ aprovada", "#1f7a3d"], recusada: ["✕ recusada", "#a32626"],
  }[p.status_aprov || "ok"];
  return <span style={{ background: m[1], borderRadius: 6, padding: "1px 7px", fontSize: 11 }}>{m[0]}{Number(p.desconto_pct) > 0 ? ` · ${p.desconto_pct}%` : ""}</span>;
};
const chaveProp = (x) => JSON.stringify([x.produto, Number(x.preco), Number(x.desconto || 0)]);

async function acharDuplicados(nome, telefone, igreja) {
  const r = await sb.rpc("buscar_duplicado", { p_nome: nome, p_telefone: telefone || null, p_igreja: igreja || null });
  return r.data || [];
}

function AvisoDuplicado({ lista, perfil, onUsar, onMesmoAssim }) {
  const alheio = lista.some((d) => d.dono_id !== perfil.id);
  return (
    <div style={{ ...S.card, borderColor: "#f5c542" }}>
      <b style={{ color: "#f5c542" }}>⚠ Possível cliente duplicado</b>
      {lista.map((d) => (
        <div key={d.id} style={{ padding: "6px 0", fontSize: 14 }}>
          {d.nome}{d.igreja ? ` — ${d.igreja}` : ""}{d.cidade ? ` · ${d.cidade}` : ""}
          <span style={{ color: C.mut }}> · vendedor: {d.dono_id === perfil.id ? "você" : d.dono_nome || "—"} · {d.negocios_abertos} negócio(s) em aberto</span>
          {onUsar && d.dono_id === perfil.id && <> <button style={S.ghost} onClick={() => onUsar(d)}>Usar este</button></>}
        </div>
      ))}
      {alheio && perfil.role !== "admin"
        ? <div style={{ color: C.mut, fontSize: 13 }}>Este cliente já é atendido por outro vendedor. Fale com o admin antes de cadastrar.</div>
        : <button style={S.ghost} onClick={onMesmoAssim}>Cadastrar mesmo assim</button>}
    </div>
  );
}

function ProximaAtividade({ n, etapa, onOk, onCancel }) {
  const [f, setF] = useState({ tipo: "ligacao", titulo: "", vencimento: "", hora: "" });
  const salvar = async () => {
    if (!f.titulo.trim() || !f.vencimento) return alert("Informe o que fazer e a data.");
    const r = await sb.from("tarefas").insert({ cliente_id: n.cliente_id, negocio_id: n.id, titulo: f.titulo, tipo: f.tipo, vencimento: f.vencimento, hora: f.hora || null, owner: n.owner || undefined });
    if (r.error) return alert(r.error.message);
    onOk();
  };
  const w = { ...S.in, marginBottom: 0 };
  return (
    <Modal z={20}>
      <div style={S.card}>
        <b>Próxima atividade</b>
        <p style={{ color: C.mut, fontSize: 14 }}>Para mover “{n.titulo}” para <b style={{ color: C.or }}>{etapa}</b>, agende o próximo passo com o cliente.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select style={{ ...w, width: 140 }} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.entries(TIPOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input style={{ ...w, flex: 1, minWidth: 180 }} placeholder="O que fazer?" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
          <input style={{ ...w, width: 145 }} type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} />
          <input style={{ ...w, width: 110 }} type="time" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} />
        </div>
        <button style={S.btn} onClick={salvar}>Agendar e mover</button> <button style={S.ghost} onClick={onCancel}>Cancelar</button>
      </div>
    </Modal>
  );
}

function Aprovacoes({ itens, vend, load }) {
  useEffect(() => { load(); }, []);
  const decidir = async (p, status) => {
    let obs = null;
    if (status === "recusada") { obs = window.prompt("Motivo da recusa (o vendedor vai ver):"); if (obs === null) return; }
    const r = await sb.from("propostas").update({ status_aprov: status, obs_aprov: obs }).eq("id", p.id);
    if (r.error) return alert(r.error.message);
    if (status === "aprovada" && p.negocio_id) await sb.from("negocios").update({ preco: p.preco - p.desconto, produto: p.produto }).eq("id", p.negocio_id);
    if (p.negocio_id) await sb.from("historico").insert({ negocio_id: p.negocio_id, texto: status === "aprovada" ? `Desconto de ${p.desconto_pct}% APROVADO` : `Desconto de ${p.desconto_pct}% RECUSADO${obs ? ": " + obs : ""}` });
    load();
  };
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Aprovações de desconto</h3>
      {!itens.length && <div style={{ color: C.mut }}>Nenhuma aprovação pendente.</div>}
      {itens.map((p) => (
        <div key={p.id} style={S.card}>
          <div><b>{p.negocios?.titulo}</b> <span style={{ color: C.mut }}>{p.negocios?.clientes?.nome} · vendedor: {nomeDe(vend, p.negocios?.owner)}</span></div>
          <div style={{ margin: "6px 0" }}>
            {p.produto}: tabela {brl(p.preco_tabela)} → proposto <b style={{ color: C.or }}>{brl(p.preco - p.desconto)}</b> <StatusAprov p={p} />
          </div>
          {p.obs && <div style={{ color: C.mut, fontSize: 13, marginBottom: 6 }}>Obs.: {p.obs}</div>}
          <button style={{ ...S.btn, background: "#2ea34f" }} onClick={() => decidir(p, "aprovada")}>✓ Aprovar</button>{" "}
          <button style={{ ...S.btn, background: "#d64545" }} onClick={() => decidir(p, "recusada")}>✕ Recusar</button>
        </div>
      ))}
    </div>
  );
}

const MOTIVOS = ["Preço", "Concorrente", "Sem verba", "Sem resposta", "Adiou a decisão", "Fora do perfil", "Outro"];
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function MotivoPerda({ onOk, onCancel }) {
  const [m, setM] = useState("");
  const [obs, setObs] = useState("");
  const ok = () => {
    if (!m) return alert("Escolha o motivo da perda.");
    if (m === "Outro" && !obs.trim()) return alert("Descreva o motivo.");
    onOk({ motivo: m, obs: obs.trim() });
  };
  return (
    <Modal z={20}>
      <div style={S.card}>
        <b>Motivo da perda</b>
        <select style={{ ...S.in, marginTop: 8 }} value={m} onChange={(e) => setM(e.target.value)}>
          <option value="">Escolha…</option>
          {MOTIVOS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <textarea style={{ ...S.in, height: 70 }} placeholder={m === "Outro" ? "Descreva o motivo (obrigatório)" : "Observação (opcional)"} value={obs} onChange={(e) => setObs(e.target.value)} />
        <button style={{ ...S.btn, background: "#d64545" }} onClick={ok}>Confirmar perda</button> <button style={S.ghost} onClick={onCancel}>Cancelar</button>
      </div>
    </Modal>
  );
}

function BuscaGlobal({ clientes, negocios, abrir, irCliente }) {
  const [q, setQ] = useState("");
  const [foco, setFoco] = useState(false);
  const [cts, setCts] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setCts([]); return; }
    const t = setTimeout(async () => {
      const s = q.trim().replace(/[%,()]/g, " ");
      const r = await sb.from("contatos").select("id, nome, cargo, telefone, cliente_id, clientes(nome)")
        .or(`nome.ilike.%${s}%,telefone.ilike.%${s}%,email.ilike.%${s}%`).limit(6);
      setCts(r.data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const nq = norm(q.trim());
  const ativo = foco && nq.length >= 2;
  const ns = ativo ? negocios.filter((n) => norm(`${n.titulo} ${n.clientes?.nome || ""}`).includes(nq)).slice(0, 6) : [];
  const cs = ativo ? clientes.filter((c) => norm(`${c.nome} ${c.igreja || ""} ${c.telefone || ""} ${c.cidade || ""}`).includes(nq)).slice(0, 6) : [];
  const fecha = () => { setFoco(false); setQ(""); };
  const item = { padding: "8px 12px", cursor: "pointer", fontSize: 14, borderTop: `1px solid ${C.line}` };
  const tit = { padding: "6px 12px", fontSize: 11, color: C.mut, textTransform: "uppercase" };
  return (
    <div style={{ position: "relative", maxWidth: 460, marginBottom: 14 }}>
      <input style={{ ...S.in, marginBottom: 0 }} placeholder="🔎 Buscar cliente, negócio ou contato…" value={q}
        onChange={(e) => setQ(e.target.value)} onFocus={() => setFoco(true)} onBlur={() => setTimeout(() => setFoco(false), 150)} />
      {ativo && (
        <div style={{ position: "absolute", zIndex: 6, left: 0, right: 0, top: "100%", marginTop: 4, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, maxHeight: 380, overflow: "auto" }}>
          {ns.length > 0 && <div style={tit}>Negócios</div>}
          {ns.map((n) => <div key={n.id} style={item} onClick={() => { abrir(n.id); fecha(); }}>{n.titulo} <span style={{ color: C.mut }}>· {n.clientes?.nome}</span> <Badge s={n.status} /></div>)}
          {cs.length > 0 && <div style={tit}>Clientes</div>}
          {cs.map((c) => <div key={c.id} style={item} onClick={() => { irCliente(c.nome); fecha(); }}>{c.nome} <span style={{ color: C.mut }}>{c.igreja} {c.cidade && `· ${c.cidade}`}</span></div>)}
          {cts.length > 0 && <div style={tit}>Contatos</div>}
          {cts.map((c) => <div key={c.id} style={item} onClick={() => { irCliente(c.clientes?.nome || ""); fecha(); }}>{c.nome} <span style={{ color: C.mut }}>{c.cargo} · {c.telefone} · {c.clientes?.nome}</span></div>)}
          {!ns.length && !cs.length && !cts.length && <div style={{ padding: 12, color: C.mut, fontSize: 14 }}>Nada encontrado.</div>}
        </div>
      )}
    </div>
  );
}

function Produtos({ recarrega }) {
  const [l, setL] = useState([]);
  const [f, setF] = useState({ nome: "", descricao: "", preco: "", desconto_max: "10" });
  const load = async () => setL((await sb.from("produtos").select("*").order("nome")).data || []);
  useEffect(() => { load(); }, []);
  const upd = async (id, v) => {
    const r = await sb.from("produtos").update(v).eq("id", id);
    if (r.error) alert(r.error.message);
    load(); recarrega();
  };
  const add = async () => {
    if (!f.nome.trim()) return;
    const r = await sb.from("produtos").insert({ nome: f.nome.trim(), descricao: f.descricao, preco: Number(f.preco) || 0, desconto_max: Number(f.desconto_max) || 0 });
    if (r.error) return alert(r.error.message);
    setF({ nome: "", descricao: "", preco: "", desconto_max: "10" }); load(); recarrega();
  };
  const w = { ...S.in, marginBottom: 0 };
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Catálogo de produtos</h3>
      <div style={{ color: C.mut, fontSize: 13, marginBottom: 10 }}>O preço aqui é o padrão. Em cada negócio e proposta ele continua editável.</div>
      {l.map((p) => (
        <div key={p.id} style={{ ...S.card, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", opacity: p.ativo ? 1 : 0.55 }}>
          <input style={{ ...w, flex: 1, minWidth: 160 }} defaultValue={p.nome} onBlur={(e) => e.target.value !== p.nome && upd(p.id, { nome: e.target.value })} />
          <input style={{ ...w, flex: 2, minWidth: 200 }} defaultValue={p.descricao || ""} placeholder="Descrição (vai na proposta)" onBlur={(e) => e.target.value !== (p.descricao || "") && upd(p.id, { descricao: e.target.value })} />
          <input style={{ ...w, width: 120 }} type="number" defaultValue={p.preco} onBlur={(e) => Number(e.target.value) !== Number(p.preco) && upd(p.id, { preco: Number(e.target.value) })} />
          <label style={{ fontSize: 13, color: C.mut }}>Desc. máx. %{" "}<input style={{ ...w, width: 80 }} type="number" min="0" max="100" defaultValue={p.desconto_max ?? 10} onBlur={(e) => Number(e.target.value) !== Number(p.desconto_max) && upd(p.id, { desconto_max: Number(e.target.value) })} /></label>
          <label style={{ fontSize: 14 }}><input type="checkbox" checked={p.ativo} onChange={(e) => upd(p.id, { ativo: e.target.checked })} /> Ativo</label>
        </div>
      ))}
      <div style={S.card}>
        <b>Novo produto</b>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <input style={{ ...w, flex: 1, minWidth: 160 }} placeholder="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          <input style={{ ...w, flex: 2, minWidth: 200 }} placeholder="Descrição" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
          <input style={{ ...w, width: 120 }} type="number" placeholder="Preço" value={f.preco} onChange={(e) => setF({ ...f, preco: e.target.value })} />
          <input style={{ ...w, width: 110 }} type="number" placeholder="Desc. máx. %" value={f.desconto_max} onChange={(e) => setF({ ...f, desconto_max: e.target.value })} />
          <button style={S.btn} onClick={add}>Adicionar</button>
        </div>
      </div>
    </div>
  );
}

function NovaSenha({ onOk }) {
  const [s, setS] = useState("");
  const [msg, setMsg] = useState("");
  const salvar = async () => {
    if (s.length < 6) return setMsg("Use pelo menos 6 caracteres.");
    const r = await sb.auth.updateUser({ password: s });
    if (r.error) setMsg(r.error.message); else onOk();
  };
  return (
    <div style={{ ...S.page, display: "grid", placeItems: "center" }}>
      <div style={{ ...S.card, width: 340 }}>
        <h2 style={{ color: C.or, marginTop: 0 }}>Nova senha</h2>
        <input style={S.in} type="password" placeholder="Digite a nova senha" value={s} onChange={(e) => setS(e.target.value)} />
        <button style={{ ...S.btn, width: "100%" }} onClick={salvar}>Salvar nova senha</button>
        {msg && <p style={{ color: C.mut, fontSize: 13 }}>{msg}</p>}
      </div>
    </div>
  );
}

function Painel({ negocios, vend, pend, perfil, metas, load }) {
  const [vf, setVf] = useState("todos");
  const [per, setPer] = useState("mes");
  const agora = new Date();
  const ini = per === "mes" ? new Date(agora.getFullYear(), agora.getMonth(), 1) : per === "90" ? new Date(Date.now() - 90 * 864e5) : new Date(0);
  const noPer = (n) => n.fechado_em && new Date(n.fechado_em) >= ini;
  const dados = (base) => {
    const abertos = base.filter((n) => n.status === "aberto");
    const ganhos = base.filter((n) => n.status === "ganho" && noPer(n));
    const perdidos = base.filter((n) => n.status === "perdido" && noPer(n));
    const fin = ganhos.length + perdidos.length;
    return { abertos, ganhos, perdidos, conv: fin ? Math.round((100 * ganhos.length) / fin) : 0 };
  };
  const base = negocios.filter((n) => vf === "todos" || n.owner === vf);
  const d = dados(base);
  const parados = d.abertos.filter((n) => parado(n, pend));
  const mesAtual = hojeStr().slice(0, 7);
  const prevMes = d.abertos.filter((n) => n.data_prevista && n.data_prevista.slice(0, 7) === mesAtual);
  const pond = (l) => l.reduce((s, n) => s + (Number(n.preco || 0) * probEf(n)) / 100, 0);
  const origens = {};
  base.forEach((n) => {
    const o = n.origem || "Sem origem";
    origens[o] = origens[o] || { t: 0, g: 0, p: 0, v: 0 };
    origens[o].t++;
    if (n.status === "ganho") { origens[o].g++; origens[o].v += Number(n.preco || 0); }
    if (n.status === "perdido") origens[o].p++;
  });
  const listaOrig = Object.entries(origens).sort((a, b) => b[1].t - a[1].t);
  const atrasadas = pend.filter((x) => x.vencimento && x.vencimento < hojeStr()).length;
  const max = Math.max(1, ...ETAPAS.map((e) => soma(d.abertos.filter((n) => n.etapa === e))));
  const motivos = {};
  d.perdidos.forEach((n) => { const m = (n.motivo_perda || "Sem motivo").trim().toLowerCase(); motivos[m] = (motivos[m] || 0) + 1; });
  const topMotivos = Object.entries(motivos).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const donos = [...new Set(negocios.map((n) => n.owner).filter(Boolean))];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select style={{ ...S.in, width: 200, marginBottom: 0 }} value={vf} onChange={(e) => setVf(e.target.value)}>
          <option value="todos">Todos os vendedores</option>
          {vend.map((x) => <option key={x.id} value={x.id}>{x.id === perfil.id ? "Eu" : x.nome || x.email}</option>)}
        </select>
        <select style={{ ...S.in, width: 200, marginBottom: 0 }} value={per} onChange={(e) => setPer(e.target.value)}>
          <option value="mes">Este mês</option><option value="90">Últimos 90 dias</option><option value="tudo">Todo o período</option>
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 12 }}>
        <Kpi t="Em aberto" v={brl(soma(d.abertos))} s={`${d.abertos.length} negócios`} />
        <Kpi t="Ganhos no período" v={brl(soma(d.ganhos))} s={`${d.ganhos.length} negócios`} cor="#3ecf6e" />
        <Kpi t="Perdidos no período" v={brl(soma(d.perdidos))} s={`${d.perdidos.length} negócios`} cor="#e5484d" />
        <Kpi t="Taxa de conversão" v={`${d.conv}%`} s="ganhos ÷ (ganhos + perdidos)" />
        <Kpi t="Ticket médio" v={brl(d.ganhos.length ? soma(d.ganhos) / d.ganhos.length : 0)} s="dos ganhos" />
        <Kpi t="Previsto p/ fechar este mês" v={brl(soma(prevMes))} s={`${prevMes.length} negócios · ponderado ${brl(pond(prevMes))}`} />
        <Kpi t="Receita ponderada (funil)" v={brl(pond(d.abertos))} s="valor × probabilidade" />
        <Kpi t="Negócios parados" v={parados.length} s="7+ dias sem movimento ou atividade atrasada" cor={parados.length ? "#e5484d" : C.tx} />
        <Kpi t="Atividades atrasadas" v={atrasadas} s={perfil.role === "admin" ? "de toda a equipe" : "suas"} cor={atrasadas ? "#e5484d" : C.tx} />
      </div>
      <MetasCard negocios={negocios} vend={vend} metas={metas} perfil={perfil} reload={load} />
      <div style={S.card}>
        <b>Funil (em aberto)</b>
        {ETAPAS.map((e) => {
          const l = d.abertos.filter((n) => n.etapa === e);
          return (
            <div key={e} style={{ margin: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{e} · {l.length}</span><span style={{ color: C.or }}>{brl(soma(l))}</span></div>
              <div style={{ background: C.bg, borderRadius: 6, height: 10 }}><div style={{ background: C.or, width: `${(100 * soma(l)) / max}%`, height: 10, borderRadius: 6 }} /></div>
            </div>
          );
        })}
      </div>
      <div style={S.card}>
        <b>Por vendedor</b>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 6 }}>
            <thead><tr style={{ color: C.mut, textAlign: "left" }}><th>Vendedor</th><th>Em aberto</th><th>Ganhos</th><th>Perdidos</th><th>Conv.</th></tr></thead>
            <tbody>
              {donos.map((id) => { const x = dados(negocios.filter((n) => n.owner === id)); return (
                <tr key={id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: 6 }}>{nomeDe(vend, id)}</td>
                  <td>{x.abertos.length} · {brl(soma(x.abertos))}</td><td>{x.ganhos.length} · {brl(soma(x.ganhos))}</td>
                  <td>{x.perdidos.length}</td><td>{x.conv}%</td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={S.card}>
        <b>Origem dos leads</b>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 6 }}>
            <thead><tr style={{ color: C.mut, textAlign: "left" }}><th>Origem</th><th>Negócios</th><th>Ganhos</th><th>Valor ganho</th><th>Conv.</th></tr></thead>
            <tbody>
              {listaOrig.map(([o, x]) => (
                <tr key={o} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: 6 }}>{o}</td><td>{x.t}</td><td>{x.g}</td><td>{brl(x.v)}</td>
                  <td>{x.g + x.p ? Math.round((100 * x.g) / (x.g + x.p)) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {topMotivos.length > 0 && (
        <div style={S.card}>
          <b>Principais motivos de perda</b>
          {topMotivos.map(([m, q]) => <div key={m} style={{ padding: "4px 0" }}>{q}× <span style={{ color: C.mut }}>{m}</span></div>)}
        </div>
      )}
    </div>
  );
}

function Perfil({ perfil, recarrega }) {
  const [f, setF] = useState({ nome: perfil.nome || "", whatsapp: perfil.whatsapp || "" });
  const [ok, setOk] = useState(false);
  const salvar = async () => {
    const r = await sb.rpc("atualizar_meu_perfil", { p_nome: f.nome, p_whatsapp: f.whatsapp });
    if (r.error) return alert(r.error.message);
    await recarrega(); setOk(true);
  };
  return (
    <div style={{ ...S.card, maxWidth: 420 }}>
      <b>Meu perfil</b>
      <input style={{ ...S.in, marginTop: 8 }} placeholder="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
      <input style={S.in} placeholder="Seu WhatsApp, ex.: (19) 99999-9999" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
      <button style={S.btn} onClick={salvar}>Salvar</button> {ok && <span style={{ color: C.mut }}>Salvo!</span>}
    </div>
  );
}

function Negocios({ negocios, clientes, vend, pend, perfil, abrir, load }) {
  const [filtro, setFiltro] = useState("aberto");
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState("");
  const [vf, setVf] = useState("todos");
  const [soParados, setSoParados] = useState(false);
  const lista = negocios.filter((n) =>
    (filtro === "todos" || n.status === filtro) &&
    (vf === "todos" || n.owner === vf) &&
    (!busca || `${n.titulo} ${n.clientes?.nome || ""}`.toLowerCase().includes(busca.toLowerCase())) &&
    (!soParados || parado(n, pend)));
  const [pedir, setPedir] = useState(null);
  const temProx = (n) => pend.some((x) => x.negocio_id === n.id && (!x.vencimento || x.vencimento >= hojeStr()));
  const efetua = async (n, etapa) => {
    await sb.from("negocios").update({ etapa }).eq("id", n.id);
    await sb.from("historico").insert({ negocio_id: n.id, texto: `Movido para ${etapa}` });
    load();
  };
  const mover = async (n, etapa) => {
    if (!etapa || etapa === n.etapa) return;
    if (!temProx(n)) return setPedir({ n, etapa });
    efetua(n, etapa);
  };
  const card = (n) => {
    const i = ETAPAS.indexOf(n.etapa);
    const inf = infoNeg(n, pend);
    const p = parado(n, pend);
    return (
      <div key={n.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", n.id)} onClick={() => abrir(n.id)}
        style={{ ...S.card, marginBottom: 8, padding: 10, cursor: "pointer", background: p ? "#2a1a1c" : C.card, borderColor: p ? "#7a2d31" : C.line }}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
          <b style={{ flex: 1 }}>{n.titulo}</b>
          <span style={{ background: p ? "#d64545" : C.line, borderRadius: 6, padding: "1px 6px", fontSize: 11 }}>{inf.dias}d</span>
        </div>
        <div style={{ color: C.mut, fontSize: 13 }}>{n.clientes?.nome}</div>
        <div style={{ color: C.or, fontWeight: 700, margin: "4px 0" }}>{brl(n.preco)}</div>
        {n.data_prevista && <div style={{ fontSize: 12, color: n.data_prevista < hojeStr() ? "#ff8a8a" : C.mut }}>📅 {dataBR(n.data_prevista)} · {probEf(n)}%</div>}
        <div style={{ fontSize: 12, color: C.mut }}>
          {nomeDe(vend, n.owner)}
          {inf.atrasada ? <span style={{ color: "#ff8a8a" }}> · ⚠ atividade atrasada</span> : inf.semProx ? <span style={{ color: "#f5c542" }}> · ⚠ sem próxima atividade</span> : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <button style={S.ghost} disabled={i <= 0} onClick={(e) => { e.stopPropagation(); mover(n, ETAPAS[i - 1]); }}>‹</button>
          <button style={S.ghost} disabled={i >= ETAPAS.length - 1} onClick={(e) => { e.stopPropagation(); mover(n, ETAPAS[i + 1]); }}>›</button>
        </div>
      </div>
    );
  };
  const filtros = [["aberto", "Em andamento"], ["ganho", "Ganhos"], ["perdido", "Perdidos"], ["todos", "Todos"]];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <button style={S.btn} onClick={() => setNovo(true)}>+ Novo negócio</button>
        {filtros.map(([k, l]) => (
          <button key={k} style={{ ...S.ghost, borderColor: filtro === k ? C.or : C.line, color: filtro === k ? C.or : C.tx }} onClick={() => setFiltro(k)}>
            {l} ({k === "todos" ? negocios.length : negocios.filter((n) => n.status === k).length})
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...S.in, width: 220, marginBottom: 0 }} placeholder="Buscar negócio ou cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select style={{ ...S.in, width: 190, marginBottom: 0 }} value={vf} onChange={(e) => setVf(e.target.value)}>
          <option value="todos">Todos os vendedores</option>
          {vend.map((x) => <option key={x.id} value={x.id}>{x.id === perfil.id ? "Meus negócios" : x.nome || x.email}</option>)}
        </select>
        <label style={{ fontSize: 14 }}><input type="checkbox" checked={soParados} onChange={(e) => setSoParados(e.target.checked)} /> Só parados</label>
      </div>
      {filtro === "aberto" ? (
        <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(240px,1fr)", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {ETAPAS.map((et) => {
            const col = lista.filter((n) => n.etapa === et);
            return (
              <div key={et} onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { const n = negocios.find((x) => x.id === e.dataTransfer.getData("id")); if (n) mover(n, et); }}
                style={{ background: "#191c21", borderRadius: 10, padding: 8, minHeight: 240 }}>
                <div style={{ fontWeight: 700 }}>{et}</div>
                <div style={{ color: C.mut, fontSize: 12, marginBottom: 8 }}>{col.length} · {brl(soma(col))}</div>
                {col.map(card)}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <div style={{ color: C.mut, marginBottom: 8 }}>Total: {brl(soma(lista))}</div>
          {lista.map((n) => (
            <div key={n.id} style={{ ...S.card, cursor: "pointer", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }} onClick={() => abrir(n.id)}>
              <div style={{ flex: 1 }}>
                <b>{n.titulo}</b> <span style={{ color: C.mut }}>{n.clientes?.nome} · {nomeDe(vend, n.owner)}</span>
                {n.motivo_perda && <div style={{ color: C.mut, fontSize: 13 }}>Motivo: {n.motivo_perda}{n.motivo_obs ? ` — ${n.motivo_obs}` : ""}</div>}
              </div>
              <span style={{ color: C.or, fontWeight: 700 }}>{brl(n.preco)}</span>
              {n.fechado_em && <small style={{ color: C.mut }}>{new Date(n.fechado_em).toLocaleDateString("pt-BR")}</small>}
              <Badge s={n.status} />
            </div>
          ))}
          {!lista.length && <div style={{ color: C.mut }}>Nada por aqui ainda.</div>}
        </div>
      )}
      {pedir && <ProximaAtividade n={pedir.n} etapa={pedir.etapa} onCancel={() => setPedir(null)} onOk={() => { const x = pedir; setPedir(null); efetua(x.n, x.etapa); }} />}
      {novo && <NovoNegocio clientes={clientes} perfil={perfil} load={load} fechar={() => setNovo(false)} />}
    </div>
  );
}

function NovoNegocio({ clientes, perfil, load, fechar }) {
  const PRODUTOS = useContext(ProdutosCtx);
  const [dup, setDup] = useState([]);
  const [f, setF] = useState({ cliente_id: "", novo: "", titulo: "", produto: PRODUTOS[0].nome, preco: PRODUTOS[0].preco, origem: "", data_prevista: "" });
  const salvar = async (force = false) => {
    let cid = f.cliente_id;
    if (!cid && f.novo.trim()) {
      if (!force) { const d = await acharDuplicados(f.novo.trim()); if (d.length) { setDup(d); return; } }
      cid = (await sb.from("clientes").insert({ nome: f.novo.trim() }).select().single()).data?.id;
    }
    if (!cid) return alert("Escolha um cliente ou digite o nome de um novo.");
    const r = await sb.from("negocios").insert({ cliente_id: cid, titulo: f.titulo || f.produto, produto: f.produto, preco: f.preco, etapa: ETAPAS[0], origem: f.origem || null, data_prevista: f.data_prevista || null }).select().single();
    if (r.error) return alert(r.error.message);
    await sb.from("historico").insert({ negocio_id: r.data.id, texto: "Negócio criado" });
    load(); fechar();
  };
  return (
    <Modal>
      <div style={S.card}>
        <b>Novo negócio</b>
        <select style={{ ...S.in, marginTop: 8 }} value={f.cliente_id} onChange={(e) => setF({ ...f, cliente_id: e.target.value })}>
          <option value="">Escolher cliente existente…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.igreja ? ` — ${c.igreja}` : ""}</option>)}
        </select>
        {!f.cliente_id && <input style={S.in} placeholder="…ou nome do novo cliente" value={f.novo} onChange={(e) => setF({ ...f, novo: e.target.value })} />}
        <input style={S.in} placeholder="Título (opcional)" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
        <select style={S.in} value={f.produto} onChange={(e) => { const p = PRODUTOS.find((x) => x.nome === e.target.value); setF({ ...f, produto: p.nome, preco: p.preco }); }}>
          {PRODUTOS.map((p) => <option key={p.nome}>{p.nome}</option>)}
        </select>
        <input style={S.in} type="number" value={f.preco} onChange={(e) => setF({ ...f, preco: Number(e.target.value) })} />
        <select style={S.in} value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value })}>
          <option value="">Origem do lead…</option>
          {ORIGENS.map((o) => <option key={o}>{o}</option>)}
        </select>
        <label style={{ color: C.mut, fontSize: 13 }}>Previsão de fechamento
          <input style={S.in} type="date" value={f.data_prevista} onChange={(e) => setF({ ...f, data_prevista: e.target.value })} />
        </label>
        {dup.length > 0 && <AvisoDuplicado lista={dup} perfil={perfil} onUsar={(d) => { setF({ ...f, cliente_id: d.id, novo: "" }); setDup([]); }} onMesmoAssim={() => { setDup([]); salvar(true); }} />}
        <button style={S.btn} onClick={() => salvar()}>Criar</button> <button style={S.ghost} onClick={fechar}>Cancelar</button>
      </div>
    </Modal>
  );
}

function Negocio({ n, perfil, vend, load, fechar }) {
  const PRODUTOS = useContext(ProdutosCtx);
  const [t, setT] = useState([]);
  const [h, setH] = useState([]);
  const [props, setProps] = useState([]);
  const [novo, setNovo] = useState("");
  const [venc, setVenc] = useState("");
  const [prop, setProp] = useState(null);
  const c = { id: n.cliente_id, nome: n.clientes?.nome, igreja: n.clientes?.igreja };
  const carrega = async () => {
    setT((await sb.from("tarefas").select("*").eq("negocio_id", n.id).order("created_at")).data || []);
    setH((await sb.from("historico").select("*").eq("negocio_id", n.id).order("created_at", { ascending: false })).data || []);
    setProps((await sb.from("propostas").select("*").eq("negocio_id", n.id).order("created_at", { ascending: false })).data || []);
  };
  useEffect(() => { carrega(); }, [n.id]);
  const log = (texto) => sb.from("historico").insert({ negocio_id: n.id, texto });
  const salva = async (v) => { await sb.from("negocios").update(v).eq("id", n.id); load(); };
  const [pedirEt, setPedirEt] = useState(null);
  const [perdendo, setPerdendo] = useState(false);
  const vig = props[0];
  const prodN = PRODUTOS.find((x) => x.nome === n.produto);
  const minimo = prodN ? Number(prodN.preco) * (1 - Number(prodN.desconto_max ?? 10) / 100) : 0;
  let bloqGanho = "";
  if (perfil.role !== "admin") {
    if (vig?.status_aprov === "pendente") bloqGanho = "há desconto aguardando aprovação do admin.";
    else if (vig?.status_aprov === "recusada") bloqGanho = "o desconto foi recusado. Ajuste a proposta e envie de novo.";
    else if (prodN && Number(n.preco) < (vig?.status_aprov === "aprovada" ? Math.min(minimo, vig.preco - vig.desconto) : minimo) - 0.005) bloqGanho = "o valor está abaixo do mínimo permitido. Gere uma proposta e peça aprovação do desconto.";
  }
  const excluirNeg = async () => {
    if (n.status !== "aberto" && perfil.role !== "admin") return alert("Só o admin pode excluir negócios já encerrados.");
    if (!window.confirm("Excluir este negócio com suas atividades, propostas e histórico? Isso não pode ser desfeito.")) return;
    const r = await sb.from("negocios").delete().eq("id", n.id);
    if (r.error) return alert(r.error.message);
    await load(); fechar();
  };
  const moverEtapa = async (et) => { await sb.from("negocios").update({ etapa: et }).eq("id", n.id); await log(`Movido para ${et}`); load(); carrega(); };
  const encerrar = async (status, extra = {}) => {
    const r = await sb.from("negocios").update({ status, motivo_perda: extra.motivo || null, motivo_obs: extra.obs || null, fechado_em: new Date().toISOString() }).eq("id", n.id);
    if (r.error) return alert(r.error.message);
    await log(status === "ganho" ? "Marcado como GANHO" : `Marcado como PERDIDO: ${extra.motivo}${extra.obs ? " — " + extra.obs : ""}`);
    await load(); carrega();
  };
  const reabrir = async () => {
    await sb.from("negocios").update({ status: "aberto", motivo_perda: null, motivo_obs: null, fechado_em: null }).eq("id", n.id);
    await log("Negócio reaberto"); await load(); carrega();
  };
  const addT = async () => {
    if (!novo.trim()) return;
    await sb.from("tarefas").insert({ cliente_id: n.cliente_id, negocio_id: n.id, titulo: novo, vencimento: venc || null });
    setNovo(""); setVenc(""); carrega();
  };
  const toggle = async (x) => { await sb.from("tarefas").update({ feita: !x.feita }).eq("id", x.id); carrega(); };
  const del = async (x) => { await sb.from("tarefas").delete().eq("id", x.id); carrega(); };
  return (
    <Modal>
      <div style={S.card}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, flex: 1 }}>{n.titulo} <span style={{ color: C.mut, fontWeight: 400 }}>{c.nome}</span></h3>
          <Badge s={n.status} />
          <button style={S.ghost} onClick={fechar}>Fechar</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label>Valor <input key={n.preco} style={{ ...S.in, width: 140, marginBottom: 0 }} type="number" defaultValue={n.preco}
            onBlur={async (e) => { await sb.from("negocios").update({ preco: Number(e.target.value) }).eq("id", n.id); load(); }} /></label>
          {n.status === "aberto" ? (<>
            <select style={{ ...S.in, width: 190, marginBottom: 0 }} value={n.etapa}
              onChange={(e) => { const et = e.target.value; const tem = t.some((x) => !x.feita && (!x.vencimento || x.vencimento >= hojeStr())); if (!tem) return setPedirEt(et); moverEtapa(et); }}>
              {ETAPAS.map((x) => <option key={x}>{x}</option>)}
            </select>
            <button disabled={!!bloqGanho} title={bloqGanho} style={{ ...S.btn, background: "#2ea34f", opacity: bloqGanho ? 0.4 : 1 }} onClick={() => encerrar("ganho")}>✓ Ganho</button>
            <button style={{ ...S.btn, background: "#d64545" }} onClick={() => setPerdendo(true)}>✕ Perdido</button>
          </>) : <button style={S.ghost} onClick={reabrir}>Reabrir negócio</button>}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center", color: C.mut, fontSize: 13 }}>
          <label>Título{" "}
            <input key={n.titulo} style={{ ...S.in, width: 210, marginBottom: 0 }} defaultValue={n.titulo} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== n.titulo && salva({ titulo: e.target.value.trim() })} />
          </label>
          <label>Origem{" "}
            <select style={{ ...S.in, width: 160, marginBottom: 0 }} value={n.origem || ""} onChange={(e) => salva({ origem: e.target.value || null })}>
              <option value="">—</option>
              {ORIGENS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label>Previsão de fechamento{" "}
            <input key={n.data_prevista || "x"} style={{ ...S.in, width: 150, marginBottom: 0 }} type="date" defaultValue={n.data_prevista || ""} onChange={(e) => salva({ data_prevista: e.target.value || null })} />
          </label>
          <label>Probabilidade %{" "}
            <input key={n.probabilidade ?? "auto"} style={{ ...S.in, width: 90, marginBottom: 0 }} type="number" min="0" max="100" placeholder={String(PROB[n.etapa] ?? "")} defaultValue={n.probabilidade ?? ""}
              onBlur={(e) => salva({ probabilidade: e.target.value === "" ? null : Math.min(100, Math.max(0, Number(e.target.value))) })} />
          </label>
        </div>
        {perfil.role === "admin" && (
          <label style={{ display: "block", marginTop: 10, color: C.mut, fontSize: 13 }}>Responsável{" "}
            <select style={{ ...S.in, width: 200, marginBottom: 0 }} value={n.owner || ""}
              onChange={async (e) => { await sb.from("negocios").update({ owner: e.target.value }).eq("id", n.id); await log(`Responsável alterado para ${nomeDe(vend, e.target.value)}`); load(); carrega(); }}>
              {vend.map((x) => <option key={x.id} value={x.id}>{x.nome || x.email}</option>)}
            </select>
          </label>
        )}
        {bloqGanho && n.status === "aberto" && <p style={{ color: "#ff8a8a", fontSize: 13, margin: "8px 0 0" }}>Para marcar como ganho: {bloqGanho}</p>}
        {n.motivo_perda && <p style={{ color: C.mut }}>Motivo da perda: {n.motivo_perda}{n.motivo_obs ? ` — ${n.motivo_obs}` : ""}</p>}
      </div>

      <div style={S.card}>
        <b>Atividades</b>
        {t.map((x) => (
          <div key={x.id} style={{ display: "flex", gap: 8, padding: "6px 0", alignItems: "center" }}>
            <input type="checkbox" checked={x.feita} onChange={() => toggle(x)} />
            <span style={{ flex: 1, textDecoration: x.feita ? "line-through" : "none", color: x.feita ? C.mut : C.tx }}>
              {icone(x.tipo)} {x.titulo} {x.vencimento && <small style={{ color: C.or }}>({dataBR(x.vencimento)}{horaFmt(x)})</small>}
            </span>
            <button style={S.ghost} onClick={() => del(x)}>×</button>
          </div>
        ))}
        <AtividadeForm fixo={n} onSaved={carrega} />
      </div>

      <div style={S.card}>
        <b>Contatos de {c.nome}</b>
        <div style={{ marginTop: 6 }}><Contatos clienteId={n.cliente_id} /></div>
      </div>

      <div style={S.card}>
        <b>Propostas</b>
        {props.map((p) => (
          <div key={p.id} style={{ padding: "6px 0", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ flex: 1 }}>{p.produto} — {brl(p.preco - p.desconto)} <StatusAprov p={p} /> <small style={{ color: C.mut }}>{new Date(p.created_at).toLocaleDateString("pt-BR")}</small></span>
            <button style={S.ghost} onClick={() => setProp(p)}>Abrir</button>
          </div>
        ))}
        <button style={{ ...S.btn, marginTop: 8 }} onClick={() => setProp({ produto: n.produto || PRODUTOS[0].nome, preco: n.preco, desconto: 0, entrada: 0, parcelas: 1, prazo: "15 dias úteis", obs: "" })}>+ Nova proposta</button>
      </div>

      <div style={S.card}>
        <b>Histórico</b>
        {h.map((x) => (
          <div key={x.id} style={{ padding: "4px 0", fontSize: 14 }}>
            <small style={{ color: C.mut }}>{new Date(x.created_at).toLocaleString("pt-BR")}</small> · {x.texto}
          </div>
        ))}
      </div>
      <div style={{ textAlign: "right", marginBottom: 24 }}><button style={{ ...S.ghost, color: "#ff8a8a" }} onClick={excluirNeg}>Excluir negócio</button></div>
      {perdendo && <MotivoPerda onCancel={() => setPerdendo(false)} onOk={(m) => { setPerdendo(false); encerrar("perdido", m); }} />}
      {pedirEt && <ProximaAtividade n={n} etapa={pedirEt} onCancel={() => setPedirEt(null)} onOk={() => { const et = pedirEt; setPedirEt(null); moverEtapa(et); }} />}
      {prop && <Proposta c={c} p={prop} perfil={perfil} negocioId={n.id} fechar={() => { setProp(null); carrega(); load(); }} />}
    </Modal>
  );
}

const TIPOS = { tarefa: "📝 Tarefa", ligacao: "📞 Ligação", whatsapp: "💬 WhatsApp", visita: "📍 Visita", reuniao: "👥 Reunião" };
const icone = (t) => (TIPOS[t] || TIPOS.tarefa).split(" ")[0];
const horaFmt = (x) => (x.hora ? ` ${x.hora.slice(0, 5)}` : "");

function AtividadeForm({ negocios, fixo, onSaved }) {
  const [f, setF] = useState({ negocio_id: fixo?.id || "", tipo: "tarefa", titulo: "", vencimento: "", hora: "" });
  const salvar = async () => {
    const n = fixo || negocios.find((x) => x.id === f.negocio_id);
    if (!n) return alert("Escolha o negócio.");
    if (!f.titulo.trim()) return;
    const r = await sb.from("tarefas").insert({
      cliente_id: n.cliente_id, negocio_id: n.id, titulo: f.titulo, tipo: f.tipo,
      vencimento: f.vencimento || null, hora: f.hora || null, owner: n.owner || undefined,
    });
    if (r.error) return alert(r.error.message);
    setF({ ...f, titulo: "", vencimento: "", hora: "" });
    onSaved();
  };
  const w = { ...S.in, marginBottom: 0 };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {!fixo && (
        <select style={{ ...w, width: 220 }} value={f.negocio_id} onChange={(e) => setF({ ...f, negocio_id: e.target.value })}>
          <option value="">Negócio…</option>
          {negocios.filter((n) => n.status === "aberto").map((n) => <option key={n.id} value={n.id}>{n.titulo} — {n.clientes?.nome}</option>)}
        </select>
      )}
      <select style={{ ...w, width: 140 }} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
        {Object.entries(TIPOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <input style={{ ...w, flex: 1, minWidth: 160 }} placeholder="O que fazer?" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
      <input style={{ ...w, width: 145 }} type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} />
      <input style={{ ...w, width: 110 }} type="time" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} />
      <button style={S.btn} onClick={salvar}>+</button>
    </div>
  );
}

function Contatos({ clienteId }) {
  const [l, setL] = useState([]);
  const [f, setF] = useState({ nome: "", cargo: "", telefone: "", email: "" });
  const load = async () => setL((await sb.from("contatos").select("*").eq("cliente_id", clienteId).order("created_at")).data || []);
  useEffect(() => { load(); }, [clienteId]);
  const add = async () => {
    if (!f.nome.trim()) return;
    const r = await sb.from("contatos").insert({ ...f, cliente_id: clienteId });
    if (r.error) return alert(r.error.message);
    setF({ nome: "", cargo: "", telefone: "", email: "" }); load();
  };
  const del = async (c) => { await sb.from("contatos").delete().eq("id", c.id); load(); };
  const wa = (t) => { const d = (t || "").replace(/\D/g, ""); return d ? `https://wa.me/${d.startsWith("55") ? d : "55" + d}` : null; };
  const w = { ...S.in, marginBottom: 0, flex: 1, minWidth: 120 };
  return (
    <div>
      {l.map((c) => (
        <div key={c.id} style={{ display: "flex", gap: 8, padding: "6px 0", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}>
            <b>{c.nome}</b> {c.cargo && <span style={{ color: C.mut }}>· {c.cargo}</span>}
            {c.telefone && <> · <a style={{ color: C.or }} href={wa(c.telefone)} target="_blank" rel="noreferrer">{c.telefone}</a></>}
            {c.email && <> · <a style={{ color: C.mut }} href={`mailto:${c.email}`}>{c.email}</a></>}
          </span>
          <button style={S.ghost} onClick={() => del(c)}>×</button>
        </div>
      ))}
      {!l.length && <div style={{ color: C.mut, fontSize: 13 }}>Nenhum contato ainda.</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <input style={w} placeholder="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <input style={w} placeholder="Cargo (pastor, mídia…)" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} />
        <input style={w} placeholder="Telefone" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
        <input style={w} placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <button style={S.btn} onClick={add}>+</button>
      </div>
    </div>
  );
}

function Atividades({ abrir, negocios, vend, perfil }) {
  const [t, setT] = useState([]);
  const [vf, setVf] = useState("todos");
  const [novo, setNovo] = useState(false);
  const load = async () => setT((await sb.from("tarefas").select("*, clientes(nome), negocios(id, titulo)").eq("feita", false).order("vencimento").order("hora")).data || []);
  useEffect(() => { load(); }, []);
  const h = hojeStr();
  const l0 = t.filter((x) => vf === "todos" || x.owner === vf);
  const grupos = [
    ["Atrasadas", l0.filter((x) => x.vencimento && x.vencimento < h), "#e5484d"],
    ["Hoje", l0.filter((x) => x.vencimento === h), C.or],
    ["Futuras", l0.filter((x) => x.vencimento && x.vencimento > h), C.tx],
    ["Sem data", l0.filter((x) => !x.vencimento), C.mut],
  ];
  const concluir = async (x) => { await sb.from("tarefas").update({ feita: true }).eq("id", x.id); load(); };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button style={S.btn} onClick={() => setNovo(!novo)}>+ Nova atividade</button>
        {perfil.role === "admin" && (
          <select style={{ ...S.in, width: 200, marginBottom: 0 }} value={vf} onChange={(e) => setVf(e.target.value)}>
            <option value="todos">Toda a equipe</option>
            {vend.map((x) => <option key={x.id} value={x.id}>{x.id === perfil.id ? "Eu" : x.nome || x.email}</option>)}
          </select>
        )}
      </div>
      {novo && <div style={S.card}><AtividadeForm negocios={negocios} onSaved={load} /></div>}
      {grupos.map(([nome, l, cor]) => (
        <div key={nome} style={S.card}>
          <b style={{ color: cor }}>{nome} ({l.length})</b>
          {l.map((x) => (
            <div key={x.id} style={{ display: "flex", gap: 8, padding: "6px 0", alignItems: "center" }}>
              <input type="checkbox" onChange={() => concluir(x)} />
              <span style={{ flex: 1 }}>
                {icone(x.tipo)} {x.titulo}
                {x.negocios && <span style={{ color: C.or, cursor: "pointer" }} onClick={() => abrir(x.negocios.id)}> · {x.negocios.titulo}</span>}
                {x.clientes && <span style={{ color: C.mut }}> · {x.clientes.nome}</span>}
                {perfil.role === "admin" && <span style={{ color: C.mut }}> · {nomeDe(vend, x.owner)}</span>}
              </span>
              {x.vencimento && <small style={{ color: cor }}>{dataBR(x.vencimento)}{horaFmt(x)}</small>}
            </div>
          ))}
          {!l.length && <div style={{ color: C.mut, fontSize: 13 }}>Nenhuma.</div>}
        </div>
      ))}
    </div>
  );
}

function Clientes({ clientes, negocios, perfil, abrir, load, q, setQ }) {
  const [f, setF] = useState({ nome: "", igreja: "", telefone: "", cidade: "" });
  const [dup, setDup] = useState([]);
  const [abre, setAbre] = useState(null);
  const [edit, setEdit] = useState(null);
  const [mescla, setMescla] = useState(null);
  const admin = perfil.role === "admin";
  const add = async (force = false) => {
    if (!f.nome.trim()) return;
    if (!force) { const d = await acharDuplicados(f.nome.trim(), f.telefone, f.igreja); if (d.length) { setDup(d); return; } }
    const r = await sb.from("clientes").insert(f);
    if (r.error) return alert(r.error.message);
    setF({ nome: "", igreja: "", telefone: "", cidade: "" });
    setDup([]);
    load();
  };
  const salvarEdit = async () => {
    if (!edit.nome.trim()) return;
    const { id, nome, igreja, telefone, cidade } = edit;
    const r = await sb.from("clientes").update({ nome: nome.trim(), igreja, telefone, cidade }).eq("id", id);
    if (r.error) return alert(r.error.message);
    setEdit(null); load();
  };
  const excluir = async (c) => {
    const nn = negocios.filter((n) => n.cliente_id === c.id).length;
    if (nn) return alert(`Este cliente tem ${nn} negócio(s). Mescle com outro cliente ou exclua os negócios antes.`);
    if (!window.confirm(`Excluir o cliente “${c.nome}” e seus contatos?`)) return;
    const r = await sb.from("clientes").delete().eq("id", c.id);
    if (r.error) return alert(r.error.message);
    load();
  };
  const mesclar = async () => {
    if (!mescla.destino) return alert("Escolha o cliente que vai ficar.");
    if (!window.confirm("Mover negócios, atividades, propostas e contatos para o cliente escolhido e excluir este cadastro?")) return;
    const r = await sb.rpc("mesclar_clientes", { p_origem: mescla.origem, p_destino: mescla.destino });
    if (r.error) return alert(r.error.message);
    setMescla(null); load();
  };
  const lista = clientes.filter((c) => !q || norm(`${c.nome} ${c.igreja || ""} ${c.cidade || ""} ${c.telefone || ""}`).includes(norm(q)));
  const w = { ...S.in, marginBottom: 0, flex: 1, minWidth: 130 };
  return (
    <div>
      <div style={S.card}>
        <b>Novo cliente</b>
        {["nome", "igreja", "telefone", "cidade"].map((k) => (
          <input key={k} style={{ ...S.in, marginTop: 8 }} placeholder={k[0].toUpperCase() + k.slice(1)} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        ))}
        {dup.length > 0 && <AvisoDuplicado lista={dup} perfil={perfil} onMesmoAssim={() => add(true)} />}
        <button style={S.btn} onClick={() => add()}>Adicionar</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <input style={{ ...S.in, marginBottom: 0, maxWidth: 320 }} placeholder="Filtrar clientes…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button style={S.ghost} onClick={() => setQ("")}>Limpar</button>}
        <span style={{ color: C.mut, fontSize: 13 }}>{lista.length} cliente(s)</span>
      </div>
      {lista.map((c) => (
        <div key={c.id} style={S.card}>
          {edit?.id === c.id ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["nome", "igreja", "telefone", "cidade"].map((k) => (
                <input key={k} style={w} placeholder={k[0].toUpperCase() + k.slice(1)} value={edit[k] || ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
              ))}
              <button style={S.btn} onClick={salvarEdit}>Salvar</button> <button style={S.ghost} onClick={() => setEdit(null)}>Cancelar</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 200 }}>
                <b>{c.nome}</b> <span style={{ color: C.mut }}>{c.igreja} {c.cidade && `· ${c.cidade}`} {c.telefone && `· ${c.telefone}`}</span>
              </span>
              <button style={S.ghost} onClick={() => setAbre(abre === c.id ? null : c.id)}>{abre === c.id ? "Ocultar contatos" : "Contatos"}</button>
              <button style={S.ghost} onClick={() => setEdit({ id: c.id, nome: c.nome, igreja: c.igreja, telefone: c.telefone, cidade: c.cidade })}>Editar</button>
              <button style={S.ghost} onClick={() => setMescla({ origem: c.id, destino: "" })}>Mesclar</button>
              <button style={{ ...S.ghost, color: "#ff8a8a" }} onClick={() => excluir(c)}>Excluir</button>
            </div>
          )}
          {mescla?.origem === c.id && (
            <div style={{ marginTop: 10, padding: 10, border: `1px solid ${C.line}`, borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: C.mut, marginBottom: 6 }}>Mesclar “{c.nome}” em qual cliente? Este cadastro será excluído e tudo vai para o escolhido.</div>
              <select style={S.in} value={mescla.destino} onChange={(e) => setMescla({ ...mescla, destino: e.target.value })}>
                <option value="">Cliente que vai ficar…</option>
                {clientes.filter((x) => x.id !== c.id && (admin || x.owner === perfil.id)).map((x) => <option key={x.id} value={x.id}>{x.nome}{x.igreja ? ` — ${x.igreja}` : ""}</option>)}
              </select>
              <button style={S.btn} onClick={mesclar}>Mesclar</button> <button style={S.ghost} onClick={() => setMescla(null)}>Cancelar</button>
            </div>
          )}
          <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {negocios.filter((n) => n.cliente_id === c.id).map((n) => (
              <span key={n.id} style={{ cursor: "pointer" }} onClick={() => abrir(n.id)}><Badge s={n.status} /> {n.titulo} · {brl(n.preco)}</span>
            ))}
          </div>
          {abre === c.id && <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}><Contatos clienteId={c.id} /></div>}
        </div>
      ))}
    </div>
  );
}

function Proposta({ c, p: inicial, fechar, perfil, negocioId }) {
  const PRODUTOS = useContext(ProdutosCtx);
  const [p, setP] = useState(inicial);
  const ref = useRef();
  const set = (k, num) => (e) => setP({ ...p, [k]: num ? Number(e.target.value) : e.target.value });
  const total = Number(p.preco) - Number(p.desconto || 0);
  const saldo = total - Number(p.entrada || 0);
  const parc = saldo / (p.parcelas || 1);
  const desc = PRODUTOS.find((x) => x.nome === p.produto)?.descricao || "";

  const pr = PRODUTOS.find((x) => x.nome === p.produto);
  const tabela = Number(pr?.preco ?? p.preco);
  const maxPct = Number(pr?.desconto_max ?? 10);
  const piso = tabela * (1 - maxPct / 100);
  const dentro = total >= piso - 0.005;
  const descPct = tabela > 0 ? Math.round(1000 * (1 - total / tabela)) / 10 : 0;
  const [snap, setSnap] = useState(() => (p.id ? chaveProp(p) : ""));
  const mudou = chaveProp(p) !== snap;
  const bloqueado = !dentro && (mudou || !p.id || p.status_aprov !== "aprovada");
  const statusMsg = dentro ? "" : (mudou || !p.id) ? "salve para enviar para aprovação" : p.status_aprov === "aprovada" ? "✓ aprovada pelo admin" : p.status_aprov === "recusada" ? `✕ recusada${p.obs_aprov ? ": " + p.obs_aprov : ""}` : "⏳ aguardando aprovação do admin";
  const escolhe = (e) => {
    const pr = PRODUTOS.find((x) => x.nome === e.target.value);
    setP({ ...p, produto: pr.nome, preco: pr.preco });
  };
  const salvar = async () => {
    const { nova, id, created_at, negocio_id, status_aprov, preco_tabela, desconto_pct, aprovado_por, aprovado_em, obs_aprov, autor, ...dados } = p;
    let rowId = p.id;
    if (rowId) { const r = await sb.from("propostas").update(dados).eq("id", rowId); if (r.error) return alert(r.error.message); }
    else { const r = await sb.from("propostas").insert({ ...dados, cliente_id: c.id, negocio_id: negocioId }).select().single(); if (r.error) return alert(r.error.message); rowId = r.data.id; }
    const r2 = await sb.from("propostas").select("*").eq("id", rowId).single();
    if (r2.data) {
      if (negocioId && ["ok", "aprovada"].includes(r2.data.status_aprov)) await sb.from("negocios").update({ preco: total, produto: p.produto }).eq("id", negocioId);
      const novo = !p.id || chaveProp(r2.data) !== snap;
      setP(r2.data); setSnap(chaveProp(r2.data));
      if (r2.data.status_aprov === "pendente" && novo) {
        if (negocioId) await sb.from("historico").insert({ negocio_id: negocioId, texto: `Desconto de ${r2.data.desconto_pct}% enviado para aprovação` });
        alert("Desconto acima do limite: a proposta foi enviada para aprovação do admin.");
      }
    }
  };
  const canvas = () => html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff" });
  const png = async () => {
    const cv = await canvas();
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png"); a.download = `Proposta-CabinCraft-${c.nome}.png`; a.click();
  };
  const nomeArq = `Proposta-CabinCraft-${c.nome}.pdf`;
  const gerarPdf = async () => {
    const cv = await canvas();
    const w = 210, h = (cv.height * w) / cv.width;
    const d = new jsPDF({ unit: "mm", format: [w, Math.max(h, 297)] });
    d.addImage(cv.toDataURL("image/png"), "PNG", 0, 0, w, h);
    return d;
  };
  const pdf = async () => (await gerarPdf()).save(nomeArq);
  const [contatos, setContatos] = useState([]);
  const [tel, setTel] = useState("");
  useEffect(() => {
    sb.from("contatos").select("nome, cargo, telefone").eq("cliente_id", c.id).then(({ data }) => {
      const l = (data || []).filter((x) => x.telefone);
      setContatos(l); if (l[0]) setTel(l[0].telefone);
    });
  }, []);
  const enviarWhats = async () => {
    const digitos = tel.replace(/\D/g, "");
    if (digitos.length < 10) return alert("Informe o telefone do contato (com DDD).");
    await salvar();
    const contato = contatos.find((x) => x.telefone === tel);
    const primeiro = contato?.nome?.split(" ")[0];
    const linhas = [
      `Olá${primeiro ? ", " + primeiro : ""}! Segue a proposta da CabinCraft para ${c.igreja || c.nome}:`,
      "", `*${p.produto}*`, `Total: ${brl(total)}`,
      Number(p.entrada) > 0 || p.parcelas > 1 ? `Entrada de ${brl(p.entrada || 0)} + saldo em ${p.parcelas}x de ${brl(parc)}` : null,
      `Prazo: ${p.prazo}`, "", "Qualquer dúvida, estou à disposição!", perfil.nome || "",
    ].filter((x) => x !== null);
    const texto = linhas.join("\n");
    const d = await gerarPdf();
    const arq = new File([d.output("blob")], nomeArq, { type: "application/pdf" });
    const registra = () => negocioId && sb.from("historico").insert({ negocio_id: negocioId, texto: "Proposta enviada por WhatsApp" });
    if (navigator.canShare?.({ files: [arq] })) {
      try { await navigator.share({ files: [arq], text: texto }); registra(); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    d.save(nomeArq);
    window.open(`https://wa.me/${digitos.startsWith("55") ? digitos : "55" + digitos}?text=${encodeURIComponent(texto)}`, "_blank");
    registra();
    alert("PDF baixado. No WhatsApp, anexe o arquivo à conversa que abriu.");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", overflow: "auto", padding: 16, zIndex: 10 }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={S.card}>
          <select style={S.in} value={p.produto} onChange={escolhe}>
            {PRODUTOS.map((x) => <option key={x.nome}>{x.nome}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
            <label>Preço (editável)<input style={S.in} type="number" value={p.preco} onChange={set("preco", true)} /></label>
            <label>Desconto (R$)<input style={S.in} type="number" value={p.desconto} onChange={set("desconto", true)} /></label>
            <label>Entrada (R$)<input style={S.in} type="number" value={p.entrada} onChange={set("entrada", true)} /></label>
            <label>Parcelas<input style={S.in} type="number" min="1" value={p.parcelas} onChange={set("parcelas", true)} /></label>
          </div>
          <label>Prazo<input style={S.in} value={p.prazo} onChange={set("prazo")} /></label>
          <label>Observações (cor do carpete, frete, etc.)<textarea style={{ ...S.in, height: 60 }} value={p.obs || ""} onChange={set("obs")} /></label>
          <div style={{ fontSize: 13, margin: "0 0 8px", color: dentro ? C.mut : "#ff8a8a" }}>
            Tabela {brl(tabela)} · desconto {descPct}% (limite {maxPct}%) · piso {brl(piso)}{!dentro && ` — ${statusMsg}`}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 12px", alignItems: "center" }}>
            {contatos.length > 0 && (
              <select style={{ ...S.in, width: 240, marginBottom: 0 }} value={tel} onChange={(e) => setTel(e.target.value)}>
                {contatos.map((x, i) => <option key={i} value={x.telefone}>{x.nome}{x.cargo ? ` (${x.cargo})` : ""}</option>)}
              </select>
            )}
            <input style={{ ...S.in, width: 190, marginBottom: 0 }} placeholder="WhatsApp do contato" value={tel} onChange={(e) => setTel(e.target.value)} />
            <button disabled={bloqueado} style={{ ...S.btn, background: "#2ea34f", opacity: bloqueado ? 0.4 : 1 }} onClick={enviarWhats}>Enviar pelo WhatsApp</button>
          </div>
          <button style={S.btn} onClick={salvar}>Salvar</button>{" "}
          <button disabled={bloqueado} style={{ ...S.btn, opacity: bloqueado ? 0.4 : 1 }} onClick={pdf}>Baixar PDF</button>{" "}
          <button disabled={bloqueado} style={{ ...S.btn, opacity: bloqueado ? 0.4 : 1 }} onClick={png}>Baixar imagem</button>{" "}
          <button style={S.ghost} onClick={fechar}>Fechar</button>
        </div>

        {/* Área que vira PDF/imagem */}
        <div ref={ref} style={{ background: "#fff", color: "#222", padding: 40, fontFamily: "Georgia,serif" }}>
          <div style={{ borderBottom: `4px solid ${C.or}`, paddingBottom: 12, marginBottom: 24 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: C.or }}>CabinCraft</div>
            <div style={{ color: "#666" }}>Cabines acústicas artesanais para igrejas e ministérios</div>
          </div>
          <h2 style={{ margin: "0 0 4px" }}>Proposta Comercial</h2>
          <p style={{ color: "#666", marginTop: 0 }}>
            Emitida em {new Date().toLocaleDateString("pt-BR")} · Para: <b>{c.nome}</b>{c.igreja && ` — ${c.igreja}`}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", margin: "20px 0" }}>
            <thead><tr style={{ background: "#f4f1ec", textAlign: "left" }}>
              <th style={{ padding: 10 }}>Modelo</th><th style={{ padding: 10 }}>Descrição</th><th style={{ padding: 10, textAlign: "right" }}>Valor</th>
            </tr></thead>
            <tbody><tr>
              <td style={{ padding: 10, borderBottom: "1px solid #ddd" }}>{p.produto}</td>
              <td style={{ padding: 10, borderBottom: "1px solid #ddd" }}>{desc}</td>
              <td style={{ padding: 10, borderBottom: "1px solid #ddd", textAlign: "right" }}>{brl(p.preco)}</td>
            </tr></tbody>
          </table>
          <div style={{ textAlign: "right", lineHeight: 1.8 }}>
            {Number(p.desconto) > 0 && <div>Desconto: −{brl(p.desconto)}</div>}
            <div style={{ fontSize: 22, fontWeight: 800, color: C.or }}>Total: {brl(total)}</div>
            {Number(p.entrada) > 0 && <div>Entrada: {brl(p.entrada)}</div>}
            {p.parcelas > 1 || Number(p.entrada) > 0 ? <div>Saldo em {p.parcelas}x de {brl(parc)}</div> : null}
          </div>
          <h4 style={{ marginBottom: 6 }}>Inclui</h4>
          <div style={{ fontSize: 14, color: "#444" }}>
            Madeirite naval plastificado, Pinus tratado, feltro acústico 10mm, lã de rocha 32kg/m³, revestimento em carpete, ventilação silenciosa embutida,
            2 passagens de cabo e iluminação LED. Personalização de cores e piso sob consulta.
          </div>
          <h4 style={{ marginBottom: 6 }}>Prazos e entrega</h4>
          <div style={{ fontSize: 14, color: "#444" }}>Produção: {p.prazo}. Frete a combinar. Instalação pela equipe técnica.</div>
          {p.obs && <><h4 style={{ marginBottom: 6 }}>Observações</h4><div style={{ fontSize: 14, color: "#444", whiteSpace: "pre-wrap" }}>{p.obs}</div></>}
          <div style={{ marginTop: 30, fontSize: 13, color: "#666", borderTop: "1px solid #ddd", paddingTop: 10 }}>
            {perfil.nome}{perfil.whatsapp && ` · WhatsApp ${perfil.whatsapp}`} · Instagram @cabincraftbr
          </div>
        </div>
      </div>
    </div>
  );
}
