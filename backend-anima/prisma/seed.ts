import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const anime = [
  {
    id: 'frieren',
    title: 'Провожающая в последний путь Фрирен',
    originalTitle: 'Sousou no Frieren',
    episodes: 28,
    posterUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
  },
  {
    id: 'dungeon-meshi',
    title: 'Подземелье вкусностей',
    originalTitle: 'Dungeon Meshi',
    episodes: 24,
    posterUrl: 'https://cdn.myanimelist.net/images/anime/1711/142957.jpg',
  },
  {
    id: 'apothecary',
    title: 'Монолог фармацевта',
    originalTitle: 'Kusuriya no Hitorigoto',
    episodes: 24,
    posterUrl: 'https://cdn.myanimelist.net/images/anime/1708/138033.jpg',
  },
  {
    id: 'chainsaw-man',
    title: 'Человек-бензопила',
    originalTitle: 'Chainsaw Man',
    episodes: 12,
    posterUrl: 'https://cdn.myanimelist.net/images/anime/1806/126216.jpg',
  },
];

async function main() {
  for (const item of anime) {
    await prisma.anime.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });

  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
