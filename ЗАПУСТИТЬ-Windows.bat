@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ====================================
echo   Запуск сайта РЕВЕРС
echo ====================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js.
  echo Скачай LTS-версию тут: https://nodejs.org
  echo Установи, потом запусти этот файл снова.
  echo.
  pause
  exit /b
)

if not exist "node_modules" (
  echo Первый запуск: ставлю нужные файлы. Это 1-3 минуты, подожди...
  echo.
  call npm install
)

echo.
echo Сайт запускается. Открой в браузере:  http://localhost:3000
echo Чтобы выключить - закрой это окно.
echo.
call npm run dev
pause
