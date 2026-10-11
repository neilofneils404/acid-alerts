#!/bin/sh
# Syntax and self-contained checks for the plugin's QML. The Omarchy shell
# modules (qs.Commons, qs.Ui) and Quickshell are not installed where CI runs,
# so the checks that need their types are turned off.
set -eu

cd "$(dirname "$0")/.."

qmllint=${QMLLINT:-}
if [ -z "$qmllint" ]; then
  for candidate in /usr/lib/qt6/bin/qmllint qmllint6 qmllint-qt6 qmllint; do
    if command -v "$candidate" >/dev/null 2>&1; then
      qmllint=$candidate
      break
    fi
  done
fi
if [ -z "$qmllint" ] || ! "$qmllint" --version | grep -q "qmllint 6"; then
  echo "lint-qml: Qt 6 qmllint not found (set QMLLINT)" >&2
  exit 1
fi

# BarWidget.qml and Panel.qml extend shell types of the same name. Without the
# shell each would resolve to itself, which newer Qt treats as an error, so
# tests/qml-stubs supplies empty stand-ins for those two base types.
"$qmllint" --version
"$qmllint" \
  -I tests/qml-stubs \
  --import disable \
  --unresolved-type disable \
  --missing-type disable \
  --missing-property disable \
  --unqualified disable \
  --signal-handler-parameters disable \
  --max-warnings 0 \
  ./*.qml
echo "qml lint: ok"
