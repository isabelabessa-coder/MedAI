/* ===== TEMA CLARO/ESCURO =====
   Segue o sistema por padrão; o botão do cabeçalho sobrescreve e lembra a escolha. */
(function(){
  const root=document.documentElement,KEY='medai-theme';
  const saved=()=>{try{return localStorage.getItem(KEY)}catch(e){return null}};
  const sysDark=()=>window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches;
  const current=()=>root.getAttribute('data-theme')||(sysDark()?'dark':'light');
  const s=saved();if(s==='light'||s==='dark')root.setAttribute('data-theme',s);

  const SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  const btn=document.createElement('button');
  btn.id='theme';btn.type='button';
  const paint=()=>{const d=current()==='dark';btn.innerHTML=d?SUN:MOON;btn.title=btn.ariaLabel=d?'Ativar modo claro':'Ativar modo escuro'};
  btn.onclick=()=>{const n=current()==='dark'?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem(KEY,n)}catch(e){}paint()};
  document.querySelector('header').insertBefore(btn,document.getElementById('more'));
  paint();
})();
/* ===== FIM DO TEMA ===== */

/* ===== CONFIGURAÇÃO DO n8n =====
   Cole aqui a Production URL do Webhook (workflow ATIVO, com CORS liberado para este site).
   Vazia = modo demonstração, com a Eva local.
   Resposta esperada do n8n (Respond to Webhook):
   {reply, type:"CONSULTA|EXAME|AGENDAMENTO|OUTRO", options:[{label,value}], handoff:false,
    appointment:null|{id,tipo,item,unidade,endereco,data:"AAAA-MM-DD",hora:"HH:MM",status:"Agendado"},
    units:null|[{nome,endereco,distancia}]} */
const CONFIG={WEBHOOK_URL:"",TIMEOUT:15000};

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e};
const get=k=>JSON.parse(localStorage.getItem(k)||'null'),put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const fd=d=>new Date(d+'T12:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'});
const HAND='A partir de agora, nossa conversa será transferida para um atendente humano. Peço paciência durante o atendimento.';
const GRAVE=/dor no peito|falta de ar|nao consigo respirar|desmai|convuls|sangramento|derrame|\bavc\b|suicid|me matar|me machucar/;
let user=get('user'),appts=get('appts')||[],hist=get('hist')||[],conv,st={},last,sid=''+Date.now();
const ativos=()=>appts.filter(a=>a.status==='Agendado');
const show=id=>['s-open','s-reg','s-err','app'].forEach(x=>$('#'+x).hidden=x!==id);

/* ===== DADOS FICTÍCIOS (usados só no modo demonstração) ===== */
const UN=[
{n:'UBS Centro',e:'Rua das Flores, 120',s:['clínico geral','pediatria','ginecologia'],x:['sangue','urina']},
{n:'UBS Jardim Esperança',e:'Av. Brasil, 845',s:['clínico geral','pediatria'],x:['sangue','urina']},
{n:'Policlínica Municipal',e:'Rua da Saúde, 300',s:['cardiologia','ortopedia','dermatologia','oftalmologia'],x:['eletrocardiograma','raio-x']},
{n:'Centro de Especialidades',e:'Av. Central, 1500',s:['cardiologia','dermatologia','ginecologia','oftalmologia'],x:['ultrassom','sangue']},
{n:'Hospital Dia Vila Nova',e:'Rua Vila Nova, 77',s:['ortopedia','clínico geral'],x:['raio-x','ultrassom','eletrocardiograma']},
{n:'UPA Norte',e:'Av. dos Ipês, 2100',s:['clínico geral','pediatria'],x:['sangue','raio-x']},
{n:'Laboratório Municipal',e:'Rua do Comércio, 56',s:[],x:['sangue','urina','ultrassom']},
{n:'Policlínica Sul',e:'Rua das Acácias, 410',s:['cardiologia','pediatria','ortopedia'],x:['eletrocardiograma','ultrassom']}];
const SIN={'cardiologia':['cardio','coracao'],'pediatria':['pediatr','crianca','bebe','filho'],'ortopedia':['ortoped','osso','joelho','coluna'],'dermatologia':['dermat','pele'],'ginecologia':['ginec'],'oftalmologia':['oftalm','olho'],'clínico geral':['clinico','geral']};
const SINE={'sangue':['sangue','hemograma','colesterol'],'urina':['urina'],'raio-x':['raio','rx'],'ultrassom':['ultra'],'eletrocardiograma':['eletro','ecg']};
const MENU=[{label:'Marcar consulta',value:'Quero marcar uma consulta'},{label:'Marcar exame',value:'Quero marcar um exame'},{label:'Minhas consultas',value:'minhas consultas'},{label:'Cancelar ou remarcar',value:'quero cancelar ou remarcar'}];
const cap=s=>s[0].toUpperCase()+s.slice(1);

function slots(i){const o=[],n=new Date();
  for(let k=1;o.length<6&&k<15;k++){const x=new Date(n.getFullYear(),n.getMonth(),n.getDate()+k);if(x.getDay()%6==0)continue;
    const d=x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
    ['08:00','09:30','14:00','15:30'].forEach((h,j)=>{if((i+k+j)%3&&o.length<6&&!ativos().some(a=>a.unidadeId==i&&a.data==d&&a.hora==h))o.push([d,h])})}
  return o}

/* ===== EVA LOCAL: funciona sem n8n e serve de plano B ===== */
function local(p){
  const t=norm(p.message),R=(reply,o)=>Object.assign({reply},o),nome=()=>(st.tipo=='EXAME'?'Exame de ':'Consulta de ')+st.item;
  const horarios=()=>{const u=UN[st.u],sl=slots(st.u);
    return sl.length?R(nome()+' – '+u.n+'\n'+u.e+'\nEscolha um horário:',{type:'AGENDAMENTO',options:sl.map(([d,h])=>({label:fd(d)+' · '+h,value:'horario:'+st.u+'|'+d+'|'+h}))}):R('Não há horários livres nessa unidade agora. Quer ver outra unidade?',{options:MENU.slice(0,2)})};
  if(p.context==='emergencia')return R('Sinto muito que você esteja passando por isso. Não posso avaliar o que você sente, mas procure o pronto-socorro mais próximo (use o mapa abaixo). Se houver risco de vida, ligue agora para o SAMU: 192.');
  if(/atendente|humano/.test(t))return R('',{handoff:true});
  if(GRAVE.test(t))return R('O que você descreveu pode ser urgente. Ligue agora para o SAMU: 192 ou vá ao pronto-socorro mais próximo. Posso abrir a área de Emergência para você.',{options:[{label:'Abrir Emergência',value:'abrir:emerg'}]});
  if(/diagnost|remedio|medicamento|qual doenca|o que eu tenho/.test(t))return R('Eu não faço diagnóstico nem indico medicamentos. Posso ajudar a marcar uma consulta para você conversar com um profissional.',{options:MENU});
  let m;
  if(m=t.match(/^cancelar:(\d+)/)){const a=appts.find(x=>x.id==m[1]);if(a)a.status='Cancelado';put('appts',appts);return R(a?'Pronto, cancelei: '+a.item+' em '+a.unidade+' ('+fd(a.data)+', '+a.hora+').':'Não encontrei esse agendamento.',{options:MENU.slice(0,2)})}
  if(m=t.match(/^remarcar:(\d+)/)){const a=appts.find(x=>x.id==m[1]);if(!a)return R('Não encontrei esse agendamento.');st={tipo:a.tipo,item:a.item.replace(/^\S+ de /,''),u:a.unidadeId,old:a.id};return horarios()}
  if(m=t.match(/^unidade:(\d+)/)){st.u=+m[1];return horarios()}
  if(m=t.match(/^horario:(\d+)\|(\S+)\|(\S+)/)){const u=UN[m[1]],a={id:Date.now(),tipo:st.tipo,item:nome(),unidade:u.n,unidadeId:+m[1],endereco:u.e+' – '+p.user.city+'/'+p.user.state,data:m[2],hora:m[3],status:'Agendado'};
    if(st.old){const o=appts.find(x=>x.id==st.old);if(o)o.status='Cancelado'}st={};
    return R('Agendado! ✅\n'+a.item+'\n'+u.n+' – '+a.endereco+'\n'+fd(a.data)+' às '+a.hora+'\nLeve documento com foto e cartão do SUS. Eu aviso você antes do horário.',{type:'AGENDAMENTO',appointment:a,options:[{label:'Ver minhas consultas',value:'minhas consultas'}]})}
  if(/cancelar ou remarcar/.test(t))return R('Quer cancelar ou remarcar?',{options:[{label:'Cancelar',value:'cancelar'},{label:'Remarcar',value:'remarcar'}]});
  if(/cancel|remarc/.test(t)){const v=/remarc/.test(t)?'remarcar':'cancelar',at=ativos();
    return at.length?R('Qual agendamento?',{options:at.map(a=>({label:a.item+' · '+fd(a.data)+' '+a.hora,value:v+':'+a.id}))}):R('Você não tem agendamentos ativos.',{options:MENU.slice(0,2)})}
  if(/minha|meus/.test(t)&&/consulta|exame|agend/.test(t)){const at=ativos();
    return R(at.length?'Seus agendamentos:\n'+at.map(a=>'• '+a.item+' – '+a.unidade+', '+fd(a.data)+' às '+a.hora).join('\n'):'Você não tem agendamentos ativos.',{options:at.length?MENU.slice(2):MENU.slice(0,2)})}
  if(/jejum/.test(t))return R('Para exame de sangue, o jejum costuma ser de 8 a 12 horas (pode beber água). Para outros exames, depende do tipo; confirme as orientações com a unidade.');
  if(/levar|documento/.test(t))return R('Leve documento com foto, cartão do SUS (se tiver), pedido médico (no caso de exames) e exames anteriores.');
  if(/onde fica|endereco/.test(t)){const a=ativos()[0];return R(a?a.unidade+': '+a.endereco:'Você ainda não tem agendamento. Quer marcar um?',{options:a?undefined:MENU.slice(0,2)})}
  if(/^(oi|ola|bom dia|boa tarde|boa noite)\b/.test(t))return R('Olá! Como posso ajudar?',{options:MENU});
  const esp=Object.keys(SIN).find(k=>SIN[k].some(w=>t.includes(w))),exa=Object.keys(SINE).find(k=>SINE[k].some(w=>t.includes(w)));
  if(exa||/exame/.test(t))st={tipo:'EXAME',item:exa};
  else if(esp||/consulta|medico|marcar|agendar/.test(t))st={tipo:'CONSULTA',item:esp};
  else return R('Não entendi bem, mas posso ajudar com isto:',{options:MENU});
  if(!st.item)return R(st.tipo=='EXAME'?'Qual exame você precisa?':'Qual especialidade você procura?',{type:st.tipo,options:(st.tipo=='EXAME'?Object.keys(SINE).map(x=>({label:cap(x),value:'Exame de '+x})):Object.keys(SIN).map(x=>({label:cap(x),value:'Consulta de '+x})))});
  const us=UN.map((u,i)=>[u,i]).filter(([u])=>(st.tipo=='EXAME'?u.x:u.s).includes(st.item));
  return R(nome()+' em '+p.user.city+'. Encontrei:\n'+us.map(([u])=>'• '+u.n+' – '+u.e).join('\n')+'\nQual você prefere?',{type:st.tipo,options:us.map(([u,i])=>({label:u.n,value:'unidade:'+i}))})}

/* ===== FUNÇÃO CENTRAL: todo o site fala com a Eva por aqui ===== */
function normR(r){if(Array.isArray(r))r=r[0];if(!r||typeof r.reply!=='string')throw new Error('formato');
  return{reply:r.reply,type:r.type||'OUTRO',options:Array.isArray(r.options)?r.options:[],handoff:r.handoff===true,appointment:r.appointment||null,units:Array.isArray(r.units)?r.units:null}}
async function enviarParaEva(p){
  p={sessionId:sid,platform:'web',context:'chat',user:{name:user.name,email:user.email,city:user.city,state:user.state},location:null,...p};
  if(!CONFIG.WEBHOOK_URL){await new Promise(r=>setTimeout(r,600));return normR(local(p))}
  const c=new AbortController(),tm=setTimeout(()=>c.abort(),CONFIG.TIMEOUT);
  try{const r=await fetch(CONFIG.WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p),signal:c.signal});
    if(!r.ok)throw new Error('http');return normR(await r.json())}finally{clearTimeout(tm)}}

/* ===== CHAT ===== */
function add(w,t){const d=el('div','m '+w,t);$('#msgs').append(d);d.scrollIntoView({block:'end'});return d}
function opts(o){const d=el('div','ops');o.forEach(x=>{const b=el('button','btn sm ghost',x.label);b.onclick=()=>{d.remove();x.value.startsWith('abrir:')?tab(x.value.slice(6)):send(x.label,x.value)};d.append(b)});$('#msgs').append(d);d.scrollIntoView({block:'end'})}
function save(w,t){conv.msgs.push({w,t});if(w=='u'&&conv.title=='Nova conversa')conv.title=t.slice(0,40);if(!hist.includes(conv))hist.unshift(conv);put('hist',hist)}
function newConv(){conv={id:Date.now(),title:'Nova conversa',msgs:[]};st={};$('#msgs').innerHTML='';$('#in').disabled=false}
function greet(){const m='Olá, '+user.name.split(' ')[0]+'! Eu sou a Eva, assistente virtual do MEDaí. Posso ajudar com consultas, exames, agendamentos e lembretes. O que você precisa?';add('e',m);save('e',m);
  opts([{label:'Preciso de um cardiologista',value:'Preciso de um cardiologista'},{label:'Quero fazer um exame de sangue',value:'Quero fazer um exame de sangue'},{label:'Minhas consultas',value:'minhas consultas'}])}
function lembrar(){ativos().filter(a=>{const d=new Date(a.data+'T'+a.hora)-Date.now();return d>0&&d<864e5}).forEach(a=>{const t='Lembrete: '+a.item+' em '+a.unidade+', '+fd(a.data)+' às '+a.hora+'.';add('e',t);if(window.Notification&&Notification.permission==='granted')new Notification('MEDaí',{body:t})})}
async function send(label,value){
  if(st.hand)return;label=label||$('#in').value.trim();if(!label)return;$('#in').value='';
  add('u',label);save('u',label);last={message:value||label};await run()}
async function run(){
  const ty=add('e','Eva está digitando…');ty.classList.add('ty');
  try{const r=await enviarParaEva(last);ty.remove();
    if(r.reply&&r.reply!==HAND){add('e',r.reply);save('e',r.reply)}
    if(r.handoff){add('e',HAND);save('e',HAND);st.hand=true;$('#in').disabled=true}
    if(r.appointment&&!appts.some(a=>a.id==r.appointment.id)){appts.push(r.appointment);if(window.Notification&&Notification.permission==='default')Notification.requestPermission()}
    put('appts',appts);if(r.options.length&&!r.handoff)opts(r.options)
  }catch(e){ty.remove();show('s-err')}}
$('#retry').onclick=()=>{show('app');run()};
addEventListener('online',()=>{if(!$('#s-err').hidden)$('#retry').click()});
$('#snd').onclick=()=>send();$('#in').addEventListener('keydown',e=>{if(e.key==='Enter')send()});

/* ===== ABAS ===== */
const ICO={chat:'M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-5.5A8 8 0 1 1 21 12z',consultas:'M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',exames:'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',emerg:'M12 3l9 16H3zM12 10v4',hist:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',perfil:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'};
[['chat','Chat'],['consultas','Consultas'],['exames','Exames'],['emerg','Emergência'],['hist','Histórico'],['perfil','Perfil']].forEach(([k,l])=>{
  const b=el('button','nv');b.dataset.t=k;b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+ICO[k]+'"/></svg>';b.append(el('span','',l));b.onclick=()=>tab(k);$('#nav').append(b)});
function tab(n){$$('.tab').forEach(t=>t.classList.toggle('on',t.id==='t-'+n));$$('.nv').forEach(b=>b.classList.toggle('on',b.dataset.t===n));$('#extras').classList.remove('open');
  ({consultas:()=>list('CONSULTA'),exames:()=>list('EXAME'),hist:renderHist,perfil:renderPerfil,emerg:()=>{$('#ecity').value=user.city+'/'+user.state}}[n]||(()=>0))()}
function list(tp){const e=$('#t-'+(tp=='EXAME'?'exames':'consultas'));e.innerHTML='';e.append(el('h2','',tp=='EXAME'?'Exames e procedimentos':'Consultas'));
  const a=appts.filter(x=>x.tipo==tp).reverse();if(!a.length)e.append(el('div','card','Nenhum agendamento ainda. Peça para a Eva marcar.'));
  a.forEach(x=>{const c=el('div','card');c.append(el('b','',x.item),el('div','',x.unidade+' – '+x.endereco),el('div','',fd(x.data)+' às '+x.hora+' · '+x.status));
    if(x.status==='Agendado')[['Cancelar','cancelar:'],['Remarcar','remarcar:']].forEach(([l,v])=>{const b=el('button','btn sm',l);b.style.margin='8px 8px 0 0';b.onclick=()=>{tab('chat');send(l,v+x.id)};c.append(b)});e.append(c)});
  const b=el('button','btn','Pedir pela Eva');b.onclick=()=>{tab('chat');send(tp=='EXAME'?'Quero marcar um exame':'Quero marcar uma consulta')};e.append(b)}
function renderHist(){const e=$('#t-hist');e.innerHTML='';e.append(el('h2','','Histórico de conversas'));
  const n=el('button','btn sm','Nova conversa');n.style.marginBottom='10px';n.onclick=()=>{newConv();greet();tab('chat')};e.append(n);
  if(!hist.length)e.append(el('div','card','Nenhuma conversa ainda.'));
  hist.forEach((c,i)=>{const d=el('div','card');d.append(el('b','',c.title),el('div','',c.msgs.length+' mensagens'));
    const o=el('button','btn sm','Abrir'),x=el('button','btn sm','Apagar');o.style.margin=x.style.margin='8px 8px 0 0';
    o.onclick=()=>{conv=c;st={};$('#msgs').innerHTML='';$('#in').disabled=false;c.msgs.forEach(m=>add(m.w,m.t));tab('chat')};
    x.onclick=()=>{hist.splice(i,1);put('hist',hist);if(conv===c)newConv();renderHist()};d.append(o,x);e.append(d)})}
function renderPerfil(){const e=$('#t-perfil');e.innerHTML='';e.append(el('h2','','Meu perfil'));
  [['name','Nome'],['email','E-mail'],['city','Cidade'],['state','Estado (UF)']].forEach(([k,l])=>{const lb=el('label','',l),i=el('input');i.id='p-'+k;i.value=user[k];lb.htmlFor=i.id;e.append(lb,i)});
  const s=el('button','btn','Salvar'),o=el('button','btn','Sair'),w=el('div');w.style.cssText='margin-top:16px;display:flex;gap:8px';
  s.onclick=()=>{['name','email','city','state'].forEach(k=>user[k]=$('#p-'+k).value.trim());put('user',user);s.textContent='Salvo ✓'};
  o.onclick=sair;w.append(s,o);e.append(w)}
function sair(){localStorage.removeItem('user');user=null;show('s-reg')}

/* ===== EMERGÊNCIA ===== */
[['SAMU','192'],['Bombeiros','193'],['Polícia Militar','190'],['Defesa Civil','199'],['Disque Saúde','136'],['CVV – apoio emocional','188']].forEach(([n,t])=>{
  const c=el('div','card');const a=el('a','btn sm','Ligar '+t);a.href='tel:'+t;c.append(el('b','',n),el('div','',t),a);$('#nums').append(c)});
const pos=()=>new Promise(r=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>r({lat:p.coords.latitude,lng:p.coords.longitude}),()=>r(null),{timeout:8000}):r(null));
$('#ebtn').onclick=async()=>{
  const tx=$('#etx').value.trim(),al=$('#ealert'),out=$('#eres');al.innerHTML=out.innerHTML='';
  if(!tx){out.append(el('span','er','Descreva o que você está sentindo.'));return}
  const n=norm(tx);
  if(GRAVE.test(n))al.append(el('div','alert','⚠️ O que você descreveu pode ser urgente. Ligue agora para o SAMU: 192.'));
  if(/suicid|me matar|me machucar|morrer/.test(n))al.append(el('div','alert','Você não está sozinho(a). Ligue para o CVV: 188 (apoio emocional).'));
  out.append(el('p','','Buscando sua localização…'));
  const loc=await pos();let r={reply:'Procure o pronto-socorro mais próximo. Se houver risco de vida, ligue 192.',units:null};
  try{r=await enviarParaEva({message:tx,context:'emergencia',location:loc})}catch(e){}
  out.innerHTML='';const c=el('div','card',r.reply);out.append(c);
  (r.units||[]).forEach(u=>{const d=el('div','card');d.append(el('b','',u.nome),el('div','',u.endereco+(u.distancia?' · '+u.distancia:'')));
    const a=el('a','btn sm','Ver rota');a.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(u.endereco);a.target='_blank';a.rel='noopener';d.append(a);out.append(d)});
  const m=el('a','btn','Abrir hospitais no mapa');m.target='_blank';m.rel='noopener';
  m.href=loc?'https://www.google.com/maps/search/hospital+pronto-socorro/@'+loc.lat+','+loc.lng+',14z':'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('hospital pronto-socorro '+($('#ecity').value||user.city));
  out.append(m)};

/* ===== EXTRAS (três pontinhos no celular, laterais na web) ===== */
[['Ajuda','Converse com a Eva para marcar consultas e exames e ver ou cancelar agendamentos. Em emergência, ligue 192.'],
 ['Sobre o MEDaí','O MEDaí é um assistente virtual de saúde pública para cidadãos. A Eva orienta sobre serviços de saúde e não faz diagnóstico nem indica medicamentos.'],
 ['Termos e privacidade','Seus dados ficam apenas neste navegador (demonstração). Em produção, o tratamento seguirá a LGPD, com seu consentimento.']].forEach(([t,x])=>{
  const b=el('button','x',t);b.onclick=()=>{$('#dtx').textContent=x;$('#dlg').showModal()};$('#extras').append(b)});
{const b=el('button','x','Sair');b.onclick=sair;$('#extras').append(b)}
$('#more').onclick=()=>$('#extras').classList.toggle('open');

/* ===== CADASTRO E INÍCIO ===== */
// Obs.: a senha NÃO é guardada. Em produção, o login deve ser feito em um servidor seguro.
function start(){show('app');newConv();tab('chat');greet();lembrar()}
$('#go').onclick=()=>user?start():show('s-reg');
$('#reg').onclick=()=>{let ok=true;
  const chk=(k,c,m)=>{const e=$('#e'+k);e.textContent=c?'':m;e.hidden=c;const i=$('#r'+k);i&&i.classList.toggle('bad',!c);if(!c)ok=false};
  const f={n:$('#rn').value.trim(),e:$('#re').value.trim(),p:$('#rp').value,c:$('#rc').value.trim(),u:$('#ru').value.trim().toUpperCase()};
  chk('n',f.n.length>2,'Informe seu nome.');chk('e',/^\S+@\S+\.\S+$/.test(f.e),'Informe um e-mail válido.');chk('p',f.p.length>=8,'A senha precisa ter 8 ou mais caracteres.');
  chk('c',f.c.length>1,'Informe sua cidade.');chk('u',/^[A-Z]{2}$/.test(f.u),'Use a sigla do estado, como SP.');chk('l',$('#rl').checked,'É preciso concordar para continuar.');
  if(!ok)return;user={name:f.n,email:f.e,city:f.c,state:f.u};put('user',user);start()};
$('#demo').hidden=!!CONFIG.WEBHOOK_URL;
show('s-open');