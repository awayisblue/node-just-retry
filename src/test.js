const Retry = require('./index')

let retry = new Retry({
  delays: ['1000', '2000x2', '1000x~'],
  steadyTime: 3000
})
retry.on('all', function (event, data) {
  console.log(event)
})
function runner (retry) {
  retry.success()
  console.log('runner')
  setTimeout(() => retry.error(), 1000)
}
retry.monitor(runner)
