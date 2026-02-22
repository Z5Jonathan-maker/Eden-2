# IP Address Not Whitelisted?

The error "Bad Auth" can sometimes be misleading. It might actually be that your IP address is blocked by MongoDB Atlas.

## Fix: Allow All IPs (for development)

1.  In MongoDB Atlas (left sidebar), click **Network Access**.
    *(It is right below "Database Access")*.
2.  Click the green button **+ Add IP Address**.
3.  Click the button **Allow Access From Anywhere** (or enter `0.0.0.0/0`).
4.  Click **Confirm**.

**Once the status says "Active" (it takes 1-2 minutes), tell me "Done" and I will restart the server!**
