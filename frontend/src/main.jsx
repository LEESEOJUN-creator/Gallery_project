import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = 'http://127.0.0.1:5000';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.message || '요청 처리에 실패했습니다.');
  }
  return data;
}

function Header({ user, onHome, onUpload, onMessages, onSignout, onSignin, onSignup }) {
  return (
    <header className="topbar">
      <h1 onClick={onHome}>📷 Personal Photo Gallery</h1>
      <nav>
        <button type="button" onClick={onHome}>Home</button>
        {user ? (
          <>
            <button type="button" onClick={onUpload}>Upload Photo</button>
            <button type="button" onClick={onMessages}>Messages</button>
            <span className="user">👤 {user.username}</span>
            <button type="button" className="btn-danger" onClick={onSignout}>Sign Out</button>
          </>
        ) : (
          <>
            <button type="button" onClick={onSignin}>Sign In</button>
            <button type="button" className="btn-secondary" onClick={onSignup}>Sign Up</button>
          </>
        )}
      </nav>
    </header>
  );
}

function UserList({ users }) {
  return (
    <section className="panel sidebar">
      <h2>👥 User List</h2>
      {users.length === 0 ? (
        <p className="empty-msg">등록된 사용자가 없습니다.</p>
      ) : (
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id}>
              <span className="user-avatar">{u.username[0].toUpperCase()}</span>
              {u.username}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PhotoCard({ photo, user, onMessage, onEdit }) {
  const own = user && photo.user_id === user.id;
  return (
    <article className="photo-card">
      <img src={`${API}/uploads/${photo.filename}`} alt={photo.description} loading="lazy" />
      <div className="card-body">
        <p className="card-desc">{photo.description}</p>
        <p className="card-keywords">
          {photo.keywords.split(',').map((k) => k.trim()).filter(Boolean).map((k) => (
            <span key={k} className="keyword-tag">{k}</span>
          ))}
        </p>
        <p className="card-uploader">📤 {photo.uploader}</p>
        <div className="actions">
          <button type="button" className="btn-dm" onClick={() => onMessage(photo)}>
            ✉️ Direct Message
          </button>
          {own && (
            <button type="button" className="btn-edit" onClick={() => onEdit(photo)}>
              ✏️ Modify
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Home({ user, users, photos, searchKeyword, setSearchKeyword, onSearch, onMessage, onEdit }) {
  return (
    <main className="layout">
      <UserList users={users} />
      <section className="panel grow">
        <h2>🖼️ Photos</h2>
        {!user && (
          <div className="info-box">
            비로그인 사용자는 사용자 목록만 볼 수 있습니다.<br />
            사진을 보려면 <strong>로그인</strong>해 주세요.
          </div>
        )}
        {user && (
          <form className="search-bar" onSubmit={onSearch}>
            <input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="키워드로 검색..."
            />
            <button type="submit">Search</button>
          </form>
        )}
        {user && photos.length === 0 && (
          <p className="empty-msg">등록된 사진이 없습니다.</p>
        )}
        {user && (
          <div className="photo-grid">
            {photos.map((p) => (
              <PhotoCard key={p.id} photo={p} user={user} onMessage={onMessage} onEdit={onEdit} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function FormCard({ title, onSubmit, onBack, children }) {
  return (
    <section className="form-card">
      <div className="form-header">
        {onBack && (
          <button type="button" className="btn-back" onClick={onBack}>← Back</button>
        )}
        <h2>{title}</h2>
      </div>
      <form onSubmit={onSubmit}>{children}</form>
    </section>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [messages, setMessages] = useState([]);
  const [view, setView] = useState('home');
  const [notice, setNotice] = useState({ text: '', type: 'info' });
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  function show(text, type = 'info') {
    setNotice({ text, type });
    window.setTimeout(() => setNotice({ text: '', type: 'info' }), 3000);
  }

  async function loadMe() {
    const data = await request('/api/me');
    setUser(data.user);
    return data.user;
  }

  async function loadUsers() {
    const data = await request('/api/users');
    setUsers(data.users);
  }

  async function loadPhotos(currentUser) {
    const u = currentUser ?? user;
    if (!u) { setPhotos([]); return; }
    const data = await request('/api/photos');
    setPhotos(data.photos);
  }

  async function loadMessages() {
    const data = await request('/api/messages');
    setMessages(data.messages);
  }

  useEffect(() => {
    async function init() {
      try {
        const current = await loadMe();
        await loadUsers();
        if (current) await loadPhotos(current);
      } catch {
        // session not found on first load is expected
      }
    }
    init();
  }, []);

  async function handleSignup(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = form.get('username');
    const password = form.get('password');
    const confirm = form.get('confirm');
    if (password !== confirm) { show('비밀번호가 일치하지 않습니다.', 'error'); return; }
    try {
      await request('/api/signup', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      show('회원가입이 완료되었습니다. 로그인해 주세요.');
      await loadUsers();
      setView('signin');
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function handleSignin(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const data = await request('/api/signin', {
        method: 'POST',
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      setUser(data.user);
      setView('home');
      show('로그인되었습니다.');
      await loadUsers();
      await loadPhotos(data.user);
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function handleSignout() {
    try {
      await request('/api/signout', { method: 'POST' });
      setUser(null);
      setPhotos([]);
      setMessages([]);
      setSearchResults([]);
      setSelectedPhoto(null);
      setSelectedMessage(null);
      setView('home');
      show('로그아웃되었습니다.');
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!user) { show('로그인이 필요합니다.', 'error'); setView('signin'); return; }
    const form = new FormData(e.currentTarget);
    try {
      await request('/api/photos', { method: 'POST', body: form });
      e.currentTarget.reset();
      setView('home');
      show('사진이 업로드되었습니다.');
      await loadPhotos();
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await request(`/api/photos/${selectedPhoto.id}`, {
        method: 'PUT',
        body: JSON.stringify({ description: form.get('description'), keywords: form.get('keywords') }),
      });
      setSelectedPhoto(null);
      setView('home');
      show('사진 정보가 수정되었습니다.');
      await loadPhotos();
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchKeyword.trim()) { show('키워드를 입력해 주세요.', 'error'); return; }
    try {
      const data = await request(`/api/search?keyword=${encodeURIComponent(searchKeyword)}`);
      setSearchResults(data.photos);
      setView('search');
      if (data.photos.length === 0) show('검색 결과가 없습니다.');
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await request(`/api/photos/${selectedPhoto.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: form.get('content') }),
      });
      setSelectedPhoto(null);
      setView('home');
      show('메시지를 보냈습니다.');
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function openMessages() {
    if (!user) { show('로그인이 필요합니다.', 'error'); return; }
    try {
      await loadMessages();
      setView('messages');
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function handleReply(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await request(`/api/messages/${selectedMessage.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: form.get('content') }),
      });
      setSelectedMessage(null);
      show('답장을 보냈습니다.');
      await loadMessages();
      setView('messages');
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function handleDeleteMessage(messageId) {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await request(`/api/messages/${messageId}`, { method: 'DELETE' });
      show('메시지가 삭제되었습니다.');
      await loadMessages();
    } catch (err) {
      show(err.message, 'error');
    }
  }

  function openMessageForm(photo) {
    if (!user) { show('로그인이 필요합니다.', 'error'); setView('signin'); return; }
    setSelectedPhoto(photo);
    setView('dm');
  }

  function openEditForm(photo) {
    setSelectedPhoto(photo);
    setView('edit');
  }

  // Guard: redirect to signin if not logged in and accessing protected views
  useEffect(() => {
    if (!user && (view === 'upload' || view === 'messages' || view === 'dm' || view === 'reply')) {
      show('로그인이 필요합니다.', 'error');
      setView('signin');
    }
  }, [view, user]);

  return (
    <>
      <Header
        user={user}
        onHome={() => setView('home')}
        onUpload={() => user ? setView('upload') : (show('로그인이 필요합니다.', 'error'), setView('signin'))}
        onMessages={openMessages}
        onSignout={handleSignout}
        onSignin={() => setView('signin')}
        onSignup={() => setView('signup')}
      />

      {notice.text && (
        <div className={`notice notice-${notice.type}`}>{notice.text}</div>
      )}

      {view === 'home' && (
        <Home
          user={user}
          users={users}
          photos={photos}
          searchKeyword={searchKeyword}
          setSearchKeyword={setSearchKeyword}
          onSearch={handleSearch}
          onMessage={openMessageForm}
          onEdit={openEditForm}
        />
      )}

      {view === 'signup' && (
        <FormCard title="Sign Up" onBack={() => setView('home')} onSubmit={handleSignup}>
          <label>아이디</label>
          <input name="username" placeholder="사용할 아이디를 입력하세요" required />
          <label>비밀번호 (6자 이상)</label>
          <input name="password" type="password" placeholder="비밀번호 입력" required />
          <label>비밀번호 확인</label>
          <input name="confirm" type="password" placeholder="비밀번호 재입력" required />
          <button type="submit">Sign Up</button>
          <p className="form-link">
            이미 계정이 있으신가요?{' '}
            <button type="button" className="btn-link" onClick={() => setView('signin')}>Sign In</button>
          </p>
        </FormCard>
      )}

      {view === 'signin' && (
        <FormCard title="Sign In" onBack={() => setView('home')} onSubmit={handleSignin}>
          <label>아이디</label>
          <input name="username" placeholder="아이디 입력" required />
          <label>비밀번호</label>
          <input name="password" type="password" placeholder="비밀번호 입력" required />
          <button type="submit">Sign In</button>
          <p className="form-link">
            계정이 없으신가요?{' '}
            <button type="button" className="btn-link" onClick={() => setView('signup')}>Sign Up</button>
          </p>
        </FormCard>
      )}

      {view === 'upload' && user && (
        <FormCard title="Upload Photo" onBack={() => setView('home')} onSubmit={handleUpload}>
          <label>사진 파일 (JPG, PNG)</label>
          <input name="photo" type="file" accept=".jpg,.jpeg,.png" required />
          <label>사진 설명</label>
          <textarea name="description" placeholder="사진에 대한 설명을 입력하세요" required />
          <label>키워드 (쉼표로 구분)</label>
          <input name="keywords" placeholder="예: 고양이, 반려동물, 귀여운" required />
          <button type="submit">Upload</button>
        </FormCard>
      )}

      {view === 'edit' && selectedPhoto && (
        <FormCard title="Modify Photo Information" onBack={() => setView('home')} onSubmit={handleEdit}>
          <label>사진 설명</label>
          <textarea name="description" defaultValue={selectedPhoto.description} required />
          <label>키워드 (쉼표로 구분)</label>
          <input name="keywords" defaultValue={selectedPhoto.keywords} required />
          <button type="submit">Save Changes</button>
        </FormCard>
      )}

      {view === 'dm' && selectedPhoto && (
        <FormCard
          title={`Direct Message → ${selectedPhoto.uploader}`}
          onBack={() => setView('home')}
          onSubmit={handleSendMessage}
        >
          <p className="dm-target">게시물: <em>{selectedPhoto.description}</em></p>
          <label>메시지 내용</label>
          <textarea name="content" placeholder="메시지를 입력하세요" required />
          <button type="submit">Send Message</button>
        </FormCard>
      )}

      {view === 'search' && (
        <section className="panel page">
          <div className="page-header">
            <button type="button" className="btn-back" onClick={() => setView('home')}>← Back</button>
            <h2>Search Results</h2>
          </div>
          {searchResults.length === 0 ? (
            <p className="empty-msg">검색 결과가 없습니다.</p>
          ) : (
            <>
              <p className="result-count">{searchResults.length}개의 결과</p>
              <div className="photo-grid">
                {searchResults.map((p) => (
                  <PhotoCard
                    key={p.id}
                    photo={p}
                    user={user}
                    onMessage={openMessageForm}
                    onEdit={openEditForm}
                  />
                ))}
            </div>
            </>
          )}
        </section>
      )}

      {view === 'messages' && (
        <section className="panel page">
          <div className="page-header">
            <button type="button" className="btn-back" onClick={() => setView('home')}>← Back</button>
            <h2>📬 Received Messages</h2>
          </div>
          {messages.length === 0 ? (
            <p className="empty-msg">받은 메시지가 없습니다.</p>
          ) : (
            <div className="message-list">
              {messages.map((m) => (
                <div className="message-card" key={m.id}>
                  <div className="message-meta">
                    <strong>From: {m.sender_name}</strong>
                    <span className="small">{m.created_at}</span>
                  </div>
                  {m.photo_description && (
                    <p className="small">게시물: {m.photo_description}</p>
                  )}
                  <p className="message-content">{m.content}</p>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn-reply"
                      onClick={() => { setSelectedMessage(m); setView('reply'); }}
                    >
                      ↩️ Reply
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => handleDeleteMessage(m.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {view === 'reply' && selectedMessage && (
        <FormCard
          title={`Reply to ${selectedMessage.sender_name}`}
          onBack={() => setView('messages')}
          onSubmit={handleReply}
        >
          <div className="original-msg">
            <p className="small">원본 메시지</p>
            <p>{selectedMessage.content}</p>
          </div>
          <label>답장 내용</label>
          <textarea name="content" placeholder="답장 내용을 입력하세요" required />
          <button type="submit">Send Reply</button>
        </FormCard>
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
