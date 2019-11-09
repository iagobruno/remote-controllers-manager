import { Screen } from '../../src'

const screen = new Screen({
  url: 'http://localhost:3000'
})

screen.onConnect(
  handleConnectionChange,
  (err) => console.log('%cUnable to connect to server!', 'color: red; font-weight: bold;', err),
)
screen.onDisconnect(handleConnectionChange)

screen.onReady(() => {
  console.log('%cSuccessfully connected to server', 'color: green; font-weight: bold;')

  handleControllersChange()
  screen.onNewControllerConnects(handleControllersChange)
  screen.onControllerDisconnects(handleControllersChange)
  screen.onMasterControllerIdChange(handleControllersChange)

  screen.onMessage((data, fromDeviceId) => {
    console.log(`Message from "${fromDeviceId}": "${data}"`)
  })
})

function handleConnectionChange() {
  document.querySelector('.isConnected')!.innerHTML = screen.isConnected ? 'CONNECTED' : 'DISCONNECTED'
}

function handleControllersChange() {
  document.querySelector('.totalOfControllers')!.innerHTML = `${screen.getTotalOfConnectedControllers()} Controllers | Master controller id = ${screen.getMasterControllerDeviceId()}`
}

// @ts-ignore
window.broadcast = () => {
  screen.broadcastToControllers('Hello controllers!')
}
// @ts-ignore
window.sendToMaster = () => {
  screen.unsafe_sendToMasterController('Hello master controller!')
}
