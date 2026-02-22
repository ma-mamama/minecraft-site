# ヘルスチェックのデバッグ手順

Minecraftサーバーが動いているのにヘルスチェックがエラーになる場合の対処方法です。

## 手順1: プロセス名を確認

EC2インスタンスにSSH接続して、以下を実行：

```bash
# デバッグスクリプトに実行権限を付与
chmod +x debug-minecraft-process.sh

# 実行
./debug-minecraft-process.sh
```

このスクリプトは、様々なパターンでMinecraftプロセスを検索し、どのプロセス名が有効か表示します。

## 手順2: 手動でプロセスを確認

```bash
# すべてのプロセスを表示
ps aux | grep -i minecraft

# または
ps aux | grep -i bedrock

# プロセスIDを検索
pgrep -f bedrock_server
```

## 手順3: ヘルスチェックサーバーのデバッグエンドポイントを使用

ヘルスチェックサーバーが起動している状態で：

```bash
# デバッグ情報を取得
curl http://localhost:8080/debug
```

出力例：
```json
{
  "process_name": "bedrock_server",
  "is_running": false,
  "search_results": {
    "bedrock_server": {
      "found": false,
      "pids": []
    },
    "bedrock": {
      "found": true,
      "pids": ["12345"]
    },
    "minecraft": {
      "found": false,
      "pids": []
    },
    "LD_LIBRARY_PATH": {
      "found": true,
      "pids": ["12345"]
    }
  }
}
```

この例では、`bedrock_server`では見つからないが、`bedrock`や`LD_LIBRARY_PATH`では見つかっています。

## 手順4: プロセス名を修正

見つかったプロセス名を使って、serviceファイルを更新：

```bash
# serviceファイルを編集
sudo nano /etc/systemd/system/minecraft-health.service
```

`Environment`行を修正：

```ini
# 例1: bedrock で見つかった場合
Environment="MINECRAFT_PROCESS_NAME=bedrock"

# 例2: LD_LIBRARY_PATH で見つかった場合
Environment="MINECRAFT_PROCESS_NAME=LD_LIBRARY_PATH"

# 例3: 完全なパスで見つかった場合
Environment="MINECRAFT_PROCESS_NAME=/home/ubuntu/bedrock-server/bedrock_server"
```

変更後、サービスを再起動：

```bash
sudo systemctl daemon-reload
sudo systemctl restart minecraft-health.service

# ステータス確認
sudo systemctl status minecraft-health.service

# ヘルスチェックを再度テスト
curl http://localhost:8080/health
```

## よくあるプロセス名のパターン

| Minecraftの種類 | プロセス名候補 |
|----------------|--------------|
| Bedrock Edition (公式) | `bedrock_server`, `bedrock`, `LD_LIBRARY_PATH` |
| Bedrock Edition (Docker) | `bedrock`, `docker` |
| Java Edition | `java`, `minecraft_server.jar` |
| Paper/Spigot | `java`, `paper`, `spigot` |

## 手順5: ログを確認

```bash
# ヘルスチェックサーバーのログ
sudo journalctl -u minecraft-health.service -n 50

# リアルタイムでログを監視
sudo journalctl -u minecraft-health.service -f
```

## トラブルシューティング

### ケース1: プロセスが複数見つかる

```bash
# プロセスの詳細を確認
ps aux | grep bedrock

# 出力例:
# ubuntu   12345  ... /home/ubuntu/bedrock-server/bedrock_server
# ubuntu   12346  ... grep bedrock  ← これは検索コマンド自体
```

この場合、`bedrock_server`または完全パスを使用してください。

### ケース2: プロセスが見つからない

Minecraftサーバーが本当に起動しているか確認：

```bash
# ポートが開いているか確認（Bedrock Edition: 19132）
sudo netstat -tulpn | grep 19132

# または
sudo ss -tulpn | grep 19132
```

### ケース3: 権限エラー

ヘルスチェックサーバーが他のユーザーのプロセスを見られない場合：

```bash
# serviceファイルのUserを確認
sudo systemctl cat minecraft-health.service | grep User

# Minecraftサーバーの実行ユーザーを確認
ps aux | grep bedrock | grep -v grep
```

両方が同じユーザー（通常は`ubuntu`）で実行されていることを確認してください。

## 解決しない場合

以下の情報を添えて質問してください：

1. `ps aux | grep -i minecraft` の出力
2. `curl http://localhost:8080/debug` の出力
3. `sudo journalctl -u minecraft-health.service -n 50` の出力
4. Minecraftサーバーの起動方法（コマンドやスクリプト）
