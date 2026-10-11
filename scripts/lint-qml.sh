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
# shell installed each resolves to itself, which is reported under a category
# whose name differs between Qt releases, so pass only the ones this build has.
flags=""
for category in import unresolved-type missing-type missing-property unqualified \
  inheritance-cycle type-instantiated-recursively signal-handler-parameters; do
  if "$qmllint" --help | grep -q -- "--$category "; then
    flags="$flags --$category disable"
  fi
done

# shellcheck disable=SC2086
"$qmllint" $flags --max-warnings 0 ./*.qml
echo "qml lint: ok"
