import * as io from 'socket.io-client'
import { Screen } from 'remote-controllers-manager/client'

const screen = new Screen({
  io,
  uri: 'http://localhost:3000',
})

// @ts-ignore
window.screen = screen
// @ts-ignore
window.socket = screen.socket

screen.socket.on('error', console.log)

screen.start().then(() => {
  console.log('%cSuccessfully connected to server', 'color: green; font-weight: bold;')

  screen.onDeviceConnectionStateChange(handleConnectionChange)
  handleControllersChange()
  screen.onConnect(handleControllersChange)
  screen.onDisconnect(handleControllersChange)
  screen.onMasterControllerIdChange(handleControllersChange)

  screen.onMessage((data, fromDeviceId) => {
    console.log(`Message from "${fromDeviceId}": "${data}"`)
  })
})

function handleConnectionChange() {
  document.querySelector('.isConnected')!.innerHTML = screen.isConnected ? `CONNECTED! Screen ID = ${screen.deviceId}` : 'DISCONNECTED'
}

function handleControllersChange() {
  document.querySelector('.totalOfControllers')!.innerHTML = `${screen.totalOfConnectedControllers} Controllers | Master controller id = ${screen.masterControllerDeviceId}`
}

// @ts-ignore
window.broadcast = () => {
  screen.broadcastToControllers('Hello controllers!')
}
// @ts-ignore
window.sendToMaster = () => {
  screen.sendToMasterController('Hello master controller!')
}
