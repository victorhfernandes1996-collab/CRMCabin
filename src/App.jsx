// CabinCraft CRM — npm i @supabase/supabase-js html2canvas jspdf
// .env: VITE_SUPABASE_URL=...  VITE_SUPABASE_ANON_KEY=...
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
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

export default function App() {
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
  return <Crm perfil={perfil} />;
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

function Crm({ perfil }) {
  const [aba, setAba] = useState("clientes");
  const [sel, setSel] = useState(null);
  return (
    <div style={S.page}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <b style={{ color: C.or, fontSize: 18 }}>CabinCraft CRM</b>
        <button style={S.ghost} onClick={() => { setAba("clientes"); setSel(null); }}>Clientes</button>
        {perfil.role === "admin" && <button style={S.ghost} onClick={() => setAba("admin")}>Usuários</button>}
        <span style={{ flex: 1 }} />
        <span style={{ color: C.mut, fontSize: 13 }}>{perfil.nome || perfil.email}</span>
        <button style={S.ghost} onClick={() => sb.auth.signOut()}>Sair</button>
      </div>
      {aba === "admin" ? <Admin /> : sel ? <Cliente c={sel} voltar={() => setSel(null)} /> : <Clientes abrir={setSel} />}
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

function Clientes({ abrir }) {
  const [l, setL] = useState([]);
  const [f, setF] = useState({ nome: "", igreja: "", telefone: "", cidade: "" });
  const load = async () => setL((await sb.from("clientes").select("*").order("created_at", { ascending: false })).data || []);
  useEffect(() => { load(); }, []);
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
      {l.map((c) => (
        <div key={c.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => abrir(c)}>
          <b>{c.nome}</b> <span style={{ color: C.mut }}>{c.igreja} {c.cidade && `· ${c.cidade}`}</span>
        </div>
      ))}
    </div>
  );
}

function Cliente({ c, voltar }) {
  const [t, setT] = useState([]);
  const [novo, setNovo] = useState("");
  const [venc, setVenc] = useState("");
  const [props, setProps] = useState([]);
  const [prop, setProp] = useState(null);
  const load = async () => {
    setT((await sb.from("tarefas").select("*").eq("cliente_id", c.id).order("created_at")).data || []);
    setProps((await sb.from("propostas").select("*").eq("cliente_id", c.id).order("created_at", { ascending: false })).data || []);
  };
  useEffect(() => { load(); }, []);
  const addT = async () => {
    if (!novo.trim()) return;
    await sb.from("tarefas").insert({ cliente_id: c.id, titulo: novo, vencimento: venc || null });
    setNovo(""); setVenc(""); load();
  };
  const toggle = async (x) => { await sb.from("tarefas").update({ feita: !x.feita }).eq("id", x.id); load(); };
  const del = async (x) => { await sb.from("tarefas").delete().eq("id", x.id); load(); };

  return (
    <div>
      <button style={S.ghost} onClick={voltar}>← Voltar</button>
      <h3>{c.nome} <span style={{ color: C.mut, fontWeight: 400 }}>{c.igreja}</span></h3>

      <div style={S.card}>
        <b>Tarefas</b>
        {t.map((x) => (
          <div key={x.id} style={{ display: "flex", gap: 8, padding: "6px 0", alignItems: "center" }}>
            <input type="checkbox" checked={x.feita} onChange={() => toggle(x)} />
            <span style={{ flex: 1, textDecoration: x.feita ? "line-through" : "none", color: x.feita ? C.mut : C.tx }}>
              {x.titulo} {x.vencimento && <small style={{ color: C.or }}>({new Date(x.vencimento + "T00:00").toLocaleDateString("pt-BR")})</small>}
            </span>
            <button style={S.ghost} onClick={() => del(x)}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input style={{ ...S.in, marginBottom: 0 }} placeholder="Nova tarefa" value={novo} onChange={(e) => setNovo(e.target.value)} />
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
        <button style={{ ...S.btn, marginTop: 8 }} onClick={() => setProp({ produto: PRODUTOS[0].nome, preco: PRODUTOS[0].preco, desconto: 0, entrada: 0, parcelas: 1, prazo: "15 dias úteis", obs: "", nova: true })}>
          + Nova proposta
        </button>
      </div>

      {prop && <Proposta c={c} p={prop} fechar={() => { setProp(null); load(); }} />}
    </div>
  );
}

function Proposta({ c, p: inicial, fechar }) {
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
    const { nova, id, created_at, ...dados } = p;
    if (p.id) await sb.from("propostas").update(dados).eq("id", p.id);
    else { const r = await sb.from("propostas").insert({ ...dados, cliente_id: c.id }).select().single(); if (r.data) setP(r.data); }
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
            WhatsApp (19) 98816-5943 · Instagram @cabincraftbr
          </div>
        </div>
      </div>
    </div>
  );
}
