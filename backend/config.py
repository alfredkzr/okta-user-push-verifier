from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    okta_domain: str
    okta_client_id: str
    okta_private_key_b64: str
    okta_key_id: str = ""
    okta_scopes: str = "okta.users.manage"

    oidc_issuer: str
    oidc_client_id: str

    admin_group: str = "push-verifier-admin"
    user_group: str = "push-verifier-user"

    database_path: str = "data/push-verifier.db"


settings = Settings()
