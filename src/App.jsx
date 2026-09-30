// CabinCraft CRM — npm i @supabase/supabase-js html2canvas jspdf
// .env: VITE_SUPABASE_URL=...  VITE_SUPABASE_ANON_KEY=...
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configurado = Boolean(SB_URL && SB_KEY);
const sb = configurado ? createClient(SB_URL, SB_KEY) : null;
const PRODUTOS = [
  { nome: "Cabine 180º - Fixo", preco: 9900, desc: "Cabine 180º com piso fixo (instalação permanente)" },
  { nome: "Cabine 180º - Móvel", preco: 10800, desc: "Cabine 180º com piso móvel sobre rodas reforçadas" },
];
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
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const carregaPerfil = async () => {
    const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
    setPerfil(data);
  };
  useEffect(() => { if (session) carregaPerfil(); else setPerfil(null); }, [session]);

  if (session === undefined) return <div style={S.page}>Carregando…</div>;
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
  return (
    <div style={{ ...S.page, display: "grid", placeItems: "center" }}>
      <div style={{ ...S.card, width: 340 }}>
        <h2 style={{ color: C.or, marginTop: 0 }}>CabinCraft CRM</h2>
        {modo === "cadastro" && <input style={S.in} placeholder="Nome" value={f.nome} onChange={set("nome")} />}
        <input style={S.in} placeholder="E-mail" value={f.email} onChange={set("email")} />
        <input style={S.in} placeholder="Senha" type="password" value={f.senha} onChange={set("senha")} />
        <button style={{ ...S.btn, width: "100%" }} onClick={enviar}>{modo === "login" ? "Entrar" : "Solicitar acesso"}</button>
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

function Crm({ perfil, recarrega }) {
  const [aba, setAba] = useState("negocios");
  const [clientes, setClientes] = useState([]);
  const [negocios, setNegocios] = useState([]);
  const [aberto, setAberto] = useState(null);
  const [v, setV] = useState(0);
  const load = async () => {
    setClientes((await sb.from("clientes").select("*").order("nome")).data || []);
    setNegocios((await sb.from("negocios").select("*, clientes(nome, igreja)").order("created_at", { ascending: false })).data || []);
  };
  useEffect(() => { load(); }, []);
  const tabs = [["negocios", "Negócios"], ["clientes", "Clientes"], ["atividades", "Atividades"],
    ...(perfil.role === "admin" ? [["admin", "Usuários"]] : []), ["perfil", "Meu perfil"]];
  const neg = negocios.find((n) => n.id === aberto);
  return (
    <div style={S.page}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <b style={{ color: C.or, fontSize: 18 }}>CabinCraft CRM</b>
        {tabs.map(([k, l]) => (
          <button key={k} style={{ ...S.ghost, borderColor: aba === k ? C.or : C.line, color: aba === k ? C.or : C.tx }} onClick={() => setAba(k)}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ color: C.mut, fontSize: 13 }}>{perfil.nome || perfil.email}</span>
        <button style={S.ghost} onClick={() => sb.auth.signOut()}>Sair</button>
      </div>
      {!perfil.whatsapp && aba !== "perfil" && (
        <div style={{ ...S.card, borderColor: C.or }}>
          Preencha seu WhatsApp em <b style={{ color: C.or, cursor: "pointer" }} onClick={() => setAba("perfil")}>Meu perfil</b>. Ele aparece nas suas propostas.
        </div>
      )}
      {aba === "negocios" && <Negocios negocios={negocios} clientes={clientes} abrir={setAberto} load={load} />}
      {aba === "clientes" && <Clientes clientes={clientes} negocios={negocios} abrir={setAberto} load={load} />}
      {aba === "atividades" && <Atividades key={v} abrir={setAberto} />}
      {aba === "admin" && <Admin />}
      {aba === "perfil" && <Perfil perfil={perfil} recarrega={recarrega} />}
      {neg && <Negocio n={neg} perfil={perfil} load={load} fechar={() => { setAberto(null); setV(v + 1); }} />}
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

function Negocios({ negocios, clientes, abrir, load }) {
  const [filtro, setFiltro] = useState("aberto");
  const [novo, setNovo] = useState(false);
  const lista = negocios.filter((n) => filtro === "todos" || n.status === filtro);
  const mover = async (n, etapa) => {
    if (!etapa || etapa === n.etapa) return;
    await sb.from("negocios").update({ etapa }).eq("id", n.id);
    await sb.from("historico").insert({ negocio_id: n.id, texto: `Movido para ${etapa}` });
    load();
  };
  const card = (n) => {
    const i = ETAPAS.indexOf(n.etapa);
    return (
      <div key={n.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", n.id)} onClick={() => abrir(n.id)}
        style={{ ...S.card, marginBottom: 8, padding: 10, cursor: "pointer" }}>
        <b>{n.titulo}</b>
        <div style={{ color: C.mut, fontSize: 13 }}>{n.clientes?.nome}</div>
        <div style={{ color: C.or, fontWeight: 700, margin: "4px 0" }}>{brl(n.preco)}</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button style={S.ghost} disabled={i <= 0} onClick={(e) => { e.stopPropagation(); mover(n, ETAPAS[i - 1]); }}>‹</button>
          <button style={S.ghost} disabled={i >= ETAPAS.length - 1} onClick={(e) => { e.stopPropagation(); mover(n, ETAPAS[i + 1]); }}>›</button>
        </div>
      </div>
    );
  };
  const filtros = [["aberto", "Em andamento"], ["ganho", "Ganhos"], ["perdido", "Perdidos"], ["todos", "Todos"]];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button style={S.btn} onClick={() => setNovo(true)}>+ Novo negócio</button>
        {filtros.map(([k, l]) => (
          <button key={k} style={{ ...S.ghost, borderColor: filtro === k ? C.or : C.line, color: filtro === k ? C.or : C.tx }} onClick={() => setFiltro(k)}>
            {l} ({k === "todos" ? negocios.length : negocios.filter((n) => n.status === k).length})
          </button>
        ))}
      </div>
      {filtro === "aberto" ? (
        <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(230px,1fr)", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {ETAPAS.map((et) => {
            const col = lista.filter((n) => n.etapa === et);
            return (
              <div key={et} onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { const n = negocios.find((x) => x.id === e.dataTransfer.getData("id")); if (n) mover(n, et); }}
                style={{ background: "#191c21", borderRadius: 10, padding: 8, minHeight: 240 }}>
                <div style={{ fontWeight: 700 }}>{et}</div>
                <div style={{ color: C.mut, fontSize: 12, marginBottom: 8 }}>{col.length} · {brl(col.reduce((s, n) => s + Number(n.preco || 0), 0))}</div>
                {col.map(card)}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <div style={{ color: C.mut, marginBottom: 8 }}>Total: {brl(lista.reduce((s, n) => s + Number(n.preco || 0), 0))}</div>
          {lista.map((n) => (
            <div key={n.id} style={{ ...S.card, cursor: "pointer", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }} onClick={() => abrir(n.id)}>
              <div style={{ flex: 1 }}>
                <b>{n.titulo}</b> <span style={{ color: C.mut }}>{n.clientes?.nome}</span>
                {n.motivo_perda && <div style={{ color: C.mut, fontSize: 13 }}>Motivo: {n.motivo_perda}</div>}
              </div>
              <span style={{ color: C.or, fontWeight: 700 }}>{brl(n.preco)}</span>
              {n.fechado_em && <small style={{ color: C.mut }}>{new Date(n.fechado_em).toLocaleDateString("pt-BR")}</small>}
              <Badge s={n.status} />
            </div>
          ))}
          {!lista.length && <div style={{ color: C.mut }}>Nada por aqui ainda.</div>}
        </div>
      )}
      {novo && <NovoNegocio clientes={clientes} load={load} fechar={() => setNovo(false)} />}
    </div>
  );
}

function NovoNegocio({ clientes, load, fechar }) {
  const [f, setF] = useState({ cliente_id: "", novo: "", titulo: "", produto: PRODUTOS[0].nome, preco: PRODUTOS[0].preco });
  const salvar = async () => {
    let cid = f.cliente_id;
    if (!cid && f.novo.trim()) cid = (await sb.from("clientes").insert({ nome: f.novo.trim() }).select().single()).data?.id;
    if (!cid) return alert("Escolha um cliente ou digite o nome de um novo.");
    const r = await sb.from("negocios").insert({ cliente_id: cid, titulo: f.titulo || f.produto, produto: f.produto, preco: f.preco, etapa: ETAPAS[0] }).select().single();
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
        <button style={S.btn} onClick={salvar}>Criar</button> <button style={S.ghost} onClick={fechar}>Cancelar</button>
      </div>
    </Modal>
  );
}

function Negocio({ n, perfil, load, fechar }) {
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
  const encerrar = async (status) => {
    let motivo = null;
    if (status === "perdido") { motivo = window.prompt("Motivo da perda?"); if (motivo === null) return; }
    await sb.from("negocios").update({ status, motivo_perda: motivo, fechado_em: new Date().toISOString() }).eq("id", n.id);
    await log(status === "ganho" ? "Marcado como GANHO" : `Marcado como PERDIDO${motivo ? ": " + motivo : ""}`);
    await load(); carrega();
  };
  const reabrir = async () => {
    await sb.from("negocios").update({ status: "aberto", motivo_perda: null, fechado_em: null }).eq("id", n.id);
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
              onChange={async (e) => { await sb.from("negocios").update({ etapa: e.target.value }).eq("id", n.id); await log(`Movido para ${e.target.value}`); load(); carrega(); }}>
              {ETAPAS.map((x) => <option key={x}>{x}</option>)}
            </select>
            <button style={{ ...S.btn, background: "#2ea34f" }} onClick={() => encerrar("ganho")}>✓ Ganho</button>
            <button style={{ ...S.btn, background: "#d64545" }} onClick={() => encerrar("perdido")}>✕ Perdido</button>
          </>) : <button style={S.ghost} onClick={reabrir}>Reabrir negócio</button>}
        </div>
        {n.motivo_perda && <p style={{ color: C.mut }}>Motivo da perda: {n.motivo_perda}</p>}
      </div>

      <div style={S.card}>
        <b>Atividades</b>
        {t.map((x) => (
          <div key={x.id} style={{ display: "flex", gap: 8, padding: "6px 0", alignItems: "center" }}>
            <input type="checkbox" checked={x.feita} onChange={() => toggle(x)} />
            <span style={{ flex: 1, textDecoration: x.feita ? "line-through" : "none", color: x.feita ? C.mut : C.tx }}>
              {x.titulo} {x.vencimento && <small style={{ color: C.or }}>({dataBR(x.vencimento)})</small>}
            </span>
            <button style={S.ghost} onClick={() => del(x)}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input style={{ ...S.in, marginBottom: 0 }} placeholder="Nova atividade" value={novo} onChange={(e) => setNovo(e.target.value)} />
          <input style={{ ...S.in, marginBottom: 0, width: 150 }} type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
          <button style={S.btn} onClick={addT}>+</button>
        </div>
      </div>

      <div style={S.card}>
        <b>Propostas</b>
        {props.map((p) => (
          <div key={p.id} style={{ padding: "6px 0", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ flex: 1 }}>{p.produto} — {brl(p.preco - p.desconto)} <small style={{ color: C.mut }}>{new Date(p.created_at).toLocaleDateString("pt-BR")}</small></span>
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
      {prop && <Proposta c={c} p={prop} perfil={perfil} negocioId={n.id} fechar={() => { setProp(null); carrega(); load(); }} />}
    </Modal>
  );
}

function Atividades({ abrir }) {
  const [t, setT] = useState([]);
  const load = async () => setT((await sb.from("tarefas").select("*, clientes(nome), negocios(id, titulo)").eq("feita", false).order("vencimento")).data || []);
  useEffect(() => { load(); }, []);
  const h = hojeStr();
  const grupos = [
    ["Atrasadas", t.filter((x) => x.vencimento && x.vencimento < h), "#e5484d"],
    ["Hoje", t.filter((x) => x.vencimento === h), C.or],
    ["Futuras", t.filter((x) => x.vencimento && x.vencimento > h), C.tx],
    ["Sem data", t.filter((x) => !x.vencimento), C.mut],
  ];
  const concluir = async (x) => { await sb.from("tarefas").update({ feita: true }).eq("id", x.id); load(); };
  return (
    <div>
      {grupos.map(([nome, l, cor]) => (
        <div key={nome} style={S.card}>
          <b style={{ color: cor }}>{nome} ({l.length})</b>
          {l.map((x) => (
            <div key={x.id} style={{ display: "flex", gap: 8, padding: "6px 0", alignItems: "center" }}>
              <input type="checkbox" onChange={() => concluir(x)} />
              <span style={{ flex: 1 }}>
                {x.titulo}
                {x.negocios && <span style={{ color: C.or, cursor: "pointer" }} onClick={() => abrir(x.negocios.id)}> · {x.negocios.titulo}</span>}
                {x.clientes && <span style={{ color: C.mut }}> · {x.clientes.nome}</span>}
              </span>
              {x.vencimento && <small style={{ color: cor }}>{dataBR(x.vencimento)}</small>}
            </div>
          ))}
          {!l.length && <div style={{ color: C.mut, fontSize: 13 }}>Nenhuma.</div>}
        </div>
      ))}
    </div>
  );
}

function Clientes({ clientes, negocios, abrir, load }) {
  const [f, setF] = useState({ nome: "", igreja: "", telefone: "", cidade: "" });
  const add = async () => {
    if (!f.nome.trim()) return;
    await sb.from("clientes").insert(f);
    setF({ nome: "", igreja: "", telefone: "", cidade: "" });
    load();
  };
  return (
    <div>
      <div style={S.card}>
        <b>Novo cliente</b>
        {["nome", "igreja", "telefone", "cidade"].map((k) => (
          <input key={k} style={{ ...S.in, marginTop: 8 }} placeholder={k[0].toUpperCase() + k.slice(1)} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        ))}
        <button style={S.btn} onClick={add}>Adicionar</button>
      </div>
      {clientes.map((c) => (
        <div key={c.id} style={S.card}>
          <b>{c.nome}</b> <span style={{ color: C.mut }}>{c.igreja} {c.cidade && `· ${c.cidade}`} {c.telefone && `· ${c.telefone}`}</span>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {negocios.filter((n) => n.cliente_id === c.id).map((n) => (
              <span key={n.id} style={{ cursor: "pointer" }} onClick={() => abrir(n.id)}><Badge s={n.status} /> {n.titulo} · {brl(n.preco)}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Proposta({ c, p: inicial, fechar, perfil, negocioId }) {
  const [p, setP] = useState(inicial);
  const ref = useRef();
  const set = (k, num) => (e) => setP({ ...p, [k]: num ? Number(e.target.value) : e.target.value });
  const total = Number(p.preco) - Number(p.desconto || 0);
  const saldo = total - Number(p.entrada || 0);
  const parc = saldo / (p.parcelas || 1);
  const desc = PRODUTOS.find((x) => x.nome === p.produto)?.desc || "";

  const escolhe = (e) => {
    const pr = PRODUTOS.find((x) => x.nome === e.target.value);
    setP({ ...p, produto: pr.nome, preco: pr.preco });
  };
  const salvar = async () => {
    const { nova, id, created_at, negocio_id, ...dados } = p;
    if (p.id) await sb.from("propostas").update(dados).eq("id", p.id);
    if (negocioId) await sb.from("negocios").update({ preco: total, produto: p.produto }).eq("id", negocioId);
    if (!p.id) { const r = await sb.from("propostas").insert({ ...dados, cliente_id: c.id, negocio_id: negocioId }).select().single(); if (r.data) setP(r.data); }
  };
  const canvas = () => html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff" });
  const png = async () => {
    const cv = await canvas();
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png"); a.download = `Proposta-CabinCraft-${c.nome}.png`; a.click();
  };
  const pdf = async () => {
    const cv = await canvas();
    const w = 210, h = (cv.height * w) / cv.width;
    const d = new jsPDF({ unit: "mm", format: [w, Math.max(h, 297)] });
    d.addImage(cv.toDataURL("image/png"), "PNG", 0, 0, w, h);
    d.save(`Proposta-CabinCraft-${c.nome}.pdf`);
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
          <button style={S.btn} onClick={salvar}>Salvar</button>{" "}
          <button style={S.btn} onClick={pdf}>Baixar PDF</button>{" "}
          <button style={S.btn} onClick={png}>Baixar imagem</button>{" "}
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
