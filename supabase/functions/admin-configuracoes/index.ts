import { createClient } from "npm:@supabase/supabase-js@2";
const originExpected = () => Deno.env.get("TEU7VD_ALLOWED_ORIGIN") ?? "";
function reply(status: number, body: Record<string, unknown>, origin: string | null) {
  const h = new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"});
  if (origin && originExpected() && origin === originExpected()) h.set("Access-Control-Allow-Origin",origin);
  return new Response(JSON.stringify(body),{status,headers:h});
}
function secretKey(): string | null { try { const v=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}"); return typeof v.default==="string"?v.default:null; } catch { return null; } }
Deno.serve(async req => {
  const origin=req.headers.get("origin"), expected=originExpected();
  if(req.method==="OPTIONS") return !expected||origin!==expected?new Response(null,{status:403}):reply(204,{},origin);
  if(req.method!=="POST") return reply(405,{success:false,message:"Método não permitido."},origin);
  if(!expected||origin!==expected) return reply(403,{success:false,message:"Origem não autorizada."},origin);
  const token=/^Bearer\s+(.+)$/i.exec(req.headers.get("authorization")??"")?.[1];
  if(!token) return reply(401,{success:false,message:"Autenticação necessária."},origin);
  let b:Record<string,unknown>;
  try { const raw=await req.text(); if(new TextEncoder().encode(raw).byteLength>3000) throw new Error(); const x:unknown=JSON.parse(raw); if(!x||typeof x!=="object"||Array.isArray(x)) throw new Error(); b=x as Record<string,unknown>; } catch { return reply(400,{success:false,message:"Solicitação inválida."},origin); }
  const allowed=new Set(["mensagem_publica","mensagem_confirmacao","cor_primaria","cor_destaque","limite_alerta_vagas"]);
  if(Object.keys(b).some(k=>!allowed.has(k))) return reply(400,{success:false,message:"Campos não reconhecidos."},origin);
  if(typeof b.mensagem_publica!=="string"||b.mensagem_publica.trim().length<1||b.mensagem_publica.length>500||
    typeof b.mensagem_confirmacao!=="string"||b.mensagem_confirmacao.trim().length<1||b.mensagem_confirmacao.length>500||
    typeof b.cor_primaria!=="string"||!/^#[0-9a-f]{6}$/i.test(b.cor_primaria)||
    typeof b.cor_destaque!=="string"||!/^#[0-9a-f]{6}$/i.test(b.cor_destaque)||
    !Number.isInteger(b.limite_alerta_vagas)||Number(b.limite_alerta_vagas)<0||Number(b.limite_alerta_vagas)>10000)
    return reply(400,{success:false,message:"Revise mensagens, cores hexadecimais e limite de alerta."},origin);
  const url=Deno.env.get("SUPABASE_URL"), key=secretKey();
  if(!url||!key) return reply(503,{success:false,message:"Serviço administrativo não configurado."},origin);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authErr}=await db.auth.getUser(token);
  if(authErr||!auth.user) return reply(401,{success:false,message:"Sessão inválida ou expirada."},origin);
  const {data:p,error:pErr}=await db.from("perfis_admin").select("user_id,papel,ativo").eq("user_id",auth.user.id).maybeSingle();
  if(pErr) return reply(503,{success:false,message:"Não foi possível validar as permissões."},origin);
  if(!p||p.user_id!==auth.user.id||p.ativo!==true||p.papel!=="admin") return reply(403,{success:false,message:"Somente administrador ativo pode alterar configurações."},origin);
  const {data,error}=await db.rpc("teu7vd_atualizar_configuracoes_portal",{
    p_mensagem_publica:b.mensagem_publica,p_mensagem_confirmacao:b.mensagem_confirmacao,
    p_cor_primaria:b.cor_primaria,p_cor_destaque:b.cor_destaque,
    p_limite_alerta_vagas:b.limite_alerta_vagas,p_actor_id:auth.user.id
  });
  if(error||data!==true) return reply(400,{success:false,message:"Configurações não foram salvas."},origin);
  return reply(200,{success:true,message:"Configurações salvas e auditadas."},origin);
});
