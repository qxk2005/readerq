#!/bin/bash
set -e

# Base directories
RES_DIR="android/app/src/main/res"
LOGO_SRC="public/logo.png"

echo "=== 1. Generating Android Launcher Icons ==="

# Define sizes (folder:size)
sizes=(
  "mipmap-mdpi:48"
  "mipmap-hdpi:72"
  "mipmap-xhdpi:96"
  "mipmap-xxhdpi:144"
  "mipmap-xxxhdpi:192"
)

for item in "${sizes[@]}"; do
  folder="${item%%:*}"
  size="${item##*:}"
  target_dir="$RES_DIR/$folder"
  mkdir -p "$target_dir"
  
  echo "Generating launcher icon in $folder (${size}x${size})..."
  # Use sips to convert public/logo.png into PNG format with proper dimensions
  sips -s format png -z "$size" "$size" "$LOGO_SRC" --out "$target_dir/ic_launcher.png" > /dev/null
  sips -s format png -z "$size" "$size" "$LOGO_SRC" --out "$target_dir/ic_launcher_round.png" > /dev/null
done

echo "App launcher icons generated successfully!"

echo "=== 2. Generating Vector XML Icons from Lucide ==="

mkdir -p "$RES_DIR/drawable"

# List of icon mappings (Lucide name:Android resource name)
icons=(
  "house:ic_tab_library"
  "rss:ic_tab_feed"
  "notebook:ic_tab_notebook"
  "settings:ic_tab_settings"
  "key:ic_settings_api"
  "image:ic_settings_oss"
  "palette:ic_settings_appearance"
  "refresh-cw:ic_settings_sync"
  "keyboard:ic_settings_shortcuts"
  "info:ic_settings_about"
  "bot:ic_ai_assistant"
  "pencil:ic_edit_note"
  "sun:ic_theme_light"
  "moon:ic_theme_dark"
  "leaf:ic_theme_sepia"
)

for item in "${icons[@]}"; do
  lucide_name="${item%%:*}"
  res_name="${item##*:}"
  echo "Converting Lucide '$lucide_name' to '$res_name.xml'..."
  node scripts/lucide_to_android.js "$lucide_name" "$RES_DIR/drawable/$res_name.xml"
done

echo "SVG Vector XML icons generated successfully!"
