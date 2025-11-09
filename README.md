# 🎬 Movie Booking System - Backend

This is the **backend server** for the Movie Booking System, built with **Node.js, Express, MongoDB, and Socket.IO**.  
It handles authentication, movie management, seat reservations, bookings, cancellations, and real-time updates.

## Features:
- JWT-based authentication

- Real-time seat selection and updates with Socket.IO

- Seat reservation with automatic expiration

- Passwords are encrypted while storing them in the database

- MongoDB database for persistent storage


## To run the backend, use the following commands:

1. add an .env to the project:
```
MONGO_URI= your_mongodb_connection_string
PORT=4000
RESERVATION_MS=60000
JWT_SECRET= your_jwt_secret
```


2. to install the dependencies:
```bash
npm i
```
or if you are using yarn :
```bash
yarn
```

3. to start the server:
```bash
node index.js
```

The command will start server on port 4000.
