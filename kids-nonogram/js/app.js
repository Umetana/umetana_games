(function(){
  "use strict";
  var $=function(s){return document.querySelector(s);};
  var $$=function(s){return Array.from(document.querySelectorAll(s));};
  var screens={title:$("#title-screen"),select:$("#select-screen"),game:$("#game-screen")};
  var boardEl=$("#board"),rowClues=$("#row-clues"),columnClues=$("#column-clues");
  var current=null,board=[],history=[],mistakes=0,mode="fill",locked=false;
  var gesture=null,previousComplete=null,lastFocus=null;

  function showScreen(name){Object.keys(screens).forEach(function(key){screens[key].classList.toggle("active",key===name);});window.scrollTo(0,0);}
  function imageOrPlaceholder(puzzle,hidden){
    if(hidden)return '<div class="puzzle-art" aria-hidden="true">?</div>';
    if(puzzle.image)return '<div class="puzzle-art"><img src="'+puzzle.image+'" alt="'+puzzle.name+'"></div>';
    return '<div class="puzzle-art" aria-hidden="true">'+puzzle.placeholder+'</div>';
  }
  function renderPuzzleList(){
    $("#puzzle-list").innerHTML=validPuzzles.map(function(p){
      var done=SaveStore.isCleared(p.id);
      return '<button class="puzzle-card '+(done?'cleared':'')+'" data-puzzle="'+p.id+'">'+imageOrPlaceholder(p,!done)+
        '<div class="puzzle-meta"><span>ステージ '+p.stage+'</span><span class="badge">'+(done?'✓ できた！':'まだだよ')+'</span></div>'+
        '<h3 class="puzzle-name">'+(done?p.name:'？？？')+'</h3></button>';
    }).join("");
    $$("[data-puzzle]").forEach(function(button){button.addEventListener("click",function(){startPuzzle(button.dataset.puzzle,false);});});
  }
  function refreshContinue(){
    var candidates=Object.keys(SaveStore.get().progress).map(function(id){return SaveStore.get().progress[id];}).sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0);});
    var latest=candidates.find(function(saved){var p=validPuzzles.find(function(x){return x.id===saved.id;});return p&&GameRules.validSave(saved,p);});
    $("#continue-button").disabled=!latest;
  }
  function renderBoard(){
    boardEl.innerHTML=Array.from({length:100},function(_,i){return '<button class="cell" role="gridcell" aria-label="'+(Math.floor(i/10)+1)+'ぎょう '+(i%10+1)+'れつ" data-cell="'+i+'" tabindex="-1"></button>';}).join("");
    var row=GameRules.clues(current.solution),col=GameRules.clues(GameRules.columnLines(current.solution));
    rowClues.innerHTML=row.map(function(x,i){return '<div class="clue" data-row="'+i+'">'+x.map(String).join('<span aria-hidden="true"> </span>')+'</div>';}).join("");
    columnClues.innerHTML=col.map(function(x,i){return '<div class="clue" data-col="'+i+'">'+x.join('<br>')+'</div>';}).join("");
    paintAll();previousComplete=GameRules.completed(current,board);updateCompleted(false);
  }
  function paintCell(i){var cell=boardEl.children[i];cell.classList.toggle("filled",board[i]===1);cell.classList.toggle("cross",board[i]===2);cell.setAttribute("aria-label",(Math.floor(i/10)+1)+"ぎょう "+(i%10+1)+"れつ "+(board[i]===1?'ぬり':board[i]===2?'ばつ':'から'));
  }
  function paintAll(){board.forEach(function(_,i){paintCell(i);});}
  function updateStatus(){
    $("#mistake-count").textContent="おっと！ "+mistakes+"かい";
    var status=$("#save-status");status.textContent=SaveStore.isAvailable()?"":"きろくを保存できません";status.classList.toggle("save-warning",!SaveStore.isAvailable());
    $("#undo-button").disabled=!history.length||locked;$("#hint-button").disabled=locked||!hasHint();
  }
  function save(){if(!current||locked)return;SaveStore.setProgress(current.id,{id:current.id,revision:current.revision,board:board.slice(),history:history.slice(-100),mistakes:mistakes,updatedAt:Date.now()});updateStatus();refreshContinue();}
  function hasHint(){return current&&current.solution.some(function(row,r){return row.split("").some(function(x,c){return x==="1"&&board[r*10+c]===0;});});}
  function updateCompleted(withSound){
    var now=GameRules.completed(current,board),newly=false;
    now.rows.forEach(function(done,i){rowClues.children[i].classList.toggle("done",done);if(previousComplete&&!previousComplete.rows[i]&&done)newly=true;});
    now.cols.forEach(function(done,i){columnClues.children[i].classList.toggle("done",done);if(previousComplete&&!previousComplete.cols[i]&&done)newly=true;});
    if(withSound&&newly&&!now.all)GameAudio.se("line");previousComplete=now;return now;
  }
  function message(text){var el=$("#toast");el.textContent=text;clearTimeout(message.timer);message.timer=setTimeout(function(){el.textContent="";},800);}
  function applyCell(index,changes){
    if(locked||changes.some(function(x){return x[0]===index;}))return true;
    var old=board[index],next=mode==="fill"?1:mode==="cross"?2:0;if(old===next)return true;
    if(next!==0){var correct=current.solution[Math.floor(index/10)][index%10]==="1";if((next===1)!==correct){
      mistakes++;var cell=boardEl.children[index];cell.classList.remove("mistake");void cell.offsetWidth;cell.classList.add("mistake");message(["あっ！","おっと！","だいじょうぶ！"][mistakes%3]);GameAudio.se("mistake");GameAudio.voice("mistake");updateStatus();save();return false;
    }}
    changes.push([index,old]);board[index]=next;paintCell(index);GameAudio.se("input");updateCompleted(true);return true;
  }
  function finishChanges(changes){
    if(changes&&changes.length){history.push(changes);if(history.length>100)history.shift();var complete=GameRules.completed(current,board).all;if(complete)clearPuzzle();else save();}
    updateStatus();
  }
  function indexFromPoint(x,y){var rect=boardEl.getBoundingClientRect();if(x<rect.left||x>=rect.right||y<rect.top||y>=rect.bottom)return -1;var c=Math.min(9,Math.floor((x-rect.left)/rect.width*10)),r=Math.min(9,Math.floor((y-rect.top)/rect.height*10));return r*10+c;}
  function cellsBetween(a,b){
    var x0=a%10,y0=Math.floor(a/10),x1=b%10,y1=Math.floor(b/10),out=[],dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
    while(true){out.push(y0*10+x0);if(x0===x1&&y0===y1)break;var e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}return out;
  }
  boardEl.addEventListener("pointerdown",function(e){
    if(locked||e.button!==0)return;e.preventDefault();var index=indexFromPoint(e.clientX,e.clientY);if(index<0)return;
    boardEl.setPointerCapture(e.pointerId);gesture={id:e.pointerId,changes:[],last:index,blocked:false};if(!applyCell(index,gesture.changes))gesture.blocked=true;
  });
  boardEl.addEventListener("pointermove",function(e){
    if(!gesture||gesture.id!==e.pointerId||gesture.blocked)return;e.preventDefault();var next=indexFromPoint(e.clientX,e.clientY);
    if(next<0){gesture.blocked=true;finishChanges(gesture.changes);gesture.changes=[];return;}if(next===gesture.last)return;
    var path=cellsBetween(gesture.last,next);gesture.last=next;for(var i=1;i<path.length;i++)if(!applyCell(path[i],gesture.changes)){gesture.blocked=true;finishChanges(gesture.changes);gesture.changes=[];break;}
  });
  function endGesture(e){if(!gesture||gesture.id!==e.pointerId)return;if(gesture.changes.length)finishChanges(gesture.changes);gesture=null;}
  boardEl.addEventListener("pointerup",endGesture);boardEl.addEventListener("pointercancel",endGesture);

  function startPuzzle(id,fresh){
    var puzzle=validPuzzles.find(function(p){return p.id===id;});if(!puzzle)return;current=puzzle;locked=false;gesture=null;
    var saved=SaveStore.get().progress[id];if(!fresh&&GameRules.validSave(saved,puzzle)){board=saved.board.slice();history=saved.history.slice(-100);mistakes=Number.isInteger(saved.mistakes)&&saved.mistakes>=0?saved.mistakes:0;}
    else{if(saved)SaveStore.removeProgress(id);board=GameRules.blank();history=[];mistakes=0;}
    $("#stage-label").textContent="ステージ "+puzzle.stage;$("#game-name").textContent=SaveStore.isCleared(id)?puzzle.name:"？？？";renderBoard();updateStatus();showScreen("game");save();
    var overlay=$("#start-overlay");overlay.hidden=false;$("#start-text").textContent=fresh?"もういちど！":"いくよー！";locked=true;updateStatus();GameAudio.voice("start");setTimeout(function(){overlay.hidden=true;locked=false;updateStatus();},650);
  }
  function clearPuzzle(){
    if(locked)return;locked=true;SaveStore.markCleared(current.id);SaveStore.removeProgress(current.id);$("#game-name").textContent=current.name;boardEl.classList.add("flash");GameAudio.se("clear");GameAudio.voice("clear");confetti();
    setTimeout(function(){boardEl.classList.remove("flash");openComplete();},700);refreshContinue();
  }
  function confetti(){if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var box=$("#confetti"),colors=["#ff8f5a","#69c9ae","#78b9e6","#f2c94c"];box.innerHTML=Array.from({length:28},function(_,i){return '<i style="left:'+Math.random()*100+'%;background:'+colors[i%4]+';animation-delay:'+Math.random()*.4+'s"></i>';}).join("");setTimeout(function(){box.innerHTML="";},2200);}

  function openModal(html,focusSelector){lastFocus=document.activeElement;$("#modal").innerHTML=html;$("#modal-backdrop").hidden=false;var target=$("#modal").querySelector(focusSelector||"button");if(target)target.focus();}
  function closeModal(){$("#modal-backdrop").hidden=true;$("#modal").innerHTML="";if(lastFocus&&document.contains(lastFocus))lastFocus.focus();}
  function openSound(){
    var s=SaveStore.get().sound;openModal('<h2 id="modal-title">♪ おと設定</h2><div class="sound-row"><span>BGM</span><button class="toggle" data-sound="bgm" aria-pressed="'+s.bgm+'">'+(s.bgm?'ON':'OFF')+'</button></div><div class="sound-row"><span>効果音</span><button class="toggle" data-sound="se" aria-pressed="'+s.se+'">'+(s.se?'ON':'OFF')+'</button></div><div class="sound-row"><span>音声</span><button class="toggle" data-sound="voice" aria-pressed="'+s.voice+'">'+(s.voice?'ON':'OFF')+'</button></div><div class="modal-actions"><button class="primary modal-close">とじる</button></div>');
    $$("[data-sound]").forEach(function(b){b.addEventListener("click",function(){var value=b.getAttribute("aria-pressed")!=="true";SaveStore.setSound(b.dataset.sound,value);b.setAttribute("aria-pressed",value);b.textContent=value?"ON":"OFF";GameAudio.sync();updateStatus();});});$("#modal .modal-close").addEventListener("click",closeModal);
  }
  function openReset(){openModal('<h2 id="modal-title">さいしょから？</h2><p>ぬったマスと、ばつがぜんぶ消えるよ。</p><div class="modal-actions"><button class="primary" id="reset-confirm">さいしょから</button><button class="modal-close">やめる</button></div>');$("#reset-confirm").addEventListener("click",function(){closeModal();startPuzzle(current.id,true);});$("#modal .modal-close").addEventListener("click",closeModal);}
  function completeArt(){return current.image?'<div class="complete-art"><img src="'+current.image+'" alt="'+current.name+'"></div>':'<div class="complete-art" aria-hidden="true">'+current.placeholder+'</div>';}
  function openComplete(){
    var index=validPuzzles.indexOf(current),hasNext=index<validPuzzles.length-1;
    openModal('<h2 id="modal-title">できた！</h2>'+completeArt()+'<h3>'+current.name+'</h3><div class="modal-actions"><button class="primary" id="replay">もういちど</button>'+(hasNext?'<button id="next-puzzle">つぎへ</button>':'')+'<button id="choose-puzzle">もんだいをえらぶ</button></div>');
    $("#replay").addEventListener("click",function(){closeModal();startPuzzle(current.id,true);});if(hasNext)$("#next-puzzle").addEventListener("click",function(){closeModal();startPuzzle(validPuzzles[index+1].id,false);});$("#choose-puzzle").addEventListener("click",function(){closeModal();renderPuzzleList();showScreen("select");});
  }
  $("#modal-backdrop").addEventListener("keydown",function(e){if(e.key==="Escape"&&!$("#choose-puzzle"))closeModal();if(e.key!=="Tab")return;var items=$$("#modal button:not(:disabled)"),first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  $("#start-button").addEventListener("click",function(){GameAudio.startBgm();renderPuzzleList();showScreen("select");});
  $("#continue-button").addEventListener("click",function(){var candidates=Object.keys(SaveStore.get().progress).map(function(id){return SaveStore.get().progress[id];}).sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0);});var x=candidates.find(function(saved){var p=validPuzzles.find(function(item){return item.id===saved.id;});return p&&GameRules.validSave(saved,p);});if(x)startPuzzle(x.id,false);});
  $$('[data-go="title"]').forEach(function(b){b.addEventListener("click",function(){refreshContinue();showScreen("title");});});
  $("#back-to-list").addEventListener("click",function(){save();renderPuzzleList();showScreen("select");});
  $$(".sound-open").forEach(function(b){b.addEventListener("click",openSound);});
  $$(".mode").forEach(function(b){b.addEventListener("click",function(){mode=b.dataset.mode;$$('.mode').forEach(function(x){x.classList.toggle("active",x===b);});});});
  $("#undo-button").addEventListener("click",function(){if(!history.length||locked)return;history.pop().forEach(function(change){board[change[0]]=change[1];paintCell(change[0]);});updateCompleted(false);save();updateStatus();});
  $("#hint-button").addEventListener("click",function(){if(locked)return;var choices=[];current.solution.forEach(function(row,r){row.split("").forEach(function(x,c){if(x==="1"&&board[r*10+c]===0)choices.push(r*10+c);});});if(!choices.length)return;var changes=[],oldMode=mode;mode="fill";applyCell(choices[Math.floor(Math.random()*choices.length)],changes);mode=oldMode;finishChanges(changes);});
  $("#reset-button").addEventListener("click",openReset);
  document.addEventListener("click",function(e){var button=e.target.closest("button");if(button&&!button.disabled&&!button.classList.contains("cell"))GameAudio.se("button");});
  document.addEventListener("pointerdown",function(){GameAudio.startBgm();},{once:true});
  refreshContinue();updateStatus();
})();
