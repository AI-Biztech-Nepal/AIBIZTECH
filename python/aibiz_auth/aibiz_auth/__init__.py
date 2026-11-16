import os
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException

# Same rule as core.service_role(): active member, live subscription (trial not expired), role assigned
ROLE_SQL = """
select sr.role from core.service_roles sr
join core.memberships m on m.org_id = sr.org_id and m.user_id = sr.user_id and m.status = 'active'
join core.org_services os on os.org_id = sr.org_id and os.service_key = sr.service_key
  and (os.status = 'active' or (os.status = 'trial' and os.trial_ends_at > now()))
where sr.org_id = %s and sr.user_id = %s and sr.service_key = %s
"""


@dataclass
class Ctx:
    user_id: str
    org_id: str
    role: str


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{os.environ['SUPABASE_URL']}/auth/v1/.well-known/jwks.json")


def decode_token(token: str) -> dict:
    try:
        key = _jwks().get_signing_key_from_jwt(token).key
        return jwt.decode(token, key, algorithms=["ES256", "RS256"], audience="authenticated")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid session")


def check_access(db, claims: dict, org_id: str, service_key: str, roles: set[str] | None) -> Ctx:
    # db.fetch_value(sql, params) -> first column of the first row, or None; adapt to the service's DB layer
    role = db.fetch_value(ROLE_SQL, (org_id, claims["sub"], service_key))
    if role is None or (roles and role not in roles):
        raise HTTPException(403, "No access to this service")
    return Ctx(user_id=claims["sub"], org_id=org_id, role=role)


def require_service(service_key: str, roles: set[str] | None = None, get_db=None):
    def dep(authorization: str = Header(...), x_org_id: str = Header(...), db=Depends(get_db)):
        claims = decode_token(authorization.removeprefix("Bearer ").strip())
        return check_access(db, claims, x_org_id, service_key, roles)

    return dep


def check_feature(db, org_id: str, feature_key: str) -> None:
    # core.feature_on without a signed-in user asks: service live for the org, feature active, requires on, switch on
    if not db.fetch_value("select core.feature_on(%s, %s)", (org_id, feature_key)):
        raise HTTPException(403, "This feature is not enabled for your organization")


def require_feature(feature_key: str, roles: set[str] | None = None, get_db=None):
    # The service is the key's prefix ('finance.emi' -> 'finance'); access rules are exactly require_service's
    service_key = feature_key.split(".", 1)[0]

    def dep(authorization: str = Header(...), x_org_id: str = Header(...), db=Depends(get_db)):
        claims = decode_token(authorization.removeprefix("Bearer ").strip())
        ctx = check_access(db, claims, x_org_id, service_key, roles)
        check_feature(db, x_org_id, feature_key)
        return ctx

    return dep
