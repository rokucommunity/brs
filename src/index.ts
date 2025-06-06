import * as fs from "fs";
import * as readline from "readline";
import chalk from "chalk";

import { promisify } from "util";
const mkdtemp = promisify(fs.mkdtemp);
import decompress from "decompress";
import sanitizeFilename from "sanitize-filename";

import { Lexer } from "./lexer";
import * as PP from "./preprocessor";
import { getComponentDefinitionMap, ComponentDefinition, ComponentScript } from "./scenegraph";
import { Parser } from "./parser";
import { Interpreter, ExecutionOptions, defaultExecutionOptions, colorize } from "./interpreter";
import { resetTestData } from "./extensions";
import * as BrsError from "./Error";
import * as LexerParser from "./LexerParser";
import { CoverageCollector } from "./coverage";
import { loadTranslationFiles } from "./stdlib";

import * as _lexer from "./lexer";
export { _lexer as lexer };
import * as BrsTypes from "./brsTypes";
export { BrsTypes as types };
export { PP as preprocessor };
import * as _parser from "./parser";
export { _parser as parser };
import { URL } from "url";
import * as path from "path";
import pSettle from "p-settle";
import os from "os";
import { Scope } from "./interpreter/Environment";

let coverageCollector: CoverageCollector | null = null;

/**
 * Executes a BrightScript file by path and writes its output to the streams
 * provided in `options`.
 *
 * @param filename the absolute path to the `.brs` file to be executed
 * @param options configuration for the execution, including the streams to use for `stdout` and
 *                `stderr` and the base directory for path resolution
 *
 * @returns a `Promise` that will be resolve if `filename` is successfully
 *          executed, or be rejected if an error occurs.
 */
export async function execute(filenames: string[], options: Partial<ExecutionOptions>) {
    let { lexerParserFn, interpreter } = await loadFiles(options);
    let scripts = new Array<ComponentScript>();
    filenames.forEach((file) => {
        scripts.push({ type: "text/brightscript", uri: file });
    });
    let mainStatements = await lexerParserFn(scripts);
    return interpreter.exec(mainStatements);
}

async function loadFiles(options: Partial<ExecutionOptions>) {
    const executionOptions = { ...defaultExecutionOptions, ...options };

    let manifest = await PP.getManifest(executionOptions.root);
    let maybeLibraryName = options.isComponentLibrary
        ? manifest.get("sg_component_libs_provided")
        : undefined;
    if (typeof maybeLibraryName === "boolean") {
        throw new Error(
            "Encountered invalid boolean value for manifest key 'sg_component_libs_provided'"
        );
    } else if (options.isComponentLibrary && maybeLibraryName == null) {
        throw new Error(
            "Could not find required manifest key 'sg_component_libs_provided' in component library"
        );
    }
    let componentDefinitions = await getComponentDefinitionMap(
        executionOptions.root,
        executionOptions.componentDirs,
        maybeLibraryName
    );

    let componentLibraries = Array.from(componentDefinitions.values())
        .map((component: ComponentDefinition) => ({
            component,
            libraries: component.children.filter(
                (child) => child.name.toLowerCase() === "componentlibrary"
            ),
        }))
        .filter(({ libraries }) => libraries && libraries.length > 0);

    let knownComponentLibraries = new Map<string, string>();
    let componentLibrariesToLoad: ReturnType<typeof loadFiles>[] = [];
    for (let { component, libraries } of componentLibraries) {
        for (let cl of libraries) {
            let uri = cl.fields.uri;
            if (!uri) {
                continue;
            }
            if (uri.startsWith("http://") || uri.startsWith("https://")) {
                executionOptions.stderr.write(
                    `WARNING: Only pkg:/-local component libraries are supported; ignoring '${uri}'\n`
                );
                continue;
            }
            let posixRoot = executionOptions.root.replace(/[\/\\]+/g, path.posix.sep);
            let posixPath = component.xmlPath.replace(/[\/\\]+/g, path.posix.sep);
            if (process.platform === "win32") {
                posixRoot = posixRoot.replace(/^[a-zA-Z]:/, "");
                posixPath = posixPath.replace(/^[a-zA-Z]:/, "");
            }

            let packageUri = new URL(
                uri,
                `pkg:/${path.posix.relative(posixRoot, posixPath)}`
            ).toString();
            if (knownComponentLibraries.has(packageUri)) {
                continue;
            }

            let sanitizedUri = sanitizeFilename(packageUri);
            let tempdir = await mkdtemp(path.join(os.tmpdir(), `brs-${sanitizedUri}`), "utf8");
            knownComponentLibraries.set(packageUri, tempdir);

            let zipFileOnDisk = path.join(executionOptions.root, new URL(uri).pathname);

            componentLibrariesToLoad.push(
                decompress(zipFileOnDisk, tempdir).then(() =>
                    loadFiles({
                        ...options,
                        root: tempdir,
                        componentDirs: [],
                        isComponentLibrary: true,
                    })
                )
            );
        }
    }

    componentDefinitions.forEach((component: ComponentDefinition) => {
        if (component.scripts.length < 1) return;
        try {
            component.scripts = component.scripts.map((script: ComponentScript) => {
                if (script.uri) {
                    script.uri = path.join(executionOptions.root, new URL(script.uri).pathname);
                }
                return script;
            });
        } catch (error) {
            throw new Error(
                `Encountered an error when parsing component ${component.name}: ${error}`
            );
        }
    });

    const interpreter = await Interpreter.withSubEnvsFromComponents(
        componentDefinitions,
        manifest,
        executionOptions
    );
    if (!interpreter) {
        throw new Error("Unable to build interpreter.");
    }

    // Store manifest as a property on the Interpreter for further reusing
    interpreter.manifest = manifest;

    let componentLibraryInterpreters = (await pSettle(componentLibrariesToLoad))
        .filter((result) => result.isFulfilled)
        .map((result) => result.value!.interpreter);
    interpreter.mergeNodeDefinitionsWith(componentLibraryInterpreters);

    await loadTranslationFiles(interpreter, executionOptions.root);
    let lexerParserFn = LexerParser.getLexerParserFn(manifest, options);
    if (executionOptions.generateCoverage) {
        coverageCollector = new CoverageCollector(executionOptions.root, lexerParserFn);
        await coverageCollector.crawlBrsFiles();
        interpreter.setCoverageCollector(coverageCollector);
    }
    return { lexerParserFn, interpreter };
}

/**
 * Returns a summary of the code coverage.
 */
export function getCoverageResults() {
    if (!coverageCollector) return;
    return coverageCollector.getCoverage();
}

/**
 * A synchronous version of the lexer-parser flow.
 *
 * @param filename the paths to BrightScript files to lex and parse synchronously
 * @param options configuration for the execution, including the streams to use for `stdout` and
 *                `stderr` and the base directory for path resolution
 *
 * @returns the AST produced from lexing and parsing the provided files
 */
export function lexParseSync(filenames: string[], options: Partial<ExecutionOptions>) {
    const executionOptions = { ...defaultExecutionOptions, ...options };

    let manifest = PP.getManifestSync(executionOptions.root);

    return filenames
        .map((filename) => {
            let lexer = new Lexer();
            let preprocessor = new PP.Preprocessor();
            let parser = new Parser();
            [lexer, preprocessor, parser].forEach((emitter) =>
                emitter.onError(BrsError.getLoggerUsing(executionOptions.stderr))
            );

            let contents = fs.readFileSync(filename, "utf8");
            let scanResults = lexer.scan(contents, filename);
            let preprocessorResults = preprocessor.preprocess(scanResults.tokens, manifest);
            let parseResults = parser.parse(preprocessorResults.processedTokens);

            if (parseResults.errors.length > 0) {
                throw "Error occurred parsing";
            }

            return parseResults.statements;
        })
        .reduce((allStatements, statements) => [...allStatements, ...statements], []);
}

export type ExecuteWithScope = (filenames: string[], args: BrsTypes.BrsType[]) => BrsTypes.BrsType;
/**
 * Runs a set of files to create an execution scope, and generates an execution function that runs in that scope.
 *
 * @param filenamesForScope List of filenames to put into the execution scope
 * @param options Execution options
 *
 * @returns A function to execute files using the created scope.
 */
export async function createExecuteWithScope(
    filenamesForScope: string[],
    options: Partial<ExecutionOptions>
): Promise<ExecuteWithScope> {
    let { lexerParserFn, interpreter } = await loadFiles(options);
    let scripts = new Array<ComponentScript>();
    filenamesForScope.forEach((file) => {
        scripts.push({ type: "text/brightscript", uri: file });
    });
    let mainStatements = await lexerParserFn(scripts);
    interpreter.exec(mainStatements);
    // Clear any errors that accumulated, so that we can isolate errors from future calls to the execute function.
    interpreter.errors = [];

    return (filenames: string[], args: BrsTypes.BrsType[]) => {
        // Reset any mocks so that subsequent executions don't interfere with each other.
        interpreter.environment.resetMocks();
        resetTestData();

        let ast = lexParseSync(filenames, interpreter.options);
        let execErrors: BrsError.BrsError[] = [];
        let returnValue = interpreter.inSubEnv((subInterpreter) => {
            let value = subInterpreter.exec(ast, ...args)[0] || BrsTypes.BrsInvalid.Instance;
            execErrors = subInterpreter.errors;
            subInterpreter.errors = [];
            return value;
        });

        // Re-throw any errors the interpreter encounters. We can't throw them directly from the `inSubEnv` call,
        // because they get caught by upstream handlers.
        if (execErrors.length) {
            throw execErrors;
        }

        return returnValue;
    };
}

/**
 * Launches an interactive read-execute-print loop, which reads input from
 * `stdin` and executes it.
 *
 * **NOTE:** Currently limited to single-line inputs :(
 */
export function repl() {
    const replInterpreter = new Interpreter();
    replInterpreter.onError(BrsError.getLoggerUsing(process.stderr));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.setPrompt(`${chalk.magenta("brs")}> `);
    rl.on("line", (line) => {
        const cmd = line.trim().toLowerCase();
        if (["quit", "exit", "q"].includes(cmd)) {
            process.exit();
        } else if (["cls", "clear"].includes(cmd)) {
            process.stdout.write("\x1Bc");
            rl.prompt();
            return;
        } else if (["help", "hint"].includes(cmd)) {
            printHelp();
            rl.prompt();
            return;
        } else if (["var", "vars"].includes(line.split(" ")[0]?.toLowerCase().trim())) {
            const scopeName = line.split(" ")[1]?.toLowerCase().trim() ?? "function";
            let scope = Scope.Function;
            if (scopeName === "global") {
                scope = Scope.Global;
                console.log(chalk.cyanBright(`\r\nGlobal variables:\r\n`));
            } else if (scopeName === "module") {
                scope = Scope.Module;
                console.log(chalk.cyanBright(`\r\nModule variables:\r\n`));
            } else {
                console.log(chalk.cyanBright(`\r\nLocal variables:\r\n`));
            }
            console.log(chalk.cyanBright(replInterpreter.formatVariables(scope)));
            rl.prompt();
            return;
        }
        let results = run(line, defaultExecutionOptions, replInterpreter);
        if (results) {
            results.map((result) => {
                if (result !== BrsTypes.BrsInvalid.Instance) {
                    console.log(colorize(result.toString()));
                }
            });
        }
        rl.prompt();
    });

    console.log(colorize("type `help` to see the list of valid REPL commands.\r\n"));
    rl.prompt();
}

/**
 * Runs an arbitrary string of BrightScript code.
 * @param contents the BrightScript code to lex, parse, and interpret.
 * @param options the streams to use for `stdout` and `stderr`. Mostly used for
 *                testing.
 * @param interpreter an interpreter to use when executing `contents`. Required
 *                    for `repl` to have persistent state between user inputs.
 * @returns an array of statement execution results, indicating why each
 *          statement exited and what its return value was, or `undefined` if
 *          `interpreter` threw an Error.
 */
function run(
    contents: string,
    options: ExecutionOptions = defaultExecutionOptions,
    interpreter: Interpreter
) {
    const lexer = new Lexer();
    const parser = new Parser();
    const logErrorFn = BrsError.getLoggerUsing(options.stderr);

    lexer.onError(logErrorFn);
    parser.onError(logErrorFn);

    const scanResults = lexer.scan(contents, "REPL");
    if (scanResults.errors.length > 0) {
        return;
    }

    const parseResults = parser.parse(scanResults.tokens);
    if (parseResults.errors.length > 0) {
        return;
    }

    if (parseResults.statements.length === 0) {
        return;
    }

    try {
        return interpreter.exec(parseResults.statements);
    } catch (e) {
        //options.stderr.write(e.message);
        return;
    }
}

/**
 * Display the help message on the console.
 */
function printHelp() {
    let helpMsg = "\r\n";
    helpMsg += "REPL Command List:\r\n";
    helpMsg += "   print|?           Print variable value or expression\r\n";
    helpMsg += "   var|vars [scope]  Display variables and their types/values\r\n";
    helpMsg += "   help|hint         Show this REPL command list\r\n";
    helpMsg += "   clear|cls         Clear terminal screen\r\n";
    helpMsg += "   exit|quit|q       Terminate REPL session\r\n\r\n";
    helpMsg += "   Type any valid BrightScript expression for a live compile and run.\r\n";
    console.log(chalk.cyanBright(helpMsg));
}
