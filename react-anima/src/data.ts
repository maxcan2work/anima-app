export type AnimeTitle = {
  id: string;
  title: string;
  originalTitle: string;
  year: number;
  episodes: number;
  studio: string;
  rating: string;
  genres: string[];
  description: string;
  poster: string;
  backdrop: string;
  sampleEpisodeTitle: string;
  watchSources: WatchSource[];
};

export type WatchSource = {
  name: string;
  url: string;
  kind: 'streaming' | 'youtube';
  subtitles: string[];
  note: string;
};
