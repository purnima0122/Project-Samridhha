# Docker Setup for Project Samridhha

## Environment Variables

The services expect environment files to be present in their respective directories. Ensure you have created the following `.env` files based on their provided examples:

1. **Backend** (`backend-nest/.env`): Contains configuration for the NestJS backend (eg. JWT Token, Google OAuth) [Note: No need for data-server url and mongo url]
2. **Data Server** (`Data-Server/.env`): Contains configuration for the Python Data Server.
3. **Frontend** No need for .env here, environments initialized in docker-compose.yml
```
cp backend-nest/.env..example.docker backend-nest/.env
cp Data-Server/.env.example Data-Server/.env
```
## Starting the Application

To start the entire stack, navigate to the root directory (where `docker-compose.yml` is located) and run:

```bash
docker compose up -d --build
```

- `-d`: Runs the containers in detached mode (in the background).
- `--build`: Forces a rebuild of the Docker images. This is useful if you have recently modified any `Dockerfile` or package dependencies.

## Services Overview

The `docker-compose.yml` orchestrates the following services:

| Service | Container Name | Port | Description |
| :--- | :--- | :--- | :--- |
| **mongo** | `samridhha-mongo` | `27017` | MongoDB instance. Data is persisted using a named volume (`mongo_data`). |
| **backend** | `samridhha-backend` | `3000` | NestJS backend API. Connects to `mongo` and `data-server`. |
| **seed** | `samridhha-seed` | - | A short-lived service that seeds the MongoDB database with initial data and then exits. |
| **data-server** | `samridhha-data` | `4000` | Python-based data server. Uses local `./Data` volume. |
| **frontend** | `samridhha-frontend` | `8092` | Expo/React Native frontend. Connects to the backend and data-server. |

## Managing the Containers

**View Logs:**
To view the logs for all services:
```bash
docker compose logs -f
```
To view logs for a specific service (e.g., `backend`):
```bash
docker compose logs -f backend
```

**Stop Services:**
To stop the running containers without removing them:
```bash
docker compose stop
```

**Shut Down and Remove Containers:**
To stop the containers and remove the created networks and containers:
```bash
docker compose down
```

**Reset Data (Wipe Database):**
If you want to completely wipe your MongoDB data and start fresh, run the down command with the `-v` flag to remove the volumes:
```bash
docker compose down -v
```

## Useful Tips

- **Database Healthcheck:** The `backend` service will wait until the `mongo` service is fully healthy before it starts up.
- **Seeding:** The `seed` service runs the database seeder on startup, ensuring the necessary initial data is present for the application to function.
- **Frontend URLs:** The frontend is configured to use your local API and Data Server endpoints automatically via the `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_DATA_SERVER_URL` environment variables set in the `docker-compose.yml`.
