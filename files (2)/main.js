// Composition root: único lugar que conhece as implementações concretas.
import {LocalStorageAdapter} from './data/storage.js';
import {TaskRepository,UserRepository,SessionStore} from './data/repositories.js';
import {AuthService} from './services/auth.js';
import {TaskService} from './services/tasks.js';
import {StatsService} from './services/stats.js';
import {toast} from './ui/toast.js';
import {initTheme} from './ui/theme.js';
import {renderAuth} from './ui/auth.js';
import {TaskModal} from './ui/taskModal.js';
import * as cal from './ui/calendar.js';
import {dashboard} from './ui/dashboard.js';
import {iso,parse,addDays,fmt} from './utils.js';

const storage=new LocalStorageAdapter();
const auth=new AuthService(new UserRepository(storage),new SessionStore(storage));
const tasks=new TaskService(new TaskRepository(storage),auth);
const stats=new StatsService();
const $=s=>document.querySelector(s);
const TABS={day:'Diária',week:'Semanal',month:'Mensal',year:'Anual',stats:'Estatísticas'};
const state={tab:'day',cursor:new Date(),tasks:[]};

const refresh=async()=>{state.tasks=await tasks.list();draw()};
const modal=new TaskModal($('#modal'),{
  onSave:async(id,d)=>{await tasks.save(id,d);toast(id?'Tarefa atualizada!':'Tarefa criada!');await refresh()},
  onDelete:async id=>{await tasks.remove(id);toast('Tarefa excluída.');await refresh()}
});

function label(){
  const c=state.cursor;
  return{day:fmt(c,{weekday:'long',day:'numeric',month:'long',year:'numeric'}),
    week:`Semana de ${fmt(addDays(c,-c.getDay()),{day:'numeric',month:'short'})}`,
    month:fmt(c,{month:'long',year:'numeric'}),year:String(c.getFullYear()),stats:'Seu desempenho'}[state.tab];
}
function draw(){
  $('.tabs').innerHTML=Object.entries(TABS).map(([k,v])=>`<a href="#/${k}" role="tab" aria-selected="${k===state.tab}">${v}</a>`).join('');
  $('#label').textContent=label();
  $('#nav-ctrl').hidden=state.tab==='stats';
  $('#view').innerHTML=state.tab==='stats'?dashboard(stats.compute(state.tasks)):cal[state.tab](state.cursor,state.tasks);
}
async function route(){
  const user=auth.current();
  $('#auth').hidden=!!user;$('#app').hidden=!user;
  if(!user){ // proteção de rota
    if(location.hash!=='#/login'){location.hash='#/login';return}
    renderAuth($('#auth'),{
      onLogin:async d=>{await auth.login(d);toast('Bem-vindo de volta!');location.hash='#/day';route()},
      onRegister:async d=>{await auth.register(d);toast('Conta criada!');location.hash='#/day';route()}
    });
    return;
  }
  const t=location.hash.slice(2);
  if(!TABS[t]){location.hash='#/day';return}
  state.tab=t;$('#user-name').textContent=user.name;
  $('#view').innerHTML='<div class="loader" role="status">Carregando…</div>';
  await refresh();
}

$('#view').addEventListener('click',async e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  const{act,id,date,hour}=el.dataset,t=state.tasks.find(x=>x.id===id);
  try{
    if(act==='new')modal.open({date,start:hour||''});
    else if(act==='edit')modal.open(t);
    else if(act==='toggle'){const r=await tasks.toggle(id);toast(r.done?'Tarefa concluída! 🎉':'Tarefa reaberta.');await refresh()}
    else if(act==='del'&&confirm(`Excluir "${t.title}"?`)){await tasks.remove(id);toast('Tarefa excluída.');await refresh()}
    else if(act==='month'){state.cursor=parse(date);location.hash='#/month'}
  }catch(err){toast(err.message,'error')}
});
const step=n=>{
  const c=new Date(state.cursor),t=state.tab;
  if(t==='day')c.setDate(c.getDate()+n);else if(t==='week')c.setDate(c.getDate()+7*n);
  else if(t==='month')c.setMonth(c.getMonth()+n,1);else c.setFullYear(c.getFullYear()+n);
  state.cursor=c;draw();
};
$('#prev').onclick=()=>step(-1);$('#next').onclick=()=>step(1);
$('#today').onclick=()=>{state.cursor=new Date();draw()};
$('#new').onclick=()=>modal.open({date:iso(state.cursor)});
$('#logout').onclick=()=>{auth.logout();toast('Você saiu.');location.hash='#/login';route()};
initTheme($('#theme'));
addEventListener('hashchange',route);
route();
