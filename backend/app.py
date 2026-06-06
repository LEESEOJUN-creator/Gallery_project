from __future__ import annotations

from functools import wraps
from pathlib import Path
from typing import Any, Callable
from uuid import uuid4

from flask import Flask, jsonify, request, session, send_from_directory
from flask.typing import ResponseReturnValue
from flask_cors import CORS
from werkzeug.datastructures import FileStorage
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from database import execute, init_db, query_all, query_one

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}

app = Flask(__name__)
app.config["SECRET_KEY"] = "software-engineering-photo-gallery-secret-key"
app.config["UPLOAD_FOLDER"] = str(UPLOAD_DIR)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB

CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://127.0.0.1:5173"])
init_db()


# ── Helpers ────────────────────────────────────────────────────────────────

def ok(data: dict[str, Any] | None = None, message: str = "") -> ResponseReturnValue:
    payload: dict[str, Any] = {"ok": True}
    if message:
        payload["message"] = message
    if data:
        payload.update(data)
    return jsonify(payload)


def fail(message: str, status: int = 400) -> ResponseReturnValue:
    return jsonify({"ok": False, "message": message}), status


def login_required(view: Callable[..., ResponseReturnValue]) -> Callable[..., ResponseReturnValue]:
    @wraps(view)
    def wrapped(*args: Any, **kwargs: Any) -> ResponseReturnValue:
        if not session.get("user_id"):
            return fail("로그인이 필요합니다.", 401)
        return view(*args, **kwargs)
    return wrapped


def current_user() -> dict[str, Any] | None:
    uid = session.get("user_id")
    if not uid:
        return None
    return query_one("SELECT id, username FROM users WHERE id = ?", (uid,))


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def photo_rows(keyword: str | None = None) -> list[dict[str, Any]]:
    base = """
        SELECT p.id, p.filename, p.description, p.keywords, p.created_at,
               p.user_id, u.username AS uploader
        FROM photos p
        JOIN users u ON p.user_id = u.id
    """
    if keyword is not None:
        return query_all(
            base + " WHERE p.keywords LIKE ? ORDER BY p.created_at DESC",
            (f"%{keyword}%",),
        )
    return query_all(base + " ORDER BY p.created_at DESC")


# ── Auth ───────────────────────────────────────────────────────────────────

@app.get("/api/me")
def me() -> ResponseReturnValue:
    return ok({"user": current_user()})


@app.post("/api/signup")
def signup() -> ResponseReturnValue:
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", "")).strip()

    if not username or not password:
        return fail("빈 칸을 채워주세요.")
    if len(password) < 6:
        return fail("비밀번호는 6자 이상이어야 합니다.")
    if query_one("SELECT id FROM users WHERE username = ?", (username,)):
        return fail("이미 사용 중인 아이디입니다.")

    execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (username, generate_password_hash(password)),
    )
    return ok(message="회원가입이 완료되었습니다.")


@app.post("/api/signin")
def signin() -> ResponseReturnValue:
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", "")).strip()

    if not username or not password:
        return fail("빈 칸을 채워주세요.")

    user = query_one(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        (username,),
    )
    if not user:
        return fail("존재하지 않는 아이디입니다.")
    if not check_password_hash(user["password_hash"], password):
        return fail("비밀번호가 올바르지 않습니다.")

    session.clear()
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    return ok({"user": {"id": user["id"], "username": user["username"]}}, "로그인되었습니다.")


@app.post("/api/signout")
def signout() -> ResponseReturnValue:
    session.clear()
    return ok(message="로그아웃되었습니다.")


# ── Users ──────────────────────────────────────────────────────────────────

@app.get("/api/users")
def users() -> ResponseReturnValue:
    """사용자 목록 — 비로그인 포함 모든 사용자 접근 가능 (UC-2)."""
    rows = query_all("SELECT id, username, created_at FROM users ORDER BY username")
    return ok({"users": rows})


# ── Photos ─────────────────────────────────────────────────────────────────

@app.get("/api/photos")
@login_required
def photos() -> ResponseReturnValue:
    """전체 사진 목록 — 로그인 필수 (UC-3)."""
    return ok({"photos": photo_rows()})


@app.post("/api/photos")
@login_required
def upload_photo() -> ResponseReturnValue:
    """사진 업로드 — 로그인 필수 (UC-4)."""
    image = request.files.get("photo")
    description = request.form.get("description", "").strip()
    keywords = request.form.get("keywords", "").strip()

    if not isinstance(image, FileStorage) or not image.filename:
        return fail("사진 파일을 선택해 주세요.")
    if not allowed_file(image.filename):
        return fail("JPG, PNG만 올릴 수 있습니다.")
    if not description or not keywords:
        return fail("설명과 키워드를 한 개 이상 입력해 주세요.")

    ext = image.filename.rsplit(".", 1)[1].lower()
    filename = f"{uuid4().hex}.{ext}"
    image.save(UPLOAD_DIR / filename)

    execute(
        "INSERT INTO photos (user_id, filename, description, keywords) VALUES (?, ?, ?, ?)",
        (session["user_id"], filename, description, keywords),
    )
    return ok(message="사진이 업로드되었습니다.")


@app.put("/api/photos/<int:photo_id>")
@login_required
def edit_photo(photo_id: int) -> ResponseReturnValue:
    """사진 게시물 수정 — 본인 게시물만 가능 (UC-4B)."""
    photo = query_one("SELECT id, user_id FROM photos WHERE id = ?", (photo_id,))
    if not photo:
        return fail("사진 게시물을 찾을 수 없습니다.", 404)
    if photo["user_id"] != session["user_id"]:
        return fail("본인이 올린 사진만 수정할 수 있습니다.", 403)

    data = request.get_json(silent=True) or {}
    description = str(data.get("description", "")).strip()
    keywords = str(data.get("keywords", "")).strip()
    if not description or not keywords:
        return fail("설명과 키워드를 한 개 이상 입력해 주세요.")

    execute(
        "UPDATE photos SET description = ?, keywords = ? WHERE id = ? AND user_id = ?",
        (description, keywords, photo_id, session["user_id"]),
    )
    return ok(message="사진 정보가 수정되었습니다.")


# ── Search ─────────────────────────────────────────────────────────────────

@app.get("/api/search")
@login_required
def search_photos() -> ResponseReturnValue:
    """키워드 검색 — 로그인 필수, 키워드 검색만 지원 (UC-5)."""
    keyword = request.args.get("keyword", "").strip()
    if not keyword:
        return fail("키워드를 입력해 주세요.")
    return ok({"photos": photo_rows(keyword)})


# ── Messages ───────────────────────────────────────────────────────────────

@app.post("/api/photos/<int:photo_id>/messages")
@login_required
def send_message(photo_id: int) -> ResponseReturnValue:
    """게시물 작성자에게 DM 전송 (UC-6, UC-7)."""
    photo = query_one("SELECT id, user_id FROM photos WHERE id = ?", (photo_id,))
    if not photo:
        return fail("게시물을 찾을 수 없습니다.", 404)

    data = request.get_json(silent=True) or {}
    content = str(data.get("content", "")).strip()
    if not content:
        return fail("메시지를 입력해 주세요.")

    execute(
        "INSERT INTO messages (sender_id, receiver_id, photo_id, content) VALUES (?, ?, ?, ?)",
        (session["user_id"], photo["user_id"], photo_id, content),
    )
    return ok(message="메시지를 보냈습니다.")


@app.get("/api/messages")
@login_required
def get_messages() -> ResponseReturnValue:
    """받은 메시지 목록 조회 (UC-8)."""
    rows = query_all(
        """
        SELECT m.id, m.content, m.created_at, m.photo_id,
               s.username AS sender_name,
               r.username AS receiver_name,
               p.description AS photo_description
        FROM messages m
        JOIN users s ON m.sender_id = s.id
        JOIN users r ON m.receiver_id = r.id
        LEFT JOIN photos p ON m.photo_id = p.id
        WHERE m.receiver_id = ?
        ORDER BY m.created_at DESC
        """,
        (session["user_id"],),
    )
    return ok({"messages": rows})


@app.post("/api/messages/<int:message_id>/reply")
@login_required
def reply_message(message_id: int) -> ResponseReturnValue:
    """받은 메시지에 답장 (UC-9)."""
    original = query_one(
        "SELECT id, sender_id, photo_id FROM messages WHERE id = ? AND receiver_id = ?",
        (message_id, session["user_id"]),
    )
    if not original:
        return fail("답장할 메시지를 찾을 수 없습니다.", 404)

    data = request.get_json(silent=True) or {}
    content = str(data.get("content", "")).strip()
    if not content:
        return fail("답장 내용을 입력해 주세요.")

    execute(
        "INSERT INTO messages (sender_id, receiver_id, photo_id, content) VALUES (?, ?, ?, ?)",
        (session["user_id"], original["sender_id"], original["photo_id"], content),
    )
    return ok(message="답장을 보냈습니다.")


@app.delete("/api/messages/<int:message_id>")
@login_required
def delete_message(message_id: int) -> ResponseReturnValue:
    """받은 메시지 삭제 (UC-10)."""
    msg = query_one(
        "SELECT id FROM messages WHERE id = ? AND receiver_id = ?",
        (message_id, session["user_id"]),
    )
    if not msg:
        return fail("삭제할 수 없는 메시지입니다.", 404)

    execute(
        "DELETE FROM messages WHERE id = ? AND receiver_id = ?",
        (message_id, session["user_id"]),
    )
    return ok(message="메시지가 삭제되었습니다.")


# ── Static ─────────────────────────────────────────────────────────────────

@app.get("/uploads/<path:filename>")
def uploaded_file(filename: str) -> ResponseReturnValue:
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
