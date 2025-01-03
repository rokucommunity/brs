import { RoAssociativeArray } from "../brsTypes/components/RoAssociativeArray";
import { RoArray } from "../brsTypes/components/RoArray";
import { Interpreter } from "../interpreter";

import {
    BrsComponent,
    BrsInvalid,
    BrsString,
    BrsType,
    Callable,
    Int32,
    ValueKind,
    StdlibArgument,
    isUnboxable,
    brsValueOf,
} from "../brsTypes";

type BrsAggregate = RoAssociativeArray | RoArray;

function visit(x: BrsAggregate, visited: Set<BrsAggregate>): void {
    if (visited.has(x)) {
        throw new Error("Nested object reference");
    }
    visited.add(x);
}

/**
 * Converts a BrsType value to its representation as a JSON string. If no such
 * representation is possible, throws an Error. Objects with cyclical references
 * are rejected.
 * @param {Interpreter} interpreter An Interpreter.
 * @param {BrsType} x Some BrsType value.
 * @param {Set<BrsAggregate>} visited An optional Set of visited of RoArray or
 *   RoAssociativeArray. If not provided, a new Set will be created.
 * @return {string} The JSON string representation of `x`.
 * @throws {Error} If `x` cannot be represented as a JSON string.
 */
function jsonOf(
    interpreter: Interpreter,
    x: BrsType,
    flags: number = 0,
    visited: Set<BrsAggregate> = new Set(),
    key: string = ""
): string {
    switch (x.kind) {
        case ValueKind.Invalid:
            return "null";
        case ValueKind.String:
            return `"${x.toString()}"`;
        case ValueKind.Boolean:
        case ValueKind.Double:
        case ValueKind.Float:
        case ValueKind.Int32:
        case ValueKind.Int64:
            return x.toString();
        case ValueKind.Object:
            if (x instanceof RoAssociativeArray) {
                visit(x, visited);
                return `{${x
                    .getElements()
                    .map((k: BrsString) => {
                        key = k.toString();
                        return `"${key}":${jsonOf(interpreter, x.get(k), flags, visited, key)}`;
                    })
                    .join(",")}}`;
            }
            if (x instanceof RoArray) {
                visit(x, visited);
                return `[${x
                    .getElements()
                    .map((el: BrsType) => {
                        return jsonOf(interpreter, el, flags, visited, key);
                    })
                    .join(",")}]`;
            }
            if (isUnboxable(x)) {
                return jsonOf(interpreter, x.unbox(), flags, visited, key);
            }
            break;
        case ValueKind.Callable:
        case ValueKind.Uninitialized:
        case ValueKind.Interface:
            break;
        default:
            // Exhaustive check as per:
            // https://basarat.gitbooks.io/typescript/content/docs/types/discriminated-unions.html
            const _: never = x;
            break;
    }
    let xType = x instanceof BrsComponent ? x.getComponentName() : x;
    if (flags & 256) {
        // UnsupportedIgnore
        return "null";
    } else if (flags & 512) {
        // UnsupportedAnnotate
        return `"<${xType}>"`;
    }
    let errMessage = `Value type not supported: ${xType}`;
    if (key !== "") {
        errMessage = `${key}: ${errMessage}`;
    }
    throw new Error(errMessage);
}

function logBrsErr(functionName: string, err: Error): void {
    if (process.env.NODE_ENV === "test") {
        return;
    }
    console.error(`BRIGHTSCRIPT: ERROR: ${functionName}: ${err.message}`);
}

export const FormatJson = new Callable("FormatJson", {
    signature: {
        returns: ValueKind.String,
        args: [
            new StdlibArgument("x", ValueKind.Dynamic),
            new StdlibArgument("flags", ValueKind.Int32, new Int32(0)),
        ],
    },
    impl: (interpreter: Interpreter, x: BrsType, flags: Int32) => {
        try {
            return new BrsString(jsonOf(interpreter, x, flags.getValue()));
        } catch (err: any) {
            logBrsErr("FormatJSON", err);
            return new BrsString("");
        }
    },
});

export const ParseJson = new Callable("ParseJson", {
    signature: {
        returns: ValueKind.Dynamic,
        args: [new StdlibArgument("jsonString", ValueKind.String)],
    },
    impl: (_: Interpreter, jsonString: BrsString) => {
        try {
            let s: string = jsonString.toString().trim();

            if (s === "") {
                throw new Error("Data is empty");
            }

            return brsValueOf(JSON.parse(s));
        } catch (err: any) {
            logBrsErr("ParseJSON", err);
            return BrsInvalid.Instance;
        }
    },
});
