# Personal Photo Gallery

소프트웨어공학 최종 프로젝트: 개인 사진 갤러리 웹사이트

## 구현 범위

1. 회원가입, 로그인, 로그아웃
2. 로그인 사용자: 사용자 목록과 전체 사진 조회
3. 비로그인 사용자: 사용자 목록만 조회
4. 로그인 사용자: 사진, 설명, 키워드 업로드
5. 본인 사진 게시물의 설명과 키워드 수정
6. 키워드 기반 사진 검색
7. 모든 사진 게시물의 direct message 버튼
8. 게시물 업로더에게 direct message 전송
9. 로그인 후 받은 메시지 목록 조회
10. 메시지 reply 기능
11. 메시지 delete 기능

## 실행 방법

### 1. Backend 실행

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python init_db.py
python app.py
```

Backend 주소: http://127.0.0.1:5000

### 2. Frontend 실행

```powershell
cd frontend
npm install
npm run dev
```

Frontend 주소: http://127.0.0.1:5173

## 사용 방법

1. Sign Up으로 계정 생성
2. Sign In으로 로그인
3. Upload Photo에서 JPG 또는 PNG 사진 업로드
4. 메인 화면에서 사진 목록 확인
5. 본인 게시물은 Modify 버튼으로 수정
6. Search에서 키워드 검색
7. Direct Message 버튼으로 업로더에게 메시지 전송
8. Messages에서 받은 메시지 확인, 답장, 삭제
