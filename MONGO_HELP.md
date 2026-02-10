# Manual MongoDB Setup

It seems I cannot automatically find `mongod.exe` on your system. 

## If you just installed it:
1. **Default Path**: It's usually in `C:\Program Files\MongoDB\Server\X.X\bin`.
2. **Action**: Please add this path to your System Environment Variables -> Path.

## Or run it manually:
If you know where it is, please run this in a new terminal:
```powershell
"C:\Path\To\Your\mongod.exe" --dbpath "C:\Users\HP\Documents\trae_projects\eden 2\data\db"
```
(Make sure the folder `data/db` exists first!)
