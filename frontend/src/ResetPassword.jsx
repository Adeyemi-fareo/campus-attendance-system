import { useState } from 'react';

const ResetPassword = ({ token, email, onComplete }) => {
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (newPin.length !== 4) {
      setStatus({ type: 'error', text: "PIN must be exactly 4 digits long." });
      return;
    }
    if (newPin !== confirmPin) {
      setStatus({ type: 'error', text: "PIN entries do not match." });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch(`${apiUrl}/api/recovery/confirm-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password: newPin })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', text: "🎉 Secure PIN updated successfully! Redirecting you to login..." });
        setTimeout(() => onComplete(), 3000);
      } else {
        setStatus({ type: 'error', text: data.message });
      }
    } catch (err) {
      setStatus({ type: 'error', text: "Gateway network submission error." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-nacosGreen text-center mb-2">Create New Security PIN</h2>
        <p className="text-gray-500 text-center text-sm mb-6">Updating account profile for: <br/><strong className="text-gray-700">{email}</strong></p>

        {status && (
          <div className={`p-3 rounded-lg mb-4 text-sm font-semibold text-center ${status.type === 'success' ? 'bg-nacosLight text-nacosGreen' : 'bg-red-100 text-red-700'}`}>
            {status.text}
          </div>
        )}

        <form onSubmit={handleResetSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enter New 4-Digit PIN</label>
            <input type="password" maxLength={4} required value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center tracking-widest outline-none focus:ring-2 focus:ring-nacosGreen" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New 4-Digit PIN</label>
            <input type="password" maxLength={4} required value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center tracking-widest outline-none focus:ring-2 focus:ring-nacosGreen" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-nacosGreen text-white font-semibold py-3 rounded-xl shadow-md transition hover:bg-opacity-90 flex justify-center items-center">
            {loading ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : "Update Portal PIN"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;