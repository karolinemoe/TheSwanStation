// Home Assistant integration. Leave homeAssistantUrl empty to disable.
window.SWAN_CONFIG = {
  homeAssistantUrl: 'http://192.168.10.68',
  webhooks: {
    alarm: 'swan-alarm-66afc52376569bc0', // fired when the 4:00 window opens
    reset: 'swan-reset-afe5194616df7895', // fired when the code is accepted
  },
};
