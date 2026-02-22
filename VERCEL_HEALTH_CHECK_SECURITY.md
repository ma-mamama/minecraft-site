# Vercelからのヘルスチェック接続のセキュリティ設定

## 結論：8080を全開放しても大丈夫？

**認証トークンを設定すれば、リスクは最小限です。**

## リスク評価

### 情報漏洩リスク：低
- ヘルスチェックが返すのは`{"status":"ok","minecraft":"running"}`のみ
- 機密情報は含まれていない
- サーバー操作はできない（読み取り専用）

### DoS攻撃リスク：低
- 軽量なエンドポイント（プロセスチェックのみ）
- 大量リクエストでもEC2への影響は限定的

### 悪用リスク：低〜中
- トークンなし：サーバーの起動パターンを監視される可能性
- トークンあり：不正アクセスは実質的に不可能

## 推奨設定

### 1. 認証トークンを設定（5分で完了）

#### EC2側の設定

```bash
# ランダムなトークンを生成
openssl rand -hex 32

# 出力例: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

`/etc/systemd/system/minecraft-health.service`を編集：

```ini
[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/python3 /home/ubuntu/minecraft-health-server.py
Restart=always
RestartSec=10
Environment="HEALTH_CHECK_PORT=8080"
Environment="MINECRAFT_PROCESS_NAME=bedrock_server"
Environment="HEALTH_CHECK_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"

[Install]
WantedBy=multi-user.target
```

サービスを再起動：

```bash
sudo systemctl daemon-reload
sudo systemctl restart minecraft-health.service

# 動作確認（トークンなし - 失敗するはず）
curl http://localhost:8080/health
# {"status":"error","message":"Unauthorized"}

# 動作確認（トークンあり - 成功するはず）
curl -H "Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6" http://localhost:8080/health
# {"status":"ok","minecraft":"running"}
```

#### Vercel側の設定

Vercelの環境変数に追加：

```bash
HEALTH_CHECK_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 2. セキュリティグループの設定

AWS EC2コンソールで、セキュリティグループに以下を追加：

- タイプ: カスタムTCP
- ポート範囲: 8080
- ソース: `0.0.0.0/0`（全開放）
- 説明: Health check endpoint with token authentication

## セキュリティ対策の効果

| 対策 | 効果 | 実装難易度 |
|------|------|-----------|
| トークン認証 | 不正アクセスをほぼ完全に防止 | 低（5分） |
| IP制限 | Vercelは動的IPのため不可能 | - |
| CloudFlare Tunnel | 完全な保護 | 高（30分〜） |
| VPN経由 | 完全な保護 | 高（1時間〜） |

## トークンなしで開放した場合のリスク

### 実際に起こりうること
1. ポートスキャンで発見される
2. サーバーの起動状態が第三者に分かる
3. 起動パターンを監視される

### 起こらないこと
- サーバーの操作（起動/停止）
- データの漏洩
- 不正ログイン

## 結論

**トークン認証を設定すれば、8080を全開放しても問題ありません。**

- 実装時間：5分
- セキュリティレベル：高
- 運用コスト：なし

より高いセキュリティが必要な場合は、CloudFlare TunnelやVPN経由のアクセスを検討してください。

## トラブルシューティング

### ヘルスチェックが401エラーになる

```bash
# EC2側でトークンが設定されているか確認
sudo systemctl cat minecraft-health.service | grep HEALTH_CHECK_TOKEN

# Vercel側でトークンが設定されているか確認（Vercel Dashboard）
# Environment Variables → HEALTH_CHECK_TOKEN
```

### トークンを変更したい

1. 新しいトークンを生成
2. EC2のserviceファイルを更新
3. Vercelの環境変数を更新
4. EC2のサービスを再起動
5. Vercelを再デプロイ（または自動デプロイを待つ）

## 参考リンク

- [HEALTH_CHECK_SETUP.md](./HEALTH_CHECK_SETUP.md) - ヘルスチェックサーバーのセットアップ手順
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Vercelデプロイガイド
