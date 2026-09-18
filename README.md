Sour Apple Laundry Deployment
1. Repository Setup
Create a new repository on GitHub: LOrealCamelo/Sour_Apple_Laundry.
Initialize local repo: git init.
Add files: git add ..
Commit: git commit -m "Initial production release".
Push: git remote add origin https://github.com/LOrealCamelo/Sour_Apple_Laundry.git && git push -u origin main.
2. Backend Deployment (Render)
Log in to Render.com.
Select New > Web Service.
Connect your GitHub repository.
Settings:
Environment: Python 3.
Build Command: pip install -r backend/requirements.txt.
Start Command: uvicorn backend.main:app --host 0.0.0.0 --port $PORT.
Add Environment Variables:
MONGODB_URL: Your MongoDB Atlas connection string.
JWT_SECRET: A long random string.
3. Frontend Deployment (Cloudflare Pages)
Log in to Cloudflare Dashboard.
Go to Workers & Pages > Create application > Pages.
Connect GitHub and select the repo.
Settings:
Framework preset: Vite.
Build command: npm run build.
Build output directory: dist.
Environment Variable: VITE_API_URL = Your Render URL.
4. PWA Installation
The application includes a manifest.json. Once deployed to Cloudflare via HTTPS, users will see the "Add to Home Screen" prompt on mobile devices, providing a native app-like experience with the Sour Apple mascot icon.
