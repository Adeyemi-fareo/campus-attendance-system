import { useState, useEffect } from 'react';

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('student'); 
  
  const [identifier, setIdentifier] = useState(''); 
  const [fullName, setFullName] = useState('');
  const [pin, setPin] = useState('');
  const [level, setLevel] = useState(''); 
  const [statusMsg, setStatusMsg] = useState(null);
  const [accessCode, setAccessCode] = useState(''); 
  const [lecturerEmailRegister, setLecturerEmailRegister] = useState(''); 

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingRecovery, setIsProcessingRecovery] = useState(false);

  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryType, setRecoveryType] = useState('id'); // 'id' or 'pin'
  const [recoveryName, setRecoveryName] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (!isLogin && role === 'lecturer' && fullName.length > 2) {
      if (!identifier.startsWith('LEC-')) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        setIdentifier(`LEC-${randomNum}`);
      }
    }
  }, [fullName, role, isLogin, identifier]);

  const handleIdentifierChange = (val) => {
    const sanitized = val.toUpperCase().replace(/\s/g, '');
    if (role === 'student' && sanitized.length > 11) return;
    setIdentifier(sanitized);
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    setRecoveryStatus(null);
    setIsProcessingRecovery(true);

    try {
      if (recoveryType === 'id') {
        if (role !== 'lecturer') {
          setRecoveryStatus({ type: 'error', text: "Matric numbers cannot be recovered by name. Please use your 11-digit matric to recover your PIN." });
          setIsProcessingRecovery(false);
          return;
        }

        const res = await fetch(`${apiUrl}/api/recovery/forgot-id`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: recoveryEmail }) 
        });
        const data = await res.json();
        if (res.ok) {
          setRecoveryStatus({ type: 'success', text: `Verification Success! Found Staff ID: ${data.staff_id} (Linked to ${data.masked_email})` });
        } else {
          setRecoveryStatus({ type: 'error', text: data.message });
        }
      } else {
        const res = await fetch(`${apiUrl}/api/recovery/forgot-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: role, identifier: recoveryId, email: recoveryEmail })
        });
        const data = await res.json();
        if (res.ok) {
          setRecoveryStatus({ type: 'success', text: `✅ ${data.message}` });
        } else {
          setRecoveryStatus({ type: 'error', text: data.message });
        }
      }
    } catch (err) {
      setRecoveryStatus({ type: 'error', text: "Server gateway communication block." });
    } finally {
      setIsProcessingRecovery(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg(null);
    setIsSubmitting(true);

    if (!isLogin && role === 'student') {
      if (!level) {
        setStatusMsg({ type: 'error', text: "Please select your academic level before registering." });
        setIsSubmitting(false);
        return;
      }
      if (identifier.length !== 11) {
        setStatusMsg({ type: 'error', text: "Invalid Matric Number. It must be exactly 11 digits long." });
        setIsSubmitting(false);
        return;
      }
      const nameWords = fullName.trim().split(/\s+/);
      if (nameWords.length !== 3) {
        setStatusMsg({ type: 'error', text: "Registration Denied: You must enter exactly three names." });
        setIsSubmitting(false);
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
        level: level 
      };
      
      if (role === 'lecturer') {
        payload.access_code = accessCode; 
        payload.email = lecturerEmailRegister; 
      }
    }

    try {
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
          setLevel('');
          setLecturerEmailRegister('');
          setStatusMsg({ type: 'success', text: `Registration successful! Please log in below. Your ID is: ${identifier}` });
        } else {
          const userData = role === 'student' ? data.studentData : data.lecturerData;
          onLogin({ ...userData, role: role }); 
        }
      } else {
        setStatusMsg({ type: 'error', text: data.message });
      }
    } catch (error) {
      setStatusMsg({ type: 'error', text: "Failed to connect to the server." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 relative">
        
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-nacosGreen mb-2">NACOS Attendance Portal</h2>
          <p className="text-gray-500">{isLogin ? 'Sign in to access your portal' : 'Register your portal account'}</p>
        </div>

        <div className="flex justify-center space-x-2 mb-6 bg-gray-100 p-1 rounded-lg">
          <button type="button" onClick={() => { setRole('student'); setIdentifier(''); setLevel(''); setStatusMsg(null); }} className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${role === 'student' ? 'bg-white shadow text-nacosGreen' : 'text-gray-500 hover:text-gray-700'}`}>Student</button>
          <button type="button" onClick={() => { setRole('lecturer'); setIdentifier(''); setStatusMsg(null); }} className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${role === 'lecturer' ? 'bg-white shadow text-nacosGreen' : 'text-gray-500 hover:text-gray-700'}`}>Lecturer</button>
        </div>

        {statusMsg && (
          <div className={`p-3 rounded-lg mb-4 text-sm font-semibold ${statusMsg.type === 'success' ? 'bg-nacosLight text-nacosGreen' : 'bg-red-100 text-red-700'}`}>{statusMsg.text}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{role === 'student' ? 'Full Name' : 'Title & Full Name'}</label>
              <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value.toUpperCase())} placeholder={role === 'student' ? "SURNAME FIRSTNAME OTHER" : "e.g. DR. JOHN DOE ROBERT"} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none transition" />
              <p className="text-xs text-gray-400 mt-1">Must include all three names strictly.</p>
            </div>
          )}

          {!isLogin && role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Level</label>
              <select required value={level} onChange={(e) => setLevel(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen bg-white outline-none transition">
                <option value="" disabled>-- Select Level --</option>
                <option value="100">100 Level</option>
                <option value="200">200 Level</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{role === 'student' ? 'Matric Number' : 'Staff ID Number'}</label>
            <input type="text" required disabled={!isLogin && role === 'lecturer'} value={identifier} onChange={(e) => handleIdentifierChange(e.target.value)} placeholder={role === 'student' ? "Must be exactly 11 digits" : "e.g. LEC-1234"} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none transition disabled:bg-gray-50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN</label>
            <input type="password" maxLength={4} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen text-center tracking-widest outline-none transition" />
          </div>

          {!isLogin && role === 'lecturer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Official Email Address</label>
              <input 
                type="email" 
                required
                value={lecturerEmailRegister}
                onChange={(e) => setLecturerEmailRegister(e.target.value)}
                placeholder="e.g. lecturer@lasued.edu.ng"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none transition"
              />
            </div>
          )}

          {isLogin && (
            <div className="text-right">
              <button type="button" onClick={() => { setShowRecoveryModal(true); setRecoveryStatus(null); }} className="text-xs text-nacosGreen hover:underline font-semibold">Forgot ID or Password?</button>
            </div>
          )}

          {!isLogin && role === 'lecturer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department Access Code</label>
              <input type="text" required value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Enter access token" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none transition" />
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-nacosGreen text-white font-semibold py-3 rounded-xl hover:bg-opacity-90 transition shadow-md flex justify-center items-center"
          >
            {isSubmitting ? (
              <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              isLogin ? `Log In as ${role === 'student' ? 'Student' : 'Lecturer'}` : `Register as ${role === 'student' ? 'Student' : 'Lecturer'}`
            )}
          </button>
        </form>

        <div className="text-center mt-5 text-sm">
          <button onClick={() => { setIsLogin(!isLogin); setStatusMsg(null); setLevel(''); }} className="text-nacosGreen hover:underline font-medium">
            {isLogin ? "Don't have an account? Sign up here" : "Already have an account? Login here"}
          </button>
        </div>

        {}
        {showRecoveryModal && (
          <div className="fixed inset-0 bg-white bg-opacity-95 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 relative animate-fade-in">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Account Recovery Panel</h3>
              <p className="text-xs text-gray-400 mb-4">Select recovery profile parameters targeting active registries.</p>
              
              <div className="flex bg-gray-100 p-1 rounded-md mb-4 text-xs font-bold">
                <button 
                  type="button" 
                  onClick={() => { setRole('student'); setRecoveryType('pin'); setRecoveryStatus(null); }} 
                  className={`flex-1 py-1.5 rounded transition ${role === 'student' ? 'bg-white text-nacosGreen shadow' : 'text-gray-500'}`}
                >
                  Student Profile
                </button>
                <button 
                  type="button" 
                  onClick={() => { setRole('lecturer'); setRecoveryStatus(null); }} 
                  className={`flex-1 py-1.5 rounded transition ${role === 'lecturer' ? 'bg-white text-nacosGreen shadow' : 'text-gray-500'}`}
                >
                  Lecturer Profile
                </button>
              </div>

              {role === 'lecturer' && (
                <div className="flex space-x-2 border-b pb-3 mb-3 text-xs justify-center">
                  <button type="button" onClick={() => { setRecoveryType('id'); setRecoveryStatus(null); }} className={`font-bold pb-1 ${recoveryType === 'id' ? 'text-nacosGreen border-b-2 border-nacosGreen' : 'text-gray-400'}`}>Find Staff ID</button>
                  <button type="button" onClick={() => { setRecoveryType('pin'); setRecoveryStatus(null); }} className={`font-bold pb-1 ${recoveryType === 'pin' ? 'text-nacosGreen border-b-2 border-nacosGreen' : 'text-gray-400'}`}>Recover PIN</button>
                </div>
              )}

              {recoveryStatus && (
                <div className={`p-2.5 rounded-lg mb-4 text-xs font-bold break-all ${recoveryStatus.type === 'success' ? 'bg-nacosLight text-nacosGreen' : 'bg-red-100 text-red-700'}`}>{recoveryStatus.text}</div>
              )}

              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                {recoveryType === 'id' && role === 'lecturer' ? (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Enter Registered Email Address</label>
                    <input type="email" required value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="e.g. lecturer@lasued.edu.ng" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-nacosGreen" />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">{role === 'student' ? 'Confirm Matric Number' : 'Confirm Staff ID Number'}</label>
                      <input type="text" required value={recoveryId} onChange={(e) => setRecoveryId(e.target.value.toUpperCase())} placeholder={role === 'student' ? "11 Digits Matric" : "e.g. LEC-1234"} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-nacosGreen" />
                    </div>
                    {}
                    {role === 'student' && (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Enter Receiving Email Address</label>
                        <input type="email" required value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="e.g. user@gmail.com" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-nacosGreen" />
                      </div>
                    )}
                  </>
                )}

                <div className="flex space-x-2 pt-2">
                  <button type="button" onClick={() => setShowRecoveryModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 rounded-lg text-xs transition">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={isProcessingRecovery}
                    className="flex-1 bg-nacosGreen text-white font-bold py-2 rounded-lg text-xs transition shadow-sm flex justify-center items-center"
                  >
                    {isProcessingRecovery ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      "Process Request"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Auth;