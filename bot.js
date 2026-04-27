import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
});

function mainMenu(chatId) {
  bot.sendMessage(chatId, 'IOSx 🚀\nВыберите действие:', {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        ['💳 Оплата'],
        ['📥 Скачать инсталлер'],
        ['🔑 Активировать ключ'],
        ['📱 Модели'],
        ['👤 Профиль', '💬 Помощь']
      ]
    }
  });
}

bot.onText(/\/start/, (msg) => {
  mainMenu(msg.chat.id);
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === '💳 Оплата') {
    bot.sendMessage(chatId,
`Введите ключ тарифа:

IOSX150 — 1 месяц (150₽)
IOSX300 — 1 месяц (300₽)
IOSX499 — 3 месяца (499₽)
IOSXFOREVER — навсегда`);
  }

  else if (text === '📥 Скачать инсталлер') {
    bot.sendMessage(chatId, 'Скачать скоро будет тут 👇');
  }

  else if (text === '🔑 Активировать ключ') {
    bot.sendMessage(chatId, 'Введите ваш ключ:');
  }

  else if (text === '📱 Модели') {
    bot.sendMessage(chatId, 'Список моделей скоро добавим');
  }

  else if (text === '👤 Профиль') {
    bot.sendMessage(chatId, `Ваш ID: ${chatId}`);
  }

  else if (text === '💬 Помощь') {
    bot.sendMessage(chatId, 'Связь: @your_manager');
  }
});
