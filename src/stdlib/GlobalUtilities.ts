import {
    Callable,
    ValueKind,
    BrsInvalid,
    BrsString,
    BrsType,
    StdlibArgument,
    BrsInterface,
    BrsComponent,
} from "../brsTypes";
import { isBoxable } from "../brsTypes/Boxing";
import { RuntimeError, RuntimeErrorDetail } from "../Error";
import { Interpreter } from "../interpreter";

let warningShown = false;

export const RebootSystem = new Callable("RebootSystem", {
    signature: {
        args: [],
        returns: ValueKind.Void,
    },
    impl: () => {
        if (!warningShown) {
            console.warn("`RebootSystem` is not implemented in `brs`.");
            warningShown = true;
        }

        return BrsInvalid.Instance;
    },
});

export const GetInterface = new Callable("GetInterface", {
    signature: {
        args: [
            new StdlibArgument("object", ValueKind.Object),
            new StdlibArgument("ifname", ValueKind.String),
        ],
        returns: ValueKind.Interface,
    },
    impl: (_: Interpreter, object: BrsType, ifname: BrsString): BrsInterface | BrsInvalid => {
        const boxedObj = isBoxable(object) ? object.box() : object;
        if (boxedObj instanceof BrsComponent) {
            return boxedObj.interfaces.get(ifname.value.toLowerCase()) || BrsInvalid.Instance;
        }
        return BrsInvalid.Instance;
    },
});

export const FindMemberFunction = new Callable("FindMemberFunction", {
    signature: {
        args: [
            new StdlibArgument("object", ValueKind.Object),
            new StdlibArgument("funName", ValueKind.String),
        ],
        returns: ValueKind.Interface,
    },
    impl: (_: Interpreter, object: BrsType, funName: BrsString): BrsInterface | BrsInvalid => {
        const boxedObj = isBoxable(object) ? object.box() : object;
        if (boxedObj instanceof BrsComponent) {
            for (let [_, iface] of boxedObj.interfaces) {
                if (iface.hasMethod(funName.value)) {
                    return iface;
                }
            }
        }
        return BrsInvalid.Instance;
    },
});

export const ObjFun = new Callable("ObjFun", {
    signature: {
        args: [
            new StdlibArgument("object", ValueKind.Object),
            new StdlibArgument("iface", ValueKind.Interface),
            new StdlibArgument("funName", ValueKind.String),
        ],
        variadic: true,
        returns: ValueKind.Dynamic,
    },
    impl: (
        interpreter: Interpreter,
        object: BrsComponent,
        iface: BrsInterface,
        funName: BrsString,
        ...args: BrsType[]
    ): BrsType => {
        for (let [_, objI] of object.interfaces) {
            if (iface.name === objI.name && iface.hasMethod(funName.value)) {
                const func = object.getMethod(funName.value);
                return func?.call(interpreter, ...args) || BrsInvalid.Instance;
            }
        }
        interpreter.addError(
            new RuntimeError(RuntimeErrorDetail.MemberFunctionNotFound, interpreter.location)
        );
    },
});
