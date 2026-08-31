@echo off
chcp 65001 >nul
title 麻将消一消 - 编辑器

echo.
echo ============================================
echo    🀄  麻将消一消 编辑器
echo ============================================
echo.

REM ── 检查 Node.js ─────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [错误] 未检测到 Node.js
  echo.
  echo 请先安装 Node.js(>= 14):
  echo   https://nodejs.org/
  echo.
  echo 安装时勾选 "Add to PATH",装完重新双击此 bat 即可
  echo.
  pause
  exit /b 1
)

echo Node.js 版本:
node -v
echo.

REM ── 检查端口是否被占用,被占则用下一个可用端口 ──
set PORT=9002
:check_port
netstat -an | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo 端口 %PORT% 被占用,尝试 %PORT%+1...
  set /a PORT+=1
  if %PORT% GTR 9099 (
    echo [错误] 9002~9099 都被占用,请手动关闭占用端口的程序
    pause
    exit /b 1
  )
  goto check_port
)

REM ── 启动服务器 ──
echo 启动本地服务器(端口 %PORT%)...
echo.

REM 后台启动 node(脚本会保持运行到 Ctrl+C)
start "mahjong-server" /min cmd /c "node serve.js %PORT%"

REM 等服务器起来
timeout /t 2 /nobreak >nul

REM ── 打开浏览器 ──
echo 打开浏览器...
start "" "http://localhost:%PORT%/editor/"

echo.
echo ============================================
echo  服务器已启动,浏览器应已自动打开
echo  手动访问: http://localhost:%PORT%/editor/
echo  按任意键关闭此窗口(服务器会继续运行)
echo  关闭服务器:任务栏右下角托盘里的 node 窗口
echo ============================================
echo.
pause >nul
