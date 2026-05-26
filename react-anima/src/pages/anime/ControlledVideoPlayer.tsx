import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import clsx from 'clsx';
import Hls from 'hls.js';
import type { PlayerProviderResult } from '@/api';
import fullscreenIcon from '@assets/fullscreen.svg';
import pictureInPictureIcon from '@assets/picture-in-picture.svg';
import volumeHighIcon from '@assets/volume-high.svg';
import volumeMediumIcon from '@assets/volume-medium.svg';
import volumeMutedIcon from '@assets/volume-muted.svg';
import type { AnimeTitle } from '@/data';
import { Tooltip } from '@shared/ui/Tooltip';
import styles from './ControlledVideoPlayer.module.css';

export type PlaybackSyncState = {
  status: 'paused' | 'playing';
  position: number;
  updatedAt: number;
};

export type PlaybackSync = {
  state: PlaybackSyncState;
  canControl: boolean;
  onChange: (state: Pick<PlaybackSyncState, 'status' | 'position'>) => void;
};

type QualityOption = {
  value: number;
  label: string;
};

type ControlledVideoPlayerProps = {
  anime: AnimeTitle;
  player: PlayerProviderResult;
  isLoading: boolean;
  onReady: () => void;
  playbackSync?: PlaybackSync;
};

export function ControlledVideoPlayer({
  anime,
  player,
  isLoading,
  onReady,
  playbackSync,
}: ControlledVideoPlayerProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSyncEmitRef = useRef(0);
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [quality, setQuality] = useState(-1);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [progressPreview, setProgressPreview] = useState<{ left: number; time: number } | null>(null);
  const [volumeFeedbackVisible, setVolumeFeedbackVisible] = useState(false);
  const [volumePopoverOpen, setVolumePopoverOpen] = useState(false);
  const canControl = playbackSync?.canControl ?? true;

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(Math.max((currentTime / duration) * 100, 0), 100);
  }, [currentTime, duration]);
  const volumeIcon = muted || volume === 0 ? volumeMutedIcon : volume <= 0.5 ? volumeMediumIcon : volumeHighIcon;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !player.streamUrl) return;

    setQualities([]);
    setQuality(-1);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = player.streamUrl;
      return;
    }

    if (!Hls.isSupported()) return;

    const hls = new Hls();
    hlsRef.current = hls;
    hls.loadSource(player.streamUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setQualities(
        hls.levels.map((level, index) => ({
          value: index,
          label: level.height ? `${level.height}p` : `Q${index + 1}`,
        })),
      );
    });

    return () => {
      hlsRef.current = null;
      hls.destroy();
    };
  }, [player.streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackSync || playbackSync.canControl) return;

    applyRemotePlayback(video, playbackSync.state);
    if (playbackSync.state.status !== 'playing') return;

    const intervalId = window.setInterval(() => {
      applyRemotePlayback(video, playbackSync.state);
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [playbackSync]);

  useEffect(() => {
    function handleFullscreenChange() {
      setFullscreen(document.fullscreenElement === frameRef.current);
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (paused || !canControl || !controlsVisible) return;

    const timeoutId = window.setTimeout(() => {
      setControlsVisible(false);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canControl, controlsVisible, paused]);

  useEffect(() => {
    if (!volumeFeedbackVisible) return;

    const timeoutId = window.setTimeout(() => {
      setVolumeFeedbackVisible(false);
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [volumeFeedbackVisible, volume, muted]);

  function showControls() {
    if (!canControl) return;
    setControlsVisible(true);
  }

  function handleHotkey(event: KeyboardEvent<HTMLDivElement>) {
    if (!canControl) return;
    const target = event.target;
    if (target instanceof HTMLSelectElement || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

    if (event.code === 'Space' || event.code === 'KeyF' || event.code === 'KeyP' || event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      event.preventDefault();
      showControls();
    }

    if (event.code === 'Space') {
      void togglePlayback();
      return;
    }

    if (event.code === 'ArrowUp') {
      handleVolume((muted ? 0 : volume) + 0.05);
      return;
    }

    if (event.code === 'ArrowDown') {
      handleVolume((muted ? 0 : volume) - 0.05);
      return;
    }

    if (event.code === 'KeyF') {
      void toggleFullscreen();
      return;
    }

    if (event.code === 'KeyP') {
      void togglePictureInPicture();
    }
  }

  function emitPlayback(status: PlaybackSyncState['status']) {
    const video = videoRef.current;
    if (!video || !playbackSync?.canControl) return;
    playbackSync.onChange({
      status,
      position: video.currentTime,
    });
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video || !canControl) return;

    if (video.paused) {
      await video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }

  function handleSeek(value: number) {
    const video = videoRef.current;
    if (!video || !canControl || !duration) return;
    setSeeking(true);
    video.currentTime = (value / 100) * duration;
  }

  function getProgressPointerRatio(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  }

  function updateProgressPreview(event: PointerEvent<HTMLDivElement>) {
    if (!duration) return;

    const ratio = getProgressPointerRatio(event);
    setProgressPreview({
      left: ratio * 100,
      time: ratio * duration,
    });
  }

  function seekByProgressPointer(event: PointerEvent<HTMLDivElement>) {
    if (!canControl || !duration) return;
    handleSeek(getProgressPointerRatio(event) * 100);
    updateProgressPreview(event);
  }

  function handleVolume(value: number) {
    const video = videoRef.current;
    if (!video || !canControl) return;

    const nextVolume = Math.min(Math.max(value, 0), 1);
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    setVolume(nextVolume);
    setMuted(video.muted);
    setVolumeFeedbackVisible(true);
  }

  function updateVolumeFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextVolume = 1 - (event.clientY - rect.top) / rect.height;
    handleVolume(nextVolume);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video || !canControl) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    setVolumeFeedbackVisible(true);
  }

  function changeQuality(value: number) {
    if (!canControl) return;
    setQuality(value);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = value;
    }
  }

  async function togglePictureInPicture() {
    const video = videoRef.current;
    if (!video || !canControl) return;

    const pipDocument = document as Document & { pictureInPictureElement?: Element; exitPictureInPicture?: () => Promise<void> };
    const pipVideo = video as HTMLVideoElement & { requestPictureInPicture?: () => Promise<PictureInPictureWindow> };

    if (pipDocument.pictureInPictureElement) {
      await pipDocument.exitPictureInPicture?.().catch(() => undefined);
      return;
    }

    await pipVideo.requestPictureInPicture?.().catch(() => undefined);
  }

  async function toggleFullscreen() {
    if (!frameRef.current || !canControl) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await frameRef.current.requestFullscreen().catch(() => undefined);
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);
    if (!playbackSync?.canControl || video.paused) return;

    const now = Date.now();
    if (now - lastSyncEmitRef.current < 5000) return;
    lastSyncEmitRef.current = now;
    playbackSync.onChange({
      status: 'playing',
      position: video.currentTime,
    });
  }

  function handleGuestInteraction() {
    const video = videoRef.current;
    if (!video || !playbackSync || playbackSync.canControl) return;
    applyRemotePlayback(video, playbackSync.state);
  }

  return (
    <div
      className={clsx(styles.frame, !controlsVisible && !paused && styles.cursorHidden)}
      ref={frameRef}
      tabIndex={canControl ? 0 : -1}
      onPointerMove={showControls}
      onPointerEnter={showControls}
      onKeyDown={handleHotkey}
    >
      <video
        ref={videoRef}
        poster={anime.backdrop}
        onClick={togglePlayback}
        onDoubleClick={toggleFullscreen}
        onCanPlay={() => {
          onReady();
          setSeeking(false);
        }}
        onCanPlayThrough={() => setSeeking(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onWaiting={() => setSeeking(true)}
        onPlaying={() => setSeeking(false)}
        onPlay={() => {
          setPaused(false);
          emitPlayback('playing');
        }}
        onPause={() => {
          setPaused(true);
          emitPlayback('paused');
        }}
        onSeeking={() => {
          setSeeking(true);
          handleGuestInteraction();
        }}
        onSeeked={() => {
          setSeeking(false);
          handleGuestInteraction();
          emitPlayback(videoRef.current?.paused ? 'paused' : 'playing');
        }}
        onTimeUpdate={handleTimeUpdate}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setMuted(event.currentTarget.muted);
        }}
      />

      {!canControl ? <div className={styles.guestShield} aria-hidden="true" /> : null}
      {seeking && !isLoading ? (
        <div className={styles.seekFeedback} role="status" aria-label="Перематываем">
          <span />
        </div>
      ) : null}

      {canControl ? (
        <div
          className={clsx(styles.controls, !controlsVisible && !paused && styles.controlsHidden)}
          onFocus={showControls}
          onPointerMove={showControls}
        >
          <Tooltip label={paused ? 'Запустить' : 'Пауза'} placement="top">
            <button type="button" onClick={(event) => {
              event.currentTarget.blur();
              void togglePlayback();
            }} aria-label={paused ? 'Запустить' : 'Пауза'}>
              {paused ? '▶' : '❚❚'}
            </button>
          </Tooltip>
          <span className={styles.time}>{formatTime(currentTime)}</span>
          <div className={styles.progressControl}>
            <div
              className={clsx(styles.progress, seeking && styles.progressSeeking)}
              role="slider"
              tabIndex={0}
              aria-label="Позиция"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              onPointerEnter={updateProgressPreview}
              onPointerMove={(event) => {
                updateProgressPreview(event);
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  seekByProgressPointer(event);
                }
              }}
              onPointerLeave={() => setProgressPreview(null)}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                seekByProgressPointer(event);
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') handleSeek(progress + 1);
                if (event.key === 'ArrowLeft') handleSeek(progress - 1);
              }}
            >
              <span style={{ width: `${progress}%` }} />
              <i style={{ left: `${progress}%` }} aria-hidden="true" />
            </div>
            {progressPreview ? (
              <span className={styles.progressTooltip} style={{ left: `${progressPreview.left}%` }}>
                {formatTime(progressPreview.time)}
              </span>
            ) : null}
          </div>
          <span className={styles.time}>{formatTime(duration)}</span>
          <div
            className={styles.volumeControl}
            onPointerEnter={() => setVolumePopoverOpen(true)}
            onPointerLeave={() => setVolumePopoverOpen(false)}
            onFocus={() => setVolumePopoverOpen(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setVolumePopoverOpen(false);
              }
            }}
          >
            <Tooltip
              label={`${Math.round((muted ? 0 : volume) * 100)}%`}
              placement="top"
              open={volumeFeedbackVisible && !volumePopoverOpen}
              disabled={volumePopoverOpen}
            >
              <button type="button" onClick={toggleMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
                <img src={volumeIcon} alt="" aria-hidden="true" />
              </button>
            </Tooltip>
            <div className={styles.volumePopover}>
              <div
                className={styles.volume}
                role="slider"
                tabIndex={0}
                aria-label="Громкость"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((muted ? 0 : volume) * 100)}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateVolumeFromPointer(event);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    updateVolumeFromPointer(event);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp') handleVolume((muted ? 0 : volume) + 0.05);
                  if (event.key === 'ArrowDown') handleVolume((muted ? 0 : volume) - 0.05);
                }}
              >
                <span style={{ height: `${(muted ? 0 : volume) * 100}%` }} />
                <i style={{ bottom: `calc(${(muted ? 0 : volume) * 100}% - 6px)` }} aria-hidden="true" />
              </div>
            </div>
          </div>
          <select value={quality} aria-label="Качество" onChange={(event) => changeQuality(Number(event.target.value))}>
            <option value={-1}>Auto</option>
            {qualities.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <Tooltip label="Картинка в картинке" placement="top">
            <button type="button" onClick={(event) => {
              event.currentTarget.blur();
              void togglePictureInPicture();
            }} aria-label="Картинка в картинке">
              <img src={pictureInPictureIcon} alt="" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label={fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'} placement="left">
            <button type="button" onClick={(event) => {
              event.currentTarget.blur();
              void toggleFullscreen();
            }} aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'}>
              <img src={fullscreenIcon} alt="" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      ) : null}

      {isLoading ? <div className={styles.loading} /> : null}
    </div>
  );
}

function applyRemotePlayback(video: HTMLVideoElement, playback: PlaybackSyncState) {
  const targetTime = playback.status === 'playing'
    ? playback.position + Math.max(0, Date.now() - playback.updatedAt) / 1000
    : playback.position;
  const drift = Math.abs(video.currentTime - targetTime);

  if (Number.isFinite(targetTime) && drift > (playback.status === 'playing' ? 1.5 : 0.5)) {
    video.currentTime = targetTime;
  }

  if (playback.status === 'playing' && video.paused) {
    void video.play().catch(() => undefined);
  }

  if (playback.status === 'paused' && !video.paused) {
    video.pause();
  }
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0:00';

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
