class TryAgain {
  constructor (config = {}) {
    this._config = Object.assign({
      delays: [],
      steadyTime: 5000
    }, config)
    this._checkConfig()
    this._parseDelays()
    this.retryTimeStamps = []
    this.resetHandler = null
    this.callbackMap = {}
    this.eventEnums = {
      RESET: 'reset',
      RETRY: 'retry',
      ERROR: 'error',
      FAIL: 'fail',
      SUCCESS: 'success',
      ALL: 'all'
    }
    this.statusEnums = {
      STOP: 'stop',
      RESUME: 'resume'
    }
    this.status = this.statusEnums.RESUME
    this.bufferRetrys = []
    this.runner = () => {}
  }
  monitor (func) {
    this.runner = func
    this._run()
  }
  // error, success, retry, reset, all
  on (event, callback) {
    let callbacks = this.callbackMap[event]
    if (!callbacks) {
      this.callbackMap[event] = [callback]
    } else {
      callbacks.push(callback)
    }
  }
  error (error) {
    clearTimeout(this.resetHandler)
    this._emit(this.eventEnums.ERROR, error)
    if (this.status === this.statusEnums.STOP) {
      this.bufferRetrys.push(this._getNowTime())
    } else {
      this._retry()
    }
  }
  success () {
    this._emit(this.eventEnums.SUCCESS)
    this.resetHandler = setTimeout(() => this._reset(), this._config.steadyTime)
  }
  stop () {
    this.status = this.statusEnums.STOP
  }
  resume () {
    this.status = this.statusEnums.RESUME
    if (this.bufferRetrys.length > 0) {
      this.bufferRetrys = []
      this._retry()
    }
  }
  _run () {
    this.runner(this)
  }
  _emit (event, data) {
    let callbacks = this.callbackMap[event]
    if (callbacks) {
      callbacks.forEach((callback) => {
        callback(event, data)
      })
    }
    let mustCalls = this.callbackMap[this.eventEnums.ALL]
    if (mustCalls) {
      mustCalls.forEach((callback) => {
        callback(event, data)
      })
    }
  }
  _retry () {
    this._emit(this.eventEnums.RETRY)
    let time = this._getNowTime()
    this.retryTimeStamps.push(time)
    let retryTimes = this.retryTimeStamps.length
    let delay = this._getDelay(retryTimes)
    if (delay === false) return this._fail()
    setTimeout(() => this._run(), delay)
  }
  _reset () {
    this._emit(this.eventEnums.RESET)
    this.retryTimeStamps = []
  }
  _fail () {
    this._emit(this.eventEnums.FAIL)
  }
  _parseDelays () {
    let map = {}
    let cursor = 1
    for (let delay of this._config.delays) {
      let arr = delay.toString().split('x')
      let repeat = arr[1] || 1
      if (repeat === '~') {
        // 后续所有的delay都用该值
        map[`${cursor}-~`] = arr[0]
        break
      } else {
        repeat = parseInt(repeat)
        map[`${cursor}-${cursor + repeat}`] = parseInt(arr[0])
        cursor += repeat
      }
    }
    this.parsedDelays = map
  }
  _getDelay (nthRetry) {
    let key = Object.keys(this.parsedDelays).find((range) => {
      let arr = range.split('-')
      let start = parseInt(arr[0])
      let end = arr[1] === '~' ? arr[1] : parseInt(arr[1])
      if (end === '~') {
        if (nthRetry >= start) return true
      } else {
        if (nthRetry >= start && nthRetry < end) return true
      }
    })
    return key ? this.parsedDelays[key] : false
  }
  _checkConfig () {
    let config = this._config
    let constrains = {
      delays: (delays) => {
        if (!(delays instanceof Array)) return false
        for (let item of delays) {
          if (!/^\d+(x[\d+|~])?$/.test(item)) {
            return false
          }
        }
        return true
      },
      steadyTime: (steadyTime) => /^\d+$/.test(steadyTime)
    }
    let keys = Object.keys(constrains)
    let errorKeys = []
    keys.forEach((key) => {
      if (!constrains[key](config[key])) {
        errorKeys.push(key)
      }
    })
    if (errorKeys.length > 0) {
      throw new Error(`config error, check this fields: ${JSON.stringify(errorKeys)}`)
    }
  }
  _getNowTime () {
    return Math.floor((new Date()).getTime() / 1000)
  }
}
module.exports = TryAgain
