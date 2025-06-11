import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from '../utils/axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import io from 'socket.io-client';
import '../styles/DriverHome.css';
import { baseURL } from '../common/SummaryApi';

const DriverHome = () => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRides, setPendingRides] = useState([]);
  const [isFetchingRides, setIsFetchingRides] = useState(false);
  const [locationIntervalId, setLocationIntervalId] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [acceptedRides, setAcceptedRides] = useState([]);
  const socketRef = useRef(null);
  const userIdRef = useRef(localStorage.getItem('userId'));

  // Helper function to calculate distance between two coordinates
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }, []);

  // Function to update driver's location
  const updateDriverLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        setCurrentLocation(newLocation);
        try {
          await axios.post("/api/user/driver/update-location", {
            lat: latitude,
            lng: longitude
          });
          if (socketRef.current) {
            socketRef.current.emit('driverLocationUpdate', {
              driverId: userIdRef.current,
              location: newLocation
            });
          }
        } catch (error) {
          console.error("Error updating location:", error);
          // Don't toast error here to avoid spamming if network is flaky
        }
      },
      (error) => {
        console.error("Error getting location:", error);
        toast.error("Unable to retrieve your location");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Added maximumAge: 0 for fresh location
    );
  }, []); // useCallback dependency array is empty as it doesn't depend on external state/props

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(baseURL);
    socketRef.current = newSocket;

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // Set up socket listeners
  useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.on('connect', () => {
      console.log('Connected to WebSocket');
      if (isOnline && userIdRef.current) { // Emit driverOnline on reconnect if already online
        socketRef.current.emit('driverOnline', userIdRef.current);
      }
    });

    // Listen for new ride notifications
    socketRef.current.on('newRideAvailable', (newRideData) => {
      if (isOnline && currentLocation) {
        const distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          newRideData.pickup_location.lat,
          newRideData.pickup_location.lng
        );

        if (distance <= 5) {
          setPendingRides(prev => {
            // Check if the ride already exists to prevent duplicates from multiple notifications
            const rideExists = prev.some(ride =>
              ride.userId === newRideData.userId && ride.rideIndex === newRideData.rideIndex
            );
            if (rideExists) return prev; // Don't add if already present

            return [{
              userId: newRideData.userId,
              rideIndex: newRideData.rideIndex,
              ...newRideData,
              distance: distance.toFixed(2) + ' km'
            }, ...prev];
          });
          toast.info(`New ride available ${distance.toFixed(2)}km away`);
        }
      }
    });

    // Listen for rides accepted by other drivers
    socketRef.current.on('rideAcceptedByOther', ({ userId, rideIndex }) => {
      setPendingRides(prev => prev.filter(ride => !(ride.userId === userId && ride.rideIndex === rideIndex)));
      toast.info("A ride was accepted by another driver.");
    });

    // Clean up socket listeners
    return () => {
      socketRef.current.off('connect');
      socketRef.current.off('newRideAvailable');
      socketRef.current.off('rideAcceptedByOther');
    };
  }, [isOnline, currentLocation, calculateDistance]); // Dependencies updated

  // Fetch initial driver status and current location
  useEffect(() => {
    const fetchDriverProfile = async () => {
      try {
        const response = await axios.get("/api/user/profile");
        const { isOnline: initialIsOnline, current_location } = response.data;

        setIsOnline(initialIsOnline);
        if (current_location) {
          setCurrentLocation(current_location);
        }

        // If driver was online, start location updates and join socket room
        if (initialIsOnline) {
          updateDriverLocation(); // Initial location update
          const interval = setInterval(updateDriverLocation, 15000);
          setLocationIntervalId(interval);
          if (socketRef.current) {
            socketRef.current.emit('driverOnline', userIdRef.current);
          }
        }
      } catch (error) {
        console.error("Error fetching driver profile:", error);
        toast.error("Failed to fetch driver profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDriverProfile();
    return () => {
      if (locationIntervalId) clearInterval(locationIntervalId);
    };
  }, [updateDriverLocation, locationIntervalId]); // Dependencies updated

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      const response = await axios.post(
        "/api/user/driver/toggle-status",
        { isOnline: newStatus }
      );

      setIsOnline(newStatus);
      toast.success(response.data.message);

      if (newStatus) {
        // Start updating location every 15 seconds when online
        updateDriverLocation();
        const interval = setInterval(updateDriverLocation, 15000);
        setLocationIntervalId(interval);

        // Join driver room for real-time updates
        if (socketRef.current) {
          socketRef.current.emit('driverOnline', userIdRef.current);
        }
      } else {
        // Clear interval when going offline
        if (locationIntervalId) clearInterval(locationIntervalId);
        setLocationIntervalId(null); // Clear the interval state
        setPendingRides([]); // Clear pending rides when offline
        setAcceptedRides([]); // Clear accepted rides when offline

        // Leave driver room
        if (socketRef.current) {
          socketRef.current.emit('driverOffline', userIdRef.current);
        }
      }
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Failed to update status");
    }
  };

  const fetchPendingRides = useCallback(async () => {
    if (!isOnline) return; // Only fetch if online
    try {
      setIsFetchingRides(true);
      const response = await axios.get("/api/user/driver/pending-rides");
      // Filter out any rides that might have been accepted by another driver
      setPendingRides(response.data.data.filter(ride =>
        !acceptedRides.some(accRide => accRide.userId === ride.userId && accRide.rideIndex === ride.rideIndex)
      ));
    } catch (error) {
      console.error("Error fetching pending rides:", error);
      toast.error(error.response?.data?.message || "Failed to fetch pending rides");
    } finally {
      setIsFetchingRides(false);
    }
  }, [isOnline, acceptedRides]); // Dependencies updated

  const fetchAcceptedRides = useCallback(async () => {
    if (!isOnline) return; // Only fetch if online
    try {
      setIsFetchingRides(true);
      const response = await axios.get("/api/user/driver/accepted-rides");
      setAcceptedRides(response.data.data);
    } catch (error) {
      console.error("Error fetching accepted rides:", error);
      toast.error(error.response?.data?.message || "Failed to fetch accepted rides");
    } finally {
      setIsFetchingRides(false);
    }
  }, [isOnline]); // Dependencies updated

  // Fetch pending rides when activeTab is 'pending' and driver is online
  useEffect(() => {
    if (activeTab === 'pending' && isOnline) {
      fetchPendingRides();
    }
  }, [activeTab, isOnline, currentLocation, fetchPendingRides]); // Re-fetch if location changes to recalculate distances

  // Fetch accepted rides when activeTab is 'accepted' and driver is online
  useEffect(() => {
    if (activeTab === 'accepted' && isOnline) {
      fetchAcceptedRides();
    }
  }, [activeTab, isOnline, fetchAcceptedRides]);

  const handleAcceptRide = async (userId, rideIndex) => {
    try {
      const response = await axios.post("/api/user/driver/accept-ride", {
        userId,
        rideIndex
      });

      toast.success(response.data.message);

      // Optimistically update UI: Move ride from pending to accepted
      setPendingRides(prev => {
        const acceptedRide = prev.find(r => r.userId === userId && r.rideIndex === rideIndex);
        if (acceptedRide) {
          setAcceptedRides(prevAccepted => [{ ...acceptedRide, status: "accepted", accepted_at: new Date() }, ...prevAccepted]);
          return prev.filter(r => !(r.userId === userId && r.rideIndex === rideIndex));
        }
        return prev;
      });

      // Notify other drivers that this ride was accepted
      if (socketRef.current) {
        socketRef.current.emit('rideAccepted', { userId, rideIndex });
      }
    } catch (error) {
      console.error("Error accepting ride:", error);
      toast.error(error.response?.data?.message || "Failed to accept ride");
      // If acceptance fails, re-fetch pending rides to ensure UI consistency
      fetchPendingRides();
    }
  };

  const handleCompleteRide = async (customerId, rideIndex) => {
    try {
      const response = await axios.put("/api/user/ride/complete", {
        customerId,
        rideIndex
      });

      toast.success(response.data.message);
      // Optimistically remove from accepted rides
      setAcceptedRides(prev => prev.filter(r => !(r.userId === customerId && r.rideIndex === rideIndex)));
    } catch (error) {
      console.error("Error completing ride:", error);
      toast.error(error.response?.data?.message || "Failed to complete ride");
      // If completion fails, re-fetch accepted rides to ensure UI consistency
      fetchAcceptedRides();
    }
  };

  return (
    <div className="driver-container">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />

      {/* Header */}
      <header className="driver-header">
        <div className="header-content">
          <h1 className="app-name">RideShare Driver</h1>
          <div className="profile-section" onClick={() => navigate("/profile")}>
            <img
              src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
              alt="Profile"
              className="profile-image"
            />
            <span className="profile-name">Driver</span>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="status-bar">
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          {isOnline ? 'Online' : 'Offline'}
        </div>
        <button
          className={`status-toggle-btn ${isOnline ? 'online' : 'offline'}`}
          onClick={toggleOnlineStatus}
        >
          {isOnline ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      {/* Current Location */}
      {currentLocation && (
        <div className="location-info">
          <span className="location-icon">📍</span>
          <span className="location-text">
            {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Rides
          {pendingRides.length > 0 && (
            <span className="notification-badge">{pendingRides.length}</span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'accepted' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('accepted');
            // fetchAcceptedRides is called by the useEffect when activeTab changes
          }}
        >
          Accepted Rides
        </button>
      </div>

      {/* Content Area */}
      <main className="rides-container">
        {isLoading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading your driver dashboard...</p>
          </div>
        ) : !isOnline ? (
          <div className="offline-message">
            <h2>You're currently offline</h2>
            <p>Go online to start receiving ride requests</p>
          </div>
        ) : activeTab === 'pending' ? (
          <>
            <div className="refresh-bar">
              <button
                className="refresh-btn"
                onClick={fetchPendingRides}
                disabled={isFetchingRides}
              >
                {isFetchingRides ? (
                  <span className="refreshing">Refreshing...</span>
                ) : (
                  <>
                    <span className="refresh-icon">🔄</span>
                    Refresh Rides
                  </>
                )}
              </button>
              <span className="rides-count">{pendingRides.length} available rides</span>
            </div>

            {pendingRides.length === 0 ? (
              <div className="empty-state">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/4076/4076478.png"
                  alt="No rides"
                  className="empty-icon"
                />
                <h3>No rides available</h3>
                <p>We'll notify you when new rides come in</p>
              </div>
            ) : (
              <div className="rides-list">
                {pendingRides.map((ride) => (
                  <div className="ride-card" key={`${ride.userId}-${ride.rideIndex}`}>
                    <div className="ride-header">
                      <span className="ride-type">{ride.vehicle_type || 'Car'}</span> {/* Add default if vehicle_type is missing */}
                      <span className="ride-distance">{ride.distance}</span>
                    </div>

                    <div className="ride-details">
                      <div className="detail-row">
                        <span className="detail-label">From:</span>
                        <span className="detail-value">{ride.pickup_location.address}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">To:</span>
                        <span className="detail-value">{ride.dropoff_location.address}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Fare:</span>
                        <span className="detail-value fare-amount">₹{ride.fare}</span>
                      </div>
                    </div>

                    <div className="ride-footer">
                      <span className="ride-time">
                        {new Date(ride.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        className="accept-btn"
                        onClick={() => handleAcceptRide(ride.userId, ride.rideIndex)}
                      >
                        Accept Ride
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : ( // activeTab === 'accepted'
          <>
            {acceptedRides.length === 0 ? (
              <div className="empty-state">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/4076/4076478.png"
                  alt="No rides"
                  className="empty-icon"
                />
                <h3>No accepted rides</h3>
                <p>Accept rides from the pending tab</p>
              </div>
            ) : (
              <div className="rides-list">
                {acceptedRides.map((ride) => (
                  <div className="ride-card accepted" key={`${ride.userId}-${ride.rideIndex}`}>
                    <div className="ride-header">
                      <span className="ride-type">{ride.vehicle_type || 'Car'}</span>
                      <span className="ride-status">Accepted</span>
                    </div>

                    <div className="ride-details">
                      <div className="detail-row">
                        <span className="detail-label">From:</span>
                        <span className="detail-value">{ride.pickup_location.address}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">To:</span>
                        <span className="detail-value">{ride.dropoff_location.address}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Fare:</span>
                        <span className="detail-value fare-amount">₹{ride.fare}</span>
                      </div>
                    </div>

                    <div className="ride-footer">
                      <span className="ride-time">
                        Accepted at {new Date(ride.accepted_at || ride.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        className="complete-btn"
                        onClick={() => handleCompleteRide(ride.userId, ride.rideIndex)}
                      >
                        Complete Ride
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default DriverHome;