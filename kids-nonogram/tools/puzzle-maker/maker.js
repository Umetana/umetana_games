(function(){
  "use strict";
  var $=function(s){return document.querySelector(s);},$$=function(s){return Array.from(document.querySelectorAll(s));};
  var puzzles=[],selected=0,mode="draw",gesture=null,fileHandle=null,dirty=false,lastFocus=null;
  var undoStacks={},redoStacks={},baseline={};
  var grid=$("#pixel-grid"),rowClues=$("#row-clues"),columnClues=$("#column-clues");

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function cleanPuzzle(p,index){return {id:String(p.id||("puzzle-"+(index+1))),revision:Number.isInteger(p.revision)&&p.revision>0?p.revision:1,stage:index+1,name:String(p.name||"あたらしい問題"),placeholder:String(p.placeholder||"✨"),image:String(p.image||""),solution:Array.isArray(p.solution)&&p.solution.length===10?p.solution.map(function(r){return /^[01]{10}$/.test(r)?r:"0000000000";}):Array(10).fill("0000000000")};}
  function signature(p){return JSON.stringify({id:p.id,name:p.name,placeholder:p.placeholder,image:p.image,solution:p.solution});}
  function setBaseline(){baseline={};puzzles.forEach(function(p){baseline[p.id]={revision:p.revision,signature:signature(p)};});}
  function current(){return puzzles[selected];}
  function boardArray(p){return p.solution.join("").split("").map(function(x){return x==="1"?1:0;});}
  function setBoard(values){current().solution=Array.from({length:10},function(_,r){return values.slice(r*10,r*10+10).join("");});}
  function clues(line){var out=[],run=0;line.forEach(function(x){if(x)run++;else if(run){out.push(run);run=0;}});if(run)out.push(run);return out.length?out:[0];}
  function makeUniqueId(base){var root=(base||"new-puzzle").replace(/[^a-zA-Z0-9_-]/g,"-")||"new-puzzle",id=root,n=2;while(puzzles.some(function(p){return p.id===id;})){id=root+"-"+n++;}return id;}
  function notify(text,error){var n=$("#notice");n.textContent=text;n.classList.toggle("error",!!error);clearTimeout(notify.timer);notify.timer=setTimeout(function(){n.textContent="";n.classList.remove("error");},3500);}
  function markDirty(){dirty=true;$("#dirty-mark").hidden=false;}
  function markSaved(){dirty=false;$("#dirty-mark").hidden=true;}

  function renderList(){
    $("#puzzle-list").innerHTML=puzzles.map(function(p,i){return '<button class="puzzle-item '+(i===selected?'active':'')+'" data-index="'+i+'"><span class="emoji">'+escapeHtml(p.placeholder||"•")+'</span><span><strong>'+escapeHtml(p.name)+'</strong><small>'+escapeHtml(p.id)+'</small></span><span class="stage">ST '+(i+1)+'</span></button>';}).join("");
    $$(".puzzle-item").forEach(function(button){button.addEventListener("click",function(){selected=Number(button.dataset.index);renderAll();});});
    $("#move-up").disabled=selected===0;$("#move-down").disabled=selected===puzzles.length-1;$("#delete-puzzle").disabled=puzzles.length<=1;
  }
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function renderFields(){var p=current();$("#edit-stage").textContent="STAGE "+(selected+1);$("#field-id").value=p.id;$("#field-name").value=p.name;$("#field-placeholder").value=p.placeholder;$("#field-image").value=p.image;$("#field-revision").value=p.revision;}
  function renderGrid(){
    var values=boardArray(current());grid.innerHTML=values.map(function(x,i){return '<button class="pixel '+(x?'on':'')+'" data-cell="'+i+'" role="gridcell" aria-label="'+(Math.floor(i/10)+1)+'ぎょう '+(i%10+1)+'れつ '+(x?'ぬり':'から')+'" tabindex="-1"></button>';}).join("");
    $("#mini-preview").innerHTML=values.map(function(x){return '<i class="'+(x?'on':'')+'"></i>';}).join("");renderClues(values);$("#filled-count").textContent=values.filter(Boolean).length+" / 100 マス";updateHistoryButtons();
  }
  function renderClues(values){var rows=Array.from({length:10},function(_,r){return clues(values.slice(r*10,r*10+10));}),cols=Array.from({length:10},function(_,c){return clues(Array.from({length:10},function(_,r){return values[r*10+c];}));});rowClues.innerHTML=rows.map(function(x){return '<div class="clue">'+x.join('<span> </span>')+'</div>';}).join("");columnClues.innerHTML=cols.map(function(x){return '<div class="clue">'+x.join('<br>')+'</div>';}).join("");}
  function renderAll(){renderList();renderFields();renderGrid();}
  function updateHistoryButtons(){var id=current().id;$("#undo").disabled=!(undoStacks[id]||[]).length;$("#redo").disabled=!(redoStacks[id]||[]).length;}
  function pushHistory(before){var id=current().id,after=current().solution;if(JSON.stringify(before)===JSON.stringify(after))return;(undoStacks[id]||(undoStacks[id]=[])).push(before);if(undoStacks[id].length>100)undoStacks[id].shift();redoStacks[id]=[];markDirty();updateHistoryButtons();}
  function indexFromPoint(x,y){var rect=grid.getBoundingClientRect();if(x<rect.left||x>=rect.right||y<rect.top||y>=rect.bottom)return -1;return Math.min(9,Math.floor((y-rect.top)/rect.height*10))*10+Math.min(9,Math.floor((x-rect.left)/rect.width*10));}
  function cellsBetween(a,b){var x0=a%10,y0=Math.floor(a/10),x1=b%10,y1=Math.floor(b/10),out=[],dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;while(true){out.push(y0*10+x0);if(x0===x1&&y0===y1)break;var e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}return out;}
  function drawCell(index,value){var values=boardArray(current());if(values[index]===value)return;values[index]=value;setBoard(values);var cell=grid.children[index];cell.classList.toggle("on",!!value);cell.setAttribute("aria-label",(Math.floor(index/10)+1)+"ぎょう "+(index%10+1)+"れつ "+(value?'ぬり':'から'));var mini=$("#mini-preview").children[index];mini.classList.toggle("on",!!value);renderClues(values);$("#filled-count").textContent=values.filter(Boolean).length+" / 100 マス";}
  grid.addEventListener("pointerdown",function(e){if(e.button!==0)return;e.preventDefault();var index=indexFromPoint(e.clientX,e.clientY);if(index<0)return;grid.setPointerCapture(e.pointerId);gesture={id:e.pointerId,before:current().solution.slice(),last:index,value:mode==="draw"?1:0};drawCell(index,gesture.value);});
  grid.addEventListener("pointermove",function(e){if(!gesture||e.pointerId!==gesture.id)return;e.preventDefault();var next=indexFromPoint(e.clientX,e.clientY);if(next<0||next===gesture.last)return;var path=cellsBetween(gesture.last,next);gesture.last=next;path.slice(1).forEach(function(i){drawCell(i,gesture.value);});});
  function endGesture(e){if(!gesture||gesture.id!==e.pointerId)return;pushHistory(gesture.before);gesture=null;}
  grid.addEventListener("pointerup",endGesture);grid.addEventListener("pointercancel",endGesture);

  function bindField(selector,key,transform){$(selector).addEventListener("input",function(e){var p=current(),oldId=p.id,value=transform?transform(e.target.value):e.target.value;p[key]=value;if(key==="id"&&oldId!==value){undoStacks[value]=undoStacks[oldId]||[];redoStacks[value]=redoStacks[oldId]||[];delete undoStacks[oldId];delete redoStacks[oldId];}renderList();markDirty();});}
  bindField("#field-id","id");bindField("#field-name","name");bindField("#field-placeholder","placeholder");bindField("#field-image","image");
  $$(".mode").forEach(function(button){button.addEventListener("click",function(){mode=button.dataset.mode;$$('.mode').forEach(function(x){x.classList.toggle("active",x===button);});});});
  $("#undo").addEventListener("click",function(){var id=current().id,stack=undoStacks[id]||[];if(!stack.length)return;(redoStacks[id]||(redoStacks[id]=[])).push(current().solution.slice());current().solution=stack.pop();renderGrid();markDirty();});
  $("#redo").addEventListener("click",function(){var id=current().id,stack=redoStacks[id]||[];if(!stack.length)return;(undoStacks[id]||(undoStacks[id]=[])).push(current().solution.slice());current().solution=stack.pop();renderGrid();markDirty();});
  $("#clear-grid").addEventListener("click",function(){var before=current().solution.slice();current().solution=Array(10).fill("0000000000");pushHistory(before);renderGrid();});
  $("#add-puzzle").addEventListener("click",function(){var id=makeUniqueId("new-puzzle");puzzles.push(cleanPuzzle({id:id},puzzles.length));selected=puzzles.length-1;markDirty();renderAll();});
  $("#duplicate-puzzle").addEventListener("click",function(){var copy=clone(current());copy.id=makeUniqueId(copy.id+"-copy");copy.name=copy.name+" コピー";copy.revision=1;puzzles.splice(selected+1,0,copy);selected++;normalizeStages();markDirty();renderAll();});
  function move(delta){var target=selected+delta;if(target<0||target>=puzzles.length)return;var item=puzzles.splice(selected,1)[0];puzzles.splice(target,0,item);selected=target;normalizeStages();markDirty();renderAll();}
  $("#move-up").addEventListener("click",function(){move(-1);});$("#move-down").addEventListener("click",function(){move(1);});
  function normalizeStages(){puzzles.forEach(function(p,i){p.stage=i+1;});}
  $("#delete-puzzle").addEventListener("click",function(){lastFocus=document.activeElement;$("#dialog-backdrop").hidden=false;$("#dialog-cancel").focus();});
  $("#dialog-cancel").addEventListener("click",closeDialog);$("#dialog-confirm").addEventListener("click",function(){var removed=puzzles.splice(selected,1)[0];delete undoStacks[removed.id];delete redoStacks[removed.id];selected=Math.min(selected,puzzles.length-1);normalizeStages();markDirty();closeDialog();renderAll();});
  function closeDialog(){$("#dialog-backdrop").hidden=true;if(lastFocus)lastFocus.focus();}

  function validateAll(){var ids=new Set(),errors=[];puzzles.forEach(function(p,i){var label="STAGE "+(i+1)+": ";if(!/^[A-Za-z0-9_-]+$/.test(p.id))errors.push(label+"IDの形式が正しくありません");if(ids.has(p.id))errors.push(label+"IDが重複しています");ids.add(p.id);if(!p.name.trim())errors.push(label+"問題名が空です");if(!p.solution.some(function(r){return r.indexOf("1")>=0;}))errors.push(label+"塗りマスがありません");});return errors;}
  function commitRevisions(){normalizeStages();puzzles.forEach(function(p){var old=baseline[p.id];if(old&&old.signature!==signature(p))p.revision=old.revision+1;});setBaseline();renderFields();markSaved();}
  function outputText(){return '/* 問題メーカーで安全に読み込めるよう、右辺はJSON形式で記述します。 */\nwindow.PUZZLES = '+JSON.stringify(puzzles,null,2)+';\n\nwindow.validPuzzles = window.PUZZLES.filter(function(p){\n  return p && typeof p.id === "string" && Number.isInteger(p.revision) && p.revision > 0 &&\n    Number.isInteger(p.stage) && typeof p.name === "string" && Array.isArray(p.solution) &&\n    p.solution.length === 10 && p.solution.every(function(row){return /^[01]{10}$/.test(row);});\n}).sort(function(a,b){return a.stage-b.stage;});\n';}
  function prepareOutput(){var errors=validateAll();if(errors.length){notify(errors[0],true);return null;}commitRevisions();return outputText();}
  function download(){var text=prepareOutput();if(!text)return;var blob=new Blob([text],{type:"text/javascript;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="puzzles.js";a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);notify("puzzles.jsをダウンロードしました");}
  async function saveAs(){var text=prepareOutput();if(!text)return;if(!window.showSaveFilePicker){download();return;}try{var handle=await window.showSaveFilePicker({suggestedName:"puzzles.js",types:[{description:"JavaScript",accept:{"text/javascript":[".js"]}}]});await writeHandle(handle,text);fileHandle=handle;$("#overwrite-file").hidden=false;notify("puzzles.jsを保存しました");}catch(error){if(error.name!=="AbortError")notify("保存できませんでした",true);}}
  async function writeHandle(handle,text){var writable=await handle.createWritable();await writable.write(text);await writable.close();}
  async function overwrite(){if(!fileHandle)return saveAs();var text=prepareOutput();if(!text)return;try{await writeHandle(fileHandle,text);notify("puzzles.jsを上書きしました");}catch(error){notify("上書きできませんでした",true);}}
  function extractJsonArray(text){var marker="window.PUZZLES",pos=text.indexOf(marker);if(pos<0)throw new Error("window.PUZZLESが見つかりません");var start=text.indexOf("[",pos);if(start<0)throw new Error("問題配列が見つかりません");var depth=0,inString=false,escape=false;for(var i=start;i<text.length;i++){var ch=text[i];if(inString){if(escape)escape=false;else if(ch==="\\")escape=true;else if(ch==='"')inString=false;continue;}if(ch==='"'){inString=true;continue;}if(ch==="[")depth++;else if(ch==="]"&&--depth===0)return text.slice(start,i+1);}throw new Error("問題配列が閉じられていません");}
  function importText(text,name){try{var parsed=JSON.parse(extractJsonArray(text));if(!Array.isArray(parsed)||!parsed.length)throw new Error("問題がありません");puzzles=parsed.map(cleanPuzzle);selected=0;undoStacks={};redoStacks={};normalizeStages();setBaseline();markSaved();renderAll();notify(name+"を読み込みました");}catch(error){notify("読み込み失敗: "+error.message,true);}}
  async function openFile(){if(window.showOpenFilePicker){try{var handles=await window.showOpenFilePicker({multiple:false,types:[{description:"puzzles.js",accept:{"text/javascript":[".js"]}}]});var handle=handles[0],file=await handle.getFile();importText(await file.text(),file.name);fileHandle=handle;$("#overwrite-file").hidden=false;}catch(error){if(error.name!=="AbortError")notify("ファイルを開けませんでした",true);}return;}$("#file-input").click();}
  $("#file-input").addEventListener("change",async function(e){var file=e.target.files[0];if(file)importText(await file.text(),file.name);e.target.value="";});
  $("#open-file").addEventListener("click",openFile);$("#save-file").addEventListener("click",saveAs);$("#overwrite-file").addEventListener("click",overwrite);$("#download-file").addEventListener("click",download);
  window.addEventListener("beforeunload",function(e){if(dirty){e.preventDefault();e.returnValue="";}});

  puzzles=(Array.isArray(window.PUZZLES)&&window.PUZZLES.length?window.PUZZLES:[{}]).map(cleanPuzzle);normalizeStages();setBaseline();renderAll();
})();
