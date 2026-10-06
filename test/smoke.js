const E = require('../src/engine');
const D = require('../src/data');
const s = E.createGame('T');
['a','b','c'].forEach((id,i)=>{E.addPlayer(s,id,'Spieler '+id); E.act(s,id,{type:'chooseFaction',faction:Object.keys(D.FACTIONS)[i]});});
E.act(s,'a',{type:'start'}); if(process.env.NOCUST){s.custodians=false;}
const safe=(pid,a)=>{const c=JSON.parse(JSON.stringify(s));try{E.act(c,pid,a);Object.assign(s,c);return true;}catch(e){if(!(e instanceof E.RuleError))throw e;return e.message;}};
// strategy picks
let cards=[1,2,3,4,5,6,7,8];
while(s.phase==='strategy'){const pid=s.wait.players[0];const r=safe(pid,{type:'pick',card:s.strategyPool[0]});if(r!==true)throw r;}
console.log('phase',s.phase,'turn',s.turn.player, s.players.map(p=>p.name+':'+p.cards));
// active player: tactical move from home to a neighbor with a planet, invade
const p=E.player(s,s.turn.player); const home=s.map[p.homeKey];
const nbs=Object.values(s.map).filter(x=>x.planets.length&&!x.home&&E.pathInfo(s,p,home.key,x.key)&&E.pathInfo(s,p,home.key,x.key).dist<=1);
console.log('targets',nbs.map(x=>x.key+' '+x.planets.map(p=>p.name)));
const t=nbs[0];
console.log(safe(p.id,{type:'activate',system:t.key}));
console.log(safe(p.id,{type:'move',moves:[{from:home.key,ships:{carrier:1},fromPlanets:{[home.planets[0].name]:2}}]}));
console.log(safe(p.id,{type:'invade',landings:{[t.planets[0].name]:2}}));
console.log(t.planets[0], s.log.slice(-4));
console.log(safe(p.id,{type:'skipStage'}));
console.log(safe(p.id,{type:'endTurn'}));
console.log('next',s.turn.player);
// random play: everyone uses strategy cards then passes, through several rounds
for(let step=0;step<3000&&s.phase!=='ended';step++){
  const w=s.wait; if(!w) throw new Error('no wait in '+s.phase);
  const pid=w.players[0]; const q=E.player(s,pid);
  if(w.type==='pick'){safe(pid,{type:'pick',card:s.strategyPool[Math.floor(Math.random()*s.strategyPool.length)]});continue;}
  if(w.type==='secondary'){safe(pid,{type:'secondary',skip:true});continue;}
  if(w.type==='status'){const tot=q.tokens.tactic+q.tokens.fleet+q.tokens.strategy+2+(q.techs.includes('g_spark')?1:0);const v=E.view(s,pid).players.find(x=>x.id===pid).eligible;
    const r=safe(pid,{type:'status',publicId:v.public[0],secretId:v.secret[0],tokens:{tactic:Math.max(0,tot-4),fleet:tot-Math.max(0,tot-4)-1,strategy:1}}); if(r!==true) throw new Error(r); continue;}
  if(w.type==='vote'){const r=safe(pid,{type:'vote',outcome:Math.random()<.5?'for':s.seat[0],planets:Object.values(s.map).flatMap(x=>x.planets.filter(p=>p.owner===pid&&!p.exhausted).map(p=>p.name))}); if(r!==true) safe(pid,{type:'vote',outcome:null}); continue;}
  if(w.type==='turn'){
    const T=s.turn;
    if(T.step==='choose'){const c=q.cards.find(c=>!q.used.includes(c));
      if(c){const params={1:{dist:{tactic:3}},3:{speaker:s.seat.find(x=>x!==pid)},5:{},8:{}}[c];
        if(params&&safe(pid,{type:'strategy',card:c,...params})===true) continue;
        // fallback: mark by trying generic
        const ctrl=Object.values(s.map).flatMap(x=>x.planets.filter(p=>p.owner===pid));
        if(c===4&&safe(pid,{type:'strategy',card:4,planet:ctrl[0].name,type2:1,type:'strategy'})===true)continue;
        const tries=[{card:c,planet:ctrl[0].name,type:'strategy'}];
        let ok=false;
        for(const tech of Object.keys(D.TECHS)) if(safe(pid,{type:'strategy',card:c,tech})===true){ok=true;break;}
        if(ok)continue;
        const ownSys=Object.values(s.map).find(x=>x.planets.some(p=>p.owner===pid)&&!x.throne);
        if(safe(pid,{type:'strategy',card:c,system:ownSys.key,ready:[]})===true)continue;
        const tok=Object.values(s.map).find(x=>x.tokens.includes(pid));
        if(tok&&safe(pid,{type:'strategy',card:c,system:tok.key,pool:'tactic'})===true)continue;
        // fallback for 4: struct with structure type in field "type" conflicts; skip by using as 'used'
        q.used.push(c); continue;
      }
      // try a random tactical action toward a random neighbor
      if(q.tokens.tactic>0 && Math.random()<0.8){
        const mine=Object.values(s.map).filter(x=>(x.ships[pid]&&Object.keys(x.ships[pid]).length)&&!x.tokens.includes(pid));
        const from=mine[Math.floor(Math.random()*mine.length)];
        if(from){const tg=Object.values(s.map).filter(x=>x.key!==from.key&&!x.tokens.includes(pid)&&E.pathInfo(s,q,from.key,x.key)&&E.pathInfo(s,q,from.key,x.key).dist<=1);
          const to=tg[Math.floor(Math.random()*tg.length)];
          if(to&&safe(pid,{type:'activate',system:to.key})===true){
            const ships={...from.ships[pid]}; delete ships.infantry; delete ships.fighter;
            safe(pid,{type:'move',moves:[{from:from.key,ships,infantry:Math.min(from.ships[pid]?.infantry||0, 2)}]});
            if(s.turn&&s.turn.tactical&&s.turn.tactical.stage==='invade'){const inf=(to.ships[pid]||{}).infantry||0; if(inf&&to.planets.length) {const r=safe(pid,{type:'invade',landings:{[to.planets[0].name]:inf},custodianPay:{planets:Object.values(s.map).flatMap(x=>x.planets.filter(p=>p.owner===pid&&!p.exhausted).map(p=>p.name)),tg:q.tg}}); } else safe(pid,{type:'skipStage'});}
            if(s.turn&&s.turn.tactical&&s.turn.tactical.stage==='invade') safe(pid,{type:'skipStage'});
            if(s.turn&&s.turn.tactical&&s.turn.tactical.stage==='produce'){safe(pid,{type:'produce',build:{infantry:2,fighter:2},pay:{planets:Object.values(s.map).flatMap(x=>x.planets.filter(p=>p.owner===pid&&!p.exhausted).map(p=>p.name))}});}
            if(s.turn&&s.turn.player===pid&&s.wait.type==='turn'){ if(s.turn.tactical) safe(pid,{type:'skipStage'}); safe(pid,{type:'endTurn'});}
            continue;
          }
        }
      }
      const r=safe(pid,{type:'pass'}); if(r!==true) throw new Error('pass: '+r);
    } else { const r=safe(pid,{type:'endTurn'}); if(r!==true){ safe(pid,{type:'skipStage'}); safe(pid,{type:'endTurn'});} }
  }
}
console.log('round',s.round,'phase',s.phase,'vp',s.players.map(p=>p.name+' '+p.vp), 'custodians',s.custodians);
if(process.env.GREP)console.log(s.log.filter(l=>l.msg.includes(process.env.GREP)).length,'hits');
console.log(s.log.slice(-15).map(l=>l.msg).join('\n'));
