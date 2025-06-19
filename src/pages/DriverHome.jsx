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
<<<<<<< HEAD
    const handleProfileClick = () => {
    navigate("/profile");
  };
   
  // Generate unique keys for rides
=======

  // Generate truly unique keys for rides
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
  const generateUniqueKey = (userId, rideIndex) => {
    return `${userId}-${rideIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

<<<<<<< HEAD
  // Calculate distance between coordinates
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371;
=======
  // Helper function to calculate distance between two coordinates
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
<<<<<<< HEAD
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
=======
    return R * c; // Distance in km
  }, []);

  // Function to update driver's location
  const updateDriverLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
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
<<<<<<< HEAD
        console.error("Location update error:", error);
=======
        console.error("Error updating location:", error);
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
        if (error.response?.status === 401) {
          toast.error("Session expired. Please login again.");
          navigate('/login');
        }
      }
    };

    const handleError = (error) => {
<<<<<<< HEAD
      console.error("Geolocation error:", error);
=======
      console.error("Error getting location:", error);
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
      setLocationError(error.message);
      if (!currentLocation) {
        toast.error(`Location error: ${error.message}`);
      }
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
<<<<<<< HEAD
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [currentLocation, navigate]);

  // Initialize WebSocket connection
  const setupSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

=======
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
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
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
<<<<<<< HEAD
      auth: { token: tokenRef.current },
=======
      auth: {
        token: tokenRef.current
      },
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
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
<<<<<<< HEAD
      console.log('Disconnected:', reason);
      setSocketStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        setTimeout(() => newSocket.connect(), 1000);
=======
      console.log('Disconnected from WebSocket:', reason);
      setSocketStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        setTimeout(() => {
          if (isMountedRef.current) {
            newSocket.connect();
          }
        }, 1000);
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
      }
    });

    newSocket.on('connect_error', (error) => {
      if (!isMountedRef.current) return;
<<<<<<< HEAD
      console.error('Connection error:', error);
=======
      console.error('WebSocket connection error:', error);
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
      setSocketStatus('error');
      reconnectAttemptsRef.current += 1;
      
      if (reconnectAttemptsRef.current <= 5) {
<<<<<<< HEAD
        setTimeout(() => newSocket.connect(), Math.min(5000, reconnectAttemptsRef.current * 1000));
=======
        setTimeout(() => {
          if (isMountedRef.current) {
            newSocket.connect();
          }
        }, Math.min(5000, reconnectAttemptsRef.current * 1000));
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
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

<<<<<<< HEAD
  // Socket listeners
=======
  // Set up socket listeners
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewRide = (newRideData) => {
<<<<<<< HEAD
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
=======
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
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
      }
    };

    const handleRideAccepted = ({ userId, rideIndex }) => {
      if (!isMountedRef.current) return;
<<<<<<< HEAD
      setPendingRides(prev => 
        prev.filter(r => !(r.userId === userId && r.rideIndex === rideIndex))
      );
      toast.info("Ride accepted by another driver");
=======
      setPendingRides(prev => prev.filter(ride => !(ride.userId === userId && ride.rideIndex === rideIndex)));
      toast.info("A ride was accepted by another driver.");
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
    };

    socket.on('newRideAvailable', handleNewRide);
    socket.on('rideAcceptedByOther', handleRideAccepted);

    return () => {
      socket.off('newRideAvailable', handleNewRide);
      socket.off('rideAcceptedByOther', handleRideAccepted);
    };
  }, [isOnline, currentLocation, calculateDistance]);

<<<<<<< HEAD
=======
  // Custom isCancel function
  const isCancel = (error) => {
    return error && error.name === 'CanceledError';
  };

>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
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
<<<<<<< HEAD
      if (!isMountedRef.current || isCancel(error)) throw error;
=======
      if (isCancel(error) || !isMountedRef.current) {
        throw error;
      }
      
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
      if (retries <= 0 || error.response?.status === 401) throw error;
      
      await new Promise(res => setTimeout(res, 1000 * (4 - retries)));
      return fetchWithRetry(url, options, retries - 1);
    }
  }, []);

<<<<<<< HEAD
  // Initial setup
=======
  // Fetch initial driver status and setup
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
  useEffect(() => {
    isMountedRef.current = true;
    const fetchDriverProfile = async () => {
      try {
        const response = await fetchWithRetry("/api/user/profile");
        if (!isMountedRef.current) return;

        const { isOnline: initialIsOnline, current_location } = response.data;
        setIsOnline(initialIsOnline);
        
<<<<<<< HEAD
        if (current_location) setCurrentLocation(current_location);
=======
        if (current_location) {
          setCurrentLocation(current_location);
        }
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2

        if (initialIsOnline) {
          updateDriverLocation();
          const interval = setInterval(updateDriverLocation, 15000);
          setLocationIntervalId(interval);
        }
      } catch (error) {
        if (!isCancel(error) && isMountedRef.current) {
<<<<<<< HEAD
          console.error("Profile fetch error:", error);
          if (error.response?.status === 401) {
            navigate('/login');
=======
          console.error("Error fetching driver profile:", error);
          if (error.response?.status === 401) {
            toast.error("Session expired. Please login again.");
            navigate('/login');
          } else {
            toast.error("Failed to fetch driver profile");
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
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

<<<<<<< HEAD
  // Socket setup
  useEffect(() => {
    if (isMountedRef.current) setupSocket();
=======
  // Initialize socket connection when component mounts and when isOnline changes
  useEffect(() => {
    if (isMountedRef.current) {
      setupSocket();
    }

>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [setupSocket]);

<<<<<<< HEAD
  // Toggle online status
=======
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      const response = await axios.post(
        "/api/user/driver/toggle-status",
        { isOnline: newStatus },
<<<<<<< HEAD
        { headers: { 'Authorization': `Bearer ${tokenRef.current}` } }
=======
        {
          headers: {
            'Authorization': `Bearer ${tokenRef.current}`
          }
        }
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
      );

      if (!isMountedRef.current) return;
      
      setIsOnline(newStatus);
      toast.success(response.data.message);

      if (newStatus) {
        updateDriverLocation();
        const interval = setInterval(updateDriverLocation, 15000);
        setLocationIntervalId(interval);
<<<<<<< HEAD
=======

>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
        if (socketRef.current?.connected) {
          socketRef.current.emit('driverOnline', userIdRef.current);
        }
      } else {
        if (locationIntervalId) clearInterval(locationIntervalId);
        setLocationIntervalId(null);
        setPendingRides([]);
        setAcceptedRides([]);
<<<<<<< HEAD
=======

>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
        if (socketRef.current?.connected) {
          socketRef.current.emit('driverOffline', userIdRef.current);
        }
      }
    } catch (error) {
<<<<<<< HEAD
      console.error("Status toggle error:", error);
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        toast.error(error.response?.data?.message || "Status update failed");
=======
      console.error("Error toggling status:", error);
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        navigate('/login');
      } else {
        toast.error(error.response?.data?.message || "Failed to update status");
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
      }
    }
  };

<<<<<<< HEAD
  // Fetch pending rides
=======
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
  const fetchPendingRides = useCallback(async () => {
    if (!isOnline || !currentLocation) return;
    try {
      setIsFetchingRides(true);
      const response = await fetchWithRetry("/api/user/driver/pending-rides");
      if (!isMountedRef.current) return;

<<<<<<< HEAD
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
=======
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
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
        }
      }
    } finally {
      if (isMountedRef.current) setIsFetchingRides(false);
    }
  }, [isOnline, acceptedRides, currentLocation, fetchWithRetry, navigate]);

<<<<<<< HEAD
  // Fetch accepted rides with proper timestamp handling
=======
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
  const fetchAcceptedRides = useCallback(async () => {
    if (!isOnline) return;
    try {
      setIsFetchingRides(true);
      const response = await fetchWithRetry("/api/user/driver/accepted-rides");
      if (!isMountedRef.current) return;

<<<<<<< HEAD
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
=======
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
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
        }
      }
    } finally {
      if (isMountedRef.current) setIsFetchingRides(false);
    }
  }, [isOnline, fetchWithRetry, navigate]);

<<<<<<< HEAD
  // Fetch rides when tab changes
=======
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    if (activeTab === 'pending' && isOnline && isMountedRef.current) {
      fetchPendingRides();
    }
<<<<<<< HEAD
    return () => abortControllerRef.current.abort();
=======
    return () => {
      abortControllerRef.current.abort();
    };
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
  }, [activeTab, isOnline, currentLocation, fetchPendingRides]);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    if (activeTab === 'accepted' && isOnline && isMountedRef.current) {
      fetchAcceptedRides();
    }
<<<<<<< HEAD
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
=======
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
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2

      toast.success(response.data.message);

      setPendingRides(prev => {
<<<<<<< HEAD
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
=======
        const acceptedRide = prev.find(r => r.userId === userId && r.rideIndex === rideIndex);
        if (acceptedRide) {
          setAcceptedRides(prevAccepted => [{ 
            ...acceptedRide, 
            status: "accepted", 
            accepted_at: new Date(),
            uniqueKey: generateUniqueKey(userId, rideIndex)
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
          }, ...prevAccepted]);
          return prev.filter(r => !(r.userId === userId && r.rideIndex === rideIndex));
        }
        return prev;
      });

      if (socketRef.current?.connected) {
        socketRef.current.emit('rideAccepted', { userId, rideIndex });
      }
    } catch (error) {
<<<<<<< HEAD
      console.error("Accept ride error:", error);
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        toast.error("Failed to accept ride");
=======
      console.error("Error accepting ride:", error);
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        navigate('/login');
      } else {
        toast.error(error.response?.data?.message || "Failed to accept ride");
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
        fetchPendingRides();
      }
    }
  };

<<<<<<< HEAD
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
=======
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
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
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

<<<<<<< HEAD
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
=======
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
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
          </div>
        </div>
      </header>

<<<<<<< HEAD
      <div className="status-controls">
=======
      {/* Status Bar */}
      <div className="status-bar">
        <div className="connection-status">
          <span className={`status-dot ${socketStatus}`}></span>
          WebSocket: {socketStatus}
        </div>
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          {isOnline ? 'Online' : 'Offline'}
        </div>
        <button
          className={`status-toggle-btn ${isOnline ? 'online' : 'offline'}`}
          onClick={toggleOnlineStatus}
          disabled={locationError && !currentLocation}
        >
<<<<<<< HEAD
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
=======
          {isOnline ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      {/* Current Location */}
      <div className="location-info">
        {currentLocation ? (
          <>
            <span className="location-icon">📍</span>
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
            <span className="location-text">
              {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </span>
          </>
        ) : locationError ? (
<<<<<<< HEAD
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

=======
          <span className="location-error">⚠️ {locationError}</span>
        ) : (
          <span className="location-loading">Detecting location...</span>
        )}
      </div>

      {/* Tabs */}
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
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

<<<<<<< HEAD
      <div className="rides-container">
        {isFetchingRides ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading rides...</p>
          </div>
=======
      {/* Rides List */}
      <div className="rides-container">
        {isFetchingRides ? (
          <div className="loading">Loading rides...</div>
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
        ) : activeTab === 'pending' ? (
          pendingRides.length > 0 ? (
            <ul className="rides-list">
              {pendingRides.map((ride) => (
                <li key={ride.uniqueKey} className="ride-card">
                  <div className="ride-info">
<<<<<<< HEAD
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
=======
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
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
                </li>
              ))}
            </ul>
          ) : (
<<<<<<< HEAD
            <div className="no-rides">
              <span className="material-symbols-outlined">directions_car</span>
              <p>No pending rides available</p>
            </div>
=======
            <div className="no-rides">No pending rides available</div>
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
          )
        ) : acceptedRides.length > 0 ? (
          <ul className="rides-list">
            {acceptedRides.map((ride) => (
              <li key={ride.uniqueKey} className="ride-card">
                <div className="ride-info">
<<<<<<< HEAD
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
=======
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
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
              </li>
            ))}
          </ul>
        ) : (
<<<<<<< HEAD
          <div className="no-rides">
            <span className="material-symbols-outlined">directions_car</span>
            <p>No accepted rides</p>
          </div>
=======
          <div className="no-rides">No accepted rides</div>
>>>>>>> 6fac3ecf179c8feeb22b400ae47a38a6054aafa2
        )}
      </div>
    </div>
  );
};

export default DriverHome;