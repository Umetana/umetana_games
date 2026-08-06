# Simple ADV Player 開発構成

動作確認済みの縦切りを、共通エンジン、固有イベント、作品データへ分離した開発用構成です。実行形式は引き続きVanilla HTML/CSS/JavaScriptで、ビルドや外部ライブラリを必要としません。

## ディレクトリ

```text
simple_adv_player/
├─ engine/                       共通プレイヤー、検証、イベント登録
├─ events/
│  └─ multiplication-quiz/       九九イベント本体と専用CSS
├─ works/
│  └─ sansu-quest/               作品JSON、素材、作品テーマ
├─ tools/
│  └─ package-work.ps1           公開用フォルダ生成
└─ dist/                          生成された自己完結作品
```

## 開発時の起動

`simple_adv_player`直下をHTTP配信し、次のURLを開きます。

```powershell
cd D:\_dev\umetana_games\simple_adv_player
python -m http.server 8765 --bind 127.0.0.1
```

```text
http://127.0.0.1:8765/works/sansu-quest/
```

`file://`で直接開いた場合、ブラウザのCORS制約により`game.json`を読み込めません。

## 公開物の生成

```powershell
.\tools\package-work.ps1 -WorkId sansu-quest
```

`dist/sansu-quest/`へ、単体でHTTP公開できるファイル一式を生成します。公開先にはこのフォルダの中身だけを配置します。

## 責務の境界

- `engine/player.js`: シナリオ実行、表示、保存、音、イベント接続
- `engine/validator.js`: `formatVersion: 1`の作品データ検証
- `engine/event-registry.js`: 固有イベントの登録と取得
- `events/*`: イベント固有の引数検証、結果型、処理、表示
- `works/*/game.json`: シナリオと作品素材の対応
- `works/*/theme.css`: 作品固有の色や装飾

イベントは`validate`、`run`、`resultTypes`を登録します。エンジンは九九イベント名や結果項目を直接知りません。
