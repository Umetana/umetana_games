(() => {
  'use strict';
  const {Game,cardRect,hitTest}=KBCore;
  const {types,comments}=KBData;
  const game=new Game();
  const $=id=>document.getElementById(id);
  const canvas=$('game'),ctx=canvas.getContext('2d');
  const W=1200,H=720;
  let previous=0,visualTime=0,effects=[],pointer={x:600,y:500,inside:false},lastStatus='ready',audio=null,sound=false,shake=0;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const weaponNames={delete:'DELETE',timeout:'TIMEOUT',ban:'BAN'};
  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function text(value,x,y,size=14,color='#b7c5db',align='left',font='sans-serif'){ctx.fillStyle=color;ctx.font=`${size}px ${font}`;ctx.textAlign=align;ctx.fillText(value,x,y);}
  function beep(kind){
    if(!sound)return;
    try{
      audio ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audio.state==='suspended')void audio.resume().catch(()=>{});
      const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
      const bad=['wrong','friendly','miss'].includes(kind);
      osc.type=bad?'triangle':'sine';osc.frequency.setValueAtTime(bad?180:kind==='pass'?660:880,now);osc.frequency.exponentialRampToValueAtTime(bad?80:1320,now+.10);
      gain.gain.setValueAtTime(.035,now);gain.gain.exponentialRampToValueAtTime(.001,now+.15);
      osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(now+.16);
    }catch{sound=false;$('sound').textContent='効果音 利用不可';$('sound').setAttribute('aria-pressed','false');}
  }
  function updateHud(){
    const gain=game.subscribers-game.config.initialSubscribers;
    $('subscribers').textContent=game.subscribers.toLocaleString('ja-JP');
    $('delta').textContent=`${gain>=0?'+':''}${gain}`;
    $('delta').style.color=gain<0?types.ban.color:types.pass.color;
    $('goal-bar').style.width=`${Math.max(0,Math.min(100,gain/game.config.targetGain*100))}%`;
    $('goal-caption').textContent=gain>=game.config.targetGain?'目標達成！最後まで配信を守ろう':`あと${game.config.targetGain-gain}人で目標達成`;
    $('tension').textContent=`${game.tension}%`;
    $('tension-bar').style.width=`${game.tension}%`;
    $('tension-bar').style.background=game.tension<=30?types.ban.color:types.pass.color;
    const time=Math.max(0,game.config.duration-game.time).toFixed(1).split('.');
    $('timer').replaceChildren(document.createTextNode(time[0]),Object.assign(document.createElement('span'),{textContent:`.${time[1]}`}));
    $('timer').style.color=game.config.duration-game.time<=10?types.ban.color:'';
    $('combo').textContent=`COMBO ${String(game.combo).padStart(2,'0')}`;
    $('live-label').textContent=game.status==='playing'?'LIVE':game.status==='paused'?'PAUSED':game.status==='finished'?'OFF AIR':'STANDBY';
    $('pause').disabled=!['playing','paused'].includes(game.status);
    $('pause').textContent=game.status==='paused'?'再開 Esc':'一時停止 Esc';
    $('weapon-caption').textContent=`装備中：${weaponNames[game.weapon]}`;
    $('weapon-caption').style.color=types[game.weapon].color;
    document.querySelectorAll('[data-weapon]').forEach(b=>{const active=b.dataset.weapon===game.weapon;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  }
  function showOverlay(mode){
    $('overlay').hidden=false;
    const paused=mode==='paused';
    $('intro-tags').hidden=true;
    $('restart').hidden=!paused;
    $('result-stats').hidden=paused;
    if(paused){
      $('overlay-kicker').textContent='TAKE A BREAK';
      $('overlay-title').textContent='配信を一時停止中';
      $('overlay-copy').textContent='準備ができたら、迎撃を再開しよう。';
      $('start').textContent='配信にもどる →';
      $('overlay-foot').textContent='Escキーでも再開できます';
    }else{
      const {success,reason,gain}=game.result;
      $('overlay-kicker').textContent=success?'MISSION COMPLETE':'STREAM ENDED';
      $('overlay-title').textContent=success?'配信、大成功！':reason==='tension'?'テンションが限界…':'目標まで、あと少し！';
      $('overlay-copy').textContent=`登録者 ${game.subscribers.toLocaleString('ja-JP')}人（${gain>=0?'+':''}${gain}人） / 目標 +${game.config.targetGain}人`;
      const entries=[['正しい迎撃',game.stats.correct],['見送り成功',game.stats.passed],['誤対応',game.stats.wrong+game.stats.friendly],['見逃し',game.stats.missed]];
      $('result-stats').replaceChildren(...entries.map(([label,value])=>{const div=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=value;span.textContent=label;div.append(strong,span);return div;}));
      $('start').textContent='もう一度プレイ →';
      $('overlay-foot').textContent=`最大コンボ ${game.maxCombo} / テンション ${game.tension}% / 緑は見送り、青・黄・赤は武器を合わせよう`;
      $('announcement').textContent=`${$('overlay-title').textContent} ${$('overlay-copy').textContent}`;
    }
    $('start').focus({preventScroll:true});
  }
  function start(){
    if(game.status==='paused')game.resume();else{game.start();effects=[];shake=0;}
    $('overlay').hidden=true;pointer.inside=false;previous=performance.now();updateHud();canvas.focus({preventScroll:true});
  }
  function togglePause(){
    if(game.status==='playing'){game.pause();showOverlay('paused');}
    else if(game.status==='paused')start();
    updateHud();
  }
  function consumeEvents(){
    for(const event of game.drainEvents()){
      if(event.kind==='finish'){showOverlay('finished');continue;}
      if(event.kind==='empty')continue;
      const r=cardRect(event.card,game.config.flightTime,W,H);
      const bad=['wrong','friendly','miss'].includes(event.kind);
      const labels={correct:'NICE!',pass:'THANK YOU!',wrong:'武器が違う！',friendly:'誤射！ 見送り対象',miss:'コメント到達！'};
      effects.push({x:event.kind==='miss'||event.kind==='pass'?600:r.x,y:event.kind==='miss'||event.kind==='pass'?185:r.y,age:0,color:bad?types.ban.color:types[event.card.type].color,label:labels[event.kind],amount:event.amount});
      if(bad&&!reducedMotion)shake=.18;
      beep(event.kind);
    }
  }
  function background(){
    const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#152039');grad.addColorStop(.55,'#1b2840');grad.addColorStop(1,'#101923');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    const glow=ctx.createRadialGradient(600,230,30,600,230,430);glow.addColorStop(0,'#4c647938');glow.addColorStop(1,'#4c647900');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#42567438';ctx.lineWidth=1;
    for(let x=-W;x<=W*2;x+=130){ctx.beginPath();ctx.moveTo(600,250);ctx.lineTo(x,H);ctx.stroke();}
    for(let i=0;i<8;i++){const y=310+i*i*8;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    rounded(130,108,220,180,7,'#1e2b4280','#36445d');rounded(151,130,178,11,3,'#455775');
    for(let i=0;i<5;i++)rounded(151,157+i*21,90+(i%3)*31,5,2,'#33455d');
    rounded(850,108,220,180,7,'#1e2b4280','#36445d');text('ON AIR',960,151,15,'#ff758d','center','Consolas');
    for(let i=0;i<9;i++){const h=15+Math.sin(visualTime*1.7+i)*12;rounded(886+i*17,230-h,8,h,2,'#67c9ff50');}
    ctx.setLineDash([3,10]);ctx.strokeStyle='#96b8d333';ctx.beginPath();ctx.ellipse(600,284,164,35,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    text('STREAMER',600,94,11,'#92a7c7','center','Consolas');
    avatar();
    text('受信エリア',600,335,11,'#657b99','center');
    if(game.status==='ready'){
      const demo=[
        {...comments.find(card=>card.type==='delete'),originX:.2,originY:.78,age:.3},
        {...comments.find(card=>card.type==='pass'),originX:.79,originY:.8,age:.5}
      ];
      demo.forEach(drawCard);
    }
  }
  function avatar(){
    ctx.save();ctx.translate(600,210+(reducedMotion?0:Math.sin(visualTime*2)*2));
    // 外部画像を使わない仮配信者。後から画像描画に差し替え可能。
    rounded(-70,1,140,85,45,'#4b4f88','#7780b0');
    rounded(-74,-85,148,148,60,'#8584bd');
    rounded(-50,-65,100,103,40,'#f5d5c9');
    ctx.fillStyle='#8584bd';ctx.beginPath();ctx.moveTo(-54,-65);ctx.quadraticCurveTo(0,-120,57,-59);ctx.lineTo(49,-20);ctx.lineTo(13,-62);ctx.lineTo(0,-33);ctx.lineTo(-15,-64);ctx.lineTo(-47,-17);ctx.closePath();ctx.fill();
    rounded(-83,-49,20,52,8,'#28384f','#67c9ff');rounded(63,-49,20,52,8,'#28384f','#67c9ff');
    ctx.strokeStyle='#67c9ff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-30,77,Math.PI,Math.PI*2);ctx.stroke();
    const stressed=game.tension<=30;
    ctx.strokeStyle='#55436a';ctx.lineWidth=3;ctx.lineCap='round';
    for(const x of [-22,22]){ctx.beginPath();if(stressed){ctx.moveTo(x-5,-12);ctx.lineTo(x+5,-5);}else{ctx.moveTo(x-6,-11);ctx.quadraticCurveTo(x,-20,x+6,-11);}ctx.stroke();}
    ctx.strokeStyle='#be747c';ctx.beginPath();if(stressed){ctx.moveTo(-7,12);ctx.quadraticCurveTo(0,6,7,12);}else{ctx.moveTo(-8,7);ctx.quadraticCurveTo(0,18,8,7);}ctx.stroke();
    rounded(-38,-1,13,5,2,'#e6a9aa');rounded(25,-1,13,5,2,'#e6a9aa');
    ctx.fillStyle='#c1d3e4';ctx.beginPath();ctx.moveTo(-14,40);ctx.lineTo(0,67);ctx.lineTo(14,40);ctx.closePath();ctx.fill();
    rounded(-105,78,210,13,4,'#334156','#62788b');
    ctx.strokeStyle='#8193a9';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(60,78);ctx.lineTo(49,39);ctx.stroke();rounded(40,20,18,28,7,'#23334b','#91a7be');
    ctx.restore();
  }
  function drawCard(card){
    const r=cardRect(card,game.config.flightTime,W,H),type=types[card.type];
    ctx.save();ctx.translate(r.x,r.y);ctx.scale(r.scale,r.scale);
    ctx.shadowColor='#0007';ctx.shadowBlur=20;ctx.shadowOffsetY=8;
    rounded(-150,-41.5,300,83,9,'#162434',type.color);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.globalAlpha=.12;rounded(-150,-41.5,300,83,9,type.color);ctx.globalAlpha=1;
    rounded(-150,-41.5,4,83,2,type.color);
    text(type.label,-134,-16,12,type.color,'left','Consolas, sans-serif');
    text('VIEWER',133,-16,10,'#95a7bd','right','Consolas');
    text(card.text,-134,15,16,'#f0f4fc');
    ctx.globalAlpha=.5;rounded(-134,29,267,2,1,'#758399');ctx.globalAlpha=1;rounded(-134,29,267*(1-r.p),2,1,type.color);
    ctx.restore();
  }
  function drawEffects(dt){
    effects=effects.filter(e=>e.age<.9);
    for(const e of effects){e.age+=dt;ctx.save();ctx.globalAlpha=Math.max(0,1-e.age/.9);ctx.strokeStyle=e.color;ctx.lineWidth=2;
      const radius=12+e.age*70;ctx.beginPath();ctx.arc(e.x,e.y,radius,0,Math.PI*2);ctx.stroke();
      text(e.label,e.x,e.y-25-e.age*38,17,e.color,'center');text(`${e.amount>0?'+':''}${e.amount}人`,e.x,e.y-e.age*38,13,e.color,'center');ctx.restore();}
  }
  function crosshair(){
    if(!pointer.inside||game.status!=='playing')return;
    ctx.save();ctx.translate(pointer.x,pointer.y);ctx.strokeStyle=types[game.weapon].color;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.stroke();
    for(const [x,y,dx,dy] of [[-23,0,-9,0],[9,0,23,0],[0,-23,0,-9],[0,9,0,23]]){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(dx,dy);ctx.stroke();}
    ctx.fillStyle=types[game.weapon].color;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  let lastHud=0;
  function frame(now){
    const dt=previous?Math.max(0,(now-previous)/1000):0;previous=now;
    if(game.status==='playing'){game.update(dt);visualTime+=dt;consumeEvents();}
    else if(game.status==='ready')visualTime+=dt;
    const dpr=Math.min(window.devicePixelRatio||1,2),rect=canvas.getBoundingClientRect();
    const width=Math.round(rect.width*dpr),height=Math.round(rect.height*dpr);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.save();
    if(shake>0&&game.status==='playing'){shake-=dt;ctx.translate(Math.sin(now*.08)*shake*25,0);}
    background();[...game.cards].sort((a,b)=>b.age-a.age).forEach(drawCard);
    drawEffects(game.status==='playing'?dt:0);crosshair();ctx.restore();
    if(now-lastHud>80||lastStatus!==game.status){updateHud();lastHud=now;lastStatus=game.status;}
    requestAnimationFrame(frame);
  }
  function locate(event){const r=canvas.getBoundingClientRect();pointer={x:(event.clientX-r.left)/r.width*W,y:(event.clientY-r.top)/r.height*H,inside:true};}
  canvas.addEventListener('pointermove',locate);
  canvas.addEventListener('pointerleave',()=>pointer.inside=false);
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||game.status!=='playing')return;
    event.preventDefault();canvas.focus({preventScroll:true});locate(event);
    const card=hitTest(game.cards,pointer.x,pointer.y,game.config.flightTime,W,H);
    game.shoot(card?.uid);consumeEvents();updateHud();
  });
  document.querySelectorAll('[data-weapon]').forEach(button=>button.addEventListener('click',()=>{game.selectWeapon(button.dataset.weapon);updateHud();}));
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.target.isContentEditable)return;
    if(['1','2','3'].includes(event.key)&&!event.repeat){game.selectWeapon(['delete','timeout','ban'][Number(event.key)-1]);updateHud();}
    if(event.key==='Escape'&&!event.repeat){event.preventDefault();togglePause();}
  });
  window.addEventListener('blur',()=>{if(game.status==='playing')togglePause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.status==='playing')togglePause();});
  $('pause').addEventListener('click',togglePause);
  $('start').addEventListener('click',start);
  $('restart').addEventListener('click',()=>{game.start();effects=[];shake=0;$('overlay').hidden=true;previous=performance.now();canvas.focus({preventScroll:true});updateHud();});
  $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=`効果音 ${sound?'ON':'OFF'}`;$('sound').setAttribute('aria-pressed',String(sound));if(sound)beep('correct');});
  updateHud();requestAnimationFrame(frame);
})();
