(function(){
  "use strict";
  var KEY="kidsNonogramSave";
  var VERSION=1;
  var available=true;
  var memory={version:VERSION,progress:{},cleared:[],sound:{bgm:true,se:true,voice:true}};

  function normalize(raw){
    var data=raw&&typeof raw==="object"?raw:{};
    return {
      version:VERSION,
      progress:data.progress&&typeof data.progress==="object"?data.progress:{},
      cleared:Array.isArray(data.cleared)?data.cleared.filter(function(x){return typeof x==="string";}):[],
      sound:Object.assign({bgm:true,se:true,voice:true},data.sound||{})
    };
  }
  try{
    var parsed=JSON.parse(localStorage.getItem(KEY)||"null");
    memory=parsed&&parsed.version===VERSION?normalize(parsed):normalize(null);
  }catch(error){available=false;}
  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(memory));available=true;return true;}
    catch(error){available=false;return false;}
  }
  window.SaveStore={
    get:function(){return memory;},
    isAvailable:function(){return available;},
    setProgress:function(id,value){memory.progress[id]=value;persist();},
    removeProgress:function(id){delete memory.progress[id];persist();},
    markCleared:function(id){if(memory.cleared.indexOf(id)<0)memory.cleared.push(id);persist();},
    isCleared:function(id){return memory.cleared.indexOf(id)>=0;},
    setSound:function(key,value){memory.sound[key]=!!value;persist();},
    latest:function(){
      return Object.keys(memory.progress).map(function(id){return memory.progress[id];})
        .filter(Boolean).sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0);})[0]||null;
    }
  };
})();
