import { useState, useEffect } from 'react';
import Auth from './Auth';
import Dashboard from './Dashboard';
import ResetPassword from './ResetPassword'; 

function App() {
  const [user, setUser] = useState(null);
  const [resetParams, setResetParams] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    if (token && email) {
      setResetParams({ token, email });
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
  };

  if (resetParams) {
    return (
      <ResetPassword 
        token={resetParams.token} 
        email={resetParams.email} 
        onComplete={() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setResetParams(null);
        }}
      />
    );
  }

  return (
    <div className="App">
      {!user ? (
        <Auth onLogin={(userData) => setUser(userData)} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;