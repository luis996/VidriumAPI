var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import EventEmitter from "node:events";
export var ParentAPIEvents;
(function (ParentAPIEvents) {
    ParentAPIEvents["LOG"] = "log";
    ParentAPIEvents["RESOURCE_REQUEST"] = "getResource";
    ParentAPIEvents["QUESTION"] = "questionForward";
})(ParentAPIEvents || (ParentAPIEvents = {}));
export class ParentExecAPI extends EventEmitter {
    constructor(childProcess) {
        var _a;
        super();
        this.childProcess = childProcess;
        (_a = this.childProcess.stdout) === null || _a === void 0 ? void 0 : _a.on("data", (data) => {
            const x = data.split(":");
            const opCode = x[0];
            const content = JSON.parse(Buffer.from(x[1], "base64").toString("utf8"));
            switch (opCode) {
                case "log":
                    this.emit(ParentAPIEvents.LOG, content);
                    break;
                case "getResource":
                    this.emit(ParentAPIEvents.RESOURCE_REQUEST, { id: content, send(name, value) {
                            return __awaiter(this, void 0, void 0, function* () {
                                var _a;
                                if (name == content) {
                                    (_a = childProcess.stdin) === null || _a === void 0 ? void 0 : _a.write(`sendResource:${Buffer.from(JSON.stringify({ name: name, value: value }), "utf8").toString("base64")}`);
                                }
                            });
                        }, });
                    break;
            }
        });
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
}
export class ParentAPI extends EventEmitter {
    constructor(childProcess) {
        super();
        this.childProcess = childProcess;
        this.childProcess.on("message", (m) => {
            this.handleMessage(m);
        });
    }
    handleMessage(message) {
        const opcode = message[0];
        const content = message[1];
        switch (opcode) {
            case ParentAPIEvents.LOG:
                this.emit(ParentAPIEvents.LOG, content);
                break;
            case ParentAPIEvents.QUESTION:
                this.emit(ParentAPIEvents.QUESTION, {
                    content, respond: (answer) => __awaiter(this, void 0, void 0, function* () {
                        this.childProcess.send(["questionForwardResponse", answer]);
                    })
                });
                break;
            case ParentAPIEvents.RESOURCE_REQUEST:
                this.emit(ParentAPIEvents.RESOURCE_REQUEST, {
                    id: content, send: (name, value) => __awaiter(this, void 0, void 0, function* () {
                        this.childProcess.send(["sendResource", Buffer.from(name, "utf8").toString("base64") + "/C/:VRTX:/C/" + Buffer.from(JSON.stringify(value), "utf8").toString("base64")]);
                    })
                });
                break;
        }
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
}
class ChildAPI {
    log(c) {
        var _a;
        (_a = process.send) === null || _a === void 0 ? void 0 : _a.call(process, ["log", c]);
    }
    questionForward(q) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = process.send) === null || _a === void 0 ? void 0 : _a.call(process, ["questionForward", q]);
            return (new Promise((resolve, reject) => {
                process.once("message", (m) => __awaiter(this, void 0, void 0, function* () {
                    const msgOpcode = m[0];
                    const msgContent = m[1];
                    if (msgOpcode == "questionForwardResponse") {
                        resolve(msgContent);
                    }
                }));
            }));
        });
    }
    getResource(r) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = process.send) === null || _a === void 0 ? void 0 : _a.call(process, ["getResource", r]);
            return (new Promise((resolve, reject) => {
                process.once("message", (m) => __awaiter(this, void 0, void 0, function* () {
                    const msgOpcode = m[0];
                    const msgContent = m[1];
                    if (msgOpcode == "sendResource") {
                        const x = msgContent.split("/C/:VRTX:/C/");
                        const resource = x[0];
                        const value = x[1];
                        if (Buffer.from(resource, "base64").toString("utf8") == r) {
                            resolve(JSON.parse(Buffer.from(value, "base64").toString("utf8")));
                        }
                    }
                }));
            }));
        });
    }
    exit() { process.exit(); }
}
class ChildExecAPI {
    log(c) {
        process.stdout.write(`log:${Buffer.from(JSON.stringify(c), "utf8").toString("base64")}`, "utf8");
    }
    getResource(r) {
        return new Promise((resolve, reject) => {
            process.stdout.write(`getResource:${Buffer.from(JSON.stringify(r), "utf8").toString("base64")}`, "utf8");
            process.stdin.once("data", (d) => {
                const x = d.toString().split(":");
                const opCode = x[0];
                const resource = JSON.parse(Buffer.from(x[1], "base64").toString("utf8"));
                if (opCode == "sendResource") {
                    resolve(resource.value);
                }
            });
        });
    }
    exit() { process.exit(); }
}
export default {
    version: "1.2.2",
    childAPI: new ChildAPI(),
    childExecAPI: new ChildExecAPI(),
};
