#!/usr/bin/env python3
# © 2026 Мушта Роман Александрович. Все права защищены. Только для личного использования.
"""Обновляет data.json котировками облигаций Московской биржи (ISS API).

© 2026 Мушта Роман Александрович. Все права защищены. Только для личного использования.

Только стандартная библиотека Python. Запуск: python scripts/update_data.py
Рейтинги ISS не отдаёт, поэтому они берутся из ratings.json (название -> рейтинг)
и из предыдущего data.json. Новые корпоративные выпуски без рейтинга получают «—»
и не попадают ни в один профиль риска, пока рейтинг не добавлен в ratings.json.
"""
import calendar
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get("ISS_BASE", "https://iss.moex.com")
URL = BASE + "/iss/engines/stock/markets/bonds/boards/{board}/securities.json"
BOARDS = {"TQOB": True, "TQCB": False}  # True = ОФЗ
MIN_BONDS = int(os.environ.get("MIN_BONDS", "50"))
NEED = ["SECID", "SHORTNAME", "MATDATE", "COUPONVALUE", "NEXTCOUPON", "ACCRUEDINT", "COUPONPERIOD", "FACEVALUE"]


def num(x):
    try:
        v = float(x)
        return v if v == v else None
    except (TypeError, ValueError):
        return None


def first(*vals):
    for v in vals:
        v = num(v)
        if v is not None and v > 0:
            return v
    return None


def pdate(s):
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def addm(d, m):
    y = d.year + (d.month - 1 + m) // 12
    mo = (d.month - 1 + m) % 12 + 1
    return date(y, mo, min(d.day, calendar.monthrange(y, mo)[1]))


def freq_of(period):
    if not period or period <= 0:
        return None
    f = 365.0 / period
    return min((1, 2, 3, 4, 6, 12), key=lambda k: abs(k - f))


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "bond-constructor/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            print(f"попытка {i + 1} не удалась: {e}", file=sys.stderr)
            time.sleep(2 * (i + 1))
    raise SystemExit("ISS недоступен: " + url)


def table(js, name):
    t = js.get(name) or {}
    cols = t.get("columns", [])
    return [dict(zip(cols, r)) for r in t.get("data", [])]


def fetch_board(board):
    sec, md, start = {}, {}, 0
    for _ in range(40):  # страховка от бесконечного цикла
        q = urllib.parse.urlencode({"iss.meta": "off", "iss.only": "securities,marketdata", "start": start})
        js = get(URL.format(board=board) + "?" + q)
        s, m = table(js, "securities"), table(js, "marketdata")
        new = [r for r in s if r.get("SECID") not in sec]
        for r in s:
            sec[r["SECID"]] = r
        for r in m:
            md[r["SECID"]] = r
        if not new:
            break
        start += len(s)
    return sec, md


def ytm(price, face, coupon, freq, nxt, mat, nkd, today):
    """Доходность к погашению, % годовых (эффективная), если ISS не отдал свою."""
    if 12 % freq:
        return None
    dirty = price * face / 100.0 + (nkd or 0)
    flows, k, d = [], 0, nxt
    while d <= mat:
        flows.append((d, coupon))
        k += 1
        d = addm(nxt, (12 // freq) * k)
    flows.append((mat, face))

    def pv(y):
        return sum(cf / (1 + y) ** max((dd - today).days / 365.0, 0) for dd, cf in flows)

    lo, hi = -0.9, 10.0
    if pv(lo) < dirty or pv(hi) > dirty:
        return None
    for _ in range(100):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if pv(mid) > dirty else (lo, mid)
    return round((lo + hi) / 2 * 100, 2)


def is_qual(s):
    """Признак «только для квалифицированных инвесторов», если биржа его отдаёт."""
    for k, v in s.items():
        if "QUAL" in k.upper() and str(v).strip().lower() in ("1", "true", "y", "yes", "да"):
            return True
    return "квалиф" in " ".join(str(s.get(k) or "") for k in ("REMARKS", "SECNAME")).lower()


def convert(s, m, is_ofz, ratings, today):
    """Возвращает (облигация, None) или (None, причина пропуска)."""
    secid = s["SECID"]
    name = (s.get("SHORTNAME") or secid).strip()
    fl = "ПК" if re.match(r"^SU29\d{3}", secid) else "ИН" if re.match(r"^SU52\d{3}", secid) else "АД" if re.match(r"^SU46\d{3}", secid) else ""
    if fl in ("ИН", "АД"):
        return None, "индекс/амортизация"
    face = num(s.get("FACEVALUE"))
    if face is None or abs(face - 1000) > 0.01 or s.get("FACEUNIT") not in (None, "SUR", "RUB"):
        return None, "номинал не 1000 ₽"
    mat, nx = pdate(s.get("MATDATE")), pdate(s.get("NEXTCOUPON"))
    price = first(m.get("LAST"), m.get("WAPRICE"), s.get("PREVWAPRICE"), s.get("PREVPRICE"))
    coupon = num(s.get("COUPONVALUE")) or 0
    f = freq_of(num(s.get("COUPONPERIOD")))
    nkd = num(s.get("ACCRUEDINT")) or 0
    if not (mat and mat > today and nx and f and price):
        return None, "нет данных (дата, купон или цена)"
    if fl != "ПК" and coupon <= 0:
        return None, "нулевой купон"
    y = first(m.get("YIELD"), m.get("YIELDATWAP"))
    if fl != "ПК" and not y:
        y = ytm(price, face, coupon, f, nx, mat, nkd, today)
    if fl != "ПК" and not (y and y > 0):
        return None, "нет доходности"
    dur, val = num(m.get("DURATION")), num(m.get("VALTODAY"))
    offer = pdate(s.get("OFFERDATE")) or pdate(s.get("BUYBACKDATE"))
    bond = {
        "name": name,
        "mat": mat.isoformat() + "T00:00:00",
        "y": y or 0,
        "p": round(price, 3),
        "rt": "ОФЗ" if is_ofz else ratings.get(name, "—"),
        "vol": round(val / 1e6, 1) if val else None,
        "c": coupon,
        "f": f,
        "nkd": nkd,
        "dur": round(dur / 365.0, 2) if dur else None,
        "nx": nx.isoformat() + "T00:00:00",
        "fl": fl,
        "of": offer.strftime("%d.%m.%Y") if offer else "",
        "pk": fl == "ПК",
    }
    if is_qual(s):
        bond["q"] = 1
    return bond, None


def update_history(out, day, keep=250):
    """Дописывает цены и доходности за день в history.json (только выпуски с рейтингом и ОФЗ)."""
    hp = ROOT / "history.json"
    h = {"d": [], "p": {}, "y": {}}
    if hp.exists():
        try:
            h = json.loads(hp.read_text(encoding="utf-8"))
        except ValueError:
            pass
    day = day.isoformat()
    if not h["d"] or h["d"][-1] != day:
        h["d"].append(day)
    n = len(h["d"])
    idx = n - 1
    for key in ("p", "y"):
        for arr in h[key].values():
            arr.extend([None] * (n - len(arr)))
    for name, b in out.items():
        if b["rt"] == "—":
            continue
        for key, val in (("p", b["p"]), ("y", b["y"] if b["y"] and b["y"] > 0 else None)):
            arr = h[key].setdefault(name, [None] * n)
            arr[idx] = val
    if n > keep:
        h["d"] = h["d"][-keep:]
        for key in ("p", "y"):
            for name in h[key]:
                h[key][name] = h[key][name][-keep:]
    for key in ("p", "y"):
        h[key] = {k: v for k, v in h[key].items() if any(x is not None for x in v)}
    hp.write_text(json.dumps(h, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"history.json: {len(h['d'])} дн., {len(h['p'])} выпусков")


def main():
    today = date.today()
    old = {}
    dp = ROOT / "data.json"
    if dp.exists():
        try:
            old = json.loads(dp.read_text(encoding="utf-8"))
        except ValueError:
            pass
    ratings = {}
    rp = ROOT / "ratings.json"
    if rp.exists():
        ratings.update(json.loads(rp.read_text(encoding="utf-8")))
    for b in old.get("b", []):
        if b.get("rt") not in (None, "—", "ОФЗ"):
            ratings.setdefault(b["name"], b["rt"])

    out, skipped, unrated = {}, {}, []
    for board, is_ofz in BOARDS.items():
        sec, md = fetch_board(board)
        print(f"{board}: получено {len(sec)} выпусков")
        print("Колонки securities:", ", ".join(next(iter(sec.values()))) if sec else "-")
        if not sec:
            raise SystemExit(f"Пустой ответ по площадке {board}: данные не перезаписываю")
        missing = [c for c in NEED if c not in next(iter(sec.values()))]
        if missing:
            raise SystemExit("В ответе ISS нет колонок: " + ", ".join(missing) + ". Формат изменился, пришлите это сообщение разработчику.")
        for secid, s in sec.items():
            b, why = convert(s, md.get(secid, {}), is_ofz, ratings, today)
            if b:
                out[b["name"]] = b
                if b["rt"] == "—":
                    unrated.append(b["name"])
            else:
                skipped[why] = skipped.get(why, 0) + 1

    print(f"Облигаций в data.json: {len(out)}; без рейтинга: {len(unrated)}; для квалифицированных: {sum(1 for b in out.values() if b.get('q'))}")
    print("Пропущено:", json.dumps(skipped, ensure_ascii=False))
    if unrated:
        print("Без рейтинга (первые 30):", ", ".join(unrated[:30]))
    if len(out) < MIN_BONDS:
        raise SystemExit(f"Слишком мало облигаций ({len(out)} < {MIN_BONDS}): данные не перезаписываю")

    msk = datetime.now(timezone(timedelta(hours=3)))
    data = {
        "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "f": "Московская биржа (ISS), " + msk.strftime("%d.%m.%Y %H:%M") + " МСК",
        "b": sorted(out.values(), key=lambda b: b["name"]),
    }
    dp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    update_history(out, msk.date())


if __name__ == "__main__":
    main()
