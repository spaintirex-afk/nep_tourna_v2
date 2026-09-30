@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo Nep Tourna - Android APK Builder
echo ========================================

echo.
echo [1/5] Installing project dependencies...
npm install
if errorlevel 1 goto :error

echo.
echo [2/5] Building the web application...
npm run build
if errorlevel 1 goto :error

echo.
echo [3/5] Creating Android project if needed...
if not exist "android\settings.gradle" (
  npx cap add android
  if errorlevel 1 goto :error
)

echo.
echo [4/5] Syncing Capacitor...
npx cap sync android
if errorlevel 1 goto :error

echo.
echo [5/5] Building installable DEBUG APK...
cd android
gradlew.bat assembleDebug
if errorlevel 1 goto :error

echo.
echo ========================================
echo APK CREATED SUCCESSFULLY
echo ========================================
echo.
echo APK location:
echo android\app\build\outputs\apk\debug\app-debug.apk
exit /b 0

:error
echo.
echo BUILD FAILED.
echo Read the error above and send it to ChatGPT/Qoder if you need help.
exit /b 1
