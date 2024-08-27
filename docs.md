# log
- This event can only be sent from the child process to the parent process. It enables printing messages to the console, from the child side.

Usage on parent:
```
import * as vrtxapi from './libs/internal/vrtxapi.mjs';
import childProcess from 'node:child_process';

const child = childProcess.fork("./libs/child.mjs");
const ParentAPI = new vrtxapi.ParentAPI(child);

// Forward child log request to the parent.
ParentAPI.on(vrtxapi.ParentAPIEvents.LOG, (message) => { console.log("message"); });
```
Usage on child:

```
import * as vrtxapi from './internal/vrtxapi.mjs';

// Just print something to the console.
vrtxapi.log("Hello World!");
```

# getResource && sendResource
- getResource can only be sent from the child process. Meanwhile sendResource can only be sent from the parent process.
- These events can be used to send resources between the parent and child processes. The resource can ONLY be a string.

Usage on parent:
```
import * as vrtxapi from './libs/internal/vrtxapi.mjs';
import childProcess from 'node:child_process';

const child = childProcess.fork("./libs/child.mjs");
const ParentAPI = new vrtxapi.ParentAPI(child);

// setup a public variable where all the resources are.
var _public_ = {
    "resource1": "Mati Es Gay =",
    "waza": "si"
}
// Send the required resource, letting vidrium verify by id.
ParentAPI.on(vrtxapi.ParentAPIEvents.RESOURCE_REQUEST, async (r)=>{r.send(r.id,_public_[r.id])});
```
Usage on child:
```
import * as vrtxapi from './internal/vrtxapi.mjs'
// Get the resource from the parent.
(async () => {
    const resource1 = await vrtxapi.getResource("resource1");
    const matigay = await vrtxapi.getResource("waza");

    vrtxapi.log(`${resource1} ${matigay}`);
})();
```

# questionForward
- This event can be used to send questions from the child process to the parent process, and get the user input.
- The question and user input SHOULD be strings.
- The user input will be sent back to the child process as a string.

Usage on parent:
```
import * as vrtxapi from './libs/internal/vrtxapi.mjs';
import childProcess from 'node:child_process';
import readline from 'node:readline/promises';

const child = childProcess.fork("./libs/child.mjs");
const ParentAPI = new vrtxapi.ParentAPI(child);

// Setup the question listener with readline.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

ParentAPI.on(vrtxapi.ParentAPIEvents.QUESTION, async (question) => {const response = await rl.question(question.content); question.respond(response); }); // (Forward the question content to readline and respond to the child process using the user input)

```
Usage on child:
```
import * as vrtxapi from './libs/internal/vrtxapi.mjs';

(async () => {
    const print = await vrtxapi.questionForward("Print string: ");
    vrtxapi.log(print);
})();

```
- vrtxapi questionForward method already awaits for questionForwardResponse event, so it won't be covered.