import { createClient } from "npm:@supabase/supabase-js@2";
const expectedOrigin=()=>Deno.env.get("TEU7VD_ALLOWED_ORIGIN")??"";
function reply(status:number,body:Record<string,unknown>,origin:string|null){
 const h=new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"});
 if(origin&&expectedOrigin()&&origin===expectedOrigin())h.set("Access-Control-Allow-Origin",origin);
 return new Response(JSON.stringify(body),{status,headers:h});
}
function secretKey():string|null{try{const v=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}");return typeof v.default==="string"?v.default:null;}catch{return null;}}
async function allRows(client:any,table:string,select:string){
 const rows:Record<string,unknown>[]=[]; const size=500;
 for(let offset=0;offset<10000;offset+=size){
  const {data,error}=await client.from(table).select(select).range(offset,offset+size-1);
  if(error)throw new Error("table_read_failed");
  rows.push(...(data??[]) as Record<string,unknown>[]);
  if(!data||data.length<size)return rows;
 }
 throw new Error("backup_limit_exceeded");
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin"),expected=expectedOrigin();
 if(req.method==="OPTIONS")return !expected||origin!==expected?new Response(null,{status:403}):reply(204,{},origin);
 if(req.method!=="POST")return reply(405,{success:false,message:"Método não permitido."},origin);
 if(!expected||origin!==expected)return reply(403,{success:false,message:"Origem não autorizada."},origin);
 const token=/^Bearer\s+(.+)$/i.exec(req.headers.get("authorization")??"")?.[1];
 if(!token)return reply(401,{success:false,message:"Autenticação necessária."},origin);
 let body:Record<string,unknown>;
 try{const raw=await req.text();if(new TextEncoder().encode(raw).byteLength>1000)throw new Error();const x:unknown=JSON.parse(raw);if(!x||typeof x!=="object"||Array.isArray(x))throw new Error();body=x as Record<string,unknown>;}catch{return reply(400,{success:false,message:"Solicitação inválida."},origin);}
 if(Object.keys(body).length!==1||body.action!=="export_backup")return reply(400,{success:false,message:"Ação inválida."},origin);
 const url=Deno.env.get("SUPABASE_URL"),key=secretKey();if(!url||!key)return reply(503,{success:false,message:"Serviço administrativo não configurado."},origin);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await db.auth.getUser(token);
 if(authError||!auth.user)return reply(401,{success:false,message:"Sessão inválida ou expirada."},origin);
 const {data:profile,error:profileError}=await db.from("perfis_admin").select("user_id,papel,ativo").eq("user_id",auth.user.id).maybeSingle();
 if(profileError)return reply(503,{success:false,message:"Não foi possível validar as permissões."},origin);
 if(!profile||profile.user_id!==auth.user.id||profile.ativo!==true||profile.papel!=="admin")return reply(403,{success:false,message:"Somente administrador ativo pode exportar backup."},origin);
 try{
  const giras=await allRows(db,"giras","id,titulo,data_gira,chave,limite_vagas,ativa,status,tipo_gira,created_at,updated_at");
  const reservas=await allRows(db,"reservas","id,gira_id,senha_original,tipo_gira,senha_numero,nome_completo,data_nascimento,telefone,email,primeira_vez,retorno,medium_nome,preferencial,tipo_preferencial,descricao_preferencial,status,origem,legado_importado,linha_origem,created_at,updated_at,cancelada_em,cancelada_por,reaberta_em,reaberta_por,excluida_em,excluida_por,exclusao_motivo");
  const contadores=await allRows(db,"contadores_senha","tipo_gira,proxima_senha,updated_at");
  const {data:settings,error:settingsError}=await db.from("configuracoes_portal").select("mensagem_publica,mensagem_confirmacao,cor_primaria,cor_destaque,limite_alerta_vagas,updated_at").eq("id",true).maybeSingle();
  if(settingsError)throw new Error("settings_read_failed");
  const backup={schema:"teu7vd-backup-v1",generated_at:new Date().toISOString(),generated_by:auth.user.id,counts:{giras:giras.length,reservas:reservas.length,contadores:contadores.length},giras,reservas,contadores_senha:contadores,configuracoes_portal:settings?[settings]:[]};
  const {error:auditError}=await db.from("auditoria").insert({user_id:auth.user.id,acao:"backup_exportado",entidade:"backup",entidade_id:null,detalhes:{schema:backup.schema,counts:backup.counts}});
  if(auditError)throw new Error("audit_failed");
  return reply(200,{success:true,backup},origin);
 }catch(error){
  const message=error instanceof Error&&error.message==="backup_limit_exceeded"?"Backup excede o limite operacional de 10.000 registros por tabela; refine a exportação por período.":"Não foi possível gerar o backup completo. Nenhum arquivo parcial foi entregue.";
  return reply(503,{success:false,message},origin);
 }
});
