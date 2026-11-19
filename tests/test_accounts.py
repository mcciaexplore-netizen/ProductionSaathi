from fastapi.testclient import TestClient
import pyotp
import pytest
import backend.app as app_module
from backend.app import create_app

ADMIN_PASSWORD = "first-admin-password-123"


@pytest.fixture
def production(storage_target, monkeypatch):
    path, schema = storage_target
    monkeypatch.setattr(app_module, "DEMO", False)
    monkeypatch.setenv("PROMISEFLOW_ADMIN_PASSWORD", ADMIN_PASSWORD)
    # Production session cookies are Secure, so talk to the app over https.
    with TestClient(
        create_app(path, db_schema=schema), base_url="https://testserver"
    ) as client:
        yield client


def sign_in(client, username, password):
    return client.post("/api/login", json={"username": username, "password": password})


def test_production_starts_empty_with_only_admin(production):
    assert sign_in(production, "manager", "promise-demo").status_code == 401
    assert sign_in(production, "admin", ADMIN_PASSWORD).status_code == 200
    factory = production.get("/api/factory").json()["factory"]
    assert factory["orders"] == [] and factory["settings"]["plant_name"] == ""
    assert production.get("/api/users").json() == [
        {"username": "admin", "role": "admin"}
    ]


def test_admin_provisions_and_manages_users(production):
    sign_in(production, "admin", ADMIN_PASSWORD)
    new = {"username": "asha.planner", "role": "planner", "password": "x" * 16}
    assert production.post("/api/users", json=new).status_code == 201
    assert production.post("/api/users", json=new).status_code == 409
    short = {**new, "username": "short", "password": "x" * 15}
    assert production.post("/api/users", json=short).status_code == 422

    assert (
        production.put("/api/users/asha.planner", json={"role": "sales"}).status_code
        == 200
    )
    assert production.put("/api/users/admin", json={"role": "planner"}).status_code == 409
    assert production.delete("/api/users/admin").status_code == 409

    other = TestClient(production.app, base_url="https://testserver")
    assert sign_in(other, "asha.planner", "x" * 16).json()["role"] == "sales"
    assert other.get("/api/users").status_code == 403

    production.put("/api/users/asha.planner", json={"password": "y" * 16})
    assert other.get("/api/me").status_code == 401  # reset signs the user out
    assert sign_in(other, "asha.planner", "y" * 16).status_code == 200

    assert production.delete("/api/users/asha.planner").status_code == 200
    assert other.get("/api/me").status_code == 401
    assert sign_in(other, "asha.planner", "y" * 16).status_code == 401


def test_user_changes_own_password(production):
    sign_in(production, "admin", ADMIN_PASSWORD)
    other = TestClient(production.app, base_url="https://testserver")
    sign_in(other, "admin", ADMIN_PASSWORD)
    wrong = {"current_password": "nope", "new_password": "z" * 16}
    assert production.post("/api/me/password", json=wrong).status_code == 400
    ok = {"current_password": ADMIN_PASSWORD, "new_password": "z" * 16}
    assert production.post("/api/me/password", json=ok).status_code == 200
    assert production.get("/api/me").status_code == 200  # this session stays
    assert other.get("/api/me").status_code == 401  # other sessions end
    assert sign_in(other, "admin", "z" * 16).status_code == 200


def test_accounts_locked_in_demo(storage_target):
    path, schema = storage_target
    with TestClient(create_app(path, db_schema=schema)) as client:
        sign_in(client, "admin", "promise-demo")
        assert client.get("/api/users").status_code == 403
        assert (
            client.post(
                "/api/me/password",
                json={"current_password": "promise-demo", "new_password": "a" * 16},
            ).status_code
            == 403
        )


def test_signup_waits_for_admin_approval(production):
    other = TestClient(production.app, base_url="https://testserver")
    request = {"username": "new.planner", "password": "n" * 16}
    assert other.post("/api/signup", json=request).status_code == 201
    assert other.post("/api/signup", json=request).status_code == 409
    weak = {"username": "weak.user", "password": "short"}
    assert other.post("/api/signup", json=weak).status_code == 422
    # Pending accounts cannot sign in or reach data.
    r = sign_in(other, "new.planner", "n" * 16)
    assert r.status_code == 403 and "approve" in r.json()["detail"]
    assert other.get("/api/factory").status_code == 401
    # Signing up can never grant a role.
    assert (
        other.post(
            "/api/signup",
            json={"username": "sneaky", "password": "s" * 16, "role": "admin"},
        ).status_code
        == 422
    )

    sign_in(production, "admin", ADMIN_PASSWORD)
    listed = {u["username"]: u["role"] for u in production.get("/api/users").json()}
    assert listed["new.planner"] == "pending"
    assert (
        production.put("/api/users/new.planner", json={"role": "planner"}).status_code
        == 200
    )
    assert sign_in(other, "new.planner", "n" * 16).json()["role"] == "planner"


def test_signup_disabled_in_demo(storage_target):
    path, schema = storage_target
    with TestClient(create_app(path, db_schema=schema)) as client:
        r = client.post("/api/signup", json={"username": "x.user", "password": "x" * 16})
        assert r.status_code == 403


def test_login_throttle_persists_across_app_instances(storage_target):
    """Rate limiting lives in the database, not process memory, so it still
    holds when a second serverless instance (a fresh create_app()) handles
    the next request against the same database."""
    path, schema = storage_target
    for _ in range(12):
        with TestClient(create_app(path, db_schema=schema)) as client:
            assert sign_in(client, "manager", "wrong").status_code == 401
    with TestClient(create_app(path, db_schema=schema)) as client:
        locked = sign_in(client, "manager", "promise-demo")
        assert locked.status_code == 429


def test_mfa_cannot_be_configured_in_demo(storage_target):
    path, schema = storage_target
    with TestClient(create_app(path, db_schema=schema)) as client:
        sign_in(client, "admin", "promise-demo")
        assert client.post("/api/mfa/enroll").status_code == 403


def test_mfa_enroll_confirm_and_enforce_at_login(production):
    sign_in(production, "admin", ADMIN_PASSWORD)
    status = production.get("/api/mfa/status").json()
    assert status == {"enrolled": False, "confirmed": False, "recommended": True}

    enrolled = production.post("/api/mfa/enroll").json()
    secret = enrolled["secret"]
    assert secret in enrolled["otpauth_url"]

    bad = production.post("/api/mfa/confirm", json={"code": "000000"})
    assert bad.status_code == 400

    code = pyotp.TOTP(secret).now()
    ok = production.post("/api/mfa/confirm", json={"code": code})
    assert ok.status_code == 200
    assert production.get("/api/mfa/status").json()["confirmed"] is True

    production.post("/api/logout")
    without_code = sign_in(production, "admin", ADMIN_PASSWORD)
    assert without_code.status_code == 401

    wrong_code = production.post(
        "/api/login",
        json={"username": "admin", "password": ADMIN_PASSWORD, "totp_code": "000000"},
    )
    assert wrong_code.status_code == 401

    fresh_code = pyotp.TOTP(secret).now()
    signed_in = production.post(
        "/api/login",
        json={
            "username": "admin",
            "password": ADMIN_PASSWORD,
            "totp_code": fresh_code,
        },
    )
    assert signed_in.status_code == 200
    assert signed_in.json()["mfa_setup_recommended"] is False


def test_mfa_disable_requires_current_password(production):
    sign_in(production, "admin", ADMIN_PASSWORD)
    secret = production.post("/api/mfa/enroll").json()["secret"]
    production.post("/api/mfa/confirm", json={"code": pyotp.TOTP(secret).now()})

    denied = production.post("/api/mfa/disable", json={"current_password": "wrong"})
    assert denied.status_code == 400

    removed = production.post(
        "/api/mfa/disable", json={"current_password": ADMIN_PASSWORD}
    )
    assert removed.status_code == 200
    assert production.get("/api/mfa/status").json()["enrolled"] is False
