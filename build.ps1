# Builds TrafficStatistic.dll and installs it with the UI module into the game's local Mods folder.
param([switch]$NoInstall)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

& "C:\Program Files\dotnet\dotnet.exe" build (Join-Path $root "TrafficStatistic.csproj") -c Release -nologo -v quiet
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

if (-not $NoInstall) {
    $modDir = Join-Path $env:USERPROFILE "AppData\LocalLow\Colossal Order\Cities Skylines II\Mods\TrafficStatistic"
    New-Item -ItemType Directory -Force $modDir | Out-Null
    Copy-Item (Join-Path $root "bin\TrafficStatistic.dll") $modDir -Force
    Copy-Item (Join-Path $root "ui\TrafficStatistic.mjs") $modDir -Force
    "Installed to $modDir"
}
