# Setting up MongoDB Atlas

Great! You are on the right track. Since we couldn't run MongoDB locally, using the Cloud (Atlas) is a perfect solution.

## Next Steps (from your screenshot):

1.  **Click on "Drivers"** (the first option in the list).
2.  You will see a connection string that looks like this:
    `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
3.  **Copy that string**.
4.  **Paste it here** (or paste it directly into `backend/.env` as the `MONGO_URL` value).

**Important:**
*   Replace `<password>` with the database password you created earlier (NOT your MongoDB Atlas login password).
*   If you haven't created a database user yet, you might need to go back to the "Database Access" tab on the left sidebar to create one.
