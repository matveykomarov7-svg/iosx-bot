import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const managerUsername = process.env.MANAGER_USERNAME || '@iosx_support';
const paymentUrl = process.env.PAYMENT_URL || '';

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

const bot = new TelegramBot(token, { polling: true });

const userState = new Map();

const BUTTONS = {
  request: '📱 Заявка с сайта',
  pay: '💳 Оплатить 299 ₽',
  checklist: '✅ Проверка перед сбросом',
  profile: '👤 Профиль',
  help: '💬 Помощь',
  yes: 'Да',
  no: 'Нет',
  menu: 'Главное меню',
};

const checklist = [
  {
    key: 'media',
    question: '1. Фото и видео сохранены?',
    no: 'Сначала включите Google Фото или перенесите фото/видео на ПК/флешку.',
  },
  {
    key: 'contacts',
    question: '2. Контакты сохранены?',
    no: 'Сначала синхронизируйте контакты с Google-аккаунтом.',
  },
  {
    key: 'chats',
    question: '3. WhatsApp / Telegram / важные чаты сохранены?',
    no: 'Сначала сделайте резервную копию в нужном приложении.',
  },
  {
    key: 'passwords',
    question: '4. Пароли и аккаунты известны?',
    no: 'Сначала восстановите доступы до сброса.',
  },
  {
    key: 'google',
    question: '5. Google-аккаунт и пароль точно помните?',
    no: 'Сброс делать нельзя. Сначала восстановите доступ к Google-аккаунту.',
  },
  {
    key: 'files',
    question: '6. Важные файлы скачаны или перенесены?',
    no: 'Сначала перенесите файлы в Google Drive, на ПК или флешку.',
  },
  {
    key: 'access',
    question: '7. SIM, банковские приложения и 2FA готовы?',
    no: 'Сначала проверьте доступы, SIM и коды восстановления.',
  },
  {
    key: 'battery',
    question: '8. Заряд телефона выше 50%?',
    no: 'Сначала зарядите телефон минимум до 50%.',
  },
];

function setState(chatId, state) {
  userState.set(chatId, state);
}

function clearState(chatId) {
  userState.delete(chatId);
}

function mainKeyboard() {
  return {
    resize_keyboard: true,
    keyboard: [
      [BUTTONS.request],
      [BUTTONS.pay],
      [BUTTONS.checklist],
      [BUTTONS.profile, BUTTONS.help],
    ],
  };
}

function yesNoKeyboard() {
  return {
    resize_keyboard: true,
    one_time_keyboard: true,
    keyboard: [
      [BUTTONS.yes, BUTTONS.no],
      [BUTTONS.menu],
    ],
  };
}

function mainMenu(chatId) {
  clearState(chatId);
  return bot.sendMessage(
    chatId,
    [
      'IOSx',
      '',
      'Настройка Android-устройства — 299 ₽ в beta.',
      'После заявки пройдите короткую проверку, чтобы не потерять данные перед сбросом.',
    ].join('\n'),
    { reply_markup: mainKeyboard() }
  );
}

function startChecklist(chatId) {
  setState(chatId, {
    mode: 'checklist',
    step: 0,
    answers: [],
  });

  return askChecklistQuestion(chatId);
}

function askChecklistQuestion(chatId) {
  const state = userState.get(chatId);
  const item = checklist[state.step];

  return bot.sendMessage(
    chatId,
    `${item.question}\n\nЕсли нет — лучше остановиться и сначала сохранить данные.`,
    { reply_markup: yesNoKeyboard() }
  );
}

function stopByChecklist(chatId, item) {
  clearState(chatId);

  return bot.sendMessage(
    chatId,
    [
      'Стоп. Сброс пока не делаем.',
      '',
      item.no,
      '',
      'Когда всё будет готово, вернитесь и пройдите проверку заново.',
    ].join('\n'),
    { reply_markup: mainKeyboard() }
  );
}

function finishChecklist(chatId) {
  clearState(chatId);

  const inlineKeyboard = paymentUrl
    ? { inline_keyboard: [[{ text: 'Оплатить 299 ₽', url: paymentUrl }]] }
    : { inline_keyboard: [[{ text: 'Написать менеджеру', url: `https://t.me/${managerUsername.replace('@', '')}` }]] };

  return bot.sendMessage(
    chatId,
    [
      'Проверка пройдена.',
      '',
      'Можно переходить к оплате beta-тарифа: 299 ₽.',
      paymentUrl ? 'После оплаты вернитесь в бот и нажмите “Помощь”, если потребуется связь.' : 'Ссылка на оплату скоро будет подключена. Пока можно написать менеджеру.',
    ].join('\n'),
    { reply_markup: inlineKeyboard }
  );
}

function showPayment(chatId) {
  if (paymentUrl) {
    return bot.sendMessage(chatId, 'Beta-тариф: 299 ₽', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Оплатить 299 ₽', url: paymentUrl }]],
      },
    });
  }

  return bot.sendMessage(
    chatId,
    [
      'Beta-тариф: 299 ₽',
      '',
      'Ссылка на оплату пока не подключена.',
      `Для оплаты напишите менеджеру: ${managerUsername}`,
    ].join('\n')
  );
}

bot.onText(/\/start/, (msg) => {
  mainMenu(msg.chat.id);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/start')) return;

  if (text === BUTTONS.menu) {
    await mainMenu(chatId);
    return;
  }

  const state = userState.get(chatId);

  if (state?.mode === 'checklist') {
    const item = checklist[state.step];

    if (text === BUTTONS.no) {
      await stopByChecklist(chatId, item);
      return;
    }

    if (text !== BUTTONS.yes) {
      await bot.sendMessage(chatId, 'Ответьте “Да” или “Нет”.', { reply_markup: yesNoKeyboard() });
      return;
    }

    state.answers.push({ key: item.key, answer: 'yes' });
    state.step += 1;

    if (state.step >= checklist.length) {
      await finishChecklist(chatId);
      return;
    }

    setState(chatId, state);
    await askChecklistQuestion(chatId);
    return;
  }

  if (text === BUTTONS.request) {
    await bot.sendMessage(
      chatId,
      [
        'Заявка с сайта создана.',
        '',
        'Теперь пройдите проверку перед сбросом. Если хоть где-то ответ “Нет”, сброс не делаем — сначала сохраняем данные.',
      ].join('\n')
    );
    await startChecklist(chatId);
    return;
  }

  if (text === BUTTONS.checklist) {
    await startChecklist(chatId);
    return;
  }

  if (text === BUTTONS.pay) {
    await showPayment(chatId);
    return;
  }

  if (text === BUTTONS.profile) {
    await bot.sendMessage(chatId, `Ваш Telegram ID: ${chatId}`);
    return;
  }

  if (text === BUTTONS.help) {
    await bot.sendMessage(chatId, `Связь: ${managerUsername}`);
    return;
  }

  await bot.sendMessage(chatId, 'Выберите действие в меню.', { reply_markup: mainKeyboard() });
});

console.log('IOSx bot is running');
