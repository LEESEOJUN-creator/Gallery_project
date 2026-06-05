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
      <h1 onClick={onHome}>Personal Photo Gallery</h1>
      <nav>
        <button type="button" onClick={onHome}>Home</button>
        {user ? (
          <>
            <button type="button" onClick={onUpload}>Upload Photo</button>
            <button type="button" onClick={onMessages}>Messages</button>
            <button type="button" onClick={onSignout}>Sign Out</button>
            <span className="user">{user.username}</span>
          </>
        ) : (
          <>
            <button type="button" onClick={onSignin}>Sign In</button>
            <button type="button" onClick={onSignup}>Sign Up</button>
          </>
        )}
      </nav>
    </header>
  );
}

function UserList({ users }) {
  return (
    <section className="panel">
      <h2>User List</h2>
      {users.length === 0 ? (
        <p>등록된 사용자가 없습니다.</p>
      ) : (
        <ul className="user-list">
          {users.map((u) => <li key={u.id}>{u.username}</li>)}
        </ul>
      )}
    </section>
  );
}

function PhotoCard({ photo, user, onMessage, onEdit }) {
  const own = user && photo.user_id === user.id;
  return (
    <article className="photo-card">
      <img src={`${API}/uploads/${photo.filename}`} alt={photo.description} />
      <div className="card-body">
        <p>{photo.description}</p>
        <p><b>Keywords:</b> {photo.keywords}</p>
        <p><b>Uploader:</b> {photo.uploader}</p>
        <div className="actions">
          <button type="button" onClick={() => onMessage(photo)}>Direct Message</button>
          {own && <button type="button" onClick={() => onEdit(photo)}>Modify</button>}
        </div>
      </div>
    </article>
  );
}

function Home({
  user,
  users,
  photos,
  searchKeyword,
  setSearchKeyword,
  onSearch,
  onMessage,
  onEdit,
}) {
  return (
    <main className="layout">
      <UserList users={users} />
      <section className="panel grow">
        <h2>Photos</h2>
        {!user && <p className="info">비로그인 사용자는 사용자 목록만 볼 수 있습니다. 사진을 보려면 로그인해 주세요.</p>}
        {user && (
          <form className="search" onSubmit={onSearch}>
            <input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="키워드 검색"
            />
            <button type="submit">Search</button>
          </form>
        )}
        {user && photos.length === 0 && <p>등록된 사진이 없습니다.</p>}
        {user && (
          <div className="photo-grid">
            {photos.map((p) => (
              <PhotoCard
                key={p.id}
                photo={p}
                user={user}
                onMessage={onMessage}
                onEdit={onEdit}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SimpleForm({ title, onSubmit, children }) {
  return (
    <section className="form-card">
      <h2>{title}</h2>
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
  const [notice, setNotice] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  function show(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2500);
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

  async function loadPhotos(currentUser = user) {
    if (!currentUser) {
      setPhotos([]);
      return;
    }
    const data = await request('/api/photos');
    setPhotos(data.photos);
  }

  async function loadMessages() {
    if (!user) return;
    const data = await request('/api/messages');
    setMessages(data.messages);
  }

  useEffect(() => {
    async function init() {
      try {
        const current = await loadMe();
        await loadUsers();
        if (current) await loadPhotos(current);
      } catch (err) {
        show(err.message);
      }
    }
    init();
  }, []);

  async function handleSignup(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await request('/api/signup', {
        method: 'POST',
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      show('회원가입이 완료되었습니다. 로그인해 주세요.');
      setView('signin');
      await loadUsers();
    } catch (err) {
      show(err.message);
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
      show(err.message);
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
      show(err.message);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    try {
      await request('/api/photos', { method: 'POST', body: form });
      formElement.reset();
      setView('home');
      show('사진이 업로드되었습니다.');
      await loadPhotos();
    } catch (err) {
      show(err.message);
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
      show(err.message);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    try {
      const data = await request(`/api/search?keyword=${encodeURIComponent(searchKeyword)}`);
      setSearchResults(data.photos);
      setView('search');
      if (data.photos.length === 0) show('검색 결과가 없습니다.');
    } catch (err) {
      show(err.message);
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
      show(err.message);
    }
  }

  async function openMessages() {
    try {
      await loadMessages();
      setView('messages');
    } catch (err) {
      show(err.message);
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
      await openMessages();
    } catch (err) {
      show(err.message);
    }
  }

  async function deleteMessage(messageId) {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await request(`/api/messages/${messageId}`, { method: 'DELETE' });
      show('메시지가 삭제되었습니다.');
      await openMessages();
    } catch (err) {
      show(err.message);
    }
  }

  function openMessageForm(photo) {
    setSelectedPhoto(photo);
    setView('message');
  }

  function openEditForm(photo) {
    setSelectedPhoto(photo);
    setView('edit');
  }

  return (
    <>
      <Header
        user={user}
        onHome={() => setView('home')}
        onUpload={() => setView('upload')}
        onMessages={openMessages}
        onSignout={handleSignout}
        onSignin={() => setView('signin')}
        onSignup={() => setView('signup')}
      />

      {notice && <div className="notice">{notice}</div>}

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
        <SimpleForm title="Sign Up" onSubmit={handleSignup}>
          <input name="username" placeholder="아이디" />
          <input name="password" type="password" placeholder="비밀번호(6자 이상)" />
          <button type="submit">Sign Up</button>
        </SimpleForm>
      )}

      {view === 'signin' && (
        <SimpleForm title="Sign In" onSubmit={handleSignin}>
          <input name="username" placeholder="아이디" />
          <input name="password" type="password" placeholder="비밀번호" />
          <button type="submit">Sign In</button>
        </SimpleForm>
      )}

      {view === 'upload' && user && (
        <SimpleForm title="Upload Photo" onSubmit={handleUpload}>
          <input name="photo" type="file" accept=".jpg,.jpeg,.png" />
          <textarea name="description" placeholder="사진 설명" />
          <input name="keywords" placeholder="키워드 예: 고양이, 반려동물" />
          <button type="submit">Upload</button>
        </SimpleForm>
      )}

      {view === 'edit' && selectedPhoto && (
        <SimpleForm title="Modify Photo Information" onSubmit={handleEdit}>
          <textarea name="description" defaultValue={selectedPhoto.description} />
          <input name="keywords" defaultValue={selectedPhoto.keywords} />
          <button type="submit">Save</button>
        </SimpleForm>
      )}

      {view === 'message' && selectedPhoto && (
        <SimpleForm title={`Direct Message to ${selectedPhoto.uploader}`} onSubmit={handleSendMessage}>
          <textarea name="content" placeholder="메시지 내용" />
          <button type="submit">Send</button>
        </SimpleForm>
      )}

      {view === 'search' && (
        <section className="panel page">
          <h2>Search Results</h2>
          <button type="button" onClick={() => setView('home')}>Back</button>
          {searchResults.length === 0 ? (
            <p>검색 결과가 없습니다.</p>
          ) : (
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
          )}
        </section>
      )}

      {view === 'messages' && (
        <section className="panel page">
          <h2>Received Messages</h2>
          {messages.length === 0 ? (
            <p>받은 메시지가 없습니다.</p>
          ) : (
            messages.map((m) => (
              <div className="message" key={m.id}>
                <p><b>From:</b> {m.sender_name}</p>
                <p>{m.content}</p>
                <p className="small">Photo: {m.photo_description || 'N/A'} / {m.created_at}</p>
                <button type="button" onClick={() => { setSelectedMessage(m); setView('reply'); }}>Reply</button>
                <button type="button" onClick={() => deleteMessage(m.id)}>Delete</button>
              </div>
            ))
          )}
        </section>
      )}

      {view === 'reply' && selectedMessage && (
        <SimpleForm title={`Reply to ${selectedMessage.sender_name}`} onSubmit={handleReply}>
          <textarea name="content" placeholder="답장 내용" />
          <button type="submit">Send Reply</button>
        </SimpleForm>
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
