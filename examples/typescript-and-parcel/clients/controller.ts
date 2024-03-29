import * as io from 'socket.io-client'
import { Controller } from 'remote-controllers-manager/client'

const controller = new Controller({
  io,
  uri: 'http://localhost:3000',
})

// @ts-ignore
window.socket = controller.socket

function handleConnectionChange() {
  document.querySelector('.isConnected').innerHTML = controller.isConnected ? `CONNECTED! Device ID = ${controller.deviceId}` : 'DISCONNECTED'
}

function handleIsMasterControllerChange() {
  document.querySelector('.isMasterController').innerHTML = controller.isMasterController ? 'This device IS the master controller' : 'This device is NOT the master controller.'
}

function handleIsScreenConnected() {
  document.querySelector('.isScreenConnected').innerHTML = controller.isScreenConnected ? 'The screen IS connected' : 'The screen IS NOT connected'
}

function onReady() {
  console.log('%cSuccessfully connected to server', 'color: green; font-weight: bold;')

  handleIsMasterControllerChange()
  controller.onMasterControllerIdChange(handleIsMasterControllerChange)
  controller.onScreenConnectionStateChange(handleIsScreenConnected)
  controller.onDeviceConnectionStateChange(handleConnectionChange)

  controller.onMessage((data, fromDeviceId) => {
    console.log(`Message from "${fromDeviceId}": "${data}"`)
  })
}

// @ts-ignore
window.connect = () => {
  const roomId = prompt('Enter the room ID. (You can get the id on the screen tab)')
  controller.connectToScreen(roomId)
    .then(onReady)
    .catch((err) => console.error('ERROR AO SE CONECTAR!', err))
}
// @ts-ignore
window.sendToScreen = () => {
  controller.sendToScreen('Hello screen')
}
// @ts-ignore
window.sendToMaster = () => {
  controller.sendToMasterController('Hello master controller')
}
// @ts-ignore
window.sendToOthers = () => {
  controller.unsafe_broadcastToOtherControllers('Hello controllers!')
}
