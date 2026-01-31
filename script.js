// Weather Forecast App — frontend only
// Replace with your free OpenWeatherMap API key
const API_KEY = "178fd4df0b8856d4fff0ce2766287049"; // <-- INSERT YOUR KEY

// DOM
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const geoBtn = document.getElementById('geoBtn');

const loader = document.getElementById('loader');
const errorEl = document.getElementById('error');

const currentContent = document.getElementById('currentContent');
const cityNameEl = document.getElementById('cityName');
const localTimeEl = document.getElementById('localTime');
const weatherIcon = document.getElementById('weatherIcon');
const descriptionEl = document.getElementById('description');
const tempEl = document.getElementById('temp');
const feelsEl = document.getElementById('feels');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const pressureEl = document.getElementById('pressure');

const forecastList = document.getElementById('forecastList');

const storageKey = 'weather_app_last_city';

// Helpers
function showLoader(show=true){
  loader.classList.toggle('hidden', !show);
}
function showError(msg){
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}
function hideError(){
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
}
function formatTimeFromTimestamp(ts, tzOffsetSeconds){
  // ts in seconds, tzOffset in seconds
  const local = new Date((ts + tzOffsetSeconds) * 1000);
  return local.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month:'short' });
}
function celsius(kelvinOrCelsius){
  // We will always use metric units; but ensure format
  return Math.round(kelvinOrCelsius);
}

async function fetchCurrentWeatherByCity(city){
  hideError();
  showLoader(true);
  currentContent.classList.add('hidden');
  forecastList.innerHTML = '';
  try {
    // Current weather
    const currResp = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`);
    if(!currResp.ok){
      if(currResp.status === 404) throw new Error('City not found. Check spelling.');
      throw new Error('Failed to fetch current weather.');
    }
    const curr = await currResp.json();
    // Forecast (5 day / 3 hour)
    const cityId = curr.id;
    const forecastResp = await fetch(`https://api.openweathermap.org/data/2.5/forecast?id=${cityId}&units=metric&appid=${API_KEY}`);
    if(!forecastResp.ok) throw new Error('Failed to fetch forecast.');
    const forecast = await forecastResp.json();

    renderCurrent(curr);
    renderForecast(forecast);

    // Save last search
    try { localStorage.setItem(storageKey, city); } catch(e){ /* ignore */ }
  } catch (err){
    showError(err.message || 'An error occurred.');
  } finally {
    showLoader(false);
  }
}

async function fetchByCoords(lat, lon){
  hideError();
  showLoader(true);
  currentContent.classList.add('hidden');
  forecastList.innerHTML = '';
  try {
    const currResp = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
    if(!currResp.ok) throw new Error('Failed to fetch current weather.');
    const curr = await currResp.json();

    const forecastResp = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
    if(!forecastResp.ok) throw new Error('Failed to fetch forecast.');
    const forecast = await forecastResp.json();

    renderCurrent(curr);
    renderForecast(forecast);
    try { localStorage.setItem(storageKey, curr.name); } catch(e){}
  } catch(err){
    showError(err.message || 'An error occurred.');
  } finally {
    showLoader(false);
  }
}

function renderCurrent(data){
  // data: API response for current weather
  cityNameEl.textContent = `${data.name}, ${data.sys && data.sys.country ? data.sys.country : ''}`;
  const tzOffset = data.timezone || 0; // seconds
  localTimeEl.textContent = formatTimeFromTimestamp(Math.floor(Date.now()/1000), tzOffset);
  descriptionEl.textContent = data.weather && data.weather[0] ? capitalize(data.weather[0].description) : '';
  tempEl.textContent = `${Math.round(data.main.temp)} °C`;
  feelsEl.textContent = `${Math.round(data.main.feels_like)} °C`;
  humidityEl.textContent = `${data.main.humidity}%`;
  windEl.textContent = `${data.wind.speed} m/s`;
  pressureEl.textContent = `${data.main.pressure} hPa`;
  if(data.weather && data.weather[0]){
    const icon = data.weather[0].icon;
    weatherIcon.src = `https://openweathermap.org/img/wn/${icon}@4x.png`;
    weatherIcon.alt = data.weather[0].description || 'weather icon';
  } else {
    weatherIcon.src = '';
    weatherIcon.alt = '';
  }
  currentContent.classList.remove('hidden');
}

function renderForecast(forecastData){
  // forecastData.list is an array of 3-hour predictions for 5 days
  // We'll produce a daily summary for the next 5 days (aggregate by date)
  const list = forecastData.list || [];

  // Group by date (local date string)
  const byDate = {};
  list.forEach(item => {
    // convert dt to local date at the city timezone (forecastData.city.timezone in seconds)
    const tz = forecastData.city.timezone || 0;
    const date = new Date((item.dt + tz) * 1000).toISOString().slice(0,10); // YYYY-MM-DD
    if(!byDate[date]) byDate[date] = [];
    byDate[date].push(item);
  });

  // Take entries for the next 5 distinct dates (skip today if less than 3 entries? we'll include)
  const dates = Object.keys(byDate).slice(0,6); // maybe include today + next 5
  forecastList.innerHTML = '';
  dates.forEach(dateKey => {
    const arr = byDate[dateKey];
    // compute avg temp, pick most frequent weather icon, and pick midday time item for description
    let temps = arr.map(a => a.main.temp);
    let avgTemp = Math.round(temps.reduce((s,v)=>s+v,0)/temps.length);
    // pick icon that appears most
    const iconCounts = {};
    arr.forEach(a=>{
      const ico = a.weather[0].icon;
      iconCounts[ico] = (iconCounts[ico]||0) + 1;
    });
    const topIcon = Object.entries(iconCounts).sort((a,b)=>b[1]-a[1])[0][0];
    // local readable date
    const tz = forecastData.city.timezone || 0;
    const ts = arr[Math.floor(arr.length/2)].dt;
    const displayDate = formatTimeFromTimestamp(ts, tz).split(',')[0]; // e.g., "12 Aug"
    // create element
    const item = document.createElement('div');
    item.className = 'forecast-item';
    item.innerHTML = `
      <div class="left">
        <img class="small-icon" src="https://openweathermap.org/img/wn/${topIcon}@2x.png" alt="icon">
        <div>
          <div class="muted small">${displayDate}</div>
          <div>${capitalize(arr[Math.floor(arr.length/2)].weather[0].description)}</div>
        </div>
      </div>
      <div class="right">
        <div style="font-weight:700">${avgTemp} °C</div>
      </div>
    `;
    forecastList.appendChild(item);
  });
}

// small helper
function capitalize(s=''){ return s.charAt(0).toUpperCase() + s.slice(1); }

// Event handlers
searchBtn.addEventListener('click', ()=> {
  const city = cityInput.value.trim();
  if(!city){ showError('Please enter a city name.'); return; }
  fetchCurrentWeatherByCity(city);
});

cityInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') searchBtn.click();
});

geoBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation){
    showError('Geolocation not supported by your browser.');
    return;
  }
  showLoader(true);
  navigator.geolocation.getCurrentPosition(pos=>{
    const { latitude, longitude } = pos.coords;
    fetchByCoords(latitude, longitude);
  }, err=>{
    showLoader(false);
    showError('Unable to get your location: ' + err.message);
  }, { timeout: 10000 });
});

// on load: try to load last searched city
document.addEventListener('DOMContentLoaded', ()=>{
  const last = localStorage.getItem(storageKey);
  if(last){
    cityInput.value = last;
    fetchCurrentWeatherByCity(last);
  }
});
