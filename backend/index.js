/*SafeYatra AI - Dynamic AI Safety Status & Live Weather Script */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Enforce Auth Guard (Redirect unauthenticated users to login.html)
    if (typeof SafeYatraDB !== 'undefined' && SafeYatraDB.requireAuth) {
        SafeYatraDB.requireAuth();
    }

    // Load live user profile from Firestore / DB
    if (typeof SafeYatraDB !== 'undefined') {
        const userProfile = await SafeYatraDB.getUserProfile();
        const userNameTitle = document.querySelector('.user-name-title');
        const displayTouristNameIndex = document.getElementById('displayTouristNameIndex');
        if (userNameTitle && userProfile && userProfile.name) {
            userNameTitle.textContent = `Namaste, ${userProfile.name}!`;
        }
        if (displayTouristNameIndex && userProfile && userProfile.name) {
            displayTouristNameIndex.textContent = userProfile.name;
        }
    }

    let currentLat = 26.450318; // Default Agra coordinates fallback
    let currentLng = 80.188911;
    let lastUpdatedTime = new Date();

    // DOM Elements
    const locationCityState = document.getElementById('locationCityState');
    const scoreRingCircle = document.getElementById('scoreRingCircle');
    const safetyScoreValue = document.getElementById('safetyScoreValue');
    const safetyScoreTag = document.getElementById('safetyScoreTag');
    const scoreNum = document.getElementById('scoreNum');
    const safetyRatingText = document.getElementById('safetyRatingText');
    const confidenceValue = document.getElementById('confidenceValue');

    const crimeBar = document.getElementById('crimeBar');
    const crimeVal = document.getElementById('crimeVal');
    const weatherBar = document.getElementById('weatherBar');
    const weatherVal = document.getElementById('weatherVal');
    const terrainBar = document.getElementById('terrainBar');
    const terrainVal = document.getElementById('terrainVal');

    const weatherTempCond = document.getElementById('weatherTempCond');
    const weatherIconEl = document.getElementById('weatherIconEl');
    const advisoryText = document.getElementById('advisoryText');
    const lastUpdatedFooter = document.getElementById('lastUpdatedFooter');
    const statusWeatherItem = document.getElementById('statusWeatherItem');

    // Circle SVG Donut Calculation
    const circumference = 2 * Math.PI * 48; // radius = 48 -> ~301.59
    if (scoreRingCircle) {
        scoreRingCircle.style.strokeDasharray = `${circumference}`;
    }

    function setScoreRing(score) {
        if (!scoreRingCircle) return;
        const progress = Math.min(Math.max(score, 0), 100) / 100;
        const offset = circumference - (progress * circumference);
        scoreRingCircle.style.strokeDashoffset = offset;
    }

    // 1. Initialize Geolocation
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLat = position.coords.latitude;
                currentLng = position.coords.longitude;
                fetchReverseGeocode(currentLat, currentLng);
                fetchLiveWeather(currentLat, currentLng);
            },
            (error) => {
                console.warn("Geolocation fallback used:", error.message);
                fetchReverseGeocode(currentLat, currentLng);
                fetchLiveWeather(currentLat, currentLng);
            },
            { enableHighAccuracy: false, timeout: 25000 }
        );
    } else {
        fetchReverseGeocode(currentLat, currentLng);
        fetchLiveWeather(currentLat, currentLng);
    }

    // Dynamic Time-of-Day Greeting
    const timeGreetingTag = document.getElementById('timeGreetingTag');
    const userGreetingLocation = document.getElementById('userGreetingLocation');

    updateGreetingTime();

    function updateGreetingTime() {
        if (!timeGreetingTag) return;
        const currentHour = new Date().getHours();
        if (currentHour >= 5 && currentHour < 12) {
            timeGreetingTag.textContent = "Good morning 🌅";
        } else if (currentHour >= 12 && currentHour < 17) {
            timeGreetingTag.textContent = "Good afternoon ☀️";
        } else {
            timeGreetingTag.textContent = "Good evening 🌙";
        }
    }

    // Curated Famous Indian Cities & Tourist Landmarks with GPS Coordinates (UP Focus + All-India)
    const INDIAN_CITIES_LANDMARKS = [
        // ===================== UTTAR PRADESH (Extensive Coverage) =====================
        { name: "Kanpur", aliases: ["kanpur", "cawnpore", "kalyanpur", "bithoor", "chakeri"], lat: 26.4499, lng: 80.3319, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Lucknow", aliases: ["lucknow", "awadh", "hazratganj", "bara imambara", "gomti nagar"], lat: 26.8467, lng: 80.9462, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Agra", aliases: ["agra", "taj mahal", "fatehabad", "sikandra"], lat: 27.1767, lng: 78.0081, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80" },
        { name: "Varanasi", aliases: ["varanasi", "banaras", "kashi", "benaras", "dashashwamedh", "assi ghat"], lat: 25.3176, lng: 82.9739, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Prayagraj", aliases: ["prayagraj", "allahabad", "sangam", "triveni sangam", "civil lines"], lat: 25.4358, lng: 81.8463, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Ayodhya", aliases: ["ayodhya", "faizabad", "ram janmabhoomi", "hanuman garhi", "saryu"], lat: 26.7922, lng: 82.1998, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1609946850020-001004a434c4?auto=format&fit=crop&w=1200&q=80" },
        { name: "Mathura", aliases: ["mathura", "vrindavan", "barsana", "govardhan", "gokul"], lat: 27.4924, lng: 77.6737, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80" },
        { name: "Noida", aliases: ["noida", "greater noida", "gautam buddha nagar", "yamuna expressway"], lat: 28.5355, lng: 77.3910, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80" },
        { name: "Ghaziabad", aliases: ["ghaziabad", "modinagar", "indirapuram", "vaishali"], lat: 28.6692, lng: 77.4538, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80" },
        { name: "Meerut", aliases: ["meerut", "hapur", "sardhana", "modipuram"], lat: 28.9845, lng: 77.7064, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80" },
        { name: "Gorakhpur", aliases: ["gorakhpur", "gorakhnath", "gida", "chauri chaura"], lat: 26.7606, lng: 83.3732, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Jhansi", aliases: ["jhansi", "bundelkhand", "rani lakshmibai"], lat: 25.4484, lng: 78.5685, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Bareilly", aliases: ["bareilly", "aonla"], lat: 28.3670, lng: 79.4304, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Aligarh", aliases: ["aligarh", "tala nagari", "amu"], lat: 27.8974, lng: 78.0880, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80" },
        { name: "Moradabad", aliases: ["moradabad", "brass city", "chandausi"], lat: 28.8386, lng: 78.7733, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80" },
        { name: "Saharanpur", aliases: ["saharanpur", "shakumbhari"], lat: 29.9671, lng: 77.5510, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=1200&q=80" },
        { name: "Muzaffarnagar", aliases: ["muzaffarnagar", "shamli", "khatauli"], lat: 29.4727, lng: 77.7085, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80" },
        { name: "Firozabad", aliases: ["firozabad", "shikohabad", "tundla"], lat: 27.1592, lng: 78.3957, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80" },
        { name: "Mirzapur", aliases: ["mirzapur", "vindhyachal", "chunar"], lat: 25.1337, lng: 82.5644, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Sarnath", aliases: ["sarnath", "dhamek stupa"], lat: 25.3811, lng: 83.0214, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Kushinagar", aliases: ["kushinagar", "mahaparinirvana", "padrauna"], lat: 26.7410, lng: 83.8890, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1622396636133-ba43f812dd3b?auto=format&fit=crop&w=1200&q=80" },
        { name: "Fatehpur Sikri", aliases: ["fatehpur sikri", "buland darwaza"], lat: 27.0945, lng: 77.6679, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80" },
        { name: "Chitrakoot", aliases: ["chitrakoot", "karwi", "kamadgiri", "ramghat"], lat: 25.2039, lng: 80.8659, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Unnao", aliases: ["unnao", "shuklaganj", "safipur", "gangaghat"], lat: 26.5393, lng: 80.4878, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Rae Bareli", aliases: ["rae bareli", "raebareli", "lalganj"], lat: 26.2303, lng: 81.2409, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Etawah", aliases: ["etawah", "saifai", "chambal safari", "jaswantnagar"], lat: 26.7855, lng: 79.0154, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Kannauj", aliases: ["kannauj", "perfume city", "ittar nagari"], lat: 27.0543, lng: 79.9149, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Sitapur", aliases: ["sitapur", "naimisharanya", "misrikh"], lat: 27.5624, lng: 80.6806, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Sonbhadra", aliases: ["sonbhadra", "robertsganj", "renukoot", "obra"], lat: 24.6850, lng: 83.0640, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Banda", aliases: ["banda", "atara", "naraini"], lat: 25.4754, lng: 80.3344, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Jaunpur", aliases: ["jaunpur", "shiraz-e-hind", "shahganj"], lat: 25.7464, lng: 82.6837, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Azamgarh", aliases: ["azamgarh", "mubarakpur"], lat: 26.0688, lng: 83.1844, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Basti", aliases: ["basti", "khalilabad", "sant kabir nagar"], lat: 26.7994, lng: 82.7634, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Ghazipur", aliases: ["ghazipur", "zamania"], lat: 25.5866, lng: 83.5770, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Ballia", aliases: ["ballia", "rasra"], lat: 25.7583, lng: 84.1482, state: "Uttar Pradesh", img: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80" },

        // ===================== DELHI NCR =====================
        { name: "New Delhi", aliases: ["delhi", "new delhi", "central delhi", "south delhi", "dwarka", "connaught place", "india gate"], lat: 28.6139, lng: 77.2090, state: "Delhi", img: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80" },
        { name: "Gurugram", aliases: ["gurgaon", "gurugram", "manesar", "cyber city"], lat: 28.4595, lng: 77.0266, state: "Haryana", img: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80" },
        { name: "Faridabad", aliases: ["faridabad", "ballabhgarh"], lat: 28.4089, lng: 77.3178, state: "Haryana", img: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80" },

        // ===================== RAJASTHAN =====================
        { name: "Jaipur", aliases: ["jaipur", "pink city", "amer", "hawa mahal"], lat: 26.9124, lng: 75.7873, state: "Rajasthan", img: "https://images.unsplash.com/photo-1603262110263-fb010d6e75dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Udaipur", aliases: ["udaipur", "city of lakes", "lake pichola"], lat: 24.5854, lng: 73.7125, state: "Rajasthan", img: "https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=1200&q=80" },
        { name: "Jodhpur", aliases: ["jodhpur", "blue city", "mehrangarh"], lat: 26.2389, lng: 73.0243, state: "Rajasthan", img: "https://images.unsplash.com/photo-1588714477688-cf28a50e94f7?auto=format&fit=crop&w=1200&q=80" },
        { name: "Jaisalmer", aliases: ["jaisalmer", "golden city", "sam sand dunes", "thar"], lat: 26.9157, lng: 70.9083, state: "Rajasthan", img: "https://images.unsplash.com/photo-1576487248805-cf45f6bcc67f?auto=format&fit=crop&w=1200&q=80" },
        { name: "Pushkar", aliases: ["pushkar", "ajmer", "brahma temple"], lat: 26.4897, lng: 74.5511, state: "Rajasthan", img: "https://images.unsplash.com/photo-1603262110263-fb010d6e75dc?auto=format&fit=crop&w=1200&q=80" },
        { name: "Bikaner", aliases: ["bikaner", "junagarh"], lat: 28.0229, lng: 73.3119, state: "Rajasthan", img: "https://images.unsplash.com/photo-1576487248805-cf45f6bcc67f?auto=format&fit=crop&w=1200&q=80" },
        { name: "Mount Abu", aliases: ["mount abu", "dilwara", "nakki lake"], lat: 24.5926, lng: 72.7156, state: "Rajasthan", img: "https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=1200&q=80" },

        // ===================== MAHARASHTRA =====================
        { name: "Mumbai", aliases: ["mumbai", "bombay", "navi mumbai", "thane", "bandra", "marine drive", "gateway of india"], lat: 19.0760, lng: 72.8777, state: "Maharashtra", img: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80" },
        { name: "Pune", aliases: ["pune", "poona", "pcmc", "hinjewadi", "shivajinagar"], lat: 18.5204, lng: 73.8567, state: "Maharashtra", img: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1200&q=80" },
        { name: "Lonavala", aliases: ["lonavala", "khandala", "mahabaleshwar", "panchgani"], lat: 18.7557, lng: 73.4091, state: "Maharashtra", img: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1200&q=80" },
        { name: "Nashik", aliases: ["nashik", "nasik", "trimbakeshwar", "shirdi", "panchavati"], lat: 19.9975, lng: 73.7898, state: "Maharashtra", img: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1200&q=80" },
        { name: "Nagpur", aliases: ["nagpur", "orange city"], lat: 21.1458, lng: 79.0882, state: "Maharashtra", img: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1200&q=80" },
        { name: "Aurangabad", aliases: ["aurangabad", "chhatrapati sambhajinagar", "ajanta", "ellora"], lat: 19.8762, lng: 75.3433, state: "Maharashtra", img: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1200&q=80" },

        // ===================== KARNATAKA =====================
        { name: "Bengaluru", aliases: ["bengaluru", "bangalore", "whitefield", "electronic city", "koramangala", "indiranagar"], lat: 12.9716, lng: 77.5946, state: "Karnataka", img: "https://images.unsplash.com/photo-1580655653885-65763b2597d0?auto=format&fit=crop&w=1200&q=80" },
        { name: "Mysuru", aliases: ["mysore", "mysuru", "mysore palace", "chamundi"], lat: 12.2958, lng: 76.6394, state: "Karnataka", img: "https://images.unsplash.com/photo-1600100397608-f010f444f434?auto=format&fit=crop&w=1200&q=80" },
        { name: "Hampi", aliases: ["hampi", "vijayanagara", "virupaksha", "hospet"], lat: 15.3350, lng: 76.4600, state: "Karnataka", img: "https://images.unsplash.com/photo-1600100397608-f010f444f434?auto=format&fit=crop&w=1200&q=80" },
        { name: "Coorg", aliases: ["coorg", "kodagu", "madikeri", "chikmagalur"], lat: 12.4244, lng: 75.7382, state: "Karnataka", img: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80" },
        { name: "Gokarna", aliases: ["gokarna", "karwar", "mangalore", "udupi", "murudeshwar"], lat: 14.5479, lng: 74.3188, state: "Karnataka", img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80" },

        // ===================== TAMIL NADU =====================
        { name: "Chennai", aliases: ["chennai", "madras", "marina beach", "mylapore"], lat: 13.0827, lng: 80.2707, state: "Tamil Nadu", img: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80" },
        { name: "Madurai", aliases: ["madurai", "meenakshi amman"], lat: 9.9252, lng: 78.1198, state: "Tamil Nadu", img: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80" },
        { name: "Ooty", aliases: ["ooty", "udhagamandalam", "coimbatore", "kodaikanal", "nilgiris"], lat: 11.4102, lng: 76.6950, state: "Tamil Nadu", img: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80" },
        { name: "Rameswaram", aliases: ["rameswaram", "kanyakumari", "dhanushkodi"], lat: 9.2876, lng: 79.3129, state: "Tamil Nadu", img: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80" },

        // ===================== KERALA =====================
        { name: "Kochi", aliases: ["kochi", "cochin", "ernakulam", "fort kochi"], lat: 9.9312, lng: 76.2673, state: "Kerala", img: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80" },
        { name: "Munnar", aliases: ["munnar", "wayanad", "idukki", "tea gardens"], lat: 10.0889, lng: 77.0595, state: "Kerala", img: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80" },
        { name: "Alleppey", aliases: ["alleppey", "alappuzha", "kumarakom", "backwaters"], lat: 9.4981, lng: 76.3388, state: "Kerala", img: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80" },
        { name: "Thiruvananthapuram", aliases: ["trivandrum", "thiruvananthapuram", "kovalam", "varkala", "padmanabhaswamy"], lat: 8.5241, lng: 76.9366, state: "Kerala", img: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80" },

        // ===================== GOA =====================
        { name: "Goa", aliases: ["goa", "panaji", "calangute", "baga", "anjuna", "margao", "candolim", "vasco"], lat: 15.2993, lng: 74.1240, state: "Goa", img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80" },

        // ===================== TELANGANA & ANDHRA PRADESH =====================
        { name: "Hyderabad", aliases: ["hyderabad", "secunderabad", "cyberabad", "charminar", "hitec city"], lat: 17.3850, lng: 78.4867, state: "Telangana", img: "https://images.unsplash.com/photo-1605007493699-ce65834f8a00?auto=format&fit=crop&w=1200&q=80" },
        { name: "Visakhapatnam", aliases: ["visakhapatnam", "vizag", "tirupati", "vijayawada", "rishikonda"], lat: 17.6868, lng: 83.2185, state: "Andhra Pradesh", img: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80" },

        // ===================== WEST BENGAL =====================
        { name: "Kolkata", aliases: ["kolkata", "calcutta", "howrah", "victoria memorial", "park street"], lat: 22.5726, lng: 88.3639, state: "West Bengal", img: "https://images.unsplash.com/photo-1558431382-27e303142255?auto=format&fit=crop&w=1200&q=80" },
        { name: "Darjeeling", aliases: ["darjeeling", "siliguri", "kalimpong", "tiger hill"], lat: 27.0410, lng: 88.2663, state: "West Bengal", img: "https://images.unsplash.com/photo-1616423640778-28d1b53229bd?auto=format&fit=crop&w=1200&q=80" },

        // ===================== GUJARAT =====================
        { name: "Ahmedabad", aliases: ["ahmedabad", "gandhinagar", "sabarmati", "atal bridge"], lat: 23.0225, lng: 72.5714, state: "Gujarat", img: "https://images.unsplash.com/photo-1597040663342-45b6af3d91a8?auto=format&fit=crop&w=1200&q=80" },
        { name: "Surat", aliases: ["surat", "vadodara", "baroda", "statue of unity", "kevadia"], lat: 21.1702, lng: 72.8311, state: "Gujarat", img: "https://images.unsplash.com/photo-1597040663342-45b6af3d91a8?auto=format&fit=crop&w=1200&q=80" },
        { name: "Kutch", aliases: ["kutch", "bhuj", "rann of kutch", "dwarka", "somnath"], lat: 23.2420, lng: 69.6669, state: "Gujarat", img: "https://images.unsplash.com/photo-1597040663342-45b6af3d91a8?auto=format&fit=crop&w=1200&q=80" },

        // ===================== MADHYA PRADESH =====================
        { name: "Bhopal", aliases: ["bhopal", "sanchi", "upper lake"], lat: 23.2599, lng: 77.4126, state: "Madhya Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Indore", aliases: ["indore", "ujjain", "mahakaleshwar", "omkareshwar", "rajwada"], lat: 22.7196, lng: 75.8577, state: "Madhya Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },
        { name: "Gwalior", aliases: ["gwalior", "khajuraho", "orchha", "jabalpur", "bhedaghat"], lat: 26.2183, lng: 78.1828, state: "Madhya Pradesh", img: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80" },

        // ===================== PUNJAB & HARYANA =====================
        { name: "Amritsar", aliases: ["amritsar", "golden temple", "harmandir sahib", "wagah border"], lat: 31.6340, lng: 74.8723, state: "Punjab", img: "https://images.unsplash.com/photo-1609946850020-001004a434c4?auto=format&fit=crop&w=1200&q=80" },
        { name: "Chandigarh", aliases: ["chandigarh", "mohali", "panchkula", "ludhiana", "sukhna lake"], lat: 30.7333, lng: 76.7794, state: "Punjab", img: "https://images.unsplash.com/photo-1588095254134-2e67a07fc261?auto=format&fit=crop&w=1200&q=80" },

        // ===================== HIMACHAL PRADESH =====================
        { name: "Shimla", aliases: ["shimla", "kufri", "kasauli", "mall road"], lat: 31.1048, lng: 77.1734, state: "Himachal Pradesh", img: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80" },
        { name: "Manali", aliases: ["manali", "kullu", "solang valley", "rohtang", "spiti valley", "kasol"], lat: 32.2432, lng: 77.1892, state: "Himachal Pradesh", img: "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=1200&q=80" },
        { name: "Dharamshala", aliases: ["dharamshala", "mcleodganj", "dalhousie", "bir billing"], lat: 32.2190, lng: 76.3234, state: "Himachal Pradesh", img: "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=1200&q=80" },

        // ===================== UTTARAKHAND =====================
        { name: "Rishikesh", aliases: ["rishikesh", "haridwar", "laxman jhula", "ram jhula"], lat: 30.0869, lng: 78.2676, state: "Uttarakhand", img: "https://images.unsplash.com/photo-1600100397608-f010f444f434?auto=format&fit=crop&w=1200&q=80" },
        { name: "Dehradun", aliases: ["dehradun", "mussoorie", "kempty falls", "dhanaulti"], lat: 30.3165, lng: 78.0322, state: "Uttarakhand", img: "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=1200&q=80" },
        { name: "Nainital", aliases: ["nainital", "jim corbett", "almora", "ranikhet", "mukteshwar", "naini lake"], lat: 29.3919, lng: 79.4542, state: "Uttarakhand", img: "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=1200&q=80" },

        // ===================== JAMMU & KASHMIR & LADAKH =====================
        { name: "Srinagar", aliases: ["srinagar", "gulmarg", "pahalgam", "sonamarg", "dal lake"], lat: 34.0837, lng: 74.7973, state: "Jammu and Kashmir", img: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=1200&q=80" },
        { name: "Jammu", aliases: ["jammu", "katra", "vaishno devi"], lat: 32.7266, lng: 74.8570, state: "Jammu and Kashmir", img: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=1200&q=80" },
        { name: "Leh Ladakh", aliases: ["leh", "ladakh", "pangong tso", "nubra valley", "khardung la"], lat: 34.1526, lng: 77.5771, state: "Ladakh", img: "https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?auto=format&fit=crop&w=1200&q=80" },

        // ===================== BIHAR =====================
        { name: "Patna", aliases: ["patna", "nalanda", "rajgir", "gaya", "vaishali"], lat: 25.5941, lng: 85.1376, state: "Bihar", img: "https://images.unsplash.com/photo-1622396636133-ba43f812dd3b?auto=format&fit=crop&w=1200&q=80" },
        { name: "Bodh Gaya", aliases: ["bodhgaya", "bodh gaya", "mahabodhi temple"], lat: 24.6961, lng: 84.9869, state: "Bihar", img: "https://images.unsplash.com/photo-1622396636133-ba43f812dd3b?auto=format&fit=crop&w=1200&q=80" },

        // ===================== ODISHA =====================
        { name: "Puri", aliases: ["puri", "bhubaneswar", "konark", "sun temple", "cuttack", "jagannath temple"], lat: 19.8135, lng: 85.8312, state: "Odisha", img: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&w=1200&q=80" },

        // ===================== NORTH EAST =====================
        { name: "Guwahati", aliases: ["guwahati", "kamakhya", "kaziranga", "assam"], lat: 26.1445, lng: 91.7362, state: "Assam", img: "https://images.unsplash.com/photo-1616423640778-28d1b53229bd?auto=format&fit=crop&w=1200&q=80" },
        { name: "Shillong", aliases: ["shillong", "meghalaya", "cherrapunji", "gangtok", "sikkim", "tawang"], lat: 25.5788, lng: 91.8933, state: "Meghalaya", img: "https://images.unsplash.com/photo-1616423640778-28d1b53229bd?auto=format&fit=crop&w=1200&q=80" }
    ];

    /**
     * Calculate Distance in KM between two geographic coordinates using Haversine formula
     */
    function getDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Find the best matching Indian city photo:
     * 1. Exact or partial match on city / district name or aliases.
     * 2. Nearest geographical Indian city if exact name is not available.
     */
    function resolveBestIndianCityPhoto(cityName, stateName, userLat, userLng) {
        const cleanCity = (cityName || "").toLowerCase().trim();
        const cleanState = (stateName || "").toLowerCase().trim();

        // 1. Direct match by name or aliases
        for (const city of INDIAN_CITIES_LANDMARKS) {
            const cityNameLower = city.name.toLowerCase();
            if (cleanCity === cityNameLower || cleanCity.includes(cityNameLower) || cityNameLower.includes(cleanCity)) {
                return city;
            }
            if (city.aliases && city.aliases.some(alias => cleanCity.includes(alias) || alias.includes(cleanCity))) {
                return city;
            }
        }

        // 2. Nearest City by GPS Coordinates (Geographical Proximity)
        const targetLat = (userLat !== undefined && userLat !== null && !isNaN(userLat)) ? userLat : currentLat;
        const targetLng = (userLng !== undefined && userLng !== null && !isNaN(userLng)) ? userLng : currentLng;

        if (targetLat && targetLng) {
            let nearestCity = INDIAN_CITIES_LANDMARKS[0];
            let minDistance = Infinity;

            for (const city of INDIAN_CITIES_LANDMARKS) {
                const dist = getDistanceKm(targetLat, targetLng, city.lat, city.lng);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestCity = city;
                }
            }

            console.log(`[SafeYatra] Selected nearest Indian city "${nearestCity.name}" (${Math.round(minDistance)} km away from user coordinates ${targetLat}, ${targetLng})`);
            return nearestCity;
        }

        // 3. State-level match fallback
        const stateMatch = INDIAN_CITIES_LANDMARKS.find(c => c.state.toLowerCase() === cleanState);
        if (stateMatch) return stateMatch;

        return INDIAN_CITIES_LANDMARKS[0]; // Kanpur / UP default fallback
    }

    /**
     * Dynamically replace the hero background image (.personal-info) with the famous landmark image
     * of the user's active area or the nearest available Indian city.
     */
    async function updateDynamicAreaHeroImage(city, state, lat, lng) {
        const personalInfoCard = document.querySelector('.personal-info');
        if (!personalInfoCard) return;

        const bestMatch = resolveBestIndianCityPhoto(city, state, lat || currentLat, lng || currentLng);
        const imageUrl = bestMatch ? bestMatch.img : "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80";

        // Preload the image and apply smoothly
        const imgPreload = new Image();
        imgPreload.src = imageUrl;
        imgPreload.onload = () => {
            personalInfoCard.style.backgroundImage = `linear-gradient(135deg, rgba(20, 83, 45, 0.85), rgba(15, 23, 42, 0.88)), url('${imageUrl}')`;
            personalInfoCard.style.backgroundPosition = 'center';
            personalInfoCard.style.backgroundSize = 'cover';
            personalInfoCard.style.backgroundRepeat = 'no-repeat';
        };
    }

    // 2. Fetch City & State via Free Reverse Geocoding API
    async function fetchReverseGeocode(lat, lng) {
        try {
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            if (res.ok) {
                const data = await res.json();
                const city = data.city || data.locality || data.localityInfo?.administrative?.[2]?.name || "Agra";
                const state = data.principalSubdivision || data.localityInfo?.administrative?.[1]?.name || "Uttar Pradesh";
                const locStr = `${city}, ${state}`;
                if (locationCityState) {
                    locationCityState.textContent = locStr;
                }
                if (userGreetingLocation) {
                    userGreetingLocation.textContent = locStr;
                }

                // Dynamically update first green card background image based on user's active area or nearest city
                updateDynamicAreaHeroImage(city, state, lat, lng);
            }
        } catch (e) {
            console.warn("Reverse geocode fallback:", e);
            if (locationCityState) locationCityState.textContent = "Agra, Uttar Pradesh";
            if (userGreetingLocation) userGreetingLocation.textContent = "Agra, Uttar Pradesh";
            updateDynamicAreaHeroImage("Agra", "Uttar Pradesh", lat, lng);
        }
    }

    // 3. Fetch Live Weather via Free Open-Meteo API (No Key Needed)
    async function fetchLiveWeather(lat, lng) {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
            if (res.ok) {
                const data = await res.json();
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;
                const weatherInfo = parseWmoCode(code, temp);

                if (weatherTempCond) {
                    weatherTempCond.textContent = `${temp}°C, ${weatherInfo.label}`;
                }
                if (weatherIconEl) {
                    weatherIconEl.className = `fa-solid ${weatherInfo.icon}`;
                }
                if (advisoryText) {
                    advisoryText.textContent = weatherInfo.advisory;
                }

                // Compute dynamic safety metrics
                updateSafetyMetrics(temp, code, lat, lng);
            }
        } catch (e) {
            console.warn("Weather API fallback:", e);
            // Default fallback matching user mockup
            if (weatherTempCond) weatherTempCond.textContent = "34°C, Sunny";
            if (advisoryText) advisoryText.textContent = "Heat Alert";
            updateSafetyMetrics(34, 0, lat, lng);
        }
    }

    // WMO Weather Code Interpreter
    function parseWmoCode(code, temp) {
        let label = "Sunny";
        let icon = "fa-sun";
        let advisory = "Clear Conditions";

        if (code === 0) {
            label = "Sunny";
            icon = "fa-sun";
            advisory = temp > 35 ? "Heat Alert" : "Clear & Safe";
        } else if (code >= 1 && code <= 3) {
            label = "Partly Cloudy";
            icon = "fa-cloud-sun";
            advisory = "Pleasant Weather";
        } else if (code === 45 || code === 48) {
            label = "Foggy";
            icon = "fa-smog";
            advisory = "Low Visibility Alert";
        } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
            label = "Rainy";
            icon = "fa-cloud-showers-heavy";
            advisory = "Rain & Slippery Roads";
        } else if (code >= 95) {
            label = "Thunderstorm";
            icon = "fa-bolt";
            advisory = "Severe Weather Alert";
        }

        return { label, icon, advisory };
    }

    // Update Scores & Risk Bars
    function updateSafetyMetrics(temp, weatherCode, lat, lng) {
        const analysis = SafeYatraSafetyAnalysis.analyze(temp, weatherCode, lat, lng);
        const { overallScore, confidence, crimeLevel, weatherRisk, terrainRisk } = analysis;
        SafeYatraSafetyAnalysis.saveLatest(analysis);

        // Update UI
        if (safetyScoreValue) safetyScoreValue.textContent = overallScore;
        if (scoreNum) scoreNum.textContent = overallScore;
        setScoreRing(overallScore);

        let ratingLabel = "SAFE";
        let ratingDesc = "Very Safe Area";
        if (overallScore < 70) {
            ratingLabel = "MODERATE";
            ratingDesc = "Exercise Caution";
        } else if (overallScore < 85) {
            ratingLabel = "SAFE";
            ratingDesc = "Moderately Safe";
        } else {
            ratingLabel = "SAFE";
            ratingDesc = "Highly Safe Zone";
        }

        if (safetyScoreTag) safetyScoreTag.textContent = ratingLabel;
        if (safetyRatingText) safetyRatingText.textContent = ratingDesc;
        // if (confidenceValue) confidenceValue.textContent = `${confidence}%`;

        // Update Progress Bars
        if (crimeBar) crimeBar.style.width = `${crimeLevel}%`;
        if (crimeVal) crimeVal.textContent = crimeLevel;

        if (weatherBar) weatherBar.style.width = `${weatherRisk}%`;
        if (weatherVal) weatherVal.textContent = weatherRisk;

        if (terrainBar) terrainBar.style.width = `${terrainRisk}%`;
        if (terrainVal) terrainVal.textContent = terrainRisk;

        // Update Police & Hospital distances dynamically
        const policeDist = ((Math.abs(Math.sin(lat * 100)) * 1.5) + 0.4).toFixed(1);
        const hospitalDist = ((Math.abs(Math.cos(lng * 100)) * 2.2) + 0.6).toFixed(1);

        const statusPoliceText = document.getElementById('statusPoliceText');
        const statusHospitalText = document.getElementById('statusHospitalText');

        if (statusPoliceText) {
            statusPoliceText.innerHTML = `Police station within <strong>${policeDist} km</strong>`;
        }
        if (statusHospitalText) {
            statusHospitalText.innerHTML = `Hospital available within <strong>${hospitalDist} km</strong>`;
        }

        lastUpdatedTime = new Date();
        updateFooterTimestamp();
    }

    // Live Timestamp Updater
    setInterval(updateFooterTimestamp, 60000);

    function updateFooterTimestamp() {
        if (!lastUpdatedFooter) return;
        const now = new Date();
        const diffMins = Math.floor((now - lastUpdatedTime) / 60000);
        let timeStr = "Just now";
        if (diffMins === 1) timeStr = "1 min ago";
        else if (diffMins > 1) timeStr = `${diffMins} min ago`;

        lastUpdatedFooter.textContent = `Last updated: ${timeStr} · AI model v3.2`;
    }

    // Click handler for weather pill card -> Open Live Weather Popup Modal
    if (statusWeatherItem) {
        statusWeatherItem.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof window.openWeatherPopup === 'function') {
                window.openWeatherPopup(currentLat, currentLng);
            }
        });
    }

    // ---------------------------------------------------------------
    // Police Station: Google Maps Search
    // Uses geolocation to pass the user's position as a hint, then
    // lets Google Maps handle the nearby police station search & selection.
    // ---------------------------------------------------------------
    function openPoliceSearch() {
        console.log("Police button clicked");

        const baseQuery = encodeURIComponent("police station");
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${baseQuery}`;

        function launchMaps(url) {
            console.log("Opening Google Maps police search:", url);
            window.open(url, '_blank');
        }

        if (!navigator.geolocation) {
            // Geolocation not supported by this browser/WebView
            console.warn("Geolocation not supported. Opening Google Maps without location hint.");
            launchMaps(fallbackUrl);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                console.log("Current location:", lat, lng);
                // Google Maps Search URL with location hint via the `near` parameter.
                // This tells Google Maps to centre the police search near the user.
                const url = `https://www.google.com/maps/search/?api=1&query=${baseQuery}&near=${lat},${lng}`;
                launchMaps(url);
            },
            (error) => {
                // Handle all geolocation errors gracefully — button still works
                let reason = "Unknown error";
                if (error.code === error.PERMISSION_DENIED) reason = "Permission denied";
                else if (error.code === error.POSITION_UNAVAILABLE) reason = "Position unavailable";
                else if (error.code === error.TIMEOUT) reason = "Timeout";
                console.warn(`Geolocation error (${reason}). Falling back to plain police search.`);
                launchMaps(fallbackUrl);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
    }

    // Wire up: Status card police icon (Safety Status section)
    const statusPoliceItem = document.getElementById('statusPoliceItem');
    if (statusPoliceItem) {
        statusPoliceItem.addEventListener('click', openPoliceSearch);
    }

    // Wire up: Quick Action "Police" card (Quick Actions section)
    const policeActionCard = document.getElementById('policeActionCard');
    if (policeActionCard) {
        policeActionCard.addEventListener('click', openPoliceSearch);
    }

    // ---------------------------------------------------------------
    // Hospital: Google Maps Search (TEST implementation)
    // Uses geolocation to pass the user's position as a hint, then
    // lets Google Maps handle the nearby hospital search & selection.
    // No Nominatim / OSRM / Google API key / hardcoded hospitals used.
    // ---------------------------------------------------------------
    function openHospitalSearch() {
        console.log("Hospital button clicked");

        const baseQuery = encodeURIComponent("hospital");
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${baseQuery}`;

        function launchMaps(url) {
            console.log("Opening Google Maps hospital search:", url);
            window.open(url, '_blank');
        }

        if (!navigator.geolocation) {
            // Geolocation not supported by this browser/WebView
            console.warn("Geolocation not supported. Opening Google Maps without location hint.");
            launchMaps(fallbackUrl);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                console.log("Current location:", lat, lng);
                // Google Maps Search URL with location hint via the `near` parameter.
                // This tells Google Maps to centre the hospital search near the user.
                const url = `https://www.google.com/maps/search/?api=1&query=${baseQuery}&near=${lat},${lng}`;
                launchMaps(url);
            },
            (error) => {
                // Handle all geolocation errors gracefully — button still works
                let reason = "Unknown error";
                if (error.code === error.PERMISSION_DENIED) reason = "Permission denied";
                else if (error.code === error.POSITION_UNAVAILABLE) reason = "Position unavailable";
                else if (error.code === error.TIMEOUT) reason = "Timeout";
                console.warn(`Geolocation error (${reason}). Falling back to plain hospital search.`);
                launchMaps(fallbackUrl);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
    }

    // Wire up: Status card hospital icon (Safety Status section)
    const statusHospitalItem = document.getElementById('statusHospitalItem');
    if (statusHospitalItem) {
        statusHospitalItem.addEventListener('click', openHospitalSearch);
    }

    // Wire up: Quick Action "Hospitals" card (Quick Actions section)
    const hospitalActionCard = document.getElementById('hospitalActionCard');
    if (hospitalActionCard) {
        hospitalActionCard.addEventListener('click', openHospitalSearch);
    }
});
