"""snip.ly on GCP — single Cloud Function (gen2) + Firestore.

Routes:
    POST /shorten  -> {"url": "https://..."}  => 201 {"code": "aB3xYz"}
    GET  /{code}   -> 301 redirect (click counter incremented)
"""

import random
import string
import time
import urllib.parse

import functions_framework
from google.api_core.exceptions import AlreadyExists
from google.cloud import firestore
from google.cloud.firestore_v1.transforms import Increment

db = firestore.Client()
COLLECTION = "urls"

ALPHABET = string.ascii_letters + string.digits
CODE_LENGTH = 6


def _is_valid_url(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False


def _generate_code(length: int = CODE_LENGTH) -> str:
    rng = random.SystemRandom()
    return "".join(rng.choice(ALPHABET) for _ in range(length))


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def _shorten(request):
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return {"error": "Missing 'url' in request body"}, 400
    if not _is_valid_url(url):
        return {"error": "URL must start with http:// or https://"}, 400

    for _ in range(5):
        code = _generate_code()
        doc_ref = db.collection(COLLECTION).document(code)
        try:
            doc_ref.create(
                {"url": url, "created_at": int(time.time()), "clicks": 0}
            )
            break
        except AlreadyExists:
            continue
    else:
        return {"error": "Could not generate a unique code, try again"}, 500

    return {"code": code, "url": url}, 201


def _redirect(code: str):
    doc_ref = db.collection(COLLECTION).document(code)
    doc = doc_ref.get()
    if not doc.exists:
        return {"error": "Short URL not found"}, 404

    # Best-effort click counter.
    try:
        doc_ref.update({"clicks": Increment(1)})
    except Exception:
        pass

    return "", 301, {"Location": doc.to_dict()["url"]}


@functions_framework.http
def api(request):
    if request.method == "OPTIONS":
        return "", 204, _cors_headers()

    path = (request.path or "/").rstrip("/") or "/"

    if request.method == "POST" and path == "/shorten":
        body, status = _shorten(request)[:2]
        return body, status, _cors_headers()

    if request.method == "GET" and path != "/":
        code = path.lstrip("/").split("/")[0]
        if code:
            result = _redirect(code)
            body, status = result[0], result[1]
            headers = {**_cors_headers(), **(result[2] if len(result) > 2 else {})}
            return body, status, headers

    return {"error": "Not found. POST /shorten or GET /{code}"}, 404, _cors_headers()
