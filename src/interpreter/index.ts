import { EventEmitter } from "events";
import * as PP from "../preprocessor";

import {
    BrsType,
    ValueKind,
    BrsInvalid,
    isBrsNumber,
    isBrsString,
    BrsBoolean,
    BrsString,
    isBrsBoolean,
    Int32,
    isBrsCallable,
    Uninitialized,
    RoArray,
    isIterable,
    Callable,
    BrsNumber,
    Float,
    tryCoerce,
    isComparable,
    isStringComp,
    isBoxedNumber,
    roInvalid,
    PrimitiveKinds,
} from "../brsTypes";

import { Lexeme, Location } from "../lexer";
import { isToken } from "../lexer/Token";
import { Expr, Stmt, ComponentScopeResolver } from "../parser";
import { BrsError, getLoggerUsing } from "../Error";

import * as StdLib from "../stdlib";
import { _brs_ } from "../extensions";

import { Scope, Environment, NotFound } from "./Environment";
import { TypeMismatch } from "./TypeMismatch";
import { OutputProxy } from "./OutputProxy";
import { toCallable } from "./BrsFunction";
import { Runtime } from "../parser/Statement";
import { RoAssociativeArray } from "../brsTypes/components/RoAssociativeArray";
import MemoryFileSystem from "memory-fs";
import { BrsComponent } from "../brsTypes/components/BrsComponent";
import { isBoxable, isUnboxable } from "../brsTypes/Boxing";

import { ComponentDefinition } from "../componentprocessor";
import pSettle from "p-settle";
import { CoverageCollector } from "../coverage";
import { ManifestValue } from "../preprocessor/Manifest";
import { generateArgumentMismatchError } from "./ArgumentMismatch";
import Long from "long";

import chalk from "chalk";
import stripAnsi from "strip-ansi";

/** The set of options used to configure an interpreter's execution. */
export interface ExecutionOptions {
    /** The base path for the project. Default: process.cwd() */
    root: string;
    /** The stdout stream that brs should use. Default: process.stdout. */
    stdout: NodeJS.WriteStream;
    /** The stderr stream that brs should use. Default: process.stderr. */
    stderr: NodeJS.WriteStream;
    /** Whether or not to collect coverage statistics. Default: false. */
    generateCoverage: boolean;
    /** Additional directories to search for component definitions. Default: [] */
    componentDirs: string[];
    /** Whether or not a component library is being processed. */
    isComponentLibrary: boolean;
}

/** The default set of execution options.  Includes the `stdout`/`stderr` pair from the process that invoked `brs`. */
export const defaultExecutionOptions: ExecutionOptions = {
    root: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr,
    generateCoverage: false,
    componentDirs: [],
    isComponentLibrary: false,
};
Object.freeze(defaultExecutionOptions);

export class Interpreter implements Expr.Visitor<BrsType>, Stmt.Visitor<BrsType> {
    private _environment = new Environment();
    private coverageCollector: CoverageCollector | null = null;
    private _manifest: PP.Manifest | undefined;

    readonly options: ExecutionOptions;
    readonly stdout: OutputProxy;
    readonly stderr: OutputProxy;
    readonly temporaryVolume: MemoryFileSystem = new MemoryFileSystem();

    stack: Location[] = [];
    location: Location;

    /** Allows consumers to observe errors as they're detected. */
    readonly events = new EventEmitter();

    /** The set of errors detected from executing an AST. */
    errors: (BrsError | Runtime)[] = [];

    get environment() {
        return this._environment;
    }

    get manifest() {
        return this._manifest != null ? this._manifest : new Map<string, ManifestValue>();
    }

    set manifest(manifest: PP.Manifest) {
        this._manifest = manifest;
    }

    setCoverageCollector(collector: CoverageCollector) {
        this.coverageCollector = collector;
    }

    reportCoverageHit(statement: Expr.Expression | Stmt.Statement) {
        if (this.options.generateCoverage && this.coverageCollector) {
            this.coverageCollector.logHit(statement);
        }
    }

    /**
     * Convenience function to subscribe to the `err` events emitted by `interpreter.events`.
     * @param errorHandler the function to call for every runtime error emitted after subscribing
     * @returns an object with a `dispose` function, used to unsubscribe from errors
     */
    public onError(errorHandler: (err: BrsError | Runtime) => void) {
        this.events.on("err", errorHandler);
        return {
            dispose: () => {
                this.events.removeListener("err", errorHandler);
            },
        };
    }

    /**
     * Convenience function to subscribe to a single `err` event emitted by `interpreter.events`.
     * @param errorHandler the function to call for the first runtime error emitted after subscribing
     */
    public onErrorOnce(errorHandler: (err: BrsError | Runtime) => void) {
        this.events.once("err", errorHandler);
    }

    /**
     * Builds out all the sub-environments for the given components. Components are saved into the calling interpreter
     * instance. This function will mutate the state of the calling interpreter.
     * @param componentMap Map of all components to be assigned to this interpreter
     * @param parseFn Function used to parse components into interpretable statements
     * @param options
     */
    public static async withSubEnvsFromComponents(
        componentMap: Map<string, ComponentDefinition>,
        parseFn: (filenames: string[]) => Promise<Stmt.Statement[]>,
        options: ExecutionOptions = defaultExecutionOptions
    ) {
        let interpreter = new Interpreter(options);
        interpreter.onError(getLoggerUsing(options.stderr));

        interpreter.environment.nodeDefMap = componentMap;

        let componentScopeResolver = new ComponentScopeResolver(componentMap, parseFn);
        await pSettle(
            Array.from(componentMap).map(async (componentKV) => {
                let [_, component] = componentKV;
                component.environment = interpreter.environment.createSubEnvironment(
                    /* includeModuleScope */ false
                );
                let statements = await componentScopeResolver.resolve(component);
                interpreter.inSubEnv((subInterpreter) => {
                    let componentMPointer = new RoAssociativeArray([]);
                    subInterpreter.environment.setM(componentMPointer);
                    subInterpreter.environment.setRootM(componentMPointer);
                    subInterpreter.exec(statements);
                    return BrsInvalid.Instance;
                }, component.environment);
            })
        );

        return interpreter;
    }

    /**
     * Merges this environment's node definition mapping with the ones included in an array of other
     * interpreters, acting logically equivalent to
     * `Object.assign(this.environment, other1.environment, other2.environment, …)`.
     * @param interpreters the array of interpreters who's environment's node definition maps will
     *                     be merged into this one
     */
    public mergeNodeDefinitionsWith(interpreters: Interpreter[]): void {
        interpreters.map((other) =>
            other.environment.nodeDefMap.forEach((value, key) =>
                this.environment.nodeDefMap.set(key, value)
            )
        );
    }

    /**
     * Creates a new Interpreter, including any global properties and functions.
     * @param options configuration for the execution, including the streams to use for `stdout` and
     *                `stderr` and the base directory for path resolution
     */
    constructor(options: ExecutionOptions = defaultExecutionOptions) {
        this.stdout = new OutputProxy(options.stdout);
        this.stderr = new OutputProxy(options.stderr);
        this.options = options;
        this.location = {
            file: "(none)",
            start: { line: -1, column: -1 },
            end: { line: -1, column: -1 },
        };

        Object.keys(StdLib)
            .map((name) => (StdLib as any)[name])
            .filter((func) => func instanceof Callable)
            .filter((func: Callable) => {
                if (!func.name) {
                    throw new Error("Unnamed standard library function detected!");
                }

                return !!func.name;
            })
            .forEach((func: Callable) =>
                this._environment.define(Scope.Global, func.name || "", func)
            );

        this._environment.define(Scope.Global, "_brs_", _brs_);
    }

    /**
     * Temporarily sets an interpreter's environment to the provided one, then
     * passes the sub-interpreter to the provided JavaScript function. Always
     * reverts the current interpreter's environment to its original value.
     * @param func the JavaScript function to execute with the sub interpreter.
     * @param environment (Optional) the environment to run the interpreter in.
     */
    inSubEnv(func: (interpreter: Interpreter) => BrsType, environment?: Environment): BrsType {
        let originalEnvironment = this._environment;
        let newEnv = environment || this._environment.createSubEnvironment();

        // Set the focused node of the sub env, because our current env has the most up-to-date reference.
        newEnv.setFocusedNode(this._environment.getFocusedNode());

        let returnValue;
        try {
            this._environment = newEnv;
            returnValue = func(this);
            this._environment = originalEnvironment;
            this._environment.setFocusedNode(newEnv.getFocusedNode());
        } catch (err) {
            this._environment = originalEnvironment;
            this._environment.setFocusedNode(newEnv.getFocusedNode());
            throw err;
        }

        return returnValue;
    }

    exec(statements: ReadonlyArray<Stmt.Statement>, ...args: BrsType[]) {
        let results = statements.map((statement) => this.execute(statement));
        try {
            let mainVariable = new Expr.Variable({
                kind: Lexeme.Identifier,
                text: "main",
                isReserved: false,
                location: {
                    start: {
                        line: -1,
                        column: -1,
                    },
                    end: {
                        line: -1,
                        column: -1,
                    },
                    file: "(internal)",
                },
            });

            let maybeMain = this.evaluate(mainVariable);

            if (maybeMain.kind === ValueKind.Callable) {
                results = [
                    this.evaluate(
                        new Expr.Call(
                            mainVariable,
                            mainVariable.name,
                            args.map((arg) => new Expr.Literal(arg, mainVariable.location))
                        )
                    ),
                ];
            }
        } catch (err) {
            if (err instanceof Stmt.ReturnValue) {
                results = [err.value || BrsInvalid.Instance];
            } else if (!(err instanceof BrsError)) {
                // Swallow BrsErrors, because they should have been exposed to the user downstream.
                throw err;
            }
        }

        return results;
    }

    getCallableFunction(functionName: string): Callable | undefined {
        let callbackVariable = new Expr.Variable({
            kind: Lexeme.Identifier,
            text: functionName,
            isReserved: false,
            location: {
                start: {
                    line: -1,
                    column: -1,
                },
                end: {
                    line: -1,
                    column: -1,
                },
                file: "(internal)",
            },
        });

        let maybeCallback = this.evaluate(callbackVariable);
        if (maybeCallback.kind === ValueKind.Callable) {
            return maybeCallback;
        }

        // If we can't find the function, return undefined and let the consumer handle it.
        return;
    }

    /**
     * Returns the init method (if any) in the current environment as a Callable
     */
    getInitMethod(): BrsType {
        let initVariable = new Expr.Variable({
            kind: Lexeme.Identifier,
            text: "init",
            isReserved: false,
            location: {
                start: {
                    line: -1,
                    column: -1,
                },
                end: {
                    line: -1,
                    column: -1,
                },
                file: "(internal)",
            },
        });

        return this.evaluate(initVariable);
    }

    visitLibrary(statement: Stmt.Library): BrsInvalid {
        this.stderr.write("WARNING: 'Library' statement implemented as no-op");
        return BrsInvalid.Instance;
    }

    visitNamedFunction(statement: Stmt.Function): BrsType {
        if (statement.name.isReserved) {
            return this.addError(
                new BrsError(
                    `Cannot create a named function with reserved name '${statement.name.text}'`,
                    statement.name.location
                )
            );
        }

        if (this.environment.has(statement.name, [Scope.Module])) {
            // TODO: Figure out how to determine where the original version was declared
            // Maybe `Environment.define` records the location along with the value?
            return this.addError(
                new BrsError(
                    `Attempting to declare function '${statement.name.text}', but ` +
                        `a property of that name already exists in this scope.`,
                    statement.name.location
                )
            );
        }

        this.environment.define(
            Scope.Module,
            statement.name.text!,
            toCallable(statement.func, statement.name.text)
        );
        return BrsInvalid.Instance;
    }

    visitReturn(statement: Stmt.Return): never {
        if (!statement.value) {
            throw new Stmt.ReturnValue(statement.tokens.return.location);
        }

        let toReturn = this.evaluate(statement.value);
        throw new Stmt.ReturnValue(statement.tokens.return.location, toReturn);
    }

    visitExpression(statement: Stmt.Expression): BrsType {
        return this.evaluate(statement.expression);
    }

    visitPrint(statement: Stmt.Print): BrsType {
        // the `tab` function is only in-scope while executing print statements
        this.environment.define(Scope.Function, "Tab", StdLib.Tab);

        statement.expressions.forEach((printable, index) => {
            if (isToken(printable)) {
                switch (printable.kind) {
                    case Lexeme.Comma:
                        this.stdout.write(" ".repeat(16 - (this.stdout.position() % 16)));
                        break;
                    case Lexeme.Semicolon:
                        break;
                    default:
                        this.addError(
                            new BrsError(
                                `Found unexpected print separator '${printable.text}'`,
                                printable.location
                            )
                        );
                }
            } else {
                const toPrint = this.evaluate(printable);
                const isNumber = isBrsNumber(toPrint) || isBoxedNumber(toPrint);
                const str = isNumber && this.isPositive(toPrint.getValue()) ? " " : "";
                this.stdout.write(colorize(str + toPrint.toString()));
            }
        });

        let lastExpression = statement.expressions[statement.expressions.length - 1];
        if (!isToken(lastExpression) || lastExpression.kind !== Lexeme.Semicolon) {
            this.stdout.write("\n");
        }

        // `tab` is only in-scope when executing print statements, so remove it before we leave
        this.environment.remove("Tab");

        return BrsInvalid.Instance;
    }

    visitAssignment(statement: Stmt.Assignment): BrsType {
        if (statement.name.isReserved) {
            this.addError(
                new BrsError(
                    `Cannot assign a value to reserved name '${statement.name.text}'`,
                    statement.name.location
                )
            );
            return BrsInvalid.Instance;
        }

        let value = this.evaluate(statement.value);

        let name = statement.name.text;

        const typeDesignators: Record<string, ValueKind> = {
            $: ValueKind.String,
            "%": ValueKind.Int32,
            "!": ValueKind.Float,
            "#": ValueKind.Double,
            "&": ValueKind.Int64,
        };
        let requiredType = typeDesignators[name.charAt(name.length - 1)];

        if (requiredType) {
            let coercedValue = tryCoerce(value, requiredType);
            if (coercedValue != null) {
                value = coercedValue;
            } else {
                return this.addError(
                    new TypeMismatch({
                        message: `Type Mismatch. Attempting to assign incorrect value to statically-typed variable '${name}'`,
                        left: {
                            type: requiredType,
                            location: statement.name.location,
                        },
                        right: {
                            type: value,
                            location: statement.value.location,
                        },
                    })
                );
            }
        }

        this.environment.define(Scope.Function, statement.name.text, value);
        return BrsInvalid.Instance;
    }

    visitDim(statement: Stmt.Dim): BrsType {
        if (statement.name.isReserved) {
            this.addError(
                new BrsError(
                    `Cannot assign a value to reserved name '${statement.name.text}'`,
                    statement.name.location
                )
            );
            return BrsInvalid.Instance;
        }

        // NOTE: Roku's dim implementation creates a resizable, empty array for the
        //   bottom children. Resizable arrays aren't implemented yet (issue #530),
        //   so when that's added this code should be updated so the bottom-level arrays
        //   are resizable, but empty
        let dimensionValues: number[] = [];
        statement.dimensions.forEach((expr) => {
            let val = this.evaluate(expr);
            if (val.kind !== ValueKind.Int32) {
                this.addError(
                    new BrsError(`Dim expression must evaluate to an integer`, expr.location)
                );
                return BrsInvalid.Instance;
            }
            // dim takes max-index, so +1 to get the actual array size
            dimensionValues.push(val.getValue() + 1);
            return;
        });

        let createArrayTree = (dimIndex: number = 0): RoArray => {
            let children: RoArray[] = [];
            let size = dimensionValues[dimIndex];
            for (let i = 0; i < size; i++) {
                if (dimIndex < dimensionValues.length) {
                    let subchildren = createArrayTree(dimIndex + 1);
                    if (subchildren !== undefined) children.push(subchildren);
                }
            }
            let child = new RoArray(children);

            return child;
        };

        let array = createArrayTree();

        this.environment.define(Scope.Function, statement.name.text, array);

        return BrsInvalid.Instance;
    }

    visitBinary(expression: Expr.Binary) {
        let lexeme = expression.token.kind;
        let left = this.evaluate(expression.left);
        let right: BrsType = BrsInvalid.Instance;

        if (lexeme !== Lexeme.And && lexeme !== Lexeme.Or) {
            // don't evaluate right-hand-side of boolean expressions, to preserve short-circuiting
            // behavior found in other languages. e.g. `foo() && bar()` won't execute `bar()` if
            // `foo()` returns `false`.
            right = this.evaluate(expression.right);
        }

        // Unbox Numeric or Invalid components to intrinsic types
        if (isBoxedNumber(left) || left instanceof roInvalid) {
            left = left.unbox();
        }
        if (isBoxedNumber(right) || right instanceof roInvalid) {
            right = right.unbox();
        }

        /**
         * Determines whether or not the provided pair of values are allowed to be compared to each other.
         * @param left the left-hand side of a comparison operator
         * @param operator the operator to use when comparing `left` and `right`
         * @param right the right-hand side of a comparison operator
         * @returns `true` if `left` and `right` are allowed to be compared to each other with `operator`,
         *          otherwise `false`.
         */
        function canCheckEquality(left: BrsType, operator: Lexeme, right: BrsType): boolean {
            if (left.kind === ValueKind.Invalid || right.kind === ValueKind.Invalid) {
                // anything can be checked for *equality* with `invalid`, but greater than / less than comparisons
                // are type mismatches
                return operator === Lexeme.Equal || operator === Lexeme.LessGreater;
            }

            return (
                (left.kind < ValueKind.Dynamic || isUnboxable(left) || isComparable(left)) &&
                (right.kind < ValueKind.Dynamic || isUnboxable(right) || isComparable(right))
            );
        }

        switch (lexeme) {
            case Lexeme.LeftShift:
            case Lexeme.LeftShiftEqual:
                if (
                    isBrsNumber(left) &&
                    isBrsNumber(right) &&
                    this.isPositive(right.getValue()) &&
                    this.lessThan(right.getValue(), 32)
                ) {
                    return left.leftShift(right);
                } else if (isBrsNumber(left) && isBrsNumber(right)) {
                    return this.addError(
                        new TypeMismatch({
                            message:
                                "Type Mismatch. In a bit shift expression the right value must be >= 0 and < 32.",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Type Mismatch. Attempting to bit shift non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.RightShift:
            case Lexeme.RightShiftEqual:
                if (
                    isBrsNumber(left) &&
                    isBrsNumber(right) &&
                    this.isPositive(right.getValue()) &&
                    this.lessThan(right.getValue(), 32)
                ) {
                    return left.rightShift(right);
                } else if (isBrsNumber(left) && isBrsNumber(right)) {
                    return this.addError(
                        new TypeMismatch({
                            message:
                                "Type Mismatch. In a bit shift expression the right value must be >= 0 and < 32.",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Type Mismatch. Attempting to bit shift non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Minus:
            case Lexeme.MinusEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.subtract(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Type Mismatch. Attempting to subtract non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Star:
            case Lexeme.StarEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.multiply(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Type Mismatch. Attempting to multiply non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Caret:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.pow(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message:
                                "Type Mismatch. Attempting to exponentiate non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Slash:
            case Lexeme.SlashEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.divide(right);
                }
                return this.addError(
                    new TypeMismatch({
                        message: "Type Mismatch. Attempting to divide non-numeric values.",
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );
            case Lexeme.Mod:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.modulo(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Type Mismatch. Attempting to modulo non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Backslash:
            case Lexeme.BackslashEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.intDivide(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message:
                                "Type Mismatch. Attempting to integer-divide non-numeric values.",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Plus:
            case Lexeme.PlusEqual:
                if (isBrsNumber(left) && isBrsNumber(right)) {
                    return left.add(right);
                } else if (isStringComp(left) && isStringComp(right)) {
                    return left.concat(right);
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Type Mismatch. Attempting to add non-homogeneous values.",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Greater:
                if (
                    (isBrsNumber(left) && isBrsNumber(right)) ||
                    (isStringComp(left) && isStringComp(right))
                ) {
                    return left.greaterThan(right);
                }

                return this.addError(
                    new TypeMismatch({
                        message: "Type Mismatch. Attempting to compare non-homogeneous values.",
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );

            case Lexeme.GreaterEqual:
                if (
                    (isBrsNumber(left) && isBrsNumber(right)) ||
                    (isStringComp(left) && isStringComp(right))
                ) {
                    return left.greaterThan(right).or(left.equalTo(right));
                }

                return this.addError(
                    new TypeMismatch({
                        message: "Type Mismatch. Attempting to compare non-homogeneous values.",
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );

            case Lexeme.Less:
                if (
                    (isBrsNumber(left) && isBrsNumber(right)) ||
                    (isStringComp(left) && isStringComp(right))
                ) {
                    return left.lessThan(right);
                }

                return this.addError(
                    new TypeMismatch({
                        message: "Type Mismatch. Attempting to compare non-homogeneous values.",
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );
            case Lexeme.LessEqual:
                if (
                    (isBrsNumber(left) && isBrsNumber(right)) ||
                    (isStringComp(left) && isStringComp(right))
                ) {
                    return left.lessThan(right).or(left.equalTo(right));
                }

                return this.addError(
                    new TypeMismatch({
                        message: "Type Mismatch. Attempting to compare non-homogeneous values.",
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );
            case Lexeme.Equal:
                if (canCheckEquality(left, lexeme, right)) {
                    return left.equalTo(right);
                }

                return this.addError(
                    new TypeMismatch({
                        message: "Type Mismatch. Attempting to compare non-homogeneous values.",
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );
            case Lexeme.LessGreater:
                if (canCheckEquality(left, lexeme, right)) {
                    return left.equalTo(right).not();
                }

                return this.addError(
                    new TypeMismatch({
                        message: "Type Mismatch. Attempting to compare non-homogeneous values.",
                        left: {
                            type: left,
                            location: expression.left.location,
                        },
                        right: {
                            type: right,
                            location: expression.right.location,
                        },
                    })
                );
            case Lexeme.And:
                if (isBrsBoolean(left) && !left.toBoolean()) {
                    // short-circuit ANDs - don't evaluate RHS if LHS is false
                    return BrsBoolean.False;
                } else if (isBrsBoolean(left)) {
                    right = this.evaluate(expression.right);
                    if (isBrsBoolean(right) || isBrsNumber(right)) {
                        return (left as BrsBoolean).and(right);
                    }

                    return this.addError(
                        new TypeMismatch({
                            message:
                                "Type Mismatch. Attempting to 'and' boolean with non-boolean value",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                } else if (isBrsNumber(left)) {
                    right = this.evaluate(expression.right);

                    if (isBrsNumber(right) || isBrsBoolean(right)) {
                        return left.and(right);
                    }

                    return this.addError(
                        new TypeMismatch({
                            message:
                                "Type Mismatch. Attempting to bitwise 'and' number with non-numeric value",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Type Mismatch. Attempting to 'and' unexpected values",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            case Lexeme.Or:
                if (isBrsBoolean(left) && left.toBoolean()) {
                    // short-circuit ORs - don't evaluate RHS if LHS is true
                    return BrsBoolean.True;
                } else if (isBrsBoolean(left)) {
                    right = this.evaluate(expression.right);
                    if (isBrsBoolean(right) || isBrsNumber(right)) {
                        return (left as BrsBoolean).or(right);
                    } else {
                        return this.addError(
                            new TypeMismatch({
                                message:
                                    "Type Mismatch. Attempting to 'or' boolean with non-boolean value",
                                left: {
                                    type: left,
                                    location: expression.left.location,
                                },
                                right: {
                                    type: right,
                                    location: expression.right.location,
                                },
                            })
                        );
                    }
                } else if (isBrsNumber(left)) {
                    right = this.evaluate(expression.right);
                    if (isBrsNumber(right) || isBrsBoolean(right)) {
                        return left.or(right);
                    }

                    return this.addError(
                        new TypeMismatch({
                            message:
                                "Type Mismatch. Attempting to bitwise 'or' number with non-numeric expression",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                } else {
                    return this.addError(
                        new TypeMismatch({
                            message: "Type Mismatch. Attempting to 'or' unexpected values",
                            left: {
                                type: left,
                                location: expression.left.location,
                            },
                            right: {
                                type: right,
                                location: expression.right.location,
                            },
                        })
                    );
                }
            default:
                return this.addError(
                    new BrsError(
                        `Received unexpected token kind '${expression.token.kind}'`,
                        expression.token.location
                    )
                );
        }
    }

    visitTryCatch(statement: Stmt.TryCatch): BrsInvalid {
        this.visitBlock(statement.tryBlock);
        return BrsInvalid.Instance;
    }

    visitBlock(block: Stmt.Block): BrsType {
        block.statements.forEach((statement) => this.execute(statement));
        return BrsInvalid.Instance;
    }

    visitContinueFor(statement: Stmt.ContinueFor): never {
        throw new Stmt.ContinueForReason(statement.location);
    }

    visitExitFor(statement: Stmt.ExitFor): never {
        throw new Stmt.ExitForReason(statement.location);
    }

    visitContinueWhile(statement: Stmt.ContinueWhile): never {
        throw new Stmt.ContinueWhileReason(statement.location);
    }

    visitExitWhile(statement: Stmt.ExitWhile): never {
        throw new Stmt.ExitWhileReason(statement.location);
    }

    visitCall(expression: Expr.Call) {
        let functionName = "[anonymous function]";
        // TODO: auto-box
        if (
            expression.callee instanceof Expr.Variable ||
            expression.callee instanceof Expr.DottedGet
        ) {
            functionName = expression.callee.name.text;
        }

        // evaluate the function to call (it could be the result of another function call)
        const callee = this.evaluate(expression.callee);
        // evaluate all of the arguments as well (they could also be function calls)
        let args = expression.args.map(this.evaluate, this);

        if (!isBrsCallable(callee)) {
            return this.addError(
                new BrsError(
                    `'${functionName}' is not a function and cannot be called.`,
                    expression.closingParen.location
                )
            );
        }

        functionName = callee.getName();

        let satisfiedSignature = callee.getFirstSatisfiedSignature(args);

        if (satisfiedSignature) {
            try {
                let signature = satisfiedSignature.signature;
                args = args.map((arg, index) => {
                    // any arguments of type "object" must be automatically boxed
                    if (signature.args[index].type.kind === ValueKind.Object && isBoxable(arg)) {
                        return arg.box();
                    }

                    return arg;
                });
                let mPointer = this._environment.getRootM();
                if (expression.callee instanceof Expr.DottedGet) {
                    mPointer = callee.getContext() ?? mPointer;
                }
                return this.inSubEnv((subInterpreter) => {
                    subInterpreter.environment.setM(mPointer);
                    return callee.call(this, ...args);
                });
            } catch (reason) {
                if (!(reason instanceof Stmt.BlockEnd)) {
                    // re-throw interpreter errors
                    throw reason;
                }

                let returnedValue = (reason as Stmt.ReturnValue).value;
                let returnLocation = (reason as Stmt.ReturnValue).location;

                if (returnedValue && satisfiedSignature.signature.returns === ValueKind.Void) {
                    this.addError(
                        new Stmt.Runtime(
                            `Attempting to return value of non-void type ${ValueKind.toString(
                                returnedValue.kind
                            )} ` + `from function ${callee.getName()} with void return type.`,
                            returnLocation
                        )
                    );
                }

                if (!returnedValue && satisfiedSignature.signature.returns !== ValueKind.Void) {
                    this.addError(
                        new Stmt.Runtime(
                            `Attempting to return void value from function ${callee.getName()} with non-void return type.`,
                            returnLocation
                        )
                    );
                }

                if (
                    returnedValue &&
                    isBoxable(returnedValue) &&
                    satisfiedSignature.signature.returns === ValueKind.Object
                ) {
                    returnedValue = returnedValue.box();
                }

                if (
                    returnedValue &&
                    satisfiedSignature.signature.returns !== ValueKind.Dynamic &&
                    satisfiedSignature.signature.returns !== returnedValue.kind
                ) {
                    this.addError(
                        new Stmt.Runtime(
                            `Attempting to return value of type ${ValueKind.toString(
                                returnedValue.kind
                            )}, ` +
                                `but function ${callee.getName()} declares return value of type ` +
                                ValueKind.toString(satisfiedSignature.signature.returns),
                            returnLocation
                        )
                    );
                }

                return returnedValue || BrsInvalid.Instance;
            }
        } else {
            return this.addError(
                generateArgumentMismatchError(callee, args, expression.closingParen.location)
            );
        }
    }

    visitDottedGet(expression: Expr.DottedGet) {
        let source = this.evaluate(expression.obj);

        if (isIterable(source)) {
            try {
                const target = source.get(new BrsString(expression.name.text));
                if (isBrsCallable(target) && source instanceof RoAssociativeArray) {
                    target.setContext(source);
                }
                return target;
            } catch (err: any) {
                return this.addError(new BrsError(err.message, expression.name.location));
            }
        }

        let boxedSource = isBoxable(source) ? source.box() : source;
        if (boxedSource instanceof BrsComponent) {
            try {
                return boxedSource.getMethod(expression.name.text) || BrsInvalid.Instance;
            } catch (err: any) {
                return this.addError(new BrsError(err.message, expression.name.location));
            }
        } else {
            return this.addError(
                new TypeMismatch({
                    message: "DottedGet: Attempting to retrieve property from non-iterable value",
                    left: {
                        type: source,
                        location: expression.location,
                    },
                })
            );
        }
    }

    visitIndexedGet(expression: Expr.IndexedGet): BrsType {
        let source = this.evaluate(expression.obj);
        if (!isIterable(source)) {
            this.addError(
                new TypeMismatch({
                    message: "IndexedGet: Attempting to retrieve property from non-iterable value",
                    left: {
                        type: source,
                        location: expression.location,
                    },
                })
            );
        }

        let index = this.evaluate(expression.index);
        if (!isBrsNumber(index) && !isBrsString(index)) {
            this.addError(
                new TypeMismatch({
                    message:
                        "Attempting to retrieve property from iterable with illegal index type",
                    left: {
                        type: source,
                        location: expression.obj.location,
                    },
                    right: {
                        type: index,
                        location: expression.index.location,
                    },
                })
            );
        }

        try {
            return source.get(index, true);
        } catch (err: any) {
            return this.addError(new BrsError(err.message, expression.closingSquare.location));
        }
    }

    visitGrouping(expr: Expr.Grouping) {
        return this.evaluate(expr.expression);
    }

    visitFor(statement: Stmt.For): BrsType {
        // BrightScript for/to loops evaluate the counter initial value, final value, and increment
        // values *only once*, at the top of the for/to loop.
        this.execute(statement.counterDeclaration);
        const startValue = this.evaluate(statement.counterDeclaration.value) as Int32 | Float;
        const finalValue = this.evaluate(statement.finalValue) as Int32 | Float;
        let increment = this.evaluate(statement.increment) as Int32 | Float;
        if (increment instanceof Float) {
            increment = new Int32(Math.trunc(increment.getValue()));
        }
        if (
            (startValue.getValue() > finalValue.getValue() && increment.getValue() > 0) ||
            (startValue.getValue() < finalValue.getValue() && increment.getValue() < 0)
        ) {
            // Shortcut, do not process anything
            return BrsInvalid.Instance;
        }
        const counterName = statement.counterDeclaration.name;
        const step = new Stmt.Assignment(
            { equals: statement.tokens.for },
            counterName,
            new Expr.Binary(
                new Expr.Variable(counterName),
                {
                    kind: Lexeme.Plus,
                    text: "+",
                    isReserved: false,
                    location: {
                        start: {
                            line: -1,
                            column: -1,
                        },
                        end: {
                            line: -1,
                            column: -1,
                        },
                        file: "(internal)",
                    },
                },
                new Expr.Literal(increment, statement.increment.location)
            )
        );

        if (increment.getValue() > 0) {
            while (
                (this.evaluate(new Expr.Variable(counterName)) as Int32 | Float)
                    .greaterThan(finalValue)
                    .not()
                    .toBoolean()
            ) {
                // execute the block
                try {
                    this.execute(statement.body);
                } catch (reason) {
                    if (reason instanceof Stmt.ExitForReason) {
                        break;
                    } else if (!(reason instanceof Stmt.ContinueForReason)) {
                        // re-throw returns, runtime errors, etc.
                        throw reason;
                    }
                }

                // then increment the counter
                this.execute(step);
            }
        } else {
            while (
                (this.evaluate(new Expr.Variable(counterName)) as Int32 | Float)
                    .lessThan(finalValue)
                    .not()
                    .toBoolean()
            ) {
                // execute the block
                try {
                    this.execute(statement.body);
                } catch (reason) {
                    if (reason instanceof Stmt.ExitForReason) {
                        break;
                    } else if (!(reason instanceof Stmt.ContinueForReason)) {
                        // re-throw returns, runtime errors, etc.
                        throw reason;
                    }
                }

                // then increment the counter
                this.execute(step);
            }
        }

        return BrsInvalid.Instance;
    }

    visitForEach(statement: Stmt.ForEach): BrsType {
        let target = this.evaluate(statement.target);
        if (!isIterable(target)) {
            // Roku device does not crash if the value is not iterable, just send a console message
            const message = `BRIGHTSCRIPT: ERROR: Runtime: FOR EACH value is ${ValueKind.toString(
                target.kind
            )}`;
            const location = `${statement.item.location.file}(${statement.item.location.start.line})`;
            this.stderr.write(`${message}: ${location}\n`);
            return BrsInvalid.Instance;
        }

        target.getElements().every((element) => {
            this.environment.define(Scope.Function, statement.item.text!, element);

            // execute the block
            try {
                this.execute(statement.body);
            } catch (reason) {
                if (reason instanceof Stmt.ExitForReason) {
                    // break out of the loop
                    return false;
                } else if (!(reason instanceof Stmt.ContinueForReason)) {
                    // re-throw returns, runtime errors, etc.
                    throw reason;
                }
            }

            // keep looping
            return true;
        });

        return BrsInvalid.Instance;
    }

    visitWhile(statement: Stmt.While): BrsType {
        while (this.evaluate(statement.condition).equalTo(BrsBoolean.True).toBoolean()) {
            try {
                this.execute(statement.body);
            } catch (reason) {
                if (reason instanceof Stmt.ExitWhileReason) {
                    break;
                } else if (!(reason instanceof Stmt.ContinueWhileReason)) {
                    // re-throw returns, runtime errors, etc.
                    throw reason;
                }
            }
        }

        return BrsInvalid.Instance;
    }

    visitIf(statement: Stmt.If): BrsType {
        if (this.evaluate(statement.condition).equalTo(BrsBoolean.True).toBoolean()) {
            this.execute(statement.thenBranch);
            return BrsInvalid.Instance;
        } else {
            for (const elseIf of statement.elseIfs || []) {
                if (this.evaluate(elseIf.condition).equalTo(BrsBoolean.True).toBoolean()) {
                    this.execute(elseIf.thenBranch);
                    return BrsInvalid.Instance;
                }
            }

            if (statement.elseBranch) {
                this.execute(statement.elseBranch);
            }

            return BrsInvalid.Instance;
        }
    }

    visitAnonymousFunction(func: Expr.Function): BrsType {
        return toCallable(func);
    }

    visitLiteral(expression: Expr.Literal): BrsType {
        return expression.value;
    }

    visitArrayLiteral(expression: Expr.ArrayLiteral): RoArray {
        return new RoArray(expression.elements.map((expr) => this.evaluate(expr)));
    }

    visitAALiteral(expression: Expr.AALiteral): BrsType {
        return new RoAssociativeArray(
            expression.elements.map((member) => ({
                name: member.name,
                value: this.evaluate(member.value),
            }))
        );
    }

    visitDottedSet(statement: Stmt.DottedSet) {
        let source = this.evaluate(statement.obj);
        let value = this.evaluate(statement.value);

        if (!isIterable(source)) {
            return this.addError(
                new TypeMismatch({
                    message: "Attempting to set property on non-iterable value",
                    left: {
                        type: source,
                        location: statement.name.location,
                    },
                })
            );
        }

        try {
            source.set(new BrsString(statement.name.text), value);
        } catch (err: any) {
            return this.addError(new BrsError(err.message, statement.name.location));
        }

        return BrsInvalid.Instance;
    }

    visitIndexedSet(statement: Stmt.IndexedSet) {
        let source = this.evaluate(statement.obj);

        if (!isIterable(source)) {
            return this.addError(
                new TypeMismatch({
                    message: "Attempting to set property on non-iterable value",
                    left: {
                        type: source,
                        location: statement.obj.location,
                    },
                })
            );
        }

        let index = this.evaluate(statement.index);
        if (!isBrsNumber(index) && !isBrsString(index)) {
            return this.addError(
                new TypeMismatch({
                    message: "Attempting to set property on iterable with illegal index type",
                    left: {
                        type: source,
                        location: statement.obj.location,
                    },
                    right: {
                        type: index,
                        location: statement.index.location,
                    },
                })
            );
        }

        let value = this.evaluate(statement.value);

        try {
            source.set(index, value, true);
        } catch (err: any) {
            return this.addError(new BrsError(err.message, statement.closingSquare.location));
        }

        return BrsInvalid.Instance;
    }

    visitIncrement(statement: Stmt.Increment) {
        let target = this.evaluate(statement.value);
        if (isBoxedNumber(target)) {
            target = target.unbox();
        }

        if (!isBrsNumber(target)) {
            let operation = statement.token.kind === Lexeme.PlusPlus ? "increment" : "decrement";
            return this.addError(
                new BrsError(
                    `Attempting to ${operation} value of non-numeric type ${ValueKind.toString(
                        target.kind
                    )}`,
                    statement.location
                )
            );
        }

        let result: BrsNumber;
        if (statement.token.kind === Lexeme.PlusPlus) {
            result = target.add(new Int32(1));
        } else {
            result = target.subtract(new Int32(1));
        }

        if (statement.value instanceof Expr.Variable) {
            // store the result of the operation
            this.environment.define(Scope.Function, statement.value.name.text, result);
        } else if (statement.value instanceof Expr.DottedGet) {
            // immediately execute a dotted "set" statement
            this.execute(
                new Stmt.DottedSet(
                    statement.value.obj,
                    statement.value.name,
                    new Expr.Literal(result, statement.location)
                )
            );
        } else if (statement.value instanceof Expr.IndexedGet) {
            // immediately execute an indexed "set" statement
            this.execute(
                new Stmt.IndexedSet(
                    statement.value.obj,
                    statement.value.index,
                    new Expr.Literal(result, statement.location),
                    statement.value.closingSquare
                )
            );
        }

        // always return `invalid`, because ++/-- are purely side-effects in BrightScript
        return BrsInvalid.Instance;
    }

    visitUnary(expression: Expr.Unary) {
        let right = this.evaluate(expression.right);
        if (isBoxedNumber(right)) {
            right = right.unbox();
        }

        switch (expression.operator.kind) {
            case Lexeme.Minus:
                if (isBrsNumber(right)) {
                    return right.multiply(new Int32(-1));
                } else {
                    return this.addError(
                        new BrsError(
                            `Attempting to negate non-numeric value.
                            value type: ${ValueKind.toString(right.kind)}`,
                            expression.operator.location
                        )
                    );
                }
            case Lexeme.Plus:
                if (isBrsNumber(right)) {
                    return right;
                } else {
                    return this.addError(
                        new BrsError(
                            `Attempting to apply unary positive operator to non-numeric value.
                            value type: ${ValueKind.toString(right.kind)}`,
                            expression.operator.location
                        )
                    );
                }
            case Lexeme.Not:
                if (isBrsBoolean(right) || isBrsNumber(right)) {
                    return right.not();
                } else {
                    return this.addError(
                        new BrsError(
                            `Type Mismatch. Operator "not" can't be applied to "${ValueKind.toString(
                                right.kind
                            )}".`,
                            expression.operator.location
                        )
                    );
                }
        }

        return BrsInvalid.Instance;
    }

    visitVariable(expression: Expr.Variable) {
        try {
            return this.environment.get(expression.name);
        } catch (err) {
            if (err instanceof NotFound) {
                return Uninitialized.Instance;
            }

            throw err;
        }
    }

    evaluate(this: Interpreter, expression: Expr.Expression): BrsType {
        this.location = expression.location;
        this.stack.push(this.location);
        this.reportCoverageHit(expression);

        let value;
        try {
            value = expression.accept<BrsType>(this);
            this.stack.pop();
        } catch (err) {
            this.stack.pop();
            throw err;
        }

        return value;
    }

    execute(this: Interpreter, statement: Stmt.Statement): BrsType {
        this.location = statement.location;
        this.stack.push(this.location);
        this.reportCoverageHit(statement);

        let value;
        try {
            value = statement.accept<BrsType>(this);
            this.stack.pop();
        } catch (err) {
            this.stack.pop();
            throw err;
        }

        return value;
    }

    /**
     * Method to return the current scope of the interpreter for the REPL and Micro Debugger
     * @returns a string representation of the local variables in the current scope
     */
    debugLocalVariables(): string {
        let debugMsg = `${"global".padEnd(16)} Interface:ifGlobal\r\n`;
        debugMsg += `${"m".padEnd(16)} roAssociativeArray count:${
            this.environment.getM().getElements().length
        }\r\n`;
        let fnc = this.environment.getList(Scope.Function);
        fnc.forEach((value, key) => {
            const varName = key.padEnd(17);
            if (PrimitiveKinds.has(value.kind)) {
                let text = value.toString();
                let lf = text.length <= 94 ? "\r\n" : "...\r\n";
                if (value.kind === ValueKind.String) {
                    text = `"${text.substring(0, 94)}"`;
                }
                debugMsg += `${varName}${ValueKind.toString(value.kind)} val:${text}${lf}`;
            } else if (isIterable(value)) {
                const count = value.getElements().length;
                debugMsg += `${varName}${value.getComponentName()} count:${count}\r\n`;
            } else if (value instanceof BrsComponent && isUnboxable(value)) {
                const unboxed = value.unbox();
                debugMsg += `${varName}${value.getComponentName()} val:${unboxed.toString()}\r\n`;
            } else if (value.kind === ValueKind.Object) {
                debugMsg += `${varName}${value.getComponentName()}\r\n`;
            } else if (value.kind === ValueKind.Callable) {
                debugMsg += `${varName}${ValueKind.toString(
                    value.kind
                )} val:${value.getName()}\r\n`;
            } else {
                debugMsg += `${varName}${value.toString().substring(0, 94)}\r\n`;
            }
        });
        return debugMsg;
    }

    /** Method to return a string with the current source code location
     * @returns a string representation of the location
     */
    formatLocation(location: Location = this.location) {
        let formattedLocation: string;
        if (location.start.line) {
            formattedLocation = `pkg:/${location.file}(${location.start.line})`;
        } else {
            formattedLocation = `pkg:/${location.file}(??)`;
        }
        return formattedLocation;
    }

    /**
     * Emits an error via this processor's `events` property, then throws it.
     * @param err the ParseError to emit then throw
     */
    public addError(err: BrsError): never {
        this.errors.push(err);
        this.events.emit("err", err);
        throw err;
    }

    private isPositive(value: number | Long): boolean {
        if (value instanceof Long) {
            return value.isPositive();
        }
        return value >= 0;
    }

    private lessThan(value: number | Long, compare: number): boolean {
        if (value instanceof Long) {
            return value.lessThan(compare);
        }
        return value < compare;
    }
}

/**
 * Colorizes the console messages.
 *
 */
export function colorize(log: string) {
    return log
        .replace(/\b(down|error|errors|failure|fail|fatal|false)(:|\b)/gi, chalk.red("$1$2"))
        .replace(/\b(warning|warn|test|null|undefined|invalid)(:|\b)/gi, chalk.yellow("$1$2"))
        .replace(/\b(help|hint|info|information|true|log)(:|\b)/gi, chalk.cyan("$1$2"))
        .replace(/\b(running|success|successfully|valid)(:|\b)/gi, chalk.green("$1$2"))
        .replace(/\b(debug|roku|brs|brightscript)(:|\b)/gi, chalk.magenta("$1$2"))
        .replace(/(\b\d+\.?\d*?\b)/g, chalk.ansi256(122)(`$1`)) // Numeric
        .replace(/\S+@\S+\.\S+/g, (match: string) => {
            return chalk.blueBright(stripAnsi(match)); // E-Mail
        })
        .replace(/\b([a-z]+):\/{1,2}[^\/].*/gi, (match: string) => {
            return chalk.blue.underline(stripAnsi(match)); // URL
        })
        .replace(/<(.*?)>/g, (match: string) => {
            return chalk.greenBright(stripAnsi(match)); // Delimiters < >
        })
        .replace(/"(.*?)"/g, (match: string) => {
            return chalk.ansi256(222)(stripAnsi(match)); // Quotes
        });
}
