// models/User.js
import mongoose from "mongoose";

// 🚗 Ride Sub-Schema (embedded inside userSchema)
const rideSchema = new mongoose.Schema(
  {
    pickup_location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true }
    },
    dropoff_location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true }
    },
    driver: {
      type: mongoose.Schema.ObjectId,
      ref: "user",
      default: null
    },
    status: {
      type: String,
      enum: ["requested", "accepted", "ongoing", "completed", "cancelled"],
      default: "requested"
    },
    fare: {
      type: Number,
      default: 0
    },
    requested_at: {
      type: Date,
      default: Date.now
    },
    completed_at: {
      type: Date,
      default: null
    }
  },
  { _id: false } // no _id for each ride subdocument (optional)
);

const userSchema = new mongoose.Schema(
  {
    // Basic Profile Info
    name: {
      type: String,
      required: [true, "Provide name"]
    },
    email: {
      type: String,
      required: [true, "Provide email"],
      unique: true
    },
    password: {
      type: String,
      required: [true, "Provide password"]
    },
    avatar: {
      type: String,
      default: ""
    },
    mobile: {
      type: Number,
      default: null
    },

    // Location Data
    current_location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },

    // Auth & Tokens
    refresh_token: {
      type: String,
      default: ""
    },
    verify_email: {
      type: Boolean,
      default: false
    },
    last_login_date: {
      type: Date,
      default: null
    },

    // Account Status
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active"
    },

    // Linked Addresses
    address_details: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "address"
      }
    ],

    // 🚗 Ride History & Upcoming Rides → Embedded Ride Schema
    ride_history: [rideSchema],
    upcoming_rides: [rideSchema],

    // Payment Options
    preferred_payment_methods: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "payment"
      }
    ],

    // Forgot Password Flow
    forgot_password_otp: {
      type: String,
      default: null
    },
    forgot_password_expiry: {
      type: Date,
      default: null
    },

    // Role
    role: {
      type: String,
      enum: ["admin", "user", "driver"],
      default: "user"
    },

    // Driver Specific Info
    vehicle_info: {
      type: String,
      default: null
    },
    license_number: {
      type: String,
      default: null
    },
    is_verified_driver: {
      type: Boolean,
      default: false
    },

    // Driver Online/Offline Toggle
    isOnline: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// ✅ Exporting as default
const UserModel = mongoose.model("User", userSchema);
export default UserModel;
