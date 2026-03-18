from pydantic import BaseModel, EmailStr


class VerifyRequest(BaseModel):
    username: str


class ProtectedUserCreate(BaseModel):
    email: EmailStr


class UserInfo(BaseModel):
    sub: str
    email: str | None = None
    role: str


class AuthConfig(BaseModel):
    issuer: str
    clientId: str


class VerificationLogEntry(BaseModel):
    timestamp: str
    operator: str
    target: str
    status: str
    devices_challenged: int
    details: str | None = None


class AuditLogEntry(BaseModel):
    timestamp: str
    action: str
    operator: str
    target: str
    details: str | None = None
