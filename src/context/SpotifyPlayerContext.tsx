import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';

export const SPOTIFY_ALBUM_ID = '2F2ZjH7HJQns03217zo2xi';
export const SPOTIFY_URI = `spotify:album:${SPOTIFY_ALBUM_ID}`;
export const SPOTIFY_ALBUM_URL = `https://open.spotify.com/album/${SPOTIFY_ALBUM_ID}`;

export interface SpotifyEmbedController {
  play: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  loadUri: (uri: string) => void;
  addListener: (event: string, callback: (data: any) => void) => void;
  removeListener: (event: string, callback?: (data: any) => void) => void;
  destroy?: () => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: {
      createController: (
        element: HTMLElement,
        options: {
          uri?: string;
          url?: string;
          width?: string | number;
          height?: string | number;
          theme?: string;
        },
        callback: (embedController: SpotifyEmbedController) => void
      ) => void;
    }) => void;
    SpotifyIFrameApi?: any;
    globalSpotifyEmbedController?: SpotifyEmbedController | null;
  }
}

interface SpotifyPlayerContextValue {
  isReady: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  statusMessage: string | null;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  mountNodeRef: React.RefObject<HTMLDivElement | null>;
}

const SpotifyPlayerContext = createContext<SpotifyPlayerContextValue | null>(null);

export const SpotifyPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const mountNodeRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const userExplicitlyPausedRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;

  // Function to execute safe play call
  const triggerPlayback = useCallback(() => {
    if (userExplicitlyPausedRef.current) return;
    const controller = controllerRef.current || window.globalSpotifyEmbedController;
    if (controller) {
      try {
        controller.play();
      } catch (err) {
        try {
          controller.resume();
        } catch {
          // ignore error
        }
      }
    }
  }, []);

  // Initialize the Spotify IFrame API & Create Single Persistent Controller for Album
  useEffect(() => {
    // If global controller already exists across component renders, reuse it
    if (window.globalSpotifyEmbedController) {
      controllerRef.current = window.globalSpotifyEmbedController;
      setIsReady(true);
      setIsLoading(false);
      return;
    }

    if (isInitializingRef.current) {
      return;
    }
    isInitializingRef.current = true;

    let retryCount = 0;
    const maxRetries = 50;

    const setupController = (IFrameAPI: any) => {
      const mountElement = mountNodeRef.current || document.getElementById('spotify-embed-controller-mount');

      if (!mountElement) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => setupController(IFrameAPI), 100);
        } else {
          setIsLoading(false);
        }
        return;
      }

      if (controllerRef.current || window.globalSpotifyEmbedController) {
        setIsReady(true);
        setIsLoading(false);
        return;
      }

      const options = {
        uri: SPOTIFY_URI,
        width: '100%',
        height: '152',
        theme: 'dark',
      };

      try {
        IFrameAPI.createController(mountElement, options, (embedController: SpotifyEmbedController) => {
          controllerRef.current = embedController;
          window.globalSpotifyEmbedController = embedController;

          // Ensure iframe has all required permissions for autoplay
          try {
            const iframe = mountElement.querySelector('iframe') || mountElement.parentElement?.querySelector('iframe');
            if (iframe) {
              iframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
            }
          } catch {
            // ignore
          }

          embedController.addListener('ready', () => {
            setIsReady(true);
            setIsLoading(false);
            setStatusMessage(null);

            // 1. Immediately attempt automatic background music playback upon ready
            if (!userExplicitlyPausedRef.current) {
              try {
                embedController.play();
              } catch (err) {
                console.warn('Initial autoplay attempt blocked by browser, waiting for first interaction:', err);
              }
            }
          });

          embedController.addListener('playback_update', (event: any) => {
            const paused = event?.data?.isPaused ?? true;
            setIsPlaying(!paused);
            if (!paused) {
              setStatusMessage(null);
            }
          });

          // Mark as initialized
          setIsReady(true);
          setIsLoading(false);

          // 2. Immediate play trigger on creation
          if (!userExplicitlyPausedRef.current) {
            try {
              embedController.play();
            } catch (err) {
              console.warn('Controller creation play attempt:', err);
            }
          }
        });
      } catch (err) {
        console.error('Error creating Spotify controller:', err);
        setIsLoading(false);
        setStatusMessage('Error loading Spotify player');
      }
    };

    // Load Spotify IFrame API Script if not already present
    if (window.SpotifyIFrameApi) {
      setupController(window.SpotifyIFrameApi);
    } else {
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        window.SpotifyIFrameApi = IFrameAPI;
        setupController(IFrameAPI);
      };

      if (!document.getElementById('spotify-iframe-api-script')) {
        const script = document.createElement('script');
        script.id = 'spotify-iframe-api-script';
        script.src = 'https://open.spotify.com/embed/iframe-api/v1';
        script.async = true;
        script.onerror = () => {
          setIsLoading(false);
          setStatusMessage('Failed to load Spotify API');
        };
        document.body.appendChild(script);
      }
    }
  }, []);

  // 14 & 15. Browser Autoplay Fallback: First User Interaction (Click/Tap/Key) automatically starts music
  useEffect(() => {
    const handleFirstUserInteraction = () => {
      if (userExplicitlyPausedRef.current) return;
      if (!isPlayingRef.current) {
        triggerPlayback();
      }
    };

    window.addEventListener('click', handleFirstUserInteraction, { capture: true, passive: true });
    window.addEventListener('pointerdown', handleFirstUserInteraction, { capture: true, passive: true });
    window.addEventListener('touchstart', handleFirstUserInteraction, { capture: true, passive: true });
    window.addEventListener('keydown', handleFirstUserInteraction, { capture: true, passive: true });

    return () => {
      window.removeEventListener('click', handleFirstUserInteraction, { capture: true });
      window.removeEventListener('pointerdown', handleFirstUserInteraction, { capture: true });
      window.removeEventListener('touchstart', handleFirstUserInteraction, { capture: true });
      window.removeEventListener('keydown', handleFirstUserInteraction, { capture: true });
    };
  }, [triggerPlayback]);

  // Main User Play Action
  const play = useCallback(() => {
    userExplicitlyPausedRef.current = false;
    setStatusMessage(null);
    const controller = controllerRef.current || window.globalSpotifyEmbedController;

    if (controller) {
      try {
        controller.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Play error, trying resume/togglePlay:', err);
        try {
          controller.resume();
          setIsPlaying(true);
        } catch {
          try {
            controller.togglePlay();
            setIsPlaying(true);
          } catch {
            setStatusMessage('Click again to start music');
          }
        }
      }
    } else {
      setStatusMessage('Initializing music player...');
    }
  }, []);

  // Main User Pause Action
  const pause = useCallback(() => {
    userExplicitlyPausedRef.current = true;
    setStatusMessage(null);
    const controller = controllerRef.current || window.globalSpotifyEmbedController;

    if (controller) {
      try {
        controller.pause();
      } catch (err) {
        console.warn('Pause error:', err);
      }
    }
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const toggleMute = useCallback(() => {
    const controller = controllerRef.current || window.globalSpotifyEmbedController;
    if (isMuted) {
      setIsMuted(false);
      userExplicitlyPausedRef.current = false;
      if (controller && !isPlaying) {
        try {
          controller.play();
          setIsPlaying(true);
        } catch {
          // ignore
        }
      }
    } else {
      setIsMuted(true);
      if (controller && isPlaying) {
        try {
          controller.pause();
          setIsPlaying(false);
        } catch {
          // ignore
        }
      }
    }
  }, [isMuted, isPlaying]);

  return (
    <SpotifyPlayerContext.Provider
      value={{
        isReady,
        isLoading,
        isPlaying,
        isMuted,
        statusMessage,
        play,
        pause,
        togglePlay,
        toggleMute,
        mountNodeRef,
      }}
    >
      {children}
    </SpotifyPlayerContext.Provider>
  );
};

export const useSpotifyPlayer = (): SpotifyPlayerContextValue => {
  const context = useContext(SpotifyPlayerContext);
  if (!context) {
    throw new Error('useSpotifyPlayer must be used within a SpotifyPlayerProvider');
  }
  return context;
};
