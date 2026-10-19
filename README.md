# Concert booking microservices

The repository contains an API gateway, registration and login services, plus
admin and user services. Services read configuration from environment
variables. Registration and Login share the user database; Admin and User
share the concerts and bookings database. Configure them to use the same
MongoDB database if the deployment should store all collections together.

For local development, copy each service's `.env.example` to `.env` and set
`MONGODB_URI` to a reachable MongoDB connection string. Use the same `JWT_SECRET`
in Gateway, Login, User, and Admin. Keep `.env` files and real credentials out
of Git.

## Admin service

Start from `Admin_Service` after creating a `.env` file from `.env.example`:

```powershell
npm install
npm start
```

Port defaults to `5003`. Configure `MONGODB_URI` to the MongoDB database URL
and set `JWT_SECRET` to the same signing secret used by the login service.
Admin endpoints expect an admin bearer token:

| Method | Path | Request body |
| --- | --- | --- |
| GET | `/allbookings` | — |
| POST | `/createconcert` | `title`, `artist`, `venue`, `date`, `price`, `totalTickets`; optional `description` |
| DELETE | `/deleteconcert/:id` | — |
| PUT | `/updateconcert/:id` | Any concert fields listed above |

The service refuses to delete concerts that still have active bookings.
Changing `totalTickets` preserves the number of tickets already sold.

## User service

Start from `User_Service` after creating a `.env` file from `.env.example`:

```powershell
npm install
npm start
```

Port defaults to `5000`. Use the same `MONGODB_URI` and `JWT_SECRET` as the
admin service and login service. Browsing `/allconcert` is public;
`/bookticket` and `/cancelticket/:id` require a user bearer token. Booking
requests use `{ "concertId": "<concert id>", "quantity": 2 }`. Users can only
cancel bookings they own. Ticket availability is reserved atomically when
booking.

To demonstrate load balancing, run two User Service instances from separate
PowerShell terminals in `User_Service`. Start one normally on port `5000`;
start the other with `$env:PORT=5004; npm start`. Both instances must use the
same MongoDB database and JWT secret.

The gateway distributes authenticated `/user` requests between the configured
`USER_SERVICE_URLS` targets in round-robin order. Create
`APIGateway_Microservice/.env` from its `.env.example` to configure both
instances (`http://127.0.0.1:5000` and `http://127.0.0.1:5004`) and the
Registration, Login, and Admin targets. Keep `JWT_SECRET` identical across
Gateway, Login, User, and Admin services. Start the gateway on port `4000`;
its console logs show which User Service instance receives each request.

## Run with Docker Compose

Create a project-root `.env` from `.env.example`, set a private `JWT_SECRET`,
and replace the `MONGODB_URI` template with your MongoDB Atlas connection string.
Use the `concert_booking` database in the URI path and URL-encode special
characters in the database password. Compose starts the application services
and two User Service instances, which all connect to Atlas. Only the gateway is
published to the host:

```powershell
Copy-Item .env.example .env
# Edit .env and set private JWT_SECRET and MONGODB_URI values.
docker compose up --build
```

Use `http://localhost:4000` in Postman. The gateway routes between the
`user1` and `user2` containers. Do not publish MongoDB or backend ports to the
internet; on EC2, expose the gateway port required by the assignment and
restrict inbound access using the instance security group.
