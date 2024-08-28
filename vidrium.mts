import { ChildProcess } from "node:child_process";
import EventEmitter from "node:events";

export enum ParentAPIEvents {
    LOG = 'log',
    RESOURCE_REQUEST = 'getResource',
    QUESTION = 'questionForward',
}

export interface ParentAPIEventsMap {
    // Should contain ALL ParentApiEvents defined here.
    ["log"]: (message: VidriumConsoleMessage) => void;
    ["getResource"]: (resource: VidriumResourceRequest) => void;
    ["questionForward"]: (question: VidriumQuestion) => void;
}

export class ParentExecAPI extends EventEmitter {
    private childProcess: ChildProcess;
    constructor(childProcess: ChildProcess) {
        super();
        this.childProcess = childProcess;
        this.childProcess.stdout?.on("data", (data) => {
            const x = data.split(":");
            const opCode = x[0];
            const content = JSON.parse(Buffer.from(x[1], "base64").toString("utf8"));
            switch (opCode) {
                case "log":
                    this.emit(ParentAPIEvents.LOG, new VidriumConsoleMessage(content));
                    break;
                case "getResource":
                    this.emit(ParentAPIEvents.RESOURCE_REQUEST, new VidriumResourceRequest(content, [this, this.childProcess]));
                    break;
                case "questionForward":
                    this.emit(ParentAPIEvents.QUESTION, new VidriumQuestion(content, [this, this.childProcess]));
                    break;
            }
        });
    }
    on<K extends keyof ParentAPIEventsMap>(event: K, listener: ParentAPIEventsMap[K]): this {
        return super.on(event, listener);
    }

    emit<K extends keyof ParentAPIEventsMap>(event: K, ...args: Parameters<ParentAPIEventsMap[K]>): boolean {
        return super.emit(event, ...args);
    }
}

export class ParentAPI extends EventEmitter {
    private childProcess: ChildProcess;
    constructor(childProcess: ChildProcess) {
        super();
        this.childProcess = childProcess;
        this.childProcess.on("message", (m: any[]) => {
            this.handleMessage(m);
        })
    }

    private handleMessage(message: any[]) {
        const opcode = message[0];
        const content = message[1];

        switch (opcode) {
            case ParentAPIEvents.LOG:
                this.emit(ParentAPIEvents.LOG, new VidriumConsoleMessage(content));
                break;
            case ParentAPIEvents.QUESTION:
                this.emit(ParentAPIEvents.QUESTION, new VidriumQuestion(content, [this, this.childProcess]));
                break;
            case ParentAPIEvents.RESOURCE_REQUEST:
                this.emit(ParentAPIEvents.RESOURCE_REQUEST, new VidriumResourceRequest(content, [this, this.childProcess]));
                break;
        }
    }
    on<K extends keyof ParentAPIEventsMap>(event: K, listener: ParentAPIEventsMap[K]): this {
        return super.on(event, listener);
    }

    emit<K extends keyof ParentAPIEventsMap>(event: K, ...args: Parameters<ParentAPIEventsMap[K]>): boolean {
        return super.emit(event, ...args);
    }
}

class ChildAPI {
    public log(c: any) {
        process.send?.(["log", c]);
    }

    public async questionForward(q: any) {
        process.send?.(["questionForward", q]);
        return (new Promise((resolve, reject) => {
            process.once("message", async (m: any[]) => {
                const msgOpcode = m[0]; const msgContent = m[1];
                if (msgOpcode == "questionForwardResponse") {
                    resolve(msgContent);
                }
            })
        }));
    }

    public async getResource(r: any) {
        process.send?.(["getResource", r]);
        return (new Promise((resolve, reject) => {
            process.once("message", async (m: any[]) => {
                const msgOpcode = m[0]; const msgContent = m[1];
                if (msgOpcode == "sendResource") {
                    const x = msgContent.split("/C/:VRTX:/C/");
                    const resource = x[0];
                    const value = x[1];
                    if (Buffer.from(resource, "base64").toString("utf8") == r) { resolve(JSON.parse(Buffer.from(value, "base64").toString("utf8"))); }
                }
            })
        }));
    }

    public exit() { process.exit() }

}

class ChildExecAPI {
    // Estas se ejecutarán desde el proceso CHILD.
    public log(c: any) {
        process.stdout.write(`log:${Buffer.from(JSON.stringify(c), "utf8").toString("base64")}`, "utf8");
    }

    public async getResource(r: string) {
        return new Promise((resolve, reject) => {
            process.stdout.write(`getResource:${Buffer.from(JSON.stringify(r), "utf8").toString("base64")}`, "utf8");
            process.stdin.once("data", (d: any) => {
                const x = d.toString().split(":");
                const opCode = x[0];
                const resource = JSON.parse(Buffer.from(x[1], "base64").toString("utf8"));
                if (opCode == "sendResource") {
                    resolve(resource.value);
                }
            });
        });
    }

    public async questionForward(q: string) {
        return (new Promise((resolve) => {
            process.stdout.write(`questionForward:${Buffer.from(JSON.stringify(q), "utf8").toString("base64")}`, "utf8");
            // childProcess.stdin?.write(`questionForwardResponse:${Buffer.from(JSON.stringify(answer), "utf8").toString("base64")}`);
            process.stdin.once("data", (d: any) => {
                const x = d.toString().split(":");
                const opCode = x[0];
                if (opCode == "questionForwardResponse") {
                    const answer = JSON.parse(Buffer.from(x[1], "base64").toString("utf8"));
                    resolve(answer);
                }

            })
        }));
    }

    public exit() { process.exit(); }
}

class VidriumConsoleMessage {
    public content: any;
    constructor(message: any) {
        this.content = message;
    }
}
class VidriumResourceRequest {
    public id: string;
    private properties: [any, ChildProcess];
    constructor(resource: string, properties: [any, ChildProcess]) {
        this.id = resource;
        this.properties = properties;
    }
    public async send(id: string, value: any) {
        if(this.properties[0] instanceof ParentExecAPI) {
            this.properties[1].stdin?.write(`sendResource:${Buffer.from(JSON.stringify({id: id, value: value}), "utf8").toString("base64")}`);
        }
        if (this.properties[0] instanceof ParentAPI) {
            this.properties[1].send(["sendResource", Buffer.from(id, "utf8").toString("base64") + "/C/:VRTX:/C/" + Buffer.from(JSON.stringify(value), "utf8").toString("base64")]);
        }
    }
}

class VidriumQuestion {
    public content: string;
    private properties: [any, ChildProcess];
    constructor(content: string, properties: [any, ChildProcess]) {
        this.content = content;
        this.properties = properties
    }
    public async respond(response: string) {
        if(this.properties[0] instanceof ParentExecAPI) {
            this.properties[1].stdin?.write(`questionForwardResponse:${Buffer.from(JSON.stringify(response), "utf8").toString("base64")}`);
        }
        if(this.properties[0] instanceof ParentAPI) {
            this.properties[1].send(["questionForwardResponse", response]);
        }
    }
}

export default {
    version: "1.3.0",
    childAPI: new ChildAPI(),
    childExecAPI: new ChildExecAPI(),
}