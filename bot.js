Да, бро, вот полный актуальный `bot.js`:

```js
const token = process.env.TELEGRAM_BOT_TOKEN;
const managerUsername = process.env.MANAGER_USERNAME || '@iosx_support_bot';
const paymentUrl = process.env.PAYMENT_URL || '';

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

const apiBase = `https://api.telegram.org/bot${token}`;
const userState = new Map();

const BUTTONS = {
  langRu: '🇷🇺 Русский',
  langEn: '🇬🇧 English',
  langZh: '🇨🇳 中文',
  pay: '💳 Оплатить 299 ₽',
  paid: '✅ Я оплатил',
  profile: '👤 Профиль',
  help: '💬 Помощь',
  yes: 'Да',
  no: 'Нет',
  menu: 'Главное меню',
};

function languageKeyboard() {
  return {
    resize_keyboard: true,
    one_time_keyboard: true,
    keyboard: [
      [BUTTONS.langRu],
      [BUTTONS.langEn],
      [BUTTONS.langZh],
    ],
  };
}

const checklist = [
  ['1. Фото и видео сохранены?', 'Сначала включите Google Фото или перенесите фото/видео на ПК/флешку.'],
  ['2. Контакты сохранены?', 'Сначала синхронизируйте контакты с Google-аккаунтом.'],
  ['3. WhatsApp / Telegram / важные чаты сохранены?', 'Сначала сделайте резервную копию в нужном приложении.'],
  ['4. Пароли и аккаунты известны?', 'Сначала восстановите доступы до сброса.'],
  ['5. Google-аккаунт и пароль точно помните?', 'Сброс делать нельзя. Сначала восстановите доступ к Google-аккаунту.'],
  ['6. Важные файлы скачаны или перенесены?', 'Сначала перенесите файлы в Google Drive, на ПК или флешку.'],
  ['7. SIM, банковские приложения и 2FA готовы?', 'Сначала проверьте доступы, SIM и коды восстановления.'],
  ['8. Заряд телефона выше 50%?', 'Сначала зарядите телефон минимум до 50%.'],
];

function mainKeyboard() {
  return {
    resize_keyboard: true,
    keyboard: [
      [BUTTONS.pay],
      [BUTTONS.paid],
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

async function telegram(method, payload) {
  const res = await fetch(`${apiBase}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram API error: ${method}`);
  }
  return data.result;
}

function sendMessage(chatId, text, replyMarkup) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
    disable_web_page_preview: true,
  });
}

function setState(chatId, state) {
  userState.set(chatId, state);
}

function clearState(chatId) {
  userState.delete(chatId);
}

function mainMenu(chatId) {
  clearState(chatId);
  return sendMessage(
    chatId,
    [
      'IOSx',
      '',
      'Мы уже получили вашу заявку.',
      'Следующий шаг — оплатить beta-тариф: 299 ₽.',
      '',
      'Проверка перед сбросом будет сразу после оплаты.',
    ].join('\n'),
    mainKeyboard()
  );
}

function chooseLanguage(chatId) {
  clearState(chatId);
  return sendMessage(chatId, 'Выберите язык', languageKeyboard());
}

function askChecklistQuestion(chatId) {
  const state = userState.get(chatId);
  const item = checklist[state.step];

  return sendMessage(
    chatId,
    `${item[0]}\n\nЕсли нет — лучше остановиться и сначала сохранить данные.`,
    yesNoKeyboard()
  );
}

function startChecklist(chatId) {
  setState(chatId, { mode: 'checklist', step: 0 });
  return askChecklistQuestion(chatId);
}

function stopByChecklist(chatId, item) {
  clearState(chatId);
  return sendMessage(
    chatId,
    [
      'Стоп. Сброс пока не делаем.',
      '',
      item[1],
      '',
      'Когда всё будет готово, вернитесь и пройдите проверку заново.',
    ].join('\n'),
    mainKeyboard()
  );
}

function finishChecklist(chatId) {
  clearState(chatId);
  return sendMessage(
    chatId,
    [
      'Проверка пройдена.',
      '',
      'Теперь можно продолжать настройку Android-устройства.',
      `Если нужна помощь — напишите менеджеру: ${managerUsername}`,
    ].join('\n'),
    mainKeyboard()
  );
}

function showPayment(chatId) {
  if (paymentUrl) {
    return sendMessage(chatId, 'Beta-тариф: 299 ₽', {
      inline_keyboard: [[{ text: 'Оплатить 299 ₽', url: paymentUrl }]],
    });
  }

  return sendMessage(
    chatId,
    [
      'Beta-тариф: 299 ₽',
      '',
      'Ссылка на оплату пока не подключена.',
      `Для оплаты напишите менеджеру: ${managerUsername}`,
    ].join('\n')
  );
}

function showHelp(chatId) {
  return sendMessage(
    chatId,
    [
      'Помощь IOSx',
      '',
      '1. Это безопасно?',
      'Да. Перед любыми действиями бот проводит проверку, чтобы вы не потеряли фото, контакты, чаты и доступы.',
      '',
      '2. Мои данные удалятся?',
      'Данные могут удалиться только при сбросе телефона. Поэтому мы сначала проверяем, всё ли сохранено.',
      '',
      '3. Если я отвечу “Нет” в проверке?',
      'Мы останавливаем процесс. Сначала нужно сохранить данные, и только потом продолжать.',
      '',
      '4. Зачем нужна оплата до проверки?',
      'Оплата подтверждает заявку. После оплаты бот сразу запускает проверку перед сбросом.',
      '',
      '5. Что если я уже оплатил?',
      'Нажмите “✅ Я оплатил”, и бот запустит проверку.',
      '',
      '6. Нужно ли знать пароль от Google-аккаунта?',
      'Да. Если пароль не помните, сброс делать нельзя — сначала восстановите доступ.',
      '',
      '7. Подходит ли сервис для моего Android?',
      'В большинстве случаев да. Если есть сомнения, напишите менеджеру и укажите модель телефона.',
      '',
      '8. Сколько времени занимает настройка?',
      'Обычно быстро, но зависит от телефона, интернета и того, готовы ли резервные копии.',
      '',
      '9. Что делать, если я боюсь потерять фото или чаты?',
      'Не делайте сброс. Пройдите проверку и остановитесь на пункте, где не уверены.',
      '',
      '10. Можно связаться с человеком?',
      `Да. Менеджер: ${managerUsername}`,
    ].join('\n'),
    mainKeyboard()
  );
}

async function showPaidNextStep(chatId) {
  await sendMessage(
    chatId,
    [
      'Оплату отметили.',
      '',
      'Теперь пройдите проверку перед сбросом. Если хоть где-то ответ “Нет”, сброс не делаем — сначала сохраняем данные.',
    ].join('\n')
  );
  await startChecklist(chatId);
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || '';

  if (text === '/start') {
    await chooseLanguage(chatId);
    return;
  }

  if ([BUTTONS.langRu, BUTTONS.langEn, BUTTONS.langZh].includes(text)) {
    await mainMenu(chatId);
    return;
  }

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
      await sendMessage(chatId, 'Ответьте “Да” или “Нет”.', yesNoKeyboard());
      return;
    }

    state.step += 1;
    if (state.step >= checklist.length) {
      await finishChecklist(chatId);
      return;
    }

    setState(chatId, state);
    await askChecklistQuestion(chatId);
    return;
  }

  if (text === BUTTONS.pay) {
    await showPayment(chatId);
    return;
  }

  if (text === BUTTONS.paid) {
    await showPaidNextStep(chatId);
    return;
  }

  if (text === BUTTONS.profile) {
    await sendMessage(chatId, `Ваш Telegram ID: ${chatId}`);
    return;
  }

  if (text === BUTTONS.help) {
    await showHelp(chatId);
    return;
  }

  await sendMessage(chatId, 'Выберите действие в меню.', mainKeyboard());
}

async function poll() {
  let offset = 0;
  console.log('IOSx bot is running');

  while (true) {
    try {
      const updates = await telegram('getUpdates', {
        offset,
        timeout: 30,
        allowed_updates: ['message'],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) {
          await handleMessage(update.message);
        }
      }
    } catch (error) {
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

poll();
```
