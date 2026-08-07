# Simple ADV Player 開発構成

動作確認済みの縦切りを、共通エンジン、固有イベント、作品データへ分離した開発用構成です。実行形式は引き続きVanilla HTML/CSS/JavaScriptで、ビルドや外部ライブラリを必要としません。

## ディレクトリ

```text
simple_adv_player/
├─ engine/                       共通プレイヤー、検証、イベント登録
├─ events/
│  └─ multiplication-quiz/       九九イベント本体と専用CSS
├─ editor/                        game.json用のブラウザエディター
├─ works/
│  └─ sansu-quest/               作品JSON、素材、作品テーマ
├─ tools/
│  └─ package-work.ps1           公開用フォルダ生成
└─ dist/                          生成された自己完結作品
```

## 開発時の起動

制作環境にはNode.jsを使用します。制作サーバーを起動すると、エディター、作品プレビュー、直接保存、バックアップ、公開物生成を利用できます。

```powershell
cd [ご自身の環境のよります]\simple_adv_player
node tools\dev-server.mjs
```

```text
http://127.0.0.1:8765/works/sansu-quest/
```

エディターは制作サーバーから次のURLで開きます。

```text
http://127.0.0.1:8765/editor/
```

エディターでは`works/`内の作品を選択し、`game.json`へ直接保存できます。保存前のファイルは作品内の`.backups/`へ自動退避されます。LocalStorageは未保存下書きの復旧補助、JSON入出力は移行用として残しています。

「新規作品」から空の作品を作成でき、「シナリオ取込」からMarkdown台本を複数シーンへ一括変換できます。記法と反映方法は[docs/Markdownシナリオ取込仕様.md](docs/Markdownシナリオ取込仕様.md)を参照してください。

制作サーバーは`127.0.0.1`だけで待ち受け、ファイル操作を`works/`と`dist/`へ限定します。公開プレイヤーは従来どおり静的HTTP/HTTPS環境で動作し、Node.jsを必要としません。

## 公開物の生成

```powershell
.\tools\package-work.ps1 -WorkId sansu-quest
```

`dist/sansu-quest/`へ、単体でHTTP公開できるファイル一式を生成します。公開先にはこのフォルダの中身だけを配置します。同じ処理はエディターの「公開物を生成」からも実行できます。

## 責務の境界

- `engine/player.js`: シナリオ実行、表示、保存、音、イベント接続
- `engine/validator.js`: `formatVersion: 1 / 2`の作品データ検証
- `engine/event-registry.js`: 固有イベントの登録と取得
- `events/*`: イベント固有の引数検証、結果型、処理、表示
- `works/*/game.json`: シナリオと作品素材の対応
- `works/*/theme.css`: 作品固有の色や装飾

イベントは`validate`、`run`、`resultTypes`を登録します。エンジンは九九イベント名や結果項目を直接知りません。

`formatVersion: 2`ではプレイヤー共通のタイトル画面を利用できます。タイトル画像とボタン文言はエディターの「タイトル画面」タブで設定します。詳しくは[docs/タイトル画面仕様.md](docs/タイトル画面仕様.md)を参照してください。
