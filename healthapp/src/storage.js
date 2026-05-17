// localStorage wrapper — works on phone browsers & PWA

const PREFIX = 'vht_'

export const store = {
  get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
      return true
    } catch (e) {
      // Storage full — prune oldest logs
      if (e.name === 'QuotaExceededError') {
        const logs = this.get('logs') || []
        if (logs.length > 100) {
          this.set('logs', logs.slice(0, 80))
          return this.set(key, value)
        }
      }
      return false
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key)
      return true
    } catch {
      return false
    }
  }
}
