import { useState } from 'react';
import './App.css';

export function App() {
  const [status] = useState('System Online');

  return (
    <main className="container">
      <h1>Multi-Booking Engine</h1>
      <p className="badge">Status: {status}</p>
      <div className="card">
        <h2>Booking Orchestration Client</h2>
        <p>Minimal React frontend connected to the Multi-Booking Engine API.</p>
      </div>
    </main>
  );
}

export default App;
