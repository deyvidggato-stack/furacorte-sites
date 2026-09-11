import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Headphones, MessageCircle, Send, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

const TOKEN_KEY = "me_support_chat_token";

type Mode = "start" | "login";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("start");
  const [token, setToken] = useState(() => typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) || "" : "");
  const [form, setForm] = useState({ username: "", password: "", name: "", email: "", phone: "" });
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const utils = trpc.useUtils();
  const start = trpc.chat.start.useMutation({
    onSuccess: result => {
      localStorage.setItem(TOKEN_KEY, result.publicToken);
      setFeedback("Cadastro realizado com sucesso! Atendimento iniciado.");
      setToken(result.publicToken);
    },
  });
  const login = trpc.chat.login.useMutation({ onSuccess: result => { localStorage.setItem(TOKEN_KEY, result.publicToken); setFeedback(""); setToken(result.publicToken); } });
  const conversationQuery = trpc.chat.conversation.useQuery({ publicToken: token }, { enabled: Boolean(token), refetchInterval: 3500 });
  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      setBody("");
      setFeedback("");
      utils.chat.conversation.invalidate({ publicToken: token });
    },
    onError: error => setFeedback(error.message || "Não foi possível enviar a mensagem. Tente novamente."),
  });
  const conversation = conversationQuery.data;

  useEffect(() => {
    if (conversationQuery.error && token) {
      localStorage.removeItem(TOKEN_KEY);
      setToken("");
      setMode("login");
      setFeedback("Sua sessão do atendimento expirou. Entre novamente para continuar.");
    }
  }, [conversationQuery.error, token]);

  useEffect(() => {
    if (conversation?.visitor?.name) setForm(current => ({ ...current, name: conversation.visitor.name, email: conversation.visitor.email || "", phone: conversation.visitor.phone || "", username: conversation.visitor.username }));
  }, [conversation?.visitor?.name, conversation?.visitor?.email, conversation?.visitor?.phone, conversation?.visitor?.username]);

  const submitAccess = (event: FormEvent) => {
    event.preventDefault();
    setFeedback("");
    if (mode === "login") login.mutate({ username: form.username.trim(), password: form.password });
    else start.mutate({ username: form.username.trim(), password: form.password, name: form.name.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined });
  };
  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || !conversation || send.isPending || conversation.conversation.status === "closed") return;
    setFeedback("");
    send.mutate({ publicToken: token, conversationId: conversation.conversation.id, body: text });
  };

  return <>
    {open && <section className="support-chat" aria-label="Chat de suporte">
      <header className="support-chat-head"><div><Headphones size={18} /><strong>Suporte M&E</strong><small>Atendimento online</small></div><button onClick={() => setOpen(false)} aria-label="Fechar chat"><X size={18} /></button></header>
      {!token ? <form className="support-start" onSubmit={submitAccess}><div className="support-welcome"><MessageCircle size={28} /><h3>{mode === "login" ? "Entrar no suporte" : "Fale com a nossa equipe"}</h3><p>{mode === "login" ? "Entre para continuar sua conversa com a equipe." : "Crie seu acesso para iniciar o atendimento e acompanhar as mensagens."}</p></div><label>Usuário<input required minLength={3} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Crie um usuário" /></label><label>Senha<input required minLength={6} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo de 6 caracteres" /></label>{mode === "start" && <><label>Nome completo<input required minLength={2} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seu nome real" /></label><label>WhatsApp <span>(opcional)</span><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(15) 99999-9999" /></label><label>E-mail <span>(opcional)</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="voce@email.com" /></label></>}{(start.error || login.error || feedback) && <div className="chat-form-error">{feedback || start.error?.message || login.error?.message || "Não foi possível entrar."}</div>}<button className="button button-yellow" disabled={start.isPending || login.isPending}>{mode === "login" ? "Entrar na conversa" : "Criar acesso e iniciar"} <ArrowLeft size={16} /></button><button type="button" className="chat-mode-toggle" onClick={() => setMode(mode === "start" ? "login" : "start")}>{mode === "start" ? "Já tenho cadastro" : "Criar novo acesso"}</button></form> : <><div className="support-status"><span className="online-dot" /> {conversation?.conversation.status === "closed" ? "Atendimento encerrado" : conversation?.conversation.assignedUsername ? `Atendido por ${conversation.conversation.assignedUsername}` : "Aguardando nossa equipe"}</div><div className="support-messages">{conversation?.messages?.length ? conversation.messages.map(message => <div className={message.senderType === "visitor" ? "support-message visitor" : "support-message agent"} key={message.id}><span>{message.senderName}</span><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></div>) : <div className="support-empty">Olá, {conversation?.visitor.name || form.name}! Escreva sua dúvida ou conte sobre sua obra.</div>}</div><form className="support-compose" onSubmit={submitMessage}>
  <input disabled={conversation?.conversation.status === "closed" || send.isPending} value={body} onChange={e => { setBody(e.target.value); if (feedback) setFeedback(""); }} placeholder="Digite sua mensagem..." autoComplete="off" />
  <button type="submit" disabled={!body.trim() || !conversation || conversation.conversation.status === "closed" || send.isPending} aria-label="Enviar mensagem" title={send.isPending ? "Enviando..." : "Enviar mensagem"}><Send size={17} /></button>
</form>
{feedback && <div className="chat-form-error support-send-error">{feedback}</div>}</>}
    </section>}
    <button className="support-float" onClick={() => setOpen(value => !value)} aria-label="Abrir suporte online"><MessageCircle size={27} /><span>Suporte online</span></button>
  </>;
}
