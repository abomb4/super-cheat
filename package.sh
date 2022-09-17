#!/bin/sh
version=$(cat mod.hjson |grep -e "^version:" |awk '{print $2}')
zip -r super-cheat-v$version.zip README.md preview.png icon.png LICENSE mod.hjson bundles/ content/ scripts/ sounds/ sprites/ schematics/
