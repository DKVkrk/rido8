// src/pages/Main.jsx
import React from 'react';
// import Navbar from '../components/Navbar'; // If you have a Navbar component
// import Footer from '../components/Footer'; // If you have a Footer component
// import any specific CSS for your main page if needed, e.g., '../styles/Main.css';

const Main = () => {
  return (
    <div className="main-page-container">
      {/* Example: Integrate your Navbar and Footer components here */}
      {/* <Navbar /> */}

      <header style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f0f0f0' }}>
        <h1>Welcome to RideNow!</h1>
        <p>Your journey starts here. Reliable rides, every time.</p>
      </header>

      <section style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Explore our Services</h2>
        <p>Book a ride, become a driver, or manage your trips with ease.</p>
        {/* You can add more content, links, or other components here */}
        <p><a href="/signup">Sign Up Today!</a></p>
      </section>

      {/* Example: Integrate your Footer component here */}
      {/* <Footer /> */}
    </div>
  );
};

export default Main; // <--- THIS IS CRUCIAL: It must have a default export