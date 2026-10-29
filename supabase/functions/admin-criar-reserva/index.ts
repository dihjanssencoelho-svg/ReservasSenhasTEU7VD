import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = () => Deno.env.get("TEU7VD_ALLOWED_ORIGIN") ?? "";
const headersFor = (origin: string | null) => {
  const h = new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"});
  if(origin && allowedOrigin() && origin===allowedOrigin()) h.set("Access-Control-Allow-Origin",origin);
  return h;
};
const respond = (status:number, body:Record<string,unknown>, origin:string|null) => new Response(JSON.stringify(body),{status,headers:headersFor(origin)});
function secretKey():string|null { try { const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}"); return typeof keys.default==="string"?keys.default:null; } catch { return null; } }

Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin"), allowed=allowedOrigin();
 if(req.method==="OPTIONS") return origin===allowed && allowed ? new Response(null,{status:204,headers:headersFor(origin)}) : new Response(null,{status:403});
 if(req.method!=="POST") return respond(405,{success:false,message:"Método não permitido."},origin);
 if(!allowed || origin!==allowed) return respond(403,{success:false,message:"Origem não autorizada."},origin);
 const match=/^Bearer\s+(.+)$/i.exec(req.headers.get("authorization")??"");
 if(!match) return respond(401,{success:false,message:"Autenticação necessária."},origin);
 let body:Record<string,unknown>;
 try { const raw=await req.text(); if(new TextEncoder().encode(raw).byteLength>5000) return respond(413,{success:false,message:"Solicitação muito grande."},origin); const parsed=JSON.parse(raw); if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)) throw new Error(); body=parsed; } catch { return respond(400,{success:false,message:"Solicitação inválida."},origin); }
 const fields=new Set(["gira_id","nome_completo","data_nascimento","telefone","email","primeira_vez","preferencial","tipo_preferencial","descricao_preferencial","retorno","medium_nome"]);
 if(Object.keys(body).some(k=>!fields.has(k))) return respond(400,{success:false,message:"Campos não reconhecidos."},origin);
 if(typeof body.gira_id!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.gira_id)) return respond(400,{success:false,message:"Selecione uma gira válida."},origin);
 const optionalString=(key:string,max:number)=> body[key]==null || body[key]==="" || (typeof body[key]==="string" && body[key].trim().length<=max);
 if(!optionalString("nome_completo",180)||!optionalString("telefone",32)||!optionalString("email",254)||!optionalString("primeira_vez",3)||!optionalString("tipo_preferencial",40)||!optionalString("descricao_preferencial",300)||!optionalString("retorno",3)||!optionalString("medium_nome",180)) return respond(400,{success:false,message:"Confira os campos informados."},origin);
 const dob=body.data_nascimento==null||body.data_nascimento===""?null:body.data_nascimento;
 if(dob!==null && (typeof dob!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(dob)||Number.isNaN(Date.parse(dob))||dob>new Date().toISOString().slice(0,10))) return respond(400,{success:false,message:"Data de nascimento inválida."},origin);
 if(body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) return respond(400,{success:false,message:"E-mail inválido."},origin);
 if(body.telefone && String(body.telefone).replace(/\D/g,"").length<10) return respond(400,{success:false,message:"Telefone inválido."},origin);
 if(body.primeira_vez && !["Sim","Não"].includes(String(body.primeira_vez))) return respond(400,{success:false,message:"Primeira vez inválido."},origin);
 if(body.retorno && !["Sim","Não"].includes(String(body.retorno))) return respond(400,{success:false,message:"Retorno inválido."},origin);
 if(body.preferencial!=null && typeof body.preferencial!=="boolean") return respond(400,{success:false,message:"Preferencial inválido."},origin);
 const url=Deno.env.get("SUPABASE_URL"), key=secretKey();
 if(!url||!key) return respond(503,{success:false,message:"Serviço administrativo não configurado."},origin);
 const trusted=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:userData,error:userError}=await trusted.auth.getUser(match[1]);
 if(userError||!userData.user) return respond(401,{success:false,message:"Sessão inválida ou expirada."},origin);
 const {data:profile,error:profileError}=await trusted.from("perfis_admin").select("user_id,papel,ativo").eq("user_id",userData.user.id).maybeSingle();
 if(profileError) return respond(503,{success:false,message:"Não foi possível validar as permissões."},origin);
 if(!profile||profile.user_id!==userData.user.id||profile.ativo!==true||profile.papel!=="admin") return respond(403,{success:false,message:"Apenas administrador ativo pode cadastrar reserva."},origin);
 const {data,error}=await trusted.rpc("teu7vd_criar_reserva_painel",{
  p_actor_id:userData.user.id,p_gira_id:body.gira_id,p_nome_completo:body.nome_completo||null,
  p_data_nascimento:dob,p_telefone:body.telefone||null,p_email:body.email||null,p_primeira_vez:body.primeira_vez||null,
  p_preferencial:body.preferencial===true,p_tipo_preferencial:body.tipo_preferencial||null,
  p_descricao_preferencial:body.descricao_preferencial||null,p_retorno:body.retorno||null,p_medium_nome:body.medium_nome||null
 });
 if(error||!data?.success) return respond(400,{success:false,message:"Cadastro não concluído. Verifique a capacidade da gira e os dados informados."},origin);
 return respond(200,data,origin);
});
