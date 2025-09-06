
import { useCallback, useEffect, useRef } from 'react';

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

  // Stable function across renders to avoid re-triggering effects
  const fetchWithCancel: FetchWithCancel = useCallback((url, options) => {
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
      // Gracefully swallow aborts to avoid spurious error state updates
      if (error && (error.name === 'AbortError' || error.code === 'ABORT_ERR')) {
        return new Response(null, { status: 499, statusText: 'Client Closed Request' });
      }
      // Re-throw other errors
      throw error;
    });
  }, []);

  return fetchWithCancel;
};

export default useCancellableFetch;
