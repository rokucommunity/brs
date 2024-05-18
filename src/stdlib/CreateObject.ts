import {
    Callable,
    ValueKind,
    BrsInvalid,
    BrsString,
    BrsType,
    StdlibArgument,
    RoAssociativeArray,
} from "../brsTypes";
import { BrsObjects } from "../brsTypes/components/BrsObjects";
import { Interpreter } from "../interpreter";
import { MockNode } from "../extensions/MockNode";

/** Creates a new instance of a given brightscript component (e.g. roAssociativeArray) */
export const CreateObject = new Callable("CreateObject", {
    signature: {
        args: [new StdlibArgument("objName", ValueKind.String)],
        variadic: true,
        returns: ValueKind.Dynamic,
    },
    impl: (interpreter: Interpreter, objName: BrsString, ...additionalArgs: BrsType[]) => {
        let objToMock = objName.value.toLowerCase();

        if (
            objToMock === "rosgnode" &&
            additionalArgs[0] &&
            !(additionalArgs[0] instanceof BrsInvalid)
        ) {
            objToMock = additionalArgs[0].toString();
        }

        let possibleMock = interpreter.environment.getMockObject(objToMock.toLowerCase());
        if (possibleMock instanceof RoAssociativeArray) {
            return new MockNode(possibleMock, objToMock);
        }
        let ctor = BrsObjects.get(objName.value.toLowerCase());

        if (ctor) {
            try {
                return ctor(interpreter, ...additionalArgs);
            } catch (err: any) {
                interpreter.stderr.write(`${err.message} ${interpreter.formatLocation()}\n`);
            }
        }
        return BrsInvalid.Instance;
    },
});
