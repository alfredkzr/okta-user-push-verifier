import logging
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from config import settings

logger = logging.getLogger(__name__)


def _get_dynamodb():
    kwargs = {"region_name": settings.aws_region}
    if settings.dynamodb_endpoint_url:
        kwargs["endpoint_url"] = settings.dynamodb_endpoint_url
    return boto3.resource("dynamodb", **kwargs)


def _table_name(suffix: str) -> str:
    return f"{settings.dynamodb_table_prefix}-{suffix}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_tables_exist():
    db = _get_dynamodb()
    existing = {t.name for t in db.tables.all()}

    tables = [
        {
            "name": _table_name("protected-users"),
            "keys": [{"AttributeName": "email", "KeyType": "HASH"}],
            "attrs": [{"AttributeName": "email", "AttributeType": "S"}],
        },
        {
            "name": _table_name("audit-log"),
            "keys": [
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "timestamp", "KeyType": "RANGE"},
            ],
            "attrs": [
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "timestamp", "AttributeType": "S"},
            ],
        },
        {
            "name": _table_name("verify-log"),
            "keys": [
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "timestamp", "KeyType": "RANGE"},
            ],
            "attrs": [
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "timestamp", "AttributeType": "S"},
            ],
        },
    ]

    for table_def in tables:
        if table_def["name"] not in existing:
            try:
                db.create_table(
                    TableName=table_def["name"],
                    KeySchema=table_def["keys"],
                    AttributeDefinitions=table_def["attrs"],
                    BillingMode="PAY_PER_REQUEST",
                )
                logger.info("Created table %s", table_def["name"])
            except ClientError as e:
                if e.response["Error"]["Code"] != "ResourceInUseException":
                    raise


def get_protected_users() -> list[dict]:
    db = _get_dynamodb()
    table = db.Table(_table_name("protected-users"))
    response = table.scan()
    return response.get("Items", [])


def is_protected_user(email: str) -> bool:
    db = _get_dynamodb()
    table = db.Table(_table_name("protected-users"))
    response = table.get_item(Key={"email": email.lower()})
    return "Item" in response


def add_protected_user(email: str, operator: str) -> bool:
    db = _get_dynamodb()
    table = db.Table(_table_name("protected-users"))

    try:
        table.put_item(
            Item={"email": email.lower(), "added_by": operator, "added_at": _now_iso()},
            ConditionExpression="attribute_not_exists(email)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise

    _write_audit_log(operator, email, "ADD_PROTECTED", f"Added {email} to protected list")
    return True


def remove_protected_user(email: str, operator: str) -> bool:
    db = _get_dynamodb()
    table = db.Table(_table_name("protected-users"))

    try:
        table.delete_item(
            Key={"email": email.lower()},
            ConditionExpression="attribute_exists(email)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise

    _write_audit_log(operator, email, "REMOVE_PROTECTED", f"Removed {email} from protected list")
    return True


def _write_audit_log(operator: str, target: str, action: str, details: str | None = None):
    db = _get_dynamodb()
    table = db.Table(_table_name("audit-log"))
    item = {
        "pk": "AUDIT",
        "timestamp": _now_iso(),
        "operator": operator,
        "target": target,
        "action": action,
    }
    if details:
        item["details"] = details
    table.put_item(Item=item)


def write_verification_log(
    operator: str, target: str, status: str, devices_challenged: int, details: str | None = None
):
    db = _get_dynamodb()
    table = db.Table(_table_name("verify-log"))
    item = {
        "pk": "VERIFY",
        "timestamp": _now_iso(),
        "operator": operator,
        "target": target,
        "status": status,
        "devices_challenged": devices_challenged,
    }
    if details:
        item["details"] = details
    table.put_item(Item=item)


def get_verification_log(limit: int = 20) -> list[dict]:
    db = _get_dynamodb()
    table = db.Table(_table_name("verify-log"))
    response = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("pk").eq("VERIFY"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return response.get("Items", [])


def get_audit_log(limit: int = 50) -> list[dict]:
    db = _get_dynamodb()
    table = db.Table(_table_name("audit-log"))
    response = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("pk").eq("AUDIT"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return response.get("Items", [])
