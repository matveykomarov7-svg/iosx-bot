import { existsSync, readFileSync } from 'node:fs';

function loadEnv(path = '.env') {
  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ||= value;
  }
}

loadEnv();

const token = process.env.TELEGRAM_BOT_TOKEN;
const managerUsername = process.env.MANAGER_USERNAME || '@iosx_support_bot';
const requestsApiUrl = process.env.REQUESTS_API_URL || '';

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

const apiBase = `https://api.telegram.org/bot${token}`;
const userState = new Map();
const handledMessages = new Set();

const BUTTONS = {
  langRu: '🇷🇺 Русский',
  langEn: '🇬🇧 English',
  langZh: '🇨🇳 中文',
  pay: '💳 Перейти к оплате',
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
      [BUTTONS.help],
      [BUTTONS.profile],
    ],
  };
}

function requestKeyboard() {
  return {
    resize_keyboard: true,
    keyboard: [
      [BUTTONS.pay],
      [BUTTONS.help],
      [BUTTONS.profile],
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

function getStartPayload(text) {
  const match = text.match(/^\/start(?:\s+(.+))?$/);
  return match ? match[1]?.trim() || '' : '';
}

function isRequestId(value) {
  return /^IOSX-\d{5}$/i.test(value);
}

async function requestApi(action, payload) {
  if (!requestsApiUrl) {
    throw new Error('REQUESTS_API_URL is not configured');
  }

  const res = await fetch(requestsApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await res.json();
  if (data.status !== 'success') {
    throw new Error(data.message || 'Requests API error');
  }

  return data;
}

async function loadRequest(requestId, user) {
  return requestApi('getRequest', {
    requestId,
    telegramId: String(user.id),
    telegramUsername: user.username || '',
  });
}

function mainMenu(chatId) {
  clearState(chatId);
  return sendMessage(
    chatId,
    [
      'IOSx',
      '',
      'Мы уже получили вашу заявку.',
      '',
      'Выберите нужный раздел в меню.',
    ].join('\n'),
    mainKeyboard()
  );
}

async function showRequest(chatId, requestId, user) {
  try {
    const data = await loadRequest(requestId, user);
    const request = data.request;

    if (request.autoStatus === 'Просрочена') {
      await sendMessage(
        chatId,
        [
          'Срок действия заявки истек.',
          '',
          'Пожалуйста, создайте новую заявку на сайте.',
        ].join('\n'),
        mainKeyboard()
      );
      return;
    }

    setState(chatId, {
      mode: 'request',
      requestId,
      request,
    });

    await sendMessage(
      chatId,
      [
        `Заявка ${request.id} найдена`,
        '',
        `Устройство: ${request.device || 'не указано'}`,
        `Процессор: ${request.processor || 'не указан'}`,
        `Проблема: ${request.comment || 'не указана'}`,
        '',
        `Статус: ${request.status || 'Новая'}`,
        `Оплата: ${request.paymentStatus || 'pending'}`,
        `Осталось: ${request.timeLeft || 'до 2 часов'}`,
        '',
        'Чтобы продолжить, перейдите к оплате.',
      ].join('\n'),
      requestKeyboard()
    );
  } catch (error) {
    await sendMessage(
      chatId,
      [
        'Не смог найти заявку.',
        '',
        'Проверьте ссылку из сайта или создайте заявку заново.',
        `Если нужна помощь — напишите менеджеру: ${managerUsername}`,
      ].join('\n'),
      mainKeyboard()
    );
  }
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
      '4. Нужно ли знать пароль от Google-аккаунта?',
      'Да. Если пароль не помните, сброс делать нельзя — сначала восстановите доступ.',
      '',
      '5. Подходит ли сервис для моего Android?',
      'В большинстве случаев да. Если есть сомнения, напишите менеджеру и укажите модель телефона.',
      '',
      '6. Сколько времени занимает настройка?',
      'Обычно быстро, но зависит от телефона, интернета и того, готовы ли резервные копии.',
      '',
      '7. Что делать, если я боюсь потерять фото или чаты?',
      'Не делайте сброс. Пройдите проверку и остановитесь на пункте, где не уверены.',
      '',
      '8. Можно связаться с человеком?',
      `Да. Менеджер: ${managerUsername}`,
    ].join('\n'),
    mainKeyboard()
  );
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const messageKey = `${chatId}:${message.message_id}`;

  if (handledMessages.has(messageKey)) {
    return;
  }
  handledMessages.add(messageKey);

  const startPayload = getStartPayload(text);
  if (startPayload && isRequestId(startPayload)) {
    await showRequest(chatId, startPayload.toUpperCase(), message.from || {});
    return;
  }

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

  if (text === BUTTONS.profile) {
    const requestState = userState.get(chatId);
    if (requestState?.mode === 'request') {
      await sendMessage(
        chatId,
        [
          'Профиль IOSx',
          '',
          `Статус заявки: ${requestState.request?.status || 'получена'}`,
          `Этап: ${requestState.request?.paymentStatus === 'paid' ? 'оплачена' : 'ожидает оплаты'}`,
        ].join('\n'),
        requestKeyboard()
      );
      return;
    }

    await sendMessage(
      chatId,
      [
        'Профиль IOSx',
        '',
        'Статус заявки: получена',
        'Этап: подготовка к настройке Android',
      ].join('\n'),
      mainKeyboard()
    );
    return;
  }

  if (text === BUTTONS.pay) {
    const requestState = userState.get(chatId);
    if (requestState?.mode === 'request') {
      await sendMessage(
        chatId,
        [
          `Оплата заявки ${requestState.requestId}`,
          '',
          'Платежный способ сейчас подключаем.',
          `Для оплаты напишите менеджеру: ${managerUsername}`,
        ].join('\n'),
        requestKeyboard()
      );
      return;
    }

    await sendMessage(chatId, 'Сначала откройте заявку по ссылке с сайта.', mainKeyboard());
    return;
  }

  if (text === BUTTONS.help) {
    await showHelp(chatId);
    return;
  }

  await sendMessage(chatId, 'Выберите действие в меню.', mainKeyboard());
}

async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message);
  }
}

async function poll() {
  let offset = await dropPendingUpdates();
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
        await handleUpdate(update);
      }
    } catch (error) {
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function dropPendingUpdates() {
  let nextOffset = 0;

  while (true) {
    const updates = await telegram('getUpdates', {
      offset: nextOffset,
      timeout: 0,
      limit: 100,
      allowed_updates: ['message'],
    });

    if (updates.length === 0) {
      return nextOffset;
    }

    nextOffset = updates.at(-1).update_id + 1;
  }
}

poll();
