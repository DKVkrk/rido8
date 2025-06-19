// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import your Home component for the root path
import Home from './pages/Home';

// Import other page components
import Login from './pages/Login';
import SignupOptions from './pages/SignupOptions';
import SignupUser from './pages/SignupUser';
import SignupDriver from './pages/SignupDriver';
import ForgotPassword from './pages/forgotpassword';
import Af from './pages/aflo';
import Profile from './pages/Pro';
import DriverHome from './pages/DriverHome';
import UserHome from './pages/UserHome';
import Requestr from './pages/RideRequest';
<<<<<<< HEAD
import chatbot from './pages/chatbot';
=======
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* The root path "/" will render the Home component */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignupOptions />} />
        <Route path="/signup/user" element={<SignupUser />} />
        <Route path="/signup/driver" element={<SignupDriver />} />
        <Route path="/forgotpassword" element={<ForgotPassword />} />
        <Route path ="/af" element={<Af/>}/>
        <Route path ="/profile" element={<Profile/>}/>
        <Route path="/driver/home" element={<DriverHome />} />
       <Route path="/user/home" element={<UserHome />} /> 
       <Route path="/request-ride" element={<Requestr/>}/>
<<<<<<< HEAD
       <Route path="/chatbot" element={<chatbot />}/>
=======
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
        {/* Add other routes as needed */}
      </Routes>
    </Router>
  );
}

export default App;