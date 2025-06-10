import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "../utils/axios"; // your configured axios instance
import { toast } from "react-toastify";

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

const RideRequest = () => {
  const [pickupCoords, setPickupCoords] = useState(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [selectedDropoffCoords, setSelectedDropoffCoords] = useState(null);

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
          setPickupAddress(data.display_name);
        } catch {
          toast.error("Failed to get pickup address");
        }
      },
      () => {
        toast.error("Unable to retrieve your location");
      }
    );
  }, []);

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
        )}`
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

    if (
      !pickupAddress ||
      !dropoffAddress ||
      !pickupCoords ||
      !selectedDropoffCoords
    ) {
      toast.error("Please provide valid pickup and dropoff locations.");
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
      });

      toast.success("Ride requested successfully!");
      setDropoffAddress("");
      setSelectedDropoffCoords(null);
      setDropoffSuggestions([]);
    } catch (error) {
      toast.error("Failed to request ride. Please try again.");
      console.error(error);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto" }}>
      <h2>Request a Ride</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Pickup Location:</label>
          <input
            type="text"
            value={pickupAddress}
            readOnly
            disabled
            placeholder="Detecting your location..."
            style={{ width: "100%", marginBottom: 10 }}
          />
        </div>

        <div style={{ position: "relative" }}>
          <label>Dropoff Location:</label>
          <input
            type="text"
            value={dropoffAddress}
            onChange={handleDropoffChange}
            placeholder="Enter dropoff location"
            style={{ width: "100%", marginBottom: 0 }}
            autoComplete="off"
          />
          {dropoffSuggestions.length > 0 && (
            <ul
              style={{
                position: "absolute",
                backgroundColor: "white",
                border: "1px solid #ccc",
                maxHeight: 150,
                overflowY: "auto",
                width: "100%",
                marginTop: 0,
                paddingLeft: 0,
                listStyleType: "none",
                zIndex: 1000,
              }}
            >
              {dropoffSuggestions.map((place) => (
                <li
                  key={place.place_id}
                  onClick={() => handleDropoffSelect(place)}
                  style={{
                    padding: "5px 10px",
                    cursor: "pointer",
                  }}
                >
                  {place.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          style={{ marginTop: 15, padding: "10px 20px", cursor: "pointer" }}
        >
          Request Ride
        </button>
      </form>

      <div style={{ marginTop: 20 }}>
        <MapContainer
          center={pickupCoords || [51.505, -0.09]}
          zoom={13}
          style={{ height: 300, width: "100%" }}
          scrollWheelZoom={true}  // Enable scroll zoom
          zoomControl={true}      // Show zoom control buttons
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Dynamically set map view to pickupCoords with zoom 15 */}
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
