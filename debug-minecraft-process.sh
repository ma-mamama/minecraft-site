#!/bin/bash
# Minecraftプロセスのデバッグスクリプト
# EC2上で実行して、どのプロセス名で検索すべきか確認する

echo "=== Minecraft関連プロセスの検索 ==="
echo ""

echo "1. 'bedrock_server' で検索:"
pgrep -f bedrock_server
if [ $? -eq 0 ]; then
    echo "   ✓ 見つかりました"
    ps aux | grep bedrock_server | grep -v grep
else
    echo "   ✗ 見つかりませんでした"
fi
echo ""

echo "2. 'bedrock' で検索:"
pgrep -f bedrock
if [ $? -eq 0 ]; then
    echo "   ✓ 見つかりました"
    ps aux | grep bedrock | grep -v grep
else
    echo "   ✗ 見つかりませんでした"
fi
echo ""

echo "3. 'minecraft' で検索:"
pgrep -f minecraft
if [ $? -eq 0 ]; then
    echo "   ✓ 見つかりました"
    ps aux | grep minecraft | grep -v grep
else
    echo "   ✗ 見つかりませんでした"
fi
echo ""

echo "4. 'LD_LIBRARY_PATH' で検索 (Bedrock起動スクリプト):"
pgrep -f LD_LIBRARY_PATH
if [ $? -eq 0 ]; then
    echo "   ✓ 見つかりました"
    ps aux | grep LD_LIBRARY_PATH | grep -v grep
else
    echo "   ✗ 見つかりませんでした"
fi
echo ""

echo "5. すべてのプロセス一覧 (ubuntu ユーザー):"
ps aux | grep ubuntu | head -20
echo ""

echo "=== 推奨設定 ==="
echo "上記で見つかったプロセス名を minecraft-health.service の"
echo "Environment=\"MINECRAFT_PROCESS_NAME=xxx\" に設定してください"
