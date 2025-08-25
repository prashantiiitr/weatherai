# 🌤️ WeatherDeck — MERN Weather Dashboard

A full-stack weather dashboard that shows **current weather** and **5-day forecasts** for multiple cities.  
Built with the **MERN stack + Tailwind CSS**, powered by **OpenWeather API**, and includes **server-side caching** to minimize API calls.

---

## 🚀 Live Demo
 https://weatherforcast-zeta.vercel.app  


---

## 🛠️ Tech Stack
..............................................................

- **Frontend:** React (Vite) + Tailwind CSS  
- **Backend:** Node.js + Express.js  
- **Database:** MongoDB Atlas  
- **Weather API:** OpenWeather (Geocoding, Current Weather, Forecast)  
- **Caching:** MongoDB TTL collections to reduce API usage  

---

## ✨ Features
..............................................................

- 🌍 Search and add cities globally (autosuggest with debounce)  
- ➕ Add / ➖ Remove cities  
- 🌡️ Display current temperature, humidity, wind, pressure, conditions  
- 📅 5-day forecast tiles (daily high, description, icon)  
- 🌓 Dark/Light mode toggle (saved in localStorage)  
- ⚡ Server-side caching (configurable TTLs)  
- 🛡️ Rate-limit guard on search (cooldown middleware)  
- 📱 Responsive design for desktop & mobile  
- ♿ Accessibility improvements (`aria-live`, button labels)  

Backend Setup

cd backend
cp .env.example .env
npm install
npm run dev

Frontend Setup

cd frontend
cd .env.example .env
npm install
npm run dev

Environment Variables

MONGODB_URI=mongourixxxxx               
OPENWEATHER_API_KEY=openweatherurixxxxx
CLIENT_ORIGIN=http://localhost:5173,https://weatherforcast-zeta.vercel.app
CACHE_TTL_CURRENT=600
CACHE_TTL_FORECAST=3600
GEO_CACHE_TTL=604800
NODE_ENV=development



📡 API Documentation

GET /api/health
Returns API health status.
GET /api/search?q=<query> //Returns up to 5 cities for the query.
GET /api/cities (header: x-user-id) //Returns saved cities for the user.
POST /api/cities (header: x-user-id)
Body:
{
  "name": "Paris",
  "country": "FR",
  "state": "Ile-de-France",
  "lat": 48.8534,
  "lon": 2.3488
}
DELETE /api/cities?id=<cityId> (header: x-user-id) Removes a city.
GET /api/weather?cityId=<cityId>Returns current weather and 5-day forecast for a saved city.



🗄️ Caching Strategy


Current weather: CACHE_TTL_CURRENT (default 10 min)
Forecast: CACHE_TTL_FORECAST (default 1 hr)
Geocoding: GEO_CACHE_TTL (default 7 days)
Cached in weathercaches collection with TTL indexes


📐 Architecture

frontend/   → React + Vite + Tailwind (UI, autosuggest, dark/light)
backend/    → Express (REST API, caching, Mongo models)
└─ routes/  → /api/search, /api/cities, /api/weather
└─ models/  → City, WeatherCache
└─ middleware/ → userId, cooldown, logger
database    → MongoDB Atlas (cities + cache)


📝 Assumptions


Each user is identified with x-user-id header (no login UI in scope).
Uses OpenWeather free tier → caching reduces API calls.
Only metric units (°C) supported.


⚠️ Known Limitations


No authentication system (header-based only).
Basic cooldown guard instead of full distributed rate limiting.
Unit toggle (°C/°F) not implemented.


🚧 Future Improvements


OAuth login & per-user accounts
Redis or in-memory cache for performance
Unit toggle (°C/°F)
Charts for trends (Recharts)
Map-based city picker
Push notifications & weather alerts
Offline/PWA mode


🤖 AI Tools Used

ChatGPT for scaffolding & troubleshooting
GitHub Copilot for small refactors

### 🤖 Chatbot & AI Integration

We extended WeatherDeck with a built-in **AI Assistant** powered by the Google Gemini API:

- 🗨️ **Interactive Chatbot**: Floating assistant dock that can be opened in **Min / Half / Full screen** modes.  
- 🌓 **Adaptive UI**: Works in both light and dark themes with improved readability.  
- 🏙️ **City Management via Chat**:
  - Add a city by simply typing the city and state (country defaults to India).  
  - Delete a city the same way.  
  - No need to enter latitude/longitude manually.  
- ❓ **General Q&A**: The chatbot answers *any* question (like Gemini/ChatGPT), including technical, non-technical, and coding queries.  
- 💻 **Copy-Ready Code**: Responses that include code are rendered in **formatted blocks** with a **Copy** button, making them directly usable.  
- 🧭 **Conversation Memory**: Maintains recent history for contextual replies.  
- 🛠️ **Error Handling**: 
  - Shows clear error messages if Gemini quota is exceeded or API fails.  
  - Falls back gracefully instead of crashing.  

This integration makes WeatherDeck more than a weather dashboard — it’s now a **multi-tasking productivity app** with real-time weather data + an AI assistant.
