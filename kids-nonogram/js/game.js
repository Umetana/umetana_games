(function(){
  "use strict";
  function clues(lines){return lines.map(function(line){var out=[],run=0;line.split("").forEach(function(x){if(x==="1")run++;else if(run){out.push(run);run=0;}});if(run)out.push(run);return out.length?out:[0];});}
  function columnLines(solution){return Array.from({length:10},function(_,c){return solution.map(function(row){return row[c];}).join("");});}
  function blank(){return Array(100).fill(0);}
  function isBoard(board){return Array.isArray(board)&&board.length===100&&board.every(function(x){return x===0||x===1||x===2;});}
  function completed(puzzle,board){
    var rows=Array(10).fill(true),cols=Array(10).fill(true);
    for(var r=0;r<10;r++)for(var c=0;c<10;c++)if(puzzle.solution[r][c]==="1"&&board[r*10+c]!==1){rows[r]=false;cols[c]=false;}
    return {rows:rows,cols:cols,all:rows.every(Boolean)};
  }
  function validHistory(history){return Array.isArray(history)&&history.every(function(step){return Array.isArray(step)&&step.every(function(change){return Array.isArray(change)&&change.length===2&&Number.isInteger(change[0])&&change[0]>=0&&change[0]<100&&(change[1]===0||change[1]===1||change[1]===2);});});}
  function validSave(saved,puzzle){return saved&&saved.id===puzzle.id&&saved.revision===puzzle.revision&&isBoard(saved.board)&&validHistory(saved.history);}
  window.GameRules={clues:clues,columnLines:columnLines,blank:blank,isBoard:isBoard,completed:completed,validSave:validSave};
})();
