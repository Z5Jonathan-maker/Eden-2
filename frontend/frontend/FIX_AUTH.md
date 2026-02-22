# Action Required: Create Database User

The logs show **"bad auth : authentication failed"**. This confirms the user `z5jonathan_db_user` does not exist yet.

## Please look at your screenshot:

1.  Look at the **Left Sidebar** (the dark column).
2.  Under the **SECURITY** section (at the bottom left), click on **Database Access**.
    *(It is the item right above "Network Access")*
3.  On the new page, click the green button **+ Add New Database User**.
4.  Enter the details:
    *   **Username**: `z5jonathan_db_user`
    *   **Password**: `Hipposro12!`
    *   **Privileges**: "Read and write to any database"
5.  Click **Add User**.

Once you do this, the backend will automatically connect!
