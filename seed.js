const prisma = require('./modules/prisma');

async function seed() {
  // Create users
  const user1 = await prisma.user.create({
    data: {
      email: 'john.doe@example.com',
      uname: 'johnDoe',
      pw: 'password123',
      img: 'https://example.com/john.jpg',
      bio: "Hello, I'm John!",
      setting: JSON.stringify({
        theme: 'dark',
        notifications: true,
      }),
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'jane.doe@example.com',
      uname: 'janeDoe',
      pw: 'password123',
      img: 'https://example.com/jane.jpg',
      bio: "Hello, I'm Jane!",
      setting: JSON.stringify({
        theme: 'dark',
        notifications: true,
      }),
    },
  });

  // Create chat
  const chat = await prisma.chat.create({
    data: {
      isGroup: false,
      users: {
        create: [
          { userId: user1.id, role: 'member' },
          { userId: user2.id, role: 'member' },
        ],
      },
    },
  });

  // Create messages
  const message1 = await prisma.message.create({
    data: {
      text: 'Hello, Jane!',
      senderId: user1.id,
      chatId: chat.id,
    },
  });

  const message2 = await prisma.message.create({
    data: {
      text: 'Hi, John!',
      senderId: user2.id,
      chatId: chat.id,
    },
  });
}

seed()
  .then(() => console.log('Seeding complete'))
  .catch((error) => console.error(error))
  .finally(() => prisma.$disconnect());
