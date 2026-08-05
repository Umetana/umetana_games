(function(){
  "use strict";
  /* 素材完成後に相対パスを追加します。空文字は読み込みません。 */
  var SOURCES={bgm:"./assets/audio/bgm/nonogram001.mp3",se:{input:"",line:"",mistake:"",clear:"",button:""},voice:{start:["./assets/audio/voice/ikuyo.mp3"],mistake:["./assets/audio/voice/zannen.mp3"],clear:["./assets/audio/voice/clear.mp3"]}};
  var bgm=null,lastVoice="",lastMistakeVoiceAt=0;
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
  window.GameAudio={
    startBgm:function(){if(enabled("bgm")&&SOURCES.bgm&&!bgm)bgm=playFile(SOURCES.bgm,.22,true);},
    sync:function(){if(!enabled("bgm")&&bgm){bgm.pause();bgm=null;}else this.startBgm();},
    se:function(name){if(enabled("se"))playFile(SOURCES.se[name],.55,false);},
    voice:function(name){
      if(!enabled("voice"))return;
      if(name==="mistake"&&Date.now()-lastMistakeVoiceAt<850)return;
      if(name==="mistake")lastMistakeVoiceAt=Date.now();
      playFile(pick(SOURCES.voice[name]),.75,false);
    }
  };
})();
