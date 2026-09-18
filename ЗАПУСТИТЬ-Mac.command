#!/bin/bash
cd "$(dirname "$0")"

echo
echo "===================================="
echo "  Запуск сайта РЕВЕРС"
echo "===================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Не найден Node.js."
  echo "Скачай LTS-версию тут: https://nodejs.org"
  echo "Установи, потом запусти этот файл снова."
  echo
  read -n 1 -s -r -p "Нажми любую клавишу..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Первый запуск: ставлю нужные файлы. Это 1-3 минуты, подожди..."
  echo
  npm install
fi

echo
echo "Сайт запускается. Открой в браузере:  http://localhost:3000"
echo "Чтобы выключить - закрой это окно."
echo
npm run dev
