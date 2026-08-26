# naltec-reservation-grabber

検査レーンの予約において一部事業者が不当に予約を寡占状態にありそれに対抗するためのものです。  
あくまでも個人使用の範囲にとどめてください。  
このツールを利用して出たいかなる損害も当方では責任を負いかねます。  

Bun 1.4 の `Bun.WebView` (Chromium バックエンド) を使用しており、Docker コンテナ内でのみ動作します。

## 使い方

`compose.override.yml.example` をコピーして `compose.override.yml` を作り、環境変数を書き換える。

```shell
cp compose.override.yml.example compose.override.yml
```

| 環境変数 | 内容 |
| --- | --- |
| `NALTEC_ID` | メールアドレス |
| `NALTEC_PASSWORD` | パスワード |
| `CHASSIS_NO` | 予約をした車両の車体番号 |
| `TARGET_MONTH` | 予約したい月 |
| `TARGET_DAY` | 予約したい日 |
| `INSP_TYPE` | 検査種別 1:継続検査 2:中古新規 3:新車新規 4:その他新規 5:構造変更 |
| `LOCATION_NUMBER` | 予約画面において表示されるnaltec事務所のボタン要素の番号 (例 42:袖ヶ浦、省略時 41) |
| `ROUND` | 予約したいラウンド数 (省略時 1) |
| `VEHICLE_CLASS` | 車両タイプ 1:普通車 2:中型大型 3:大型特殊 (省略時 1) |
| `INTERVAL_SECONDS` | 再試行間隔の秒数 (省略時 30) |

`compose.override.yml` は docker compose が自動で読み込みます (git 管理外)。

希望日で予約が取れなかった場合一番遠い日付け、ラウンド数で予約を確保します。その後も希望日で取れるまで実行を続けます。

最後に実行

```shell
docker compose up --build
```

希望日で予約が取れるとコンテナは自動で終了します。
