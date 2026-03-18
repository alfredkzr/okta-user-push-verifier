resource "aws_dynamodb_table" "protected_users" {
  name         = "${var.app_name}-protected-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }

  deletion_protection_enabled = false
}

resource "aws_dynamodb_table" "audit_log" {
  name         = "${var.app_name}-audit-log"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "timestamp"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  deletion_protection_enabled = false
}

resource "aws_dynamodb_table" "verify_log" {
  name         = "${var.app_name}-verify-log"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "timestamp"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  deletion_protection_enabled = false
}
