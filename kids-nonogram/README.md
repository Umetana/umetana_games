# ちいさなノノグラム

ビルド不要の10×10ノノグラムです。`index.html`を静的HTTPサーバーまたはGitHub Pagesで公開すると遊べます。

## ローカル確認

このフォルダで次のような静的HTTPサーバーを起動します。

```text
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000/` を開きます。外部通信、npm、Node.jsによるビルドは必要ありません。

## 問題と画像の追加

問題は `js/puzzles.js` の配列で管理しています。

ブラウザ上の問題メーカーも利用できます。

```text
http://localhost:8000/tools/puzzle-maker/
```

問題メーカーでは、既存問題の読み込み、追加、編集、複製、削除、並べ替え、10×10ドット編集、Undo／Redo、ヒント確認ができます。

- Chrome／Edgeなどの対応環境では「ファイルを開く」「上書き保存」「名前を付けて保存」を利用できる
- 非対応環境では通常のファイル選択と「ダウンロード」を利用する
- 読み込んだJavaScriptは実行せず、`window.PUZZLES`のJSON配列部分だけを解析する
- 保存時にID重複、ID形式、問題名、塗りマスの有無を検証する
- 既存問題の内容を変更して保存すると`revision`が自動的に1増える

- 手作業で`solution`を変更した場合は、その問題の`revision`を1増やす
- 完成画像は`assets/images/`へ置く
- `image`へ `assets/images/cat.webp` のような相対パスを設定する
- `image`が空文字の場合、画像リクエストを行わず`placeholder`を表示する

## 音声素材の追加

素材は次のフォルダへ配置します。

- BGM：`assets/audio/bgm/` (現バージョンはSUNO AIで生成)
- 効果音：`assets/audio/se/` (現バージョンはWeb Audio APIで合成)
- 音声：`assets/audio/voice/` (現バージョンは自前録音・加工)

`js/audio.js`先頭の`SOURCES`へ相対パスを設定すると反映されます。空文字または空配列の項目は読み込まれないため、素材がなくても404や再生エラーは発生しません。MP3形式を基本とします。
