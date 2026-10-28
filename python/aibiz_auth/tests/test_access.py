import pytest
from fastapi import HTTPException

from aibiz_auth import check_access


class Db:
    def __init__(self, role):
        self.role = role

    def fetch_value(self, sql, params):
        return self.role


claims = {"sub": "u1"}


def test_allows_role():
    assert check_access(Db("admin"), claims, "o1", "stock", {"admin"}).role == "admin"


def test_no_role_is_forbidden():
    with pytest.raises(HTTPException) as e:
        check_access(Db(None), claims, "o1", "stock", None)
    assert e.value.status_code == 403


def test_wrong_role_is_forbidden():
    with pytest.raises(HTTPException):
        check_access(Db("viewer"), claims, "o1", "stock", {"admin"})
