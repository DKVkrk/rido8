import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import http from 'http'; // NEW: Import the http module
import { Server } from 'socket.io'; // NEW: Import the Server class from socket.io

import connectDB from './config/db.js';
import userRouter from './routes/user.route.js';

dotenv.config();

const app = express();

// --- Middleware ---
app.use(cors({
    credentials: true,
    origin: process.env.FRONTEND_URL
}));

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(helmet({
    crossOriginResourcePolicy: false
}));


// --- Server and Socket.IO Setup ---
const server = http.createServer(app); // NEW: Create an HTTP server from the Express app

const io = new Server(server, { // NEW: Create a new Socket.IO server attached to the http server
  cors: {
    origin: process.env.FRONTEND_URL, // Allow connections from your frontend
    methods: ["GET", "POST"]
  }
});

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
  console.log(`✅ WebSocket Connected: ${socket.id}`);

  // Driver comes online and joins the 'drivers' room
  socket.on('driverOnline', (driverId) => {
    console.log(`Driver ${driverId} (${socket.id}) is online and joined the 'drivers' room.`);
    socket.join('drivers');
  });

  // Driver goes offline and leaves the 'drivers' room
  socket.on('driverOffline', (driverId) => {
    console.log(`Driver ${driverId} (${socket.id}) is offline and left the 'drivers' room.`);
    socket.leave('drivers');
  });

  // Listen for driver location updates
  socket.on('driverLocationUpdate', ({ driverId, location }) => {
    // This could be broadcast to a specific customer or admin if needed
    // For now, we'll just log it.
    console.log(`Driver ${driverId} updated location:`, location);
  });

  // Listen for when a driver accepts a ride
  socket.on('rideAccepted', ({ userId, rideIndex }) => {
    console.log(`Ride (${userId}, ${rideIndex}) was accepted by driver ${socket.id}`);
    // Broadcast to all *other* drivers in the 'drivers' room that the ride is taken
    socket.to('drivers').emit('rideAcceptedByOther', { userId, rideIndex });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ WebSocket Disconnected: ${socket.id}`);
  });
});


// --- Express Routes ---
const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
    res.json({ message: "Server is running on port " + PORT });
});

app.use('/api/user', userRouter); // Your API routes are still handled by Express


// --- Start the Server ---
connectDB().then(() => {
    // CHANGED: We now listen on the 'server' object, not the 'app' object
    server.listen(PORT, () => {
        console.log("Server is running on", PORT);
        console.log(`Attempting to allow CORS for: ${process.env.FRONTEND_URL}`);
    });
});