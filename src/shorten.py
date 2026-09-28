import json
import os
import random
import string
import time
import urllib.parse

import boto3

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("TABLE_NAME", "url-mappings")
table = dynamodb.Table(TABLE_NAME)

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


def _response(status_code: int, body: dict):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return _response(400, {"error": "Request body must be valid JSON"})

    url = (body.get("url") or "").strip()
    if not url:
        return _response(400, {"error": "Missing 'url' in request body"})
    if not _is_valid_url(url):
        return _response(400, {"error": "URL must start with http:// or https://"})

    # Try a few random codes until one doesn't collide.
    for _ in range(5):
        code = _generate_code()
        try:
            table.put_item(
                Item={
                    "code": code,
                    "url": url,
                    "created_at": int(time.time()),
                    "clicks": 0,
                },
                ConditionExpression="attribute_not_exists(#c)",
                ExpressionAttributeNames={"#c": "code"},
            )
            break
        except table.meta.client.exceptions.ConditionalCheckFailedException:
            continue
    else:
        return _response(500, {"error": "Could not generate a unique code, try again"})

    return _response(201, {"code": code, "url": url})
