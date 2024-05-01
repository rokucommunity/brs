import {
    BrsString,
    RoArray,
    Callable,
    ValueKind,
    StdlibArgument,
    Int32,
    BrsInvalid,
    BrsType,
    isBrsString,
} from "../brsTypes";
import { Location } from "../lexer";
import { Interpreter } from "../interpreter";

const INTERNAL_REGEX_FILTER = /\(internal\)/;

/**
 * Returns a stack trace in the format:
 * [
 *   filename:line:column,
 *   ...
 * ]
 */
export const GetStackTrace = new Callable("GetStackTrace", {
    signature: {
        args: [
            new StdlibArgument("numEntries", ValueKind.Int32, new Int32(10)),
            new StdlibArgument("excludePatterns", ValueKind.Dynamic, BrsInvalid.Instance),
        ],
        returns: ValueKind.Object,
    },
    impl: (interpreter: Interpreter, numEntries: Int32, excludePatterns: BrsType) => {
        let stack = interpreter.stack.slice();
        // Filter out any files that the consumer doesn't want to include
        if (excludePatterns instanceof RoArray) {
            excludePatterns.getValue().forEach((pattern) => {
                if (isBrsString(pattern)) {
                    let regexFilter = new RegExp(pattern.value);
                    stack = stack.filter(
                        (tracePoint) => !regexFilter.test(tracePoint.functionLocation.file)
                    );
                }
            });
        } else if (!(excludePatterns instanceof BrsInvalid)) {
            interpreter.stderr.write("Patterns to exclude argument must be an roArray");
        }

        return new RoArray(
            stack
                // Filter out any internal stack traces.
                .filter(
                    (tracePoint) => !INTERNAL_REGEX_FILTER.test(tracePoint.functionLocation.file)
                )
                // Remove any duplicate entries that appear next to each other in the stack.
                .filter((tracePoint, index, backTrace) => {
                    if (index === 0) return true;
                    let prevLocation = backTrace[index - 1].functionLocation;
                    return !Location.equalTo(tracePoint.functionLocation, prevLocation);
                })
                .map((tracePoint) => {
                    const location = tracePoint.functionLocation;
                    return new BrsString(
                        `${location.file}:${location.start.line}:${location.start.column}`
                    );
                })
                // Get the last item on the stack
                .slice(-1 * numEntries.getValue())
                .reverse()
        );
    },
});
