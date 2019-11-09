import { Screen } from '../../src'

const screen = new Screen({
  uri: 'http://localhost:3000'
})

screen.onReady(() => {
  console.log('%cSuccessfully connected to server', 'color: green; font-weight: bold;')

  handleControllersChange()
  screen.onConnect(handleControllersChange)
  screen.onDisconnect(handleControllersChange)
  screen.onMasterControllerIdChange(handleControllersChange)

  screen.onMessage((data, fromDeviceId) => {
    console.log(`Message from "${fromDeviceId}": "${data}"`)
  })
})

screen.onDeviceConnectionStateChange(handleConnectionChange)

function handleConnectionChange() {
  document.querySelector('.isConnected')!.innerHTML = screen.isConnected ? 'CONNECTED' : 'DISCONNECTED'
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
