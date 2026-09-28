import json
import os

import boto3

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("TABLE_NAME", "url-mappings")
table = dynamodb.Table(TABLE_NAME)


def _response(status_code: int, body: dict = None, headers: dict = None):
    response = {
        "statusCode": status_code,
        "headers": headers or {"Content-Type": "application/json"},
    }
    if body is not None:
        response["body"] = json.dumps(body)
    return response


def lambda_handler(event, context):
    code = ((event.get("pathParameters") or {}).get("code") or "").strip()
    if not code:
        return _response(400, {"error": "Missing short code"})

    item = table.get_item(Key={"code": code}).get("Item")
    if not item:
        return _response(404, {"error": "Short URL not found"})

    # Fire-and-forget click counter (best effort).
    try:
        table.update_item(
            Key={"code": code},
            UpdateExpression="ADD clicks :inc",
            ExpressionAttributeValues={":inc": 1},
        )
    except Exception:
        pass

    return _response(301, headers={"Location": item["url"]})
