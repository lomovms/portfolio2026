param([int]$Port = 5173)
$ErrorActionPreference = 'Stop'
$taskNode = $null
$taskBundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if (Test-Path -LiteralPath $taskBundledNode) {
    $taskNode = $taskBundledNode
} else {
    $taskNode = (Get-Command node -ErrorAction Stop).Source
}
$taskVersion = [version]((& $taskNode --version).TrimStart('v'))
if ($taskVersion -lt [version]'20.19.0') { throw 'Требуется Node.js 20.19+ или 22.12+. Обновите Node.js и повторите запуск.' }
$taskVite = Join-Path $PSScriptRoot 'node_modules/vite/bin/vite.js'
if (!(Test-Path -LiteralPath $taskVite)) { throw 'Сначала установите зависимости: pnpm install' }
Set-Location -LiteralPath $PSScriptRoot
& $taskNode $taskVite --host 127.0.0.1 --port $Port --strictPort
exit $LASTEXITCODE
