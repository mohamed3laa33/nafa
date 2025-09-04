
import { useEffect, useRef } from 'react';

type FetchWithCancel = (url: string, options?: RequestInit) => Promise<Response>;

const useCancellableFetch = (): FetchWithCancel => {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Abort any ongoing fetch requests when the component unmounts
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  const fetchWithCancel: FetchWithCancel = (url, options) => {
    // If there's an ongoing request, abort it
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    // Create a new AbortController for the new request
    const controller = new AbortController();
    controllerRef.current = controller;

    const signal = controller.signal;

    // Perform the fetch with the signal
    return fetch(url, { ...options, signal }).catch(error => {
      // When the request is aborted, fetch throws an error.
      // We can check if the error is an AbortError and handle it gracefully.
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
      }
      // Re-throw other errors
      throw error;
    });
  };

  return fetchWithCancel;
};

export default useCancellableFetch;
