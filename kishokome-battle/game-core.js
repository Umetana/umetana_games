(function(root){
  'use strict';
  const data=typeof module!=='undefined'&&module.exports?require('./data.js'):root.KBData;
  class Game{
    constructor({config={},random=Math.random}={}){this.config={...data.config,...config};this.random=random;this.reset();}
    reset(){this.status='ready';this.time=0;this.subscribers=this.config.initialSubscribers;this.tension=this.config.initialTension;this.weapon='delete';this.cards=[];this.events=[];this.combo=0;this.maxCombo=0;this.nextSpawn=.7;this.serial=0;this.stats={correct:0,passed:0,wrong:0,friendly:0,missed:0,shots:0};this.result=null;}
    start(){this.reset();this.status='playing';}
    pause(){if(this.status==='playing')this.status='paused';}
    resume(){if(this.status==='paused')this.status='playing';}
    selectWeapon(type){if(['delete','timeout','ban'].includes(type))this.weapon=type;}
    emit(kind,card,amount=0){this.events.push({kind,card:card?{...card}:null,amount,combo:this.combo});}
    advanceCombo(){this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);}
    spawn(){
      // 初回は各色を順番に提示。その後は緑を約30%とする。
      const initial=['pass','delete','timeout','ban'];
      const roll=this.random();
      const type=initial[this.serial]|| (roll<.30?'pass':roll<.54?'delete':roll<.78?'timeout':'ban');
      const pool=data.comments.filter(c=>c.type===type);
      const source=pool[Math.min(pool.length-1,Math.floor(this.random()*pool.length))];
      const lane=this.serial%4;
      const x=[.17,.73,.37,.82][lane]+(this.random()-.5)*.05;
      this.cards.push({...source,uid:++this.serial,age:0,originX:x,originY:lane%2?.88:.76});
    }
    update(dt){
      if(this.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;
      // 大きな時間差でも出現・着弾を順序通りに計算する。
      let remaining=Math.min(dt,this.config.duration-this.time);
      while(remaining>1e-8&&this.status==='playing'){
        const step=Math.min(remaining,1/60);remaining-=step;this.time=Math.min(this.config.duration,this.time+step);
        for(const card of [...this.cards]){
          card.age+=step;
          if(card.age>=this.config.flightTime){
            this.cards=this.cards.filter(c=>c.uid!==card.uid);
            if(card.type==='pass'){this.stats.passed++;this.subscribers+=this.config.passReward;this.advanceCombo();this.emit('pass',card,this.config.passReward);}
            else{this.stats.missed++;this.subscribers=Math.max(0,this.subscribers-this.config.missPenalty);this.tension=Math.max(0,this.tension-this.config.missDamage);this.combo=0;this.emit('miss',card,-this.config.missPenalty);}
            if(this.tension<=0){this.finish('tension');break;}
          }
        }
        if(this.status!=='playing')break;
        if(this.time>=this.nextSpawn&&this.time<this.config.duration-this.config.flightTime){
          if(this.cards.length<this.config.maxCards)this.spawn();
          this.nextSpawn=this.time+this.config.spawnInterval;
        }
        if(this.time>=this.config.duration-1e-7)this.finish('time');
      }
    }
    shoot(uid){
      if(this.status!=='playing')return;
      this.stats.shots++;
      const card=this.cards.find(c=>c.uid===uid);
      if(!card){this.emit('empty');return;}
      if(card.type===this.weapon){this.cards=this.cards.filter(c=>c.uid!==uid);this.stats.correct++;this.subscribers+=this.config.correctReward;this.advanceCombo();this.emit('correct',card,this.config.correctReward);}
      else if(card.type==='pass'){this.cards=this.cards.filter(c=>c.uid!==uid);this.stats.friendly++;this.subscribers=Math.max(0,this.subscribers-this.config.friendlyPenalty);this.combo=0;this.emit('friendly',card,-this.config.friendlyPenalty);}
      else{this.stats.wrong++;this.subscribers=Math.max(0,this.subscribers-this.config.wrongPenalty);this.combo=0;this.emit('wrong',card,-this.config.wrongPenalty);}
    }
    finish(reason){if(this.status!=='playing')return;const gain=this.subscribers-this.config.initialSubscribers;this.status='finished';this.result={success:reason==='time'&&this.tension>0&&gain>=this.config.targetGain,reason,gain};this.emit('finish');}
    drainEvents(){return this.events.splice(0);}
  }
  function cardRect(card,flightTime,width=1200,height=720){
    const p=Math.min(1,Math.max(0,card.age/flightTime));
    const scale=1-.79*p;
    return {x:(card.originX*(1-p)+.5*p)*width,y:(card.originY*(1-p)+.32*p)*height,w:300*scale*width/1200,h:83*scale*height/720,scale,p};
  }
  function hitTest(cards,x,y,flightTime,width=1200,height=720){
    // 描画順と逆に検査し、手前のカードを優先。
    return [...cards].sort((a,b)=>a.age-b.age).find(card=>{const r=cardRect(card,flightTime,width,height);return Math.abs(x-r.x)<=r.w/2&&Math.abs(y-r.y)<=r.h/2;});
  }
  const api={Game,cardRect,hitTest};root.KBCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
