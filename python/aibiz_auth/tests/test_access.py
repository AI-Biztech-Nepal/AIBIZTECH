import pytest
from fastapi import HTTPException

from aibiz_auth import check_access, check_feature


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


def test_feature_off_is_forbidden():
    with pytest.raises(HTTPException) as e:
        check_feature(Db(False), "o1", "finance.emi")
    assert e.value.status_code == 403


def test_feature_on_passes():
    check_feature(Db(True), "o1", "finance.emi")
