import { useState, useCallback } from 'react';
import type { GeoPoint } from '../../../core/types';

export function useGeolocation() {
  const [coordinates, setCoordinates] = useState<GeoPoint | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const getPosition = useCallback((): Promise<GeoPoint> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = new Error('Geolocation is not supported by your browser.');
        setError(err.message);
        reject(err);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setCoordinates(coords);
          setError(null);
          resolve(coords);
        },
        (err) => {
          setError(err.message);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  }, []);

  return { getPosition, coordinates, error };
}
