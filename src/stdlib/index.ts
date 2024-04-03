import { Callable, ValueKind, RoAssociativeArray, StdlibArgument, BrsType } from "../brsTypes";
import { isBoxable } from "../brsTypes/Boxing";
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
