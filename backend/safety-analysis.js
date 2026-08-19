/* SafeYatra shared safety analysis */
(function (global) {
    const storageKey = 'safeyatra_latest_safety_analysis';

    function analyze(temp, weatherCode, lat, lng) {
        let weatherRisk = Math.min(60, Math.max(10, Math.round(Math.abs(temp - 24) * 2.2)));
        if (weatherCode >= 80) weatherRisk += 25;

        const crimeLevel = Math.round(25 + (Math.abs(Math.sin(lat * 50)) * 15));
        const terrainRisk = Math.round(20 + (Math.abs(Math.cos(lng * 50)) * 12));
        const avgRisk = Math.round((crimeLevel * 0.4) + (weatherRisk * 0.3) + (terrainRisk * 0.3));
        const overallScore = Math.max(50, Math.min(98, 100 - avgRisk));
        const confidence = Math.min(98, Math.max(90, 88 + Math.round(overallScore * 0.08)));

        return { overallScore, confidence, crimeLevel, weatherRisk, terrainRisk, lat, lng };
    }

    function saveLatest(result) {
        try {
            localStorage.setItem(storageKey, JSON.stringify(result));
        } catch (error) {
            console.warn('Unable to cache safety analysis:', error);
        }
    }

    function getLatestForLocation(lat, lng) {
        try {
            const result = JSON.parse(localStorage.getItem(storageKey));
            if (!result || Math.abs(result.lat - lat) > 0.01 || Math.abs(result.lng - lng) > 0.01) {
                return null;
            }
            return result;
        } catch (error) {
            return null;
        }
    }

    global.SafeYatraSafetyAnalysis = { analyze, saveLatest, getLatestForLocation, storageKey };
})(window);
