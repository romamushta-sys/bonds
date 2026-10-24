#!/usr/bin/env python3
"""Ежедневный дайджест по вашему плану в Telegram.

© 2026 Мушта Роман Александрович. Все права защищены. Только для личного использования.

Берёт планы из секрета PLAN_JSON (файл, который скачивает кнопка «Экспорт» в приложении)
или из локального plan.json, сравнивает с data.json и отправляет сообщение, если есть о чём (state.json хранит, что уже было отправлено):
выплаты в ближайшие 7 дней, погашения и оферты в ближайшие 30 дней, цены, сдвинувшиеся
больше чем на 2 п.п. от цены в плане.
Переменные окружения: PLAN_JSON, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DIGEST_ALWAYS=1.
"""
import json
import os
import re
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


def rs(rt):
    r = str(rt or "").upper()
    if r.startswith("RU"):
        r = r[2:]
    if r == "ОФЗ":
        return 0
    m = re.match(r"^(AAA|AA|A|BBB|BB|B|C|D)", r)
    return {"AAA": 1, "AA": 2, "A": 3, "BBB": 4, "BB": 5, "B": 6, "C": 7, "D": 8}[m.group(1)] if m else 9


def num(x):
    try:
        return float(x) if x not in (None, "") else None
    except (TypeError, ValueError):
        return None


def match(c, b, today):
    """Те же условия, что в блоке «Выбрать бумаги самому» на странице."""
    yrs = (d_of(b["mat"]) - today).days / 365.25
    if c.get("q") and c["q"].lower() not in b["name"].lower():
        return False
    y0, y1, t0, t1 = (num(c.get(k)) for k in ("y0", "y1", "t0", "t1"))
    if (y0 is not None and b["y"] < y0) or (y1 is not None and b["y"] > y1):
        return False
    if (t0 is not None and yrs < t0) or (t1 is not None and yrs > t1):
        return False
    mr = int(num(c.get("mr")) or 0)
    if mr and rs(b["rt"]) > mr - 1:
        return False
    mf = int(num(c.get("mf")) or 0)
    if mf and b["f"] != mf:
        return False
    if c.get("of") and not (b.get("of") and b["of"] != "-"):
        return False
    if b.get("pk") and not c.get("pk"):
        return False
    if b.get("q") and not c.get("ql"):
        return False
    return True


def extras(payload, bonds, state, today):
    """Новые выпуски по сохранённым поискам и сработавшие оповещения. Меняет state."""
    lines = []
    st_s, st_a = state.setdefault("searches", {}), state.setdefault("alerts", {})
    for c in payload.get("searches", []) or []:
        now = sorted(b["name"] for b in bonds if match(c, b, today) and d_of(b["mat"]) > today)
        prev = st_s.get(c["n"])
        st_s[c["n"]] = now
        if prev is None:
            lines.append(f"Поиск «{c['n']}»: сейчас подходит {len(now)} выпусков, дальше пришлю только новые.")
        else:
            new = [n for n in now if n not in prev]
            if new:
                by = {b["name"]: b for b in bonds}
                lines.append(f"Поиск «{c['n']}»: новые выпуски ({len(new)}):")
                lines += [f"  {n}: {by[n]['y']:.1f}%, {by[n]['rt']}" for n in new[:10]]
    cur = {b["name"]: b for b in bonds}
    for a in payload.get("alerts", []) or []:
        b = cur.get(a["n"])
        key = f"{a['n']}|{a['t']}|{a['v']}"
        ok = bool(b) and ((b["y"] >= a["v"]) if a["t"] == "y" else (b["p"] <= a["v"]))
        if ok and not st_a.get(key):
            lines.append(f"Оповещение: {a['n']}: " + (f"доходность {b['y']:.1f}% (порог {a['v']}%)" if a["t"] == "y" else f"цена {b['p']:.2f}% (порог {a['v']}%)"))
        st_a[key] = ok
    return lines


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
    today = date.today()
    text = compose(plans, bonds, today)
    sp = ROOT / "state.json"
    try:
        state = json.loads(sp.read_text(encoding="utf-8")) if sp.exists() else {}
    except ValueError:
        state = {}
    payload = json.loads(raw)
    ex = extras(payload, bonds, state, today) if isinstance(payload, dict) else []
    sp.write_text(json.dumps(state, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if ex:
        text = (text + "\n\n" if text else f"Дайджест по облигациям на {today.strftime('%d.%m.%Y')}\n\n") + "\n".join(ex)
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
