(function(){
  "use strict";
  var SOURCES={bgm:"./assets/audio/bgm/nonogram001.mp3",voice:{start:["./assets/audio/voice/ikuyo.mp3"],mistake:["./assets/audio/voice/zannen.mp3"],clear:["./assets/audio/voice/clear.mp3"]}};
  var bgm=null,audioContext=null,lastVoice="",lastMistakeVoiceAt=0,lastInputAt=0,inputStep=0;
  function enabled(kind){return SaveStore.get().sound[kind]!==false;}
  function playFile(path,volume,loop){
    if(!path)return null;
    try{var audio=new Audio(path);audio.volume=volume;audio.loop=!!loop;audio.play().catch(function(){});return audio;}catch(error){return null;}
  }
  function pick(list){
    if(!list||!list.length)return "";
    var choices=list.filter(function(x){return x&&x!==lastVoice;});
    var path=(choices.length?choices:list)[Math.floor(Math.random()*(choices.length||list.length))];lastVoice=path;return path;
  }
  function context(){
    if(!audioContext){
      var AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)return null;
      try{audioContext=new AudioContext();}catch(error){return null;}
    }
    if(audioContext.state==="suspended")audioContext.resume().catch(function(){});
    return audioContext;
  }
  function tone(ctx,type,frequency,start,duration,volume,endFrequency){
    var oscillator=ctx.createOscillator(),gain=ctx.createGain(),end=start+duration;
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,start);
    if(endFrequency)oscillator.frequency.exponentialRampToValueAtTime(endFrequency,end);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(volume,start+Math.min(.012,duration*.2));
    gain.gain.exponentialRampToValueAtTime(.0001,end);
    oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start);oscillator.stop(end+.01);
  }
  function synth(name){
    var ctx=context();if(!ctx)return;var now=ctx.currentTime+.005;
    if(name==="input"){
      var stamp=Date.now();if(stamp-lastInputAt<32)return;
      inputStep=stamp-lastInputAt>450?0:(inputStep+1)%5;lastInputAt=stamp;
      tone(ctx,"sine",[330,370,415,466,523][inputStep],now,.065,.70,[430,480,540,605,680][inputStep]);
    }else if(name==="button"){
      tone(ctx,"sine",360,now,.045,.65,450);
    }else if(name==="line"){
      tone(ctx,"sine",659.25,now,.13,.08,783.99);tone(ctx,"sine",987.77,now+.045,.16,.65,1174.66);
    }else if(name==="mistake"){
      tone(ctx,"triangle",210,now,.16,.7,135);
    }else if(name==="clear"){
      [523.25,659.25,783.99,1046.5].forEach(function(frequency,index){tone(ctx,"triangle",frequency,now+index*.095,.34,.8,frequency*1.015);});
    }
  }
  window.GameAudio={
    startBgm:function(){if(enabled("bgm")&&SOURCES.bgm&&!bgm)bgm=playFile(SOURCES.bgm,.22,true);},
    sync:function(){if(!enabled("bgm")&&bgm){bgm.pause();bgm=null;}else this.startBgm();},
    se:function(name){if(enabled("se"))synth(name);},
    voice:function(name){
      if(!enabled("voice"))return;
      if(name==="mistake"&&Date.now()-lastMistakeVoiceAt<850)return;
      if(name==="mistake")lastMistakeVoiceAt=Date.now();
      playFile(pick(SOURCES.voice[name]),.75,false);
    }
  };
})();
