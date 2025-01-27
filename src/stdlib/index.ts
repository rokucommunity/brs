import {
    Callable,
    ValueKind,
    RoAssociativeArray,
    StdlibArgument,
    BrsType,
    Int32,
    RoMessagePort,
    BrsInvalid,
} from "../brsTypes";
import { isBoxable } from "../brsTypes/Boxing";
import {} from "../brsTypes/components/RoMessagePort";
import { Interpreter } from "../interpreter";

/**
 * Returns an object version of an intrinsic type, or pass through an object if given one.
 */
export const Box = new Callable("Box", {
    signature: {
        args: [new StdlibArgument("value", ValueKind.Dynamic)],
        returns: ValueKind.Object,
    },
    impl: (_: Interpreter, value: BrsType) => {
        if (isBoxable(value)) {
            return value.box();
        }
        return value;
    },
});

/**
 * Returns global M pointer (the m from the root Environment).
 */
export const GetGlobalAA = new Callable("GetGlobalAA", {
    signature: {
        args: [],
        returns: ValueKind.Dynamic,
    },
    impl: (interpreter: Interpreter): RoAssociativeArray => {
        return interpreter.environment.getRootM();
    },
});

/**
 * This function causes the script to pause for the specified time in milliseconds.
 */
export const Sleep = new Callable("Sleep", {
    signature: {
        args: [new StdlibArgument("timeout", ValueKind.Int32)],
        returns: ValueKind.Void,
    },
    impl: (_: Interpreter, timeout: Int32) => {
        let ms = timeout.getValue();
        ms += performance.now();
        while (performance.now() < ms) {}
        return BrsInvalid.Instance;
    },
});

/** Waits until an event object is available or timeout milliseconds have passed. */
export const Wait = new Callable("Wait", {
    signature: {
        args: [
            new StdlibArgument("timeout", ValueKind.Int32),
            new StdlibArgument("port", ValueKind.Object),
        ],
        returns: ValueKind.Dynamic,
    },
    impl: (interpreter: Interpreter, timeout: Int32, port: RoMessagePort) => {
        return port.wait(interpreter, timeout.getValue());
    },
});

export * from "./GlobalUtilities";
export * from "./CreateObject";
export * from "./File";
export * from "./Json";
export * from "./Localization";
export * from "./Math";
export * from "./Print";
export { Run } from "./Run";
export * from "./String";
export * from "./Type";
