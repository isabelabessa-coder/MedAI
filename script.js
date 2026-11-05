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
  const paint=()=>{const d=current()==='dark';btn.innerHTML=d?SUN:MOON;btn.title=d?'Ativar modo claro':'Ativar modo escuro';btn.setAttribute('aria-label',btn.title)};
  btn.onclick=()=>{const n=current()==='dark'?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem(KEY,n)}catch(e){}paint()};
  document.querySelector('header').insertBefore(btn,document.getElementById('more'));
  paint();
})();
/* ===== FIM DO TEMA ===== */

/* ===== CONFIGURAÇÃO =====
   WEBHOOK_URL: Production URL do Webhook do n8n (workflow ATIVO, CORS liberado). Vazia = Eva local (demonstração).
   AUTH_URL: URL base do seu servidor de login. Precisa ter POST /register e POST /login,
             que respondem {token, user:{name,email,city,state,coverage,plan,cpfMask,hasCNS}}.
             Vazia = login de demonstração no navegador (INSEGURO, só para testes).
   Resposta esperada do n8n (Respond to Webhook):
   {reply, type:"CONSULTA|EXAME|AGENDAMENTO|OUTRO", options:[{label,value}], handoff:false,
    appointment:null|{id,tipo,item,unidade,endereco,data:"AAAA-MM-DD",hora:"HH:MM",status:"Agendado"},
    units:null|[{nome,endereco,distancia}]} */
const CONFIG={WEBHOOK_URL:"https://prjmedai.app.n8n.cloud/webhook/medai-eva",TIMEOUT:30000}

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e};
const get=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const fd=d=>new Date(d+'T12:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'});
const HAND='A partir de agora, nossa conversa será transferida para um atendente humano. Peço paciência durante o atendimento.';
const GRAVE=/dor no peito|falta de ar|nao consigo respirar|desmai|convuls|sangramento|derrame|\bavc\b|suicid|me matar|me machucar/;
let user=get('user'),appts=get('appts')||[],hist=get('hist')||[],conv,st={},last,sid=''+Date.now();
let token=sessionStorage.getItem('tk')||'';
const ativos=()=>appts.filter(a=>a.status==='Agendado');
const show=id=>['s-open','s-reg','s-login','s-err','app'].forEach(x=>$('#'+x).hidden=x!==id);

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
  const sus=p.user.coverage==='sus';
  const horarios=()=>{const u=UN[st.u],sl=slots(st.u);
    return sl.length?R(nome()+' – '+u.n+'\n'+u.e+'\nEscolha um horário:',{type:'AGENDAMENTO',options:sl.map(([d,h])=>({label:fd(d)+' · '+h,value:'horario:'+st.u+'|'+d+'|'+h}))}):R('Não há horários livres nessa unidade agora. Quer ver outra unidade?',{options:MENU.slice(0,2)})};
  if(p.context==='avaliacao')return R('Obrigada!');
  if(p.context==='unidades')return R('');
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
    return R('Agendado! ✅\n'+a.item+'\n'+u.n+' – '+a.endereco+'\n'+fd(a.data)+' às '+a.hora+'\nLeve documento com foto'+(sus?' e cartão do SUS':'')+'. Eu aviso você antes do horário.',{type:'AGENDAMENTO',appointment:a,options:[{label:'Ver minhas consultas',value:'minhas consultas'}]})}
  if(/cancelar ou remarcar/.test(t))return R('Quer cancelar ou remarcar?',{options:[{label:'Cancelar',value:'cancelar'},{label:'Remarcar',value:'remarcar'}]});
  if(/cancel|remarc/.test(t)){const v=/remarc/.test(t)?'remarcar':'cancelar',at=ativos();
    return at.length?R('Qual agendamento?',{options:at.map(a=>({label:a.item+' · '+fd(a.data)+' '+a.hora,value:v+':'+a.id}))}):R('Você não tem agendamentos ativos.',{options:MENU.slice(0,2)})}
  if(/minha|meus/.test(t)&&/consulta|exame|agend/.test(t)){const at=ativos();
    return R(at.length?'Seus agendamentos:\n'+at.map(a=>'• '+a.item+' – '+a.unidade+', '+fd(a.data)+' às '+a.hora).join('\n'):'Você não tem agendamentos ativos.',{options:at.length?MENU.slice(2):MENU.slice(0,2)})}
  if(/jejum/.test(t))return R('Para exame de sangue, o jejum costuma ser de 8 a 12 horas (pode beber água). Para outros exames, depende do tipo; confirme as orientações com a unidade.');
  if(/levar|documento/.test(t))return R('Leve documento com foto'+(sus?', cartão do SUS':'')+', pedido médico (no caso de exames) e exames anteriores.');
  if(/onde fica|endereco/.test(t)){const a=ativos()[0];return R(a?a.unidade+': '+a.endereco:'Você ainda não tem agendamento. Quer marcar um?',{options:a?undefined:MENU.slice(0,2)})}
  if(/^(oi|ola|bom dia|boa tarde|boa noite)\b/.test(t))return R('Olá! Como posso ajudar?',{options:MENU});
  const esp=Object.keys(SIN).find(k=>SIN[k].some(w=>t.includes(w))),exa=Object.keys(SINE).find(k=>SINE[k].some(w=>t.includes(w)));
  if(exa||/exame/.test(t))st={tipo:'EXAME',item:exa};
  else if(esp||/consulta|medico|marcar|agendar/.test(t))st={tipo:'CONSULTA',item:esp};
  else return R('Não entendi bem, mas posso ajudar com isto:',{options:MENU});
  if(!st.item)return R(st.tipo=='EXAME'?'Qual exame você precisa?':'Qual especialidade você procura?',{type:st.tipo,options:(st.tipo=='EXAME'?Object.keys(SINE).map(x=>({label:cap(x),value:'Exame de '+x})):Object.keys(SIN).map(x=>({label:cap(x),value:'Consulta de '+x})))});
  if(p.user.coverage==='privado')return R('Seu plano é '+(p.user.plan||'privado')+'. Nesta demonstração só tenho unidades do SUS; em produção mostro a rede credenciada do seu plano.',{options:MENU.slice(2)});
  const us=UN.map((u,i)=>[u,i]).filter(([u])=>(st.tipo=='EXAME'?u.x:u.s).includes(st.item));
  return R(nome()+' em '+p.user.city+'. Encontrei:\n'+us.map(([u])=>'• '+u.n+' – '+u.e).join('\n')+'\nQual você prefere?',{type:st.tipo,options:us.map(([u,i])=>({label:u.n,value:'unidade:'+i}))})}

/* ===== FUNÇÃO CENTRAL: todo o site fala com a Eva por aqui ===== */
function normR(r){if(Array.isArray(r))r=r[0];if(!r||typeof r.reply!=='string')throw new Error('formato');
  return{reply:r.reply,type:r.type||'OUTRO',options:Array.isArray(r.options)?r.options:[],handoff:r.handoff===true,appointment:r.appointment||null,units:Array.isArray(r.units)?r.units:null}}
async function enviarParaEva(p){
  p={sessionId:sid,platform:'web',context:'chat',user:{name:user.name,email:user.email,city:user.city,state:user.state,coverage:user.coverage||null,plan:user.plan||null},location:null,...p};
  if(!CONFIG.WEBHOOK_URL){await new Promise(r=>setTimeout(r,600));return normR(local(p))}
  const c=new AbortController(),tm=setTimeout(()=>c.abort(),CONFIG.TIMEOUT);
  try{const r=await fetch(CONFIG.WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(p),signal:c.signal});
    if(!r.ok)throw new Error('http');return normR(await r.json())}finally{clearTimeout(tm)}}

/* ===== CHAT ===== */
function add(w,t){const d=el('div','m '+w,t);$('#msgs').append(d);d.scrollIntoView({block:'end'});return d}
function opts(o){const d=el('div','ops');o.forEach(x=>{const b=el('button','btn sm ghost',x.label);
  b.onclick=()=>{d.remove();if(x.value==='abrir:rate')avaliar();else if(x.value.startsWith('abrir:'))tab(x.value.slice(6));else send(x.label,x.value)};d.append(b)});
  $('#msgs').append(d);d.scrollIntoView({block:'end'})}
function save(w,t){conv.msgs.push({w,t});if(w=='u'&&conv.title=='Nova conversa')conv.title=t.slice(0,40);if(!hist.includes(conv))hist.unshift(conv);put('hist',hist)}
function newConv(){conv={id:Date.now(),title:'Nova conversa',msgs:[]};st={};$('#msgs').innerHTML='';$('#in').disabled=false}
function greet(){const m='Olá, '+user.name.split(' ')[0]+'! Eu sou a Eva, assistente virtual do MEDaí. Posso ajudar com consultas, exames, agendamentos e lembretes. O que você precisa?';add('e',m);save('e',m);
  opts([{label:'Preciso de um cardiologista',value:'Preciso de um cardiologista'},{label:'Quero fazer um exame de sangue',value:'Quero fazer um exame de sangue'},{label:'Minhas consultas',value:'minhas consultas'}])}

/* ===== LEMBRETES (com o site aberto; para site fechado é preciso servidor) ===== */
function lembrar(){
  if(!user||!conv)return;
  ativos().forEach(a=>{
    const d=new Date(a.data+'T'+a.hora)-Date.now();a.rem=a.rem||{};
    const k=d<=0?null:d<=72e5?'2h':d<=864e5?'24h':null;
    if(!k||a.rem[k])return;
    a.rem['24h']=1;if(k==='2h')a.rem['2h']=1;
    const t='Lembrete: '+a.item+' em '+a.unidade+', '+fd(a.data)+' às '+a.hora+(k==='2h'?' (em cerca de 2 horas).':' (nas próximas 24 horas).');
    add('e',t);save('e',t);
    if(window.Notification&&Notification.permission==='granted')new Notification('MEDaí',{body:t})});
  put('appts',appts)}
setInterval(()=>{if(!$('#app').hidden)lembrar()},60000);

async function send(label,value){
  if(st.hand)return;label=label||$('#in').value.trim();if(!label)return;$('#in').value='';
  add('u',label);save('u',label);last={message:value||label};await run()}
async function run(){
  const ty=add('e','Eva está digitando…');ty.classList.add('ty');
  try{const r=await enviarParaEva(last);ty.remove();
    if(r.reply&&r.reply!==HAND){add('e',r.reply);save('e',r.reply)}
    if(r.handoff){add('e',HAND);save('e',HAND);st.hand=true;$('#in').disabled=true}
    if(r.appointment&&!appts.some(a=>a.id==r.appointment.id)){appts.push(r.appointment);if(window.Notification&&Notification.permission==='default')Notification.requestPermission()}
    put('appts',appts);
    if(r.options.length&&!r.handoff)opts(r.options);
    if(r.handoff||r.appointment)opts([{label:'⭐ Avaliar atendimento',value:'abrir:rate'}])
  }catch(e){ty.remove();show('s-err')}}
$('#retry').onclick=()=>{show('app');run()};
addEventListener('online',()=>{if(!$('#s-err').hidden)$('#retry').click()});
$('#snd').onclick=()=>send();$('#in').addEventListener('keydown',e=>{if(e.key==='Enter')send()});

/* ===== ABAS ===== */
const ICO={chat:'M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-5.5A8 8 0 1 1 21 12z',consultas:'M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',exames:'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',unid:'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4',emerg:'M12 3l9 16H3zM12 10v4',hist:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',perfil:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'};
[['chat','Chat'],['consultas','Consultas'],['exames','Exames'],['unid','Unidades'],['emerg','Emergência'],['hist','Histórico'],['perfil','Perfil']].forEach(([k,l])=>{
  const b=el('button','nv');b.dataset.t=k;b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+ICO[k]+'"/></svg>';b.append(el('span','',l));b.onclick=()=>tab(k);$('#nav').append(b)});
function tab(n){$$('.tab').forEach(t=>t.classList.toggle('on',t.id==='t-'+n));$$('.nv').forEach(b=>b.classList.toggle('on',b.dataset.t===n));$('#extras').classList.remove('open');
  ({consultas:()=>list('CONSULTA'),exames:()=>list('EXAME'),unid:carregarUnidades,hist:renderHist,perfil:renderPerfil,emerg:()=>{$('#ecity').value=user.city+'/'+user.state}}[n]||(()=>0))()}
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
const COB={sus:'SUS (público)',privado:'Plano de saúde privado',nenhum:'Particular / nenhum'};
function renderPerfil(){const e=$('#t-perfil');e.innerHTML='';e.append(el('h2','','Meu perfil'));
  const info=el('div','card');
  info.append(el('b','','Dados do cadastro'),el('div','','CPF: '+(user.cpfMask||'não informado')),el('div','','Cobertura: '+(COB[user.coverage]||'não informada')+(user.plan?' – '+user.plan:'')),el('div','',user.coverage==='sus'?'CNS: '+(user.hasCNS?'informado':'não informado'):''));
  e.append(info);
  [['name','Nome'],['email','E-mail'],['city','Cidade'],['state','Estado (UF)']].forEach(([k,l])=>{const lb=el('label','',l),i=el('input');i.id='p-'+k;i.value=user[k]||'';lb.htmlFor=i.id;e.append(lb,i)});
  const s=el('button','btn','Salvar'),o=el('button','btn ghost','Sair'),w=el('div');w.style.cssText='margin-top:16px;display:flex;gap:8px';
  s.onclick=()=>{['name','email','city','state'].forEach(k=>user[k]=$('#p-'+k).value.trim());put('user',user);s.textContent='Salvo ✓'};
  o.onclick=sair;w.append(s,o);e.append(w)}
function sair(){localStorage.removeItem('user');sessionStorage.removeItem('tk');token='';user=null;show('s-login')}

/* ===== UNIDADES: 1) seu n8n (CNES)  2) OpenStreetMap  3) fictícias ===== */
const km=(a,b,c,d)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 12742*Math.asin(Math.sqrt(h))};
async function overpass(l){
  const q='[out:json][timeout:15];nwr(around:6000,'+l.lat+','+l.lng+')[amenity~"^(hospital|clinic|doctors)$"][name];out center 40;';
  const j=await (await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q))).json();
  return j.elements.map(x=>{const la=x.lat!==undefined?x.lat:(x.center&&x.center.lat),lo=x.lon!==undefined?x.lon:(x.center&&x.center.lon),t=x.tags;
    if(la===undefined||lo===undefined)return null;
    return{nome:t.name,endereco:[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', ')||'Endereço não informado',dist:km(l.lat,l.lng,la,lo)}})
    .filter(Boolean).sort((a,b)=>a.dist-b.dist).slice(0,15).map(u=>({...u,distancia:u.dist.toFixed(1)+' km'}))}
async function carregarUnidades(){
  const e=$('#t-unid');e.innerHTML='';e.append(el('h2','','Unidades de saúde'),el('p','','Buscando unidades perto de você…'));
  const loc=await pos();let us=[],fonte='';
  try{us=(await enviarParaEva({message:'listar unidades',context:'unidades',location:loc})).units||[];if(us.length)fonte='Fonte: base do MEDaí.'}catch(_){}
  if(!us.length&&loc)try{us=await overpass(loc);if(us.length)fonte='Fonte: OpenStreetMap (não diferencia SUS de privado).'}catch(_){}
  if(!us.length){us=UN.map(u=>({nome:u.n,endereco:u.e+' – '+user.city,distancia:null}));fonte='Unidades fictícias de demonstração.'}
  e.innerHTML='';e.append(el('h2','','Unidades de saúde'));
  us.forEach(u=>{const c=el('div','card');c.append(el('b','',u.nome),el('div','',u.endereco+(u.distancia?' · '+u.distancia:'')));
    const a=el('a','btn sm','Ver rota');a.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(u.nome+' '+u.endereco);a.target='_blank';a.rel='noopener';a.style.marginTop='8px';c.append(a);e.append(c)});
  const f=el('small','',fonte);f.style.color='var(--muted)';e.append(f)}

/* ===== AVALIAÇÃO DO ATENDIMENTO ===== */
let nota=0;
const stars=$('#stars');
for(let i=1;i<=5;i++){const b=el('button','star','☆');b.type='button';b.setAttribute('aria-label',i+(i>1?' estrelas':' estrela'));
  b.onclick=()=>{nota=i;[...stars.children].forEach((s,j)=>s.textContent=j<i?'★':'☆')};stars.append(b)}
function avaliar(){nota=0;[...stars.children].forEach(s=>s.textContent='☆');$('#rc2').value='';$('#rate').showModal()}
$('#rsend').onclick=async()=>{if(!nota)return;
  const r={conversationId:conv.id,rating:nota,comment:$('#rc2').value.trim(),at:new Date().toISOString()};
  const rs=get('ratings')||[];rs.push(r);put('ratings',rs);
  try{await enviarParaEva({message:'avaliação',context:'avaliacao',...r})}catch(_){}
  $('#rate').close();const t='Obrigada pela avaliação! ⭐';add('e',t);save('e',t)};

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
 ['Sobre o MEDaí','O MEDaí é um assistente virtual de saúde para cidadãos. A Eva orienta sobre serviços de saúde e não faz diagnóstico nem indica medicamentos.'],
 ['Termos e privacidade','Seus dados pessoais (incluindo CPF e CNS) são tratados conforme a LGPD, com o seu consentimento. No modo demonstração, tudo fica apenas neste navegador.']].forEach(([t,x])=>{
  const b=el('button','x',t);b.onclick=()=>{$('#dtx').textContent=x;$('#dlg').showModal()};$('#extras').append(b)});
{const b=el('button','x','Avaliar atendimento');b.onclick=()=>{$('#extras').classList.remove('open');avaliar()};$('#extras').append(b)}
{const b=el('button','x','Sair');b.onclick=sair;$('#extras').append(b)}
$('#more').onclick=()=>$('#extras').classList.toggle('open');

/* ===== MÁSCARAS E VALIDAÇÕES (CPF e CNS) ===== */
const mask=(i,f)=>i.addEventListener('input',()=>i.value=f(i.value.replace(/\D/g,'')));
const mCpf=d=>d.slice(0,11).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
const mCns=d=>d.slice(0,15).replace(/(\d{3})(\d{4})?(\d{4})?(\d{1,4})?/,(_,a,b,c,e)=>[a,b,c,e].filter(Boolean).join(' '));
mask($('#rf'),mCpf);mask($('#lc'),mCpf);mask($('#rs'),mCns);
const cpfOk=s=>{s=s.replace(/\D/g,'');if(s.length!=11||/^(\d)\1+$/.test(s))return false;
  for(let t=9;t<11;t++){let d=0;for(let c=0;c<t;c++)d+=s[c]*(t+1-c);d=((10*d)%11)%10;if(+s[t]!=d)return false}return true};
const cnsOk=s=>{s=s.replace(/\D/g,'');if(s.length!=15)return false;
  if(/^[789]/.test(s)){let t=0;for(let i=0;i<15;i++)t+=s[i]*(15-i);return t%11==0}   // provisório
  if(!/^[12]/.test(s))return false;                                                     // definitivo
  const p=s.slice(0,11);let t=0;for(let i=0;i<11;i++)t+=p[i]*(15-i);let dv=t%11==0?0:11-t%11,r;
  if(dv==10){t+=2;dv=11-t%11;r=p+'001'+dv}else r=p+'000'+dv;return r===s};
$('#rv').onchange=()=>{const v=$('#rv').value;$('#bs').hidden=v!=='sus';$('#bq').hidden=v!=='privado'};

/* ===== AUTENTICAÇÃO: servidor real (AUTH_URL) ou demonstração ===== */
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function auth(path,b){
  if(CONFIG.AUTH_URL){
    const r=await fetch(CONFIG.AUTH_URL+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
    const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||'Não foi possível concluir.');return j}
  // ---- MODO DEMONSTRAÇÃO (inseguro: dados ficam no navegador) ----
  const db=get('demo-users')||{},key=await sha(b.cpf.replace(/\D/g,'')),h=await sha(key+b.password);
  if(path==='/register'){if(db[key])throw new Error('CPF já cadastrado.');
    const {password,cpf,cns,...pub}=b;pub.cpfMask='***.***.'+cpf.slice(8,11)+'-**';pub.hasCNS=!!cns;db[key]={h,u:pub};put('demo-users',db);return{token:'demo',user:pub}}
  if(!db[key]||db[key].h!==h)throw new Error('CPF ou senha incorretos.');return{token:'demo',user:db[key].u}}
function entrar(r){token=r.token;sessionStorage.setItem('tk',token);user=r.user;put('user',user);start()}

/* ===== CADASTRO, LOGIN E INÍCIO ===== */
function start(){show('app');newConv();tab('chat');greet();lembrar()}
$('#go').onclick=()=>token&&user?start():show('s-login');
$('#toreg').onclick=()=>show('s-reg');
$('#tologin').onclick=()=>show('s-login');
$('#reg').onclick=async()=>{let ok=true;
  const chk=(k,c,m)=>{const e=$('#e'+k);e.textContent=c?'':m;e.hidden=c;const i=$('#r'+k);i&&i.classList.toggle('bad',!c);if(!c)ok=false};
  const f={name:$('#rn').value.trim(),email:$('#re').value.trim(),password:$('#rp').value,city:$('#rc').value.trim(),state:$('#ru').value.trim().toUpperCase(),
    cpf:$('#rf').value,coverage:$('#rv').value,cns:$('#rs').value.replace(/\D/g,''),plan:$('#rq').value.trim()};
  chk('n',f.name.length>2,'Informe seu nome.');chk('e',/^\S+@\S+\.\S+$/.test(f.email),'Informe um e-mail válido.');
  chk('p',f.password.length>=8,'A senha precisa ter 8 ou mais caracteres.');chk('c',f.city.length>1,'Informe sua cidade.');
  chk('u',/^[A-Z]{2}$/.test(f.state),'Use a sigla do estado, como SP.');chk('f',cpfOk(f.cpf),'CPF inválido.');
  chk('v',!!f.coverage,'Escolha uma opção.');chk('s',f.coverage!=='sus'||cnsOk(f.cns),'CNS inválido (15 dígitos).');
  chk('q',f.coverage!=='privado'||f.plan.length>1,'Informe o plano.');chk('l',$('#rl').checked,'É preciso concordar para continuar.');
  if(!ok)return;f.consent=true;
  try{entrar(await auth('/register',f))}catch(e){const x=$('#el');x.textContent=e.message;x.hidden=false}};
$('#lgo').onclick=async()=>{const x=$('#le'),cpf=$('#lc').value;x.hidden=true;
  if(!cpfOk(cpf)){x.textContent='CPF inválido.';x.hidden=false;return}
  try{entrar(await auth('/login',{cpf,password:$('#lp').value}))}catch(e){x.textContent=e.message;x.hidden=false}};
$('#lp').addEventListener('keydown',e=>{if(e.key==='Enter')$('#lgo').click()});

$('#demo').hidden=!!CONFIG.WEBHOOK_URL;
show('s-open');
