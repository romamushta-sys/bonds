#!/usr/bin/env python3
"""Ежедневный дайджест по вашему плану в Telegram.

© 2026 Мушта Роман Александрович. Все права защищены. Только для личного использования.

Берёт планы из секрета PLAN_JSON (файл, который скачивает кнопка «Экспорт» в приложении)
или из локального plan.json, сравнивает с data.json и отправляет сообщение, если есть о чём:
выплаты в ближайшие 7 дней, погашения и оферты в ближайшие 30 дней, цены, сдвинувшиеся
больше чем на 2 п.п. от цены в плане.
Переменные окружения: PLAN_JSON, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DIGEST_ALWAYS=1.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from update_data import addm  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MSK = timezone(timedelta(hours=3))


def d_of(s):
    s = str(s)
    if len(s) > 10 and (s.endswith("Z") or "+" in s[10:]):
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(MSK).date()
    return date.fromisoformat(s[:10])


def load_plans(text):
    o = json.loads(text)
    if isinstance(o, dict) and "all" in o:
        return list(o["all"].values())
    if isinstance(o, dict) and "items" in o:
        return [o]
    return []


def compose(plans, bonds, today):
    held = {}
    for p in plans:
        for x in p.get("items", []):
            if x.get("got", 0) > 0:
                h = held.setdefault(x["n"], dict(x, got=0))
                h["got"] += x["got"]
    cur = {b["name"]: b for b in bonds}
    pay, offers, moves, missing = [], [], [], []
    for n, x in sorted(held.items()):
        f = round(x.get("f") or 0)
        mat = d_of(x["mat"])
        if f and 12 % f == 0:
            nx = d_of(x["nx"])
            for k in range(-200, 200):
                d = addm(nx, (12 // f) * k)
                if today <= d <= today + timedelta(days=7) and d < mat:
                    pay.append((d, f"{n}: купон {x['c'] * x['got']:,.0f} ₽".replace(",", " ")))
        if today <= mat <= today + timedelta(days=30):
            pay.append((mat, f"{n}: погашение {1000 * x['got'] + x['c'] * x['got']:,.0f} ₽ (с последним купоном)".replace(",", " ")))
        b = cur.get(n)
        if not b:
            missing.append(n)
            continue
        of = b.get("of")
        if of and of != "-":
            try:
                od = datetime.strptime(of, "%d.%m.%Y").date()
                if today <= od <= today + timedelta(days=30):
                    offers.append((od, f"{n}: оферта {of}, в портфеле {x['got']} шт."))
            except ValueError:
                pass
        dp = b["p"] - x["p"]
        if abs(dp) >= 2:
            moves.append(f"{n}: цена {b['p']:.2f}% ({dp:+.2f} п.п. к цене в плане)")
    lines = []
    if pay:
        lines.append("Выплаты в ближайшие дни:")
        lines += [f"{d.strftime('%d.%m')} {t}" for d, t in sorted(pay)]
    if offers:
        lines.append("Оферты в ближайшие 30 дней:")
        lines += [f"{d.strftime('%d.%m')} {t}" for d, t in sorted(offers)]
    if moves:
        lines.append("Цена сдвинулась больше чем на 2 п.п.:")
        lines += moves
    if missing:
        lines.append("Нет в свежих данных (погашены или не торгуются): " + ", ".join(missing))
    if not lines:
        return None
    return f"Дайджест по облигациям на {today.strftime('%d.%m.%Y')}\n\n" + "\n".join(lines)


def send(token, chat, text):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": chat, "text": text[:4000]}).encode()
    with urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=30) as r:
        return json.load(r)


def main():
    raw = os.environ.get("PLAN_JSON", "").strip()
    if not raw and (ROOT / "plan.json").exists():
        raw = (ROOT / "plan.json").read_text(encoding="utf-8")
    if not raw:
        print("План не найден: добавьте секрет PLAN_JSON (содержимое файла из кнопки «Экспорт»).")
        return
    plans = load_plans(raw)
    bonds = json.loads((ROOT / "data.json").read_text(encoding="utf-8")).get("b", [])
    text = compose(plans, bonds, date.today())
    if not text:
        if os.environ.get("DIGEST_ALWAYS") == "1":
            text = "Ничего срочного: ближайших выплат, оферт и больших движений цены нет."
        else:
            print("Ничего срочного, сообщение не отправляю.")
            return
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not (token and chat):
        print("Не заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID, вот текст сообщения:\n" + text)
        return
    send(token, chat, text)
    print("Отправлено.")


if __name__ == "__main__":
    main()
