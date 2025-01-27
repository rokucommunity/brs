import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoDeviceInfo } from "./RoDeviceInfo";
import { RoArray } from "./RoArray";
import { RoList } from "./RoList";
import { RoByteArray } from "./RoByteArray";
import { RoDateTime } from "./RoDateTime";
import { RoTimespan } from "./RoTimespan";
import { createNodeByType } from "./RoSGNode";
import { roSGScreen } from "./RoSGScreen";
import { RoMessagePort } from "./RoMessagePort";
import { RoRegex } from "./RoRegex";
import { RoXMLElement } from "./RoXMLElement";
import { BrsString, BrsBoolean } from "../BrsType";
import { RoString } from "./RoString";
import { roBoolean } from "./RoBoolean";
import { roDouble } from "./RoDouble";
import { roFloat } from "./RoFloat";
import { roInt } from "./RoInt";
import { roLongInteger } from "./RoLongInteger";
import { Double } from "../Double";
import { Float } from "../Float";
import { Int32 } from "../Int32";
import { Int64 } from "../Int64";
import { Interpreter } from "../../interpreter";
import { RoInvalid } from "./RoInvalid";
import { BrsComponent } from "./BrsComponent";
import { RoAppInfo } from "./RoAppInfo";
import { RoPath } from "./RoPath";

// Class to define a case-insensitive map of BrightScript objects.
class BrsObjectsMap {
    private readonly map = new Map<
        string,
        { originalKey: string; value: Function; params: number }
    >();

    constructor(entries: [string, Function, number?][]) {
        entries.forEach(([key, value, params]) => this.set(key, value, params));
    }

    get(key: string) {
        const entry = this.map.get(key.toLowerCase());
        return entry ? entry.value : undefined;
    }

    set(key: string, value: Function, params?: number) {
        return this.map.set(key.toLowerCase(), {
            originalKey: key,
            value: value,
            params: params ?? 0,
        });
    }

    has(key: string) {
        return this.map.has(key.toLowerCase());
    }

    delete(key: string) {
        return this.map.delete(key.toLowerCase());
    }

    clear() {
        return this.map.clear();
    }

    values() {
        return Array.from(this.map.values()).map((entry) => entry.value);
    }

    keys() {
        return Array.from(this.map.values()).map((entry) => entry.originalKey);
    }

    // Returns the number of parameters required by the object constructor.
    // >=0 = exact number of parameters required
    // -1  = ignore parameters, create object with no parameters
    // -2  = do not check for minimum number of parameters
    params(key: string) {
        const entry = this.map.get(key.toLowerCase());
        return entry ? entry.params : -1;
    }
}

/** Map containing a list of BrightScript components that can be created. */
export const BrsObjects = new BrsObjectsMap([
    ["roAssociativeArray", (_: Interpreter) => new RoAssociativeArray([])],
    [
        "roArray",
        (interpreter: Interpreter, capacity: Int32 | Float, resizable: BrsBoolean) =>
            new RoArray(capacity, resizable),
        2,
    ],
    ["roList", (_: Interpreter) => new RoList([])],
    ["roByteArray", (_: Interpreter) => new RoByteArray()],
    ["roDateTime", (_: Interpreter) => new RoDateTime()],
    ["roTimespan", (_: Interpreter) => new RoTimespan()],
    ["roDeviceInfo", (_: Interpreter) => new RoDeviceInfo()],
    [
        "roSGNode",
        (interpreter: Interpreter, nodeType: BrsString) => createNodeByType(interpreter, nodeType),
        1,
    ],
    ["roSGScreen", (interpreter: Interpreter) => new roSGScreen(interpreter)],
    ["roMessagePort", (_: Interpreter) => new RoMessagePort()],
    [
        "roRegex",
        (_: Interpreter, expression: BrsString, flags: BrsString) => new RoRegex(expression, flags),
        2,
    ],
    ["roXMLElement", (_: Interpreter) => new RoXMLElement()],
    ["roString", (_: Interpreter) => new RoString(), -1],
    ["roBoolean", (_: Interpreter, literal: BrsBoolean) => new roBoolean(literal), -1],
    ["roDouble", (_: Interpreter, literal: Double) => new roDouble(literal), -1],
    ["roFloat", (_: Interpreter, literal: Float) => new roFloat(literal), -1],
    ["roInt", (_: Interpreter, literal: Int32) => new roInt(literal), -1],
    ["roLongInteger", (_: Interpreter, literal: Int64) => new roLongInteger(literal), -1],
    ["roAppInfo", (_: Interpreter) => new RoAppInfo()],
    ["roPath", (_: Interpreter, path: BrsString) => new RoPath(path), 1],
    ["roInvalid", (_: Interpreter) => new RoInvalid(), -1],
]);

/**
 * Lets another software using BRS as a library to add/overwrite an implementation of a BrsObject.
 *
 * This is useful, for example, if another piece of software wanted to implement video playback or Draw2d functionality.
 *
 * In each element of the objectList param, it is pair:
 * [name of the BrsObject (e.g. "roScreen", etc.), function (interpreter, ...additionalArgs) that returns a new object]
 *
 * @example
 *
 * extendBrsObjects([
 *   ["roScreen", (_interpreter) => {return new roScreen();}]
 * ])
 *
 * @param objectList array of pairs: [name, constructor function]
 */
export function extendBrsObjects(objectList: [string, () => BrsComponent][]): void {
    objectList.forEach(([name, ctor]) => {
        BrsObjects.set(name.toLowerCase(), ctor);
    });
}
