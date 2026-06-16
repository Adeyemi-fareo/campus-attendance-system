import axios from 'axios';
import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './App.css';

function App() {
  const [qrData, setQrData] = useState('No QR code scanned yet');
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [statusMessage, setStatusMessage] = useState('Awaiting scan...');

  useEffect(() => {
    // This builds the scanner UI and connects it to the laptop camera
    const scanner = new Html5QrcodeScanner(
      "reader", // This links to the div with id="reader" below
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        // What happens when it successfully reads a QR code
        setQrData(decodedText);
        fetchLocation(decodedText);
        scanner.clear(); // Turns off the camera after a successful scan
      },
      (error) => {
        // We leave this empty so it doesn't spam the console while waiting for a code
      }
    );

    // Cleanup function: turns off the camera if the user closes the app
    return () => {
      scanner.clear().catch(error => console.error("Failed to clear scanner", error));
    };
  }, []);

  const fetchLocation = (scannedToken) => {
    setStatusMessage('QR Scanned! Verifying your location...');
    
    if (!navigator.geolocation) {
      setStatusMessage('Geolocation is not supported by your browser.');
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLat = position.coords.latitude;
          const currentLng = position.coords.longitude;
          
          setLocation({ lat: currentLat, lng: currentLng });
          setStatusMessage('Location verified! Sending to database...');

          // SEND DATA TO BACKEND
          axios.post('http://localhost:5000/api/attendance', {
            matric_no: 'TEST_USER_001', // We will make this dynamic later!
            qr_token: scannedToken,
            lat: currentLat,
            lng: currentLng
          })
          .then(response => {
            setStatusMessage('✅ Attendance marked successfully!');
          })
          .catch(error => {
            setStatusMessage('❌ Error: ' + (error.response?.data?.message || 'Server connection failed.'));
          });
        },
        () => {
          setStatusMessage('Location access denied. Cannot mark attendance outside the hall.');
        }
      );
    }
  };

  return (
    <div className="app-container">
      <h1>NACOS Attendance Portal</h1>
      <p className="subtitle">Scan the lecturer's QR code to mark present</p>

      {/* The scanner will automatically inject its video feed right here */}
      <div className="scanner-box" id="reader"></div>

      <div className="info-panel">
        <p><strong>QR Content:</strong> {qrData}</p>
        <p><strong>Status:</strong> {statusMessage}</p>
        {location.lat && (
          <p className="success-text">
            <strong>Your Coordinates:</strong> {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;