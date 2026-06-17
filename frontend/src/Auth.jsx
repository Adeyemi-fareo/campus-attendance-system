import { useState, useEffect } from 'react';

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('student'); 
  
  // React Memory (State)
  const [identifier, setIdentifier] = useState(''); 
  const [fullName, setFullName] = useState('');
  const [pin, setPin] = useState('');
  const [level, setLevel] = useState('200'); // REQ 1: Track student levels
  const [statusMsg, setStatusMsg] = useState(null);
  const [accessCode, setAccessCode] = useState(''); 
  const [showAccessCode, setShowAccessCode] = useState(false);

  // --- THE AUTO-GENERATOR ---
  useEffect(() => {
    if (!isLogin && role === 'lecturer' && fullName.length > 2) {
      if (!identifier.startsWith('LEC-')) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        setIdentifier(`LEC-${randomNum}`);
      }
    }
  }, [fullName, role, isLogin, identifier]);

  const handleIdentifierChange = (val) => {
    // REQ 7: Force Uppercase and Strip ALL spaces instantly
    const sanitized = val.toUpperCase().replace(/\s/g, '');
    setIdentifier(sanitized);
  };

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
      payload = { 
        [role === 'student' ? 'matric_no' : 'staff_id']: identifier, 
        full_name: fullName, 
        password: pin,
        level: level // Send level to backend registration database
      };
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
                placeholder={role === 'student' ? "e.g. FAREO ADEYEMI DAVID" : "e.g. DR. JOHN DOE SMITH"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none transition"
              />
              <p className="text-xs text-gray-400 mt-1">Must include First, Middle, and Surname.</p>
            </div>
          )}

          {/* Dropdown Level selection for Students */}
{role === 'student' && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Academic Level</label>
    <select
      value={level}
      onChange={(e) => setLevel(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen bg-white outline-none transition"
    >
      <option value="100">100 Level</option>
      <option value="200">200 Level</option>
    </select>
  </div>
)}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {role === 'student' ? 'Matric Number' : 'Staff ID Number'}
            </label>
            <input 
              type="text" 
              required
              disabled={!isLogin && role === 'lecturer'} 
              value={identifier}
              onChange={(e) => handleIdentifierChange(e.target.value)}
              placeholder={role === 'student' ? "Enter your Matric Number" : "e.g. LEC-1234"}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none transition disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN</label>
            <input 
              type="password" 
              maxLength={4}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen text-center tracking-widest outline-none transition"
            />
          </div>

          {!isLogin && role === 'lecturer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department Access Code</label>
              <input 
                type="text" 
                required
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Enter access token"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none transition"
              />
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-nacosGreen text-white font-semibold py-3 rounded-xl hover:bg-opacity-90 transition shadow-md"
          >
            {isLogin ? `Log In as ${role === 'student' ? 'Student' : 'Lecturer'}` : `Register as ${role === 'student' ? 'Student' : 'Lecturer'}`}
          </button>
        </form>

        <div className="text-center mt-5 text-sm">
          <button 
            onClick={() => { setIsLogin(!isLogin); setStatusMsg(null); }}
            className="text-nacosGreen hover:underline font-medium"
          >
            {isLogin ? "Don't have an account? Sign up here" : "Already have an account? Login here"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;