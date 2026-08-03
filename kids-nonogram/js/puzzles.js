/* 問題メーカーで安全に読み込めるよう、右辺はJSON形式で記述します。 */
window.PUZZLES = [
  {
    "id": "cat",
    "revision": 1,
    "stage": 1,
    "name": "ねこ",
    "placeholder": "🐱",
    "image": "",
    "solution": [
      "1100000110",
      "1110001110",
      "1111111110",
      "0111111100",
      "0101101000",
      "0111111000",
      "0110011000",
      "0011110000",
      "0010010000",
      "0110110000"
    ]
  },
  {
    "id": "rabbit",
    "revision": 1,
    "stage": 2,
    "name": "うさぎ",
    "placeholder": "🐰",
    "image": "",
    "solution": [
      "0010010000",
      "0110110000",
      "0110110000",
      "0111110000",
      "1111111000",
      "1101101000",
      "1111111000",
      "0111110000",
      "0011100000",
      "0010100000"
    ]
  },
  {
    "id": "fish",
    "revision": 1,
    "stage": 3,
    "name": "さかな",
    "placeholder": "🐟",
    "image": "",
    "solution": [
      "0000000000",
      "0001110000",
      "0011111010",
      "0111111110",
      "1111011111",
      "0111111110",
      "0011111010",
      "0001110000",
      "0000000000",
      "0000000000"
    ]
  },
  {
    "id": "apple",
    "revision": 1,
    "stage": 4,
    "name": "りんご",
    "placeholder": "🍎",
    "image": "",
    "solution": [
      "0000100000",
      "0001000000",
      "0011110000",
      "0111111000",
      "1111111100",
      "1111111100",
      "1111111100",
      "0111111000",
      "0011110000",
      "0000000000"
    ]
  },
  {
    "id": "star",
    "revision": 1,
    "stage": 5,
    "name": "ほし",
    "placeholder": "⭐",
    "image": "",
    "solution": [
      "0000100000",
      "0001110000",
      "0001110000",
      "1111111111",
      "0111111110",
      "0011111100",
      "0011111100",
      "0111001110",
      "0110000110",
      "0000000000"
    ]
  },
  {
    "id": "new-puzzle",
    "revision": 1,
    "stage": 6,
    "name": "スマイル",
    "placeholder": "☺",
    "image": "",
    "solution": [
      "0001111000",
      "0110000110",
      "0100000010",
      "1001001001",
      "1001001001",
      "1000000001",
      "1010000101",
      "0101111010",
      "0110000110",
      "0001111000"
    ]
  },
  {
    "id": "new-puzzle-2",
    "revision": 1,
    "stage": 7,
    "name": "ロケット",
    "placeholder": "🚀",
    "image": "",
    "solution": [
      "0000110000",
      "0001111000",
      "0001001000",
      "0001111000",
      "0001111000",
      "0001111000",
      "0011111100",
      "0111111110",
      "0101001010",
      "0001001000"
    ]
  }
];

window.validPuzzles = window.PUZZLES.filter(function(p){
  return p && typeof p.id === "string" && Number.isInteger(p.revision) && p.revision > 0 &&
    Number.isInteger(p.stage) && typeof p.name === "string" && Array.isArray(p.solution) &&
    p.solution.length === 10 && p.solution.every(function(row){return /^[01]{10}$/.test(row);});
}).sort(function(a,b){return a.stage-b.stage;});
