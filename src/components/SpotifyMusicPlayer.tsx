import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Music,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { useSpotifyPlayer, SPOTIFY_ALBUM_ID, SPOTIFY_ALBUM_URL } from '../context/SpotifyPlayerContext.js';

export const SpotifyMusicPlayer: React.FC = () => {
  const {
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
  } = useSpotifyPlayer();

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <aside
      className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 select-none"
      aria-label="Spotify Background Music Player"
    >
      {/* 
        Container for the Shared Spotify Embed IFrame & Expanded Details.
        Kept continuously mounted and sized in DOM to maintain active iframe communication.
      */}
      <div
        className={`transition-all duration-300 ${
          isExpanded
            ? 'mb-3 w-[300px] sm:w-[340px] rounded-2xl overflow-hidden glass-card p-3.5 border border-white/10 shadow-2xl backdrop-blur-2xl bg-[#05070a]/95 opacity-100 scale-100 pointer-events-auto z-50'
            : 'w-[300px] sm:w-[340px] h-[152px] opacity-0 pointer-events-none overflow-hidden absolute bottom-full left-0 scale-95 origin-bottom -z-50'
        }`}
      >
        <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
              Spotify Background Music
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Collapse Player"
            aria-label="Collapse Player"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* 
          Target DOM Mount Node where Spotify IFrame API injects the Official Embed Iframe.
          Maintains fixed dimensions so Spotify API can initialize and play seamlessly.
        */}
        <div
          ref={mountNodeRef}
          id="spotify-embed-controller-mount"
          className="w-full min-h-[152px] rounded-xl overflow-hidden bg-black/40 border border-white/5"
        />

        <div className="pt-2.5 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            {isPlaying ? 'Playing via Spotify' : isLoading ? 'Loading Spotify...' : 'Ready to Play'}
          </span>
          <a
            href={SPOTIFY_ALBUM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>Open in Spotify</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Floating Compact Glass Pill Controller (Primary User Control) */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 px-3 py-2 rounded-full glass-card border border-white/10 bg-[#070a14]/85 backdrop-blur-xl shadow-xl hover:border-blue-500/30 transition-all group"
      >
        {/* Spinning Vinyl Disc with Play/Pause state */}
        <button
          onClick={togglePlay}
          className="relative w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 hover:text-white hover:bg-blue-500/30 transition-all cursor-pointer shrink-0"
          title={isPlaying ? 'Pause Background Music' : 'Play Background Music'}
          aria-label={isPlaying ? 'Pause Background Music' : 'Play Background Music'}
        >
          {isPlaying ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3.5, ease: 'linear' }}
              className="w-full h-full rounded-full flex items-center justify-center"
            >
              <Music className="w-3.5 h-3.5" />
            </motion.div>
          ) : isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          )}
        </button>

        {/* Track Label and Real-time Status */}
        <div
          onClick={togglePlay}
          className="flex flex-col pr-1 cursor-pointer select-none max-w-[130px] sm:max-w-[170px]"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-white tracking-wide truncate">
              Background Music
            </span>
            {isPlaying && (
              <span className="flex items-end gap-[2px] h-2.5 pb-[1px]">
                <span className="w-[2px] bg-blue-400 rounded-full animate-[bounce_1s_infinite_100ms] h-full" />
                <span className="w-[2px] bg-blue-400 rounded-full animate-[bounce_1s_infinite_300ms] h-2/3" />
                <span className="w-[2px] bg-blue-400 rounded-full animate-[bounce_1s_infinite_200ms] h-4/5" />
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 truncate">
            {statusMessage ? (
              <span className="text-amber-400 font-medium">{statusMessage}</span>
            ) : isPlaying ? (
              'Playing Spotify Album'
            ) : isLoading ? (
              'Initializing...'
            ) : (
              'Paused • Click to play'
            )}
          </span>
        </div>

        {/* Action Controls Divider & Buttons */}
        <div className="flex items-center gap-1 pl-1 border-l border-white/10">
          {/* Main Play/Pause Button */}
          <button
            onClick={togglePlay}
            id="bottom-music-play-pause-btn"
            className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current text-blue-400" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current text-white" />
            )}
          </button>

          {/* Mute/Unmute Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            id="bottom-music-mute-btn"
            className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-slate-300" />
            )}
          </button>

          {/* Expand/Collapse Chevron Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            id="bottom-music-expand-btn"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse player' : 'Expand Spotify player'}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </motion.div>
    </aside>
  );
};
