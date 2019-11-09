import { Controller } from '../../src'

const controller = new Controller({
  url: 'http://localhost:3000'
})

controller.onConnect(
  handleConnectionChange,
  (err) => console.log('%cUnable to connect to server!', 'color: red; font-weight: bold;', err),
)
controller.onDisconnect(handleConnectionChange)

controller.onReady(() => {
  console.log('%cSuccessfully connected to server', 'color: green; font-weight: bold;')

  handleIsMasterControllerChange()
  controller.onMasterControllerIdChange(handleIsMasterControllerChange)
  controller.onScreenConnectionChanges(handleIsScreenConnected)

  controller.onMessage((data, fromDeviceId) => {
    console.log(`Message from "${fromDeviceId}": "${data}"`)
  })
})


function handleConnectionChange() {
  document.querySelector('.isConnected').innerHTML = controller.isConnected ? `CONNECTED! Device ID = ${controller.getDeviceId()}` : 'DISCONNECTED'
}

function handleIsMasterControllerChange() {
  document.querySelector('.isMasterController').innerHTML = controller.isMasterController ? 'This device IS the master controller' : 'This device is NOT the master controller.'
}

function handleIsScreenConnected() {
  document.querySelector('.isScreenConnected').innerHTML = controller.isScreenConnected ? 'The screen IS connected' : 'The screen IS NOT connected'
}

// @ts-ignore
window.sendToScreen = () => {
  controller.sendToScreen('Hello screen')
}
// @ts-ignore
window.sendToMaster = () => {
  controller.unsafe_sendToMasterController('Hello master controller')
}
// @ts-ignore
window.sendToOthers = () => {
  controller.unsafe_broadcastToOtherControllers('Hello controllers!')
}
