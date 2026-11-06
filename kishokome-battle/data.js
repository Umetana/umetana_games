/* comment-material-v0.1.md のカード。★付きは昇格後に出現。 */
(function(root){
  'use strict';
  const types={
    pass:{label:'見送り',color:'#72e5b0',name:'通常コメント'},
    delete:{label:'DEL',color:'#67c9ff',name:'削除対象'},
    timeout:{label:'TIME',color:'#ffce60',name:'タイムアウト対象'},
    ban:{label:'BAN',color:'#ff758d',name:'BAN対象'}
  };
  const lines={
    pass:[
      ['01','初見です、音ちょうどいいです'],
      ['02','今の咳払いで米が炊けた'],
      ['03','前世で一緒にたこ焼き焼いたよね'],
      ['04','新衣装の袖口に住民票置きたい'],
      ['05','悲鳴の余韻でご飯三杯いける'],
      ['08','俺の投げキスは各自で避けて']
    ],
    delete:[
      ['01','自分も配信中！全員こっち来て'],
      ['02','今からラスボスの正体バラすね'],
      ['04','初見のくせに口出すなよ'],
      ['06','ネタバレ禁止？犯人は主人公ね'],
      ['07','下手すぎて見てるこっちが恥']
    ],
    timeout:[
      ['01','読まれるまで同じ文貼るね'],
      ['03','断られた曲、歌うまで書くね'],
      ['04','初見帰れ。みんなもコピペして'],
      ['05','寝ろ。枠閉じるまで毎分書く'],
      ['06','反論した奴、謝るまで返信する'],
      ['07','旧衣装に戻して。戻すまで連投'],
      ['08','名前呼ぶまでチャット埋めるね']
    ],
    ban:[
      ['01','家の前で配信終わるの待ってる'],
      ['02','次は本名と住所をここに貼るね'],
      ['03','返事しないなら家まで行く'],
      ['04','BANされても別垢で荒らすよ'],
      ['06','駅で見かけたから後つけたよ'],
      ['08','配信やめろ。次やったら殴る']
    ]
  };
  const comments=Object.entries(lines).flatMap(([type,entries]) =>
    entries.map(([number,text]) => ({id:`draft-${type}-${number}`,type,text,hp:1}))
  );
  const starComments=[
    ['pass','06','まばたきの間隔まで好き'],
    ['pass','07','その回復薬、来世まで取っとく？'],
    ['delete','03','選曲ダサすぎ、次はマシなの頼む'],
    ['delete','05','腹の音した？切り抜いて笑お'],
    ['delete','08','初見さん、入会金三万払ってね'],
    ['timeout','02','回復しろって、これで十回目な'],
    ['ban','05','見つけた勤務先に電話しとくね'],
    ['ban','07','反論した奴の本名、晒していい？']
  ].map(([type,number,text]) => ({id:`draft-${type}-${number}`,type,text,hp:1}));
  const baseRanks=[
    {requiredGain:0,starChance:0,spawnInterval:1.3},
    {requiredGain:400,starChance:.10,spawnInterval:1.3},
    {requiredGain:850,starChance:.18,spawnInterval:1.3},
    {requiredGain:1350,starChance:.18,spawnInterval:1.2},
    {requiredGain:1900,starChance:.25,spawnInterval:1.2}
  ];
  const ranksByMode={easy:baseRanks,normal:baseRanks,hard:baseRanks};
  const config=Object.freeze({duration:60,initialSubscribers:1000,targetGain:240,initialTension:100,flightTime:5,spawnInterval:1.3,maxCards:4,correctReward:12,passReward:8,wrongPenalty:10,friendlyPenalty:20,missPenalty:8,missDamage:12});
  const data={types,comments,starComments,ranksByMode,config};
  root.KBData=data;
  if(typeof module!=='undefined'&&module.exports)module.exports=data;
})(globalThis);
