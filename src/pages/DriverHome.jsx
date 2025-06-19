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
    const handleProfileClick = () => {
    navigate("/profile");
  };
   
  // Generate unique keys for rides
  const generateUniqueKey = (userId, rideIndex) => {
    return `${userId}-${rideIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Calculate distance between coordinates
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Enhanced date/time formatter
  const formatDateTime = (timestamp) => {
    try {
      if (!timestamp) throw new Error('No timestamp');
      
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) throw new Error('Invalid date');
      
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return "Time not available";
    }
  };

  // Update driver location
  const updateDriverLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
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
        console.error("Location update error:", error);
        if (error.response?.status === 401) {
          toast.error("Session expired. Please login again.");
          navigate('/login');
        }
      }
    };

    const handleError = (error) => {
      console.error("Geolocation error:", error);
      setLocationError(error.message);
      if (!currentLocation) {
        toast.error(`Location error: ${error.message}`);
      }
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [currentLocation, navigate]);

  // Initialize WebSocket connection
  const setupSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

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
      auth: { token: tokenRef.current },
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
      console.log('Disconnected:', reason);
      setSocketStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        setTimeout(() => newSocket.connect(), 1000);
      }
    });

    newSocket.on('connect_error', (error) => {
      if (!isMountedRef.current) return;
      console.error('Connection error:', error);
      setSocketStatus('error');
      reconnectAttemptsRef.current += 1;
      
      if (reconnectAttemptsRef.current <= 5) {
        setTimeout(() => newSocket.connect(), Math.min(5000, reconnectAttemptsRef.current * 1000));
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

  // Socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewRide = (newRideData) => {
      if (!isMountedRef.current || !isOnline || !currentLocation) return;
      
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        newRideData.pickup_location.lat,
        newRideData.pickup_location.lng
      );

      if (distance <= 5) {
        setPendingRides(prev => {
          const exists = prev.some(r => 
            r.userId === newRideData.userId && r.rideIndex === newRideData.rideIndex
          );
          if (exists) return prev;

          return [{
            ...newRideData,
            userId: newRideData.userId,
            rideIndex: newRideData.rideIndex,
            distance: distance.toFixed(2) + ' km',
            uniqueKey: generateUniqueKey(newRideData.userId, newRideData.rideIndex),
            formattedRequestTime: formatDateTime(
              newRideData.request_time || newRideData.createdAt || newRideData.timestamp
            )
          }, ...prev];
        });
        toast.info(`New ride available ${distance.toFixed(2)}km away`);
      }
    };

    const handleRideAccepted = ({ userId, rideIndex }) => {
      if (!isMountedRef.current) return;
      setPendingRides(prev => 
        prev.filter(r => !(r.userId === userId && r.rideIndex === rideIndex))
      );
      toast.info("Ride accepted by another driver");
    };

    socket.on('newRideAvailable', handleNewRide);
    socket.on('rideAcceptedByOther', handleRideAccepted);

    return () => {
      socket.off('newRideAvailable', handleNewRide);
      socket.off('rideAcceptedByOther', handleRideAccepted);
    };
  }, [isOnline, currentLocation, calculateDistance]);

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
      if (!isMountedRef.current || isCancel(error)) throw error;
      if (retries <= 0 || error.response?.status === 401) throw error;
      
      await new Promise(res => setTimeout(res, 1000 * (4 - retries)));
      return fetchWithRetry(url, options, retries - 1);
    }
  }, []);

  // Initial setup
  useEffect(() => {
    isMountedRef.current = true;
    const fetchDriverProfile = async () => {
      try {
        const response = await fetchWithRetry("/api/user/profile");
        if (!isMountedRef.current) return;

        const { isOnline: initialIsOnline, current_location } = response.data;
        setIsOnline(initialIsOnline);
        
        if (current_location) setCurrentLocation(current_location);

        if (initialIsOnline) {
          updateDriverLocation();
          const interval = setInterval(updateDriverLocation, 15000);
          setLocationIntervalId(interval);
        }
      } catch (error) {
        if (!isCancel(error) && isMountedRef.current) {
          console.error("Profile fetch error:", error);
          if (error.response?.status === 401) {
            navigate('/login');
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

  // Socket setup
  useEffect(() => {
    if (isMountedRef.current) setupSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [setupSocket]);

  // Toggle online status
  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      const response = await axios.post(
        "/api/user/driver/toggle-status",
        { isOnline: newStatus },
        { headers: { 'Authorization': `Bearer ${tokenRef.current}` } }
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
      console.error("Status toggle error:", error);
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        toast.error(error.response?.data?.message || "Status update failed");
      }
    }
  };

  // Fetch pending rides
  const fetchPendingRides = useCallback(async () => {
    if (!isOnline || !currentLocation) return;
    try {
      setIsFetchingRides(true);
      const response = await fetchWithRetry("/api/user/driver/pending-rides");
      if (!isMountedRef.current) return;

      const filteredRides = response.data.data
        .filter(ride => !acceptedRides.some(r => 
          r.userId === ride.userId && r.rideIndex === ride.rideIndex
        ))
        .map(ride => ({
          ...ride,
          uniqueKey: generateUniqueKey(ride.userId, ride.rideIndex),
          formattedRequestTime: formatDateTime(
            ride.request_time || ride.createdAt || ride.timestamp || ride.requested_at
          )
        }));
      
      setPendingRides(filteredRides);
    } catch (error) {
      if (!isCancel(error) && isMountedRef.current) {
        console.error("Pending rides error:", error);
        if (error.response?.status === 401) {
          navigate('/login');
        } else {
          toast.error("Failed to fetch pending rides");
        }
      }
    } finally {
      if (isMountedRef.current) setIsFetchingRides(false);
    }
  }, [isOnline, acceptedRides, currentLocation, fetchWithRetry, navigate]);

  // Fetch accepted rides with proper timestamp handling
  const fetchAcceptedRides = useCallback(async () => {
    if (!isOnline) return;
    try {
      setIsFetchingRides(true);
      const response = await fetchWithRetry("/api/user/driver/accepted-rides");
      if (!isMountedRef.current) return;

      setAcceptedRides(response.data.data.map(ride => {
        // Try multiple possible timestamp fields
        const acceptedTime = ride.accepted_at || ride.acceptedAt || 
                           ride.updatedAt || ride.modified_at;
        
        return {
          ...ride,
          uniqueKey: generateUniqueKey(ride.userId, ride.rideIndex),
          formattedRequestTime: formatDateTime(
            ride.request_time || ride.createdAt || ride.timestamp || ride.requested_at
          ),
          formattedAcceptedTime: formatDateTime(acceptedTime),
          // Ensure we store the timestamp properly
          accepted_at: acceptedTime || new Date().toISOString()
        };
      }));
    } catch (error) {
      if (!isCancel(error) && isMountedRef.current) {
        console.error("Accepted rides error:", error);
        if (error.response?.status === 401) {
          navigate('/login');
        } else {
          toast.error("Failed to fetch accepted rides");
        }
      }
    } finally {
      if (isMountedRef.current) setIsFetchingRides(false);
    }
  }, [isOnline, fetchWithRetry, navigate]);

  // Fetch rides when tab changes
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    if (activeTab === 'pending' && isOnline && isMountedRef.current) {
      fetchPendingRides();
    }
    return () => abortControllerRef.current.abort();
  }, [activeTab, isOnline, currentLocation, fetchPendingRides]);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    if (activeTab === 'accepted' && isOnline && isMountedRef.current) {
      fetchAcceptedRides();
    }
    return () => abortControllerRef.current.abort();
  }, [activeTab, isOnline, fetchAcceptedRides]);

  // Accept ride handler
  const handleAcceptRide = async (userId, rideIndex) => {
    try {
      const response = await axios.post(
        "/api/user/driver/accept-ride",
        { userId, rideIndex },
        { headers: { 'Authorization': `Bearer ${tokenRef.current}` } }
      );

      toast.success(response.data.message);

      setPendingRides(prev => {
        const acceptedRide = prev.find(r => 
          r.userId === userId && r.rideIndex === rideIndex
        );
        
        if (acceptedRide) {
          const acceptedTime = new Date().toISOString();
          setAcceptedRides(prevAccepted => [{ 
            ...acceptedRide, 
            status: "accepted", 
            accepted_at: acceptedTime,
            uniqueKey: generateUniqueKey(userId, rideIndex),
            formattedAcceptedTime: formatDateTime(acceptedTime)
          }, ...prevAccepted]);
          return prev.filter(r => !(r.userId === userId && r.rideIndex === rideIndex));
        }
        return prev;
      });

      if (socketRef.current?.connected) {
        socketRef.current.emit('rideAccepted', { userId, rideIndex });
      }
    } catch (error) {
      console.error("Accept ride error:", error);
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        toast.error("Failed to accept ride");
        fetchPendingRides();
      }
    }
  };

  // Complete ride handler
  const handleCompleteRide = async (customerId, rideIndex) => {
    try {
      const response = await axios.put(
        "/api/user/ride/complete",
        { customerId, rideIndex },
        { headers: { 'Authorization': `Bearer ${tokenRef.current}` } }
      );

      toast.success(response.data.message);
      setAcceptedRides(prev => 
        prev.filter(r => !(r.userId === customerId && r.rideIndex === rideIndex))
      );
    } catch (error) {
      console.error("Complete ride error:", error);
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        toast.error("Failed to complete ride");
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
      <ToastContainer position="top-right" autoClose={3000} />

      <header className="driver-header">
        <div className="header-content">
          <h1 className="app-name">
            <span className="material-symbols-outlined">directions_car</span>
            Rideshare Driver
          </h1>
          <div className="profile" onClick={handleProfileClick}>
            <img
              src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
              alt="Profile"
              className="profile-img"
            />
          </div>
        </div>
      </header>

      <div className="status-controls">
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          {isOnline ? 'Online' : 'Offline'}
        </div>
        <button
          className={`status-toggle-btn ${isOnline ? 'online' : 'offline'}`}
          onClick={toggleOnlineStatus}
          disabled={locationError && !currentLocation}
        >
          {isOnline ? (
            <>
              <span className="material-symbols-outlined">toggle_off</span>
              Go Offline
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">toggle_on</span>
              Go Online
            </>
          )}
        </button>
      </div>

      <div className="location-info">
        {currentLocation ? (
          <>
            <span className="material-symbols-outlined location-icon">location_on</span>
            <span className="location-text">
              {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </span>
          </>
        ) : locationError ? (
          <span className="location-error">
            <span className="material-symbols-outlined">warning</span>
            {locationError}
          </span>
        ) : (
          <span className="location-loading">
            <span className="material-symbols-outlined">location_searching</span>
            Detecting location...
          </span>
        )}
      </div>

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

      <div className="rides-container">
        {isFetchingRides ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading rides...</p>
          </div>
        ) : activeTab === 'pending' ? (
          pendingRides.length > 0 ? (
            <ul className="rides-list">
              {pendingRides.map((ride) => (
                <li key={ride.uniqueKey} className="ride-card">
                  <div className="ride-info">
                    <h3>
                      <span className="material-symbols-outlined">my_location</span>
                      Ride from {ride.pickup_location.address}
                    </h3>
                    
                    <div className="ride-details">
                      <div className="location-details">
                        <div className="location-row">
                          <span className="material-symbols-outlined location-icon">location_on</span>
                          <div className="address-container">
                            <span className="detail-label">To:</span>
                            <span className="detail-value">{ride.dropoff_location.address}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ride-meta">
                        <div className="meta-item">
                          <span className="detail-label">Requested:</span>
                          <span className="time-display">
                            <span className="material-symbols-outlined">schedule</span>
                            {ride.formattedRequestTime}
                          </span>
                        </div>
                        
                        <div className="meta-item">
                          <span className="detail-label">Distance:</span>
                          <span className="meta-value">{ride.distance}</span>
                        </div>
                        
                        <div className="meta-item">
                          <span className="detail-label">Fare:</span>
                          <span className="fare-display">${ride.fare?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="action-buttons">
                      <button
                        className="action-btn accept-btn"
                        onClick={() => handleAcceptRide(ride.userId, ride.rideIndex)}
                      >
                        <span className="material-symbols-outlined">check_circle</span>
                        Accept Ride
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="no-rides">
              <span className="material-symbols-outlined">directions_car</span>
              <p>No pending rides available</p>
            </div>
          )
        ) : acceptedRides.length > 0 ? (
          <ul className="rides-list">
            {acceptedRides.map((ride) => (
              <li key={ride.uniqueKey} className="ride-card">
                <div className="ride-info">
                  <h3>
                    <span className="material-symbols-outlined">my_location</span>
                    Ride to {ride.dropoff_location.address}
                  </h3>
                  
                  <div className="ride-details">
                    <div className="location-details">
                      <div className="location-row">
                        <span className="material-symbols-outlined location-icon">location_on</span>
                        <div className="address-container">
                          <span className="detail-label">From:</span>
                          <span className="detail-value">{ride.pickup_location.address}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ride-meta">
                      <div className="meta-item">
                        <span className="detail-label">Requested:</span>
                        <span className="time-display">
                          <span className="material-symbols-outlined">schedule</span>
                          {ride.formattedRequestTime}
                        </span>
                      </div>
                      
                      <div className="meta-item">
                        <span className="detail-label">Accepted:</span>
                        <span className="time-display">
                          <span className="material-symbols-outlined">schedule</span>
                          {ride.formattedAcceptedTime}
                        </span>
                      </div>
                      
                      <div className="meta-item">
                        <span className="detail-label">Status:</span>
                        <span className="meta-value">{ride.status || 'accepted'}</span>
                      </div>
                      
                      <div className="meta-item">
                        <span className="detail-label">Fare:</span>
                        <span className="fare-display">${ride.fare?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="action-buttons">
                    <button
                      className="action-btn complete-btn"
                      onClick={() => handleCompleteRide(ride.userId, ride.rideIndex)}
                    >
                      <span className="material-symbols-outlined">done_all</span>
                      Complete Ride
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="no-rides">
            <span className="material-symbols-outlined">directions_car</span>
            <p>No accepted rides</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverHome;