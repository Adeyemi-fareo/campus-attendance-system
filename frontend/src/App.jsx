import { useState } from 'react';
import Auth from './Auth';
import Dashboard from './Dashboard';

function App() {
  // If this is null, the user is not logged in.
  // If it contains data (like their name and role), they are logged in.
  const [currentUser, setCurrentUser] = useState(null);

  return (
    <div>
      {/* The Traffic Cop Logic: */}
      {currentUser ? (
        <Dashboard user={currentUser} onLogout={() => setCurrentUser(null)} />
      ) : (
        <Auth onLogin={(userData) => setCurrentUser(userData)} />
      )}
    </div>
  );
}

export default App;