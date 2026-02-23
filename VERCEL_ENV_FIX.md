# Vercel環境変数エラーの修正手順

## 🚨 エラー内容

```
400 Bad Request
Confirm your request. client_id parameter is null.
```

このエラーは、LINE Login認証時に`NEXT_PUBLIC_LINE_CHANNEL_ID`環境変数が設定されていないために発生しています。

## 🔧 修正手順

### 1. Vercelダッシュボードにアクセス

1. [Vercel Dashboard](https://vercel.com/dashboard) にログイン
2. プロジェクト `minecraft-site` を選択
3. 「Settings」タブをクリック
4. 左メニューから「Environment Variables」を選択

### 2. 必須の環境変数を確認・追加

以下の環境変数が設定されているか確認してください。特に`NEXT_PUBLIC_`で始まる変数が重要です：

#### LINE Login関連（必須）

```bash
# サーバーサイド用
LINE_CHANNEL_ID=あなたのLINE Channel ID
LINE_CHANNEL_SECRET=あなたのLINE Channel Secret
LINE_CALLBACK_URL=https://あなたのVercel URL/auth/callback

# クライアントサイド用（重要！）
NEXT_PUBLIC_LINE_CHANNEL_ID=あなたのLINE Channel ID
NEXT_PUBLIC_LINE_CALLBACK_URL=https://あなたのVercel URL/auth/callback
```

**重要**: `NEXT_PUBLIC_LINE_CHANNEL_ID`と`LINE_CHANNEL_ID`は同じ値を設定してください。

### 3. 環境変数の追加方法

1. 「Add New」ボタンをクリック
2. 「Name」に変数名を入力（例: `NEXT_PUBLIC_LINE_CHANNEL_ID`）
3. 「Value」に値を入力（LINE Channel ID）
4. 「Environment」で以下を選択：
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. 「Save」をクリック

### 4. LINE Channel IDの確認方法

LINE Channel IDが不明な場合：

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. プロバイダーを選択
3. チャネルを選択
4. 「Basic settings」タブで「Channel ID」を確認

### 5. 再デプロイ

環境変数を追加・更新した後、必ず再デプロイが必要です：

1. Vercelダッシュボードの「Deployments」タブに移動
2. 最新のデプロイメントの右側にある「...」メニューをクリック
3. 「Redeploy」を選択
4. 「Redeploy」ボタンをクリックして確認

### 6. 動作確認

再デプロイが完了したら：

1. VercelのURLにアクセス
2. 「LINEでログイン」ボタンをクリック
3. LINE認証画面にリダイレクトされることを確認
4. エラーが表示されないことを確認

## 📋 すべての必須環境変数チェックリスト

以下の環境変数がすべて設定されているか確認してください：

### クライアントサイド用（NEXT_PUBLIC_）

- [ ] `NEXT_PUBLIC_LINE_CHANNEL_ID`
- [ ] `NEXT_PUBLIC_LINE_CALLBACK_URL`
- [ ] `NEXT_PUBLIC_APP_URL`

### サーバーサイド用

- [ ] `LINE_CHANNEL_ID`
- [ ] `LINE_CHANNEL_SECRET`
- [ ] `LINE_CALLBACK_URL`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `AWS_REGION`
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `AWS_EC2_INSTANCE_ID`
- [ ] `MINECRAFT_SERVER_HOST`
- [ ] `MINECRAFT_SERVER_PORT`
- [ ] `MINECRAFT_HEALTH_CHECK_URL`
- [ ] `HEALTH_CHECK_TOKEN`
- [ ] `SESSION_SECRET`
- [ ] `SESSION_EXPIRY_DAYS`
- [ ] `ALLOWED_ORIGINS`

## 🔍 トラブルシューティング

### エラーが解決しない場合

1. **ブラウザのキャッシュをクリア**
   - Chrome: Ctrl+Shift+Delete（Windows）/ Cmd+Shift+Delete（Mac）
   - 「キャッシュされた画像とファイル」を選択してクリア

2. **環境変数の値を再確認**
   - スペルミスがないか
   - 余分なスペースが入っていないか
   - 引用符が含まれていないか（値に引用符は不要）

3. **Vercelのビルドログを確認**
   - 「Deployments」タブで最新のデプロイメントをクリック
   - 「Building」セクションでエラーがないか確認

4. **LINE Developersの設定を確認**
   - Callback URLが正しく設定されているか
   - チャネルが公開状態になっているか

### よくある間違い

❌ **間違い**: 環境変数に引用符を含める
```bash
NEXT_PUBLIC_LINE_CHANNEL_ID="1234567890"  # ❌ 引用符は不要
```

✅ **正しい**: 引用符なしで値を設定
```bash
NEXT_PUBLIC_LINE_CHANNEL_ID=1234567890  # ✅ 正しい
```

❌ **間違い**: URLの末尾にスラッシュを含める
```bash
NEXT_PUBLIC_LINE_CALLBACK_URL=https://example.com/auth/callback/  # ❌
```

✅ **正しい**: スラッシュなし
```bash
NEXT_PUBLIC_LINE_CALLBACK_URL=https://example.com/auth/callback  # ✅
```

## 📞 サポート

問題が解決しない場合は、以下の情報を確認してください：

1. Vercelのデプロイメントログ
2. ブラウザのコンソールエラー（F12で開発者ツールを開く）
3. 設定した環境変数のリスト（値は含めない）

## 🔗 関連ドキュメント

- [VERCEL_DEPLOY_CHECKLIST.md](./VERCEL_DEPLOY_CHECKLIST.md) - デプロイチェックリスト
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 詳細なデプロイガイド
- [.env.example](./.env.example) - 環境変数の例
