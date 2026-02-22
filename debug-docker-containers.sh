#!/bin/bash
# Dockerコンテナのデバッグスクリプト
# EC2上で実行して、Minecraftコンテナの情報を確認する

echo "=== Docker環境の確認 ==="
echo ""

echo "1. Dockerバージョン:"
docker --version
echo ""

echo "2. 実行中のコンテナ:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo ""

echo "3. すべてのコンテナ（停止中も含む）:"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo ""

echo "4. Minecraft関連のコンテナを検索:"
echo "   'minecraft' を含むコンテナ:"
docker ps -a --filter "name=minecraft" --format "   - {{.Names}} ({{.Status}})"
echo ""
echo "   'bedrock' を含むコンテナ:"
docker ps -a --filter "name=bedrock" --format "   - {{.Names}} ({{.Status}})"
echo ""

echo "5. Docker Composeの確認:"
if command -v docker-compose &> /dev/null; then
    echo "   Docker Compose がインストールされています"
    docker-compose --version
    
    if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
        echo "   docker-compose.yml が見つかりました"
        echo "   サービス一覧:"
        docker-compose ps 2>/dev/null || echo "   (docker-compose ps が失敗しました)"
    else
        echo "   docker-compose.yml が見つかりません"
    fi
else
    echo "   Docker Compose がインストールされていません"
fi
echo ""

echo "6. dockerグループの確認:"
groups | grep docker > /dev/null
if [ $? -eq 0 ]; then
    echo "   ✓ 現在のユーザーはdockerグループに所属しています"
else
    echo "   ✗ 現在のユーザーはdockerグループに所属していません"
    echo "   以下のコマンドで追加してください:"
    echo "   sudo usermod -aG docker $USER"
    echo "   newgrp docker"
fi
echo ""

echo "=== 推奨設定 ==="
echo "上記で見つかったコンテナ名を minecraft-health-docker.service の"
echo "Environment=\"DOCKER_CONTAINER_NAME=xxx\" に設定してください"
echo ""
echo "例:"
FIRST_CONTAINER=$(docker ps --format "{{.Names}}" | head -1)
if [ -n "$FIRST_CONTAINER" ]; then
    echo "Environment=\"DOCKER_CONTAINER_NAME=$FIRST_CONTAINER\""
fi
