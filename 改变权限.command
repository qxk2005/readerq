#!/bin/sh
# 改变权限.command
# 用于解决 macOS 提示 "ReaderQ 已损坏" 或 "无法验证开发者" 的问题

# 获取当前脚本所在目录
DIR="$( cd "$( dirname "$0" )" && pwd )"

echo "============================================="
echo "正在为 ReaderQ 设置运行权限..."
echo "============================================="

# 尝试对 /Applications/ReaderQ.app 执行 xattr 命令
if [ -d "/Applications/ReaderQ.app" ]; then
    xattr -rd com.apple.quarantine /Applications/ReaderQ.app
    echo "✓ 已成功移除 /Applications/ReaderQ.app 的隔离属性。"
else
    echo "⚠ 未在 /Applications 目录下找到 ReaderQ.app。"
    echo "正在尝试移除当前目录下 ReaderQ.app 的隔离属性..."
    if [ -d "$DIR/ReaderQ.app" ]; then
        xattr -rd com.apple.quarantine "$DIR/ReaderQ.app"
        echo "✓ 已成功移除当前目录下 ReaderQ.app 的隔离属性。"
    else
        echo "❌ 未找到 ReaderQ.app。请先将 ReaderQ 安装到应用程序文件夹中，或确保它与此脚本在同一目录下。"
    fi
fi

echo "============================================="
echo "设置完成！您现在可以尝试正常打开 ReaderQ。"
echo "此窗口可以安全关闭。"
echo "============================================="
