#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Run the build process
npm run build

# Destination directory for the built plugin files
TARGET_DIR="/Users/omasu/devmode/.obsidian/plugins/threads"

# Ensure the target directory exists
mkdir -p "$TARGET_DIR"

# Copy the generated files to the Obsidian plugins folder
cp -f manifest.json "$TARGET_DIR/manifest.json"
cp -f main.js "$TARGET_DIR/main.js"
cp -f styles.css "$TARGET_DIR/styles.css"

echo "Build completed and files copied to $TARGET_DIR"