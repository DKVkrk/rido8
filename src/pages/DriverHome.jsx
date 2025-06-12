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
  const [locationError, setLocationError] = useState(null);
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const socketRef = useRef(null);
  const userIdRef = useRef(localStorage.getItem('userId'));
  const tokenRef = useRef(localStorage.getItem('token'));
  const abortControllerRef = useRef(new AbortController());
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  // Generate truly unique keys for rides
  const generateUniqueKey = (userId, rideIndex) => {
    return `${userId}-${rideIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

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
      setLocationError("Geolocation not supported");
      return;
    }

    const handleSuccess = async (position) => {
      const { latitude, longitude } = position.coords;
      const newLocation = { lat: latitude, lng: longitude };
      setCurrentLocation(newLocation);
      setLocationError(null);

      try {
        await axios.post("/api/user/driver/update-location", {
          lat: latitude,
          lng: longitude
        }, {
          headers: {
            'Authorization': `Bearer ${tokenRef.current}`
          }
        });
        
        if (socketRef.current?.connected) {
          socketRef.current.emit('driverLocationUpdate', {
            driverId: userIdRef.current,
            location: newLocation
          });
        }
      } catch (error) {
        console.error("Error updating location:", error);
        if (error.response?.status === 401) {
          toast.error("Session expired. Please login again.");
          navigate('/login');
        }
      }
    };

    const handleError = (error) => {
      console.error("Error getting location:", error);
      setLocationError(error.message);
      if (!currentLocation) {
        toast.error(`Location error: ${error.message}`);
      }
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [currentLocation, navigate]);

  // Initialize WebSocket connection with robust reconnect logic
  const setupSocket = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    // Clean up any existing socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const newSocket = io(baseURL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      auth: {
        token: tokenRef.current
      },
      transports: ['websocket'],
      withCredentials: true
    });

    newSocket.on('connect', () => {
      if (!isMountedRef.current) return;
      console.log('Connected to WebSocket');
      setSocketStatus('connected');
      reconnectAttemptsRef.current = 0;
      
      if (isOnline && userIdRef.current) {
        newSocket.emit('driverOnline', userIdRef.current);
      }
    });

    newSocket.on('disconnect', (reason) => {
      if (!isMountedRef.current) return;
      console.log('Disconnected from WebSocket:', reason);
      setSocketStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        setTimeout(() => {
          if (isMountedRef.current) {
            newSocket.connect();
          }
        }, 1000);
      }
    });

    newSocket.on('connect_error', (error) => {
      if (!isMountedRef.current) return;
      console.error('WebSocket connection error:', error);
      setSocketStatus('error');
      reconnectAttemptsRef.current += 1;
      
      if (reconnectAttemptsRef.current <= 5) {
        setTimeout(() => {
          if (isMountedRef.current) {
            newSocket.connect();
          }
        }, Math.min(5000, reconnectAttemptsRef.current * 1000));
      }
    });

    newSocket.on('error', (error) => {
      if (!isMountedRef.current) return;
      console.error('WebSocket error:', error);
      setSocketStatus('error');
    });

    socketRef.current = newSocket;

    return () => {
      newSocket.disconnect();
    };
  }, [isOnline]);

  // Set up socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewRide = (newRideData) => {
      if (!isMountedRef.current) return;
      if (isOnline && currentLocation) {
        const distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          newRideData.pickup_location.lat,
          newRideData.pickup_location.lng
        );

        if (distance <= 5) {
          setPendingRides(prev => {
            const rideExists = prev.some(ride =>
              ride.userId === newRideData.userId && ride.rideIndex === newRideData.rideIndex
            );
            if (rideExists) return prev;

            return [{
              userId: newRideData.userId,
              rideIndex: newRideData.rideIndex,
              ...newRideData,
              distance: distance.toFixed(2) + ' km',
              uniqueKey: generateUniqueKey(newRideData.userId, newRideData.rideIndex)
            }, ...prev];
          });
          toast.info(`New ride available ${distance.toFixed(2)}km away`);
        }
      }
    };

    const handleRideAccepted = ({ userId, rideIndex }) => {
      if (!isMountedRef.current) return;
      setPendingRides(prev => prev.filter(ride => !(ride.userId === userId && ride.rideIndex === rideIndex)));
      toast.info("A ride was accepted by another driver.");
    };

    socket.on('newRideAvailable', handleNewRide);
    socket.on('rideAcceptedByOther', handleRideAccepted);

    return () => {
      socket.off('newRideAvailable', handleNewRide);
      socket.off('rideAcceptedByOther', handleRideAccepted);
    };
  }, [isOnline, currentLocation, calculateDistance]);

  // Custom isCancel function
  const isCancel = (error) => {
    return error && error.name === 'CanceledError';
  };

  // Fetch with retry logic
  const fetchWithRetry = useCallback(async (url, options = {}, retries = 3) => {
    try {
      const response = await axios.get(url, {
        ...options,
        signal: abortControllerRef.current.signal,
        headers: {
          'Authorization': `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      return response;
    } catch (error) {
      if (isCancel(error) || !isMountedRef.current) {
        throw error;
      }
      
      if (retries <= 0 || error.response?.status === 401) throw error;
      
      await new Promise(res => setTimeout(res, 1000 * (4 - retries)));
      return fetchWithRetry(url, options, retries - 1);
    }
  }, []);

  // Fetch initial driver status and setup
  useEffect(() => {
    isMountedRef.current = true;
    const fetchDriverProfile = async () => {
      try {
        const response = await fetchWithRetry("/api/user/profile");
        if (!isMountedRef.current) return;

        const { isOnline: initialIsOnline, current_location } = response.data;
        setIsOnline(initialIsOnline);
        
        if (current_location) {
          setCurrentLocation(current_location);
        }

        if (initialIsOnline) {
          updateDriverLocation();
          const interval = setInterval(updateDriverLocation, 15000);
          setLocationIntervalId(interval);
        }
      } catch (error) {
        if (!isCancel(error) && isMountedRef.current) {
          console.error("Error fetching driver profile:", error);
          if (error.response?.status === 401) {
            toast.error("Session expired. Please login again.");
            navigate('/login');
          } else {
            toast.error("Failed to fetch driver profile");
          }
        }
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };

    fetchDriverProfile();
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current.abort();
      if (locationIntervalId) clearInterval(locationIntervalId);
    };
  }, [updateDriverLocation, fetchWithRetry, navigate]);

  // Initialize socket connection when component mounts and when isOnline changes
  useEffect(() => {
    if (isMountedRef.current) {
      setupSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [setupSocket]);

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      const response = await axios.post(
        "/api/user/driver/toggle-status",
        { isOnline: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${tokenRef.current}`
          }
        }
      );

      if (!isMountedRef.current) return;
      
      setIsOnline(newStatus);
      toast.success(response.data.message);

      if (newStatus) {
        updateDriverLocation();
        const interval = setInterval(updateDriverLocation, 15000);
        setLocationIntervalId(interval);

        if (socketRef.current?.connected) {
          socketRef.current.emit('driverOnline', userIdRef.current);
        }
      } else {
        if (locationIntervalId) clearInterval(locationIntervalId);
        setLocationIntervalId(null);
        setPendingRides([]);
        setAcceptedRides([]);

        if (socketRef.current?.connected) {
          socketRef.current.emit('driverOffline', userIdRef.current);
        }
      }
    } catch (error) {
      console.error("Error toggling status:", error);
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        navigate('/login');
      } else {
        toast.error(error.response?.data?.message || "Failed to update status");
      }
    }
  };

  const fetchPendingRides = useCallback(async () => {
    if (!isOnline || !currentLocation) return;
    try {
      setIsFetchingRides(true);
      const response = await fetchWithRetry("/api/user/driver/pending-rides");
      if (!isMountedRef.current) return;

      const filteredRides = response.data.data.filter(ride =>
        !acceptedRides.some(accRide => accRide.userId === ride.userId && accRide.rideIndex === ride.rideIndex)
      ).map(ride => ({
        ...ride,
        uniqueKey: generateUniqueKey(ride.userId, ride.rideIndex)
      }));
      setPendingRides(filteredRides);
    } catch (error) {
      if (!isCancel(error) && isMountedRef.current) {
        console.error("Error fetching pending rides:", error);
        if (error.response?.status === 401) {
          toast.error("Session expired. Please login again.");
          navigate('/login');
        } else {
          toast.error(error.response?.data?.message || "Failed to fetch pending rides");
        }
      }
    } finally {
      if (isMountedRef.current) setIsFetchingRides(false);
    }
  }, [isOnline, acceptedRides, currentLocation, fetchWithRetry, navigate]);

  const fetchAcceptedRides = useCallback(async () => {
    if (!isOnline) return;
    try {
      setIsFetchingRides(true);
      const response = await fetchWithRetry("/api/user/driver/accepted-rides");
      if (!isMountedRef.current) return;

      setAcceptedRides(response.data.data.map(ride => ({
        ...ride,
        uniqueKey: generateUniqueKey(ride.userId, ride.rideIndex)
      })));
    } catch (error) {
      if (!isCancel(error) && isMountedRef.current) {
        console.error("Error fetching accepted rides:", error);
        if (error.response?.status === 401) {
          toast.error("Session expired. Please login again.");
          navigate('/login');
        } else {
          toast.error(error.response?.data?.message || "Failed to fetch accepted rides");
        }
      }
    } finally {
      if (isMountedRef.current) setIsFetchingRides(false);
    }
  }, [isOnline, fetchWithRetry, navigate]);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    if (activeTab === 'pending' && isOnline && isMountedRef.current) {
      fetchPendingRides();
    }
    return () => {
      abortControllerRef.current.abort();
    };
  }, [activeTab, isOnline, currentLocation, fetchPendingRides]);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    if (activeTab === 'accepted' && isOnline && isMountedRef.current) {
      fetchAcceptedRides();
    }
    return () => {
      abortControllerRef.current.abort();
    };
  }, [activeTab, isOnline, fetchAcceptedRides]);

  const handleAcceptRide = async (userId, rideIndex) => {
    try {
      const response = await axios.post("/api/user/driver/accept-ride", {
        userId,
        rideIndex
      }, {
        headers: {
          'Authorization': `Bearer ${tokenRef.current}`
        }
      });

      toast.success(response.data.message);

      setPendingRides(prev => {
        const acceptedRide = prev.find(r => r.userId === userId && r.rideIndex === rideIndex);
        if (acceptedRide) {
          setAcceptedRides(prevAccepted => [{ 
            ...acceptedRide, 
            status: "accepted", 
            accepted_at: new Date(),
            uniqueKey: generateUniqueKey(userId, rideIndex)
          }, ...prevAccepted]);
          return prev.filter(r => !(r.userId === userId && r.rideIndex === rideIndex));
        }
        return prev;
      });

      if (socketRef.current?.connected) {
        socketRef.current.emit('rideAccepted', { userId, rideIndex });
      }
    } catch (error) {
      console.error("Error accepting ride:", error);
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        navigate('/login');
      } else {
        toast.error(error.response?.data?.message || "Failed to accept ride");
        fetchPendingRides();
      }
    }
  };

  const handleCompleteRide = async (customerId, rideIndex) => {
    try {
      const response = await axios.put("/api/user/ride/complete", {
        customerId,
        rideIndex
      }, {
        headers: {
          'Authorization': `Bearer ${tokenRef.current}`
        }
      });

      toast.success(response.data.message);
      setAcceptedRides(prev => prev.filter(r => !(r.userId === customerId && r.rideIndex === rideIndex)));
    } catch (error) {
      console.error("Error completing ride:", error);
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        navigate('/login');
      } else {
        toast.error(error.response?.data?.message || "Failed to complete ride");
        fetchAcceptedRides();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="driver-container loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading driver information...</p>
      </div>
    );
  }

  return (
    <div className="driver-container">
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      {/* Header */}
      <header className="driver-header">
        <div className="header-content">
          <h1 className="app-name">RideShare Driver</h1>
          <div className="profile-section" onClick={() => navigate("/profile")}>
            <img
              src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
              alt="Profile"
              className="profile-image"
              loading="eager"
            />
            <span className="profile-name">Driver</span>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="connection-status">
          <span className={`status-dot ${socketStatus}`}></span>
          WebSocket: {socketStatus}
        </div>
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          {isOnline ? 'Online' : 'Offline'}
        </div>
        <button
          className={`status-toggle-btn ${isOnline ? 'online' : 'offline'}`}
          onClick={toggleOnlineStatus}
          disabled={locationError && !currentLocation}
        >
          {isOnline ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      {/* Current Location */}
      <div className="location-info">
        {currentLocation ? (
          <>
            <span className="location-icon">📍</span>
            <span className="location-text">
              {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </span>
          </>
        ) : locationError ? (
          <span className="location-error">⚠️ {locationError}</span>
        ) : (
          <span className="location-loading">Detecting location...</span>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Rides
        </button>
        <button
          className={`tab-btn ${activeTab === 'accepted' ? 'active' : ''}`}
          onClick={() => setActiveTab('accepted')}
        >
          Accepted Rides
        </button>
      </div>

      {/* Rides List */}
      <div className="rides-container">
        {isFetchingRides ? (
          <div className="loading">Loading rides...</div>
        ) : activeTab === 'pending' ? (
          pendingRides.length > 0 ? (
            <ul className="rides-list">
              {pendingRides.map((ride) => (
                <li key={ride.uniqueKey} className="ride-card">
                  <div className="ride-info">
                    <h3>Ride from {ride.pickup_location.address}</h3>
                    <p>Distance: {ride.distance}</p>
                    <p>Fare: ${ride.fare?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <button
                    className="accept-btn"
                    onClick={() => handleAcceptRide(ride.userId, ride.rideIndex)}
                  >
                    Accept Ride
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="no-rides">No pending rides available</div>
          )
        ) : acceptedRides.length > 0 ? (
          <ul className="rides-list">
            {acceptedRides.map((ride) => (
              <li key={ride.uniqueKey} className="ride-card">
                <div className="ride-info">
                  <h3>Ride to {ride.dropoff_location.address}</h3>
                  <p>Pickup: {ride.pickup_location.address}</p>
                  <p>Status: {ride.status}</p>
                  <p>Accepted: {new Date(ride.accepted_at).toLocaleTimeString()}</p>
                </div>
                <button
                  className="complete-btn"
                  onClick={() => handleCompleteRide(ride.userId, ride.rideIndex)}
                >
                  Complete Ride
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="no-rides">No accepted rides</div>
        )}
      </div>
    </div>
  );
};

export default DriverHome;