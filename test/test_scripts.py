"""© 2026 Мушта Роман Александрович. Тесты скриптов: python -m unittest discover -s tests -p "test_*.py" """
import json, os, re, subprocess, sys, tempfile, threading, unittest, http.server, socketserver, shutil
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import update_data as u  # noqa: E402
import digest as dg  # noqa: E402

SC = ["SECID", "BOARDID", "SHORTNAME", "MATDATE", "COUPONVALUE", "NEXTCOUPON", "ACCRUEDINT", "COUPONPERIOD", "FACEVALUE", "FACEUNIT", "PREVWAPRICE", "OFFERDATE", "BUYBACKDATE"]
MC = ["SECID", "LAST", "WAPRICE", "YIELD", "DURATION", "VALTODAY"]
NAMES = ["ИнвОбл06", "Серия А1", "Серия А2", "Серия Б1", "Другая"]
FUT = lambda days: (date.today() + timedelta(days=days)).isoformat()  # noqa: E731


class Mock(http.server.BaseHTTPRequestHandler):
    mode, corp, reqs = "ok", NAMES, []

    def do_GET(self):
        if "/iss/securities/" in self.path:
            sid = re.search(r"/securities/(\w+)\.json", self.path).group(1)
            Mock.reqs.append(sid)
            n = int(sid[-2:])
            if Mock.mode == "nofield":
                rows = [["DESC", "Описание", "x"]]
            else:
                rows = [["ISQUALIFIEDINVESTORS", "Бумаги для квалифицированных инвесторов", "1" if n in (2, 3) else "0"]]
            return self._send({"description": {"columns": ["name", "title", "value"], "data": rows}})
        if "TQOB" in self.path:
            sec = [["SU26250RMFS9", "TQOB", "ОФЗ 26250", FUT(3000), 59.84, FUT(60), 39.5, 182, 1000, "SUR", 79.69, None, None]]
            md = [["SU26250RMFS9", 79.7, 79.6, 16.7, 2000, 640e6]]
        else:
            sec = [[f"RU000A10XX{i:02d}", "TQCB", n, FUT(1200), 30.0, FUT(20), 12.0, 30, 1000, "SUR", 97.5, None, None] for i, n in enumerate(Mock.corp, 1)]
            md = [[c[0], 97.6, 97.5, None, 900, 5e6] for c in sec]
        self._send({"securities": {"columns": SC, "data": sec}, "marketdata": {"columns": MC, "data": md}})

    def _send(self, o):
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(o).encode())

    def log_message(self, *a):
        pass


class Scripts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = socketserver.TCPServer(("127.0.0.1", 0), Mock)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.port = cls.srv.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def run_update(self, tmp, mode="ok", block=None, corp=None, min_bonds="1"):
        Mock.mode, Mock.corp = mode, corp or NAMES
        Mock.reqs.clear()
        shutil.copytree(ROOT / "scripts", tmp / "scripts", dirs_exist_ok=True)
        (tmp / "ratings.json").write_text("{}", encoding="utf-8")
        if block is not None:
            (tmp / "blocklist.json").write_text(json.dumps({"names": block}, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "ISS_BASE": f"http://127.0.0.1:{self.port}", "MIN_BONDS": min_bonds}
        r = subprocess.run([sys.executable, "scripts/update_data.py"], cwd=tmp, env=env, capture_output=True, text=True)
        d = json.loads((tmp / "data.json").read_text(encoding="utf-8")) if (tmp / "data.json").exists() else None
        return r, d

    def test_ytm_basics(self):
        t = date(2026, 1, 1)
        y = u.ytm(100, 1000, 100, 1, date(2027, 1, 1), date(2027, 1, 1), 0, t)
        self.assertAlmostEqual(y, 10.0, delta=0.05)
        y0 = u.ytm(80, 1000, 0, 1, date(2028, 1, 1), date(2028, 1, 1), 0, t)
        self.assertAlmostEqual(y0, ((1000 / 800) ** (1 / (730 / 365)) - 1) * 100, delta=0.05)
        stale = u.ytm(100, 1000, 50, 2, date(2025, 12, 1), date(2026, 7, 1), 0, t)  # дата купона уже прошла
        self.assertTrue(stale is not None and 5 < stale < 20)

    def test_qualified_cache_and_blocklist(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            r, d = self.run_update(tmp, block=["Серия Б1"])
            names = sorted(b["name"] for b in d["b"])
            self.assertEqual(d["qual"], "ok")
            self.assertNotIn("Серия А1", names)   # квалифицированные по признаку биржи
            self.assertNotIn("Серия А2", names)
            self.assertNotIn("Серия Б1", names)   # blocklist
            self.assertIn("ИнвОбл06", names)
            self.assertIn("ОФЗ 26250", names)
            self.assertIn("Сверка доходности", r.stdout)
            n1 = len(Mock.reqs)
            r, d2 = self.run_update(tmp, block=["Серия Б1"])
            self.assertEqual(len(Mock.reqs), 0, "повторный запуск не должен запрашивать описания")
            self.assertGreater(n1, 0)
            r, d3 = self.run_update(tmp, block=["ИнвОбл*"])
            self.assertNotIn("ИнвОбл06", [b["name"] for b in d3["b"]])

    def test_unknown_field_keeps_bonds_and_flags_state(self):
        with tempfile.TemporaryDirectory() as td:
            r, d = self.run_update(Path(td), mode="nofield")
            self.assertEqual(d["qual"], "unknown")
            self.assertEqual(len(d["b"]), 6)

    def test_shrink_guard_keeps_old_data(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            self.run_update(tmp)
            old = json.loads((tmp / "data.json").read_text(encoding="utf-8"))
            old["universe"] = 1000
            (tmp / "data.json").write_text(json.dumps(old, ensure_ascii=False), encoding="utf-8")
            r, d = self.run_update(tmp, corp=["Одна"])
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("заметно меньше", r.stdout + r.stderr)
            self.assertEqual(len(d["b"]), len(old["b"]), "данные не должны быть перезаписаны")

    def test_history_alignment_and_trim(self):
        with tempfile.TemporaryDirectory() as td:
            old_root = u.ROOT
            u.ROOT = Path(td)
            try:
                mk = lambda p, y, rt="AA": {"rt": rt, "p": p, "y": y}  # noqa: E731
                u.update_history({"A": mk(90, 15), "B": mk(80, None, "—")}, date(2026, 10, 22))
                u.update_history({"A": mk(91, 15.5), "D": mk(60, 20)}, date(2026, 10, 23))
                u.update_history({"A": mk(92, 16), "D": mk(61, 21)}, date(2026, 10, 23))
                h = json.loads((Path(td) / "history.json").read_text(encoding="utf-8"))
                self.assertEqual(h["d"], ["2026-10-22", "2026-10-23"])
                self.assertEqual(h["p"]["A"], [90, 92])
                self.assertEqual(h["p"]["D"], [None, 61])
                self.assertNotIn("B", h["p"])
                for i in range(300):
                    u.update_history({"A": mk(90, 15)}, date.fromordinal(date(2026, 11, 1).toordinal() + i))
                h = json.loads((Path(td) / "history.json").read_text(encoding="utf-8"))
                self.assertEqual((len(h["d"]), len(h["p"]["A"])), (250, 250))
                self.assertNotIn("D", h["p"])
            finally:
                u.ROOT = old_root

    def test_digest_stress_search_and_alert_state(self):
        hist = {"d": [f"2026-10-0{i}" for i in range(1, 8)], "p": {"X": [90] * 6 + [85], "Y": [90] * 7, "Z": [90] * 7}}
        self.assertEqual(len(dg.stress(["X", "Y"], hist)), 1)
        self.assertEqual(dg.stress(["X"], {"d": ["1"], "p": {}}), [])
        bonds = [{"name": "A", "mat": FUT(900) + "T00:00:00", "y": 18, "p": 90, "f": 2, "rt": "AA", "of": ""}, {"name": "Q", "mat": FUT(900) + "T00:00:00", "y": 30, "p": 80, "f": 2, "rt": "AA", "of": "", "q": 1}]
        payload = {"searches": [{"n": "s1", "y0": "10", "mr": "4"}], "alerts": [{"n": "A", "t": "y", "v": 17}], "blk": {}}
        st = {}
        first = dg.extras(payload, bonds, st, date.today())
        self.assertTrue(any("Поиск" in x for x in first) and any("Оповещение" in x for x in first))
        self.assertEqual(st["searches"]["s1"], ["A"], "бумага для квалифицированных не должна попасть в поиск")
        self.assertEqual(dg.extras(payload, bonds, st, date.today()), [])
        payload["blk"] = {"A": 1}
        self.assertEqual(dg.extras(payload, bonds, {}, date.today())[0].count("0 выпусков") + 0, 1)


if __name__ == "__main__":
    unittest.main()
