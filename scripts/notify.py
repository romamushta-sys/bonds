#!/usr/bin/env python3
"""Короткое сообщение в Telegram. Использование: python scripts/notify.py "текст".
Нужны переменные TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID; без них молча завершается.

© 2026 Мушта Роман Александрович. Все права защищены. Только для личного использования.
"""
import os
import sys
import urllib.parse
import urllib.request


def main():
    text = " ".join(sys.argv[1:]).strip() or "Сообщение от облигационного конструктора"
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not (token and chat):
        print("Токен или chat id не заданы, сообщение не отправлено:", text)
        return
    data = urllib.parse.urlencode({"chat_id": chat, "text": text[:4000]}).encode()
    with urllib.request.urlopen(urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data), timeout=30):
        print("Отправлено.")


if __name__ == "__main__":
    main()
