#!/usr/bin/env bash
# 麻将消一消 编辑器启动脚本(macOS / Linux)
# 双击运行,或在终端执行:bash 启动编辑器.command

cd "$(dirname "$0")"

echo ""
echo "============================================"
echo "  🀄  麻将消一消 编辑器"
echo "============================================"
echo ""

# 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js"
  echo "请先安装 Node.js (>= 14): https://nodejs.org/"
  echo "或用 brew: brew install node"
  echo ""
  read -p "按回车键退出..."
  exit 1
fi

echo "Node.js 版本: $(node -v)"
echo ""

# 找一个可用端口
PORT=9002
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT+1))
  if [ $PORT -gt 9099 ]; then
    echo "[错误] 9002~9099 都被占用"
    read -p "按回车键退出..."
    exit 1
  fi
done

echo "启动本地服务器(端口 $PORT)..."
echo ""

# 后台启动 node
node serve.js $PORT &
SERVER_PID=$!

# 等服务器起来
sleep 2

# 打开浏览器
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "http://localhost:$PORT/editor/"
else
  xdg-open "http://localhost:$PORT/editor/" 2>/dev/null || \
    echo "请手动打开浏览器访问 http://localhost:$PORT/editor/"
fi

echo "============================================"
echo "  服务器已启动,浏览器应已自动打开"
echo "  手动访问: http://localhost:$PORT/editor/"
echo "  按 Ctrl+C 停止服务器"
echo "============================================"
echo ""

# 捕获 Ctrl+C,关掉服务器
trap "kill $SERVER_PID 2>/dev/null; exit 0" INT TERM
wait $SERVER_PID
