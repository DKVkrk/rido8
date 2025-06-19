import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import "../styles/RideRequest.css"; // Create this CSS file

// Helper component to update map view dynamically
function SetMapView({ coords, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (coords) {
      map.setView(coords, zoom);
    }
  }, [coords, zoom, map]);

  return null;
}

// Calculate distance between two coordinates in km (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
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
}

const RideRequest = () => {
  const [pickupCoords, setPickupCoords] = useState(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [selectedDropoffCoords, setSelectedDropoffCoords] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [fare, setFare] = useState(0);
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);

  // Vehicle options with base rates and per km rates
  const vehicleOptions = [
    {
      id: 1,
      name: "Standard Car",
      icon: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
      baseRate: 40,
      perKmRate: 12,
      capacity: "4 passengers",
      estimatedTime: "5-10 min"
    },
    {
      id: 2,
      name: "Premium Car",
      icon: "https://cdn-icons-png.flaticon.com/512/3079/3079021.png",
      baseRate: 60,
      perKmRate: 18,
      capacity: "4 passengers",
      estimatedTime: "5-10 min"
    },
    {
      id: 3,
      name: "Bike",
      icon: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png",
      baseRate: 20,
      perKmRate: 8,
      capacity: "1 passenger",
      estimatedTime: "3-7 min"
    },
    {
      id: 4,
      name: "SUV",
      icon: "https://cdn-icons-png.flaticon.com/512/2489/2489753.png",
      baseRate: 70,
      perKmRate: 20,
      capacity: "6 passengers",
      estimatedTime: "7-12 min"
    }
  ];

  // Custom icons for markers
  const pickupIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
    iconSize: [30, 40],
  });

  const dropoffIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
    iconSize: [30, 40],
  });

  // Get current location and reverse geocode for pickup address
  useEffect(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setPickupCoords([latitude, longitude]);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          setPickupAddress(data.display_name || "Current Location");
        } catch {
          toast.error("Failed to get pickup address");
        }
      },
      () => {
        toast.error("Unable to retrieve your location");
      }
    );
  }, []);

  // Calculate fare when pickup or dropoff changes
  useEffect(() => {
    if (pickupCoords && selectedDropoffCoords && selectedVehicle) {
      calculateFare();
    }
  }, [pickupCoords, selectedDropoffCoords, selectedVehicle]);

  // Calculate fare based on distance and vehicle type
  const calculateFare = () => {
    if (!pickupCoords || !selectedDropoffCoords || !selectedVehicle) return;

    setIsCalculatingFare(true);
    
    const distance = calculateDistance(
      pickupCoords[0],
      pickupCoords[1],
      selectedDropoffCoords[0],
      selectedDropoffCoords[1]
    );

    const selectedVehicleData = vehicleOptions.find(v => v.id === selectedVehicle);
    if (selectedVehicleData) {
      const calculatedFare = selectedVehicleData.baseRate + (distance * selectedVehicleData.perKmRate);
      setFare(Math.round(calculatedFare));
    }

    setIsCalculatingFare(false);
  };

  // Fetch dropoff suggestions from Nominatim API
  const handleDropoffChange = async (e) => {
    const query = e.target.value;
    setDropoffAddress(query);

    if (query.length < 3) {
      setDropoffSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=in&limit=5`
      );
      const data = await res.json();
      setDropoffSuggestions(data);
    } catch {
      toast.error("Failed to fetch dropoff suggestions");
    }
  };

  // When user selects a dropoff suggestion
  const handleDropoffSelect = (place) => {
    setDropoffAddress(place.display_name);
    setSelectedDropoffCoords([parseFloat(place.lat), parseFloat(place.lon)]);
    setDropoffSuggestions([]);
  };

  // Handle form submit to request ride
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!pickupAddress || !dropoffAddress || !pickupCoords || !selectedDropoffCoords) {
      toast.error("Please provide valid pickup and dropoff locations.");
      return;
    }

    if (!selectedVehicle) {
      toast.error("Please select a vehicle type.");
      return;
    }

    // Prepare data as per backend schema
    const pickup_location = {
      lat: pickupCoords[0],
      lng: pickupCoords[1],
      address: pickupAddress,
    };

    const dropoff_location = {
      lat: selectedDropoffCoords[0],
      lng: selectedDropoffCoords[1],
      address: dropoffAddress,
    };

    try {
      await axios.post("/api/user/ride/request", {
        pickup_location,
        dropoff_location,
        fare,
        vehicle_type: vehicleOptions.find(v => v.id === selectedVehicle)?.name || "Standard Car"
      });

      toast.success("Ride requested successfully!");
      setDropoffAddress("");
      setSelectedDropoffCoords(null);
      setDropoffSuggestions([]);
      setSelectedVehicle(null);
      setFare(0);
    } catch (error) {
      toast.error("Failed to request ride. Please try again.");
      console.error(error);
    }
  };

  return (
    <div className="ride-request-container">
      <div className="ride-request-form">
        <h2>Request a Ride</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Pickup Location:</label>
            <input
              type="text"
              value={pickupAddress}
              readOnly
              disabled
              placeholder="Detecting your location..."
              className="form-input"
            />
          </div>

          <div className="form-group" style={{ position: "relative" }}>
            <label>Dropoff Location:</label>
            <input
              type="text"
              value={dropoffAddress}
              onChange={handleDropoffChange}
              placeholder="Enter dropoff location"
              className="form-input"
              autoComplete="off"
            />
            {dropoffSuggestions.length > 0 && (
              <ul className="suggestions-list">
                {dropoffSuggestions.map((place) => (
                  <li
                    key={place.place_id}
                    onClick={() => handleDropoffSelect(place)}
                    className="suggestion-item"
                  >
                    {place.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="vehicle-selection">
            <h3>Choose Your Ride</h3>
            <div className="vehicle-options">
              {vehicleOptions.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className={`vehicle-option ${selectedVehicle === vehicle.id ? "selected" : ""}`}
                  onClick={() => setSelectedVehicle(vehicle.id)}
                >
                  <img src={vehicle.icon} alt={vehicle.name} className="vehicle-icon" />
                  <div className="vehicle-info">
                    <h4>{vehicle.name}</h4>
                    <p>{vehicle.capacity}</p>
                    <p>ETA: {vehicle.estimatedTime}</p>
                    {pickupCoords && selectedDropoffCoords && selectedVehicle === vehicle.id && (
                      <p className="fare">₹{fare}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="request-button"
            disabled={!selectedVehicle || isCalculatingFare}
          >
            {isCalculatingFare ? "Calculating Fare..." : "Request Ride"}
          </button>
        </form>
      </div>

      <div className="ride-request-map">
        <MapContainer
          center={pickupCoords || [20.5937, 78.9629]} // Default to India coordinates
          zoom={13}
          className="map-container"
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <SetMapView coords={pickupCoords} zoom={15} />

          {pickupCoords && (
            <Marker position={pickupCoords} icon={pickupIcon}>
              <Popup>Your Pickup Location</Popup>
            </Marker>
          )}

          {selectedDropoffCoords && (
            <Marker position={selectedDropoffCoords} icon={dropoffIcon}>
              <Popup>Dropoff Location</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default RideRequest;