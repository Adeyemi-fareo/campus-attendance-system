import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Html5QrcodeScanner } from 'html5-qrcode';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('session'); 
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedHall, setSelectedHall] = useState('');
  const [activeQR, setActiveQR] = useState(null); 
  const [sessionSummary, setSessionSummary] = useState(null);
  
  const [lecturerEmail, setLecturerEmail] = useState(user?.email || '');  
  const [recentEmails, setRecentEmails] = useState([]); 
  const [isEmailing, setIsEmailing] = useState(false); 
  
  const [historyData, setHistoryData] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);

  const coursesByLevel = {
    '100 Level': ['COS121', 'LASUED-CSC121', 'LASUED-CSC122', 'LASUED-CSC123', 'LASUED-CSC124', 'LASUED-CSC125', 'LASUED-CSC126'],
    '200 Level': ['COS221', 'CSC221', 'IFT211', 'LASUED-CSC222', 'LASUED-CSC223', 'LASUED-CSC224', 'LASUED-CSC225', 'LASUED-CSC226', 'SEN221'] 
  };
  const halls = ['Coited Room 1', 'Coited Annex Building', 'Credo Hall', 'ETF Building', 'Software Lab 1', 'Software Lab 2'];

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (user?.role === 'lecturer') {
      const savedSession = localStorage.getItem(`nacos_session_${user.staff_id}`);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        setActiveQR(parsed.qrPayload);
        setSelectedLevel(parsed.level);
        setSelectedCourse(parsed.course);
        setSelectedHall(parsed.hall);
      }
      const savedEmails = JSON.parse(localStorage.getItem(`nacos_emails_${user.staff_id}`)) || [];
      setRecentEmails(savedEmails);
    }
  }, [user?.role, user?.staff_id]);

  const handleGenerateQR = async (e) => {
    e.preventDefault();
    const startTime = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    
    let liveClassId = null;
    try {
      const logResponse = await fetch(`${apiUrl}/api/classes/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecturer_id: user.staff_id,
          course_code: selectedCourse,
          level: selectedLevel,
          hall_name: selectedHall
        })
      });
      const logData = await logResponse.json();
      if (logResponse.ok) liveClassId = logData.classId;
    } catch (err) { console.error("Session timeline logging skipped."); }

    const qrPayload = JSON.stringify({
      level: selectedLevel,
      course: selectedCourse,
      hall: selectedHall,
      lecturer_id: user.staff_id,
      startedAt: startTime,
      timestamp: new Date().getTime() 
    });
    
    localStorage.setItem(`nacos_session_${user.staff_id}`, JSON.stringify({
      qrPayload, level: selectedLevel, course: selectedCourse, hall: selectedHall, startedAt: startTime, classId: liveClassId
    }));
    
    setActiveQR(qrPayload);
    setSessionSummary(null); 
  };

  const handleEndSession = async () => {
    let finalCount = 0;
    const sessionData = JSON.parse(localStorage.getItem(`nacos_session_${user.staff_id}`)) || {};
    const endTime = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

    if (sessionData.classId) {
      try {
        await fetch(`${apiUrl}/api/classes/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classId: sessionData.classId })
        });
      } catch (err) { console.error("Session closing bounds update dropped."); }
    }

    try {
      const response = await fetch(`${apiUrl}/api/attendance/count?course=${selectedCourse}`);
      if (response.ok) {
        const data = await response.json();
        finalCount = data.count;
      }
    } catch (error) {
      console.error("Failed to capture terminal attendance registry counts.");
    }

    localStorage.removeItem(`nacos_session_${user.staff_id}`);
    setActiveQR(null);
    setSessionSummary({ 
      course: selectedCourse, 
      hall: selectedHall, 
      count: finalCount,
      startedAt: sessionData.startedAt || "N/A",
      endedAt: endTime
    });
  };

  const handleEmailReport = async (e, courseOverride = null) => {
    e?.preventDefault();
    setIsEmailing(true);

    const targetCourse = courseOverride || selectedCourse;
    let updatedEmails = [lecturerEmail, ...recentEmails.filter(email => email !== lecturerEmail)].slice(0, 5);
    setRecentEmails(updatedEmails);
    localStorage.setItem(`nacos_emails_${user.staff_id}`, JSON.stringify(updatedEmails));

    try {
      const response = await fetch(`${apiUrl}/api/attendance/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course: targetCourse,
          email: lecturerEmail
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert("✅ Success! Excel Spreadsheet Report sent to: " + lecturerEmail);
      } else {
        alert("❌ Operations Error: " + data.message);
      }
    } catch (err) {
      alert("❌ Critical Gateway Error: Could not verify mail connection.");
    } finally {
      setIsEmailing(false);
    }
  };

  const fetchHistory = async () => {
    setActiveTab('history');
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${apiUrl}/api/lecturer/history?staff_id=${user.staff_id}`);
      if (response.ok) {
        const data = await response.json();
        setHistoryData(data);
      }
    } catch (error) {
      console.error("Critical tracking anomaly encountered.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'student' && isScanning) {
      const scanner = new Html5QrcodeScanner("nacos-qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);

      scanner.render(
        (decodedText) => {
          scanner.clear(); 
          setIsScanning(false); 
          try {
            const qrData = JSON.parse(decodedText);
            setScanMessage({ type: 'success', text: `✅ Code verified for ${qrData.course}. Validating spatial coordinates via GPS...` });

            if ("geolocation" in navigator) {
              navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                  const response = await fetch(`${apiUrl}/api/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      matric_no: user.matric_no,
                      course: qrData.course,
                      level: user.level || qrData.level, 
                      hall: qrData.hall,
                      lecturer_id: qrData.lecturer_id, 
                      lat: latitude,
                      lng: longitude
                    })
                  });

                  const resultData = await response.json();
                  if (response.ok) {
                    setScanMessage({ type: 'success', text: `🎉 ${resultData.message}` });
                  } else {
                    setScanMessage({ type: 'error', text: `❌ ${resultData.message}` });
                  }
                } catch (err) {
                  setScanMessage({ type: 'error', text: "❌ Connection error while linking back-end records." });
                }
              }, (error) => {
                setScanMessage({ type: 'error', text: "❌ GPS location authorization denied. Unable to log attendance." });
              });
            } else {
              setScanMessage({ type: 'error', text: "❌ GPS hardware array not found on this device." });
            }
          } catch (e) {
            setScanMessage({ type: 'error', text: "❌ Decryption Error: Invalid dynamic core sequence array keys." });
          }
        },
        (error) => {}
      );

      return () => {
        scanner.clear().catch(e => console.log("Scanner engine detached."));
      };
    }
  }, [isScanning, user?.role, user?.matric_no, user?.level, apiUrl]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6 border border-gray-100 w-full flex-grow">
        
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-nacosGreen">Welcome, {user?.full_name || 'User'}</h1>
            <p className="text-gray-500 font-medium mt-1">
              {user?.role === 'student' 
                ? `Matric No: ${user?.matric_no} • (${user?.level || '200'} Level)` 
                : `Staff ID: ${user?.staff_id || 'N/A'}`}
            </p>
          </div>
          <button onClick={onLogout} className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg font-semibold transition">
            End Session
          </button>
        </div>

        <div className="py-4">
          
          {user?.role === 'lecturer' && (
            <div className="max-w-xl mx-auto">
              
              <div className="flex space-x-4 mb-8 border-b">
                <button 
                  onClick={() => { setActiveTab('session'); setSessionSummary(null); }}
                  className={`pb-2 font-bold transition-colors ${activeTab === 'session' ? 'text-nacosGreen border-b-2 border-nacosGreen' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Active Portal Session
                </button>
                <button 
                  onClick={fetchHistory}
                  className={`pb-2 font-bold transition-colors ${activeTab === 'history' ? 'text-nacosGreen border-b-2 border-nacosGreen' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Class History
                </button>
              </div>

              {activeTab === 'session' && (
                <>
                  {!activeQR && !sessionSummary && (
                    <form onSubmit={handleGenerateQR} className="space-y-4 animate-fade-in">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Class Level</label>
                        <select required value={selectedLevel} onChange={(e) => { setSelectedLevel(e.target.value); setSelectedCourse(''); }} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none bg-white">
                          <option value="" disabled>-- Select Level --</option>
                          {Object.keys(coursesByLevel).map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Semester Curriculum Course</label>
                        <select required value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} disabled={!selectedLevel} className={`w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-white transition ${!selectedLevel ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'focus:ring-2 focus:ring-nacosGreen'}`}>
                          <option value="" disabled>{!selectedLevel ? '-- Select Academic Level --' : '-- Choose Course --'}</option>
                          {selectedLevel && coursesByLevel[selectedLevel].map(course => <option key={course} value={course}>{course}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Preferred Lecture Hall</label>
                        <select required value={selectedHall} onChange={(e) => setSelectedHall(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nacosGreen outline-none bg-white">
                          <option value="" disabled>-- Select Lecture Hall --</option>
                          {halls.map(hall => <option key={hall} value={hall}>{hall}</option>)}
                        </select>
                      </div>
                      <button type="submit" className="w-full bg-nacosGreen hover:bg-green-800 text-white font-semibold py-3 rounded-lg shadow-md transition duration-200 mt-4">
                        Start Scanner (QR Code)
                      </button>
                    </form>
                  )}

                  {activeQR && (
                    <div className="flex flex-col items-center animate-fade-in text-center">
                      <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-nacosGreen mb-6">
                        <QRCode value={activeQR} size={250} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">{selectedCourse}</h3>
                      <p className="text-gray-500 mb-2">{selectedHall}</p>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-6">Session Active Across Devices</span>
                      
                      <button onClick={handleEndSession} className="bg-red-50 text-red-600 font-semibold py-2 px-6 rounded-lg hover:bg-red-100 transition">
                        Terminate Class Session & Close Window
                      </button>
                    </div>
                  )}

                  {sessionSummary && (
                    <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-nacosGreen text-center animate-fade-in">
                      <h3 className="text-2xl font-bold text-gray-800 mb-1">Class Session Terminated</h3>
                      <p className="text-gray-500 font-medium mb-4">{sessionSummary.course} • {sessionSummary.hall}</p>
                      
                      <div className="flex justify-center space-x-4 mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <div>Started: <span className="text-gray-700">{sessionSummary.startedAt}</span></div>
                        <div>Closed: <span className="text-gray-700">{sessionSummary.endedAt}</span></div>
                      </div>
                      
                      <div className="bg-gray-50 border border-gray-200 rounded-xl py-6 mb-6">
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Final Student Signature Count</p>
                        <p className="text-6xl font-extrabold text-nacosGreen">{sessionSummary.count}</p>
                      </div>
                      
                      <form onSubmit={(e) => handleEmailReport(e)} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 text-left mb-1">Enter Active Email Address</label>
                        <input 
                          type="email" 
                          required
                          list="recent-emails"
                          placeholder="lecturer@lasued.edu.ng"
                          value={lecturerEmail}
                          onChange={(e) => setLecturerEmail(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white mb-3"
                        />
                        <datalist id="recent-emails">
                          {recentEmails.map((email, index) => <option key={index} value={email} />)}
                        </datalist>

                        <button type="submit" disabled={isEmailing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md transition duration-200 flex justify-center items-center gap-2">
                          {isEmailing ? "Compiling Excel Structure Arrays..." : "Transmit CSV/Excel Sheet File Report"}
                        </button>
                      </form>
                      
                      <button onClick={() => setSessionSummary(null)} className="text-gray-500 hover:text-gray-700 font-semibold hover:underline mt-2">
                        Return to Central Operations Command
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'history' && (
                <div className="animate-fade-in">
                  {isLoadingHistory ? (
                    <p className="text-center text-gray-500 py-10">Syncing with remote database clusters...</p>
                  ) : historyData.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-gray-500 font-medium">No class history found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {historyData.map((session, index) => (
                        <div key={index} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex justify-between items-center hover:shadow-md transition">
                          <div>
                            <h4 className="text-lg font-bold text-gray-800">{session.course_code}</h4>
                            <p className="text-sm text-gray-500">{session.class_date} • {session.hall_name} • {session.level}</p>
                            <p className="text-xs text-gray-400 font-medium mt-1">Attendance recorded via student QR scans</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-nacosGreen">{session.total_students}</p>
                            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Verified</p>
                          </div>
                        </div>
                      ))}
                      
                      <div className="mt-8 pt-6 border-t border-gray-200">
                         <h4 className="text-sm font-bold text-gray-700 mb-2">Receiving Email</h4>
                         <div className="flex space-x-2">
                           <input 
                              type="email" 
                              required
                              list="recent-emails"
                              placeholder="Receiver Mail Route"
                              value={lecturerEmail}
                              onChange={(e) => setLecturerEmail(e.target.value)}
                              className="flex-grow px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                           <button 
                              onClick={() => {
                                const course = prompt("Enter the Course Code (e.g., CSC221):");
                                if (course && lecturerEmail) handleEmailReport(null, course.toUpperCase());
                              }}
                              disabled={!lecturerEmail || isEmailing}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition text-sm disabled:opacity-50"
                            >
                              Send Report
                            </button>
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {user?.role === 'student' && (
            <div className="max-w-md mx-auto text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Biometric Spatial Scanning Portal</h2>
              {scanMessage && (
                <div className={`p-4 rounded-lg mb-6 text-sm font-bold ${scanMessage.type === 'success' ? 'bg-nacosLight text-nacosGreen border border-nacosGreen' : 'bg-red-100 text-red-700'}`}>
                  {scanMessage.text}
                </div>
              )}
              {!isScanning ? (
                <button onClick={() => { setIsScanning(true); setScanMessage(null); }} className="w-full bg-nacosGreen hover:bg-green-800 text-white font-semibold py-4 rounded-xl shadow-lg transition duration-200 flex items-center justify-center space-x-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Initialize Token Scanner</span>
                </button>
              ) : (
                <div className="flex flex-col items-center">
                  <div id="nacos-qr-reader" className="w-full overflow-hidden rounded-2xl shadow-lg border-4 border-gray-100 mb-4 bg-white"></div>
                  <button onClick={() => setIsScanning(false)} className="text-red-500 font-semibold hover:underline mt-4">
                    Kill Optical Capture Feed
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      
      <div className="text-center mt-8 text-xs font-bold text-gray-400 tracking-widest uppercase pb-4">
        Powered by FAREO ADEYEMI (Adrian FA) • NACOS Project
      </div>
    </div>
  );
};

export default Dashboard;