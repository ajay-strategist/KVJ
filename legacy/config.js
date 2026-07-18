export const API_BASE_URL =
    import.meta.env.VITE_MODE === 'production' || import.meta.env.MODE === 'production'
        ? import.meta.env.VITE_API_URL || 'https://flow-desk-wgfm.onrender.com'
        : 'http://localhost:5000';
