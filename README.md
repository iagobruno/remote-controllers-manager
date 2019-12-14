# remote-controllers-manager 💻🎮 ![EXPERIMENTAL ⚠](https://img.shields.io/badge/-EXPERIMENTAL%20%E2%9A%A0-red) ![npm](https://img.shields.io/npm/v/remote-controllers-manager)

This package creates an abstraction on top of socket.io to easily manage devices (smartphones for example) that can act as a remote controller of you web app, similar to how [AirConsole](https://airconsole.com) works.

**This is a super experimental package** ⚠, I'm building it for personal usage in a project but if it gets good enough may I publish a stable version on npm and write complete documentation.

<!-- ![type definitions](https://img.shields.io/npm/types/remote-controllers-manager) -->

Examples of apps I have in mind:

- Peer-to-peer games.
- TV web app interfaces.
- Collaborative playlists for parties.

## Features

- ✅ Allows multiple controllers to connect to a screen.
- ✅ Define if you need a master controller and what happens if it disconnects.
- ✅ Send messages from one device to another.
- ✅ Allow multiple separate rooms.

## Getting started

1. Install the packages:

```bash
yarn add remote-controllers-manager socket.io socket.io-client
```

2. Create a Node server using [socket.io](https://socket.io/docs/server-api/) and apply the required middleware:

```js
import * as io from 'socket.io'
import { applyRCMMiddleware } from 'remote-controllers-manager/server'
import { green, blue } from 'colors'
const server = io.listen(3000)

applyRCMMiddleware(server, {
  // You can configure some behaviors.
  maxControllersPerRoom: 4,
  eachRoomNeedsAMasterController: true,
  ifMasterControllerDisconnects: 'waitReconnect',
})

console.log(green('⚡ Listening on port http://localhost:3000'))
```

3. Then create a "screen.js" file and instantiate the `Screen` class, like this:

**Note that you will need a bundler.**

```js
// screen.js
import * as io from 'socket.io-client'
import { Screen } from 'remote-controllers-manager/client'

const screen = new Screen({
  io,
  uri: 'http://localhost:3000',
})

screen.start().then(() => {
  console.log('Successfully connected to server!')

  // Show screen id so user can connect
  document.body.innerHTML = `SCREEN_ID = ${screen.deviceId}`
})
```

4. Create another file called "controller.js" and instantiate the `Controller` class:

```js
// controller.js
import * as io from 'socket.io-client'
import { Controller } from 'remote-controllers-manager/client'

const controller = new Controller({
  io,
  uri: 'http://localhost:3000',
})

controller.connectToScreen('<SCREEN_ID>').then(() => {
  console.log('Successfully connected to screen!')
})
```

Just that, the package will take care of managing all controllers that connect in the room.

You can now easily send messages to all connected devices, like that:

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

## Documentation

The documentation is not written yet because the package needs to be refined, but you can see what the final API will looks like in [this file](./src/client.ts).

## License

MIT License
