const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// In-memory storage
const doctorNumbers = new Map();
const authorizedPatients = new Map();

// API to update patient list
app.post('/api/update-patient-list', (req, res) => {
  const { doctorId, patientIds } = req.body;

  if (!doctorId || !Array.isArray(patientIds)) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  authorizedPatients.set(doctorId, new Set(patientIds));
  res.json({ success: true, doctorId, patientCount: patientIds.length });
});

// API to update current number
app.post('/api/update-number', (req, res) => {
  const { doctorId, currentNumber } = req.body;

  if (!doctorId || currentNumber === undefined) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  doctorNumbers.set(doctorId, currentNumber);
  io.to(`doctor-${doctorId}`).emit('numberUpdate', { doctorId, currentNumber });
  res.json({ success: true, doctorId, currentNumber });
});

// Socket connection handler
io.on('connection', (socket) => {
  const { doctorId, patientId } = socket.handshake.query;
  console.log(patientId , "connected ")

  if (!doctorId || !patientId) {
    return socket.disconnect(true);
  }

  const isAuthorized = authorizedPatients.get(doctorId)?.has(patientId);
  if (!isAuthorized) {
    return socket.disconnect(true);
  }

  socket.join(`doctor-${doctorId}`);
  const currentNumber = doctorNumbers.get(doctorId) || 0;
  socket.emit('numberUpdate', { doctorId, currentNumber });

  socket.on('disconnect', () => {
    socket.leave(`doctor-${doctorId}`);
    console.log(patientId , "disconnected ")
    
  });
});

const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});