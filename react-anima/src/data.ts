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
};

export const ANIME_LIBRARY: AnimeTitle[] = [
  {
    id: 'frieren',
    title: 'Провожающая в последний путь Фрирен',
    originalTitle: 'Sousou no Frieren',
    year: 2023,
    episodes: 28,
    studio: 'Madhouse',
    rating: '8.9',
    genres: ['Фэнтези', 'Приключение', 'Драма'],
    description:
      'Эльфийская волшебница отправляется в новое путешествие спустя годы после победы над Королем Демонов и заново учится понимать людей.',
    poster: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1600&q=80',
    sampleEpisodeTitle: 'Начало пути',
  },
  {
    id: 'dungeon-meshi',
    title: 'Подземелье вкусностей',
    originalTitle: 'Dungeon Meshi',
    year: 2024,
    episodes: 24,
    studio: 'Trigger',
    rating: '8.6',
    genres: ['Фэнтези', 'Комедия', 'Приключение'],
    description:
      'Отряд авантюристов спускается в подземелье, где выживание, кулинария и спасение товарища оказываются одной задачей.',
    poster: 'https://cdn.myanimelist.net/images/anime/1711/142957.jpg',
    backdrop: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1600&q=80',
    sampleEpisodeTitle: 'Горячий суп из монстров',
  },
  {
    id: 'apothecary',
    title: 'Монолог фармацевта',
    originalTitle: 'Kusuriya no Hitorigoto',
    year: 2023,
    episodes: 24,
    studio: 'Toho Animation Studio',
    rating: '8.7',
    genres: ['Детектив', 'История', 'Драма'],
    description:
      'Маомао использует знания о лекарствах и ядах, чтобы разбирать интриги императорского дворца и чужие тайны.',
    poster: 'https://cdn.myanimelist.net/images/anime/1708/138033.jpg',
    backdrop: 'https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=1600&q=80',
    sampleEpisodeTitle: 'Запах яда',
  },
  {
    id: 'chainsaw-man',
    title: 'Человек-бензопила',
    originalTitle: 'Chainsaw Man',
    year: 2022,
    episodes: 12,
    studio: 'MAPPA',
    rating: '8.5',
    genres: ['Экшен', 'Сверхъестественное', 'Сёнен'],
    description:
      'Дэндзи получает шанс на новую жизнь, но вместе с ним приходят демоны, охотники и цена за простые мечты.',
    poster: 'https://cdn.myanimelist.net/images/anime/1806/126216.jpg',
    backdrop: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
    sampleEpisodeTitle: 'Пес и бензопила',
  },
];
