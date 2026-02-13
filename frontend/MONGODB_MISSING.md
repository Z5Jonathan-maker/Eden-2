# Critical Issue: MongoDB Not Installed

The backend cannot connect to the database because **MongoDB is not installed** on this machine.

## Fix Steps (Required)

1.  **Download MongoDB Community Server**:
    *   Go to: [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
    *   Download the MSI installer for Windows.

2.  **Install**:
    *   Run the installer.
    *   **IMPORTANT**: Select "Install MongoDB as a Service".
    *   **IMPORTANT**: Uncheck "Install MongoDB Compass" (optional, saves time).

3.  **Verify**:
    *   After installation, the backend should automatically connect (it retries).
    *   Or restart the backend: `Ctrl+C` then `uvicorn server:app --reload --port 8000`.

## Alternative: Use a Cloud Database (Atlas)
If you cannot install software, you can use a free MongoDB Atlas cluster:
1.  Create a free account at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2.  Create a cluster -> Connect -> Get Connection String.
3.  Update `backend/.env`:
    ```env
    MONGO_URL=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/?retryWrites=true&w=majority
    ```
