"""Polite HTTP: throttle, retry, identify ourselves."""
import time
import requests

_last = 0.0
HEADERS = {"User-Agent": "mlb-stats-app/0.1 (personal project; nightly batch; contact via GitHub repo)"}


def get(url, params=None, min_interval=2.0, tries=4, **kw):
    global _last
    for i in range(tries):
        wait = _last + min_interval - time.time()
        if wait > 0:
            time.sleep(wait)
        _last = time.time()
        r = requests.get(url, params=params, headers=HEADERS, timeout=90, **kw)
        if r.status_code == 200:
            return r
        if r.status_code in (429, 500, 502, 503, 504):
            time.sleep(10 * (i + 1))
            continue
        r.raise_for_status()
    r.raise_for_status()
