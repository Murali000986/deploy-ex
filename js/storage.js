class Storage {
  static save(key, data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: data }, resolve);
    });
  }

  static get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (res) => resolve(res[key] ?? null));
    });
  }

  static remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], resolve);
    });
  }

  static clear() {
    return new Promise((resolve) => chrome.storage.local.clear(resolve));
  }

  static async saveLogs(entry) {
    const logs = (await this.get('logs')) || [];
    logs.push({ timestamp: new Date().toISOString(), ...entry });
    while (logs.length > 100) logs.shift();
    await this.save('logs', logs);
  }

  static async getLogs() {
    return (await this.get('logs')) || [];
  }

  static async clearLogs() {
    await this.remove('logs');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Storage };
}
