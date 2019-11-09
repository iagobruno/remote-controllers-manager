# remote-controllers-manager 💻🎮 ![EXPERIMENTAL ⚠](https://img.shields.io/badge/-EXPERIMENTAL%20%E2%9A%A0-red)

This package creates an abstraction on top of socket.io to easily manage devices (smartphones for example) that can act as a remote controller of you web app, similar to how [AirConsole](https://airconsole.com) works.

**This is a super experimental package** ⚠, I'm building it for personal usage in a project but if it gets good enough may I publish to npm and make some examples.

Examples of apps I have in mind:

- Peer-to-peer games.
- TV web app interfaces.
- Collaborative playlists for a party.

## Features

- ✅ Allows multiple controllers to connect to the screen.
- ✅ Set a limit of controllers that can connect simultaneously.
- ✅ Define if you need a master controller and what happens if it disconnects.
- ✅ Receive message from other devices.
- ✅ Broadcast message from screen to all controllers.
- ✅ Send message from screen to a specific controller.
- ✅ Send message from a controller to the screen.
- ✅ Broadcast message from a controller to other controllers.
- ✅ Check the connection state of the screen.
- ✅ Get total of connected controllers.
- ❌ Allow multiple separate rooms.
- ❌ Allow multiple screens per room.

## How to getting started

1. Install this repository as a dependency (yes, it's possible):

```bash
yarn add https://github.com/iagobruno/remote-controllers-manager socket.io
```

2. Create a Node server using [socket.io](https://socket.io/docs/server-api/) and apply the required middleware:

```js
import io from 'socket.io'
import { applyRCMMiddleware } from 'remote-controllers-manager'
import { green, blue } from 'colors'
const server = io.listen(3000)

applyRCMMiddleware(server, {
  // You can configure some behaviors.
  maxConnectedControllers: 4,
  needsAMasterController: true,
  ifMasterControllerDisconnects: 'waitHimReconnect',
})

console.log(green('⚡ Listening on port http://localhost:3000'))

```

3. Then create a "screen.js" file and instantiate the `Screen` class, like this:

```js
// screen.js
import { Screen } from 'remote-controllers-manager'

const screen = new Screen({
  url: 'http://localhost:3000'
})

screen.onReady(() => {
  console.log('Successfully connected to server!')
})
```

**Note that you will need a bundler.**

4. Create another file called "controller.js" and instantiate the `Controller` class:

```js
// controller.js
import { Controller } from 'remote-controllers-manager'

const controller = new Controller({
  url: 'http://localhost:3000'
})

controller.onReady(() => {
  console.log('Successfully joined to the room!')
})
```

Just that, the package will take care of managing all controllers that connect in the room.

You can now easily send messages to all devices connected, like that:

```js
// controller.js
// ...
document.querySelector('button').addEventListener('click', () => {
  controller.sendToScreen({ eventName: 'change_title' })
})
```

```js
// screen.js
// ...
screen.onMessage(({ eventName, data }) => {
  if (eventName === 'change_title') {
    // ...
  }
})

screen.onConnect(() => {
  screen.broadcastToControllers({ eventName: 'new_controller' })
})
```

You can check the client API in [this file](./src/client.ts).

## License

MIT License
