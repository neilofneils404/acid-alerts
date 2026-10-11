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
#
# Categories come and go between Qt releases, and some count against
# --max-warnings without being printed. Read the JSON report and decide here.
"$qmllint" --version
report=$("$qmllint" -I tests/qml-stubs --json - ./*.qml) || true
printf '%s' "$report" | node -e '
const ignored = new Set([
  // Need the shell and Quickshell types, which are not installed in CI.
  "import", "unresolved-type", "missing-type", "missing-property", "unqualified",
  "signal-handler-parameters",
  // The JavaScript here is written with var throughout so Model.js stays plain.
  "block-scope-var-declaration",
])
let text = ""
process.stdin.on("data", chunk => { text += chunk })
process.stdin.on("end", () => {
  const files = JSON.parse(text).files
  if (!files || files.length === 0) throw new Error("qmllint reported no files")
  let problems = 0
  for (const file of files) {
    for (const warning of file.warnings) {
      if (warning.type === "info" || ignored.has(warning.id)) continue
      problems++
      console.error(`${file.filename}:${warning.line}:${warning.column}: ${warning.message} [${warning.id}]`)
    }
  }
  if (problems > 0) process.exit(1)
  console.log(`qml lint: ok (${files.length} files)`)
})
'
