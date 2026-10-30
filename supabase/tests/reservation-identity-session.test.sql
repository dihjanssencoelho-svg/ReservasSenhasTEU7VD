-- Testa separadamente as duas chaves institucionais de duplicidade entre sessões.
-- Somente Supabase local descartável; toda a massa de teste termina em ROLLBACK.
begin;
do $identity$
declare
  v_gira uuid := 'abababab-abab-4bab-8bab-abababababab';
  v_result jsonb;
  v_count integer;
begin
  insert into public.giras(id,titulo,data_gira,chave,limite_vagas,ativa,status,tipo_gira)
  values(v_gira,'Teste identidade entre sessões',current_date + 60,'__identity_session_test',10,true,'publicada','__identity_session_type');

  v_result := public.teu7vd_criar_reserva(v_gira,'Pessoa Identidade','1990-06-15','11911111111','identidade@example.invalid','Não',false,null,null,null,null);
  if v_result->>'success' <> 'true' then raise exception 'Falha: reserva base não criada'; end if;

  -- Mesmo nome+nascimento+e-mail, telefone diferente: deve ser duplicidade.
  begin
    perform public.teu7vd_criar_reserva(v_gira,' pessoa   identidade ','1990-06-15','11922222222','IDENTIDADE@example.invalid','Não',false,null,null,null,null);
    raise exception 'Falha: duplicidade por e-mail foi aceita';
  exception when unique_violation then null;
  end;

  -- Mesmo nome+nascimento+telefone, e-mail diferente: deve ser duplicidade.
  begin
    perform public.teu7vd_criar_reserva(v_gira,'Pessoa Identidade','1990-06-15','(11) 91111-1111','outro@example.invalid','Não',false,null,null,null,null);
    raise exception 'Falha: duplicidade por telefone foi aceita';
  exception when unique_violation then null;
  end;

  -- Mesmo nome+nascimento, mas e-mail e telefone diferentes: permitido pela regra institucional.
  v_result := public.teu7vd_criar_reserva(v_gira,'Pessoa Identidade','1990-06-15','11933333333','terceiro@example.invalid','Não',false,null,null,null,null);
  if v_result->>'success' <> 'true' then raise exception 'Falha: identidade distinta foi bloqueada indevidamente'; end if;

  select count(*) into v_count from public.reservas where gira_id=v_gira and status='ativa';
  if v_count <> 2 then raise exception 'Falha: esperadas 2 reservas válidas, obtidas %',v_count; end if;
  raise notice 'PASSOU: duplicidade por e-mail e telefone isoladamente, normalização e identidade distinta';
end
$identity$;
rollback;
