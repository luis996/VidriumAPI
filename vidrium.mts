import { ChildProcess } from "node:child_process";
import EventEmitter from "node:events";

export enum ParentAPIEvents {
    LOG = 'log',
    RESOURCE_REQUEST = 'getResource',
    QUESTION = 'questionForward',
}

export interface ParentAPIEventsMap {
    // Should contain ALL ParentApiEvents defined here.
    ["log"]: (message: string) => void;
    ["getResource"]: (payload: { id: string, send: (name: string, value: any) => Promise<void> }) => void;
    ["questionForward"]: (payload: { content: string, respond: (answer: string) => Promise<void> }) => void;
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
                    this.emit(ParentAPIEvents.LOG, content);
                    break;
                case "getResource":
                    this.emit(ParentAPIEvents.RESOURCE_REQUEST, { id: content, async send(name, value) {
                        if (name == content) {
                            childProcess.stdin?.write(`sendResource:${Buffer.from(JSON.stringify({name: name, value: value}), "utf8").toString("base64")}`);
                        }
                    }, });
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
                this.emit(ParentAPIEvents.LOG, content);
                break;
            case ParentAPIEvents.QUESTION:
                this.emit(ParentAPIEvents.QUESTION, {
                    content, respond: async (answer: string) => {
                        this.childProcess.send(["questionForwardResponse", answer]);
                    }
                });
                break;
            case ParentAPIEvents.RESOURCE_REQUEST:
                this.emit(ParentAPIEvents.RESOURCE_REQUEST, {
                    id: content, send: async (name: string, value: any) => {
                        this.childProcess.send(["sendResource", Buffer.from(name, "utf8").toString("base64") + "/C/:VRTX:/C/" + Buffer.from(JSON.stringify(value), "utf8").toString("base64")]);
                    }
                });
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
    public log(c: any) {
        process.stdout.write(`log:${Buffer.from(JSON.stringify(c), "utf8").toString("base64")}`, "utf8");
    }

    public getResource(r: string) {
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

    public exit() { process.exit(); }
}

export default {
    version: "1.2.2",
    childAPI: new ChildAPI(),
    childExecAPI: new ChildExecAPI(),
}