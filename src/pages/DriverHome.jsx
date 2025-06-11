// src/pages/DriverHome.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from '../utils/axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DriverHome = () => {
  const navigate = useNavigate();

  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // loading state
  const [pendingRides, setPendingRides] = useState([]);
  const [isFetchingRides, setIsFetchingRides] = useState(false);

  // Fetch current driver status on page load
  useEffect(() => {
    const fetchDriverStatus = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("/api/user/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setIsOnline(response.data.isOnline);
      } catch (error) {
        console.error("Error fetching driver status:", error);
        toast.error("Failed to fetch driver status");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDriverStatus();
  }, []);

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const toggleOnlineStatus = async () => {
    try {
      const response = await axios.post(
        "/api/user/driver/toggle-status",
        { isOnline: !isOnline }
      );

      setIsOnline(response.data.isOnline);
      toast.success(response.data.message);

      if (!response.data.isOnline) {
        setPendingRides([]); // clear pending rides if going offline
      }
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Failed to update status");
    }
  };

  const fetchPendingRides = async () => {
    try {
      setIsFetchingRides(true);
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/user/driver/pending-rides", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setPendingRides(response.data.data);
    } catch (error) {
      console.error("Error fetching pending rides:", error);
      toast.error(error.response?.data?.message || "Failed to fetch pending rides");
    } finally {
      setIsFetchingRides(false);
    }
  };

  const handleAcceptRide = async (userId, rideIndex) => {
    try {
      const response = await axios.post("/api/user/driver/accept-ride", {
        userId,
        rideIndex,
      });

      toast.success(response.data.message);

      // Refresh pending rides after accepting one
      fetchPendingRides();
    } catch (error) {
      console.error("Error accepting ride:", error);
      toast.error(error.response?.data?.message || "Failed to accept ride");
    }
  };

  return (
    <div>
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar />
      <style>{`
        body, html, #root {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
          font-family: Arial, sans-serif;
        }

        .background {
          height: 100vh;
          width: 100%;
          background: linear-gradient(135deg, #2193b0, #6dd5ed);
          overflow-y: auto;
        }

        .navbar {
          width: 100%;
          background-color: #0f172a;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 40px;
          box-sizing: border-box;
        }

        .logo {
          font-size: 24px;
          font-weight: bold;
        }

        .profile {
          cursor: pointer;
        }

        .profile img {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          transition: transform 0.3s ease;
        }

        .profile img:hover {
          transform: scale(1.1);
        }

        .content {
          padding: 20px;
          color: white;
          text-align: center;
        }

        .status-btn {
          padding: 10px 20px;
          background-color: #0f172a;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          margin-top: 20px;
          transition: background-color 0.3s ease;
        }

        .status-btn:hover {
          background-color: #1e293b;
        }

        .ride-card {
          background: white;
          color: #333;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 10px;
          text-align: left;
        }

        .accept-btn {
          padding: 6px 12px;
          background-color: #0f172a;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 8px;
        }

        .accept-btn:hover {
          background-color: #1e293b;
        }
      `}</style>

      <div className="background">
        <div className="navbar">
          <div className="logo">MyApp - Driver</div>
          <div className="profile" onClick={handleProfileClick}>
            <img
              src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
              alt="Profile"
            />
          </div>
        </div>

        <div className="content">
          <h1>Welcome, Driver!</h1>
          <p>This is your dashboard page after login.</p>

          {isLoading ? (
            <p>Loading your current status...</p>
          ) : (
            <>
              <p>Your current status: <strong>{isOnline ? "Online" : "Offline"}</strong></p>

              <button className="status-btn" onClick={toggleOnlineStatus}>
                {isOnline ? "Go Offline" : "Go Online"}
              </button>

              {isOnline && (
                <>
                  <button
                    className="status-btn"
                    style={{ marginTop: "10px" }}
                    onClick={fetchPendingRides}
                    disabled={isFetchingRides}
                  >
                    {isFetchingRides ? "Fetching Rides..." : "Show Pending Rides"}
                  </button>

                  <div style={{ marginTop: "20px" }}>
                    {pendingRides.length === 0 ? (
                      <p>No pending rides.</p>
                    ) : (
                      pendingRides.map((ride, index) => (
                        <div className="ride-card" key={index}>
                          <p><strong>Pickup:</strong> {ride.pickup_location.address}</p>
                          <p><strong>Dropoff:</strong> {ride.dropoff_location.address}</p>
                          <p><strong>Fare:</strong> ₹{ride.fare}</p>
                          <p><strong>Requested At:</strong> {new Date(ride.requested_at).toLocaleString()}</p>
                          <button
                            className="accept-btn"
                            onClick={() => handleAcceptRide(ride.userId, ride.rideIndex)}
                          >
                            Accept Ride
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverHome;
