$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Write-Host 'Nep Tourna - Android APK Builder'
npm install
npm run build
if (-not (Test-Path 'android/settings.gradle')) {
  npx cap add android
}
npx cap sync android
Push-Location android
try {
  .\gradlew.bat assembleDebug
} finally {
  Pop-Location
}
Write-Host ''
Write-Host 'APK: android/app/build/outputs/apk/debug/app-debug.apk'
