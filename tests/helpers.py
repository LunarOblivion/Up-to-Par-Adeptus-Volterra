"""
Shared helpers for the tests: import paths, the page data, and a headless-Chrome probe of the page.
"""

import html as html_module
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
for path in (ROOT, ROOT / "model"):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

POINTS = [p["id"] for p in json.loads((ROOT / "data_fetch" / "points.json").read_text(encoding="utf-8"))["points"]]


def page_data(html):
    """The DATA object embedded in the page (web/template.html: <script>const DATA=...;</script>)."""
    start = html.index("const DATA=") + len("const DATA=")
    end = html.index(";</script>", start)
    return json.loads(html[start:end])


CHROME_CANDIDATES = [
    "chrome", "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "msedge",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]
PHONE_WIDTH = 390


def find_chrome():
    for name in CHROME_CANDIDATES:
        path = shutil.which(name) or (name if pathlib.Path(name).is_file() else None)
        if path:
            return path
    return None


# Installed first thing in <head>: collects script errors for the probe.
ERROR_HOOK = """<script>
window.__errs = [];
window.addEventListener("error", e => window.__errs.push(String(e.message)));
window.addEventListener("unhandledrejection", e => window.__errs.push("promise: " + String(e.reason && e.reason.message || e.reason)));
window.__wait = ms => new Promise(r => setTimeout(r, ms));
</script>"""


def probe_page(html_path, width, body_js, offline=True, start_ms=7000, budget_ms=90000, height=900):
    """Open the page in headless Chrome or Edge and run `body_js`, the body of an async function whose
    return value comes back as a Python object (with the page's script errors under "errors").

    offline=True blocks every host name, so the page sees no internet at all.
    width=390 is laid out with CSS zoom in a 500 px window: headless Chrome will not open a window
    narrower than about 500 px. Returns None when neither Chrome nor Edge is installed.
    """
    chrome = find_chrome()
    if not chrome:
        return None
    page = pathlib.Path(html_path).read_text(encoding="utf-8")
    window = width
    if width < 500:
        window = 500
        page = page.replace("</head>", f"<style>html {{ zoom: {window / width:.5f}; }}</style></head>", 1)
    probe = ("<script>setTimeout(async () => { let out;"
             " try { out = await (async () => {" + body_js + "})(); } catch (e) { out = { exception: String(e) }; }"
             " out = out || {}; out.errors = window.__errs;"
             ' document.title = "PROBE " + JSON.stringify(out); }, ' + str(start_ms) + ");</script></body>")
    page = page.replace("<head>", "<head>" + ERROR_HOOK, 1).replace("</body>", probe, 1)
    args = ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
            f"--window-size={window},{height}", f"--virtual-time-budget={budget_ms}", "--dump-dom"]
    if offline:
        args.append("--host-resolver-rules=MAP * ~NOTFOUND")
    with tempfile.TemporaryDirectory() as tmp:
        target = pathlib.Path(tmp) / "probe.html"
        with open(target, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(page)
        done = subprocess.run([chrome] + args + [f"--user-data-dir={pathlib.Path(tmp) / 'profile'}", target.as_uri()],
                              capture_output=True, text=True, encoding="utf-8", timeout=300)
    found = re.search(r"<title>PROBE (.*?)</title>", done.stdout, re.S)
    if not found:
        raise AssertionError(f"no probe result from {chrome}:\n{done.stdout[-400:]}\n{done.stderr[-400:]}")
    return json.loads(html_module.unescape(found.group(1)))
