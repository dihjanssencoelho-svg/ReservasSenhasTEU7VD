import { createClient } from "npm:@supabase/supabase-js@2";
const expectedOrigin=()=>Deno.env.get("TEU7VD_ALLOWED_ORIGIN")??"";
function reply(status:number,body:Record<string,unknown>,origin:string|null){const h=new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"});if(origin&&expectedOrigin()&&origin===expectedOrigin())h.set("Access-Control-Allow-Origin",origin);return new Response(JSON.stringify(body),{status,headers:h});}
function secretKey():string|null{try{const v=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}");return typeof v.default==="string"?v.default:null;}catch{return null;}}
Deno.serve(async req=>{
 const origin=req.headers.get("origin"),expected=expectedOrigin();
 if(req.method==="OPTIONS")return !expected||origin!==expected?new Response(null,{status:403}):reply(204,{},origin);
 if(req.method!=="POST")return reply(405,{success:false,message:"Método não permitido."},origin);
 if(!expected||origin!==expected)return reply(403,{success:false,message:"Origem não autorizada."},origin);
 const token=/^Bearer\s+(.+)$/i.exec(req.headers.get("authorization")??"")?.[1];if(!token)return reply(401,{success:false,message:"Autenticação necessária."},origin);
 let b:Record<string,unknown>;
 try{const raw=await req.text();if(new TextEncoder().encode(raw).byteLength>6000000)throw new Error();const x:unknown=JSON.parse(raw);if(!x||typeof x!=="object"||Array.isArray(x))throw new Error();b=x as Record<string,unknown>;}catch{return reply(400,{success:false,message:"Arquivo de importação inválido ou maior que 6 MB."},origin);}
 const url=Deno.env.get("SUPABASE_URL"),key=secretKey();if(!url||!key)return reply(503,{success:false,message:"Serviço administrativo não configurado."},origin);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await db.auth.getUser(token);if(authError||!auth.user)return reply(401,{success:false,message:"Sessão inválida ou expirada."},origin);
 const {data:p,error:pError}=await db.from("perfis_admin").select("user_id,papel,ativo").eq("user_id",auth.user.id).maybeSingle();
 if(pError)return reply(503,{success:false,message:"Não foi possível validar as permissões."},origin);
 if(!p||p.user_id!==auth.user.id||p.ativo!==true||p.papel!=="admin")return reply(403,{success:false,message:"Somente administrador ativo pode importar."},origin);
 if(b.action==="preview_import"){
  if(Object.keys(b).length!==2||!Array.isArray(b.rows))return reply(400,{success:false,message:"Envie a lista de linhas para prévia."},origin);
  const {data,error}=await db.rpc("teu7vd_preparar_importacao_reservas",{p_actor_id:auth.user.id,p_rows:b.rows});
  if(error||data?.success!==true)return reply(400,{success:false,message:"Importação rejeitada. Confira o modelo CSV, IDs das giras, status e campos obrigatórios."},origin);
  return reply(200,{success:true,message:"Prévia validada; nenhuma reserva foi inserida.",job_id:data.job_id,resumo:data.resumo},origin);
 }
 if(b.action==="apply_import"){
  if(Object.keys(b).some(k=>!["action","job_id","reason"].includes(k))||typeof b.job_id!=="string"||!/^[0-9a-f-]{36}$/i.test(b.job_id)||typeof b.reason!=="string"||b.reason.trim().length<10||b.reason.trim().length>500)
   return reply(400,{success:false,message:"Informe lote válido e motivo entre 10 e 500 caracteres."},origin);
  const {data,error}=await db.rpc("teu7vd_aplicar_importacao_reservas",{p_actor_id:auth.user.id,p_job_id:b.job_id,p_motivo:b.reason.trim()});
  if(error||data?.success!==true)return reply(400,{success:false,message:"Importação não aplicada. Nenhuma linha parcial foi confirmada."},origin);
  return reply(200,{success:true,message:"Importação aplicada e auditada.",resumo:data},origin);
 }
 return reply(400,{success:false,message:"Ação inválida."},origin);
});
