import { useState, useEffect } from 'react';

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('student'); 
  
  // React Memory (State)
  const [identifier, setIdentifier] = useState(''); 
  const [fullName, setFullName] = useState('');
  const [pin, setPin] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [accessCode, setAccessCode] = useState(''); 
  const [showAccessCode, setShowAccessCode] = useState(false); // NEW: Toggle state

  // --- THE AUTO-GENERATOR ---
  useEffect(() => {
    if (!isLogin && role === 'lecturer' && fullName.length > 2) {
      if (!identifier.startsWith('LEC-')) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        setIdentifier(`LEC-${randomNum}`);
      }
    }
  }, [fullName, role, isLogin, identifier]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!isLogin) {
      const nameWords = fullName.trim().split(/\s+/);
      if (nameWords.length < 3) {
        setStatusMsg({ type: 'error', text: "Please enter all three names (First, Middle, Surname)." });
        return;
      }
    }

    const endpoint = isLogin 
      ? (role === 'student' ? '/api/login' : '/api/lecturer/login') 
      : (role === 'student' ? '/api/register' : '/api/lecturer/register');
    
    let payload = {};
    if (isLogin) {
      payload = { [role === 'student' ? 'matric_no' : 'staff_id']: identifier, password: pin };
    } else {
      payload = { [role === 'student' ? 'matric_no' : 'staff_id']: identifier, full_name: fullName, password: pin };
      if (role === 'lecturer') {
        payload.access_code = accessCode; 
      }
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (!isLogin) {
          setIsLogin(true);
          setFullName('');
          setPin('');
          setAccessCode(''); 
          setStatusMsg({ 
            type: 'success', 
            text: `Registration successful! Please log in below. Your ID is: ${identifier}` 
          });
        } else {
          const userData = role === 'student' ? data.studentData : data.lecturerData;
          onLogin({ ...userData, role: role }); 
        }
      } else {
        setStatusMsg({ type: 'error', text: data.message });
      }
    } catch (error) {
      setStatusMsg({ type: 'error', text: "Failed to connect to the server. Is it running?" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-nacosGreen mb-2">
            NACOS Attendance Portal
          </h2>
          <p className="text-gray-500">
            {isLogin ? 'Sign in to access your portal' : 'Register your portal account'}
          </p>
        </div>

        <div className="flex justify-center space-x-2 mb-6 bg-gray-100 p-1 rounded-lg">
          <button 
            type="button"
            onClick={() => { setRole('student'); setIdentifier(''); setStatusMsg(null); }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${role === 'student' ? 'bg-white shadow text-nacosGreen' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Student
          </button>
          <button 
            type="button"
            onClick={() => { setRole('lecturer'); setIdentifier(''); setStatusMsg(null); }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${role === 'lecturer' ? 'bg-white shadow text-nacosGreen' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Lecturer
          </button>
        </div>

        {statusMsg && (
          <div className={`p-3 rounded-lg mb-4 text-sm font-semibold ${statusMsg.type === 'success' ? 'bg-nacosLight text-nacosGreen' : 'bg-red-100 text-red-700'}`}>
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {role === 'student' ? 'Full Name' : 'Title & Full Name'}
              </label>
              <input 
                type="text" 
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value.toUpperCase())}
                placeholder={role === 'student' ? "e.g. FAREO ADEYEMI [MIDDLE NAME]" : "e.g. DR. JOHN DOE SMITH"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none transition"
              />
              <p className="text-xs text-gray-400 mt-1">Must include First, Middle, and Surname.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {role === 'student' ? 'Matric Number' : 'Staff ID Number'}
            </label>
            <input 
              type="text" 
              required
              readOnly={!isLogin && role === 'lecturer'} 
              maxLength={role === 'student' ? "11" : "10"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={
                role === 'student' 
                  ? "e.g. 24120101074" 
                  : (!isLogin ? "Will auto-generate..." : "e.g. LEC-1234")
              }
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg outline-none transition ${!isLogin && role === 'lecturer' ? 'bg-gray-100 text-gray-600 font-bold' : 'focus:ring-2 focus:ring-nacosGreen'}`}
            />
            {role === 'student' && <p className="text-xs text-gray-400 mt-1">Must be exactly 11 digits.</p>}
            {!isLogin && role === 'lecturer' && <p className="text-xs text-nacosGreen mt-1 font-semibold">Please write this ID down. You will use it to log in.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN</label>
            <input 
              type="password" 
              required
              inputMode="numeric"
              maxLength="4"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none transition"
            />
          </div>

          {!isLogin && role === 'lecturer' && (
            <div className="mb-4 animate-fade-in">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Access Code
              </label>
              <div className="relative">
                <input 
                  type={showAccessCode ? "text" : "password"} 
                  required 
                  placeholder="Enter secret staff code"
                  value={accessCode} 
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none bg-white pr-10 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowAccessCode(!showAccessCode)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-nacosGreen transition"
                >
                  {showAccessCode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="w-full bg-nacosGreen hover:bg-green-800 text-white font-semibold py-3 rounded-lg shadow-md transition duration-200 mt-4"
          >
            {isLogin ? `Log In as ${role === 'student' ? 'Student' : 'Lecturer'}` : `Register as ${role === 'student' ? 'Student' : 'Lecturer'}`}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          {isLogin ? "Don't have an account? " : "Already registered? "}
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setStatusMsg(null);
              setFullName('');
              setPin('');
              setAccessCode('');
              setShowAccessCode(false);
            }}
            className="text-nacosGreen font-semibold hover:underline"
          >
            {isLogin ? 'Sign up here' : 'Log in here'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Auth;